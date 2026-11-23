// Lokale Datenbank (IndexedDB im Browser) über Dexie.js.
// Die Daten bleiben auf dem Gerät. Jede synchronisierte Tabelle hat updated_at + deleted.

import Dexie, { type Table } from 'dexie';
import type { DictEntry, Passage, Review, SettingsRecord, Word } from './types';

export interface MetaRecord {
  key: string;
  value: unknown;
}

export class TangoDB extends Dexie {
  words!: Table<Word, string>;
  reviews!: Table<Review, string>;
  passages!: Table<Passage, string>;
  settings!: Table<SettingsRecord, string>;
  /** Hintergrund-Wörterbuch (nur lesen, nicht synchronisiert) */
  dict!: Table<DictEntry, number>;
  /** Technische Infos, z. B. welche Wörterbuch-Version installiert ist (nicht synchronisiert) */
  meta!: Table<MetaRecord, string>;

  constructor() {
    super('tango');
    // Nur Felder, nach denen gesucht/sortiert wird, stehen hier als Index.
    // Bei Änderungen am Schema: neue version(n) hinzufügen, alte nicht ändern!
    this.version(1).stores({
      words: 'id, kana, kanji, lesson, updated_at, created_at, *tags',
      reviews: 'id, word_id, due, updated_at',
      passages: 'id, updated_at',
      settings: 'key',
    });
    // Stufe 3: Wörterbuch
    this.version(2).stores({
      dict: '++id, *forms, pack',
      meta: 'key',
    });
  }
}

export const db = new TangoDB();
