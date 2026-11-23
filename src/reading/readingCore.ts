// Lese-Logik ohne Datenbank (pur → gut testbar):
// Bekanntheitsquote, Furigana, KI-Prompt, eingefügten KI-Text aufteilen.

import type { Review, Token, Word } from '../types';
import { kataToHira } from '../dict/dictCore';

/** Ausschnitt eines kuromoji-Tokens (nur die Felder, die wir brauchen). */
export interface KuromojiToken {
  surface_form: string;
  basic_form: string;
  reading?: string;
  pos: string;
  pos_detail_1: string;
}

const hasKanji = (s: string) => /\p{Script=Han}/u.test(s);

/**
 * Inhaltswort? Partikeln, Hilfsverben, Satzzeichen, Zahlen, Namen und unselbständige
 * Wörter (z. B. いる in 食べている) zählen nicht für die Bekanntheitsquote.
 * (Gleiche Regel wie in scripts/build-data.mjs – bei Änderungen beide anpassen.)
 */
export function isContentToken(t: KuromojiToken): boolean {
  if (['助詞', '助動詞', '記号', 'フィラー', 'その他'].includes(t.pos)) return false;
  if (['数', '非自立', '接尾', '固有名詞'].includes(t.pos_detail_1)) return false;
  if (/^[\s\d０-９a-zA-Zａ-ｚＡ-Ｚ]+$/.test(t.surface_form)) return false;
  return true;
}

export function toCompact(tokens: KuromojiToken[]): Token[] {
  return tokens.map((t) => [
    t.surface_form,
    t.basic_form && t.basic_form !== '*' ? t.basic_form : t.surface_form,
    hasKanji(t.surface_form) && t.reading && t.reading !== '*' ? kataToHira(t.reading) : '',
    isContentToken(t) ? 1 : 0,
  ]);
}

/**
 * Menge aller Schreibweisen der eigenen Vokabeln, die als „bekannt“ gelten.
 * Standard: nur Vokabeln, die schon mindestens einmal gelernt wurden.
 */
export function buildKnownSet(words: Word[], reviews: Review[], includeUnlearned = false): Set<string> {
  const learned = new Set(reviews.filter((r) => !r.deleted && r.reps > 0).map((r) => r.word_id));
  const set = new Set<string>();
  for (const w of words) {
    if (w.deleted || !w.active) continue;
    if (!includeUnlearned && !learned.has(w.id)) continue;
    set.add(w.kana);
    set.add(kataToHira(w.kana));
    if (w.kanji) set.add(w.kanji);
  }
  return set;
}

export function isKnown(t: Token, known: Set<string>): boolean {
  return known.has(t[1]) || known.has(t[0]) || known.has(kataToHira(t[1]));
}

export interface Ratio {
  known: number;
  total: number;
  /** 0 … 1; Texte ohne Inhaltswörter gelten als 1 */
  ratio: number;
}

/** Anteil bekannter Inhaltswörter eines Satzes/Textes. */
export function knownRatio(tokens: Token[], known: Set<string>): Ratio {
  const content = tokens.filter((t) => t[3] === 1);
  const k = content.filter((t) => isKnown(t, known)).length;
  return { known: k, total: content.length, ratio: content.length ? k / content.length : 1 };
}

/** Eigene Vokabeln, die im Text vorkommen (für Passage.word_ids). */
export function wordIdsInTokens(tokens: Token[], words: Word[]): string[] {
  const byForm = new Map<string, string>();
  for (const w of words) {
    if (w.deleted) continue;
    byForm.set(w.kana, w.id);
    byForm.set(kataToHira(w.kana), w.id);
    if (w.kanji) byForm.set(w.kanji, w.id);
  }
  const ids = new Set<string>();
  for (const t of tokens) {
    const id = byForm.get(t[1]) ?? byForm.get(t[0]);
    if (id) ids.add(id);
  }
  return [...ids];
}

