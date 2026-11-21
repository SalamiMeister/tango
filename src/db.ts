// Lokale Datenbank (IndexedDB im Browser) über Dexie.js.
// Die Daten bleiben auf dem Gerät. Jede Tabelle hat updated_at + deleted für den späteren Sync.

import Dexie, { type Table } from 'dexie';
import type { Passage, Review, SettingsRecord, Word } from './types';

export class TangoDB extends Dexie {
  words!: Table<Word, string>;
  reviews!: Table<Review, string>;
  passages!: Table<Passage, string>;
  settings!: Table<SettingsRecord, string>;

  constructor() {
    super('tango');
    // Nur Felder, nach denen gesucht/sortiert wird, stehen hier als Index.
    // Bei Änderungen am Schema: neue version(2) hinzufügen, version(1) nicht ändern!
    this.version(1).stores({
      words: 'id, kana, kanji, lesson, updated_at, created_at, *tags',
      reviews: 'id, word_id, due, updated_at',
      passages: 'id, updated_at',
      settings: 'key',
    });
  }
}

export const db = new TangoDB();
