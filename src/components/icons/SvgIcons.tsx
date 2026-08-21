interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

export function QuillIcon({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path
        d="M38,4 Q42,6 40,12 Q38,18 32,24 Q26,30 18,36 L12,40 L10,38 Q8,36 10,32 L14,26 Q20,18 28,12 Q34,6 38,4Z"
        fill={color}
        opacity="0.15"
        stroke={color}
        strokeWidth="1.5"
      />
      <path d="M12,40 L8,44 L6,42 L10,38" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M38,4 Q36,10 30,16" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <path d="M14,26 L18,36" stroke={color} strokeWidth="0.8" opacity="0.3" />
    </svg>
  );
}

export function InkBottleIcon({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <rect x="16" y="6" width="16" height="6" rx="2" stroke={color} strokeWidth="1.5" />
      <path d="M14,12 L14,38 Q14,42 18,42 L30,42 Q34,42 34,38 L34,12Z" stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.1" />
      <path d="M18,24 Q24,20 30,24" stroke={color} strokeWidth="1" opacity="0.4" />
      <ellipse cx="24" cy="8" rx="4" ry="1" fill={color} opacity="0.2" />
    </svg>
  );
}

export function ParchmentRollIcon({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path d="M12,8 Q8,8 8,12 L8,40 Q8,44 12,44 L14,44" stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.05" />
      <rect x="12" y="6" width="24" height="36" rx="1" stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.08" />
      <path d="M36,6 Q40,6 40,10 L40,14 Q40,10 36,10" stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.1" />
      <line x1="18" y1="16" x2="30" y2="16" stroke={color} strokeWidth="1" opacity="0.3" />
      <line x1="18" y1="22" x2="30" y2="22" stroke={color} strokeWidth="1" opacity="0.3" />
      <line x1="18" y1="28" x2="26" y2="28" stroke={color} strokeWidth="1" opacity="0.3" />
    </svg>
  );
}

