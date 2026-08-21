// Emoji engraving — supported emoji render as ink-style line engravings that
// match the parchment, instead of glossy platform emoji.
//
// Design constraints honoured here:
//  * No DOM mutation while typing: the editor keeps native emoji; the
//    transformation happens once, at render/serialization time, on the
//    sanitized HTML string (attributes in sanitized letter HTML can never
//    contain emoji, so a text-level pass is safe).
//  * No network request per emoji: all art ships as <symbol> defs mounted
//    once; instances are <use> references (shared, cached by the browser).
//  * All artwork below is original line art drawn for this project (same
//    stroke language as the flower SVGs) — no third-party emoji asset
//    libraries, therefore no external licenses involved.
//  * Grapheme-safe: longest-sequence-first matching with optional variation
//    selector (U+FE0F) handling; unsupported emoji fall back to plain text.

interface EngravedEmoji {
  id: string;
  label: string;
  /** Accent tint; ink-coloured when omitted. */
  color?: string;
}

// Keys are the emoji WITHOUT the variation selector; FE0F is stripped before
// lookup so both "❤" and "❤️" resolve to the same engraving.
const EMOJI: Record<string, EngravedEmoji> = {
  '\u2764': { id: 'heart', label: 'heart', color: '#6B1025' },          // ❤️
  '\u{1F90D}': { id: 'heart', label: 'white heart' },                    // 🤍 (ink outline)
  '\u{1F495}': { id: 'two-hearts', label: 'two hearts', color: '#6B1025' }, // 💕
  '\u{1F339}': { id: 'rose', label: 'rose', color: '#6B1025' },          // 🌹
  '\u2728': { id: 'sparkles', label: 'sparkles', color: '#8b7340' },     // ✨
  '\u{1F97A}': { id: 'pleading', label: 'pleading face' },               // 🥺
  '\u{1F54A}': { id: 'dove', label: 'dove' },                            // 🕊️
  '\u{1F319}': { id: 'moon', label: 'crescent moon', color: '#8b7340' }, // 🌙
  '\u{1F48C}': { id: 'love-letter', label: 'love letter', color: '#6B1025' }, // 💌
  '\u2B50': { id: 'star', label: 'star', color: '#8b7340' },             // ⭐
  '\u{1F338}': { id: 'blossom', label: 'cherry blossom', color: '#9a5060' }, // 🌸
  '\u{1F4AB}': { id: 'dizzy', label: 'shooting star', color: '#8b7340' }, // 💫
  '\u{1F56F}': { id: 'candle', label: 'candle', color: '#8b7340' },      // 🕯️
};

const VS = '\uFE0F';

// Longest sequences first so multi-codepoint emoji win over prefixes.
const PATTERN = new RegExp(
  Object.keys(EMOJI)
    .flatMap((e) => [e + VS, e])
    .sort((a, b) => b.length - a.length)
    .map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'gu'
);

function escapeAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function engravingMarkup(emoji: string): string {
  const meta = EMOJI[emoji.replace(VS, '')];
  if (!meta) return emoji;
  const tint = meta.color ? ` style="color:${meta.color}"` : '';
  return `<svg class="coh-emoji" role="img" aria-label="${escapeAttr(meta.label)}" viewBox="0 0 24 24"${tint}><use href="#coh-e-${meta.id}"></use></svg>`;
}

/**
 * Replace supported emoji in sanitized letter HTML with engraved SVGs.
 * MUST be called on already-sanitized HTML only.
 */
export function engraveEmojiHtml(sanitizedHtml: string): string {
  if (!sanitizedHtml) return sanitizedHtml;
  return sanitizedHtml.replace(PATTERN, (match) => engravingMarkup(match));
}

/** Same transformation for plain-text strings (returns HTML). */
export function engraveEmojiText(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(PATTERN, (match) => engravingMarkup(match));
}

export function hasEngravableEmoji(text: string): boolean {
  PATTERN.lastIndex = 0;
  return PATTERN.test(text);
}

