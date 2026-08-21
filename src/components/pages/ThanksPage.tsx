import { HeartSigilIcon, OrnamentDivider, RoseIcon } from '@/components/icons/SvgIcons';
import { usePageMeta } from '@/hooks/usePageMeta';

export default function ThanksPage({ onBack }: { onBack: () => void }) {
  usePageMeta({
    title: 'Special Thanks — Courier of Hearts',
    description: 'A small thank-you note for Maria and the warmth she helped bring into the details of the project.',
    robots: 'index,follow',
  });

  return (
    <div className="min-h-screen parchment-bg flex items-center justify-center px-6 py-10">
      <article className="letter-paper rounded-sm max-w-2xl w-full px-6 py-8 md:px-10 md:py-12 text-center relative overflow-hidden">
        <div className="absolute top-4 left-4 opacity-20"><RoseIcon size={20} color="#8A1538" /></div>
        <div className="absolute bottom-4 right-4 opacity-20"><HeartSigilIcon size={20} color="#6B1025" /></div>
        <div className="mb-4 flex justify-center opacity-45"><HeartSigilIcon size={34} color="#6B1025" /></div>
        <h1 className="font-display text-3xl md:text-4xl text-ink/88 mb-2">Special Thanks</h1>
        <p className="font-body text-[15px] md:text-[16px] text-ink/56 italic mb-5">A small note folded beside the others.</p>
        <OrnamentDivider className="w-44 mx-auto mb-7" color="#8b7340" />

        <div className="space-y-5 text-left max-w-xl mx-auto">
          <p className="font-body text-[16px] text-ink/72 leading-[1.95]">
            To <span className="text-burgundy/85">Maria</span> — thank you for the ideas, the softness, the noticing, and the little instincts that made this letter-world gentler than it would have been on its own.
          </p>
          <p className="font-body text-[16px] text-ink/68 leading-[1.95]">
            Some of the sweetest touches in this project came from imagining what would make someone feel more held, more seen, and more loved when they open a letter. Thank you for helping that feeling find its way onto the page.
          </p>
          <p className="font-body text-[16px] text-ink/68 leading-[1.95] italic">
            A quiet thank-you, pressed between parchment and wax.
          </p>
        </div>

        <div className="mt-8">
          <button onClick={onBack} className="font-heading text-[10px] tracking-[0.15em] uppercase py-3 px-8 bg-ink text-parchment-light rounded-sm hover:bg-ink-light transition-all duration-500">Back Home</button>
        </div>
      </article>
    </div>
  );
}
