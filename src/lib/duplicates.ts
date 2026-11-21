// Duplikaterkennung und Import-Planung (pur, ohne Datenbank).
// Duplikat = gleiche Kana UND gleiches Kanji (kein Kanji zählt als leer).

import type { Word, WordDraft } from '../types';
import { dedupe, kanaToRomaji } from './text';
import { uuid } from './uuid';

export type DuplicateStrategy = 'skip' | 'merge' | 'create';

export const DUPLICATE_LABELS: Record<DuplicateStrategy, string> = {
  skip: 'überspringen',
  merge: 'zusammenführen',
  create: 'trotzdem anlegen',
};

export function dupKey(kana: string, kanji?: string): string {
  return `${kana.trim()}|${(kanji ?? '').trim()}`;
}

/** Erzeugt aus einem Entwurf ein vollständiges Word-Objekt. */
export function draftToWord(draft: WordDraft, now: number): Word {
  return {
    id: uuid(),
    kana: draft.kana.trim(),
    kanji: draft.kanji?.trim() || undefined,
    romaji: draft.romaji?.trim() || kanaToRomaji(draft.kana.trim()),
    meaning_de: draft.meaning_de,
    part_of_speech: draft.part_of_speech,
    source: draft.source?.trim() || undefined,
    lesson: draft.lesson,
    tags: draft.tags ?? [],
    note: draft.note?.trim() || undefined,
    active: draft.active ?? true,
    created_at: now,
    updated_at: now,
    deleted: false,
  };
}

/**
 * Führt einen Entwurf in eine vorhandene Vokabel zusammen:
 * Bedeutungen und Tags werden vereinigt, leere Felder werden gefüllt.
 */
export function mergeWordInto(existing: Word, draft: WordDraft, now: number): Word {
  return {
    ...existing,
    meaning_de: dedupe([...existing.meaning_de, ...draft.meaning_de]),
    tags: dedupe([...existing.tags, ...(draft.tags ?? [])]),
    romaji: existing.romaji || draft.romaji,
    part_of_speech: existing.part_of_speech ?? draft.part_of_speech,
    source: existing.source || draft.source,
    lesson: existing.lesson ?? draft.lesson,
    note: existing.note || draft.note,
    updated_at: now,
  };
}

export type RowPlan =
  | { kind: 'new'; word: Word }
  | { kind: 'duplicate-skip'; existing: Word }
  | { kind: 'duplicate-merge'; existing: Word; merged: Word }
  | { kind: 'duplicate-create'; existing: Word; word: Word };

export interface ImportPlan {
  rows: RowPlan[];
  /** Neu anzulegende Wörter */
  create: Word[];
  /** Zu aktualisierende Wörter (zusammengeführt) */
  update: Word[];
  skipped: number;
}

/**
 * Plant einen Import: Welche Einträge sind neu, welche Duplikate, was passiert damit?
 * Duplikate innerhalb des Imports selbst werden genauso behandelt wie Duplikate
 * vorhandener Vokabeln.
 */
export function planImport(
  drafts: WordDraft[],
  existingWords: Word[],
  strategy: DuplicateStrategy,
  now: number,
): ImportPlan {
  const byKey = new Map<string, Word>();
  for (const w of existingWords) {
    if (!w.deleted) byKey.set(dupKey(w.kana, w.kanji), w);
  }
  const created = new Map<string, Word>(); // id → neues Wort
  const updated = new Map<string, Word>(); // id → zusammengeführtes Wort
  const rows: RowPlan[] = [];
  let skipped = 0;

  // created_at steigt pro Zeile um 1 ms, damit die Reihenfolge der Tabelle erhalten bleibt
  // (neue Karten werden in dieser Reihenfolge eingeführt).
  const newWord = (draft: WordDraft) => ({ ...draftToWord(draft, now), created_at: now + rows.length });

  for (const draft of drafts) {
    const key = dupKey(draft.kana, draft.kanji);
    const existing = byKey.get(key);
    if (!existing) {
      const word = newWord(draft);
      byKey.set(key, word);
      created.set(word.id, word);
      rows.push({ kind: 'new', word });
      continue;
    }
    if (strategy === 'skip') {
      skipped++;
      rows.push({ kind: 'duplicate-skip', existing });
    } else if (strategy === 'merge') {
      const merged = mergeWordInto(existing, draft, now);
      byKey.set(key, merged);
      if (created.has(merged.id)) created.set(merged.id, merged);
      else updated.set(merged.id, merged);
      rows.push({ kind: 'duplicate-merge', existing, merged });
    } else {
      const word = newWord(draft);
      created.set(word.id, word);
      rows.push({ kind: 'duplicate-create', existing, word });
    }
  }
  return { rows, create: [...created.values()], update: [...updated.values()], skipped };
}

/** Findet eine vorhandene (nicht gelöschte) Vokabel mit gleicher Kana + Kanji. */
export function findDuplicate(words: Word[], kana: string, kanji?: string, ignoreId?: string): Word | undefined {
  const key = dupKey(kana, kanji);
  return words.find((w) => !w.deleted && w.id !== ignoreId && dupKey(w.kana, w.kanji) === key);
}
