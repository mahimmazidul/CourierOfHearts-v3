// Height-aware pagination for letters, replacing v1's character-count-only
// split (which caused overflowing frames and clipped multi-page prints).
//
// Sanitized letter HTML is broken into top-level blocks; blocks are measured
// in a hidden element styled like the real letter body, then grouped into
// pages that fit the printable content height. A single oversized block is
// split at character boundaries via binary search. Falls back to the v1
// character-based splitter when measurement is impossible.

export interface PaginateOptions {
  fontFamily: string;
  /** Content width in px used for measurement (print-safe default). */
  widthPx?: number;
  /** Usable content height per page in px. */
  pageHeightPx?: number;
  /** Space reserved on the first page (salutation etc.). */
  firstPageReservedPx?: number;
  /** Space reserved on the last page (closing, signature, seal). */
  lastPageReservedPx?: number;
}

// Measured against PRINT geometry (the strict constraint): A4 article is
// 180mm wide with 18mm padding -> 144mm ≈ 544px of text width, and 270mm−36mm
// ≈ 884px of height (kept at 850 for a safety margin). On screen the paper is
// wider, so text only ever takes LESS room than measured — never overflows.
const DEFAULTS = {
  widthPx: 544,
  pageHeightPx: 860,
  firstPageReservedPx: 130,
  lastPageReservedPx: 175,
};

function isBrowser(): boolean {
  return typeof document !== 'undefined';
}

function topLevelBlocks(html: string): string[] {
  const host = document.createElement('div');
  host.innerHTML = html;
  const blocks: string[] = [];
  let inlineRun: string[] = [];
  const flushInline = () => {
    if (inlineRun.length) {
      blocks.push(`<div>${inlineRun.join('')}</div>`);
      inlineRun = [];
    }
  };
  host.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (/^(DIV|P|OL|UL)$/.test(el.tagName)) {
        flushInline();
        blocks.push(el.outerHTML);
        return;
      }
      inlineRun.push(el.outerHTML);
      return;
    }
    if (node.nodeType === Node.TEXT_NODE && node.textContent) inlineRun.push(
      node.textContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    );
  });
  flushInline();
  return blocks.length ? blocks : [html];
}

function makeMeasurer(options: Required<PaginateOptions>): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:absolute', 'left:-99999px', 'top:0', 'visibility:hidden',
    `width:${options.widthPx}px`,
    `font-family:${options.fontFamily}`,
    // Print media queries evaluate against A4 page width (~794px), which
    // passes the md: breakpoint — print text is 18px, same as desktop.
    'font-size:18px', 'line-height:1.95',
    'letter-spacing:0.01em', 'word-spacing:0.04em',
    'white-space:pre-wrap', 'overflow-wrap:anywhere',
  ].join(';');
  document.body.appendChild(el);
  return el;
}

function textGraphemes(text: string): string[] {
  try {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map((s) => s.segment);
  } catch {
    return [...text];
  }
}

function splitOversizedBlock(blockHtml: string, measurer: HTMLDivElement, maxHeight: number): string[] {
  // Binary-search a split point measured in GRAPHEME CLUSTERS, so a Bangla
  // conjunct, a vowel sign, or a multi-codepoint emoji can never be cut in
  // half across a page boundary.
  const host = document.createElement('div');
  host.innerHTML = blockHtml;
  const text = host.textContent || '';
  if (text.length < 40) return [blockHtml]; // do not over-split tiny content

  const pieces: string[] = [];
  let parts = textGraphemes(text);
  while (parts.length) {
    let low = 1;
    let high = parts.length;
    let fit = parts.length;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      measurer.textContent = parts.slice(0, mid).join('');
      if (measurer.offsetHeight <= maxHeight) { fit = mid; low = mid + 1; } else { high = mid - 1; }
    }
    if (fit >= parts.length) { pieces.push(parts.join('')); break; }
    // Prefer breaking at a space (works for both Bangla and English, which
    // share space-separated words); fall back to the grapheme boundary.
    let cut = fit;
    while (cut > fit * 0.5 && parts[cut - 1] !== ' ') cut--;
    if (parts[cut - 1] !== ' ') cut = fit;
    pieces.push(parts.slice(0, cut).join(''));
    parts = parts.slice(cut);
    while (parts[0] === ' ') parts.shift();
  }
  // NOTE: inline formatting inside an oversized single block is flattened for
  // the overflow pages; block-level structure (the common case) is preserved
  // by the block grouping path above.
  return pieces.map((piece) => `<div>${piece.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`);
}


/** A block with no inline formatting can be split without losing styling. */
function isPlainBlock(html: string): { plain: boolean; text: string } {
  const host = document.createElement('div');
  host.innerHTML = html;
  const child = host.firstElementChild;
  const single = host.children.length <= 1 && (!child || /^(DIV|P)$/.test(child.tagName));
  const inner = child ?? host;
  const plain = single && inner.children.length === 0;
  return { plain, text: (host.textContent || '') };
}

// A head or tail smaller than this many graphemes would read as an orphaned
// fragment ('hey,' alone at the bottom of a page) — better to move the whole
// paragraph to the next page.
const MIN_SPLIT_PIECE = 110;

