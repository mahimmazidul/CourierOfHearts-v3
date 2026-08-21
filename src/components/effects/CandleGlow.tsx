import { useEffect, useState } from 'react';

export default function CandleGlow() {
  const [flicker, setFlicker] = useState(0.6);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const interval = setInterval(() => {
      setFlicker(0.4 + Math.random() * 0.3);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
      style={{
        background: `radial-gradient(ellipse 600px 400px at 80% 20%, rgba(160, 130, 60, ${flicker * 0.1}) 0%, transparent 70%),
                     radial-gradient(ellipse 400px 300px at 20% 80%, rgba(160, 130, 60, ${flicker * 0.06}) 0%, transparent 70%)`,
        transition: 'background 0.3s ease',
      }}
    />
  );
}
