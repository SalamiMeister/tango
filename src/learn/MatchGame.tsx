// Zuordnen: 6 Paare Japanisch ↔ Deutsch auf Zeit verbinden. Reine Abwechslung – kein Einfluss auf FSRS.

import { useEffect, useMemo, useState } from 'react';
import { db } from '../db';
import type { Word } from '../types';
import { meaningLabel, shuffle } from '../lib/choices';
import { eligibleReviews, type SessionFilter } from '../lib/session';
import { STATE } from '../lib/fsrs';
import { getPref, setPref } from '../lib/localPrefs';
import { navigate } from '../router';

const PAIRS = 6;

interface Tile {
  id: string; // Wort-id
  side: 'jp' | 'de';
}

/** Wählt Wörter: bevorzugt schon gelernte, aufgefüllt mit neuen; keine doppelten Bedeutungen. */
async function pickWords(filter: SessionFilter): Promise<Word[]> {
  const words = (await db.words.toArray()).filter((w) => !w.deleted && w.active);
  const reviews = (await db.reviews.toArray()).filter((r) => !r.deleted);
  const eligibleIds = new Set(eligibleReviews(words, reviews, { ...filter, direction: 'both' }).map((r) => r.word_id));
  const seenIds = new Set(reviews.filter((r) => r.state !== STATE.New).map((r) => r.word_id));
  const candidates = words.filter((w) => eligibleIds.has(w.id));
  const ordered = [...shuffle(candidates.filter((w) => seenIds.has(w.id))), ...shuffle(candidates.filter((w) => !seenIds.has(w.id)))];
  const out: Word[] = [];
  const labels = new Set<string>();
  for (const w of ordered) {
    const k = meaningLabel(w).toLowerCase();
    if (labels.has(k)) continue;
    labels.add(k);
    out.push(w);
    if (out.length === PAIRS) break;
  }
  return out;
}

export function MatchGame({ filter }: { filter: SessionFilter }) {
  const [words, setWords] = useState<Word[] | null>(null);
  const [round, setRound] = useState(0);
  const [selected, setSelected] = useState<Tile | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<Tile[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [best, setBest] = useState<number | null>(() => getPref<number | null>('matchBest', null));

  useEffect(() => {
    pickWords(filter).then((w) => {
      setWords(w);
      setMatched(new Set());
      setSelected(null);
      setMistakes(0);
      setStartedAt(Date.now());
    });
  }, [round]); // eslint-disable-line react-hooks/exhaustive-deps

  const finished = !!words && words.length > 0 && matched.size === words.length;

  // Stoppuhr
  useEffect(() => {
    if (finished || !words) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [finished, words]);

  const left = useMemo(() => (words ? shuffle(words) : []), [words]);
  const right = useMemo(() => (words ? shuffle(words) : []), [words]);

  const elapsed = ((finished ? now : Date.now()) - startedAt) / 1000;

  function tap(tile: Tile) {
    if (matched.has(tile.id)) return;
    if (!selected || selected.side === tile.side) {
      setSelected(tile);
      return;
    }
    if (selected.id === tile.id) {
      const m = new Set(matched).add(tile.id);
      setMatched(m);
      setSelected(null);
      if (words && m.size === words.length) {
        const t = Date.now();
        setNow(t);
        const secs = (t - startedAt) / 1000;
        if (best === null || secs < best) {
          setBest(secs);
          setPref('matchBest', secs);
        }
      }
    } else {
      setMistakes((x) => x + 1);
      setWrong([selected, tile]);
      setSelected(null);
      setTimeout(() => setWrong([]), 500);
    }
  }

  if (!words) return <div className="page">Lade …</div>;
  if (words.length < 3) {
    return (
      <div className="page center">
        <h2>Zu wenige Vokabeln</h2>
        <p className="muted">Für „Zuordnen“ braucht es mindestens 3 aktive Vokabeln (mit dem gewählten Filter).</p>
        <div className="bottom-actions">
          <button type="button" className="big" onClick={() => navigate('/')}>
            Zum Start
          </button>
        </div>
      </div>
    );
  }

  const cls = (t: Tile) =>
    [
      'match-tile',
      matched.has(t.id) ? 'done' : '',
      selected && selected.id === t.id && selected.side === t.side ? 'sel' : '',
      wrong.some((w) => w.id === t.id && w.side === t.side) ? 'bad' : '',
    ].join(' ');

  return (
    <div className="page learn">
      <div className="learn-top">
        <button type="button" className="icon" onClick={() => navigate('/')} aria-label="Beenden">
          ✕
        </button>
        <b className="grow">Zuordnen</b>
        <span className="timer">{elapsed.toFixed(1).replace('.', ',')} s</span>
      </div>

      {finished ? (
        <div className="center match-result">
          <h2>Geschafft! 🎉</h2>
          <p>
            {elapsed.toFixed(1).replace('.', ',')} Sekunden · {mistakes} Fehler
          </p>
          {best !== null && <p className="muted">Bestzeit: {best.toFixed(1).replace('.', ',')} s</p>}
          <div className="bottom-actions">
            <button type="button" className="primary big" onClick={() => setRound((r) => r + 1)}>
              Neue Runde
            </button>
            <button type="button" className="big" onClick={() => navigate('/')}>
              Fertig
            </button>
          </div>
        </div>
      ) : (
        <div className="match-grid">
          <div className="match-col">
            {left.map((w) => (
              <button key={w.id} type="button" className={cls({ id: w.id, side: 'jp' })} onClick={() => tap({ id: w.id, side: 'jp' })} lang="ja">
                {w.kanji ?? w.kana}
                {w.kanji && <small>{w.kana}</small>}
              </button>
            ))}
          </div>
          <div className="match-col">
            {right.map((w) => (
              <button key={w.id} type="button" className={cls({ id: w.id, side: 'de' })} onClick={() => tap({ id: w.id, side: 'de' })}>
                {meaningLabel(w)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
