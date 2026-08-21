import { useState, useCallback, useEffect, useRef, memo } from 'react';
import type { SealType, SealColor, CrestType, CreateLetterPayload, FontChoice, SignatureFont, FlowerPlacement } from '@/types/letter';
import { createLetter } from '@/services/api';
import WaxSealIcon from '@/components/icons/WaxSealIcon';
import { OrnamentDivider, QuillIcon, HeartSigilIcon } from '@/components/icons/SvgIcons';
import LetterPreview from '@/components/letter/LetterPreview';
import { ALL_FLOWERS, Flower } from '@/components/icons/FlowerSvgs';
import LetterEditor, { type LetterEditorHandle } from '@/components/editor/LetterEditor';
import { sanitizeLetterHtml, htmlToPlainText } from '@/utils/sanitizeHtml';
import { BODY_FONTS, SIG_FONTS, SALUTATIONS, CLOSINGS, getFontFamilyByChoice, getSigFontFamilyByChoice } from '@/config/fonts';
import { saveDraft, loadDraft, clearDraft, debounce, type LetterDraft } from '@/utils/draftStore';
import { nanoid } from 'nanoid';

interface ComposePageProps { onLetterCreated: (slug: string) => void; onBack: () => void; }

const SEAL_TYPES: { value: SealType; label: string }[] = [
  { value: 'rose', label: 'Rose' }, { value: 'heart', label: 'Heart' },
  { value: 'crown', label: 'Crown' }, { value: 'raven', label: 'Raven' },
  { value: 'initials', label: 'Initials' }, { value: 'monogram', label: 'Monogram' },
];
const SEAL_COLORS: { value: SealColor; label: string; hex: string }[] = [
  { value: 'burgundy', label: 'Burgundy', hex: '#6B1025' },
  { value: 'crimson', label: 'Crimson', hex: '#8A1538' },
  { value: 'emerald', label: 'Emerald', hex: '#264D3A' },
  { value: 'gold', label: 'Gold', hex: '#8b7340' },
  { value: 'black', label: 'Obsidian', hex: '#1a1208' },
];
const CREST_TYPES: { value: CrestType; label: string }[] = [
  { value: 'none', label: 'None' }, { value: 'royal', label: 'Royal' },
  { value: 'floral', label: 'Floral' }, { value: 'shield', label: 'Shield' },
  { value: 'wreath', label: 'Wreath' }, { value: 'wings', label: 'Wings' },
];

