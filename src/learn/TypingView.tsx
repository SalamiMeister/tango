// Eintippen: DE→JP in Romaji (wird zu Kana; Kana und Kanji zählen), JP→DE auf Deutsch (tolerant).
// Richtig = „Gut“, Tippfehler = „Schwer“, falsch = „Nochmal“. „Ich lag richtig“ ändert auf „Gut“.

import { useEffect, useRef, useState } from 'react';
import type { Grade, Review, Word } from '../types';
import { checkGerman, checkJapanese, type CheckResult } from '../lib/answer';
import { KanaInput } from '../components/KanaInput';
import { JapaneseText, WordReveal } from './WordReveal';
import { CardTags } from './FlashcardView';
import { useKeys } from './useKeys';
import type { Answered } from './useReviewSession';

interface Props {
  review: Review;
  word: Word;
  answered: Answered | null;
  onAnswer: (g: Grade) => void;
  onRegrade: (g: Grade) => void;
  onNext: () => void;
}

const GRADE_FOR: Record<CheckResult, Grade> = { correct: 3, variant: 3, typo: 2, wrong: 1 };

export function TypingView({ review, word, answered, onAnswer, onRegrade, onNext }: Props) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [overridden, setOverridden] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toJapanese = review.direction === 'de_jp';

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function check() {
    if (result) return;
    const r = toJapanese ? checkJapanese(input, word) : checkGerman(input, word.meaning_de);
    setResult(r);
    onAnswer(GRADE_FOR[r]);
  }

  // Nach der Prüfung: Enter = weiter (das Eingabefeld ist dann gesperrt)
  useKeys((e) => {
    if (result && answered && e.key === 'Enter') {
      e.preventDefault();
      onNext();
    }
  });

  return (
    <>
      <div className="flashcard flipped quiz">
        <CardTags review={review} word={word} />
        {toJapanese ? (
          <div className="meaning big">{word.meaning_de.join(', ')}</div>
        ) : (
          <JapaneseText word={word} big />
        )}

        <form
          className="type-form"
          onSubmit={(e) => {
            e.preventDefault();
            check();
          }}
        >
          {toJapanese ? (
            <KanaInput
              ref={inputRef}
              value={input}
              onChange={setInput}
              placeholder="Romaji tippen, z. B. taberu"
              disabled={!!result}
              enterKeyHint="done"
            />
          ) : (
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Bedeutung auf Deutsch"
              disabled={!!result}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="done"
            />
          )}
        </form>

        {result && (
          <div className="answer">
            <div className={`verdict ${result === 'wrong' && !overridden ? 'bad' : 'ok'}`}>
              {overridden
                ? '✓ Als richtig gewertet'
                : result === 'correct'
                  ? '✓ Richtig'
                  : result === 'variant'
                    ? `✓ Richtig – in Kana geschrieben: ${word.kana}`
                    : result === 'typo'
                    ? '≈ Fast richtig (Tippfehler) – als „Schwer“ gewertet'
                    : '✗ Leider falsch'}
            </div>
            <WordReveal word={word} omit={toJapanese ? 'de' : 'jp'} />
          </div>
        )}
      </div>

      <div className="bottom-actions">
        {!result ? (
          <button type="button" className="primary big" onClick={check}>
            Prüfen (Enter)
          </button>
        ) : (
          <>
            {(result === 'typo' || result === 'wrong') && !overridden && answered && (
              <button
                type="button"
                className="big"
                onClick={() => {
                  setOverridden(true);
                  onRegrade(3);
                }}
              >
                Ich lag richtig
              </button>
            )}
            {answered && (
              <button type="button" className="primary big" onClick={onNext}>
                Weiter (Enter)
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
