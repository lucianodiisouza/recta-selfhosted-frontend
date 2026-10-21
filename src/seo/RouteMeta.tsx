import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { metaForPath, SITE_URL } from './pageMeta';

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

/** Keeps the document head in sync with the current route (see pageMeta.ts). */
export const RouteMeta = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = metaForPath(pathname);
    const url = SITE_URL + (meta.canonicalPath ?? pathname);

    document.title = meta.title;
    setMeta('meta[name="description"]', 'name', 'description', meta.description);
    setMeta('meta[name="robots"]', 'name', 'robots', meta.noindex ? 'noindex, follow' : 'index, follow');
    setMeta('meta[property="og:title"]', 'property', 'og:title', meta.title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', meta.description);
    setMeta('meta[property="og:url"]', 'property', 'og:url', url);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', meta.title);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', meta.description);
    setMeta('meta[name="twitter:url"]', 'name', 'twitter:url', url);

    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (meta.canonicalPath) {
      if (canonical) canonical.href = url;
      else {
        const link = document.createElement('link');
        link.rel = 'canonical';
        link.href = url;
        document.head.appendChild(link);
      }
    } else {
      canonical?.remove();
    }
  }, [pathname]);

  return null;
};
