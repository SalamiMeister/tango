// Zusammenstellung einer Lerneinheit und Zählwerte für den Startbildschirm (pur).

import type { DirectionSetting, PartOfSpeech, Review, Settings, Word } from '../types';
import { STATE } from './fsrs';

/** Karten in der Lernphase, die in den nächsten 20 Min fällig werden, dürfen schon jetzt kommen. */
export const LEARN_AHEAD_MS = 20 * 60 * 1000;

export interface SessionFilter {
  direction: DirectionSetting;
  /** Nur diese Lektion (undefined = alle) */
  lesson?: number;
  /** Nur Wörter mit diesem Tag */
  tag?: string;
  /** Nur fällige Karten, keine neuen */
  onlyDue?: boolean;
  /** Nur diese Wortart */
  pos?: PartOfSpeech;
  /** Nur Problemwörter – diese werden geübt, auch wenn sie noch nicht fällig sind */
  onlyProblem?: boolean;
  /** So viele neue Karten zusätzlich zum Tageslimit („Noch mehr neue lernen“) */
  extraNew?: number;
}

/** Wie viele neue Karten „Noch mehr neue lernen“ auf einmal dazunimmt. */
export const EXTRA_NEW_BATCH = 10;

/**
 * Problemwort: in einer Richtung mindestens 2× vergessen
 * („Nochmal“ bei einer Karte, die schon gelernt war).
 */
export function isProblemReview(r: Review): boolean {
  return r.lapses >= 2 || r.history.filter((h) => h.r === 1 && h.s !== STATE.New).length >= 2;
}

export function problemWordIds(reviews: Review[]): Set<string> {
  return new Set(reviews.filter((r) => !r.deleted && isProblemReview(r)).map((r) => r.word_id));
}

/** Beginn des heutigen Tages (lokale Zeit) in ms. */
export function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Lokaler Tagesschlüssel „2026-11-20“. */
export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Wie viele neue Karten wurden heute schon zum ersten Mal gelernt? */
export function countNewToday(reviews: Review[], now: number): number {
  const start = startOfDay(now);
  return reviews.filter((r) => !r.deleted && r.history.length > 0 && r.history[0].t >= start).length;
}

/** Ist die Karte (keine neue) jetzt fällig? */
export function isDue(r: Review, now: number): boolean {
  if (r.state === STATE.New) return false;
  const inLearning = r.state === STATE.Learning || r.state === STATE.Relearning;
  return r.due <= now + (inLearning ? LEARN_AHEAD_MS : 0);
}

/** Reviews, die zu aktiven Wörtern gehören und zum Filter passen. */
export function eligibleReviews(words: Word[], reviews: Review[], filter: SessionFilter): Review[] {
  const wordById = new Map(words.map((w) => [w.id, w]));
  return reviews.filter((r) => {
    if (r.deleted) return false;
    const w = wordById.get(r.word_id);
    if (!w || w.deleted || !w.active) return false;
    if (filter.direction !== 'both' && r.direction !== filter.direction) return false;
    if (filter.lesson !== undefined && w.lesson !== filter.lesson) return false;
    if (filter.tag && !w.tags.includes(filter.tag)) return false;
    if (filter.pos && w.part_of_speech !== filter.pos) return false;
    return true;
  });
}

export interface QueueParts {
  /** Fällige Wiederholungen, die überfälligsten zuerst */
  due: Review[];
  /** Neue Karten, die heute noch eingeführt werden dürfen */
  fresh: Review[];
  /** Weitere neue Karten, die nur wegen des Tageslimits zurückgehalten werden */
  heldBack: number;
}

