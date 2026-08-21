import type { SealType, SealColor } from '@/types/letter';

const C: Record<SealColor, [string, string, string]> = {
  burgundy: ['#8a2040', '#6B1025', '#3d0810'],
  crimson: ['#b83058', '#8A1538', '#4e0c1e'],
  emerald: ['#3a7858', '#264D3A', '#12281c'],
  gold: ['#c4a44a', '#8a6e28', '#5a4818'],
  black: ['#504030', '#2a2015', '#100c08'],
};

function graphemes(text: string): string[] {
  try {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map((s) => s.segment);
  } catch {
    return [...text];
  }
}

/** 1–3 characters, trimmed, grapheme-aware, auto-scaled so nothing overflows. */
function initialsToDisplay(customInitials?: string): { text: string; fontSize: number } {
  const trimmed = (customInitials || '').trim();
  const parts = graphemes(trimmed).slice(0, 3);
  const text = parts.join('');
  if (!text) return { text: 'C·H', fontSize: 18 };
  const size = parts.length === 1 ? 24 : parts.length === 2 ? 19 : 14;
  return { text, fontSize: size };
}

function RoseD() {
  return <g transform="translate(50,50)" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9">
    <ellipse cx="0" cy="-1" rx="5.5" ry="6.5" /><path d="M-7,-5 Q-3,-10 0,-7 Q3,-10 7,-5" />
    <path d="M-9,0 Q-5,-7 0,-3 Q5,-7 9,0" /><path d="M-8,4 Q-4,-1 0,2 Q4,-1 8,4" />
    <path d="M-6,7 Q-2,3 0,5 Q2,3 6,7" /><path d="M0,7 L0,15" strokeWidth="0.7" />
  </g>;
}
function HeartD() {
  return <g transform="translate(50,48)" fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="1.1">
    <path d="M0,10 C-4,18 -15,8 -15,-1 C-15,-8 -10,-10 -7,-10 C-3,-10 -1,-7 0,-4 C1,-7 3,-10 7,-10 C10,-10 15,-8 15,-1 C15,8 4,18 0,10Z" />
  </g>;
}
function CrownD() {
  return <g transform="translate(50,50)" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1">
    <path d="M-13,5 L-13,-5 L-7,-1 L0,-9 L7,-1 L13,-5 L13,5Z" />
    <line x1="-13" y1="7" x2="13" y2="7" />
  </g>;
}
function RavenD() {
  return <g transform="translate(50,50)" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.9">
    <path d="M-2,-12 Q0,-14 2,-12 Q5,-8 5,-3 Q5,2 2,7 Q0,10 -3,12" />
    <path d="M-2,-12 Q-5,-8 -5,-3 Q-5,2 -2,7 Q0,10 -3,12" />
    <path d="M5,-3 Q9,-5 13,-7" /><path d="M-5,-3 Q-9,-5 -13,-7" />
    <path d="M5,1 Q10,3 14,1 Q12,5 7,5" /><path d="M-5,1 Q-10,3 -14,1 Q-12,5 -7,5" />
  </g>;
}
function InitialsD({ customInitials }: { customInitials?: string }) {
  const { text, fontSize } = initialsToDisplay(customInitials);
  return <g transform="translate(50,50)">
    <text x="0" y={fontSize * 0.34} textAnchor="middle" fontFamily="'Cinzel',serif" fontSize={fontSize} fontWeight="600" fill="rgba(255,255,255,0.22)">{text}</text>
  </g>;
}
function MonogramD({ customInitials }: { customInitials?: string }) {
  const first = graphemes((customInitials || '').trim())[0] || 'L';
  return <g transform="translate(50,50)" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.7">
    <circle cx="0" cy="0" r="13" /><circle cx="0" cy="0" r="10.5" />
    <text x="0" y="6" textAnchor="middle" fontFamily="'Great Vibes',cursive" fontSize="18" fill="rgba(255,255,255,0.24)" stroke="none">{first}</text>
  </g>;
}

