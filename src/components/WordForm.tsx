// Formular für eine Vokabel – wird für die Schnelleingabe und zum Bearbeiten genutzt.
// Schnelleingabe: Enter speichert, Formular leert sich, Quelle + Lektion bleiben stehen.

import { useEffect, useRef, useState } from 'react';
import { PARTS_OF_SPEECH, type PartOfSpeech, type Word, type WordDraft } from '../types';
import { KanaInput } from './KanaInput';
import { findDuplicate } from '../lib/duplicates';
import { kanaToRomaji, parseLesson, romajiToKana, splitMeanings, splitTags } from '../lib/text';
import { searchDict, useDictInfo } from '../dict/dict';
import { entryToDraft, glossText } from '../dict/dictCore';
import type { DictEntry } from '../types';
import { navigate } from '../router';

interface Props {
  mode: 'quick' | 'edit';
  initial?: Partial<WordDraft>;
  /** Alle Vokabeln (für die Duplikat-Warnung) */
  words: Word[];
  /** Beim Bearbeiten: eigene id, damit das Wort nicht als sein eigenes Duplikat gilt */
  editingId?: string;
  onSubmit: (draft: WordDraft) => Promise<void>;
  /** Wird nach der Schnelleingabe aufgerufen, damit die Eltern-Komponente Quelle/Lektion merken kann */
  onStickyChange?: (source: string, lesson: string) => void;
}

interface FormState {
  kana: string;
  kanji: string;
  meaning: string;
  romaji: string;
  pos: PartOfSpeech | '';
  source: string;
  lesson: string;
  tags: string;
  note: string;
  active: boolean;
}

function toForm(d: Partial<WordDraft> = {}): FormState {
  return {
    kana: d.kana ?? '',
    kanji: d.kanji ?? '',
    meaning: (d.meaning_de ?? []).join(', '),
    romaji: d.romaji ?? '',
    pos: d.part_of_speech ?? '',
    source: d.source ?? '',
    lesson: d.lesson !== undefined ? String(d.lesson) : '',
    tags: (d.tags ?? []).join(', '),
    note: d.note ?? '',
    active: d.active ?? true,
  };
}

