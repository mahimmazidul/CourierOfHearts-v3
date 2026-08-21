import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description?: string;
  robots?: string;
}

const DEFAULT_TITLE = 'The Courier of Hearts — Send a Letter Worth Keeping';
const DEFAULT_DESCRIPTION = 'Write beautiful medieval letters. Seal them with wax. Send them to the one you love.';

function setMetaTag(name: string, content: string | null) {
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!content) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

/** Per-page <title>/description/robots. Letter pages set robots noindex. */
export function usePageMeta({ title, description, robots }: PageMeta) {
  useEffect(() => {
    document.title = title;
    setMetaTag('description', description || DEFAULT_DESCRIPTION);
    if (robots) setMetaTag('robots', robots);
    return () => {
      document.title = DEFAULT_TITLE;
      setMetaTag('description', DEFAULT_DESCRIPTION);
      setMetaTag('robots', null);
    };
  }, [title, description, robots]);
}
