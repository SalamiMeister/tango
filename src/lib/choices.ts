// Auswahl falscher Antworten für Multiple Choice und Wörter für „Zuordnen“ (pur).

import type { Word } from '../types';

/** Fisher-Yates-Mischen (liefert eine neue Liste). rnd ist für Tests austauschbar. */
export function shuffle<T>(list: T[], rnd: () => number = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Wählt n falsche Antworten für ein Wort. Bevorzugt: gleiche Lektion (+2),
 * gleiche Wortart (+1). Wörter mit gleicher Lesung oder gleicher Bedeutung
 * werden ausgeschlossen, damit es keine zwei richtigen Antworten gibt.
 */
export function pickDistractors(word: Word, pool: Word[], n = 3, rnd: () => number = Math.random): Word[] {
  const meanings = new Set(word.meaning_de.map((m) => m.toLowerCase()));
  const candidates = pool.filter(
    (w) =>
      w.id !== word.id &&
      !w.deleted &&
      w.kana !== word.kana &&
      (!w.kanji || w.kanji !== word.kanji) &&
      !w.meaning_de.some((m) => meanings.has(m.toLowerCase())),
  );
  const score = (w: Word) =>
    (word.lesson !== undefined && w.lesson === word.lesson ? 2 : 0) +
    (word.part_of_speech && w.part_of_speech === word.part_of_speech ? 1 : 0);
  // Erst mischen, dann stabil nach Punkten sortieren → Zufall innerhalb gleicher Punktzahl
  const picked: Word[] = [];
  const seenText = new Set<string>();
  for (const w of shuffle(candidates, rnd).sort((a, b) => score(b) - score(a))) {
    const key = w.meaning_de[0]?.toLowerCase() + '|' + (w.kanji ?? w.kana);
    if (seenText.has(key)) continue;
    seenText.add(key);
    picked.push(w);
    if (picked.length === n) break;
  }
  return picked;
}

/** Zeigt die (ersten zwei) Bedeutungen als kurzen Text. */
export function meaningLabel(w: Word): string {
  return w.meaning_de.slice(0, 2).join(', ');
}
