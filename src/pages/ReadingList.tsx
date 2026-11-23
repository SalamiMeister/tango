// Lesen: Beispielsätze (Tatoeba) nach Anteil bekannter Wörter, und eigene Texte.

import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { navigate, type Route } from '../router';
import { knownRatio } from '../reading/readingCore';
import { examplesCached, loadExamples, type ExampleSentence } from '../reading/tatoeba';
import { useKnownSet } from '../reading/useKnown';
import { getPref, setPref } from '../lib/localPrefs';
import { setSentenceOrder } from '../reading/sentenceOrder';

export function ReadingList({ route }: { route: Route }) {
  const tab = route.query.get('tab') === 'texte' ? 'texte' : 'saetze';
  return (
    <div className="page reading-list">
      <h2>Lesen</h2>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'saetze'} className={tab === 'saetze' ? 'active' : ''} onClick={() => navigate('/lesen')}>
          Beispielsätze
        </button>
        <button type="button" role="tab" aria-selected={tab === 'texte'} className={tab === 'texte' ? 'active' : ''} onClick={() => navigate('/lesen?tab=texte')}>
          Meine Texte
        </button>
      </div>
      {tab === 'saetze' ? <Sentences /> : <Texts />}
    </div>
  );
}

const MIN_OPTIONS = [1, 0.9, 0.8, 0.7, 0.5];

function Sentences() {
  const { known, includeUnlearned, setIncludeUnlearned } = useKnownSet();
  const [examples, setExamples] = useState<ExampleSentence[] | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const [min, setMin] = useState(() => getPref('readMin', 0.9));
  const [limit, setLimit] = useState(50);

  async function load() {
    setState('loading');
    try {
      setExamples(await loadExamples());
      setState('idle');
    } catch (e) {
      setError((e as Error).message);
      setState('error');
    }
  }

  // Schon im Offline-Speicher? Dann direkt laden.
  useEffect(() => {
    examplesCached().then((c) => {
      if (c) load();
    });
  }, []);

  const matches = useMemo(() => {
    if (!examples || !known) return [];
    return examples
      .map((s) => ({ s, r: knownRatio(s.tokens, known) }))
      .filter((x) => x.r.total > 0 && x.r.ratio >= min - 1e-9)
      .sort((a, b) => b.r.ratio - a.r.ratio || b.r.known - a.r.known || a.s.ja.length - b.s.ja.length);
  }, [examples, known, min]);

  useEffect(() => setSentenceOrder(matches.map((m) => m.s.id)), [matches]);

  if (!examples) {
    return (
      <div className="card">
        <p>
          Über 49.000 japanische Beispielsätze mit deutscher Übersetzung von{' '}
          <a href="https://tatoeba.org" target="_blank" rel="noreferrer">
            Tatoeba
          </a>
          . Die App zeigt die Sätze, die du mit deinen Vokabeln schon lesen kannst.
        </p>
        <button type="button" className="primary" onClick={load} disabled={state === 'loading'}>
          {state === 'loading' ? 'Lade … (ca. 5 MB)' : 'Beispielsätze laden (ca. 5 MB, einmalig)'}
        </button>
        {state === 'error' && <p className="error">{error}</p>}
      </div>
    );
  }

  return (
    <>
      <div className="row wrap reading-filter">
        <label>
          <span>Bekannte Wörter mindestens</span>
          <select
            value={min}
            onChange={(e) => {
              setMin(Number(e.target.value));
              setPref('readMin', Number(e.target.value));
              setLimit(50);
            }}
          >
            {MIN_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {Math.round(m * 100)} %
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={includeUnlearned} onChange={(e) => setIncludeUnlearned(e.target.checked)} />
          <span>auch noch nicht gelernte Vokabeln zählen</span>
        </label>
      </div>
      <p className="muted small">{matches.length} passende Sätze</p>
      {matches.length === 0 && (
        <p className="muted">
          Noch keine passenden Sätze. Mit jeder gelernten Vokabel werden es mehr – oder den Mindestanteil senken bzw.
          „auch noch nicht gelernte Vokabeln“ anhaken.
        </p>
      )}
      <ul className="sentence-list">
        {matches.slice(0, limit).map(({ s, r }) => (
          <li key={s.id}>
            <button type="button" onClick={() => navigate(`/lesen/satz/${s.id}`)}>
              <span className="sl-ja" lang="ja">
                {s.ja}
              </span>
              <span className={`sl-ratio ${r.ratio === 1 ? 'full' : ''}`}>{Math.round(r.ratio * 100)} %</span>
            </button>
          </li>
        ))}
      </ul>
      {matches.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + 50)}>
          Mehr anzeigen
        </button>
      )}
      <p className="muted small credit">
        Sätze und Übersetzungen:{' '}
        <a href="https://tatoeba.org" target="_blank" rel="noreferrer">
          Tatoeba
        </a>{' '}
        (CC BY 2.0 FR) – die Autoren stehen beim jeweiligen Satz.
      </p>
    </>
  );
}

function Texts() {
  const { known } = useKnownSet();
  const passages = useLiveQuery(async () => (await db.passages.toArray()).filter((p) => !p.deleted).sort((a, b) => b.created_at - a.created_at), []);

  return (
    <>
      <div className="row wrap">
        <button type="button" className="primary" onClick={() => navigate('/lesen/neu')}>
          + Text einfügen
        </button>
        <button type="button" onClick={() => navigate('/lesen/prompt')}>
          Prompt für KI erzeugen
        </button>
      </div>
      <p className="muted small">
        Texte aus dem Kurs einfügen – oder mit dem Prompt von Claude bzw. einem anderen KI-Chat einen Text nur aus
        deinen Vokabeln schreiben lassen und hier einfügen.
      </p>
      {passages?.length === 0 && <p className="muted">Noch keine eigenen Texte.</p>}
      <ul className="sentence-list">
        {(passages ?? []).map((p) => {
          const r = known && p.tokens ? knownRatio(p.tokens, known) : null;
          return (
            <li key={p.id}>
              <button type="button" onClick={() => navigate(`/lesen/text/${p.id}`)}>
                <span className="sl-ja" lang="ja">
                  {p.title || p.text_ja.split('\n')[0].slice(0, 40)}
                  <small className="muted"> · {p.source === 'KI' ? 'KI-Text' : 'eigener Text'}</small>
                </span>
                {r && <span className={`sl-ratio ${r.ratio === 1 ? 'full' : ''}`}>{Math.round(r.ratio * 100)} %</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
