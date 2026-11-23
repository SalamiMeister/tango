// Lernseite: wählt anhand der Adresse den Modus (Karten, Auswahl, Tippen, Hören, Zuordnen)
// und zeigt Fortschritt, „Nichts fällig“ und „Geschafft – weiter oder fertig?“.

import { useState, useEffect } from 'react';
import { navigate, type Route } from '../router';
import { useToast } from '../components/Toast';
import { formatInterval, GRADE_LABELS } from '../lib/fsrs';
import { loadSettings } from '../repo';
import { DEFAULT_SETTINGS, type Grade } from '../types';
import { extraNewPath, filterFromRoute, MODES, modeFromRoute, regularPath, type Mode } from '../learn/modes';
import { useReviewSession } from '../learn/useReviewSession';
import { FlashcardView } from '../learn/FlashcardView';
import { ChoiceView } from '../learn/ChoiceView';
import { TypingView } from '../learn/TypingView';
import { MatchGame } from '../learn/MatchGame';
import { useKeys } from '../learn/useKeys';
import { EXTRA_NEW_BATCH, type SessionFilter } from '../lib/session';

export function Learn({ route }: { route: Route }) {
  const mode = modeFromRoute(route);
  if (mode === 'zuordnen') return <MatchPage route={route} />;
  return <ReviewPage route={route} mode={mode} />;
}

function MatchPage({ route }: { route: Route }) {
  const [filter, setFilter] = useState<SessionFilter | null>(null);
  useEffect(() => {
    loadSettings().then((s) => setFilter(filterFromRoute(route, s, 'zuordnen')));
  }, [route]);
  return filter ? <MatchGame filter={filter} /> : <div className="page">Lade …</div>;
}

function ReviewPage({ route, mode }: { route: Route; mode: Mode }) {
  const toast = useToast();
  const s = useReviewSession(route, mode);
  const settings = s.settings ?? DEFAULT_SETTINGS;

  async function undo() {
    if (await s.undoLast()) toast('Letzte Bewertung zurückgenommen', { duration: 2000 });
  }

  // Seitenweite Tasten: Esc = beenden, Rücktaste/Strg+Z = letzte Bewertung zurücknehmen
  useKeys((e) => {
    if (e.key === 'Escape') navigate('/');
    else if ((e.key === 'z' && (e.ctrlKey || e.metaKey)) || e.key === 'Backspace') {
      e.preventDefault();
      undo();
    }
  });

  if (s.loading || !s.settings) return <div className="page">Lade …</div>;

  // Tageslimit für neue Karten erreicht, aber es warten noch neue → „Noch mehr neue lernen“
  const outlook = s.outlook;
  const inExtra = route.query.has('extraNeu');
  const extraCount = outlook ? Math.min(EXTRA_NEW_BATCH, outlook.heldBack) : 0;
  const canExtra = !!outlook && outlook.fresh === 0 && outlook.heldBack > 0;
  const leftRegular = outlook ? outlook.due + outlook.fresh : 1;

  function learnExtra() {
    // Schon in einer Zusatzrunde: einfach die nächsten neuen laden
    if (inExtra) s.restart();
    else navigate(extraNewPath(route, EXTRA_NEW_BATCH));
  }
  function continueRegular() {
    if (inExtra) navigate(regularPath(route));
    else s.restart();
  }

  const extraHint = canExtra && outlook && (
    <p className="muted">
      Dein Tagesziel von {settings.newPerDay} neuen Vokabeln ist erreicht.
      <br />
      Es warten noch {outlook.heldBack} neue Karten.
    </p>
  );
  const extraButton = (primary: boolean) =>
    canExtra && (
      <button type="button" className={primary ? 'primary big' : 'big'} onClick={learnExtra}>
        {extraCount} weitere neue lernen
      </button>
    );

  // --- Nichts zu lernen
  if (!s.finished && !s.current) {
    return (
      <div className="page center">
        <h2>Nichts fällig 🎉</h2>
        {s.nextDue && <p className="muted">Nächste Karte fällig in {formatInterval(s.nextDue - Date.now())}.</p>}
        {extraHint}
        <div className="bottom-actions">
          {extraButton(true)}
          <button
            type="button"
            className={canExtra ? 'big' : 'primary big'}
            onClick={() => navigate('/lernen?modus=zuordnen')}
          >
            Trotzdem üben: Zuordnen
          </button>
          <button type="button" className="big" onClick={() => navigate('/')}>
            Zum Start
          </button>
        </div>
      </div>
    );
  }

  // --- Einheit geschafft: weiter oder fertig?
  if (s.finished) {
    return (
      <div className="page center">
        <h2>Geschafft! 🎉</h2>
        <p>{s.done} Karten bewertet.</p>
        {extraHint}
        <div className="bottom-actions">
          {leftRegular > 0 && (
            <button type="button" className="primary big" onClick={continueRegular}>
              Weiter lernen ({leftRegular})
            </button>
          )}
          {extraButton(leftRegular === 0)}
          <button type="button" className="big" onClick={() => navigate('/')}>
            Fertig
          </button>
        </div>
      </div>
    );
  }

  const { current, word } = s;
  if (!current || !word) return null;

  const progress = s.done / Math.max(1, s.total);
  const modeLabel = MODES.find((m) => m.id === mode)?.short;

  /** Karteikarte: bewerten und sofort weiter (mit Rückgängig-Hinweis). */
  async function rateCard(g: Grade) {
    await s.rateAndNext(g);
    toast(`Bewertet: ${GRADE_LABELS[g]}`, { duration: 3000, undo });
  }

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
          {modeLabel} · {s.done}/{s.total}
        </span>
      </div>

      {mode === 'karten' && (
        <FlashcardView key={s.cardKey} review={current} word={word} settings={settings} onRate={rateCard} />
      )}
      {(mode === 'auswahl' || mode === 'hoeren') && (
        <ChoiceView
          key={s.cardKey}
          review={current}
          word={word}
          pool={s.pool}
          listen={mode === 'hoeren'}
          answered={s.answered}
          onAnswer={s.answer}
          onNext={s.next}
        />
      )}
      {mode === 'tippen' && (
        <TypingView
          key={s.cardKey}
          review={current}
          word={word}
          answered={s.answered}
          onAnswer={s.answer}
          onRegrade={s.regrade}
          onNext={s.next}
        />
      )}
    </div>
  );
}
