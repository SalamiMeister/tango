// „Prompt für KI erzeugen“: fertiger Text zum Kopieren in Claude oder einen anderen Chat.
// Kein API-Schlüssel, keine Kosten – die Antwort fügt man unter „Text einfügen“ ein.

import { useMemo, useState } from 'react';
import { navigate } from '../router';
import { useWords } from '../hooks';
import { buildAiPrompt } from '../reading/readingCore';
import { useToast } from '../components/Toast';
import { getPref, setPref } from '../lib/localPrefs';

export function PromptPage() {
  const words = useWords();
  const toast = useToast();
  const lessons = useMemo(
    () => [...new Set((words ?? []).map((w) => w.lesson).filter((l): l is number => l !== undefined))].sort((a, b) => a - b),
    [words],
  );
  const [lesson, setLesson] = useState<string>(() => getPref('promptLesson', ''));
  const [onlyUpTo, setOnlyUpTo] = useState(true);
  const [sentences, setSentences] = useState(8);
  const [topic, setTopic] = useState('');

  const { prompt, count } = useMemo(
    () =>
      buildAiPrompt(words ?? [], {
        lesson: lesson ? Number(lesson) : undefined,
        sentences,
        topic: topic.trim() || undefined,
        onlyUpToLesson: onlyUpTo,
      }),
    [words, lesson, sentences, topic, onlyUpTo],
  );

  return (
    <div className="page">
      <div className="page-head">
        <button type="button" className="icon" onClick={() => navigate('/lesen?tab=texte')} aria-label="Zurück">
          ←
        </button>
        <h2>Prompt für KI</h2>
      </div>
      <div className="row wrap">
        <label className="grow">
          <span>Grammatik bis Genki-Lektion</span>
          <select
            value={lesson}
            onChange={(e) => {
              setLesson(e.target.value);
              setPref('promptLesson', e.target.value);
            }}
          >
            <option value="">keine Angabe</option>
            {lessons.map((l) => (
              <option key={l} value={l}>
                Lektion {l}
              </option>
            ))}
          </select>
        </label>
        <label className="narrow">
          <span>Sätze</span>
          <input type="number" min={3} max={30} value={sentences} onChange={(e) => setSentences(Number(e.target.value) || 8)} />
        </label>
      </div>
      {lesson && (
        <label className="check">
          <input type="checkbox" checked={onlyUpTo} onChange={(e) => setOnlyUpTo(e.target.checked)} />
          <span>nur Vokabeln bis Lektion {lesson}</span>
        </label>
      )}
      <label>
        <span>Thema (optional)</span>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="z. B. Wochenende, Essen, Uni" />
      </label>
      <label>
        <span>Prompt ({count} Vokabeln)</span>
        <textarea className="prompt-box" rows={10} readOnly value={prompt} onFocus={(e) => e.target.select()} />
      </label>
      <div className="bottom-actions">
        <button
          type="button"
          className="primary big"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(prompt);
              toast('Prompt kopiert – jetzt in Claude einfügen');
            } catch {
              toast('Kopieren nicht möglich – Text markieren und kopieren', { error: true });
            }
          }}
        >
          Prompt kopieren
        </button>
        <button type="button" className="big" onClick={() => navigate('/lesen/neu?quelle=ki')}>
          Antwort der KI einfügen
        </button>
      </div>
    </div>
  );
}
