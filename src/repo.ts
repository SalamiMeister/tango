// Alle Lese-/Schreibzugriffe auf die Datenbank an einer Stelle.
// Die Oberfläche ruft nur diese Funktionen auf, nie direkt db.words.put(...).

import { db } from './db';
import {
  DEFAULT_SETTINGS,
  type Passage,
  type Review,
  type Settings,
  type SettingsRecord,
  type Word,
  type WordDraft,
} from './types';
import { draftToWord, planImport, type DuplicateStrategy, type ImportPlan } from './lib/duplicates';
import { newReview } from './lib/fsrs';
import { recordsToApply } from './lib/merge';
import { kanaToRomaji } from './lib/text';

/** Für jedes Wort beide Richtungen anlegen (falls noch nicht vorhanden). */
function reviewsFor(word: Word, now: number): Review[] {
  return [newReview(word.id, 'jp_de', now), newReview(word.id, 'de_jp', now)];
}

// ---------------------------------------------------------------- Vokabeln

export async function addWord(draft: WordDraft): Promise<Word> {
  const now = Date.now();
  const word = draftToWord(draft, now);
  await db.transaction('rw', db.words, db.reviews, async () => {
    await db.words.add(word);
    await db.reviews.bulkAdd(reviewsFor(word, now));
  });
  return word;
}

export async function updateWord(id: string, draft: WordDraft): Promise<void> {
  const existing = await db.words.get(id);
  if (!existing) return;
  await db.words.put({
    ...existing,
    kana: draft.kana.trim(),
    kanji: draft.kanji?.trim() || undefined,
    romaji: draft.romaji?.trim() || kanaToRomaji(draft.kana.trim()),
    meaning_de: draft.meaning_de,
    part_of_speech: draft.part_of_speech,
    source: draft.source?.trim() || undefined,
    lesson: draft.lesson,
    tags: draft.tags,
    note: draft.note?.trim() || undefined,
    active: draft.active ?? existing.active,
    updated_at: Date.now(),
  });
}

/** Ändert mehrere Wörter auf einmal (Massenbearbeitung). */
export async function bulkPatchWords(ids: string[], patch: (w: Word) => Partial<Word>): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.words, async () => {
    const words = (await db.words.bulkGet(ids)).filter((w): w is Word => !!w);
    await db.words.bulkPut(words.map((w) => ({ ...w, ...patch(w), updated_at: now })));
  });
}

/** Weiches Löschen (Wort + Lernstände). Gibt eine Funktion zum Rückgängigmachen zurück. */
export async function softDeleteWords(ids: string[]): Promise<() => Promise<void>> {
  const setDeleted = async (deleted: boolean) => {
    const now = Date.now();
    await db.transaction('rw', db.words, db.reviews, async () => {
      const words = (await db.words.bulkGet(ids)).filter((w): w is Word => !!w);
      await db.words.bulkPut(words.map((w) => ({ ...w, deleted, updated_at: now })));
      const reviews = await db.reviews.where('word_id').anyOf(ids).toArray();
      await db.reviews.bulkPut(reviews.map((r) => ({ ...r, deleted, updated_at: now })));
    });
  };
  await setDeleted(true);
  return () => setDeleted(false);
}

/** Import ausführen (Plan vorher mit planImport/previewImport erstellen). */
export async function applyImport(plan: ImportPlan): Promise<void> {
  const now = Date.now();
  await db.transaction('rw', db.words, db.reviews, async () => {
    await db.words.bulkPut([...plan.create, ...plan.update]);
    await db.reviews.bulkPut(plan.create.flatMap((w) => reviewsFor(w, now)));
  });
}

export async function previewImport(drafts: WordDraft[], strategy: DuplicateStrategy): Promise<ImportPlan> {
  const existing = await db.words.toArray();
  return planImport(drafts, existing, strategy, Date.now());
}

// ---------------------------------------------------------------- Lernstände

export async function saveReview(r: Review): Promise<void> {
  await db.reviews.put(r);
}

// ---------------------------------------------------------------- Einstellungen

export async function loadSettings(): Promise<Settings> {
  const rec = await db.settings.get('main');
  return { ...DEFAULT_SETTINGS, ...(rec?.value ?? {}) };
}

export async function saveSettings(value: Settings): Promise<void> {
  await db.settings.put({ key: 'main', value, updated_at: Date.now(), deleted: false });
}

// ---------------------------------------------------------------- Backup (JSON)

export interface BackupFile {
  app: 'tango';
  format: 1;
  exported_at: string;
  words: Word[];
  reviews: Review[];
  passages: unknown[];
  settings: unknown[];
}

export async function exportBackup(): Promise<BackupFile> {
  const [words, reviews, passages, settings] = await Promise.all([
    db.words.toArray(),
    db.reviews.toArray(),
    db.passages.toArray(),
    db.settings.toArray(),
  ]);
  return { app: 'tango', format: 1, exported_at: new Date().toISOString(), words, reviews, passages, settings };
}

export interface BackupResult {
  words: number;
  reviews: number;
  settings: number;
}

/**
 * Spielt ein Backup ein, OHNE vorhandene Daten zu löschen: Pro Datensatz
 * gewinnt der neuere Stand (wie später beim Sync).
 */
export async function importBackup(data: unknown): Promise<BackupResult> {
  const file = data as Partial<BackupFile>;
  if (!file || file.app !== 'tango' || !Array.isArray(file.words) || !Array.isArray(file.reviews)) {
    throw new Error('Das ist keine gültige Tango-Backup-Datei.');
  }
  const result: BackupResult = { words: 0, reviews: 0, settings: 0 };
  await db.transaction('rw', [db.words, db.reviews, db.passages, db.settings], async () => {
    const words = recordsToApply(await db.words.toArray(), file.words!, (w) => w.id);
    const reviews = recordsToApply(await db.reviews.toArray(), file.reviews!, (r) => r.id);
    const settings = recordsToApply(
      await db.settings.toArray(),
      (file.settings ?? []) as SettingsRecord[],
      (s) => s.key,
    );
    const passages = recordsToApply(await db.passages.toArray(), (file.passages ?? []) as Passage[], (p) => p.id);
    await db.words.bulkPut(words);
    await db.reviews.bulkPut(reviews);
    await db.settings.bulkPut(settings);
    await db.passages.bulkPut(passages);
    result.words = words.length;
    result.reviews = reviews.length;
    result.settings = settings.length;
  });
  return result;
}

// ---------------------------------------------------------------- Lesetexte

export async function savePassage(p: Passage): Promise<void> {
  await db.passages.put({ ...p, updated_at: Date.now() });
}

/** Weiches Löschen eines Lesetextes. Gibt eine Funktion zum Rückgängigmachen zurück. */
export async function softDeletePassage(id: string): Promise<() => Promise<void>> {
  const set = async (deleted: boolean) => {
    const p = await db.passages.get(id);
    if (p) await db.passages.put({ ...p, deleted, updated_at: Date.now() });
  };
  await set(true);
  return () => set(false);
}