// Placed flower: memoized so dragging one never re-renders the others.
const PlacedFlower = memo(function PlacedFlower({ flower, selected, onPointerDown, onSelect, onRemove, registerNode }: {
  flower: FlowerPlacement;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  registerNode: (id: string, el: HTMLDivElement | null) => void;
}) {
  const meta = ALL_FLOWERS.find((f) => f.id === flower.flowerId);
  if (!meta) return null;
  return (
    <div
      ref={(el) => registerNode(flower.id, el)}
      className={`absolute z-20 cursor-grab active:cursor-grabbing group touch-none select-none ${selected ? 'coh-flower-selected' : ''}`}
      style={{
        left: `${flower.x}%`, top: `${flower.y}%`,
        transform: `rotate(${flower.rotation}deg) translate(-50%,-50%)`,
        contain: 'layout style',
      }}
      onPointerDown={(e) => onPointerDown(e, flower.id)}
      onClick={(e) => { e.stopPropagation(); onSelect(flower.id); }}
    >
      <div className={`transition-opacity duration-500 ${selected ? 'opacity-[0.8]' : 'opacity-[0.55] group-hover:opacity-[0.75]'}`}>
        <Flower flowerId={flower.flowerId} size={flower.size} color={meta.defaultColor} />
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(flower.id); }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={`Remove ${meta.name}`}
        className={`coh-flower-remove ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
      >&times;</button>
    </div>
  );
});

export default function ComposePage({ onLetterCreated, onBack }: ComposePageProps) {
  const [salutation, setSalutation] = useState('My dearest');
  const [salutationEnabled, setSalutationEnabled] = useState(true); // default: on
  const [recipient, setRecipient] = useState('');
  const [closing, setClosing] = useState('Forever yours,');
  const [signature, setSignature] = useState('');
  const [sealType, setSealType] = useState<SealType>('rose');
  const [sealColor, setSealColor] = useState<SealColor>('burgundy');
  const [crest, setCrest] = useState<CrestType>('none');
  const [customInitials, setCustomInitials] = useState('');
  const [bodyFont, setBodyFont] = useState<FontChoice>('eb-garamond');
  const [signatureFont, setSignatureFont] = useState<SignatureFont>('great-vibes');
  const [flowers, setFlowers] = useState<FlowerPlacement[]>([]);
  const [selectedFlower, setSelectedFlower] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'write' | 'seal' | 'decor' | 'style'>('write');
  const [restoredDraft, setRestoredDraft] = useState<LetterDraft | null>(null);
  const [draftReady, setDraftReady] = useState(false);

  const paperRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<LetterEditorHandle>(null);
  const contentRef = useRef(''); // live editor HTML without re-rendering per keystroke
  const [content, setContent] = useState('');
  const flowerNodes = useRef(new Map<string, HTMLDivElement>());
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; lastX: number; lastY: number; moved: boolean } | null>(null);
  const stateRef = useRef<Record<string, unknown>>({});

  // ---- Draft restore -------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    loadDraft().then((draft) => {
      if (cancelled) return;
      if (draft && (htmlToPlainText(draft.content).trim() || draft.recipient)) {
        setRestoredDraft(draft);
        setSalutation(draft.salutation);
        setSalutationEnabled(draft.salutationEnabled);
        setRecipient(draft.recipient);
        setClosing(draft.closing);
        setSignature(draft.signature);
        setSealType(draft.sealType as SealType);
        setSealColor(draft.sealColor as SealColor);
        setCrest(draft.crest as CrestType);
        setCustomInitials(draft.customInitials);
        setBodyFont(draft.bodyFont as FontChoice);
        setSignatureFont(draft.signatureFont as SignatureFont);
        setFlowers(draft.flowers as FlowerPlacement[]);
        contentRef.current = draft.content;
        setContent(draft.content);
      }
      setDraftReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // ---- Autosave (debounced, IndexedDB) --------------------------------------
  const persistDraft = useRef(debounce(() => {
    const s = stateRef.current;
    void saveDraft({
      salutation: s.salutation as string,
      salutationEnabled: s.salutationEnabled as boolean,
      recipient: s.recipient as string,
      content: contentRef.current,
      closing: s.closing as string,
      signature: s.signature as string,
      sealType: s.sealType as string,
      sealColor: s.sealColor as string,
      crest: s.crest as string,
      customInitials: s.customInitials as string,
      bodyFont: s.bodyFont as string,
      signatureFont: s.signatureFont as string,
      flowers: s.flowers as FlowerPlacement[],
    });
  }, 900)).current;

  useEffect(() => {
    stateRef.current = { salutation, salutationEnabled, recipient, closing, signature, sealType, sealColor, crest, customInitials, bodyFont, signatureFont, flowers };
    if (draftReady) persistDraft();
  }, [salutation, salutationEnabled, recipient, closing, signature, sealType, sealColor, crest, customInitials, bodyFont, signatureFont, flowers, draftReady, persistDraft]);

  const handleEditorChange = useCallback((html: string) => {
    contentRef.current = html;
    persistDraft();
  }, [persistDraft]);

  const syncContentFromEditor = useCallback(() => {
    const html = sanitizeLetterHtml(editorRef.current?.getHtml() || contentRef.current);
    contentRef.current = html;
    setContent(html);
    return html;
  }, []);

  const applyBodyFont = useCallback((font: FontChoice) => {
    // Like Word: with a selection (live, or remembered across the mobile tab
    // switch), restyle only the selected text. Otherwise set the base font.
    const appliedToSelection = editorRef.current?.applyFontFamily(getFontFamilyByChoice(font));
    if (!appliedToSelection) {
      setBodyFont(font);
      return;
    }
    // On mobile the fonts live in their own tab; jump back to the letter so
    // the writer sees their word change.
    setActiveTab((tab) => (tab === 'style' ? 'write' : tab));
  }, []);

  // ---- Flowers ----------------------------------------------------------------
  const addFlower = useCallback((flowerId: string) => {
    setFlowers((prev) => [...prev, {
      id: nanoid(6), flowerId,
      x: 15 + Math.random() * 70, y: 15 + Math.random() * 70,
      size: 44, rotation: Math.random() * 40 - 20,
    }]);
  }, []);
  const removeFlower = useCallback((id: string) => {
    setFlowers((prev) => prev.filter((f) => f.id !== id));
    setSelectedFlower((current) => (current === id ? null : current));
  }, []);
  const selectFlower = useCallback((id: string) => {
    setSelectedFlower((current) => (current === id ? null : id));
  }, []);
  const registerNode = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) flowerNodes.current.set(id, el);
    else flowerNodes.current.delete(id);
  }, []);

  // Dragging updates the flower's own DOM node directly — no React re-render
  // per pointer move. State is committed once, on release.
  const handlePointerDown = useCallback((e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const flower = (stateRef.current.flowers as FlowerPlacement[]).find((f) => f.id === id);
    if (!flower) return;
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, origX: flower.x, origY: flower.y, lastX: flower.x, lastY: flower.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !paperRef.current) return;
    const rect = paperRef.current.getBoundingClientRect();
    const dx = ((e.clientX - drag.startX) / rect.width) * 100;
    const dy = ((e.clientY - drag.startY) / rect.height) * 100;
    drag.lastX = Math.max(0, Math.min(95, drag.origX + dx));
    drag.lastY = Math.max(0, Math.min(95, drag.origY + dy));
    if (Math.abs(dx) + Math.abs(dy) > 0.3) drag.moved = true;
    const node = flowerNodes.current.get(drag.id);
    if (node) {
      node.style.left = `${drag.lastX}%`;
      node.style.top = `${drag.lastY}%`;
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || !drag.moved) return;
    setFlowers((prev) => prev.map((f) => (f.id === drag.id ? { ...f, x: drag.lastX, y: drag.lastY } : f)));
  }, []);

  // ---- Send / preview -----------------------------------------------------------
  const handleSend = useCallback(async () => {
    const currentHtml = syncContentFromEditor();
    const plainText = htmlToPlainText(currentHtml).trim();
    if (!plainText) { setError('Your letter has no words yet.'); return; }
    if (!recipient.trim()) { setError('Who is this letter for?'); return; }
    if (isPrivate && !password) { setError('Choose a passphrase, or turn protection off.'); return; }
    setError('');
    setSending(true);
    try {
      const payload: CreateLetterPayload = {
        salutation, salutationEnabled, recipient: recipient.trim(), content: currentHtml,
        closing, signature: signature.trim() || 'With love',
        sealType, sealColor, crest, customInitials: customInitials.trim(),
        bodyFont, signatureFont, flowers, isPrivate,
        password: isPrivate ? password : undefined,
      };
      const result = await createLetter(payload);
      if (result.success && result.data) {
        void clearDraft();
        onLetterCreated(result.data.slug);
      } else setError(result.error || 'Failed.');
    } catch {
      setError('An error occurred.');
    } finally {
      setSending(false);
    }
  }, [salutation, salutationEnabled, recipient, closing, signature, sealType, sealColor, crest, customInitials, bodyFont, signatureFont, flowers, isPrivate, password, onLetterCreated, syncContentFromEditor]);

  const handlePreview = useCallback(() => {
    syncContentFromEditor();
    setShowPreview(true);
  }, [syncContentFromEditor]);

  const discardDraft = useCallback(() => {
    void clearDraft();
    window.location.reload();
  }, []);

  const fontPanel = (
    <div className={`${activeTab !== 'style' ? 'hidden lg:block' : ''}`}>
      <h3 className="font-heading text-[11px] tracking-[0.18em] text-ink/70 uppercase mb-2">Body Font</h3>
      <p className="font-body text-[12px] text-ink/45 italic leading-relaxed mb-3">Select a word — even one letter — to change just that text. With nothing selected, your choice sets the whole letter's font.</p>
      <div className="space-y-1 mb-5">
        {BODY_FONTS.map(f => (
          <button key={f.value} onMouseDown={(e) => e.preventDefault()} onClick={() => applyBodyFont(f.value)}
            className={`w-full py-2 px-3 text-left text-[15px] rounded-sm transition-all duration-500 ${bodyFont === f.value ? 'bg-ink/8 text-ink/90' : 'text-ink/45 hover:text-ink/70 hover:bg-ink/3'}`}
            style={{ fontFamily: f.family }}>{f.label}</button>
        ))}
      </div>
      <h3 className="font-heading text-[11px] tracking-[0.18em] text-ink/70 uppercase mb-3">Signature Font</h3>
      <div className="space-y-1 mb-5">
        {SIG_FONTS.map(f => (
          <button key={f.value} onClick={() => setSignatureFont(f.value)}
            className={`w-full py-2 px-3 text-left text-[17px] rounded-sm transition-all duration-500 ${signatureFont === f.value ? 'bg-ink/8 text-ink/90' : 'text-ink/45 hover:text-ink/70 hover:bg-ink/3'}`}
            style={{ fontFamily: f.family }}>{f.label}</button>
        ))}
      </div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading text-[11px] tracking-[0.18em] text-ink/70 uppercase">Salutation</h3>
        <label className="flex items-center gap-2 cursor-pointer">
          <div className="relative">
            <input type="checkbox" checked={salutationEnabled} onChange={(e) => setSalutationEnabled(e.target.checked)} className="sr-only peer" aria-label="Include a salutation" />
            <div className="w-8 h-[16px] bg-ink/10 rounded-full peer-checked:bg-gold/50 transition-colors duration-500" />
            <div className="absolute left-0.5 top-[1px] w-3.5 h-3.5 bg-parchment-light rounded-full shadow peer-checked:translate-x-[16px] transition-transform duration-500" />
          </div>
          <span className="font-body text-[11px] text-ink/50 italic">{salutationEnabled ? 'shown' : 'hidden'}</span>
        </label>
      </div>
      <div className={`flex flex-wrap gap-1.5 mb-5 ${salutationEnabled ? '' : 'opacity-40 pointer-events-none'}`}>
        {SALUTATIONS.map(s => (
          <button key={s} onClick={() => setSalutation(s)}
            className={`py-1.5 px-3 text-[13px] font-body italic rounded-sm transition-all duration-500 ${salutation === s ? 'bg-ink/8 text-ink/90' : 'text-ink/40 hover:text-ink/65 hover:bg-ink/3'}`}>{s}</button>
        ))}
      </div>
      <h3 className="font-heading text-[11px] tracking-[0.18em] text-ink/70 uppercase mb-3">Closing</h3>
      <div className="flex flex-wrap gap-1.5">
        {CLOSINGS.map(c => (
          <button key={c} onClick={() => setClosing(c)}
            className={`py-1.5 px-3 text-[13px] font-body italic rounded-sm transition-all duration-500 ${closing === c ? 'bg-ink/8 text-ink/90' : 'text-ink/40 hover:text-ink/65 hover:bg-ink/3'}`}>{c}</button>
        ))}
      </div>
    </div>
  );

  const accessoryPanel = (
    <div className={`${activeTab !== 'seal' && activeTab !== 'decor' ? 'hidden lg:block' : ''}`}>
      <div className={`${activeTab !== 'decor' ? 'hidden lg:block' : ''} mb-6`}>
        <h3 className="font-heading text-[11px] tracking-[0.18em] text-ink/70 uppercase mb-2">Flower Decorations</h3>
        <p className="font-body text-[13px] text-ink/55 mb-3 italic">Tap to place, drag to move. Tap a placed flower to remove it.</p>
        <div className="grid grid-cols-4 gap-1.5">
          {ALL_FLOWERS.map(flower => (
            <button key={flower.id} onClick={() => addFlower(flower.id)}
              className="flex flex-col items-center gap-0.5 p-2 rounded-sm hover:bg-ink/4 transition-all duration-500" title={flower.name} aria-label={`Add ${flower.name}`}>
              <Flower flowerId={flower.id} size={26} color={flower.defaultColor} /><span className="text-[9px] text-ink/50">{flower.name}</span>
            </button>
          ))}
        </div>
        {flowers.length > 0 && (
          <div className="flex items-center justify-between mt-3">
            <span className="font-body text-[11px] text-ink/40 italic">{flowers.length} placed</span>
            <button onClick={() => { setFlowers([]); setSelectedFlower(null); }} className="font-heading text-[10px] uppercase py-2 text-burgundy/60 hover:text-burgundy/90 transition-colors">Remove all</button>
          </div>
        )}
      </div>

      <div className={`${activeTab !== 'seal' ? 'hidden lg:block' : ''}`}>
        <div className="flex justify-center mb-5"><WaxSealIcon sealType={sealType} sealColor={sealColor} customInitials={customInitials} size={100} /></div>
        <h3 className="font-heading text-[11px] tracking-[0.18em] text-ink/70 uppercase mb-3">Seal Design</h3>
        <div className="grid grid-cols-3 gap-1.5 mb-5">
          {SEAL_TYPES.map(s => (
            <button key={s.value} onClick={() => setSealType(s.value)}
              className={`py-2 text-[13px] font-body rounded-sm transition-all duration-500 ${sealType === s.value ? 'bg-ink/8 text-ink/90 shadow-sm' : 'text-ink/45 hover:text-ink/70 hover:bg-ink/3'}`}>{s.label}</button>
          ))}
        </div>
        <h3 className="font-heading text-[11px] tracking-[0.18em] text-ink/70 uppercase mb-3">Wax Color</h3>
        <div className="flex gap-3 mb-5">
          {SEAL_COLORS.map(c => (
            <button key={c.value} onClick={() => setSealColor(c.value)}
              className={`w-8 h-8 rounded-full border-2 transition-all duration-500 ${sealColor === c.value ? 'border-gold-bright scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
              style={{ backgroundColor: c.hex }} title={c.label} aria-label={`${c.label} wax`} />
          ))}
        </div>
        <h3 className="font-heading text-[11px] tracking-[0.18em] text-ink/70 uppercase mb-3">Crest</h3>
        <div className="grid grid-cols-3 gap-1.5 mb-5">
          {CREST_TYPES.map(c => (
            <button key={c.value} onClick={() => setCrest(c.value)}
              className={`py-2 text-[13px] font-body rounded-sm transition-all duration-500 ${crest === c.value ? 'bg-ink/8 text-ink/90 shadow-sm' : 'text-ink/45 hover:text-ink/70 hover:bg-ink/3'}`}>{c.label}</button>
          ))}
        </div>
        <h3 className="font-heading text-[11px] tracking-[0.18em] text-ink/70 uppercase mb-3">Custom Initials</h3>
        <p className="font-body text-[12px] text-ink/45 italic mb-2">Up to 3 characters — pressed into the seal.</p>
        <input type="text" value={customInitials}
          onChange={(e) => setCustomInitials([...e.target.value.toUpperCase()].slice(0, 3).join(''))}
          placeholder="e.g. A·R" className="parchment-input w-full text-center font-uncial text-xl py-2 mb-5" maxLength={6} aria-label="Custom seal initials" />
        <label className="flex items-center gap-3 cursor-pointer mb-5">
          <div className="relative">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="sr-only peer" />
            <div className="w-9 h-[18px] bg-ink/10 rounded-full peer-checked:bg-burgundy/50 transition-colors duration-500" />
            <div className="absolute left-0.5 top-[1px] w-4 h-4 bg-parchment-light rounded-full shadow peer-checked:translate-x-[18px] transition-transform duration-500" />
          </div>
          <span className="font-body text-[14px] text-ink/70">Password protect</span>
        </label>
        {isPrivate && <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Secret passphrase..." className="parchment-input w-full font-body text-sm py-2 mb-5" autoComplete="new-password" />}
      </div>
    </div>
  );

  if (showPreview) {
    return <LetterPreview salutation={salutation} salutationEnabled={salutationEnabled} recipient={recipient} content={content}
      closing={closing} signature={signature || 'With love'} sealType={sealType} sealColor={sealColor}
      crest={crest} customInitials={customInitials} bodyFont={bodyFont}
      signatureFont={signatureFont} flowers={flowers}
      onBack={() => setShowPreview(false)} onSend={handleSend} sending={sending} />;
  }

  return (
    <div className="min-h-screen parchment-bg">
      <nav className="no-print sticky top-0 z-50 flex items-center justify-between px-4 py-3 md:px-8"
        style={{ background: 'rgba(196,180,142,0.92)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(139,115,64,0.12)' }}>
        <button onClick={onBack} className="font-heading text-[11px] tracking-[0.12em] text-ink/60 uppercase hover:text-ink transition-colors duration-500">&larr; Return</button>
        <div className="flex items-center gap-2">
          <HeartSigilIcon size={16} color="#6B1025" />
          <span className="font-heading text-[10px] tracking-[0.2em] text-ink/60 uppercase hidden md:inline">Composing</span>
        </div>
        <button onClick={handlePreview} className="font-heading text-[11px] tracking-[0.12em] text-ink/60 uppercase hover:text-ink transition-colors duration-500">Preview &rarr;</button>
      </nav>

      {restoredDraft && (
        <div className="no-print max-w-7xl mx-auto px-3 pt-3">
          <div className="flex items-center justify-between gap-3 px-4 py-2 rounded-sm" style={{ background: 'rgba(139,115,64,0.08)', border: '1px solid rgba(139,115,64,0.15)' }}>
            <p className="font-body text-[13px] text-ink/60 italic">An unfinished letter was waiting for you — restored from your last visit.</p>
            <button onClick={discardDraft} className="font-heading text-[9px] tracking-[0.12em] uppercase text-burgundy/60 hover:text-burgundy/90 whitespace-nowrap transition-colors">Start fresh</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 py-6 md:py-10 relative z-10">
        <div className="flex gap-1 mb-5 lg:hidden overflow-x-auto pb-1">
          {(['write','style','decor','seal'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`font-heading text-[11px] tracking-[0.1em] uppercase py-2.5 px-5 rounded-sm whitespace-nowrap transition-all duration-500 ${activeTab === tab ? 'bg-ink/8 text-ink/90' : 'text-ink/40 hover:text-ink/60'}`}>
              {tab === 'write' ? 'Write' : tab === 'style' ? 'Fonts' : tab === 'decor' ? 'Flowers' : 'Seal'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)_270px] xl:grid-cols-[280px_minmax(620px,760px)_300px] gap-5 lg:gap-7 items-start">
          <aside className="relative z-20 order-2 lg:order-1 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto pr-1">
            {fontPanel}
          </aside>

          <main className={`order-1 lg:order-2 ${activeTab !== 'write' ? 'hidden lg:block' : ''}`}>
            <div ref={paperRef} className="relative letter-paper rounded-sm"
              style={{ padding: 'clamp(24px, 5vw, 56px)' }}
              onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
              onClick={() => setSelectedFlower(null)}>
              <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-sm"
                style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent 1.85em, rgba(100,80,40,0.06) 1.85em, rgba(100,80,40,0.06) 1.86em)`, backgroundSize: '100% 1.9em', backgroundPosition: '0 56px' }} />
              <div className="absolute top-0 bottom-0 pointer-events-none z-0" style={{ left: 'clamp(20px, 4vw, 48px)', width: '1px', background: 'rgba(140,40,40,0.08)' }} />

              {customInitials && (
                <div className="text-center mb-2 relative z-10">
                  <span className="font-uncial text-5xl md:text-6xl text-burgundy/35 select-none leading-none">{[...customInitials][0]}</span>
                </div>
              )}

              {salutationEnabled && (
                <div className="mb-5 relative z-10 flex flex-wrap items-baseline gap-1">
                  <input type="text" value={salutation} onChange={(e) => setSalutation(e.target.value)}
                    className="parchment-input font-display text-lg italic py-1 w-auto max-w-[160px]"
                    style={{ borderBottomStyle: 'dashed', borderBottomColor: 'rgba(139,115,64,0.2)' }}
                    aria-label="Salutation" />
                  <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)}
                    placeholder="their name"
                    className="parchment-input font-display text-xl italic py-1 w-auto min-w-[100px] max-w-[260px]"
                    style={{ borderBottomStyle: 'dashed' }}
                    aria-label="Recipient" />
                  <span className="font-display text-lg text-ink/80">,</span>
                </div>
              )}
              {!salutationEnabled && (
                <div className="mb-5 relative z-10">
                  <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)}
                    placeholder="who is this letter for? (kept for the envelope)"
                    className="parchment-input font-display text-base italic py-1 w-full max-w-[320px] opacity-60"
                    style={{ borderBottomStyle: 'dashed' }}
                    aria-label="Recipient" />
                </div>
              )}

              <OrnamentDivider className="w-24 mx-auto mb-5 opacity-50" color="#8b7340" />

              <div className="relative z-10 mb-6">
                {draftReady && (
                  <LetterEditor
                    ref={editorRef}
                    initialHtml={content}
                    placeholderLines={[
                      'Write from the depths of your heart...',
                      'Let the ink carry what your voice cannot.',
                    ]}
                    fontFamily={getFontFamilyByChoice(bodyFont)}
                    onChange={handleEditorChange}
                  />
                )}
              </div>

              <OrnamentDivider className="w-16 mx-auto mb-4 opacity-30" color="#8b7340" />

              <div className="text-right relative z-10 space-y-2">
                <div>
                  <input type="text" value={closing} onChange={(e) => setClosing(e.target.value)}
                    className="parchment-input font-display text-base italic py-1 text-right w-auto max-w-[220px] inline-block"
                    style={{ borderBottomStyle: 'dashed', borderBottomColor: 'rgba(139,115,64,0.2)' }}
                    aria-label="Closing" />
                </div>
                <div>
                  <input type="text" value={signature} onChange={(e) => setSignature(e.target.value)}
                    placeholder="your name"
                    className="parchment-input text-2xl py-1 text-right w-auto min-w-[100px] max-w-[260px] inline-block"
                    style={{ fontFamily: getSigFontFamilyByChoice(signatureFont), borderBottomStyle: 'dashed' }}
                    aria-label="Signature" />
                </div>
              </div>

              {flowers.map(f => (
                <PlacedFlower key={f.id} flower={f} selected={selectedFlower === f.id}
                  onPointerDown={handlePointerDown} onSelect={selectFlower}
                  onRemove={removeFlower} registerNode={registerNode} />
              ))}
            </div>
          </main>

          <aside className="relative z-20 order-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto pr-1">
            {accessoryPanel}
            <div className="space-y-2 sticky bottom-2 lg:static z-30 mt-6 coh-sendbar">
              {error && <p className="font-body text-[14px] text-burgundy text-center italic">{error}</p>}
              <button onClick={handleSend} disabled={sending}
                className="w-full font-heading text-[11px] tracking-[0.18em] uppercase py-4 bg-ink text-parchment-light rounded-sm transition-all duration-500 hover:bg-ink-light disabled:opacity-40 flex items-center justify-center gap-2.5"
                style={{ boxShadow: '0 3px 15px rgba(0,0,0,0.25)' }}>
                <QuillIcon size={14} color="#d4c5a0" />{sending ? 'Sealing...' : 'Seal & Send'}
              </button>
              <button onClick={handlePreview}
                className="w-full font-heading text-[10px] tracking-[0.15em] uppercase py-3 text-ink/55 hover:text-ink/80 transition-colors duration-500">Preview Letter</button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
