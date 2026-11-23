// Zeigt eine Vokabel vollständig (nach der Antwort): Japanisch, Lesung, Bedeutung, Details.

import type { Word } from '../types';
import { canSpeak, speakJapanese } from '../lib/speech';

export function JapaneseText({ word, showKana = true, big = false }: { word: Word; showKana?: boolean; big?: boolean }) {
  return (
    <div className={`jp ${big ? 'big' : ''}`} lang="ja">
      <div className="jp-main">{word.kanji ?? word.kana}</div>
      {word.kanji && showKana && <div className="jp-kana">{word.kana}</div>}
    </div>
  );
}

export function SpeakButton({ text }: { text: string }) {
  if (!canSpeak()) return null;
  return (
    <button
      type="button"
      className="icon speak"
      onClick={(e) => {
        e.stopPropagation();
        speakJapanese(text);
      }}
      aria-label="Vorlesen"
      title="Vorlesen"
    >
      🔊
    </button>
  );
}

export function WordDetails({ word }: { word: Word }) {
  return (
    <>
      <div className="muted small">
        {word.romaji}
        {word.part_of_speech && ` · ${word.part_of_speech}`}
      </div>
      {word.note && <div className="note">{word.note}</div>}
      <SpeakButton text={word.kana} />
    </>
  );
}

/** omit: Teil, der schon als Frage oben steht und nicht doppelt erscheinen soll. */
export function WordReveal({ word, omit }: { word: Word; omit?: 'jp' | 'de' }) {
  return (
    <div className="reveal">
      {omit !== 'jp' && <JapaneseText word={word} />}
      {omit !== 'de' && <div className="meaning">{word.meaning_de.join(', ')}</div>}
      <WordDetails word={word} />
    </div>
  );
}
