import type { CrestType } from '@/types/letter';

interface CrestDecorationProps {
  type: CrestType;
  size?: number;
}

export default function CrestDecoration({ type, size = 60 }: CrestDecorationProps) {
  if (type === 'none') return null;

  const color = '#8b7340';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
      className="opacity-40"
    >
      {type === 'royal' && (
        <g>
          <path d="M40,8 L46,20 L60,16 L52,28 L66,36 L52,40 L60,52 L46,46 L40,60 L34,46 L20,52 L28,40 L14,36 L28,28 L20,16 L34,20Z" stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.06" />
          <circle cx="40" cy="34" r="8" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.08" />
          <path d="M36,32 Q40,26 44,32" stroke={color} strokeWidth="0.8" />
          <line x1="40" y1="60" x2="40" y2="74" stroke={color} strokeWidth="1.2" />
          <path d="M34,74 L46,74" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        </g>
      )}
      {type === 'floral' && (
        <g transform="translate(40,40)">
          <ellipse cx="0" cy="-16" rx="5" ry="8" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.06" />
          <ellipse cx="0" cy="16" rx="5" ry="8" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.06" />
          <ellipse cx="-16" cy="0" rx="8" ry="5" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.06" />
          <ellipse cx="16" cy="0" rx="8" ry="5" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.06" />
          <ellipse cx="-11" cy="-11" rx="6" ry="4" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.06" transform="rotate(-45 -11 -11)" />
          <ellipse cx="11" cy="-11" rx="6" ry="4" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.06" transform="rotate(45 11 -11)" />
          <ellipse cx="-11" cy="11" rx="6" ry="4" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.06" transform="rotate(45 -11 11)" />
          <ellipse cx="11" cy="11" rx="6" ry="4" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.06" transform="rotate(-45 11 11)" />
          <circle cx="0" cy="0" r="5" fill={color} fillOpacity="0.1" stroke={color} strokeWidth="0.8" />
        </g>
      )}
      {type === 'shield' && (
        <g>
          <path d="M40,10 L60,20 L60,42 Q60,58 40,70 Q20,58 20,42 L20,20Z" stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.05" />
          <path d="M40,16 L54,24 L54,40 Q54,54 40,64 Q26,54 26,40 L26,24Z" stroke={color} strokeWidth="0.8" fill="none" />
          <line x1="40" y1="24" x2="40" y2="58" stroke={color} strokeWidth="0.6" opacity="0.3" />
          <line x1="28" y1="36" x2="52" y2="36" stroke={color} strokeWidth="0.6" opacity="0.3" />
        </g>
      )}
      {type === 'wreath' && (
        <g transform="translate(40,40)">
          <path d="M0,-28 Q12,-26 16,-16 Q20,-6 16,4 Q12,12 4,16" stroke={color} strokeWidth="1" fill="none" />
          <path d="M0,-28 Q-12,-26 -16,-16 Q-20,-6 -16,4 Q-12,12 -4,16" stroke={color} strokeWidth="1" fill="none" />
          <path d="M4,16 Q2,20 0,22 Q-2,20 -4,16" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.1" />
          {/* Leaf details */}
          <ellipse cx="10" cy="-20" rx="4" ry="2" stroke={color} strokeWidth="0.6" fill={color} fillOpacity="0.06" transform="rotate(-30 10 -20)" />
          <ellipse cx="-10" cy="-20" rx="4" ry="2" stroke={color} strokeWidth="0.6" fill={color} fillOpacity="0.06" transform="rotate(30 -10 -20)" />
          <ellipse cx="16" cy="-8" rx="4" ry="2" stroke={color} strokeWidth="0.6" fill={color} fillOpacity="0.06" transform="rotate(-60 16 -8)" />
          <ellipse cx="-16" cy="-8" rx="4" ry="2" stroke={color} strokeWidth="0.6" fill={color} fillOpacity="0.06" transform="rotate(60 -16 -8)" />
          <ellipse cx="14" cy="6" rx="4" ry="2" stroke={color} strokeWidth="0.6" fill={color} fillOpacity="0.06" transform="rotate(-75 14 6)" />
          <ellipse cx="-14" cy="6" rx="4" ry="2" stroke={color} strokeWidth="0.6" fill={color} fillOpacity="0.06" transform="rotate(75 -14 6)" />
        </g>
      )}
      {type === 'wings' && (
        <g transform="translate(40,40)">
          {/* Left wing */}
          <path d="M-4,-2 Q-20,-20 -30,-14 Q-22,-8 -18,-2" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.04" />
          <path d="M-4,0 Q-24,-10 -32,-2 Q-22,0 -16,4" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.04" />
          <path d="M-4,2 Q-22,0 -28,8 Q-18,8 -12,8" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.04" />
          {/* Right wing */}
          <path d="M4,-2 Q20,-20 30,-14 Q22,-8 18,-2" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.04" />
          <path d="M4,0 Q24,-10 32,-2 Q22,0 16,4" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.04" />
          <path d="M4,2 Q22,0 28,8 Q18,8 12,8" stroke={color} strokeWidth="1" fill={color} fillOpacity="0.04" />
          {/* Center heart */}
          <path d="M0,6 Q0,6 -6,0 Q-8,-4 -4,-6 Q-1,-8 0,-4 Q1,-8 4,-6 Q8,-4 6,0 Q0,6 0,6Z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="0.8" />
        </g>
      )}
    </svg>
  );
}