/** Ermittelt fällige und neue Karten (neue begrenzt durch das Tageslimit). */
export function queueParts(
  words: Word[],
  reviews: Review[],
  settings: Settings,
  filter: SessionFilter,
  now: number,
): QueueParts {
  const eligible = eligibleReviews(words, reviews, filter);

  if (filter.onlyProblem) {
    const problems = problemWordIds(reviews);
    const due = eligible
      .filter((r) => r.state !== STATE.New && problems.has(r.word_id))
      .sort((a, b) => a.due - b.due);
    return { due, fresh: [], heldBack: 0 };
  }

  const due = eligible.filter((r) => isDue(r, now)).sort((a, b) => a.due - b.due);

  if (filter.onlyDue) return { due, fresh: [], heldBack: 0 };

  const wordById = new Map(words.map((w) => [w.id, w]));
  const reviewById = new Map(reviews.map((r) => [r.id, r]));
  const remainingNew =
    Math.max(0, settings.newPerDay - countNewToday(reviews, now)) + Math.max(0, filter.extraNew ?? 0);

  const allFresh = eligible
    .filter((r) => r.state === STATE.New)
    // Bei „beide Richtungen“ kommt DE→JP erst, nachdem JP→DE einmal gelernt wurde.
    .filter((r) => {
      if (filter.direction !== 'both' || r.direction !== 'de_jp') return true;
      const sibling = reviewById.get(`${r.word_id}:jp_de`);
      return !sibling || sibling.deleted || sibling.state !== STATE.New;
    })
    .sort((a, b) => {
      const wa = wordById.get(a.word_id)!;
      const wb = wordById.get(b.word_id)!;
      // Ältere Vokabeln zuerst; bei gleichem Wort JP→DE vor DE→JP
      const dirOrder = (r: Review) => (r.direction === 'jp_de' ? 0 : 1);
      return wa.created_at - wb.created_at || dirOrder(a) - dirOrder(b) || a.id.localeCompare(b.id);
    });
  const fresh = allFresh.slice(0, remainingNew);

  return { due, fresh, heldBack: allFresh.length - fresh.length };
}

/** Lohnt sich „Noch mehr neue lernen“? (Tageslimit erreicht, aber es gibt noch neue Karten) */
export function canLearnExtraNew(parts: QueueParts): boolean {
  return parts.fresh.length === 0 && parts.heldBack > 0;
}

/**
 * Baut die Kartenliste für eine Lerneinheit: zuerst Fälliges, dann Neues,
 * wobei neue Karten gleichmäßig zwischen die Wiederholungen gemischt werden.
 */
export function buildSessionQueue(parts: Pick<QueueParts, 'due' | 'fresh'>, size: number): Review[] {
  const due = parts.due.slice(0, size);
  const fresh = parts.fresh.slice(0, Math.max(0, size - due.length));
  if (due.length === 0) return fresh;
  if (fresh.length === 0) return due;
  const out: Review[] = [];
  const step = (due.length + fresh.length) / fresh.length;
  let fi = 0;
  let di = 0;
  for (let i = 0; i < due.length + fresh.length; i++) {
    const wantFresh = fi < fresh.length && Math.floor((fi + 0.5) * step) === i;
    if ((wantFresh || di >= due.length) && fi < fresh.length) out.push(fresh[fi++]);
    else out.push(due[di++]);
  }
  return out;
}

/** Anzahl Tage in Folge mit mindestens einer Bewertung (heute oder bis gestern). */
export function streakDays(reviews: Review[], now: number): number {
  const days = new Set<string>();
  for (const r of reviews) for (const h of r.history) days.add(dayKey(h.t));
  let count = 0;
  const d = new Date(now);
  // Wenn heute noch nicht gelernt wurde, zählt die Serie bis gestern weiter.
  if (!days.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d.getTime()))) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

/** Wann wird die nächste Karte fällig? (für „Nichts fällig“-Anzeige) */
export function nextDueAt(words: Word[], reviews: Review[], filter: SessionFilter): number | undefined {
  const times = eligibleReviews(words, reviews, filter)
    .filter((r) => r.state !== STATE.New)
    .map((r) => r.due);
  return times.length ? Math.min(...times) : undefined;
}

/** Lernstatus eines Wortes für die Liste: neu / lernt / sicher (Stabilität ≥ 21 Tage). */
export function wordStatus(reviewsOfWord: Review[]): 'neu' | 'lernt' | 'sicher' {
  const live = reviewsOfWord.filter((r) => !r.deleted);
  if (live.length === 0 || live.every((r) => r.state === STATE.New)) return 'neu';
  if (live.every((r) => r.state === STATE.Review && r.stability >= 21)) return 'sicher';
  return 'lernt';
}
