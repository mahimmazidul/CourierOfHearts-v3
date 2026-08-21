// Flower artwork — original CourierOfHearts botanical line art, unchanged
// geometry and colors. v3 renders every flower through shared <symbol>
// definitions (<use> instances) so 300 placed flowers reuse one DOM template
// per species instead of duplicating dozens of SVG nodes each.
import { memo } from 'react';

interface FlowerProps {
  size?: number;
  className?: string;
  color?: string;
}

export interface FlowerMeta {
  id: string;
  name: string;
  defaultColor: string;
}

export const ALL_FLOWERS: readonly FlowerMeta[] = [
  { id: 'rose', name: 'Rose', defaultColor: '#6B1025' },
  { id: 'hibiscus', name: 'Hibiscus', defaultColor: '#8A1538' },
  { id: 'lily', name: 'Lily', defaultColor: '#8b7340' },
  { id: 'daisy', name: 'Daisy', defaultColor: '#8b7340' },
  { id: 'tulip', name: 'Tulip', defaultColor: '#8A1538' },
  { id: 'peony', name: 'Peony', defaultColor: '#6B1025' },
  { id: 'forget-me-not', name: 'Forget-me-not', defaultColor: '#264D3A' },
  { id: 'lavender', name: 'Lavender', defaultColor: '#5a3d6b' },
  { id: 'wild-rose', name: 'Wild Rose', defaultColor: '#8A1538' },
  { id: 'ivy', name: 'Ivy Vine', defaultColor: '#264D3A' },
  { id: 'sunflower', name: 'Sunflower', defaultColor: '#8b7340' },
  { id: 'cherry-blossom', name: 'Cherry Blossom', defaultColor: '#9a5060' },
] as const;

const FLOWER_MAP = new Map(ALL_FLOWERS.map((f) => [f.id, f]));

export function getFlowerMeta(id: string): FlowerMeta | undefined {
  return FLOWER_MAP.get(id);
}

