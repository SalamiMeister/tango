// Eigenen oder KI-erzeugten Text einfügen. Beim Speichern wird er in Wörter zerlegt.

import { useEffect, useState } from 'react';
import { navigate } from '../router';
import { useWords, useReviews } from '../hooks';
import { buildKnownSet, knownRatio, splitAiText, wordIdsInTokens } from '../reading/readingCore';
import { isTokenizerCached, tokenizeText } from '../reading/tokenizer';
import { savePassage } from '../repo';
import { uuid } from '../lib/uuid';

export function NewText() {
  const words = useWords() ?? [];
  const reviews = useReviews() ?? [];
  const [title, setTitle] = useState('');
  const [ja, setJa] = useState('');
  const [de, setDe] = useState('');
  const [source, setSource] = useState<'eigen' | 'KI'>(() => (location.hash.includes('quelle=ki') ? 'KI' : 'eigen'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cached, setCached] = useState(true);

  useEffect(() => {
    isTokenizerCached().then(setCached);
  }, []);

  function onJaChange(v: string) {
    // KI-Antwort mit „---“ eingefügt? → automatisch aufteilen
    const split = splitAiText(v);
    if (split.de && !de) {
      setJa(split.ja);
      setDe(split.de);
    } else setJa(v);
  }

  async function save() {
    if (!ja.trim()) return setError('Bitte einen japanischen Text einfügen.');
    setBusy(true);
    setError('');
    try {
      const tokens = await tokenizeText(ja.trim());
      const known = buildKnownSet(words, reviews);
      const now = Date.now();
      const id = uuid();
      await savePassage({
        id,
        title: title.trim() || undefined,
        text_ja: ja.trim(),
        translation: de.trim() || undefined,
        source,
        tokens,
        word_ids: wordIdsInTokens(tokens, words),
        known_ratio: knownRatio(tokens, known).ratio,
        created_at: now,
        updated_at: now,
        deleted: false,
      });
      navigate(`/lesen/text/${id}`);
    } catch (e) {
      setError(`Textanalyse fehlgeschlagen: ${(e as Error).message}. Beim ersten Mal ist eine Internetverbindung nötig.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <button type="button" className="icon" onClick={() => navigate('/lesen?tab=texte')} aria-label="Zurück">
          ←
        </button>
        <h2>Text einfügen</h2>
      </div>
      <label>
        <span>Titel (optional)</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Genki L4 Dialog" />
      </label>
      <label>
        <span>Japanischer Text (KI-Antwort mit „---“ wird automatisch aufgeteilt)</span>
        <textarea lang="ja" rows={8} value={ja} onChange={(e) => onJaChange(e.target.value)} />
      </label>
      <label>
        <span>Deutsche Übersetzung (optional)</span>
        <textarea rows={5} value={de} onChange={(e) => setDe(e.target.value)} />
      </label>
      <label>
        <span>Quelle</span>
        <select value={source} onChange={(e) => setSource(e.target.value as 'eigen' | 'KI')}>
          <option value="eigen">eigener Text (z. B. aus dem Kurs)</option>
          <option value="KI">KI-erzeugt</option>
        </select>
      </label>
      {!cached && (
        <p className="muted small">
          Beim ersten Speichern wird die Textanalyse geladen (einmalig ca. 17 MB, danach offline verfügbar).
        </p>
      )}
      {error && <p className="error">{error}</p>}
      <div className="bottom-actions">
        <button type="button" className="primary big" disabled={busy} onClick={save}>
          {busy ? 'Analysiere Text …' : 'Speichern und lesen'}
        </button>
      </div>
    </div>
  );
}
