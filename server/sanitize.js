// Server-side HTML sanitizer for letter content. The frontend also sanitizes,
// but the server is the trust boundary: only whitelisted tags survive, only a
// vetted style subset survives, everything else is escaped or dropped.
const ALLOWED_TAGS = new Set([
  'p', 'div', 'br', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'strike',
  'ol', 'ul', 'li', 'font',
]);
const VOID_TAGS = new Set(['br']);
// Tags whose inner content must be dropped entirely, not just unwrapped.
const DROP_CONTENT_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'textarea', 'title', 'svg', 'math']);

const ALLOWED_FONTS = new Set([
  'EB Garamond', 'Cormorant Garamond', 'Crimson Pro', 'MedievalSharp',
  'Uncial Antiqua', 'Almendra', 'Great Vibes', 'Satisfy', 'Dancing Script',
  'Marck Script', 'Parisienne', 'Noto Serif Bengali', 'Hind Siliguri',
  'serif', 'cursive', 'sans-serif',
]);
const ALLOWED_ALIGN = new Set(['left', 'center', 'right', 'justify']);

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cleanFontFamily(value) {
  const parts = String(value)
    .split(',')
    .map((part) => part.replace(/["']/g, '').trim())
    .filter((part) => ALLOWED_FONTS.has(part));
  if (!parts.length) return '';
  return parts.map((part) => (part.includes(' ') ? `'${part}'` : part)).join(', ');
}

function safeStyleFromAttrs(rawAttrs) {
  const styles = [];
  const styleMatch = /style\s*=\s*("([^"]*)"|'([^']*)')/i.exec(rawAttrs);
  const styleValue = styleMatch ? (styleMatch[2] ?? styleMatch[3] ?? '') : '';
  const faceMatch = /face\s*=\s*("([^"]*)"|'([^']*)')/i.exec(rawAttrs);

  let fontFamily = '';
  const ffMatch = /font-family\s*:\s*([^;]+)/i.exec(styleValue);
  if (ffMatch) fontFamily = cleanFontFamily(ffMatch[1]);
  if (!fontFamily && faceMatch) fontFamily = cleanFontFamily(faceMatch[2] ?? faceMatch[3] ?? '');
  if (fontFamily) styles.push(`font-family: ${fontFamily}`);

  const alignMatch = /text-align\s*:\s*([a-z]+)/i.exec(styleValue);
  if (alignMatch && ALLOWED_ALIGN.has(alignMatch[1].toLowerCase())) {
    styles.push(`text-align: ${alignMatch[1].toLowerCase()}`);
  }
  return styles.length ? ` style="${styles.join('; ')};"` : '';
}

const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

export function sanitizeLetterHtml(html) {
  const input = String(html || '');
  let out = '';
  const openStack = [];
  let index = 0;
  let dropUntil = null; // tag name whose content is being discarded

  TAG_RE.lastIndex = 0;
  let match;
  while ((match = TAG_RE.exec(input)) !== null) {
    const [raw, tagNameRaw, attrs] = match;
    const tagName = tagNameRaw.toLowerCase();
    const isClose = raw.startsWith('</');
    const text = input.slice(index, match.index);
    if (!dropUntil && text) out += escapeHtml(text);
    index = match.index + raw.length;

    if (dropUntil) {
      if (isClose && tagName === dropUntil) dropUntil = null;
      continue;
    }
    if (DROP_CONTENT_TAGS.has(tagName)) {
      if (!isClose && !raw.endsWith('/>')) dropUntil = tagName;
      continue;
    }
    if (!ALLOWED_TAGS.has(tagName)) continue; // unwrap: keep children, drop tag

    if (isClose) {
      const at = openStack.lastIndexOf(tagName);
      if (at !== -1) {
        // Close any tags nested more deeply (recover from malformed markup).
        while (openStack.length > at) out += `</${openStack.pop()}>`;
      }
      continue;
    }
    if (VOID_TAGS.has(tagName)) {
      out += `<${tagName}>`;
      continue;
    }
    out += `<${tagName}${safeStyleFromAttrs(attrs)}>`;
    openStack.push(tagName);
  }
  const tail = input.slice(index);
  if (!dropUntil && tail) out += escapeHtml(tail);
  while (openStack.length) out += `</${openStack.pop()}>`;
  return out;
}

export function htmlToPlainText(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