/** Mount once (App root). Defines every flower as a reusable symbol. */
export function FlowerDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
    <symbol id="coh-flower-rose" viewBox="0 0 80 80" fill="none">
      <g opacity="0.85">
      {/* Outer petals */}
      <path d="M40,20 Q30,12 22,18 Q14,24 20,34 Q16,28 12,32 Q8,38 16,44 Q10,42 10,48 Q10,56 20,56 Q16,60 20,64 Q26,70 34,66 Q30,72 36,74 Q42,76 46,70 Q50,74 56,70 Q62,64 58,56 Q66,58 68,50 Q70,42 62,38 Q68,34 64,28 Q60,20 52,22 Q56,14 48,12 Q42,10 40,20Z"
      stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.08"/>
      {/* Inner petals */}
      <path d="M40,26 Q34,22 30,28 Q26,34 32,38" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.06"/>
      <path d="M40,26 Q46,22 50,28 Q54,34 48,38" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.06"/>
      <path d="M32,38 Q28,42 32,48 Q36,52 40,48" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.06"/>
      <path d="M48,38 Q52,42 48,48 Q44,52 40,48" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.06"/>
      {/* Center spiral */}
      <path d="M38,36 Q40,32 42,36 Q44,40 40,42 Q36,40 38,36" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.12"/>
      </g>
    </symbol>
    <symbol id="coh-flower-hibiscus" viewBox="0 0 80 80" fill="none">
      <g opacity="0.85">
      {/* 5 large petals */}
      <ellipse cx="40" cy="18" rx="12" ry="16" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.07"/>
      <ellipse cx="58" cy="32" rx="16" ry="12" transform="rotate(30 58 32)" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.07"/>
      <ellipse cx="52" cy="56" rx="14" ry="12" transform="rotate(60 52 56)" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.07"/>
      <ellipse cx="28" cy="56" rx="14" ry="12" transform="rotate(-60 28 56)" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.07"/>
      <ellipse cx="22" cy="32" rx="16" ry="12" transform="rotate(-30 22 32)" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.07"/>
      {/* Petal veins */}
      <path d="M40,34 L40,10" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
      <path d="M40,38 L58,22" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
      <path d="M40,40 L56,54" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
      <path d="M40,40 L24,54" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
      <path d="M40,38 L22,22" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
      {/* Stamen */}
      <circle cx="40" cy="38" r="6" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.1"/>
      <line x1="40" y1="32" x2="40" y2="20" stroke="currentColor" strokeWidth="0.8" opacity="0.4"/>
      <circle cx="40" cy="19" r="1.5" fill="currentColor" fillOpacity="0.2"/>
      </g>
    </symbol>
    <symbol id="coh-flower-lily" viewBox="0 0 80 80" fill="none">
      <g opacity="0.85">
      <path d="M40,14 Q32,24 28,38 Q26,48 40,50 Q54,48 52,38 Q48,24 40,14Z" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.06"/>
      <path d="M22,26 Q26,32 32,40 Q36,46 40,50 Q32,50 26,44 Q18,36 22,26Z" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.06"/>
      <path d="M58,26 Q54,32 48,40 Q44,46 40,50 Q48,50 54,44 Q62,36 58,26Z" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.06"/>
      {/* Stamen lines */}
      <line x1="40" y1="38" x2="38" y2="24" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
      <line x1="40" y1="38" x2="34" y2="28" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
      <line x1="40" y1="38" x2="46" y2="28" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
      <circle cx="38" cy="23" r="1" fill="currentColor" fillOpacity="0.3"/>
      <circle cx="34" cy="27" r="1" fill="currentColor" fillOpacity="0.3"/>
      <circle cx="46" cy="27" r="1" fill="currentColor" fillOpacity="0.3"/>
      {/* Stem */}
      <path d="M40,50 Q40,60 38,72" stroke="currentColor" strokeWidth="1" opacity="0.4"/>
      <path d="M38,58 Q32,54 28,56" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.04" opacity="0.4"/>
      </g>
    </symbol>
    <symbol id="coh-flower-daisy" viewBox="0 0 80 80" fill="none">
      <g opacity="0.85">
      {[0,30,60,90,120,150,180,210,240,270,300,330].map((angle) => (
      <ellipse key={angle} cx="40" cy="22" rx="4" ry="12"
      transform={`rotate(${angle} 40 40)`}
      stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.05"/>
      ))}
      <circle cx="40" cy="40" r="7" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.12"/>
      <circle cx="40" cy="40" r="4" stroke="currentColor" strokeWidth="0.5" fill="currentColor" fillOpacity="0.08"/>
      </g>
    </symbol>
    <symbol id="coh-flower-tulip" viewBox="0 0 80 80" fill="none">
      <g opacity="0.85">
      <path d="M40,16 Q34,20 30,30 Q28,38 34,42 Q38,44 40,44" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.07"/>
      <path d="M40,16 Q46,20 50,30 Q52,38 46,42 Q42,44 40,44" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.07"/>
      <path d="M34,22 Q28,28 26,36 Q24,42 30,44 Q36,44 40,44" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.05"/>
      <path d="M46,22 Q52,28 54,36 Q56,42 50,44 Q44,44 40,44" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.05"/>
      {/* Stem */}
      <path d="M40,44 Q40,56 42,72" stroke="currentColor" strokeWidth="1.2" opacity="0.4"/>
      <path d="M41,56 Q48,50 54,52" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.04" opacity="0.35"/>
      <path d="M41,62 Q34,58 28,60" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.04" opacity="0.35"/>
      </g>
    </symbol>
    <symbol id="coh-flower-peony" viewBox="0 0 80 80" fill="none">
      <g opacity="0.85">
      {/* Many layered petals */}
      <path d="M40,12 Q30,16 26,26 Q22,36 30,42 Q38,46 40,40" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.06"/>
      <path d="M40,12 Q50,16 54,26 Q58,36 50,42 Q42,46 40,40" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.06"/>
      <path d="M20,28 Q22,20 30,18 Q38,16 40,26 Q38,36 28,36 Q18,36 20,28Z" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.05"/>
      <path d="M60,28 Q58,20 50,18 Q42,16 40,26 Q42,36 52,36 Q62,36 60,28Z" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.05"/>
      <path d="M24,40 Q20,48 26,54 Q32,60 40,56 Q36,48 30,42Z" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.05"/>
      <path d="M56,40 Q60,48 54,54 Q48,60 40,56 Q44,48 50,42Z" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.05"/>
      <path d="M34,50 Q36,58 40,62 Q44,58 46,50 Q44,44 40,42 Q36,44 34,50Z" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.06"/>
      {/* Center */}
      <circle cx="40" cy="34" r="5" stroke="currentColor" strokeWidth="0.6" fill="currentColor" fillOpacity="0.1"/>
      </g>
    </symbol>
    <symbol id="coh-flower-forget-me-not" viewBox="0 0 80 80" fill="none">
      <g opacity="0.85">
      {/* Multiple small 5-petal flowers */}
      {[[28,24],[44,20],[56,30],[50,46],[32,48],[20,38]].map(([cx,cy], i) => (
      <g key={i}>
      {[0,72,144,216,288].map((a) => (
      <ellipse key={a} cx={cx} cy={(cy as number)-6} rx="2.5" ry="5"
      transform={`rotate(${a} ${cx} ${cy})`}
      stroke="currentColor" strokeWidth="0.6" fill="currentColor" fillOpacity="0.06"/>
      ))}
      <circle cx={cx} cy={cy} r="1.5" fill="currentColor" fillOpacity="0.15"/>
      </g>
      ))}
      {/* Connecting stems */}
      <path d="M28,30 Q30,36 32,48" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
      <path d="M44,26 Q46,34 50,46" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
      <path d="M36,52 Q38,60 40,70" stroke="currentColor" strokeWidth="0.8" opacity="0.3"/>
      </g>
    </symbol>
    <symbol id="coh-flower-lavender" viewBox="0 0 80 80" fill="none">
      <g opacity="0.85">
      {/* Stem */}
      <path d="M40,72 Q38,50 40,20" stroke="currentColor" strokeWidth="1" opacity="0.4"/>
      {/* Small bud clusters */}
      {[20,24,28,32,36,40].map((y, i) => (
      <g key={i}>
      <ellipse cx={38 - (i % 2) * 2} cy={y} rx="3" ry="2" stroke="currentColor" strokeWidth="0.6" fill="currentColor" fillOpacity={0.06 + i * 0.01}/>
      <ellipse cx={42 + (i % 2) * 2} cy={y} rx="3" ry="2" stroke="currentColor" strokeWidth="0.6" fill="currentColor" fillOpacity={0.06 + i * 0.01}/>
      </g>
      ))}
      {/* Leaves */}
      <path d="M38,55 Q30,48 26,50" stroke="currentColor" strokeWidth="0.6" fill="currentColor" fillOpacity="0.04" opacity="0.4"/>
      <path d="M39,60 Q48,54 52,56" stroke="currentColor" strokeWidth="0.6" fill="currentColor" fillOpacity="0.04" opacity="0.4"/>
      </g>
    </symbol>
    <symbol id="coh-flower-wild-rose" viewBox="0 0 80 80" fill="none">
      <g opacity="0.85">
      {[0, 72, 144, 216, 288].map((angle) => (
      <ellipse key={angle} cx="40" cy="24" rx="8" ry="14"
      transform={`rotate(${angle} 40 40)`}
      stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.06"/>
      ))}
      <circle cx="40" cy="40" r="5" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.1"/>
      {/* Stamen dots */}
      {[0,60,120,180,240,300].map((a) => (
      <circle key={a} cx={40 + 3*Math.cos(a*Math.PI/180)} cy={40 + 3*Math.sin(a*Math.PI/180)} r="0.8" fill="currentColor" fillOpacity="0.2"/>
      ))}
      </g>
    </symbol>
    <symbol id="coh-flower-ivy" viewBox="0 0 80 80" fill="none">
      <g opacity="0.8">
      <path d="M14,70 Q20,56 28,48 Q36,40 40,30 Q44,20 50,14 Q56,8 64,10" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
      {/* Leaves along vine */}
      <path d="M24,52 Q18,46 16,48 Q14,52 20,54Z" stroke="currentColor" strokeWidth="0.6" fill="currentColor" fillOpacity="0.08"/>
      <path d="M34,42 Q28,36 26,38 Q24,42 30,44Z" stroke="currentColor" strokeWidth="0.6" fill="currentColor" fillOpacity="0.08"/>
      <path d="M42,28 Q48,22 50,24 Q52,28 46,30Z" stroke="currentColor" strokeWidth="0.6" fill="currentColor" fillOpacity="0.08"/>
      <path d="M52,16 Q58,10 60,12 Q62,16 56,18Z" stroke="currentColor" strokeWidth="0.6" fill="currentColor" fillOpacity="0.08"/>
      {/* Tendrils */}
      <path d="M30,46 Q32,42 36,44" stroke="currentColor" strokeWidth="0.4" opacity="0.3"/>
      <path d="M44,24 Q42,20 38,22" stroke="currentColor" strokeWidth="0.4" opacity="0.3"/>
      </g>
    </symbol>
    <symbol id="coh-flower-sunflower" viewBox="0 0 80 80" fill="none">
      <g opacity="0.85">
      {[0,24,48,72,96,120,144,168,192,216,240,264,288,312,336].map((angle) => (
      <ellipse key={angle} cx="40" cy="24" rx="4" ry="10"
      transform={`rotate(${angle} 40 40)`}
      stroke="currentColor" strokeWidth="0.7" fill="currentColor" fillOpacity="0.06"/>
      ))}
      <circle cx="40" cy="40" r="9" stroke="currentColor" strokeWidth="0.8" fill="currentColor" fillOpacity="0.1"/>
      {/* Center cross-hatch */}
      <path d="M34,36 L46,44 M34,44 L46,36 M34,40 L46,40 M40,34 L40,46" stroke="currentColor" strokeWidth="0.3" opacity="0.2"/>
      </g>
    </symbol>
    <symbol id="coh-flower-cherry-blossom" viewBox="0 0 80 80" fill="none">
      <g opacity="0.85">
      {/* Branch */}
      <path d="M10,68 Q30,50 50,40 Q60,35 72,32" stroke="#5a4030" strokeWidth="1.2" opacity="0.3"/>
      {/* Blossoms at different points */}
      {[[26,54],[42,42],[58,36]].map(([cx,cy], i) => (
      <g key={i}>
      {[0,72,144,216,288].map((a) => (
      <ellipse key={a} cx={cx} cy={(cy as number)-5} rx="3" ry="6"
      transform={`rotate(${a} ${cx} ${cy})`}
      stroke="currentColor" strokeWidth="0.6" fill="currentColor" fillOpacity="0.06"/>
      ))}
      <circle cx={cx} cy={cy} r="2" fill="currentColor" fillOpacity="0.12"/>
      </g>
      ))}
      </g>
    </symbol>
  </svg>
  );
}

