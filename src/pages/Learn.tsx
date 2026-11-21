// Karteikarten mit FSRS. Vorderseite → Tippen/Leertaste → Rückseite → Bewertung 1–4.
// Jede Bewertung wird sofort gespeichert; die Einheit kann jederzeit beendet werden.

import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../db';
import type { DirectionSetting, Grade, Review, Settings, Word } from '../types';
import { formatInterval, GRADE_LABELS, previewIntervals, rateReview } from '../lib/fsrs';
import { buildSessionQueue, LEARN_AHEAD_MS, nextDueAt, queueParts, type SessionFilter } from '../lib/session';
import { loadSettings, saveReview } from '../repo';
import { navigate, type Route } from '../router';
import { useToast } from '../components/Toast';
import { canSpeak, speakJapanese } from '../lib/speech';

interface Snapshot {
  queue: Review[];
  done: number;
  before: Review;
}

function filterFromRoute(route: Route, settings: Settings): SessionFilter {
  const lesson = route.query.get('lektion');
  const dir = route.query.get('richtung') as DirectionSetting | null;
  return {
    direction: dir ?? settings.direction,
    lesson: lesson ? Number(lesson) : undefined,
    tag: route.query.get('tag') ?? undefined,
    onlyDue: route.query.get('nurFaellig') === '1',
  };
}

