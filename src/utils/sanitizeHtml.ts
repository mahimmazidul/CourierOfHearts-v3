// Frontend HTML sanitizer for letter content. The server re-sanitizes
// everything on its side (server/sanitize.js) — this copy exists so pasted
// content is cleaned before it ever enters the editor, and so previews of
// unsent drafts render only trusted markup.
const ALLOWED_TAGS = new Set([
  'B', 'I', 'EM', 'STRONG', 'U', 'S', 'STRIKE', 'BR', 'DIV', 'P', 'SPAN', 'FONT',
  'OL', 'UL', 'LI',
]);
// Tags whose entire content must be discarded (never unwrapped).
const DROP_CONTENT_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'TEXTAREA', 'TITLE', 'SVG', 'MATH', 'HEAD']);
const ALLOWED_FONTS = [
  'EB Garamond',
  'Cormorant Garamond',
  'Crimson Pro',
  'MedievalSharp',
  'Uncial Antiqua',
  'Almendra',
  'Great Vibes',
  'Satisfy',
  'Dancing Script',
  'Marck Script',
  'Parisienne',
  'Noto Serif Bengali',
  'Hind Siliguri',
  'Galada',
  'Tiro Bangla',
  'Baloo Da 2',
  'serif',
  'cursive',
  'sans-serif',
];
const ALLOWED_ALIGN = new Set(['left', 'center', 'right', 'justify']);

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof DOMParser !== 'undefined';
}

function cleanFontFamily(value: string): string {
  const parts = value
    .split(',')
    .map((part) => part.replace(/["']/g, '').trim())
    .filter((part) => ALLOWED_FONTS.includes(part));
  return parts.length ? parts.map((part) => (part.includes(' ') ? `'${part}'` : part)).join(', ') : '';
}

function cleanNode(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent || '');
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const element = node as HTMLElement;
  if (DROP_CONTENT_TAGS.has(element.tagName)) return null;
  if (!ALLOWED_TAGS.has(element.tagName)) {
    const fragment = doc.createDocumentFragment();
    element.childNodes.forEach((child) => {
      const cleaned = cleanNode(child, doc);
      if (cleaned) fragment.appendChild(cleaned);
    });
    return fragment;
  }

  const safe = doc.createElement(element.tagName.toLowerCase());
  const styles: string[] = [];

  // Fold CSS-based formatting (typical of pasted Word/Docs/Gecko content)
  // into the semantic tags the letter format uses.
  const wrappers: string[] = [];
  const weight = element.style.fontWeight;
  if (weight === 'bold' || Number(weight) >= 600) wrappers.push('b');
  if (element.style.fontStyle === 'italic') wrappers.push('i');
  const deco = element.style.textDecorationLine || element.style.textDecoration || '';
  if (deco.includes('underline')) wrappers.push('u');
  if (deco.includes('line-through')) wrappers.push('s');

  const fontFamily = cleanFontFamily(element.style.fontFamily || element.getAttribute('face') || '');
  if (fontFamily) styles.push(`font-family: ${fontFamily}`);

  const align = (element.style.textAlign || element.getAttribute('align') || '').toLowerCase();
  if (ALLOWED_ALIGN.has(align)) styles.push(`text-align: ${align}`);

  if (styles.length) safe.setAttribute('style', `${styles.join('; ')};`);

  let inner: HTMLElement = safe;
  for (const tag of wrappers) {
    const wrap = doc.createElement(tag);
    inner.appendChild(wrap);
    inner = wrap;
  }

  element.childNodes.forEach((child) => {
    const cleaned = cleanNode(child, doc);
    if (cleaned) inner.appendChild(cleaned);
  });

  return safe;
}

export function sanitizeLetterHtml(html: string): string {
  if (!html) return '';
  if (!isBrowser()) return html;

  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const output = document.implementation.createHTMLDocument('safe-letter');
  const container = output.createElement('div');

  parsed.body.firstElementChild?.childNodes.forEach((child) => {
    const cleaned = cleanNode(child, output);
    if (cleaned) container.appendChild(cleaned);
  });

  return container.innerHTML;
}

export function hasRichLetterHtml(content: string): boolean {
  return /<\/?(?:span|font|div|p|br|b|i|em|strong|u|s|strike|ol|ul|li)\b/i.test(content);
}

export function htmlToPlainText(content: string): string {
  if (!content) return '';
  if (!isBrowser()) return content.replace(/<[^>]+>/g, ' ');
  const el = document.createElement('div');
  el.innerHTML = sanitizeLetterHtml(content);
  return el.textContent || '';
}

export function escapeLetterHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
