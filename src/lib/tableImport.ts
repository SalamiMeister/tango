// Einlesen von Tabellen-Text (aus Excel/Google Sheets kopiert) und CSV-Dateien.
// Ablauf: Text → Zeilen/Spalten (parseTable) → Spalten erraten (guessMapping)
//         → Vokabel-Entwürfe (rowsToDrafts).
// Alles hier ist „pur“ (keine Datenbank), deshalb gut testbar.

import { PARTS_OF_SPEECH, type PartOfSpeech, type WordDraft } from '../types';
import {
  dedupe,
  hasKanji,
  hasLatin,
  isKanaOnly,
  kanaToRomaji,
  parseLesson,
  romajiToKana,
  splitMeanings,
  splitTags,
} from './text';

export type Delimiter = '\t' | ';' | ',';

export type ColumnField =
  | 'ignore'
  | 'kana'
  | 'kanji'
  | 'romaji'
  | 'meaning'
  | 'pos'
  | 'source'
  | 'lesson'
  | 'tags'
  | 'note';

export const COLUMN_LABELS: Record<ColumnField, string> = {
  ignore: '– ignorieren –',
  kana: 'Kana (Lesung)',
  kanji: 'Kanji',
  romaji: 'Romaji',
  meaning: 'Bedeutung (Deutsch)',
  pos: 'Wortart',
  source: 'Quelle',
  lesson: 'Lektion',
  tags: 'Tags',
  note: 'Notiz',
};

// ---------------------------------------------------------------------------
// 1. Trennzeichen erkennen und Text zerlegen
// ---------------------------------------------------------------------------

/**
 * Erkennt das Trennzeichen. Bevorzugt wird das Zeichen, das in jeder Zeile
 * gleich oft vorkommt (Reihenfolge: Tabulator, Semikolon, Komma).
 */
export function detectDelimiter(text: string): Delimiter {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 20);
  const candidates: Delimiter[] = ['\t', ';', ','];
  let best: Delimiter = '\t';
  let bestTotal = 0;
  for (const d of candidates) {
    const counts = lines.map((l) => l.split(d).length - 1);
    const total = counts.reduce((a, b) => a + b, 0);
    const consistent = counts.length > 0 && counts[0] > 0 && counts.every((c) => c === counts[0]);
    if (consistent) return d;
    if (total > bestTotal) {
      best = d;
      bestTotal = total;
    }
  }
  return best;
}

/**
 * Zerlegt Text in Zeilen und Spalten. Unterstützt Anführungszeichen wie in CSV
 * ("a; b" bleibt eine Zelle, "" steht für ein einzelnes Anführungszeichen).
 * Leere Zeilen werden entfernt, Zellen werden getrimmt.
 */
export function parseTable(text: string, delimiter: Delimiter): string[][] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"' && field.trim() === '') {
      inQuotes = true;
      field = '';
    } else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((f) => f.trim())).filter((r) => r.some((f) => f !== ''));
}

// ---------------------------------------------------------------------------
// 2. Spalten zuordnen
// ---------------------------------------------------------------------------

const HEADER_ALIASES: Record<Exclude<ColumnField, 'ignore'>, string[]> = {
  kana: ['kana', 'lesung', 'hiragana', 'katakana', 'reading', 'yomi', 'よみ', 'かな', 'japanisch', 'japanese'],
  kanji: ['kanji', '漢字', 'schreibweise', 'schrift'],
  romaji: ['romaji', 'rōmaji', 'romanji', 'umschrift'],
  meaning: ['bedeutung', 'bedeutungen', 'deutsch', 'übersetzung', 'meaning', 'german', 'english', 'englisch', 'de'],
  pos: ['wortart', 'pos', 'typ', 'art', 'partofspeech'],
  source: ['quelle', 'source', 'buch'],
  lesson: ['lektion', 'lesson', 'kapitel', 'lek', 'l'],
  tags: ['tags', 'tag', 'schlagwörter', 'schlagworte'],
  note: ['notiz', 'notizen', 'note', 'notes', 'bemerkung', 'beispiel', 'eselsbrücke', 'kommentar'],
};

function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/[\s._\-:()]/g, '');
}

/** Ordnet eine Überschrift einem Feld zu (oder null). */
export function headerToField(cell: string): ColumnField | null {
  const n = normalizeHeader(cell);
  if (!n) return null;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(n)) return field as ColumnField;
  }
  return null;
}

/** Ist die erste Zeile eine Überschriftenzeile? (mind. die Hälfte der Zellen bekannt) */
export function looksLikeHeader(row: string[]): boolean {
  const known = row.filter((c) => headerToField(c) !== null).length;
  return known > 0 && known >= Math.ceil(row.filter((c) => c).length / 2);
}