export function Learn({ route }: { route: Route }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [words, setWords] = useState<Map<string, Word>>(new Map());
  const [queue, setQueue] = useState<Review[]>([]);
  const [done, setDone] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [finished, setFinished] = useState(false);
  const [nextDue, setNextDue] = useState<number | undefined>();
  const undoStack = useRef<Snapshot[]>([]);
  const routeKey = route.query.toString();

  /** Lädt eine neue Einheit aus der Datenbank. */
  const startSession = useCallback(async () => {
    setLoading(true);
    const s = await loadSettings();
    const allWords = (await db.words.toArray()).filter((w) => !w.deleted);
    const allReviews = (await db.reviews.toArray()).filter((r) => !r.deleted);
    const filter = filterFromRoute(route, s);
    const parts = queueParts(allWords, allReviews, s, filter, Date.now());
    setSettings(s);
    setWords(new Map(allWords.map((w) => [w.id, w])));
    setQueue(buildSessionQueue(parts, s.sessionSize));
    setNextDue(nextDueAt(allWords, allReviews, filter));
    setDone(0);
    setFlipped(false);
    setFinished(false);
    undoStack.current = [];
    setLoading(false);
  }, [routeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    startSession();
  }, [startSession]);

  const current = queue[0];
  const word = current ? words.get(current.word_id) : undefined;

  // Schutz gegen doppeltes Bewerten (z. B. zweimal schnell „3“ gedrückt)
  const busy = useRef(false);

  async function rate(grade: Grade) {
    if (!current || !settings || busy.current) return;
    busy.current = true;
    try {
      const now = Date.now();
      const updated = rateReview(current, grade, now);
      await saveReview(updated);
      undoStack.current.push({ queue, done, before: current });

      let rest = queue.slice(1);
      // Karte in der Lernphase, die bald wieder fällig ist? → später in dieser Einheit nochmal
      if (updated.due - now <= LEARN_AHEAD_MS) {
        const pos = Math.min(rest.length, 3 + Math.floor(Math.random() * 3));
        rest = [...rest.slice(0, pos), updated, ...rest.slice(pos)];
      }
      const newDone = done + 1;
      setQueue(rest);
      setDone(newDone);
      setFlipped(false);
      if (rest.length === 0 || newDone >= settings.sessionSize) setFinished(true);

      toast(`Bewertet: ${GRADE_LABELS[grade]}`, { duration: 3000, undo: undoLast });
    } finally {
      busy.current = false;
    }
  }

  /** Letzte Bewertung zurücknehmen: alter Lernstand wird wiederhergestellt. */
  async function undoLast() {
    const snap = undoStack.current.pop();
    if (!snap) return;
    await saveReview({ ...snap.before, updated_at: Date.now() });
    setQueue(snap.queue);
    setDone(snap.done);
    setFlipped(true);
    setFinished(false);
  }

  // Tastenkürzel: Leertaste/Enter = umdrehen, 1–4 = bewerten, Rücktaste = rückgängig, Esc = beenden.
  // Der Handler wird bei jedem Rendern neu in einer Ref abgelegt, damit er immer den aktuellen Zustand sieht.
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'Escape') return navigate('/');
    if ((e.key === 'z' && (e.ctrlKey || e.metaKey)) || e.key === 'Backspace') {
      e.preventDefault();
      undoLast();
      return;
    }
    if (finished || !current) return;
    if ((e.key === ' ' || e.key === 'Enter') && !flipped) {
      e.preventDefault();
      setFlipped(true);
    } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
      e.preventDefault();
      rate(Number(e.key) as Grade);
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (loading || !settings) return <div className="page">Lade …</div>;

  // --- Nichts zu lernen
  if (!finished && !current) {
    return (
      <div className="page center">
        <h2>Nichts fällig 🎉</h2>
        {nextDue && <p className="muted">Nächste Karte fällig in {formatInterval(nextDue - Date.now())}.</p>}
        <div className="bottom-actions">
          <button type="button" className="big" onClick={() => navigate('/')}>
            Zum Start
          </button>
        </div>
      </div>
    );
  }

  // --- Einheit geschafft: weiter oder fertig?
  if (finished) {
    return (
      <div className="page center">
        <h2>Geschafft! 🎉</h2>
        <p>{done} Karten bewertet.</p>
        <div className="bottom-actions">
          <button type="button" className="primary big" onClick={startSession}>
            Weiter lernen
          </button>
          <button type="button" className="big" onClick={() => navigate('/')}>
            Fertig
          </button>
        </div>
      </div>
    );
  }

  if (!word) return null;

  const jpFront = current.direction === 'jp_de';
  const intervals = flipped ? previewIntervals(current, Date.now()) : null;
  const progress = done / Math.max(1, Math.min(settings.sessionSize, done + queue.length));
  const isNew = current.state === 0;

  const jpBlock = (big: boolean, showKana: boolean) => (
    <div className={`jp ${big ? 'big' : ''}`} lang="ja">
      <div className="jp-main">{word.kanji ?? word.kana}</div>
      {word.kanji && showKana && <div className="jp-kana">{word.kana}</div>}
    </div>
  );

  return (
    <div className="page learn">
      <div className="learn-top">
        <button type="button" className="icon" onClick={() => navigate('/')} aria-label="Beenden">
          ✕
        </button>
        <div className="progress">
          <div style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="muted small">
          {done}/{Math.min(settings.sessionSize, done + queue.length)}
        </span>
      </div>

      <div
        className={`flashcard ${flipped ? 'flipped' : ''}`}
        onClick={() => !flipped && setFlipped(true)}
        role="button"
        tabIndex={0}
        aria-label={flipped ? 'Rückseite' : 'Karte umdrehen'}
      >
        <div className="card-tags">
          <span>{jpFront ? 'JP → DE' : 'DE → JP'}</span>
          {isNew && <span className="badge-new">neu</span>}
          {word.lesson !== undefined && <span>L{word.lesson}</span>}
        </div>

        {/* Vorderseite */}
        {jpFront ? jpBlock(true, settings.showKanaOnFront) : <div className="meaning big">{word.meaning_de.join(', ')}</div>}

        {/* Rückseite */}
        {flipped && (
          <div className="answer">
            <hr />
            {jpFront ? (
              <>
                {word.kanji && !settings.showKanaOnFront && <div className="jp-kana" lang="ja">{word.kana}</div>}
                <div className="meaning">{word.meaning_de.join(', ')}</div>
              </>
            ) : (
              jpBlock(true, true)
            )}
            <div className="muted small">
              {word.romaji}
              {word.part_of_speech && ` · ${word.part_of_speech}`}
            </div>
            {word.note && <div className="note">{word.note}</div>}
            {canSpeak() && (
              <button
                type="button"
                className="icon speak"
                onClick={(e) => {
                  e.stopPropagation();
                  speakJapanese(word.kana);
                }}
                aria-label="Vorlesen"
              >
                🔊
              </button>
            )}
          </div>
        )}
        {!flipped && <div className="hint muted small">Tippen oder Leertaste zum Umdrehen</div>}
      </div>

      <div className="bottom-actions">
        {!flipped ? (
          <button type="button" className="primary big" onClick={() => setFlipped(true)}>
            Antwort zeigen
          </button>
        ) : (
          <div className="grades">
            {([1, 2, 3, 4] as Grade[]).map((g) => (
              <button key={g} type="button" className={`grade g${g}`} onClick={() => rate(g)}>
                <b>{GRADE_LABELS[g]}</b>
                <small>{formatInterval(intervals![g])}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
