// Ganz einfacher „Router“ über den Teil der Adresse nach dem # (z. B. #/vokabeln).
// Vorteil: funktioniert auf GitHub Pages ohne Server-Konfiguration und offline.

import { useEffect, useState } from 'react';

export interface Route {
  /** Pfadteile, z. B. ["vokabeln", "abc-123"] */
  parts: string[];
  /** Query-Parameter, z. B. ?lektion=3 */
  query: URLSearchParams;
}

function parse(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, q = ''] = raw.split('?');
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path: string): void {
  window.location.hash = path.startsWith('#') ? path : `#${path}`;
}
