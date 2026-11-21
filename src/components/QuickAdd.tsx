// Schnelleingabe als Fenster von unten (über den schwebenden „+“-Knopf erreichbar).

import { useEffect } from 'react';
import { WordForm } from './WordForm';
import { useToast } from './Toast';
import { useWords } from '../hooks';
import { addWord, softDeleteWords } from '../repo';
import { getPref, setPref } from '../lib/localPrefs';
import { parseLesson } from '../lib/text';

export function QuickAdd({ onClose }: { onClose: () => void }) {
  const words = useWords() ?? [];
  const toast = useToast();
  const sticky = getPref('quickAddSticky', { source: 'Genki 1', lesson: '' });

  // Escape schließt das Fenster
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Neue Vokabel">
        <div className="sheet-head">
          <h2>Neue Vokabel</h2>
          <button type="button" className="icon" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>
        <WordForm
          mode="quick"
          words={words}
          initial={{ source: sticky.source, lesson: parseLesson(sticky.lesson) }}
          onStickyChange={(source, lesson) => setPref('quickAddSticky', { source, lesson })}
          onSubmit={async (draft) => {
            const w = await addWord(draft);
            toast(`Gespeichert: ${w.kanji ?? w.kana} – ${w.meaning_de.join(', ')}`, {
              undo: async () => {
                await softDeleteWords([w.id]);
              },
            });
          }}
        />
      </div>
    </div>
  );
}
