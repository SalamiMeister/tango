// Kern der Synchronisation (pur, ohne Netzwerk/Datenbank → gut testbar).
// Regel: pro Datensatz gewinnt der neueste Stand (updated_at). Gelöschte Einträge
// bleiben als „deleted: true“ erhalten, damit sie nicht zurückkehren.

import type { Passage, Review, SettingsRecord, Word } from '../types';
import { recordsToApply } from '../lib/merge';

/** Inhalt der Sync-Datei (gleiches Format wie das JSON-Backup). */
export interface Snapshot {
  app: 'tango';
  format: 1;
  exported_at: string;
  words: Word[];
  reviews: Review[];
  passages: Passage[];
  settings: SettingsRecord[];
}

export interface SyncPlan {
  /** Datensätze aus der Cloud, die lokal geschrieben werden müssen */
  toLocal: Pick<Snapshot, 'words' | 'reviews' | 'passages' | 'settings'>;
  /** Hat das Gerät etwas, das die Cloud noch nicht hat? → hochladen */
  needsUpload: boolean;
}

const byId = (r: { id: string }) => r.id;
const byKey = (r: { key: string }) => r.key;

export function planSync(local: Snapshot, remote: Snapshot | null): SyncPlan {
  const r = remote ?? { words: [], reviews: [], passages: [], settings: [] };
  const toLocal = {
    words: recordsToApply(local.words, r.words ?? [], byId),
    reviews: recordsToApply(local.reviews, r.reviews ?? [], byId),
    passages: recordsToApply(local.passages, r.passages ?? [], byId),
    settings: recordsToApply(local.settings, r.settings ?? [], byKey),
  };
  const needsUpload =
    !remote ||
    recordsToApply(r.words ?? [], local.words, byId).length > 0 ||
    recordsToApply(r.reviews ?? [], local.reviews, byId).length > 0 ||
    recordsToApply(r.passages ?? [], local.passages, byId).length > 0 ||
    recordsToApply(r.settings ?? [], local.settings, byKey).length > 0;
  return { toLocal, needsUpload };
}

/** Ist das eine gültige Sync-/Backup-Datei? */
export function isSnapshot(x: unknown): x is Snapshot {
  const s = x as Partial<Snapshot>;
  return !!s && s.app === 'tango' && Array.isArray(s.words) && Array.isArray(s.reviews);
}