export function WordForm({ mode, initial, words, editingId, onSubmit, onStickyChange }: Props) {
  const [f, setF] = useState<FormState>(() => toForm(initial));
  const [more, setMore] = useState(mode === 'edit');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const kanaRef = useRef<HTMLInputElement>(null);
  const dictInfo = useDictInfo();
  const dictReady = !!(dictInfo?.core || dictInfo?.full);
  const [suggestions, setSuggestions] = useState<DictEntry[]>([]);
  // Nach Auswahl eines Vorschlags keine neuen Vorschläge, bis wieder getippt wird
  const [picked, setPicked] = useState(mode === 'edit');

  useEffect(() => {
    if (mode === 'quick') kanaRef.current?.focus();
  }, [mode]);

  // Wörterbuch-Vorschläge während des Tippens (Kana oder Kanji)
  const query = f.kanji.trim() || f.kana.trim();
  useEffect(() => {
    if (!dictReady || picked || !query || /[a-z]$/i.test(query)) {
      if (!query) setSuggestions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const hits = await searchDict(query, 6);
      if (!cancelled) setSuggestions(hits);
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, dictReady, picked]);

  function applySuggestion(e: DictEntry) {
    const d = entryToDraft(e);
    setF((prev) => ({
      ...prev,
      kana: d.kana ?? prev.kana,
      kanji: d.kanji ?? '',
      meaning: (d.meaning_de ?? []).join(', '),
      pos: d.part_of_speech ?? prev.pos,
    }));
    setPicked(true);
    setSuggestions([]);
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((prev) => ({ ...prev, [k]: v }));

  const duplicate = f.kana.trim() ? findDuplicate(words, f.kana, f.kanji, editingId) : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const meanings = splitMeanings(f.meaning);
    // Ein „n“ am Ende (z. B. „hon“) wird erst jetzt endgültig zu ん
    const kana = romajiToKana(f.kana.trim());
    if (!kana) return setError('Bitte Kana (Lesung) eingeben.');
    if (/[a-z]/i.test(kana)) return setError('Die Kana enthalten noch Buchstaben – bitte prüfen.');
    if (meanings.length === 0) return setError('Bitte mindestens eine Bedeutung eingeben.');
    setError('');
    setBusy(true);
    try {
      await onSubmit({
        kana,
        kanji: f.kanji.trim() || undefined,
        romaji: f.romaji.trim() || undefined,
        meaning_de: meanings,
        part_of_speech: f.pos || undefined,
        source: f.source.trim() || undefined,
        lesson: parseLesson(f.lesson),
        tags: splitTags(f.tags),
        note: f.note.trim() || undefined,
        active: f.active,
      });
      if (mode === 'quick') {
        // Formular leeren, Quelle/Lektion/Tags behalten („sticky“)
        onStickyChange?.(f.source, f.lesson);
        setF((prev) => ({ ...toForm(), source: prev.source, lesson: prev.lesson, tags: prev.tags }));
        setSuggestions([]);
        setPicked(false);
        kanaRef.current?.focus();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="word-form" onSubmit={submit}>
      <label>
        <span>Kana (Romaji tippen → wird zu Kana)</span>
        <KanaInput
          ref={kanaRef}
          value={f.kana}
          onChange={(v) => {
            set('kana', v);
            setPicked(false);
          }}
          placeholder="z. B. taberu → たべる"
          enterKeyHint="next"
        />
      </label>
      {suggestions.length > 0 && (
        <ul className="suggestions" role="listbox" aria-label="Vorschläge aus dem Wörterbuch">
          {suggestions.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => applySuggestion(e)}>
                <span className="sg-jp" lang="ja">
                  {e.flags & 2 || e.kanji.length === 0 ? e.kana : e.kanji[0]}
                  {!(e.flags & 2) && e.kanji.length > 0 && <small>{e.kana}</small>}
                </span>
                <span className="sg-de">{glossText(e)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {dictReady ? (
        <p className="dict-credit">
          Vorschläge aus dem Wörterbuch{' '}
          <a href="https://www.wadoku.de" target="_blank" rel="noreferrer">
            www.wadoku.de
          </a>{' '}
          und JMdict
        </p>
      ) : (
        mode === 'quick' && (
          <p className="dict-credit">
            Tipp: Mit dem Wörterbuch gibt es Vorschläge beim Tippen –{' '}
            <button type="button" className="link inline" onClick={() => navigate('/einstellungen')}>
              unter Mehr laden
            </button>
          </p>
        )
      )}
      {duplicate && (
        <p className="warn">
          ⚠ Gibt es schon: {duplicate.kanji ?? duplicate.kana} – {duplicate.meaning_de.join(', ')}
        </p>
      )}
      <label>
        <span>Kanji (optional)</span>
        <input
          lang="ja"
          value={f.kanji}
          onChange={(e) => {
            set('kanji', e.target.value);
            setPicked(false);
          }}
          placeholder="z. B. 食べる"
          autoComplete="off"
        />
      </label>
      <label>
        <span>Bedeutung (mehrere mit Komma trennen)</span>
        <input
          value={f.meaning}
          onChange={(e) => set('meaning', e.target.value)}
          placeholder="z. B. essen, speisen"
          autoComplete="off"
          enterKeyHint={mode === 'quick' ? 'done' : 'next'}
        />
      </label>

      <div className="row">
        <label className="grow">
          <span>Quelle</span>
          <input value={f.source} onChange={(e) => set('source', e.target.value)} placeholder="Genki 1" />
        </label>
        <label className="narrow">
          <span>Lektion</span>
          <input value={f.lesson} onChange={(e) => set('lesson', e.target.value)} inputMode="numeric" placeholder="1" />
        </label>
      </div>

      {mode === 'quick' && (
        <button type="button" className="link" onClick={() => setMore((m) => !m)}>
          {more ? '▾ Weniger Felder' : '▸ Mehr Felder (Wortart, Tags, Notiz …)'}
        </button>
      )}

      {more && (
        <>
          <div className="row">
            <label className="grow">
              <span>Wortart</span>
              <select value={f.pos} onChange={(e) => set('pos', e.target.value as PartOfSpeech | '')}>
                <option value="">–</option>
                {PARTS_OF_SPEECH.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="grow">
              <span>Romaji</span>
              <input
                value={f.romaji}
                onChange={(e) => set('romaji', e.target.value)}
                placeholder={f.kana ? kanaToRomaji(f.kana) : 'automatisch'}
                autoCapitalize="off"
              />
            </label>
          </div>
          <label>
            <span>Tags (mit Komma trennen)</span>
            <input value={f.tags} onChange={(e) => set('tags', e.target.value)} placeholder="z. B. Essen, wichtig" />
          </label>
          <label>
            <span>Notiz / Eselsbrücke</span>
            {mode === 'edit' ? (
              <textarea rows={3} value={f.note} onChange={(e) => set('note', e.target.value)} />
            ) : (
              <input value={f.note} onChange={(e) => set('note', e.target.value)} />
            )}
          </label>
          {mode === 'edit' && (
            <label className="check">
              <input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} />
              <span>aktiv (wird gelernt)</span>
            </label>
          )}
        </>
      )}

      {error && <p className="error">{error}</p>}
      <button type="submit" className="primary big" disabled={busy}>
        {mode === 'quick' ? 'Speichern (Enter)' : 'Speichern'}
      </button>
    </form>
  );
}
