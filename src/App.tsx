import { useRouter } from '@/hooks/useRouter';
import LandingPage from '@/components/pages/LandingPage';
import ComposePage from '@/components/pages/ComposePage';
import DeliveryPage from '@/components/pages/DeliveryPage';
import LetterSentPage from '@/components/pages/LetterSentPage';
import MyLettersPage from '@/components/pages/MyLettersPage';
import PrivacyPage from '@/components/pages/PrivacyPage';
import ThanksPage from '@/components/pages/ThanksPage';
import { FlowerDefs } from '@/components/icons/FlowerSvgs';
import { EmojiDefs } from '@/utils/emojiEngrave';
import { isDemoMode } from '@/services/demoApi';

function DemoRibbon() {
  if (!isDemoMode) return null;
  return (
    <div className="no-print fixed bottom-3 left-1/2 -translate-x-1/2 z-[90] px-4 py-1.5 rounded-sm pointer-events-none"
      style={{ background: 'rgba(26,18,8,0.82)', backdropFilter: 'blur(4px)' }}>
      <span className="font-heading text-[9px] tracking-[0.2em] uppercase text-parchment-light/80">
        Demo preview — letters stay in this browser only
      </span>
    </div>
  );
}

export default function App() {
  const { route, navigate } = useRouter();
  const goHome = () => navigate('/');

  let page: React.ReactNode;
  switch (route.page) {
    case 'compose':
      page = <ComposePage onLetterCreated={(slug) => navigate(`/preview/${slug}`)} onBack={goHome} />;
      break;
    case 'preview':
      page = <LetterSentPage slug={route.slug} onBack={() => navigate('/compose')} onPreview={(slug) => navigate(`/read/${slug}`)} />;
      break;
    case 'read':
    case 'shared':
      page = <DeliveryPage slug={route.slug} onBack={goHome} />;
      break;
    case 'my-letters':
      page = <MyLettersPage onBack={goHome} onCompose={() => navigate('/compose')} onPreview={(slug) => navigate(`/read/${slug}`)} />;
      break;
    case 'privacy':
      page = <PrivacyPage onBack={goHome} />;
      break;
    case 'thanks':
      page = <ThanksPage onBack={goHome} />;
      break;
    default:
      page = <LandingPage onCompose={() => navigate('/compose')} onMyLetters={() => navigate('/my-letters')} onPrivacy={() => navigate('/privacy')} onThanks={() => navigate('/thanks')} />;
  }

  return (
    <>
      {/* Shared SVG definitions: flowers + emoji engravings, mounted once. */}
      <FlowerDefs />
      <EmojiDefs />
      {page}
      <DemoRibbon />
    </>
  );
}