/** Mount once at App root. Shared engraving symbols; ~1KB of paths total. */
export function EmojiDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <symbol id="coh-e-heart" viewBox="0 0 24 24" fill="none">
          <path d="M12 20 C8 16.5 3.5 13 3.5 8.5 C3.5 5.6 5.6 4 7.8 4 C9.6 4 11.2 5.2 12 6.8 C12.8 5.2 14.4 4 16.2 4 C18.4 4 20.5 5.6 20.5 8.5 C20.5 13 16 16.5 12 20 Z" stroke="currentColor" strokeWidth="1.1" fill="currentColor" fillOpacity="0.12" />
          <path d="M7 7.2 Q6 8 6.2 9.6" stroke="currentColor" strokeWidth="0.6" opacity="0.5" />
        </symbol>
        <symbol id="coh-e-two-hearts" viewBox="0 0 24 24" fill="none">
          <path d="M9 15.5 C6.4 13.3 3.5 11 3.5 8.1 C3.5 6.2 4.9 5.1 6.3 5.1 C7.5 5.1 8.5 5.9 9 6.9 C9.5 5.9 10.5 5.1 11.7 5.1 C13.1 5.1 14.5 6.2 14.5 8.1 C14.5 11 11.6 13.3 9 15.5 Z" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.1" />
          <path d="M16.2 20 C14.4 18.4 12.4 16.8 12.4 14.8 C12.4 13.4 13.4 12.6 14.4 12.6 C15.2 12.6 15.9 13.2 16.2 13.9 C16.5 13.2 17.2 12.6 18 12.6 C19 12.6 20 13.4 20 14.8 C20 16.8 18 18.4 16.2 20 Z" stroke="currentColor" strokeWidth="0.9" fill="currentColor" fillOpacity="0.14" />
        </symbol>
        <symbol id="coh-e-rose" viewBox="0 0 24 24" fill="none">
          <path d="M12 3.5 C10 2.5 8 3.5 8 5.8 C8 8 10 9.5 12 9.5 C14 9.5 16 8 16 5.8 C16 3.5 14 2.5 12 3.5 Z" stroke="currentColor" strokeWidth="0.9" fill="currentColor" fillOpacity="0.1" />
          <path d="M10.4 5 Q12 4 13.6 5 M10.8 6.8 Q12 7.6 13.2 6.8" stroke="currentColor" strokeWidth="0.7" opacity="0.7" />
          <path d="M12 9.5 L12 20" stroke="currentColor" strokeWidth="0.9" opacity="0.6" />
          <path d="M12 13 Q9.5 11.5 8 12.5 Q9.5 14.5 12 14 M12 16.5 Q14.5 15 16 16 Q14.5 18 12 17.5" stroke="currentColor" strokeWidth="0.7" fill="currentColor" fillOpacity="0.06" opacity="0.7" />
        </symbol>
        <symbol id="coh-e-sparkles" viewBox="0 0 24 24" fill="none">
          <path d="M9 3 L10.2 7.8 L15 9 L10.2 10.2 L9 15 L7.8 10.2 L3 9 L7.8 7.8 Z" stroke="currentColor" strokeWidth="0.9" fill="currentColor" fillOpacity="0.1" />
          <path d="M17.5 12 L18.2 14.8 L21 15.5 L18.2 16.2 L17.5 19 L16.8 16.2 L14 15.5 L16.8 14.8 Z" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.08" />
          <path d="M13 18.5 L13.4 20.1 L15 20.5 L13.4 20.9 L13 22.5 L12.6 20.9 L11 20.5 L12.6 20.1 Z" stroke="currentColor" strokeWidth="0.7" fill="currentColor" fillOpacity="0.08" />
        </symbol>
        <symbol id="coh-e-pleading" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.05" />
          <circle cx="9" cy="11.5" r="2.2" stroke="currentColor" strokeWidth="0.9" fill="currentColor" fillOpacity="0.14" />
          <circle cx="15" cy="11.5" r="2.2" stroke="currentColor" strokeWidth="0.9" fill="currentColor" fillOpacity="0.14" />
          <circle cx="8.4" cy="10.8" r="0.7" fill="#f5eeda" stroke="none" />
          <circle cx="14.4" cy="10.8" r="0.7" fill="#f5eeda" stroke="none" />
          <path d="M6.6 8.2 Q8.4 7.2 10 8 M14 8 Q15.6 7.2 17.4 8.2" stroke="currentColor" strokeWidth="0.8" opacity="0.7" />
          <path d="M10.6 16.4 Q12 17.2 13.4 16.4" stroke="currentColor" strokeWidth="0.9" opacity="0.8" />
        </symbol>
        <symbol id="coh-e-dove" viewBox="0 0 24 24" fill="none">
          <path d="M4 13 Q7 11 9.5 11.5 Q8.5 8 11 6 Q11.5 8.5 13 9.8 Q16 8.5 20 9.5 Q17.5 11 16.5 13 Q15 16.5 10.5 16.5 Q7 16.5 4 13 Z" stroke="currentColor" strokeWidth="0.9" fill="currentColor" fillOpacity="0.08" />
          <path d="M10.5 16.5 L9 19.5 M12 16.3 L11.5 19" stroke="currentColor" strokeWidth="0.7" opacity="0.6" />
          <circle cx="18" cy="10.2" r="0.5" fill="currentColor" />
          <path d="M20 9.5 L22 9.2 L20.4 10.4 Z" stroke="currentColor" strokeWidth="0.6" fill="currentColor" fillOpacity="0.2" />
        </symbol>
        <symbol id="coh-e-moon" viewBox="0 0 24 24" fill="none">
          <path d="M15.5 3.5 C11 4.5 8 8 8 12 C8 16 11 19.5 15.5 20.5 C10 22 4.5 18 4.5 12 C4.5 6 10 2 15.5 3.5 Z" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.1" />
          <path d="M17.5 8 L18 9.6 L19.6 10.1 L18 10.6 L17.5 12.2 L17 10.6 L15.4 10.1 L17 9.6 Z" stroke="currentColor" strokeWidth="0.6" fill="currentColor" fillOpacity="0.12" />
        </symbol>
        <symbol id="coh-e-love-letter" viewBox="0 0 24 24" fill="none">
          <rect x="3.5" y="6" width="17" height="12" rx="0.8" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.05" />
          <path d="M4 6.8 L12 13 L20 6.8" stroke="currentColor" strokeWidth="0.9" opacity="0.8" />
          <path d="M12 16.6 C10.9 15.7 9.6 14.7 9.6 13.5 C9.6 12.7 10.2 12.2 10.8 12.2 C11.3 12.2 11.8 12.5 12 13 C12.2 12.5 12.7 12.2 13.2 12.2 C13.8 12.2 14.4 12.7 14.4 13.5 C14.4 14.7 13.1 15.7 12 16.6 Z" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.16" />
        </symbol>
        <symbol id="coh-e-star" viewBox="0 0 24 24" fill="none">
          <path d="M12 3 L14.4 8.8 L20.5 9.3 L15.9 13.3 L17.4 19.4 L12 16 L6.6 19.4 L8.1 13.3 L3.5 9.3 L9.6 8.8 Z" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.1" />
        </symbol>
        <symbol id="coh-e-blossom" viewBox="0 0 24 24" fill="none">
          <ellipse cx="12" cy="6.2" rx="2.4" ry="3.6" stroke="currentColor" strokeWidth="0.7" fill="currentColor" fillOpacity="0.07" />
          <ellipse cx="17.5" cy="10.2" rx="2.4" ry="3.6" transform="rotate(72 17.5 10.2)" stroke="currentColor" strokeWidth="0.7" fill="currentColor" fillOpacity="0.07" />
          <ellipse cx="15.4" cy="16.7" rx="2.4" ry="3.6" transform="rotate(144 15.4 16.7)" stroke="currentColor" strokeWidth="0.7" fill="currentColor" fillOpacity="0.07" />
          <ellipse cx="8.6" cy="16.7" rx="2.4" ry="3.6" transform="rotate(216 8.6 16.7)" stroke="currentColor" strokeWidth="0.7" fill="currentColor" fillOpacity="0.07" />
          <ellipse cx="6.5" cy="10.2" rx="2.4" ry="3.6" transform="rotate(288 6.5 10.2)" stroke="currentColor" strokeWidth="0.7" fill="currentColor" fillOpacity="0.07" />
          <circle cx="12" cy="12" r="1.8" stroke="currentColor" strokeWidth="0.7" fill="currentColor" fillOpacity="0.14" />
        </symbol>
        <symbol id="coh-e-dizzy" viewBox="0 0 24 24" fill="none">
          <path d="M13 4 L14.6 8 L18.8 8.4 L15.6 11.2 L16.7 15.4 L13 13 L9.3 15.4 L10.4 11.2 L7.2 8.4 L11.4 8 Z" stroke="currentColor" strokeWidth="0.9" fill="currentColor" fillOpacity="0.1" />
          <path d="M8 16.5 Q5 18 5.5 20 Q6 21.5 8.5 21 Q11 20.4 12.5 18.2" stroke="currentColor" strokeWidth="0.8" opacity="0.6" />
        </symbol>
        <symbol id="coh-e-candle" viewBox="0 0 24 24" fill="none">
          <rect x="9.5" y="10" width="5" height="10.5" rx="0.6" stroke="currentColor" strokeWidth="0.9" fill="currentColor" fillOpacity="0.06" />
          <path d="M12 8.8 L12 7.2" stroke="currentColor" strokeWidth="0.7" />
          <path d="M12 2.8 Q13.8 4.8 12.9 6.3 Q12.4 7.1 12 7.2 Q11.6 7.1 11.1 6.3 Q10.2 4.8 12 2.8 Z" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.15" />
          <path d="M9.5 12 Q10.4 12.8 9.5 14" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        </symbol>
      </defs>
    </svg>
  );
}
