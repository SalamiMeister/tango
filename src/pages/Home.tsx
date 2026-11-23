// Startbildschirm: ein großer Knopf „Lernen (N fällig)“, darunter ein paar Zahlen.

import { useMemo, useState } from 'react';
import { useReviews, useSettings, useWords } from '../hooks';
import { countNewToday, problemWordIds, queueParts, streakDays } from '../lib/session';
import { MODES, type Mode } from '../learn/modes';
import { PARTS_OF_SPEECH } from '../types';
import { navigate } from '../router';
import { analyzeTable, rowsToDrafts } from '../lib/tableImport';
import { applyImport, previewImport } from '../repo';
import { useToast } from '../components/Toast';
import exampleCsv from '../../examples/beispiel-vokabeln.csv?raw';
import type { DirectionSetting } from '../types';

export function Home() {
  const words = useWords();
  const reviews = useReviews();
  const settings = useSettings();
  const toast = useToast();
  const [lesson, setLesson] = useState('');
  const [direction, setDirection] = useState<DirectionSetting | ''>('');
  const [mode, setMode] = useState<Mode>('karten');
  const [pos, setPos] = useState('');
  const [onlyDue, setOnlyDue] = useState(false);
  const [onlyProblem, setOnlyProblem] = useState(false);

  const stats = useMemo(() => {
    if (!words || !reviews) return null;
    const now = Date.now();
    const parts = queueParts(words, reviews, settings, { direction: settings.direction }, now);
    return {
      due: parts.due.length,
      fresh: parts.fresh.length,
      newToday: countNewToday(reviews, now),
      words: words.length,
      active: words.filter((w) => w.active).length,
      streak: streakDays(reviews, now),
      problems: problemWordIds(reviews).size,
    };
  }, [words, reviews, settings]);

  const lessons = useMemo(
    () => [...new Set((words ?? []).map((w) => w.lesson).filter((l): l is number => l !== undefined))].sort((a, b) => a - b),
    [words],
  );

  if (!stats) return <div className="page">Lade …</div>;

  async function loadExamples() {
    const a = analyzeTable(exampleCsv);
    const drafts = rowsToDrafts(a.rows, a.mapping, a.hasHeader).flatMap((r) => (r.draft ? [r.draft] : []));
    const plan = await previewImport(drafts, 'skip');
    await applyImport(plan);
    toast(`${plan.create.length} Beispielvokabeln geladen`);
  }

  const total = stats.due + stats.fresh;

  return (
    <div className="page home">
      <h1 className="app-title">
        単語 <span>Tango</span>
      </h1>

      {stats.words === 0 ? (
        <div className="card empty">
          <p>Noch keine Vokabeln vorhanden. So geht's los:</p>
          <button type="button" className="primary big" onClick={() => navigate('/import')}>
            Vokabeln aus Tabelle einfügen
          </button>
          <button type="button" className="big" onClick={loadExamples}>
            10 Beispielvokabeln laden
          </button>
          <p className="muted">Oder einzeln über den „+“-Knopf unten rechts.</p>
        </div>
      ) : (
        <>
          <button type="button" className="primary huge" onClick={() => navigate('/lernen')} disabled={total === 0}>
            {total > 0 ? `Lernen (${total})` : 'Alles erledigt 🎉'}
            <small>
              {stats.due} fällig · {stats.fresh} neu
            </small>
          </button>

          {/* Andere Modi mit einem Tipp (gleiche Karten, andere Abfrage) */}
          <div className="mode-chips">
            {MODES.filter((m) => m.id !== 'karten').map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => navigate(`/lernen?modus=${m.id}`)}
                disabled={m.fsrs && total === 0}
              >
                {m.short}
              </button>
            ))}
          </div>

          <div className="stats">
            <div>
              <b>{stats.due}</b>
              <span>fällig</span>
            </div>
            <div>
              <b>{stats.fresh}</b>
              <span>neu heute übrig</span>
            </div>
            <div>
              <b>{stats.active}</b>
              <span>aktive Vokabeln</span>
            </div>
            <div>
              <b>{stats.streak}</b>
              <span>{stats.streak === 1 ? 'Tag in Folge' : 'Tage in Folge'}</span>
            </div>
          </div>

          <details className="card">
            <summary>Gezielt lernen</summary>
            <label>
              <span>Modus</span>
              <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                {MODES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="row">
              <label className="grow">
                <span>Lektion</span>
                <select value={lesson} onChange={(e) => setLesson(e.target.value)}>
                  <option value="">alle</option>
                  {lessons.map((l) => (
                    <option key={l} value={l}>
                      Lektion {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grow">
                <span>Richtung</span>
                <select value={direction} onChange={(e) => setDirection(e.target.value as DirectionSetting | '')}>
                  <option value="">Standard</option>
                  <option value="both">beide</option>
                  <option value="jp_de">Japanisch → Deutsch</option>
                  <option value="de_jp">Deutsch → Japanisch</option>
                </select>
              </label>
            </div>
            <label>
              <span>Wortart</span>
              <select value={pos} onChange={(e) => setPos(e.target.value)}>
                <option value="">alle</option>
                {PARTS_OF_SPEECH.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={onlyDue} onChange={(e) => setOnlyDue(e.target.checked)} />
              <span>nur fällige (keine neuen)</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={onlyProblem} onChange={(e) => setOnlyProblem(e.target.checked)} />
              <span>nur Problemwörter ({stats.problems}) – auch wenn nicht fällig</span>
            </label>
            <button
              type="button"
              className="primary"
              onClick={() => {
                const q = new URLSearchParams();
                if (mode !== 'karten') q.set('modus', mode);
                if (lesson) q.set('lektion', lesson);
                if (direction) q.set('richtung', direction);
                if (pos) q.set('wortart', pos);
                if (onlyDue) q.set('nurFaellig', '1');
                if (onlyProblem) q.set('problem', '1');
                navigate(`/lernen?${q}`);
              }}
            >
              Starten
            </button>
          </details>
        </>
      )}
    </div>
  );
}
