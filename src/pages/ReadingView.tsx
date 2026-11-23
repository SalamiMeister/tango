// Leseansicht: Wort antippen → Lesung und Bedeutung, unbekanntes Wort mit einem Tipp übernehmen.
// Furigana ein/aus, Vorlesen, Übersetzung erst auf Tipp.

import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { navigate } from '../router';
import type { DictEntry, Token, Word } from '../types';
import { furiganaSegments, isKnown, knownRatio } from '../reading/readingCore';
import { loadExamples, tatoebaLink, type ExampleSentence } from '../reading/tatoeba';
import { nextSentenceId } from '../reading/sentenceOrder';
import { useKnownSet } from '../reading/useKnown';
import { lookupExact, useDictInfo } from '../dict/dict';
import { entryToDraft, glossText, kataToHira } from '../dict/dictCore';
import { canSpeak, speakJapanese } from '../lib/speech';
import { getPref, setPref } from '../lib/localPrefs';
import { useQuickAdd } from '../components/quickAddContext';
import { useToast } from '../components/Toast';
import { softDeletePassage } from '../repo';

interface Shown {
  ja: string;
  tokens: Token[];
  translation?: string;
  credit?: ExampleSentence;
  source?: string;
}

export function ReadingView({ kind, id }: { kind: 'satz' | 'text'; id: string }) {
  const toast = useToast();
  const { known, words } = useKnownSet();
  const [furigana, setFurigana] = useState(() => getPref('furigana', true));
  const [showTranslation, setShowTranslation] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [sentence, setSentence] = useState<ExampleSentence | null | undefined>(undefined);
  const passage = useLiveQuery(() => (kind === 'text' ? db.passages.get(id) : undefined), [kind, id]);

  useEffect(() => {
    setShowTranslation(false);
    setSelected(null);
    if (kind !== 'satz') return;
    loadExamples()
      .then((all) => setSentence(all.find((s) => s.id === Number(id)) ?? null))
      .catch(() => setSentence(null));
  }, [kind, id]);

  const shown: Shown | null | undefined = useMemo(() => {
    if (kind === 'satz') {
      if (sentence === undefined) return undefined;
      return sentence && { ja: sentence.ja, tokens: sentence.tokens, translation: sentence.de, credit: sentence };
    }
    if (passage === undefined) return undefined;
    if (!passage || passage.deleted) return null;
    return { ja: passage.text_ja, tokens: passage.tokens ?? [], translation: passage.translation, source: passage.source };
  }, [kind, sentence, passage]);

  if (shown === undefined || !known) return <div className="page">Lade …</div>;
  if (shown === null) {
    return (
      <div className="page">
        <p>Text nicht gefunden.</p>
        <button type="button" onClick={() => navigate('/lesen')}>
          Zur Übersicht
        </button>
      </div>
    );
  }

  const ratio = knownRatio(shown.tokens, known);
  const next = kind === 'satz' ? nextSentenceId(Number(id)) : undefined;

  return (
    <div className="page reading">
      <div className="page-head">
        <button type="button" className="icon" onClick={() => navigate(kind === 'satz' ? '/lesen' : '/lesen?tab=texte')} aria-label="Zurück">
          ←
        </button>
        <span className="muted small grow">
          {ratio.known} von {ratio.total} Wörtern bekannt ({Math.round(ratio.ratio * 100)} %)
        </span>
        <button
          type="button"
          className={`toggle ${furigana ? 'on' : ''}`}
          onClick={() => {
            setFurigana(!furigana);
            setPref('furigana', !furigana);
          }}
          aria-pressed={furigana}
          title="Furigana ein/aus"
        >
          <span lang="ja">ふ</span> Furigana
        </button>
        {canSpeak() && (
          <button type="button" className="icon" onClick={() => speakJapanese(shown.ja)} aria-label="Vorlesen" title="Vorlesen">
            🔊
          </button>
        )}
      </div>

      <div className={`reading-text ${furigana ? 'with-furigana' : ''}`} lang="ja">
        {shown.tokens.map((t, i) =>
          t[0] === '\n' ? (
            <br key={i} />
          ) : t[3] === 1 ? (
            <button
              key={i}
              type="button"
              className={`tok ${isKnown(t, known) ? 'known' : 'unknown'} ${selected === i ? 'sel' : ''}`}
              onClick={() => setSelected(i)}
            >
              <TokenText t={t} furigana={furigana} />
            </button>
          ) : (
            <span key={i} className="tok-plain">
              <TokenText t={t} furigana={furigana} />
            </span>
          ),
        )}
      </div>
      <p className="muted small legend">
        <span className="tok unknown sample">unterstrichen</span> = noch nicht gelernt · Wort antippen für Bedeutung
      </p>

      {shown.translation ? (
        showTranslation ? (
          <div className="card translation">{shown.translation}</div>
        ) : (
          <button type="button" className="big" onClick={() => setShowTranslation(true)}>
            Übersetzung zeigen
          </button>
        )
      ) : (
        <p className="muted small">Keine Übersetzung hinterlegt.</p>
      )}

      {shown.credit && (
        <p className="muted small credit">
          Satz{' '}
          <a href={tatoebaLink(shown.credit.id)} target="_blank" rel="noreferrer">
            #{shown.credit.id}
          </a>
          {shown.credit.jaUser && ` von ${shown.credit.jaUser}`}, Übersetzung{' '}
          <a href={tatoebaLink(shown.credit.deId)} target="_blank" rel="noreferrer">
            #{shown.credit.deId}
          </a>
          {shown.credit.deUser && ` von ${shown.credit.deUser}`} · Quelle: Tatoeba, CC BY 2.0 FR
        </p>
      )}

      <div className="bottom-actions">
        {kind === 'satz' && next !== undefined && (
          <button type="button" className="primary big" onClick={() => navigate(`/lesen/satz/${next}`)}>
            Nächster Satz
          </button>
        )}
        {kind === 'text' && (
          <button
            type="button"
            className="danger"
            onClick={async () => {
              const undo = await softDeletePassage(id);
              toast('Text gelöscht', { undo });
              navigate('/lesen?tab=texte');
            }}
          >
            Text löschen
          </button>
        )}
      </div>

      {selected !== null && shown.tokens[selected] && (
        <TokenPopup token={shown.tokens[selected]} words={words ?? []} known={isKnown(shown.tokens[selected], known)} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function TokenText({ t, furigana }: { t: Token; furigana: boolean }) {
  if (!furigana || !t[2]) return <>{t[0]}</>;
  return (
    <>
      {furiganaSegments(t[0], t[2]).map((seg, i) =>
        seg.rt ? (
          <ruby key={i}>
            {seg.text}
            <rt>{seg.rt}</rt>
          </ruby>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  );
}

/** Pop-up zu einem Wort: eigene Vokabel oder Wörterbuch-Einträge, „Als Vokabel übernehmen“. */
function TokenPopup({ token, words, known, onClose }: { token: Token; words: Word[]; known: boolean; onClose: () => void }) {
  const openQuickAdd = useQuickAdd();
  const dictInfo = useDictInfo();
  const [entries, setEntries] = useState<DictEntry[] | null>(null);
  const [surface, base, reading] = token;

  const own = words.find(
    (w) => !w.deleted && (w.kanji === base || w.kana === base || kataToHira(w.kana) === kataToHira(base) || w.kanji === surface),
  );

  useEffect(() => {
    setEntries(null);
    lookupExact(base, surface).then((e) => setEntries(e.slice(0, 3)));
  }, [base, surface]);

  // Lesung der Grundform: aus dem Wörterbuch, sonst aus dem Text (nur wenn Grundform = Textform)
  const baseReading = entries?.[0]?.kana ?? (surface === base ? reading || base : '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="popup-backdrop" onClick={onClose}>
      <div className="popup" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Wort ${base}`}>
        <div className="popup-head">
          <div lang="ja">
            <span className="popup-word">{base}</span>
            {baseReading && baseReading !== base && <span className="popup-reading"> {baseReading}</span>}
            {surface !== base && <div className="muted small">im Text: {surface}</div>}
          </div>
          {canSpeak() && (
            <button type="button" className="icon" onClick={() => speakJapanese(baseReading || base)} aria-label="Vorlesen">
              🔊
            </button>
          )}
          <button type="button" className="icon" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>

        {own && (
          <div className="popup-own">
            <b>{known ? '✓ Deine Vokabel' : 'Deine Vokabel (noch nicht gelernt)'}:</b> {own.meaning_de.join(', ')}
            <button type="button" className="link" onClick={() => navigate(`/vokabeln/${own.id}`)}>
              öffnen
            </button>
          </div>
        )}

        {entries === null ? (
          <p className="muted small">Suche …</p>
        ) : entries.length > 0 ? (
          <ul className="popup-entries">
            {entries.map((e) => (
              <li key={e.id}>
                <div>
                  <span lang="ja">{e.flags & 2 || !e.kanji[0] ? e.kana : `${e.kanji[0]}（${e.kana}）`}</span>
                  <div className="small">{glossText(e, 4)}</div>
                </div>
                {!own && (
                  <button type="button" onClick={() => openQuickAdd(entryToDraft(e))}>
                    Übernehmen
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">
            {dictInfo?.core || dictInfo?.full ? 'Nicht im Wörterbuch.' : 'Wörterbuch nicht geladen (Mehr → Wörterbuch).'}
          </p>
        )}

        {!own && (entries?.length ?? 0) === 0 && (
          <button
            type="button"
            className="primary"
            onClick={() => openQuickAdd({ kana: baseReading || undefined, kanji: /\p{Script=Han}/u.test(base) ? base : undefined })}
          >
            Als Vokabel übernehmen
          </button>
        )}
        <p className="dict-credit">
          Wörterbuch:{' '}
          <a href="https://www.wadoku.de" target="_blank" rel="noreferrer">
            www.wadoku.de
          </a>{' '}
          · JMdict (EDRDG)
        </p>
      </div>
    </div>
  );
}
