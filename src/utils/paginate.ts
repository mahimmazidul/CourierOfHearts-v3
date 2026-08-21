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

const DEFAULTS = {
  widthPx: 640,
  pageHeightPx: 760,
  firstPageReservedPx: 130,
  lastPageReservedPx: 170,
};

export function splitPlainIntoPages(text: string, charsPerPage = 900): string[] {
  if (!text || text.length <= charsPerPage) return [text || ''];
  const pages: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= charsPerPage) { pages.push(remaining); break; }
    let bp = remaining.lastIndexOf('\n\n', charsPerPage);
    if (bp < charsPerPage * 0.4) bp = remaining.lastIndexOf('\n', charsPerPage);
    if (bp < charsPerPage * 0.4) bp = remaining.lastIndexOf('. ', charsPerPage);
    if (bp < charsPerPage * 0.25) bp = remaining.lastIndexOf(' ', charsPerPage);
    if (bp <= 0) bp = charsPerPage;
    pages.push(remaining.slice(0, bp + 1));
    remaining = remaining.slice(bp + 1).trimStart();
    if (!remaining) break;
  }
  return pages.length ? pages : [''];
}

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
    'font-size:18px', 'line-height:1.95',
    'letter-spacing:0.01em', 'word-spacing:0.04em',
    'white-space:pre-wrap', 'overflow-wrap:anywhere',
  ].join(';');
  document.body.appendChild(el);
  return el;
}

function splitOversizedBlock(blockHtml: string, measurer: HTMLDivElement, maxHeight: number): string[] {
  // Binary-search a character split point in the block's text content.
  const host = document.createElement('div');
  host.innerHTML = blockHtml;
  const text = host.textContent || '';
  if (text.length < 40) return [blockHtml]; // do not over-split tiny content

  const pieces: string[] = [];
  let rest = text;
  while (rest.length) {
    let low = 1;
    let high = rest.length;
    let fit = rest.length;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      measurer.textContent = rest.slice(0, mid);
      if (measurer.offsetHeight <= maxHeight) { fit = mid; low = mid + 1; } else { high = mid - 1; }
    }
    if (fit >= rest.length) { pieces.push(rest); break; }
    let cut = rest.lastIndexOf(' ', fit);
    if (cut < fit * 0.5) cut = fit;
    pieces.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  // NOTE: inline formatting inside an oversized single block is flattened for
  // the overflow pages; block-level structure (the common case) is preserved
  // by the block grouping path above.
  return pieces.map((piece) => `<div>${piece.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`);
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

    for (const block of blocks) {
      measurer.innerHTML = block;
      const h = measurer.offsetHeight;
      if (current.length && currentHeight + h > budget) {
        pages.push(current.join(''));
        current = [];
        currentHeight = 0;
        budget = opts.pageHeightPx;
      }
      current.push(block);
      currentHeight += h;
    }
    // Last page must also fit the closing/signature area.
    const lastBudget = (pages.length === 0 ? opts.pageHeightPx - opts.firstPageReservedPx : opts.pageHeightPx) - opts.lastPageReservedPx;
    if (current.length > 1 && currentHeight > lastBudget) {
      const moved = current.pop() as string;
      pages.push(current.join(''));
      pages.push(moved);
    } else {
      pages.push(current.join(''));
    }
    return pages.length ? pages : [html];
  } catch {
    return [html];
  } finally {
    measurer.remove();
  }
}
