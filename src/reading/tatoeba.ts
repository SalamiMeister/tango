// Beispielsätze von Tatoeba (CC BY 2.0 FR). Die Datei wird auf Wunsch geladen und vom
// Service Worker gespeichert; im Speicher bleibt sie, solange die App offen ist.

import type { Token } from '../types';

export interface ExampleSentence {
  id: number;
  ja: string;
  jaUser: string;
  deId: number;
  de: string;
  deUser: string;
  tokens: Token[];
}

type RawSentence = [number, string, string, number, string, string, Token[]];

const url = () => `${import.meta.env.BASE_URL}data/tatoeba.json`;
let cache: Promise<ExampleSentence[]> | null = null;

export function loadExamples(): Promise<ExampleSentence[]> {
  if (!cache) {
    cache = fetch(url())
      .then((r) => {
        if (!r.ok) throw new Error(`Beispielsätze nicht ladbar (Fehler ${r.status})`);
        return r.json() as Promise<{ sentences: RawSentence[] }>;
      })
      .then((d) =>
        d.sentences.map(([id, ja, jaUser, deId, de, deUser, tokens]) => ({ id, ja, jaUser, deId, de, deUser, tokens })),
      )
      .catch((e) => {
        cache = null;
        throw e;
      });
  }
  return cache;
}

/** Schon heruntergeladen (im Offline-Speicher)? */
export async function examplesCached(): Promise<boolean> {
  if (cache) return true;
  try {
    return !!(await caches.match(url()));
  } catch {
    return false;
  }
}

export function tatoebaLink(id: number): string {
  return `https://tatoeba.org/de/sentences/show/${id}`;
}