/** Zuordnung aus der Überschriftenzeile. */
export function mappingFromHeader(row: string[]): ColumnField[] {
  const used = new Set<ColumnField>();
  return row.map((c) => {
    const f = headerToField(c);
    // Bedeutung und Tags dürfen mehrfach vorkommen, alles andere nur einmal.
    if (!f || (used.has(f) && f !== 'meaning' && f !== 'tags')) return 'ignore';
    used.add(f);
    return f;
  });
}

/** Rät die Spalten anhand des Inhalts (wenn es keine Überschrift gibt). */
export function guessMappingFromContent(rows: string[][]): ColumnField[] {
  const colCount = Math.max(0, ...rows.map((r) => r.length));
  const sample = rows.slice(0, 50);
  const mapping: ColumnField[] = Array(colCount).fill('ignore');

  // Anteil der nicht-leeren Zellen einer Spalte, die eine Bedingung erfüllen
  const share = (col: number, test: (s: string) => boolean): number => {
    const cells = sample.map((r) => r[col] ?? '').filter((c) => c !== '');
    if (cells.length === 0) return 0;
    return cells.filter(test).length / cells.length;
  };

  const free = () => mapping.map((m, i) => (m === 'ignore' ? i : -1)).filter((i) => i >= 0);

  // Kana: Spalte mit dem höchsten Anteil reiner Kana
  const kanaCol = pickBest(free(), (c) => share(c, isKanaOnly), 0.6);
  if (kanaCol >= 0) mapping[kanaCol] = 'kana';

  // Kanji: Spalte mit vielen Kanji
  const kanjiCol = pickBest(free(), (c) => share(c, hasKanji), 0.3);
  if (kanjiCol >= 0) mapping[kanjiCol] = 'kanji';

  // Lektion: Spalte mit Zahlen
  const lessonCol = pickBest(free(), (c) => share(c, (s) => /^(l|lektion\s*)?\d{1,3}$/i.test(s)), 0.8);
  if (lessonCol >= 0) mapping[lessonCol] = 'lesson';

  // Romaji: lateinische Spalte, die zur Kana-Spalte passt
  if (kanaCol >= 0) {
    const romajiCol = pickBest(
      free(),
      (c) => {
        const hits = sample.filter((r) => {
          const k = r[kanaCol] ?? '';
          const v = r[c] ?? '';
          return v !== '' && k !== '' && normalizeRomaji(v) === normalizeRomaji(kanaToRomaji(k));
        }).length;
        const filled = sample.filter((r) => (r[c] ?? '') !== '').length;
        return filled ? hits / filled : 0;
      },
      0.6,
    );
    if (romajiCol >= 0) mapping[romajiCol] = 'romaji';
  }

  // Wortart: Spalte mit erkennbaren Wortarten
  const posCol = pickBest(free(), (c) => share(c, (s) => parsePartOfSpeech(s) !== undefined), 0.6);
  if (posCol >= 0) mapping[posCol] = 'pos';

  // Lateinische Spalten: ohne Kana-Spalte ist die erste davon Romaji, dann Bedeutung.
  const latinCols = free().filter((c) => share(c, hasLatin) >= 0.6);
  if (kanaCol < 0 && latinCols.length >= 2) {
    mapping[latinCols.shift()!] = 'romaji';
  }
  if (latinCols.length > 0) mapping[latinCols.shift()!] = 'meaning';
  if (latinCols.length > 0) mapping[latinCols.shift()!] = 'note';

  return mapping;
}

function pickBest(cols: number[], score: (c: number) => number, min: number): number {
  let best = -1;
  let bestScore = min - 1e-9;
  for (const c of cols) {
    const s = score(c);
    if (s > bestScore) {
      best = c;
      bestScore = s;
    }
  }
  return best;
}