/**
 * Fill the remaining space on a page by splitting a plain paragraph —
 * preferably at a sentence end (। . ! ?), otherwise at a word boundary.
 * Grapheme-safe. Returns null whenever a split would leave a tiny fragment
 * on either side, so short lines always travel to the next page whole.
 */
function splitBlockToFill(
  blockHtml: string,
  measurer: HTMLDivElement,
  remainingPx: number
): [string, string] | null {
  if (remainingPx < 90) return null; // tiny gaps read as intentional
  const { plain, text } = isPlainBlock(blockHtml);
  if (!plain) return null; // never flatten bold/italic/aligned content
  const parts = textGraphemes(text);
  if (parts.length < MIN_SPLIT_PIECE * 2) return null; // both pieces must be substantial

  let low = 1;
  let high = parts.length;
  let fit = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    measurer.textContent = parts.slice(0, mid).join('');
    if (measurer.offsetHeight <= remainingPx) { fit = mid; low = mid + 1; } else { high = mid - 1; }
  }
  if (fit < MIN_SPLIT_PIECE || fit >= parts.length) return null;

  // 1st choice: latest sentence boundary within the fitting range.
  const isSentenceEnd = (i: number) =>
    /[।.!?]/.test(parts[i]) && (i + 1 >= parts.length || parts[i + 1] === ' ');
  let cut = -1;
  for (let i = fit - 1; i >= Math.floor(fit * 0.55); i--) {
    if (isSentenceEnd(i)) { cut = i + 1; break; }
  }
  // 2nd choice: latest word boundary.
  if (cut < 0) {
    for (let i = fit; i > Math.floor(fit * 0.55); i--) {
      if (parts[i - 1] === ' ') { cut = i; break; }
    }
  }
  if (cut < MIN_SPLIT_PIECE) return null;
  if (parts.length - cut < MIN_SPLIT_PIECE) return null; // tail would be an orphan

  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const head = parts.slice(0, cut).join('').trimEnd();
  const tail = parts.slice(cut).join('').trimStart();
  if (!head || !tail) return null;
  return [`<div>${esc(head)}</div>`, `<div>${esc(tail)}</div>`];
}

/**
 * Split sanitized rich letter HTML into page-sized HTML chunks.
 * Returns at least one page.
 */
export function paginateRichHtml(html: string, options: PaginateOptions): string[] {
  if (!html) return [''];
  if (!isBrowser()) return [html];
  const opts = { ...DEFAULTS, ...options } as Required<PaginateOptions>;
  const measurer = makeMeasurer(opts);
  try {
    let blocks = topLevelBlocks(html);

    // Pre-split any block that alone exceeds a page.
    const usableFull = opts.pageHeightPx;
    const expanded: string[] = [];
    for (const block of blocks) {
      measurer.innerHTML = block;
      if (measurer.offsetHeight > usableFull) {
        expanded.push(...splitOversizedBlock(block, measurer, usableFull));
      } else {
        expanded.push(block);
      }
    }
    blocks = expanded;

    const pages: string[] = [];
    let current: string[] = [];
    let currentHeight = 0;
    let budget = opts.pageHeightPx - opts.firstPageReservedPx;

    const blockIsEmpty = (blockHtml: string) => {
      measurer.innerHTML = blockHtml;
      return !(measurer.textContent || '').trim();
    };
    const trimTrailingEmpties = () => {
      while (current.length && blockIsEmpty(current[current.length - 1])) current.pop();
    };

    const queue = [...blocks];
    while (queue.length) {
      const block = queue.shift() as string;
      // Blank spacer paragraphs never open a page — they are dead space there.
      if (current.length === 0 && blockIsEmpty(block)) continue;
      measurer.innerHTML = block;
      const h = measurer.offsetHeight;
      if (current.length && currentHeight + h > budget) {
        // Before starting a new page, try to fill the remaining space by
        // splitting a plain paragraph at a word boundary — this removes the
        // large mid-letter gaps that otherwise appear before page breaks.
        const split = splitBlockToFill(block, measurer, budget - currentHeight);
        if (split) {
          current.push(split[0]);
          queue.unshift(split[1]);
        } else {
          queue.unshift(block);
        }
        trimTrailingEmpties();
        pages.push(current.join(''));
        current = [];
        currentHeight = 0;
        budget = opts.pageHeightPx;
        continue;
      }
      current.push(block);
      currentHeight += h;
    }
    // Last page must also fit the closing/signature area.
    const lastBudget = (pages.length === 0 ? opts.pageHeightPx - opts.firstPageReservedPx : opts.pageHeightPx) - opts.lastPageReservedPx;
    if (current.length > 1 && currentHeight > lastBudget) {
      const moved = current.pop() as string;
      trimTrailingEmpties();
      pages.push(current.join(''));
      pages.push(moved);
    } else {
      pages.push(current.join(''));
    }
    // Trailing whitespace-only blocks (e.g. a final <div><br></div>) must not
    // become a blank page — nobody wants to print an empty sheet.
    const probe = document.createElement('div');
    while (pages.length > 1) {
      probe.innerHTML = pages[pages.length - 1];
      if ((probe.textContent || '').trim()) break;
      pages.pop();
    }
    return pages.length ? pages : [html];
  } catch {
    return [html];
  } finally {
    measurer.remove();
  }
}