/**
 * Furigana: Lesung nur über den Kanji-Teil setzen, Kana am Anfang/Ende bleiben frei.
 * 食べ + たべ → [食|た] + べ ;  お茶 + おちゃ → お + [茶|ちゃ]
 */
export function furiganaSegments(surface: string, reading: string): { text: string; rt?: string }[] {
  if (!reading || !hasKanji(surface)) return [{ text: surface }];
  const s = [...surface];
  const r = [...reading];
  const isKanaChar = (c: string) => /[぀-ヿ]/.test(c);
  let pre = 0;
  while (pre < s.length && pre < r.length && isKanaChar(s[pre]) && kataToHira(s[pre]) === r[pre]) pre++;
  let post = 0;
  while (
    post < s.length - pre &&
    post < r.length - pre &&
    isKanaChar(s[s.length - 1 - post]) &&
    kataToHira(s[s.length - 1 - post]) === r[r.length - 1 - post]
  )
    post++;
  const out: { text: string; rt?: string }[] = [];
  if (pre) out.push({ text: s.slice(0, pre).join('') });
  out.push({ text: s.slice(pre, s.length - post).join(''), rt: r.slice(pre, r.length - post).join('') });
  if (post) out.push({ text: s.slice(s.length - post).join('') });
  return out;
}

/**
 * Eingefügten KI-Text aufteilen: Japanisch oben, Übersetzung unter einer Zeile „---“.
 */
export function splitAiText(text: string): { ja: string; de: string } {
  const parts = text.split(/^\s*-{3,}\s*$/m);
  if (parts.length < 2) return { ja: text.trim(), de: '' };
  return { ja: parts[0].trim(), de: parts.slice(1).join('\n').trim() };
}

export interface PromptOptions {
  /** Grammatik bis zu dieser Genki-Lektion (undefined = keine Angabe) */
  lesson?: number;
  /** Ungefähre Anzahl Sätze */
  sentences: number;
  /** Thema (optional) */
  topic?: string;
  /** Nur Vokabeln bis zu dieser Lektion verwenden */
  onlyUpToLesson: boolean;
}

/** Erzeugt einen fertigen Prompt für Claude oder einen anderen KI-Chat. */
export function buildAiPrompt(words: Word[], opts: PromptOptions): { prompt: string; count: number } {
  const list = words
    .filter((w) => !w.deleted && w.active)
    .filter((w) => !opts.onlyUpToLesson || opts.lesson === undefined || (w.lesson ?? 0) <= opts.lesson)
    .map((w) => `${w.kanji ? `${w.kanji}（${w.kana}）` : w.kana} = ${w.meaning_de.slice(0, 2).join(', ')}`);
  const grammar =
    opts.lesson !== undefined
      ? `Verwende nur Grammatik, die bis einschließlich Lektion ${opts.lesson} des Lehrbuchs „Genki“ behandelt wird.`
      : 'Verwende nur einfache Grammatik auf Anfängerniveau (Höflichkeitsform です/ます).';
  const prompt = [
    `Schreibe einen kurzen, zusammenhängenden japanischen Text mit etwa ${opts.sentences} Sätzen für einen deutschsprachigen Japanisch-Lernenden.`,
    opts.topic ? `Thema: ${opts.topic}.` : 'Wähle ein alltägliches Thema.',
    '',
    'Regeln:',
    '- Verwende möglichst NUR Wörter aus der Vokabelliste unten. Partikeln, です/ます und Zahlen sind erlaubt.',
    '- Höchstens 2–3 neue Wörter insgesamt.',
    `- ${grammar}`,
    '- Schreibe Wörter in Kanji nur, wenn sie in der Liste mit Kanji stehen; sonst in Kana.',
    '- Keine Furigana, keine Romaji, keine Erklärungen.',
    '',
    'Ausgabeformat (genau so):',
    '1. Der japanische Text.',
    '2. Eine Zeile mit nur: ---',
    '3. Die deutsche Übersetzung.',
    '',
    `Vokabelliste (${list.length} Wörter):`,
    ...list,
  ].join('\n');
  return { prompt, count: list.length };
}
