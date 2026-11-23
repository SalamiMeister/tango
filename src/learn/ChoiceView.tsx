// Multiple Choice (und Hören): 4 Antworten, eine richtig.
// Falsche Antworten bevorzugt aus derselben Lektion / Wortart.
// Richtig = „Gut“, falsch = „Nochmal“ (fließt in FSRS ein).

import { useEffect, useMemo, useState } from 'react';
import type { Grade, Review, Word } from '../types';
import { meaningLabel, pickDistractors, shuffle } from '../lib/choices';
import { hasJapaneseVoice, speakJapanese } from '../lib/speech';
import { JapaneseText, WordReveal } from './WordReveal';
import { CardTags } from './FlashcardView';
import { useKeys } from './useKeys';
import type { Answered } from './useReviewSession';

interface Props {
  review: Review;
  word: Word;
  pool: Word[];
  listen: boolean;
  answered: Answered | null;
  onAnswer: (g: Grade) => void;
  onNext: () => void;
}

export function ChoiceView({ review, word, pool, listen, answered, onAnswer, onNext }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const [voiceOk, setVoiceOk] = useState(true);

  // Antwortmöglichkeiten einmal pro Karte festlegen
  const options = useMemo(() => shuffle([word, ...pickDistractors(word, pool, 3)]), [word.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const showJpOptions = !listen && review.direction === 'de_jp';

  // Beim Hören: Wort automatisch vorlesen
  useEffect(() => {
    if (!listen) return;
    hasJapaneseVoice().then(setVoiceOk);
    const t = setTimeout(() => speakJapanese(word.kana), 250);
    return () => clearTimeout(t);
  }, [listen, word.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Richtig → nach kurzer Zeit automatisch weiter
  useEffect(() => {
    if (answered && answered.grade >= 3 && picked === word.id) {
      const t = setTimeout(onNext, 900);
      return () => clearTimeout(t);
    }
  }, [answered, picked]); // eslint-disable-line react-hooks/exhaustive-deps

  function choose(w: Word) {
    if (picked) return;
    setPicked(w.id);
    onAnswer(w.id === word.id ? 3 : 1);
  }

  useKeys((e) => {
    const n = Number(e.key);
    if (!picked && n >= 1 && n <= options.length) {
      e.preventDefault();
      choose(options[n - 1]);
    } else if (picked && answered && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onNext();
    } else if (listen && !picked && (e.key === ' ' || e.key.toLowerCase() === 'r')) {
      e.preventDefault();
      speakJapanese(word.kana);
    }
  });

  const correct = picked === word.id;

  return (
    <>
      <div className="flashcard flipped quiz">
        <CardTags review={review} word={word} />
        {listen ? (
          <div className="listen">
            <button type="button" className="listen-btn" onClick={() => speakJapanese(word.kana)} aria-label="Nochmal anhören">
              🔊
            </button>
            {!voiceOk && (
              <p className="warn small">
                Keine japanische Stimme gefunden. Windows: Einstellungen → Zeit und Sprache → Sprache → Japanisch
                hinzufügen. Android: Einstellungen → Sprachausgabe → Japanisch installieren.
              </p>
            )}
            {!picked && <p className="muted small">Leertaste oder R = nochmal anhören</p>}
          </div>
        ) : review.direction === 'jp_de' ? (
          <JapaneseText word={word} big />
        ) : (
          <div className="meaning big">{word.meaning_de.join(', ')}</div>
        )}

        {picked && (
          <div className="answer">
            <div className={`verdict ${correct ? 'ok' : 'bad'}`}>{correct ? '✓ Richtig' : '✗ Leider falsch'}</div>
            {(!correct || listen) && (
              <WordReveal word={word} omit={listen ? undefined : review.direction === 'jp_de' ? 'jp' : 'de'} />
            )}
          </div>
        )}
      </div>

      <div className="bottom-actions">
        <div className={`choices ${showJpOptions ? 'jp-options' : ''}`}>
          {options.map((o, i) => {
            const state = !picked ? '' : o.id === word.id ? 'right' : o.id === picked ? 'wrong' : 'dim';
            return (
              <button key={o.id} type="button" className={`choice ${state}`} onClick={() => choose(o)} disabled={!!picked}>
                <span className="choice-key">{i + 1}</span>
                {showJpOptions ? (
                  <span lang="ja">
                    {o.kanji ?? o.kana}
                    {o.kanji && <small> {o.kana}</small>}
                  </span>
                ) : (
                  <span>{meaningLabel(o)}</span>
                )}
              </button>
            );
          })}
        </div>
        {picked && answered && (
          <button type="button" className="primary big" onClick={onNext}>
            Weiter (Enter)
          </button>
        )}
      </div>
    </>
  );
}