export default function WaxSealIcon({ sealType, sealColor, size = 100, className = '', animated = false, onClick, customInitials }: {
  sealType: SealType; sealColor: SealColor; size?: number; className?: string; animated?: boolean; onClick?: () => void;
  customInitials?: string;
}) {
  const [light, base, dark] = C[sealColor];
  const gradientId = `ws-${sealColor}`;

  const design = sealType === 'initials' ? <InitialsD customInitials={customInitials} />
    : sealType === 'monogram' ? <MonogramD customInitials={customInitials} />
    : sealType === 'rose' ? <RoseD />
    : sealType === 'crown' ? <CrownD />
    : sealType === 'raven' ? <RavenD />
    : <HeartD />;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100"
      className={`${animated ? 'cursor-pointer transition-transform duration-300 hover:scale-105' : ''} ${className}`}
      onClick={onClick} role={onClick ? 'button' : undefined} aria-label={`${sealColor} wax seal`}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}>
      <defs>
        <radialGradient id={`${gradientId}-g`} cx="38%" cy="33%" r="60%">
          <stop offset="0%" stopColor={light} /><stop offset="50%" stopColor={base} /><stop offset="100%" stopColor={dark} />
        </radialGradient>
        {/* Depth: the pressed centre catches less light than the raised rim. */}
        <radialGradient id={`${gradientId}-press`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={dark} stopOpacity="0.16" />
          <stop offset="62%" stopColor={dark} stopOpacity="0.05" />
          <stop offset="78%" stopColor={light} stopOpacity="0.10" />
          <stop offset="100%" stopColor={dark} stopOpacity="0.14" />
        </radialGradient>
      </defs>

      {/* Shadow underneath */}
      <ellipse cx="52" cy="88" rx="28" ry="6" fill="rgba(0,0,0,0.18)" />

      {/* Main wax blob — original irregular outline preserved */}
      <path d={`M50,5 Q60,2 68,8 Q76,5 82,14 Q89,11 93,22 Q98,28 96,38
        Q100,48 96,56 Q100,64 95,72 Q98,80 91,86 Q84,92 74,90
        Q66,96 56,94 Q48,98 40,94 Q32,96 24,90 Q16,92 10,85
        Q4,78 6,70 Q1,62 4,54 Q0,46 4,38 Q2,28 8,22
        Q12,12 20,14 Q26,6 34,8 Q42,2 50,5Z`}
        fill={`url(#${gradientId}-g)`} />

      {/* Squeezed-out wax lip: irregular inner edge highlight/shade */}
      <path d={`M50,9 Q59,6 66,11 Q74,8 79,17 Q86,15 89,24 Q94,30 92,38
        Q96,48 92,56 Q96,63 91,70 Q94,77 87,83 Q80,88 72,86
        Q64,92 55,90 Q47,94 40,90 Q33,92 26,86 Q19,88 14,81
        Q9,74 11,67 Q6,60 9,53 Q5,46 9,39 Q7,30 13,25 Q16,16 23,18 Q29,11 36,12 Q43,7 50,9Z`}
        fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.2" />

      {/* Pressed impression: bevelled dish where the stamp landed */}
      <circle cx="50" cy="50" r="30" fill={`url(#${gradientId}-press)`} />
      <circle cx="50" cy="50" r="28.5" fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth="1.4" opacity="0.55" />
      <circle cx="49" cy="49" r="28.5" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.8" />
      <circle cx="50" cy="50" r="25" fill={dark} opacity="0.07" />

      {/* Top-left light catch (kept) + lower-right wax sheen */}
      <ellipse cx="38" cy="34" rx="12" ry="9" fill="rgba(255,255,255,0.07)" transform="rotate(-20 38 34)" />
      <ellipse cx="63" cy="70" rx="10" ry="6" fill="rgba(0,0,0,0.10)" transform="rotate(-15 63 70)" />

      {design}
    </svg>
  );
}

export { C as SEAL_COLORS };
