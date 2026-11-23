// Karteikarte: Tippen/Leertaste dreht um, dann bewerten per Knopf, Taste 1–4 oder Wischen.
// Wischen (nach dem Umdrehen): ← Nochmal · → Gut · ↑ Leicht · ↓ Schwer

import { useRef, useState } from 'react';
import type { Grade, Review, Settings, Word } from '../types';
import { formatInterval, GRADE_LABELS, previewIntervals } from '../lib/fsrs';
import { JapaneseText, WordDetails } from './WordReveal';
import { useKeys } from './useKeys';

const SWIPE_MIN = 80; // Pixel, ab denen ein Wischen zählt

function swipeGrade(dx: number, dy: number): Grade | null {
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx <= -SWIPE_MIN) return 1;
    if (dx >= SWIPE_MIN) return 3;
  } else {
    if (dy <= -SWIPE_MIN) return 4;
    if (dy >= SWIPE_MIN) return 2;
  }
  return null;
}

interface Props {
  review: Review;
  word: Word;
  settings: Settings;
  onRate: (g: Grade) => void;
}

export function FlashcardView({ review, word, settings, onRate }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  useKeys((e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !flipped) {
      e.preventDefault();
      setFlipped(true);
    } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
      e.preventDefault();
      onRate(Number(e.key) as Grade);
    }
  });

  const jpFront = review.direction === 'jp_de';
  const intervals = flipped ? previewIntervals(review, Date.now()) : null;
  const pending = drag ? swipeGrade(drag.dx, drag.dy) : null;

  return (
    <>
      <div
        className={`flashcard ${flipped ? 'flipped' : ''} ${pending ? `swipe-g${pending}` : ''}`}
        style={drag ? { transform: `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx / 25}deg)` } : undefined}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!start.current || !flipped || e.pointerType === 'mouse' && e.buttons === 0) return;
          const dx = e.clientX - start.current.x;
          const dy = e.clientY - start.current.y;
          if (Math.abs(dx) > 8 || Math.abs(dy) > 8) setDrag({ dx, dy });
        }}
        onPointerUp={(e) => {
          const s = start.current;
          start.current = null;
          setDrag(null);
          if (!s) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (!flipped) {
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) setFlipped(true);
            return;
          }
          const g = swipeGrade(dx, dy);
          if (g) onRate(g);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDrag(null);
        }}
        role="button"
        tabIndex={0}
        aria-label={flipped ? 'Rückseite – wischen oder unten bewerten' : 'Karte umdrehen'}
      >
        <CardTags review={review} word={word} />
        {pending && <div className={`swipe-label g${pending}`}>{GRADE_LABELS[pending]}</div>}

        {jpFront ? (
          <JapaneseText word={word} big showKana={settings.showKanaOnFront} />
        ) : (
          <div className="meaning big">{word.meaning_de.join(', ')}</div>
        )}

        {flipped && (
          <div className="answer">
            <hr />
            {jpFront ? (
              <>
                {word.kanji && !settings.showKanaOnFront && (
                  <div className="jp-kana" lang="ja">
                    {word.kana}
                  </div>
                )}
                <div className="meaning">{word.meaning_de.join(', ')}</div>
              </>
            ) : (
              <JapaneseText word={word} big />
            )}
            <WordDetails word={word} />
          </div>
        )}
        <div className="hint muted small">
          {flipped ? '← Nochmal · Gut → · ↑ Leicht · ↓ Schwer' : 'Tippen oder Leertaste zum Umdrehen'}
        </div>
      </div>

      <div className="bottom-actions">
        {!flipped ? (
          <button type="button" className="primary big" onClick={() => setFlipped(true)}>
            Antwort zeigen
          </button>
        ) : (
          <div className="grades">
            {([1, 2, 3, 4] as Grade[]).map((g) => (
              <button key={g} type="button" className={`grade g${g}`} onClick={() => onRate(g)}>
                <b>{GRADE_LABELS[g]}</b>
                <small>{formatInterval(intervals![g])}</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function CardTags({ review, word }: { review: Review; word: Word }) {
  return (
    <div className="card-tags">
      <span>{review.direction === 'jp_de' ? 'JP → DE' : 'DE → JP'}</span>
      {review.state === 0 && <span className="badge-new">neu</span>}
      {word.lesson !== undefined && <span>L{word.lesson}</span>}
    </div>
  );
}