export function RoyalCrestIcon({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path
        d="M24,4 L28,10 L36,8 L32,16 L40,20 L32,24 L36,32 L28,28 L24,36 L20,28 L12,32 L16,24 L8,20 L16,16 L12,8 L20,10Z"
        stroke={color}
        strokeWidth="1.5"
        fill={color}
        fillOpacity="0.08"
      />
      <circle cx="24" cy="20" r="6" stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.1" />
      <path d="M21,19 Q24,14 27,19" stroke={color} strokeWidth="1" opacity="0.5" />
      <line x1="24" y1="36" x2="24" y2="44" stroke={color} strokeWidth="1.5" />
      <path d="M20,44 L28,44" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function RoseIcon({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <ellipse cx="24" cy="18" rx="6" ry="7" stroke={color} strokeWidth="1.3" fill={color} fillOpacity="0.1" />
      <path d="M16,14 Q20,6 24,12 Q28,6 32,14" stroke={color} strokeWidth="1.2" />
      <path d="M14,20 Q18,12 24,16 Q30,12 34,20" stroke={color} strokeWidth="1.2" />
      <path d="M16,25 Q20,18 24,22 Q28,18 32,25" stroke={color} strokeWidth="1.2" />
      <path d="M24,26 L24,42" stroke={color} strokeWidth="1.5" />
      <path d="M20,34 Q24,28 24,34" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.1" />
      <path d="M28,32 Q24,26 24,32" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.1" />
    </svg>
  );
}

export function HeartSigilIcon({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path
        d="M24,40 Q24,40 8,26 Q0,18 8,10 Q14,4 20,8 Q22,10 24,14 Q26,10 28,8 Q34,4 40,10 Q48,18 40,26 Q24,40 24,40Z"
        stroke={color}
        strokeWidth="1.5"
        fill={color}
        fillOpacity="0.1"
      />
      <path d="M16,14 Q20,8 24,14" stroke={color} strokeWidth="0.8" opacity="0.4" />
    </svg>
  );
}

export function CandleIcon({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <rect x="20" y="18" width="8" height="24" rx="1" stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.1" />
      <line x1="24" y1="18" x2="24" y2="12" stroke={color} strokeWidth="1" />
      <path d="M22,12 Q24,4 26,12" stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.15" />
      <ellipse cx="24" cy="8" rx="2" ry="3" fill={color} opacity="0.15" />
      <path d="M16,42 L32,42 Q34,42 34,44 L14,44 Q14,42 16,42Z" stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.08" />
    </svg>
  );
}

export function CourierBagIcon({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path d="M12,18 L36,18 L34,42 L14,42Z" stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.08" />
      <path d="M16,18 Q16,8 24,8 Q32,8 32,18" stroke={color} strokeWidth="1.5" fill="none" />
      <rect x="20" y="26" width="8" height="6" rx="1" stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.1" />
      <circle cx="24" cy="29" r="1.5" fill={color} opacity="0.3" />
    </svg>
  );
}

export function RavenIcon({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <path
        d="M20,12 Q24,6 28,12 Q34,14 36,20 Q38,28 34,34 Q30,40 24,42 Q18,40 14,34 Q10,28 12,20 Q14,14 20,12Z"
        stroke={color}
        strokeWidth="1.5"
        fill={color}
        fillOpacity="0.08"
      />
      <path d="M36,20 Q42,16 44,12" stroke={color} strokeWidth="1.5" />
      <path d="M12,20 Q6,16 4,12" stroke={color} strokeWidth="1.5" />
      <path d="M36,26 Q42,28 46,26 Q44,32 38,30" stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.05" />
      <path d="M12,26 Q6,28 2,26 Q4,32 10,30" stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.05" />
      <circle cx="20" cy="18" r="2" fill={color} opacity="0.4" />
      <circle cx="28" cy="18" r="2" fill={color} opacity="0.4" />
      <path d="M22,22 L24,26 L26,22" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.15" />
    </svg>
  );
}

export function EnvelopeIcon({ size = 24, className = '', color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="12" width="40" height="28" rx="2" stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.05" />
      <path d="M4,12 L24,28 L44,12" stroke={color} strokeWidth="1.5" />
      <path d="M4,40 L18,26" stroke={color} strokeWidth="1" opacity="0.3" />
      <path d="M44,40 L30,26" stroke={color} strokeWidth="1" opacity="0.3" />
    </svg>
  );
}

export function OrnamentDivider({ className = '', color = 'currentColor' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 400 30" className={className} fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      {/* Left flourish */}
      <path d="M10,15 Q30,15 50,10 Q65,6 80,12 Q95,18 110,12 Q125,6 140,10 Q160,14 180,13 Q190,13 200,15" stroke={color} strokeWidth="0.7" opacity="0.35" />
      <path d="M40,15 Q55,20 70,16 Q85,12 100,16 Q115,20 130,16 Q145,12 165,14 Q180,15 200,15" stroke={color} strokeWidth="0.5" opacity="0.2" />
      {/* Right flourish — mirror */}
      <path d="M390,15 Q370,15 350,10 Q335,6 320,12 Q305,18 290,12 Q275,6 260,10 Q240,14 220,13 Q210,13 200,15" stroke={color} strokeWidth="0.7" opacity="0.35" />
      <path d="M360,15 Q345,20 330,16 Q315,12 300,16 Q285,20 270,16 Q255,12 235,14 Q220,15 200,15" stroke={color} strokeWidth="0.5" opacity="0.2" />
      {/* Center diamond */}
      <path d="M196,15 L200,11 L204,15 L200,19Z" fill={color} opacity="0.25" />
      <circle cx="200" cy="15" r="1.5" fill={color} opacity="0.15" />
      {/* Side dots */}
      <circle cx="185" cy="15" r="1" fill={color} opacity="0.15" />
      <circle cx="215" cy="15" r="1" fill={color} opacity="0.15" />
      <circle cx="175" cy="14" r="0.6" fill={color} opacity="0.1" />
      <circle cx="225" cy="14" r="0.6" fill={color} opacity="0.1" />
    </svg>
  );
}

export function CornerOrnament({ className = '', color = 'currentColor', position = 'top-left' }: { className?: string; color?: string; position?: string }) {
  const transforms: Record<string, string> = {
    'top-left': '',
    'top-right': 'scale(-1,1) translate(-80,0)',
    'bottom-left': 'scale(1,-1) translate(0,-80)',
    'bottom-right': 'scale(-1,-1) translate(-80,-80)',
  };

  return (
    <svg width="80" height="80" viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true">
      <g transform={transforms[position] || ''}>
        {/* Outer curves */}
        <path d="M2,2 Q2,35 8,45 Q14,55 26,60 Q32,62 36,62" stroke={color} strokeWidth="1" opacity="0.3" />
        <path d="M2,2 Q35,2 45,8 Q55,14 60,26 Q62,32 62,36" stroke={color} strokeWidth="1" opacity="0.3" />
        {/* Inner curves */}
        <path d="M6,6 Q6,28 12,36 Q18,44 26,48" stroke={color} strokeWidth="0.7" opacity="0.2" />
        <path d="M6,6 Q28,6 36,12 Q44,18 48,26" stroke={color} strokeWidth="0.7" opacity="0.2" />
        {/* Leaf flourish */}
        <path d="M16,16 Q12,22 14,28 Q16,22 20,18Z" fill={color} opacity="0.08" />
        <path d="M16,16 Q22,12 28,14 Q22,16 18,20Z" fill={color} opacity="0.08" />
        {/* Corner block */}
        <path d="M2,2 L10,2 L10,3.5 L3.5,3.5 L3.5,10 L2,10Z" fill={color} opacity="0.18" />
        {/* Small center dot */}
        <circle cx="5" cy="5" r="2" fill={color} opacity="0.12" />
      </g>
    </svg>
  );
}
