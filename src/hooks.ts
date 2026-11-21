// React-Hooks, die Daten live aus der Datenbank lesen.
// useLiveQuery aktualisiert die Oberfläche automatisch, wenn sich Daten ändern.

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { DEFAULT_SETTINGS, type Review, type Settings, type Word } from './types';

/** Alle nicht gelöschten Vokabeln (undefined, solange noch geladen wird). */
export function useWords(): Word[] | undefined {
  return useLiveQuery(async () => (await db.words.toArray()).filter((w) => !w.deleted), []);
}

/** Alle nicht gelöschten Lernstände. */
export function useReviews(): Review[] | undefined {
  return useLiveQuery(async () => (await db.reviews.toArray()).filter((r) => !r.deleted), []);
}

export function useSettings(): Settings {
  const rec = useLiveQuery(() => db.settings.get('main'), []);
  return { ...DEFAULT_SETTINGS, ...(rec?.value ?? {}) };
}
