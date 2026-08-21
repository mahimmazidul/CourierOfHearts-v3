import { useState, useEffect, useRef } from 'react';
import type { Letter } from '@/types/letter';
import { getLetter } from '@/services/api';
import WaxSealIcon from '@/components/icons/WaxSealIcon';
import { OrnamentDivider, RavenIcon } from '@/components/icons/SvgIcons';
import DustParticles from '@/components/effects/DustParticles';
import { isDemoMode } from '@/services/demoApi';

interface LetterSentPageProps {
  slug: string;
  onBack: () => void;
  onPreview: (slug: string) => void;
}

export default function LetterSentPage({ slug, onBack, onPreview }: LetterSentPageProps) {
  const [letter, setLetter] = useState<Letter | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const result = await getLetter(slug);
      if (result.success && result.data) {
        setLetter(result.data);
      }
    })();
  }, [slug]);

  // Production: clean path — the server can then serve per-letter share
  // metadata (fragments never reach servers/crawlers). Demo build keeps the
  // hash route since GitHub Pages has no backend.
  const basePath = window.location.pathname.replace(/index\.html$/, '');
  const shareUrl = isDemoMode
    ? `${window.location.origin}${basePath}#/letter/${slug}`
    : `${window.location.origin}/letter/${slug}`;

  const handleCopy = async () => {
    // Clipboard API first; several mobile browsers reject it, so fall back
    // to selecting the field and the legacy copy command.
    let ok = false;
    try {
      await navigator.clipboard.writeText(shareUrl);
      ok = true;
    } catch {
      const input = linkRef.current;
      if (input) {
        input.focus();
        input.select();
        input.setSelectionRange(0, shareUrl.length);
        try { ok = document.execCommand('copy'); } catch { ok = false; }
      }
    }
    setCopied(ok);
    setCopyFailed(!ok);
    if (!ok) linkRef.current?.select();
    setTimeout(() => { setCopied(false); setCopyFailed(false); }, 3500);
  };

  return (
    <div className="min-h-screen parchment-bg flex items-center justify-center px-6">
      <DustParticles />

      <div className="relative z-20 text-center max-w-lg w-full">
        <div className="mb-6 animate-float">
          <RavenIcon size={50} color="#1a1208" className="mx-auto opacity-40" />
        </div>

        <h1 className="font-display text-3xl md:text-4xl text-ink/90 mb-2 ink-fade-in">
          Your letter has been sealed
        </h1>
        <p className="font-body text-[16px] md:text-[17px] text-ink/60 mb-8 ink-fade-in-delayed leading-relaxed">
          A courier carries it now. Share the link with your beloved.
        </p>

        <OrnamentDivider className="w-36 mx-auto mb-8" color="#8b7340" />

        {letter && (
          <div className="mb-8 stamp-press">
            <WaxSealIcon sealType={letter.sealType} sealColor={letter.sealColor} size={90} className="mx-auto" />
          </div>
        )}

        <div className="real-paper paper-worn-edges rounded-sm p-5 mb-6">
          <label className="font-heading text-[11px] tracking-[0.2em] text-ink/40 uppercase block mb-2">Share this link</label>
          <div className="flex items-center gap-2">
            <input ref={linkRef} type="text" readOnly value={shareUrl}
              className="flex-1 parchment-input font-body text-sm text-ink/50 py-2 text-center px-3 rounded-sm"
              style={{ background: 'rgba(139,115,64,0.05)' }}
              onClick={(e) => (e.target as HTMLInputElement).select()} />
            <button onClick={handleCopy}
              className={`font-heading text-[9px] tracking-[0.15em] uppercase py-2 px-4 rounded-sm transition-all duration-500 ${copied ? 'bg-forest text-parchment-light' : 'bg-ink text-parchment-light hover:bg-ink-light'}`}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {copyFailed && (
            <p className="font-body text-[12px] text-ink/50 italic mt-2">
              The link is selected — press and hold, then choose Copy.
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
            <button onClick={() => onPreview(slug)}
            className="font-heading text-[11px] tracking-[0.12em] uppercase py-3 px-7 border border-gold/20 text-ink/45 rounded-sm hover:border-gold/35 hover:text-ink/65 transition-all duration-500">
            Preview Letter
          </button>
          <button onClick={onBack}
            className="font-heading text-[11px] tracking-[0.12em] uppercase py-3 px-7 border border-gold/20 text-ink/45 rounded-sm hover:border-gold/35 hover:text-ink/65 transition-all duration-500">
            Write Another
          </button>
        </div>

        <div className="mt-10">
          <p className="font-body text-[14px] text-ink/35 italic leading-relaxed">
            When they open this link, the wax will wait for their touch —<br />and the words will arrive the way letters used to: slowly, and just for them.
          </p>
        </div>
      </div>
    </div>
  );
}
