// Anbindung an ts-fsrs (Wiederholungsalgorithmus FSRS).
// Unsere Review-Datensätze speichern Zeitpunkte als Zahlen; ts-fsrs arbeitet
// mit Date-Objekten. Die Funktionen hier übersetzen zwischen beiden Welten.

import { createEmptyCard, fsrs, type Card, type Grade as FsrsGrade, State } from 'ts-fsrs';
import type { Direction, Grade, Review } from '../types';

// Ziel: 90 % der Karten sollen bei Fälligkeit noch gewusst werden.
// "fuzz" streut die Intervalle leicht, damit sich Karten nicht stapeln.
const scheduler = fsrs({ request_retention: 0.9, enable_fuzz: true });

export const STATE = { New: State.New, Learning: State.Learning, Review: State.Review, Relearning: State.Relearning };

export const GRADE_LABELS: Record<Grade, string> = {
  1: 'Nochmal',
  2: 'Schwer',
  3: 'Gut',
  4: 'Leicht',
};

export function reviewId(wordId: string, direction: Direction): string {
  return `${wordId}:${direction}`;
}

/** Review-Datensatz → ts-fsrs-Karte */
export function toCard(r: Review): Card {
  return {
    due: new Date(r.due),
    stability: r.stability,
    difficulty: r.difficulty,
    scheduled_days: r.scheduled_days,
    learning_steps: r.learning_steps,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state as State,
    last_review: r.last_review != null ? new Date(r.last_review) : undefined,
  };
}

/** ts-fsrs-Karte → Felder unseres Review-Datensatzes */
function fromCard(c: Card) {
  return {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review ? c.last_review.getTime() : null,
  };
}

/** Neuer, noch nie gelernter Lernstand für ein Wort in einer Richtung. */
export function newReview(wordId: string, direction: Direction, now: number): Review {
  return {
    id: reviewId(wordId, direction),
    word_id: wordId,
    direction,
    ...fromCard(createEmptyCard(new Date(now))),
    history: [],
    updated_at: now,
    deleted: false,
  };
}

/** Bewertet eine Karte und liefert den neuen Lernstand (das Original bleibt unverändert). */
export function rateReview(r: Review, grade: Grade, now: number): Review {
  // Falls die Uhr eines Geräts nachgeht: nie „vor“ der letzten Bewertung bewerten (FSRS bricht sonst ab).
  now = Math.max(now, r.last_review ?? 0);
  const result = scheduler.next(toCard(r), new Date(now), grade as FsrsGrade);
  return {
    ...r,
    ...fromCard(result.card),
    history: [...r.history, { t: now, r: grade, s: r.state }],
    updated_at: now,
  };
}

/** Für jede Bewertung: in wie vielen Millisekunden wäre die Karte wieder fällig? */
export function previewIntervals(r: Review, now: number): Record<Grade, number> {
  const out = {} as Record<Grade, number>;
  now = Math.max(now, r.last_review ?? 0);
  for (const g of [1, 2, 3, 4] as Grade[]) {
    // Ohne Zufallsstreuung, damit die Anzeige ruhig bleibt
    out[g] = previewScheduler.next(toCard(r), new Date(now), g as FsrsGrade).card.due.getTime() - now;
  }
  return out;
}
const previewScheduler = fsrs({ request_retention: 0.9, enable_fuzz: false });

/** 90 000 ms → „2 Min“, 3 Tage → „3 T“ usw. */
export function formatInterval(ms: number): string {
  const min = ms / 60000;
  if (min < 1) return '< 1 Min';
  if (min < 60) return `${Math.round(min)} Min`;
  const h = min / 60;
  if (h < 24) return `${Math.round(h)} Std`;
  const d = h / 24;
  if (d < 31) return `${Math.round(d)} T`;
  const mo = d / 30.4;
  if (mo < 12) return `${Math.round(mo)} Mon`;
  return `${(d / 365).toFixed(1).replace('.', ',')} J`;
}
