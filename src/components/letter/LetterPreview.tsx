import { memo, useMemo, useState, useEffect } from 'react';
import type { SealType, SealColor, CrestType, FontChoice, SignatureFont, FlowerPlacement } from '@/types/letter';
import WaxSealIcon from '@/components/icons/WaxSealIcon';
import { OrnamentDivider, CornerOrnament } from '@/components/icons/SvgIcons';
import CrestDecoration from '@/components/letter/CrestDecoration';
import { Flower, getFlowerMeta } from '@/components/icons/FlowerSvgs';
import { getFontFamilyByChoice, getSigFontFamilyByChoice } from '@/config/fonts';
import { sanitizeLetterHtml } from '@/utils/sanitizeHtml';
import { engraveEmojiHtml } from '@/utils/emojiEngrave';
import { paginateRichHtml } from '@/utils/paginate';
import RevealHtml from '@/components/letter/RevealHtml';

interface LetterPreviewProps {
  salutation?: string;
  salutationEnabled?: boolean;
  recipient: string;
  content: string;
  closing?: string;
  signature: string;
  sealType: SealType;
  sealColor: SealColor;
  crest: CrestType;
  customInitials?: string;
  bodyFont?: FontChoice;
  signatureFont?: SignatureFont;
  flowers?: FlowerPlacement[];
  onBack: () => void;
  onSend?: () => void;
  sending?: boolean;
  readOnly?: boolean;
}

// Decoration layer: memoized so page re-renders never rebuild every flower.
export const FlowerLayer = memo(function FlowerLayer({ flowers, opacity }: { flowers: FlowerPlacement[]; opacity: number }) {
  return (
    <>
      {flowers.map((f) => {
        const meta = getFlowerMeta(f.flowerId);
        if (!meta) return null;
        return (
          <div key={f.id} className="absolute pointer-events-none z-[1]"
            style={{ left: `${f.x}%`, top: `${f.y}%`, transform: `rotate(${f.rotation}deg) translate(-50%,-50%)`, opacity, mixBlendMode: 'multiply' as const, contain: 'layout style' }}>
            <Flower flowerId={f.flowerId} size={f.size} color={meta.defaultColor} />
          </div>
        );
      })}
    </>
  );
});

