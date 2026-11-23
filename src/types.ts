// Zentrale Datentypen der App (siehe SPEC.md, Abschnitt 3).
// Zeitpunkte werden als Zahl gespeichert: Millisekunden seit 1970 (Date.now()).
// Das lässt sich leicht vergleichen und sauber als JSON exportieren.

export const PARTS_OF_SPEECH = [
  'Nomen',
  'u-Verb',
  'ru-Verb',
  'irreg. Verb',
  'i-Adj.',
  'na-Adj.',
  'Adverb',
  'Ausdruck',
  'Partikel',
  'Sonstiges',
] as const;

export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number];

/** Felder, die jeder synchronisierte Datensatz hat (für Stufe 2: OneDrive-Sync). */
export interface SyncFields {
  /** Letzte Änderung – beim Zusammenführen gewinnt der neueste Stand. */
  updated_at: number;
  /** „Weiches“ Löschen: Eintrag bleibt erhalten, wird aber ausgeblendet. */
  deleted: boolean;
}

/** Eine eigene Vokabel. */
export interface Word extends SyncFields {
  id: string;
  kana: string;
  kanji?: string;
  romaji?: string;
  meaning_de: string[];
  part_of_speech?: PartOfSpeech;
  source?: string;
  lesson?: number;
  tags: string[];
  note?: string;
  /** Nur aktive Wörter werden gelernt. */
  active: boolean;
  created_at: number;
}

/** Felder, die man beim Anlegen/Importieren angibt (ohne technische Felder). */
export interface WordDraft {
  kana: string;
  kanji?: string;
  romaji?: string;
  meaning_de: string[];
  part_of_speech?: PartOfSpeech;
  source?: string;
  lesson?: number;
  tags: string[];
  note?: string;
  active?: boolean;
}

/** Abfragerichtung: Japanisch → Deutsch oder Deutsch → Japanisch. */
export type Direction = 'jp_de' | 'de_jp';

/** 1 = Nochmal, 2 = Schwer, 3 = Gut, 4 = Leicht */
export type Grade = 1 | 2 | 3 | 4;

export interface RatingEntry {
  /** Zeitpunkt der Bewertung */
  t: number;
  /** Bewertung */
  r: Grade;
  /** Lernzustand VOR der Bewertung (0 = neu, 1 = lernt, 2 = Wiederholung, 3 = neu lernen) */
  s: number;
}

/**
 * Lernstand einer Vokabel in EINER Richtung (FSRS-Zustand).
 * id = "<word_id>:<direction>", damit zwei Geräte dieselbe id erzeugen.
 */
export interface Review extends SyncFields {
  id: string;
  word_id: string;
  direction: Direction;
  /** Wann die Karte wieder fällig ist */
  due: number;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  /** 0 = neu, 1 = lernt, 2 = Wiederholung, 3 = neu lernen */
  state: number;
  last_review: number | null;
  history: RatingEntry[];
}

/**
 * Ein Wort eines zerlegten japanischen Textes (kompakt als Liste):
 * [Oberfläche, Grundform, Lesung in Hiragana (nur bei Kanji, sonst ""), Inhaltswort 1/0]
 * Inhaltswörter zählen für die Bekanntheitsquote; Partikeln, Hilfsverben, Satzzeichen nicht.
 */
export type Token = [surface: string, base: string, reading: string, content: 0 | 1];

/** Eigener Lesetext (selbst eingefügt oder KI-erzeugt). */
export interface Passage extends SyncFields {
  id: string;
  title?: string;
  text_ja: string;
  translation?: string;
  /** „eigen“ oder „KI“ */
  source?: string;
  /** Zerlegung in Wörter (beim Speichern berechnet) */
  tokens?: Token[];
  /** Eigene Vokabeln, die im Text vorkommen */
  word_ids: string[];
  known_ratio: number;
  created_at: number;
}

/** Eintrag im Hintergrund-Wörterbuch (schreibgeschützt, wird NICHT synchronisiert). */
export interface DictEntry {
  id?: number;
  kana: string;
  kanji: string[];
  gloss: string[];
  pos?: PartOfSpeech;
  /** Bits: 1 = häufig, 2 = wird meist in Kana geschrieben */
  flags: number;
  /** Quelle: w = Wadoku (deutsch), j = JMdict (englisch) */
  src: 'w' | 'j';
  /** Häufigkeit in den Tatoeba-Sätzen */
  freq: number;
  /** Alle Schreibweisen zum Suchen (Kanji, Kana, Kana in Hiragana) */
  forms: string[];
  /** 'core' = häufige Wörter, 'full' = erweitertes Wörterbuch */
  pack: 'core' | 'full';
}

export type DirectionSetting = 'both' | Direction;

export interface Settings {
  /** Maximal neue Karten pro Tag */
  newPerDay: number;
  /** Karten pro Lerneinheit */
  sessionSize: number;
  /** Standard-Abfragerichtung */
  direction: DirectionSetting;
  /** Bei JP→DE die Lesung (Kana) schon auf der Vorderseite zeigen */
  showKanaOnFront: boolean;
  theme: 'system' | 'light' | 'dark';
}

export interface SettingsRecord extends SyncFields {
  key: 'main';
  value: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 20,
  sessionSize: 20,
  direction: 'both',
  showKanaOnFront: true,
  theme: 'system',
};