function normalizeRomaji(s: string): string {
  return s
    .toLowerCase()
    .replace(/ā/g, 'aa')
    .replace(/ī/g, 'ii')
    .replace(/ū/g, 'uu')
    .replace(/ē/g, 'ee')
    .replace(/ō/g, 'ou')
    .replace(/[\s'’\-.]/g, '');
}

/** Ergebnis der Analyse: Trennzeichen, Kopfzeile ja/nein, Zuordnung. */
export interface TableAnalysis {
  delimiter: Delimiter;
  rows: string[][];
  hasHeader: boolean;
  mapping: ColumnField[];
}

/** Komplette automatische Analyse eines eingefügten Textes. */
export function analyzeTable(text: string, delimiter?: Delimiter): TableAnalysis {
  const d = delimiter ?? detectDelimiter(text);
  const rows = parseTable(text, d);
  const hasHeader = rows.length > 0 && looksLikeHeader(rows[0]);
  const colCount = Math.max(0, ...rows.map((r) => r.length));
  let mapping = hasHeader ? mappingFromHeader(rows[0]) : guessMappingFromContent(rows);
  // Bei Kopfzeile ohne erkannte Kana-Spalte: zusätzlich am Inhalt raten
  if (hasHeader && !mapping.includes('kana') && !mapping.includes('romaji')) {
    const guessed = guessMappingFromContent(rows.slice(1));
    mapping = mapping.map((m, i) => (m === 'ignore' ? guessed[i] ?? 'ignore' : m));
  }
  while (mapping.length < colCount) mapping.push('ignore');
  return { delimiter: d, rows, hasHeader, mapping };
}

// ---------------------------------------------------------------------------
// 3. Wortart erkennen
// ---------------------------------------------------------------------------

const POS_ALIASES: Record<PartOfSpeech, string[]> = {
  Nomen: ['nomen', 'n', 'noun', 'substantiv', 'subst', '名詞', 'meishi'],
  'u-Verb': ['uverb', 'u', 'uv', 'godan', 'v5', 'gruppe1'],
  'ru-Verb': ['ruverb', 'ru', 'ruv', 'ichidan', 'v1', 'gruppe2'],
  'irreg. Verb': ['irregverb', 'irregulärverb', 'irregularverb', 'irr', 'irrverb', 'irregulär', 'irregular', 'vs', 'suruverb', 'gruppe3'],
  'i-Adj.': ['iadj', 'iadjektiv', 'iadjective', 'adji', 'iadjektive'],
  'na-Adj.': ['naadj', 'naadjektiv', 'naadjective', 'adjna', 'naadjektive'],
  Adverb: ['adverb', 'adv'],
  Ausdruck: ['ausdruck', 'expr', 'expression', 'phrase', 'redewendung', 'exp'],
  Partikel: ['partikel', 'particle', 'prt', 'part'],
  Sonstiges: ['sonstiges', 'other', 'andere', 'sonst'],
};

/** „u-verb“, „U-Verb“, „godan“ … → „u-Verb“. Unbekannt → undefined. */
export function parsePartOfSpeech(s: string | undefined): PartOfSpeech | undefined {
  if (!s) return undefined;
  const n = s.toLowerCase().replace(/[\s.\-_()]/g, '');
  if (!n) return undefined;
  for (const pos of PARTS_OF_SPEECH) {
    if (POS_ALIASES[pos].includes(n)) return pos;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// 4. Zeilen → Vokabel-Entwürfe
// ---------------------------------------------------------------------------

export interface ImportDefaults {
  source?: string;
  lesson?: number;
  tags?: string[];
}

export interface ParsedRow {
  /** Zeilennummer in der Tabelle (1-basiert, wie in Excel) */
  line: number;
  cells: string[];
  draft: WordDraft | null;
  error?: string;
}

/** Wandelt die Tabellenzeilen anhand der Zuordnung in Vokabel-Entwürfe um. */
export function rowsToDrafts(
  rows: string[][],
  mapping: ColumnField[],
  hasHeader: boolean,
  defaults: ImportDefaults = {},
): ParsedRow[] {
  const start = hasHeader ? 1 : 0;
  const result: ParsedRow[] = [];

  for (let i = start; i < rows.length; i++) {
    const cells = rows[i];
    // Alle Zellen pro Feld sammeln (ein Feld kann mehreren Spalten zugeordnet sein)
    const get = (f: ColumnField): string[] =>
      mapping.map((m, c) => (m === f ? cells[c] ?? '' : '')).filter((v) => v !== '');
    const one = (f: ColumnField) => get(f).join(' ').trim() || undefined;

    let kana = one('kana') ?? '';
    let kanji = one('kanji');
    const romaji = one('romaji');

    // Romaji in der Kana-Spalte? → umwandeln
    if (kana && hasLatin(kana)) kana = romajiToKana(kana);
    // Keine Kana, aber Romaji → aus Romaji erzeugen
    if (!kana && romaji) kana = romajiToKana(romaji.toLowerCase());
    // Kanji-Spalte enthält nur Kana und Kana fehlt → verschieben
    if (!kana && kanji && isKanaOnly(kanji)) {
      kana = kanji;
      kanji = undefined;
    }
    // Kanji identisch mit Kana → kein eigenes Kanji
    if (kanji && kanji === kana) kanji = undefined;

    const meaning = dedupe(get('meaning').flatMap(splitMeanings));
    const tags = dedupe([...(defaults.tags ?? []), ...get('tags').flatMap(splitTags)]);

    const draft: WordDraft = {
      kana,
      kanji,
      romaji,
      meaning_de: meaning,
      part_of_speech: parsePartOfSpeech(one('pos')),
      source: one('source') ?? defaults.source,
      lesson: parseLesson(one('lesson')) ?? defaults.lesson,
      tags,
      note: one('note'),
    };

    let error: string | undefined;
    if (!kana) error = 'Kana fehlt';
    else if (hasLatin(kana)) error = 'Kana enthält Buchstaben';
    else if (meaning.length === 0) error = 'Bedeutung fehlt';

    result.push({ line: i + 1, cells, draft: error ? null : draft, error });
  }
  return result;
}
