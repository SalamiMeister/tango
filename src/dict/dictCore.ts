// Wörterbuch-Logik ohne Datenbank (pur → gut testbar):
// Rohdaten umwandeln, Treffer sortieren, Vorschlag → Vokabel-Entwurf, Import ergänzen.

import type { DictEntry, PartOfSpeech, WordDraft } from '../types';
import { PARTS_OF_SPEECH } from '../types';
import { normalizeGerman } from '../lib/answer';
import { hasLatin, romajiToKana } from '../lib/text';

/** Rohformat aus public/data/dict-*.json (siehe scripts/build-data.mjs) */
export type RawEntry = [kanji: string, kana: string, gloss: string, pos: string, flags: number, src: 'w' | 'j', freq: number];

/** Katakana → Hiragana, der Langvokal-Strich ー bleibt erhalten (コーヒー → こーひー). */
export function kataToHira(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

export function rawToEntry(r: RawEntry, pack: 'core' | 'full'): DictEntry {
  const kanji = r[0] ? r[0].split(';') : [];
  const kana = r[1];
  const forms = [...new Set([...kanji, kana, kataToHira(kana)])];
  const pos = (PARTS_OF_SPEECH as readonly string[]).includes(r[3]) ? (r[3] as PartOfSpeech) : undefined;
  return { kana, kanji, gloss: r[2].split('/'), pos, flags: r[4], src: r[5], freq: r[6] ?? 0, forms, pack };
}

/** Suchbegriff vorbereiten: Romaji → Hiragana, Katakana → Hiragana. */
export function normalizeQuery(q: string): string {
  const t = q.trim();
  if (!t) return '';
  return kataToHira(hasLatin(t) ? romajiToKana(t.toLowerCase()) : t);
}

/**
 * Sortiert Treffer: genaue Treffer zuerst, dann häufige Wörter, dann nach
 * Häufigkeit in Beispielsätzen, dann kürzere Wörter.
 */
export function rankEntries(entries: DictEntry[], query: string): DictEntry[] {
  const q = normalizeQuery(query);
  const exact = (e: DictEntry) => e.forms.includes(q) || e.forms.includes(query.trim());
  return [...entries].sort(
    (a, b) =>
      Number(exact(b)) - Number(exact(a)) ||
      (b.flags & 1) - (a.flags & 1) ||
      b.freq - a.freq ||
      a.kana.length - b.kana.length,
  );
}

/** Bedeutungen ohne die Markierung „(engl.) “ für englische Notlösungen. */
export function glossText(e: DictEntry, max = 3): string {
  const g = e.gloss.slice(0, max).join(', ');
  return e.src === 'j' ? g.replace(/^\(engl\.\)\s*/, '') + ' (engl.)' : g;
}

/** Vorschlag übernehmen → Vokabel-Entwurf. Wörter, die meist in Kana stehen, bekommen kein Kanji. */
export function entryToDraft(e: DictEntry): Partial<WordDraft> {
  return {
    kana: e.kana,
    kanji: e.flags & 2 || e.kanji.length === 0 ? undefined : e.kanji[0],
    meaning_de: e.gloss
      .slice(0, 3)
      .map((g) => g.replace(/^\(engl\.\)\s*/, ''))
      .filter(Boolean),
    part_of_speech: e.pos,
  };
}

// ---------------------------------------------------------------------------
// Import ergänzen: fehlende Kanji / Kana / Bedeutung / Wortart aus dem Wörterbuch
// ---------------------------------------------------------------------------

export type EnrichNote = 'ergänzt' | 'mehrdeutig' | 'nicht gefunden' | null;

/**
 * Ergänzt einen (unvollständigen) Entwurf. candidates = Wörterbuch-Einträge, die zu
 * Kana oder Kanji des Entwurfs passen. Es wird NUR ergänzt, wenn eindeutig ist,
 * welcher Eintrag gemeint ist – vorhandene Angaben werden nie überschrieben.
 */
export function enrichDraft(
  draft: Partial<WordDraft>,
  candidates: DictEntry[],
): { draft: Partial<WordDraft>; note: EnrichNote } {
  const kana = draft.kana?.trim() ?? '';
  const kanji = draft.kanji?.trim() ?? '';
  const meanings = (draft.meaning_de ?? []).map(normalizeGerman).filter(Boolean);
  const needs = !kana || !kanji || meanings.length === 0 || !draft.part_of_speech;
  if (!needs) return { draft, note: null };

  // 1. passende Einträge: Kanji und/oder Kana müssen übereinstimmen
  let matches = candidates.filter(
    (e) =>
      (!kanji || e.kanji.includes(kanji)) &&
      (!kana || e.kana === kana || kataToHira(e.kana) === kataToHira(kana)),
  );
  if (matches.length === 0) return { draft, note: kana && kanji ? null : 'nicht gefunden' };

  // 2. bei mehreren: über die Bedeutung eingrenzen (はし + „Brücke“ → 橋)
  if (matches.length > 1 && meanings.length > 0) {
    const byMeaning = matches.filter((e) =>
      e.gloss.some((g) => {
        const n = normalizeGerman(g.replace(/^\(engl\.\)\s*/, ''));
        return meanings.some((m) => n === m || n.split(' ').includes(m));
      }),
    );
    if (byMeaning.length > 0) matches = byMeaning;
  }
  // 3. immer noch mehrere: alle gleich geschrieben (Kanji + Kana)? → nimm den häufigsten
  const sameSpelling = (e: DictEntry) => e.kana === matches[0].kana && e.kanji[0] === matches[0].kanji[0];
  if (matches.length > 1 && !matches.every(sameSpelling)) {
    // Kana + Kanji vorhanden: Es fehlen nur Bedeutung/Wortart – dann den häufigsten nehmen
    if (!(kana && kanji)) return { draft, note: 'mehrdeutig' };
  }
  const best = rankEntries(matches, kanji || kana)[0];
  const fill = entryToDraft(best);
  const out: Partial<WordDraft> = { ...draft };
  let changed = false;
  if (!kana && fill.kana) (out.kana = fill.kana), (changed = true);
  if (!kanji && fill.kanji) (out.kanji = fill.kanji), (changed = true);
  if (meanings.length === 0 && fill.meaning_de?.length) (out.meaning_de = fill.meaning_de), (changed = true);
  if (!draft.part_of_speech && fill.part_of_speech) (out.part_of_speech = fill.part_of_speech), (changed = true);
  return { draft: out, note: changed ? 'ergänzt' : null };
}