/** A single flower instance — one <use> node, tinted via currentColor. */
export const Flower = memo(function Flower({
  flowerId, size = 48, className = '', color,
}: FlowerProps & { flowerId: string }) {
  const metaEntry = FLOWER_MAP.get(flowerId);
  if (!metaEntry) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      className={className}
      style={{ color: color || metaEntry.defaultColor }}
      fill="none"
      aria-hidden="true"
    >
      <use href={`#coh-flower-${flowerId}`} />
    </svg>
  );
});

export const RoseFlower = (props: FlowerProps) => <Flower flowerId="rose" {...props} />;
export const HibiscusFlower = (props: FlowerProps) => <Flower flowerId="hibiscus" {...props} />;
export const LilyFlower = (props: FlowerProps) => <Flower flowerId="lily" {...props} />;
export const DaisyFlower = (props: FlowerProps) => <Flower flowerId="daisy" {...props} />;
export const TulipFlower = (props: FlowerProps) => <Flower flowerId="tulip" {...props} />;
export const PeonyFlower = (props: FlowerProps) => <Flower flowerId="peony" {...props} />;
export const ForgetMeNotFlower = (props: FlowerProps) => <Flower flowerId="forget-me-not" {...props} />;
export const LavenderFlower = (props: FlowerProps) => <Flower flowerId="lavender" {...props} />;
export const WildRoseFlower = (props: FlowerProps) => <Flower flowerId="wild-rose" {...props} />;
export const IvyVine = (props: FlowerProps) => <Flower flowerId="ivy" {...props} />;
export const SunFlower = (props: FlowerProps) => <Flower flowerId="sunflower" {...props} />;
export const CherryBlossomFlower = (props: FlowerProps) => <Flower flowerId="cherry-blossom" {...props} />;
