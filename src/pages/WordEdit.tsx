// Eine Vokabel bearbeiten oder löschen. Zeigt auch den Lernstand beider Richtungen.

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useWords } from '../hooks';
import { WordForm } from '../components/WordForm';
import { useToast } from '../components/Toast';
import { softDeleteWords, updateWord } from '../repo';
import { navigate } from '../router';
import { formatInterval, STATE } from '../lib/fsrs';

const STATE_LABEL: Record<number, string> = {
  [STATE.New]: 'neu',
  [STATE.Learning]: 'lernt',
  [STATE.Review]: 'Wiederholung',
  [STATE.Relearning]: 'neu lernen',
};

export function WordEdit({ id }: { id: string }) {
  const words = useWords() ?? [];
  const word = useLiveQuery(() => db.words.get(id), [id]);
  const reviews = useLiveQuery(() => db.reviews.where('word_id').equals(id).toArray(), [id]);
  const toast = useToast();

  if (word === undefined) return <div className="page">Lade …</div>;
  if (!word || word.deleted) {
    return (
      <div className="page">
        <p>Vokabel nicht gefunden.</p>
        <button type="button" onClick={() => navigate('/vokabeln')}>
          Zur Liste
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <button type="button" className="icon" onClick={() => navigate('/vokabeln')} aria-label="Zurück">
          ←
        </button>
        <h2 lang="ja">{word.kanji ?? word.kana}</h2>
      </div>

      <WordForm
        key={word.id}
        mode="edit"
        words={words}
        editingId={word.id}
        initial={word}
        onSubmit={async (draft) => {
          await updateWord(word.id, draft);
          toast('Gespeichert');
          navigate('/vokabeln');
        }}
      />

      <h3>Lernstand</h3>
      <table className="review-table">
        <tbody>
          {(reviews ?? [])
            .filter((r) => !r.deleted)
            .sort((a) => (a.direction === 'jp_de' ? -1 : 1))
            .map((r) => (
              <tr key={r.id}>
                <td>{r.direction === 'jp_de' ? 'JP → DE' : 'DE → JP'}</td>
                <td>{STATE_LABEL[r.state]}</td>
                <td>
                  {r.state === STATE.New
                    ? '–'
                    : r.due <= Date.now()
                      ? 'fällig'
                      : `fällig in ${formatInterval(r.due - Date.now())}`}
                </td>
                <td className="muted small">
                  {r.reps}× gelernt, {r.lapses}× vergessen
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      <button
        type="button"
        className="danger"
        onClick={async () => {
          const undo = await softDeleteWords([word.id]);
          toast(`„${word.kanji ?? word.kana}“ gelöscht`, { undo });
          navigate('/vokabeln');
        }}
      >
        Vokabel löschen
      </button>
    </div>
  );
}
