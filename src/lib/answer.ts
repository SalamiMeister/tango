// Prüfung getippter Antworten (Modus „Eintippen“) – pur und gut testbar.

import { toHiragana, toKatakana, toRomaji } from 'wanakana';
import type { Word } from '../types';
import { romajiToKana } from './text';

export type CheckResult = 'correct' | 'variant' | 'typo' | 'wrong';

/**
 * Tippfehler-Abstand: Wie viele Buchstaben muss man einfügen, löschen, ersetzen
 * oder zwei Nachbarn vertauschen, damit a zu b wird? (Damerau-Levenshtein, OSA)
 */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

const ARTICLES = /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines|sich|to|a|an|the)\s+/;

/**
 * Macht eine deutsche Antwort vergleichbar: Kleinschreibung, ohne Klammerinhalt,
 * ohne Artikel/„sich“, ä→ae, ß→ss, ohne Satzzeichen.
 */
export function normalizeGerman(s: string): string {
  let t = s
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[.!?¡¿"'„“”‚‘’…~〜]/g, '')
    .replace(/[-–/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Artikel ggf. mehrfach entfernen („sich ein …“)
  for (let i = 0; i < 2; i++) t = t.replace(ARTICLES, '');
  return t.trim();
}

/**
 * Deutsch-Antwort prüfen. Eine von mehreren Bedeutungen genügt; der Nutzer darf
 * auch mehrere Bedeutungen mit Komma eingeben. Ein Buchstabe daneben (ab 5 Zeichen)
 * zählt als Tippfehler.
 */
export function checkGerman(input: string, meanings: string[]): CheckResult {
  const tries = input
    .split(/[,;]/)
    .map(normalizeGerman)
    .filter(Boolean);
  if (tries.length === 0) return 'wrong';
  const targets = meanings.map(normalizeGerman).filter(Boolean);
  let best: CheckResult = 'wrong';
  for (const t of tries) {
    for (const m of targets) {
      if (t === m) return 'correct';
      const allowed = m.length >= 5 ? 1 : 0;
      if (allowed && editDistance(t, m) <= allowed) best = 'typo';
    }
  }
  return best;
}

/**
 * Japanisch vergleichbar machen: Romaji → Kana, alles → Katakana, ohne Leerzeichen/〜.
 * (Katakana statt Hiragana, weil dabei der Langvokal „ー“ erhalten bleibt.)
 */
export function normalizeJapanese(s: string): string {
  const kana = romajiToKana(s.trim().toLowerCase().replace(/[\s〜~・。、]/g, ''));
  return toKatakana(kana, { passRomaji: true });
}

// ---------------------------------------------------------------------------
// Lange Vokale in verschiedenen Schreibweisen
//
// おはよう kann man als „ohayou“ (Tipp-Romaji), „ohayoo“ (Genki) oder „ohayō“
// (Hepburn) schreiben. Damit alle drei zählen, werden lange Vokale auf ein
// gemeinsames Zeichen „ー“ gebracht – aber NUR, wenn derselbe lange Vokal gemeint ist:
//   gleicher Vokal doppelt (ああ, いい, うう, ええ, おお), o+u (おう), e+i (えい), Strich ー.
// Kurz und lang bleiben verschieden: おばさん ≠ おばあさん, ゆき ≠ ゆうき.
// Bekannte Grenze: echte Wortpaare, die sich NUR in おう/おお unterscheiden
// (こうり „Einzelhandel“ / こおり „Eis“), gelten als gleich – die App zeigt
// in dem Fall aber immer die richtige Schreibweise an.
// ---------------------------------------------------------------------------

const VOWEL_OF_KANA: Record<string, string> = { あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o' };

/** Vokal, auf den eine einzelne Kana endet (か → a, ょ → o, ん/っ → null). */
function vowelOf(kana: string): string | null {
  const r = toRomaji(kana);
  const v = r.slice(-1);
  return r !== kana && 'aiueo'.includes(v) && v !== '' ? v : null;
}

/** Makron-Schreibweise auflösen: ō → oo, â → aa usw. */
function expandMacrons(s: string): string {
  return s
    .replace(/[āâ]/g, 'aa')
    .replace(/[īî]/g, 'ii')
    .replace(/[ūû]/g, 'uu')
    .replace(/[ēê]/g, 'ee')
    .replace(/[ōô]/g, 'oo');
}

/** Vergleichsschlüssel, in dem alle Schreibweisen desselben langen Vokals gleich aussehen. */
export function longVowelKey(kana: string): string {
  // Katakana → Hiragana; dabei wird der Strich in Katakana-Wörtern zu einem Vokal (コー → こう)
  const h = toHiragana(kana.replace(/[\s〜~・]/g, ''), { passRomaji: true });
  let out = '';
  let prevVowel: string | null = null;
  for (const ch of h) {
    const v = VOWEL_OF_KANA[ch];
    const lengthens =
      prevVowel !== null &&
      (ch === 'ー' || (v !== undefined && (v === prevVowel || (prevVowel === 'o' && v === 'u') || (prevVowel === 'e' && v === 'i'))));
    if (lengthens) {
      out += 'ー';
      prevVowel = null; // ein langer Vokal wird nicht weiter verlängert (おおお ≠ おー)
      continue;
    }
    out += ch;
    prevVowel = ch === 'ー' ? null : vowelOf(ch);
  }
  return out;
}

/**
 * Japanisch-Antwort prüfen: Kana (auch als Romaji getippt) oder Kanji werden akzeptiert.
 * 'correct' = genau richtig, 'variant' = richtig, aber der lange Vokal ist anders
 * geschrieben (z. B. „ohayoo“ für おはよう) – zählt als richtig, die App zeigt die Schreibweise.
 */
export function checkJapanese(input: string, word: Pick<Word, 'kana' | 'kanji' | 'romaji'>): CheckResult {
  const raw = input.trim().replace(/[\s〜~]/g, '');
  if (!raw) return 'wrong';
  if (word.kanji && raw === word.kanji.replace(/[\s〜~]/g, '')) return 'correct';
  if (normalizeJapanese(raw) === normalizeJapanese(word.kana)) return 'correct';
  // Genau so getippt, wie die App das Romaji anzeigt (z. B. „koohii“ bei コーヒー) → exakt richtig
  const lower = raw.toLowerCase();
  if (lower === toRomaji(word.kana).toLowerCase() || (word.romaji && lower === word.romaji.trim().toLowerCase())) {
    return 'correct';
  }
  const typed = romajiToKana(expandMacrons(raw.toLowerCase()));
  if (/[a-z]/.test(typed)) return 'wrong'; // nicht vollständig in Kana umwandelbar
  return longVowelKey(typed) === longVowelKey(word.kana) ? 'variant' : 'wrong';
}
