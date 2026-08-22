import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Letter } from '@/types/letter';
import { getLetter, unlockLetter, recoverLetter, recordLetterView } from '@/services/api';
import WaxSealIcon from '@/components/icons/WaxSealIcon';
import DustParticles from '@/components/effects/DustParticles';
import CandleGlow from '@/components/effects/CandleGlow';
import { HeartSigilIcon, OrnamentDivider, CornerOrnament } from '@/components/icons/SvgIcons';
import CrestDecoration from '@/components/letter/CrestDecoration';
import { FlowerLayer } from '@/components/letter/LetterPreview';
import { getFontFamilyByChoice, getSigFontFamilyByChoice } from '@/config/fonts';
import { sanitizeLetterHtml } from '@/utils/sanitizeHtml';
import { engraveEmojiHtml } from '@/utils/emojiEngrave';
import { paginateRichHtml } from '@/utils/paginate';
import RevealHtml, { reducedMotion } from '@/components/letter/RevealHtml';

type Step = 'loading' | 'error' | 'password' | 'arriving' | 'envelope' | 'cracking' | 'opening' | 'rising' | 'reading';

function ReadingView({ letter, onBack }: { letter: Letter; onBack: () => void }) {
  // Pages reveal in sequence: the ink reaches page 2 only after page 1 is
  // fully written. pagesDone == number of fully revealed pages.
  const [pagesDone, setPagesDone] = useState(0);
  const [inkSettled, setInkSettled] = useState(0);
  // The salutation must finish arriving BEFORE the body ink starts:
  // salutation -> body -> closing/signature, like a real letter is read.
  const [bodyStarted, setBodyStarted] = useState(false);
  // The viewport follows the writing ink until the reader takes over.
  const followRef = useRef(true);
  const fontFamily = getFontFamilyByChoice(letter.bodyFont);

  useEffect(() => {
    const delay = reducedMotion() ? 0 : 1100;
    const timer = setTimeout(() => setBodyStarted(true), delay);
    const stopFollowing = () => { followRef.current = false; };
    window.addEventListener('wheel', stopFollowing, { passive: true });
    window.addEventListener('touchmove', stopFollowing, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('wheel', stopFollowing);
      window.removeEventListener('touchmove', stopFollowing);
    };
  }, []);

  // A freshly turned-open page glides to the top of the view, so its ink
  // starts writing from the top of the sheet in front of the reader.
  useEffect(() => {
    if (pagesDone === 0 || !followRef.current) return;
    const article = document.querySelectorAll('article.print-letter')[pagesDone];
    article?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }, [pagesDone]);

  // Single content path: sanitize -> paginate -> engrave (see LetterPreview).
  const pages = useMemo(() => {
    const raw = paginateRichHtml(sanitizeLetterHtml(letter.content), { fontFamily });
    return raw.map((page) => engraveEmojiHtml(page));
  }, [letter.content, fontFamily]);
  const total = pages.length;
  const closing = letter.closing || 'Forever yours,';

  return (
    <div className="min-h-screen parchment-bg">
      <nav className="no-print flex items-center justify-between px-4 py-3 md:px-8 relative z-20"
        style={{ borderBottom: '1px solid rgba(139,115,64,0.12)' }}>
        <button onClick={onBack} className="font-heading text-[11px] tracking-[0.12em] text-ink/70 uppercase hover:text-ink transition-colors duration-500">&larr; Home</button>
        <span className="font-heading text-[10px] tracking-[0.2em] text-ink/40 uppercase hidden sm:inline">A letter for {letter.recipient}</span>
        <button onClick={() => window.print()} className="font-heading text-[10px] tracking-[0.12em] text-ink/70 uppercase hover:text-ink transition-colors duration-500">Print</button>
      </nav>

      <div className={`max-w-3xl mx-auto px-4 py-8 md:py-12 relative z-10 ${total === 1 ? 'coh-center-single' : ''}`}
        onClick={() => { if (pagesDone < total) setInkSettled((n) => n + 1); }}>
        {pages.map((pageContent, pi) => (
          // Later pages stay hidden until the ink reaches them — the reader
          // never knows how many pages are coming. They remain mounted, so a
          // mid-animation print still produces the complete letter.
          <article key={pi}
            className={`print-letter relative letter-paper rounded-sm mb-8 last:mb-0 ${pi <= pagesDone ? 'page-open' : 'page-unrevealed'}`}
            style={{ padding: 'clamp(32px, 6vw, 64px)', minHeight: total === 1 ? '340px' : '600px' }}>

            <div className="print-border hidden absolute inset-5 md:inset-7 pointer-events-none rounded-sm" />
            <div className="absolute top-0 left-0 pointer-events-none z-10"><CornerOrnament position="top-left" color="#8b7340" /></div>
            <div className="absolute top-0 right-0 pointer-events-none z-10"><CornerOrnament position="top-right" color="#8b7340" /></div>
            <div className="absolute bottom-0 left-0 pointer-events-none z-10"><CornerOrnament position="bottom-left" color="#8b7340" /></div>
            <div className="absolute bottom-0 right-0 pointer-events-none z-10"><CornerOrnament position="bottom-right" color="#8b7340" /></div>

            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-sm"
              style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent 1.85em, rgba(100,80,40,0.04) 1.85em, rgba(100,80,40,0.04) 1.86em)`, backgroundSize: '100% 1.9em', backgroundPosition: '0 48px' }} />

            {pi === 0 && (
              <div className="relative z-10">
                {letter.customInitials && <div className="text-center mb-2 ink-fade-in"><span className="font-uncial text-5xl md:text-6xl text-burgundy/30 select-none">{[...letter.customInitials][0]}</span></div>}
                {letter.crest !== 'none' && <div className="flex justify-center mb-3 ink-fade-in"><CrestDecoration type={letter.crest} /></div>}
                <div className="ink-fade-in"><OrnamentDivider className="w-28 md:w-36 mx-auto mb-5" color="#8b7340" /></div>
                {letter.salutationEnabled !== false && letter.recipient && (
                  <p className="font-display text-lg md:text-xl italic mb-5 ink-fade-in relative z-10 ink-engraved"
                    style={{ fontFamily: getFontFamilyByChoice(letter.salutationFont || 'cormorant') }}>{letter.salutation} {letter.recipient},</p>
                )}
              </div>
            )}

            <div className="print-safe-body text-[17px] md:text-[18px] leading-[1.95] relative z-10">
              <RevealHtml
                html={pageContent}
                fontFamily={fontFamily}
                active={bodyStarted && pi === pagesDone}
                completeNow={inkSettled}
                startDelay={pi === 0 || reducedMotion() ? 0 : 1000 /* let the page finish turning */}
                followRef={followRef}
                onDone={() => setPagesDone((done) => Math.max(done, pi + 1))}
              />
            </div>

            {pi === total - 1 && pagesDone >= total && (
              <div className="relative z-10 ink-fade-in mt-8">
                <div className="text-right space-y-1">
                  <p className="font-display text-base italic ink-engraved">{closing}</p>
                  <p className="text-2xl md:text-3xl ink-engraved" style={{ fontFamily: getSigFontFamilyByChoice(letter.signatureFont) }}>{letter.signature}</p>
                </div>
                <div className="flex justify-center mt-6"><WaxSealIcon sealType={letter.sealType} sealColor={letter.sealColor} customInitials={letter.customInitials} size={60} /></div>
              </div>
            )}

            {total > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
                <span className="font-heading text-[9px] tracking-[0.2em] text-ink/30 uppercase">
                  {pagesDone >= total ? `${pi + 1} of ${total}` : `${pi + 1}`}
                </span>
              </div>
            )}

            <FlowerLayer flowers={letter.flowers || []} opacity={0.28} />
          </article>
        ))}
        {pagesDone < total && (
          <p className="no-print fixed bottom-4 left-1/2 -translate-x-1/2 font-body text-[12px] italic text-ink/40 select-none pointer-events-none">
            tap the page to let the ink settle
          </p>
        )}
      </div>
    </div>
  );
}

export default function DeliveryPage({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [step, setStep] = useState<Step>('loading');
  const [letter, setLetter] = useState<Letter | null>(null);
  const [error, setError] = useState('');
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
  const viewRecorded = useRef(false);
  const ceremonyStarted = useRef(false);

  useEffect(() => {
    // The component instance is reused when navigating between letters
    // (hash change, same route shape) — per-letter guards must reset.
    ceremonyStarted.current = false;
    viewRecorded.current = false;
    setLetter(null);
    setPw('');
    setPwErr('');
    setShowRecovery(false);
    setRecoveryInput('');
    setStep('loading');
    (async () => {
      const result = await getLetter(slug);
      if (result.success && result.data) {
        setLetter(result.data);
        if (result.data.requiresPassword) setStep('password');
        else {
          setStep('arriving');
          // "A letter has arrived / for ..." deserves to linger a moment.
          setTimeout(() => setStep('envelope'), reducedMotion() ? 300 : 4200);
        }
      } else {
        setError(result.error || 'Letter not found');
        setStep('error');
      }
    })();
  }, [slug]);

  const beginCeremony = useCallback((unlocked: Letter) => {
    setLetter(unlocked);
    setPwErr('');
    setStep('arriving');
    setTimeout(() => setStep('envelope'), reducedMotion() ? 300 : 4200);
  }, []);

  const handleUnlock = useCallback(async () => {
    if (!pw.trim()) { setPwErr('Enter the passphrase.'); return; }
    const result = await unlockLetter(slug, pw);
    if (result.success && result.data) beginCeremony(result.data);
    else if (result.code === 'RATE_LIMITED') setPwErr('Too many tries. Rest a moment, then try again.');
    else setPwErr('Incorrect passphrase.');
  }, [slug, pw, beginCeremony]);

  const handleRecover = useCallback(async () => {
    if (!recoveryInput.trim()) { setPwErr('Enter the recovery token.'); return; }
    const result = await recoverLetter(slug, recoveryInput);
    if (result.success && result.data) beginCeremony(result.data);
    else setPwErr('Recovery failed.');
  }, [slug, recoveryInput, beginCeremony]);

  // Ceremony: click seal → crack → flap opens → letter rises → reading
  const handleSeal = useCallback(() => {
    if (ceremonyStarted.current) return; // rapid taps must not stack timelines
    ceremonyStarted.current = true;
    if (!viewRecorded.current) {
      viewRecorded.current = true;
      void recordLetterView(slug);
    }
    if (reducedMotion()) { setStep('reading'); return; }
    setStep('cracking');
    setTimeout(() => setStep('opening'), 1250);   // shards have fallen
    setTimeout(() => setStep('rising'), 2450);    // envelope bows out
    setTimeout(() => setStep('reading'), 3250);   // pages open like a book
  }, [slug]);

  if (step === 'loading') return <div className="min-h-screen desk-bg flex items-center justify-center"><div className="animate-float"><HeartSigilIcon size={32} color="#8b7340" /></div></div>;

  if (step === 'error') return (
    <div className="min-h-screen parchment-bg flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <HeartSigilIcon size={40} color="#6B1025" className="mx-auto mb-6 opacity-40" />
        <h1 className="font-display text-2xl text-ink/90 mb-3">{error}</h1>
        <p className="font-body text-[15px] text-ink/55 mb-8">This letter may have been lost to time.</p>
        <button onClick={onBack} className="font-heading text-[11px] tracking-[0.15em] uppercase py-3 px-8 bg-ink text-parchment-light rounded-sm hover:bg-ink-light transition-all duration-500">Return Home</button>
      </div>
    </div>
  );

  if (step === 'password') return (
    <div className="min-h-screen desk-bg flex items-center justify-center px-6"><DustParticles /><CandleGlow />
      <div className="relative z-20 letter-paper rounded-sm p-10 md:p-14 max-w-md w-full text-center">
        <WaxSealIcon sealType={letter?.sealType || 'heart'} sealColor={letter?.sealColor || 'burgundy'} size={70} className="mx-auto mb-6" />
        {!showRecovery ? (
          <>
            <h2 className="font-display text-xl text-ink/90 mb-2">This letter is sealed</h2>
            <p className="font-body text-[15px] text-ink/60 mb-6">A passphrase is required.</p>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleUnlock()} placeholder="Enter the passphrase..." className="parchment-input w-full text-center font-body text-base py-3 mb-4" autoFocus autoComplete="current-password" aria-label="Letter passphrase" />
            {pwErr && <p className="font-body text-[14px] text-burgundy mb-4 italic">{pwErr}</p>}
            <button onClick={handleUnlock} className="font-heading text-[11px] tracking-[0.18em] uppercase py-3 px-8 bg-ink text-parchment-light rounded-sm hover:bg-ink-light transition-all duration-500">Break the Seal</button>
            {/* Deliberately quiet: administrative recovery, not a user feature. */}
            <button onClick={() => { setShowRecovery(true); setPwErr(''); }} className="block mx-auto mt-6 font-body text-[11px] text-ink/30 hover:text-ink/50 italic transition-colors duration-500">keeper's key</button>
          </>
        ) : (
          <>
            <h2 className="font-display text-xl text-ink/90 mb-2">Keeper's key</h2>
            <p className="font-body text-[14px] text-ink/55 mb-6">Enter the per-letter recovery token (COH-RCV-…).</p>
            <input type="text" value={recoveryInput} onChange={e => setRecoveryInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRecover()} placeholder="COH-RCV-..." className="parchment-input w-full text-center font-body text-sm py-3 mb-4" autoComplete="off" spellCheck={false} aria-label="Recovery token" />
            {pwErr && <p className="font-body text-[14px] text-burgundy mb-4 italic">{pwErr}</p>}
            <button onClick={handleRecover} className="font-heading text-[11px] tracking-[0.18em] uppercase py-3 px-8 bg-ink text-parchment-light rounded-sm hover:bg-ink-light transition-all duration-500">Unlock</button>
            <button onClick={() => { setShowRecovery(false); setPwErr(''); }} className="block mx-auto mt-6 font-body text-[11px] text-ink/30 hover:text-ink/50 italic transition-colors duration-500">back to passphrase</button>
          </>
        )}
      </div>
    </div>
  );

  if (step === 'arriving') return (
    <div className="min-h-screen desk-bg flex items-center justify-center px-6"><DustParticles /><CandleGlow />
      <div className="relative z-20 text-center">
        <div className="ink-fade-in mb-4"><p className="font-display text-base md:text-lg italic" style={{ color: 'rgba(180,160,110,0.6)' }}>A letter has arrived</p></div>
        <div className="ink-fade-in-delayed"><p className="font-display text-3xl md:text-4xl" style={{ color: 'rgba(220,210,180,0.8)' }}>for {letter?.recipient}</p></div>
      </div>
    </div>
  );

  if (step === 'reading' && letter) return <ReadingView letter={letter} onBack={onBack} />;

  // ==================== THE CEREMONY ====================
  const isOpen = step === 'opening' || step === 'rising';
  const isRising = step === 'rising';

  return (
    <div className="min-h-screen desk-bg flex items-center justify-center px-6 overflow-hidden">
      <DustParticles /><CandleGlow />
      <div className="relative z-20 flex flex-col items-center ink-fade-in">

        <div className={`relative ${isRising ? 'envelope-shrink' : ''}`}
          style={{ width: '290px', height: '200px', perspective: '800px' }}>

          {/* Envelope back */}
          <div className="absolute inset-0 rounded-[3px] overflow-hidden"
            style={{ background: 'linear-gradient(170deg, #c4ad78 0%, #ccba85 30%, #c0aa72 60%, #b8a068 100%)', boxShadow: '0 2px 15px rgba(0,0,0,0.35)' }}>
            <div className="absolute inset-0" style={{ backgroundImage: `
              radial-gradient(ellipse 60px 40px at 15% 70%, rgba(90,65,25,0.12) 0%, transparent 70%),
              radial-gradient(ellipse 40px 30px at 80% 25%, rgba(100,75,30,0.08) 0%, transparent 60%),
              radial-gradient(ellipse 50px 35px at 55% 85%, rgba(75,55,18,0.07) 0%, transparent 55%)
            ` }} />
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[1px]" style={{ background: 'linear-gradient(to bottom, transparent 8%, rgba(0,0,0,0.05) 50%, transparent 92%)' }} />
            {(step === 'envelope' || step === 'cracking') && letter && (
              <div className="absolute inset-x-0 bottom-8 flex justify-center px-6 pointer-events-none">
                <p className="font-script text-xl select-none ink-engraved truncate max-w-full" style={{ opacity: 0.35 }}>{letter.recipient}</p>
              </div>
            )}
          </div>

          {/* Flap */}
          <div className={`absolute left-0 right-0 top-0 z-[5] ${isOpen ? 'envelope-flap-lift' : ''}`}
            style={{ transformOrigin: 'top center', height: '100px' }}>
            <div style={{
              width: 0, height: 0,
              borderLeft: '145px solid transparent', borderRight: '145px solid transparent',
              borderTop: '100px solid #b09858',
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.06))',
            }} />
          </div>

        </div>

        {step === 'envelope' && (
          <div className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
            <div className="gentle-pulse cursor-pointer" style={{ filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.4))' }}>
              <WaxSealIcon sealType={letter?.sealType || 'heart'} sealColor={letter?.sealColor || 'burgundy'} customInitials={letter?.customInitials} size={76} animated onClick={handleSeal} />
            </div>
            <p className="font-heading text-[11px] tracking-[0.2em] uppercase text-center mt-4 select-none" style={{ color: 'rgba(220,210,180,0.55)' }}>Tap to break the seal</p>
          </div>
        )}

        {step === 'cracking' && (
          <div className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 seal-shatter pointer-events-none"
            style={{ width: 76, height: 76, filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.4))' }} aria-hidden="true">
            {/* Three clipped copies of the same seal = three wax shards. */}
            <div className="seal-shard seal-shard-left">
              <WaxSealIcon sealType={letter?.sealType || 'heart'} sealColor={letter?.sealColor || 'burgundy'} customInitials={letter?.customInitials} size={76} />
            </div>
            <div className="seal-shard seal-shard-right-top">
              <WaxSealIcon sealType={letter?.sealType || 'heart'} sealColor={letter?.sealColor || 'burgundy'} customInitials={letter?.customInitials} size={76} />
            </div>
            <div className="seal-shard seal-shard-right-bottom">
              <WaxSealIcon sealType={letter?.sealType || 'heart'} sealColor={letter?.sealColor || 'burgundy'} customInitials={letter?.customInitials} size={76} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
