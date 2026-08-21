import { useState, useEffect, useCallback } from 'react';

export type Route =
  | { page: 'home' }
  | { page: 'compose' }
  | { page: 'preview'; slug: string }
  | { page: 'read'; slug: string }
  | { page: 'my-letters' }
  | { page: 'shared'; slug: string }
  | { page: 'privacy' }
  | { page: 'thanks' };

function parseRoute(hash: string): Route {
  const cleaned = hash.replace(/^#\/?/, '');
  if (!cleaned || cleaned === '/') return { page: 'home' };
  if (cleaned === 'compose') return { page: 'compose' };
  if (cleaned === 'my-letters') return { page: 'my-letters' };
  if (cleaned === 'privacy') return { page: 'privacy' };
  if (cleaned === 'thanks') return { page: 'thanks' };
  if (cleaned.startsWith('preview/')) return { page: 'preview', slug: cleaned.split('/')[1] };
  if (cleaned.startsWith('read/')) return { page: 'read', slug: cleaned.split('/')[1] };
  if (cleaned.startsWith('letter/')) return { page: 'shared', slug: cleaned.split('/')[1] };
  return { page: 'home' };
}

/**
 * Adopt clean path URLs (/letter/<slug>, /privacy, /thanks) into the hash
 * router. nginx (and the Pages 404 shim) serve the SPA for these paths; old
 * #/letter/<slug> links keep working unchanged.
 */
function adoptPathRoute(): void {
  const path = window.location.pathname;
  const match = /^(?:\/[^/]+)?\/(letter\/[A-Za-z0-9_-]+|privacy|thanks)\/?$/.exec(path);
  if (match && !window.location.hash) {
    window.history.replaceState(null, '', `${import.meta.env.BASE_URL || '/'}#/${match[1]}`);
  }
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(() => {
    adoptPathRoute();
    return parseRoute(window.location.hash);
  });

  useEffect(() => {
    const handler = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = useCallback((path: string) => {
    window.location.hash = path;
  }, []);

  return { route, navigate };
}
