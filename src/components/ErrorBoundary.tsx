// Final safety net so a rendering error can never leave a blank white page.
// (The real fixes are elsewhere — memoized flowers, imperative editor DOM —
// this simply guarantees a graceful parchment-styled fallback.)
import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    // No letter content is ever included here.
    console.error('CourierOfHearts render error:', error.message);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen parchment-bg flex items-center justify-center px-6">
        <div className="letter-paper rounded-sm p-10 md:p-14 max-w-md w-full text-center">
          <p className="font-display text-2xl text-ink/85 mb-3">The ink smudged for a moment</p>
          <p className="font-body text-[15px] text-ink/60 mb-8 leading-relaxed">
            Something went wrong while drawing this page. Your letter is safe — reload to continue.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="font-heading text-[11px] tracking-[0.15em] uppercase py-3 px-8 bg-ink text-parchment-light rounded-sm hover:bg-ink-light transition-all duration-500"
          >
            Reload the page
          </button>
        </div>
      </div>
    );
  }
}
