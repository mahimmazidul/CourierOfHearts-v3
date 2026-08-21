import { useState, useEffect, useCallback } from 'react';
import type { Letter } from '@/types/letter';
import { listLetters, deleteLetter } from '@/services/api';
import WaxSealIcon from '@/components/icons/WaxSealIcon';
import { HeartSigilIcon, OrnamentDivider, EnvelopeIcon } from '@/components/icons/SvgIcons';

interface MyLettersPageProps {
  onBack: () => void;
  onCompose: () => void;
  onPreview: (slug: string) => void;
}

export default function MyLettersPage({ onBack, onCompose, onPreview }: MyLettersPageProps) {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const result = await listLetters();
      if (result.success && result.data) {
        setLetters(result.data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
      setLoading(false);
    })();
  }, []);

  const handleDelete = useCallback(async (slug: string) => {
    const result = await deleteLetter(slug);
    if (result.success) {
      setLetters((prev) => prev.filter((l) => l.slug !== slug));
    }
  }, []);

  const handleCopyLink = useCallback((slug: string) => {
    const url = `${window.location.origin}${window.location.pathname}#/letter/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 2000);
    });
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="min-h-screen parchment-bg">
      <nav className="flex items-center justify-between px-4 py-3 md:px-8 md:py-4" style={{ borderBottom: '1px solid rgba(139,115,64,0.1)' }}>
        <button onClick={onBack} className="font-heading text-[11px] tracking-[0.12em] text-ink/50 uppercase hover:text-ink/80 transition-colors duration-500">
          &larr; Home
        </button>
        <div className="flex items-center gap-2">
          <HeartSigilIcon size={18} color="#6B1025" />
          <span className="font-heading text-[10px] tracking-[0.2em] text-ink/55 uppercase hidden md:inline">My Letters</span>
        </div>
        <button onClick={onCompose} className="font-heading text-[11px] tracking-[0.12em] text-ink/50 uppercase hover:text-ink/80 transition-colors duration-500">
          Write New
        </button>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8 md:py-14 relative z-10">
        <h1 className="font-display text-center text-2xl md:text-3xl text-ink/85 mb-2">Your Correspondence</h1>
        <OrnamentDivider className="w-36 mx-auto mb-8" color="#8b7340" />

        {loading ? (
          <div className="text-center py-16">
            <p className="font-body text-ink/30 italic">Loading your letters...</p>
          </div>
        ) : letters.length === 0 ? (
          <div className="text-center py-16">
            <EnvelopeIcon size={40} color="#8b7340" className="mx-auto mb-5 opacity-30" />
            <p className="font-display text-lg text-ink/35 mb-2">No letters yet</p>
            <p className="font-body text-sm text-ink/22 mb-8">Your correspondence awaits its first entry.</p>
            <button onClick={onCompose}
              className="font-heading text-[10px] tracking-[0.2em] uppercase py-3 px-8 bg-ink text-parchment-light rounded-sm hover:bg-ink-light transition-all duration-500">
              Compose Your First Letter
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {letters.map((letter) => (
              <div key={letter.id}
                className="real-paper rounded-sm p-4 md:p-5 flex items-center gap-3 md:gap-5 group transition-all duration-500"
                style={{ boxShadow: '1px 2px 8px rgba(0,0,0,0.1), 0 0 30px rgba(100,78,40,0.1) inset' }}>
                <div className="flex-shrink-0">
                  <WaxSealIcon sealType={letter.sealType} sealColor={letter.sealColor} size={42} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-base md:text-lg text-ink/85 truncate">To {letter.recipient}</h3>
                  <p className="font-body text-[12px] text-ink/45">{formatDate(letter.createdAt)}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => handleCopyLink(letter.slug)}
                    className="font-heading text-[8px] tracking-[0.15em] uppercase py-1.5 px-2.5 border border-gold/12 text-ink/30 rounded-sm hover:border-gold/25 hover:text-ink/50 transition-all duration-500">
                    {copiedSlug === letter.slug ? 'Copied!' : 'Copy Link'}
                  </button>
                  <button onClick={() => onPreview(letter.slug)}
                    className="font-heading text-[8px] tracking-[0.15em] uppercase py-1.5 px-2.5 border border-gold/12 text-ink/30 rounded-sm hover:border-gold/25 hover:text-ink/50 transition-all duration-500">
                    View
                  </button>
                  <button onClick={() => handleDelete(letter.slug)}
                    className="font-heading text-[8px] tracking-[0.15em] uppercase py-1.5 px-2.5 border border-burgundy/12 text-burgundy/30 rounded-sm hover:border-burgundy/30 hover:text-burgundy/55 transition-all duration-500">
                    Burn
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
