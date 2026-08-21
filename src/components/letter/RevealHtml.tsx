// Ink reveal ("letter by letter") for sanitized letter HTML.
//
// - DOM is built ONCE; each animation frame only appends characters to the
//   current text node — no re-parsing, no React re-render, O(1) per frame.
// - Reveals by GRAPHEME CLUSTER (Intl.Segmenter), so Bangla conjuncts
//   (ক্ষ, জ্ঞ, শ্রী), vowel signs, and multi-codepoint emoji appear atomically,
//   never as broken intermediate glyphs.
// - `active` allows sequential multi-page reveals: page N starts only after
//   page N-1 calls onDone.
// - Printing mid-reveal completes instantly (beforeprint), and
//   prefers-reduced-motion skips the animation entirely.
import { useEffect, useRef } from 'react';

export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function graphemes(text: string): string[] {
  try {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map((s) => s.segment);
  } catch {
    return [...text]; // code-point fallback for very old engines
  }
}

interface TextUnit { kind: 'text'; node: Text; parts: string[] }
interface SvgUnit { kind: 'svg'; el: SVGElement }
type Unit = TextUnit | SvgUnit;

interface RevealState {
  units: Unit[];
  finished: boolean;
  raf: number;
}

export default function RevealHtml({ html, fontFamily, active = true, onDone, completeNow = 0, startDelay = 0, followRef }: {
  html: string;
  fontFamily: string;
  active?: boolean;
  onDone: () => void;
  /** Increment to finish the reveal instantly (tap-to-settle-the-ink). */
  completeNow?: number;
  /** Wait this long after activation before the ink starts (page-turn time). */
  startDelay?: number;
  /** While .current is true, the viewport gently follows the writing ink. */
  followRef?: { current: boolean };
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const stateRef = useRef<RevealState | null>(null);

  // Build once per html: parse, collect units, empty the text.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = html;

    const units: Unit[] = [];
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let current: Node | null = walker.nextNode();
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) {
        const textNode = current as Text;
        if (textNode.textContent) {
          units.push({ kind: 'text', node: textNode, parts: graphemes(textNode.textContent) });
          textNode.textContent = '';
        }
      } else if ((current as Element).classList?.contains('coh-emoji')) {
        const el = current as SVGElement;
        el.style.visibility = 'hidden';
        units.push({ kind: 'svg', el });
      }
      current = walker.nextNode();
    }
    const state: RevealState = { units, finished: false, raf: 0 };
    stateRef.current = state;

    const completeForPrint = () => finishNow(state, doneRef);
    window.addEventListener('beforeprint', completeForPrint);
    return () => {
      window.removeEventListener('beforeprint', completeForPrint);
      cancelAnimationFrame(state.raf);
    };
  }, [html]);

  // Start (or instantly finish) when this page's turn arrives.
  useEffect(() => {
    const state = stateRef.current;
    if (!active || !state || state.finished) return;

    const totalChars = state.units.reduce((sum, unit) => sum + (unit.kind === 'text' ? unit.parts.length : 1), 0);
    if (reducedMotion() || totalChars === 0) {
      finishNow(state, doneRef);
      return;
    }

    // Pacing: short letters keep the slow, romantic v1 cadence (up to
    // 45ms/character ~ a few seconds); long pages accelerate so a full page
    // never takes more than ~6 seconds to arrive.
    const msPerChar = Math.max(3, Math.min(45, 6000 / Math.max(totalChars, 1)));
    let unitIndex = 0;
    let charIndex = 0;
    let last = 0;
    let lastFollow = 0;

    // Keep the writing point comfortably in view — like eyes following a pen.
    const followInk = (ts: number) => {
      if (!followRef?.current || ts - lastFollow < 320) return;
      lastFollow = ts;
      const unit = state.units[Math.min(unitIndex, state.units.length - 1)];
      const el = unit?.kind === 'text' ? unit.node.parentElement : unit?.el;
      const rect = el?.getBoundingClientRect?.();
      if (rect && rect.bottom > window.innerHeight * 0.72) {
        window.scrollBy({ top: rect.bottom - window.innerHeight * 0.55, behavior: 'smooth' });
      }
    };

    const tick = (ts: number) => {
      if (state.finished) return;
      if (!last) last = ts;
      let budget = Math.floor((ts - last) / msPerChar);
      if (budget > 0) last = ts;
      while (budget > 0 && unitIndex < state.units.length) {
        const unit = state.units[unitIndex];
        if (unit.kind === 'svg') {
          unit.el.style.visibility = '';
          unitIndex++;
          budget--;
          continue;
        }
        const take = Math.min(budget, unit.parts.length - charIndex);
        charIndex += take;
        budget -= take;
        unit.node.textContent = unit.parts.slice(0, charIndex).join('');
        if (charIndex >= unit.parts.length) {
          unitIndex++;
          charIndex = 0;
        }
      }
      followInk(ts);
      if (unitIndex < state.units.length) {
        state.raf = requestAnimationFrame(tick);
      } else {
        state.finished = true;
        doneRef.current();
      }
    };
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    if (startDelay > 0) {
      delayTimer = setTimeout(() => { state.raf = requestAnimationFrame(tick); }, startDelay);
    } else {
      state.raf = requestAnimationFrame(tick);
    }
    return () => {
      if (delayTimer) clearTimeout(delayTimer);
      cancelAnimationFrame(state.raf);
    };
  }, [active, html]);

  // Tap-to-complete: the parent increments completeNow when the reader taps
  // the page; every remaining page settles its ink instantly.
  useEffect(() => {
    const state = stateRef.current;
    if (!completeNow || !state || state.finished) return;
    finishNow(state, doneRef);
  }, [completeNow]);

  return (
    <div
      ref={hostRef}
      className="rich-letter-content ink-engraved whitespace-pre-wrap"
      style={{ fontFamily, letterSpacing: '0.01em', wordSpacing: '0.04em' }}
    />
  );
}

function finishNow(state: RevealState, doneRef: React.MutableRefObject<() => void>) {
  if (state.finished) return;
  state.finished = true;
  cancelAnimationFrame(state.raf);
  for (const unit of state.units) {
    if (unit.kind === 'text') unit.node.textContent = unit.parts.join('');
    else unit.el.style.visibility = '';
  }
  doneRef.current();
}
