// Vokabelliste mit Suche, Filtern, Auswahl und Massenbearbeitung.

import { useMemo, useState } from 'react';
import { useReviews, useWords } from '../hooks';
import { PARTS_OF_SPEECH, type Review, type Word } from '../types';
import { navigate } from '../router';
import { bulkPatchWords, softDeleteWords } from '../repo';
import { useToast } from '../components/Toast';
import { wordStatus } from '../lib/session';
import { dedupe, parseLesson, romajiToKana, splitTags } from '../lib/text';
import { getPref, setPref } from '../lib/localPrefs';

const PAGE = 200;

interface Filters {
  q: string;
  lesson: string;
  pos: string;
  tag: string;
  status: '' | 'active' | 'inactive';
}

function matches(w: Word, q: string, qKana: string): boolean {
  if (!q) return true;
  const hay = [w.kana, w.kanji ?? '', w.romaji ?? '', ...w.meaning_de, w.note ?? '', ...w.tags].join(' ').toLowerCase();
  return hay.includes(q) || (!!qKana && (w.kana.includes(qKana) || (w.kanji ?? '').includes(qKana)));
}

export function WordList() {
  const words = useWords();
  const reviews = useReviews();
  const toast = useToast();
  const [f, setF] = useState<Filters>(() => getPref('listFilters', { q: '', lesson: '', pos: '', tag: '', status: '' }));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [bulkLesson, setBulkLesson] = useState('');
  const [bulkTag, setBulkTag] = useState('');

  const setFilter = (patch: Partial<Filters>) => {
    const next = { ...f, ...patch };
    setF(next);
    setPref('listFilters', { ...next, q: '' });
    setLimit(PAGE);
  };

  const reviewsByWord = useMemo(() => {
    const m = new Map<string, Review[]>();
    for (const r of reviews ?? []) m.set(r.word_id, [...(m.get(r.word_id) ?? []), r]);
    return m;
  }, [reviews]);

  const lessons = useMemo(
    () => [...new Set((words ?? []).map((w) => w.lesson).filter((l): l is number => l !== undefined))].sort((a, b) => a - b),
    [words],
  );
  const tags = useMemo(() => dedupe((words ?? []).flatMap((w) => w.tags)).sort(), [words]);

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    // Suche „taberu“ findet auch たべる
    const qKana = /^[a-z\-']+$/.test(q) ? romajiToKana(q) : '';
    return (words ?? [])
      .filter((w) => matches(w, q, qKana))
      .filter((w) => !f.lesson || String(w.lesson ?? '') === f.lesson)
      .filter((w) => !f.pos || w.part_of_speech === f.pos)
      .filter((w) => !f.tag || w.tags.includes(f.tag))
      .filter((w) => !f.status || (f.status === 'active' ? w.active : !w.active))
      .sort((a, b) => (a.lesson ?? 999) - (b.lesson ?? 999) || a.created_at - b.created_at || a.id.localeCompare(b.id));
  }, [words, f]);

  if (!words) return <div className="page">Lade …</div>;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const ids = [...selected];

  async function bulk(action: 'activate' | 'deactivate' | 'lesson' | 'tag' | 'delete') {
    if (ids.length === 0) return;
    if (action === 'delete') {
      const undo = await softDeleteWords(ids);
      setSelected(new Set());
      toast(`${ids.length} Vokabel(n) gelöscht`, { undo });
      return;
    }
    if (action === 'activate' || action === 'deactivate') {
      await bulkPatchWords(ids, () => ({ active: action === 'activate' }));
    } else if (action === 'lesson') {
      const lesson = parseLesson(bulkLesson);
      await bulkPatchWords(ids, () => ({ lesson }));
    } else if (action === 'tag') {
      const add = splitTags(bulkTag);
      if (add.length === 0) return;
      await bulkPatchWords(ids, (w) => ({ tags: dedupe([...w.tags, ...add]) }));
    }
    toast(`${ids.length} Vokabel(n) geändert`);
  }

  return (
    <div className="page list">
      <div className="list-head">
        <input
          type="search"
          placeholder="Suchen (Kana, Kanji, Romaji, Deutsch) …"
          value={f.q}
          onChange={(e) => setFilter({ q: e.target.value })}
        />
        <div className="filters">
          <select value={f.lesson} onChange={(e) => setFilter({ lesson: e.target.value })} aria-label="Lektion">
            <option value="">Alle Lektionen</option>
            {lessons.map((l) => (
              <option key={l} value={l}>
                Lektion {l}
              </option>
            ))}
          </select>
          <select value={f.pos} onChange={(e) => setFilter({ pos: e.target.value })} aria-label="Wortart">
            <option value="">Alle Wortarten</option>
            {PARTS_OF_SPEECH.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          {tags.length > 0 && (
            <select value={f.tag} onChange={(e) => setFilter({ tag: e.target.value })} aria-label="Tag">
              <option value="">Alle Tags</option>
              {tags.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          )}
          <select value={f.status} onChange={(e) => setFilter({ status: e.target.value as Filters['status'] })} aria-label="Status">
            <option value="">aktiv + inaktiv</option>
            <option value="active">nur aktive</option>
            <option value="inactive">nur inaktive</option>
          </select>
        </div>
        <div className="list-count muted small">
          {filtered.length} von {words.length} Vokabeln
          {filtered.length > 0 && (
            <button
              type="button"
              className="link"
              onClick={() =>
                setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((w) => w.id)))
              }
            >
              {selected.size === filtered.length ? 'Auswahl aufheben' : 'Alle auswählen'}
            </button>
          )}
        </div>
      </div>

      {words.length === 0 && <p className="muted">Noch keine Vokabeln. Über „+“ oder „Import“ hinzufügen.</p>}

      <ul className="words">
        {filtered.slice(0, limit).map((w) => {
          const status = wordStatus(reviewsByWord.get(w.id) ?? []);
          return (
            <li key={w.id} className={w.active ? '' : 'inactive'}>
              <input
                type="checkbox"
                checked={selected.has(w.id)}
                onChange={() => toggle(w.id)}
                aria-label="Auswählen"
              />
              <button type="button" className="word-row" onClick={() => navigate(`/vokabeln/${w.id}`)}>
                <span className="w-jp" lang="ja">
                  {w.kanji ?? w.kana}
                  {w.kanji && <small>{w.kana}</small>}
                </span>
                <span className="w-de">{w.meaning_de.join(', ')}</span>
                <span className="w-meta">
                  {w.lesson !== undefined && <span>L{w.lesson}</span>}
                  <span className={`status s-${status}`} title={status}>
                    {status}
                  </span>
                  {!w.active && <span>inaktiv</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {filtered.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + PAGE)}>
          Mehr anzeigen ({filtered.length - limit} weitere)
        </button>
      )}

      {selected.size > 0 && (
        <div className="bulk-bar">
          <div className="bulk-title">
            <b>{selected.size} ausgewählt</b>
            <button type="button" className="icon" onClick={() => setSelected(new Set())} aria-label="Auswahl aufheben">
              ✕
            </button>
          </div>
          <div className="bulk-actions">
            <button type="button" onClick={() => bulk('activate')}>
              Aktivieren
            </button>
            <button type="button" onClick={() => bulk('deactivate')}>
              Deaktivieren
            </button>
            <button type="button" className="danger" onClick={() => bulk('delete')}>
              Löschen
            </button>
          </div>
          <div className="bulk-actions">
            <input placeholder="Lektion" inputMode="numeric" value={bulkLesson} onChange={(e) => setBulkLesson(e.target.value)} />
            <button type="button" onClick={() => bulk('lesson')}>
              Lektion setzen
            </button>
            <input placeholder="Tag" value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} />
            <button type="button" onClick={() => bulk('tag')}>
              Tag hinzufügen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