export default function LetterPreview({
  salutation = 'My dearest', salutationEnabled = true, recipient, content, closing = 'Forever yours,',
  signature, sealType, sealColor, crest,
  customInitials, bodyFont = 'eb-garamond', signatureFont = 'great-vibes',
  flowers = [], onBack, onSend, sending, readOnly,
}: LetterPreviewProps) {
  const fontFamily = getFontFamilyByChoice(bodyFont);
  // The preview shows the same letter-by-letter arrival the recipient sees:
  // salutation first, then the body ink, then closing/signature.
  const [pagesDone, setPagesDone] = useState(0);
  const [inkSettled, setInkSettled] = useState(0);
  const [bodyStarted, setBodyStarted] = useState(false);

  useEffect(() => {
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => setBodyStarted(true), reduced ? 0 : 1100);
    return () => clearTimeout(timer);
  }, []);

  // Letter content is ALWAYS HTML (contentEditable entity-encodes text), so
  // there is exactly one path: sanitize -> paginate by measured height ->
  // engrave emoji. Re-escaping entity-encoded content would double-escape
  // (the old "&lt;" on parchment bug).
  const pages = useMemo(() => {
    const raw = paginateRichHtml(sanitizeLetterHtml(content), { fontFamily });
    return raw.map((page) => engraveEmojiHtml(page));
  }, [content, fontFamily]);
  const totalPages = pages.length;

  return (
    <div className="min-h-screen parchment-bg">
      <nav className="no-print flex items-center justify-between px-4 py-3 md:px-8 relative z-20"
        style={{ borderBottom: '1px solid rgba(139,115,64,0.12)' }}>
        <button onClick={onBack} className="font-heading text-[11px] tracking-[0.12em] text-ink/70 uppercase hover:text-ink transition-colors duration-500">
          {readOnly ? '\u2190 Home' : '\u2190 Continue Editing'}
        </button>
        <span className="font-heading text-[10px] tracking-[0.2em] text-ink/40 uppercase">{readOnly ? '' : 'Preview'}</span>
        <button onClick={() => window.print()} className="font-heading text-[10px] tracking-[0.12em] text-ink/70 uppercase hover:text-ink transition-colors duration-500">Print</button>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 relative z-10"
        onClick={() => { if (pagesDone < totalPages) setInkSettled((n) => n + 1); }}>
        {pages.map((pageContent, pi) => (
          <article key={pi} className="print-letter relative letter-paper rounded-sm mb-8 last:mb-0"
            style={{ padding: 'clamp(32px, 6vw, 64px)', minHeight: '600px' }}>

            {/* Decorative frame: shown on every printed page */}
            <div className="print-border hidden absolute inset-5 md:inset-7 pointer-events-none rounded-sm" />
            <div className="absolute top-0 left-0 pointer-events-none z-10"><CornerOrnament position="top-left" color="#8b7340" /></div>
            <div className="absolute top-0 right-0 pointer-events-none z-10"><CornerOrnament position="top-right" color="#8b7340" /></div>
            <div className="absolute bottom-0 left-0 pointer-events-none z-10"><CornerOrnament position="bottom-left" color="#8b7340" /></div>
            <div className="absolute bottom-0 right-0 pointer-events-none z-10"><CornerOrnament position="bottom-right" color="#8b7340" /></div>

            {/* Faint ruled lines */}
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-sm no-print-bg"
              style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent 1.85em, rgba(100,80,40,0.04) 1.85em, rgba(100,80,40,0.04) 1.86em)`, backgroundSize: '100% 1.9em', backgroundPosition: '0 48px' }} />

            {/* Page 1 header */}
            {pi === 0 && (
              <div className="relative z-10">
                {customInitials && <div className="text-center mb-2 ink-fade-in"><span className="font-uncial text-5xl md:text-6xl text-burgundy/30 select-none">{[...customInitials][0]}</span></div>}
                {crest !== 'none' && <div className="flex justify-center mb-3 ink-fade-in"><CrestDecoration type={crest} /></div>}
                <div className="ink-fade-in"><OrnamentDivider className="w-28 md:w-36 mx-auto mb-5" color="#8b7340" /></div>
                {salutationEnabled && recipient && <p className="font-display text-lg md:text-xl italic mb-5 ink-fade-in relative z-10 ink-engraved">{salutation} {recipient},</p>}
              </div>
            )}

            {/* Body — deep engraved, revealed letter by letter */}
            <div className="print-safe-body text-[17px] md:text-[18px] leading-[1.95] relative z-10">
              <RevealHtml
                html={pageContent}
                fontFamily={fontFamily}
                active={bodyStarted && pi === pagesDone}
                completeNow={inkSettled}
                onDone={() => setPagesDone((done) => Math.max(done, pi + 1))}
              />
            </div>

            {/* Last page: closing + signature */}
            {pi === totalPages - 1 && pagesDone >= totalPages && (
              <div className="relative z-10 mt-8 ink-fade-in">
                <div className="text-right space-y-1">
                  <p className="font-display text-base italic ink-engraved">{closing}</p>
                  <p className="text-2xl md:text-3xl ink-engraved" style={{ fontFamily: getSigFontFamilyByChoice(signatureFont) }}>{signature}</p>
                </div>
                <div className="flex justify-center mt-6"><WaxSealIcon sealType={sealType} sealColor={sealColor} customInitials={customInitials} size={70} /></div>
              </div>
            )}

            {totalPages > 1 && <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10"><span className="font-heading text-[9px] tracking-[0.2em] text-ink/35 uppercase">{pi + 1} of {totalPages}</span></div>}

            <FlowerLayer flowers={flowers} opacity={0.3} />
          </article>
        ))}

        {!readOnly && onSend && (
          <div className="no-print flex flex-col items-center gap-3 mt-6">
            <button onClick={onSend} disabled={sending} className="font-heading text-[11px] tracking-[0.18em] uppercase py-4 px-14 bg-ink text-parchment-light rounded-sm transition-all duration-500 hover:bg-ink-light disabled:opacity-40" style={{ boxShadow: '0 3px 15px rgba(0,0,0,0.2)' }}>{sending ? 'Sealing...' : 'Seal & Send'}</button>
            <button onClick={onBack} className="font-heading text-[10px] uppercase py-2 px-6 text-ink/45 hover:text-ink/70 transition-colors duration-500">Continue editing</button>
          </div>
        )}
      </div>
    </div>
  );
}
