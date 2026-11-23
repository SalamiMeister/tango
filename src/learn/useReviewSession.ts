// Ablauf einer Lerneinheit mit FSRS – gemeinsam für Karteikarten, Auswahl, Eintippen und Hören.
//
// answer(note)  speichert die Bewertung sofort (nichts geht verloren),
// next()        geht zur nächsten Karte (bei Auswahl/Eintippen erst nach der Rückmeldung),
// regrade(note) ändert die letzte Bewertung („Ich lag richtig“),
// undoLast()    nimmt die letzte Bewertung ganz zurück.

import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../db';
import type { Grade, Review, Settings, Word } from '../types';
import { rateReview } from '../lib/fsrs';
import { buildSessionQueue, LEARN_AHEAD_MS, nextDueAt, queueParts } from '../lib/session';
import { loadSettings, saveReview } from '../repo';
import type { Route } from '../router';
import { filterFromRoute, type Mode } from './modes';
import { requestSync } from '../sync/syncManager';

interface Snapshot {
  queue: Review[];
  done: number;
  before: Review;
}

export interface Answered {
  grade: Grade;
  nextQueue: Review[];
}

export function useReviewSession(route: Route, mode: Mode) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [wordsById, setWordsById] = useState<Map<string, Word>>(new Map());
  const [pool, setPool] = useState<Word[]>([]);
  const [queue, setQueue] = useState<Review[]>([]);
  const [done, setDone] = useState(0);
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [finished, setFinished] = useState(false);
  const [nextDue, setNextDue] = useState<number | undefined>();
  // Zählt jede Änderung der aktuellen Karte hoch, damit Ansichten sich zurücksetzen
  const [cardKey, setCardKey] = useState(0);
  const undoStack = useRef<Snapshot[]>([]);
  const busy = useRef(false);
  const routeKey = route.query.toString();

  /** Lädt eine neue Einheit aus der Datenbank. */
  const restart = useCallback(async () => {
    setLoading(true);
    const s = await loadSettings();
    const allWords = (await db.words.toArray()).filter((w) => !w.deleted);
    const allReviews = (await db.reviews.toArray()).filter((r) => !r.deleted);
    const filter = filterFromRoute(route, s, mode);
    const parts = queueParts(allWords, allReviews, s, filter, Date.now());
    setSettings(s);
    setWordsById(new Map(allWords.map((w) => [w.id, w])));
    setPool(allWords.filter((w) => w.active));
    setQueue(buildSessionQueue(parts, s.sessionSize));
    setNextDue(nextDueAt(allWords, allReviews, filter));
    setDone(0);
    setAnswered(null);
    setFinished(false);
    setCardKey((k) => k + 1);
    undoStack.current = [];
    setLoading(false);
  }, [routeKey, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    restart();
  }, [restart]);

  const current = queue[0];
  const word = current ? wordsById.get(current.word_id) : undefined;

  /** Bewertet eine Karte, speichert sie und liefert die restliche Warteschlange. */
  async function rateAndQueue(before: Review, queueBefore: Review[], grade: Grade): Promise<Review[]> {
    const now = Date.now();
    const updated = rateReview(before, grade, now);
    await saveReview(updated);
    let rest = queueBefore.slice(1);
    // Bald wieder fällig (Lernphase)? → in dieser Einheit 3–5 Karten später nochmal
    if (updated.due - now <= LEARN_AHEAD_MS) {
      const pos = Math.min(rest.length, 3 + Math.floor(Math.random() * 3));
      rest = [...rest.slice(0, pos), updated, ...rest.slice(pos)];
    }
    return rest;
  }

  /** Bewertung speichern (ohne weiterzugehen). */
  async function answer(grade: Grade): Promise<void> {
    if (!current || busy.current || answered) return;
    busy.current = true;
    try {
      const rest = await rateAndQueue(current, queue, grade);
      undoStack.current.push({ queue, done, before: current });
      setAnswered({ grade, nextQueue: rest });
    } finally {
      busy.current = false;
    }
  }

  /** Zur nächsten Karte gehen (Warteschlange übernehmen, ggf. Einheit beenden). */
  function advance(nextQueue: Review[]): void {
    if (!settings) return;
    const newDone = done + 1;
    setQueue(nextQueue);
    setDone(newDone);
    setAnswered(null);
    setCardKey((k) => k + 1);
    if (nextQueue.length === 0 || newDone >= settings.sessionSize) {
      setFinished(true);
      requestSync('session');
    }
  }

  /** Zur nächsten Karte (nach answer). */
  function next(): void {
    if (answered) advance(answered.nextQueue);
  }

  /** Karteikarten: bewerten und sofort weiter. */
  async function rateAndNext(grade: Grade): Promise<void> {
    if (!current || busy.current) return;
    busy.current = true;
    try {
      const rest = await rateAndQueue(current, queue, grade);
      undoStack.current.push({ queue, done, before: current });
      advance(rest);
    } finally {
      busy.current = false;
    }
  }

  /** Letzte Bewertung zurücknehmen (alter Lernstand wird wiederhergestellt). */
  async function undoLast(): Promise<boolean> {
    const snap = undoStack.current.pop();
    if (!snap) return false;
    await saveReview({ ...snap.before, updated_at: Date.now() });
    setQueue(snap.queue);
    setDone(snap.done);
    setAnswered(null);
    setFinished(false);
    setCardKey((k) => k + 1);
    return true;
  }

  /** Die gerade gegebene Bewertung ersetzen (z. B. „Ich lag richtig“). */
  async function regrade(grade: Grade): Promise<void> {
    if (!answered) return;
    const snap = undoStack.current[undoStack.current.length - 1];
    if (!snap) return;
    // Neu bewerten auf Basis des Lernstands VOR der ersten Bewertung
    const rest = await rateAndQueue(snap.before, snap.queue, grade);
    setAnswered({ grade, nextQueue: rest });
  }

  const total = settings ? Math.min(settings.sessionSize, done + queue.length) : 0;

  return {
    loading,
    settings,
    pool,
    current,
    word,
    done,
    total,
    finished,
    nextDue,
    answered,
    cardKey,
    answer,
    next,
    rateAndNext,
    regrade,
    undoLast,
    restart,
  };
}

export type ReviewSession = ReturnType<typeof useReviewSession>;
