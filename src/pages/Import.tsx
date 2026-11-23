// Import: Tabelle einfügen (aus Excel/Google Sheets kopiert) oder CSV-Datei wählen.
// → Vorschau mit Spaltenzuordnung → Duplikate behandeln → Import.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useWords } from '../hooks';
import {
  analyzeTable,
  COLUMN_LABELS,
  rowsToDrafts,
  validateDraft,
  type ColumnField,
  type ParsedRow,
  type Delimiter,
} from '../lib/tableImport';
import { DUPLICATE_LABELS, planImport, type DuplicateStrategy } from '../lib/duplicates';
import { applyImport, previewImport } from '../repo';
import { useToast } from '../components/Toast';
import { navigate } from '../router';
import { downloadText, readTextFile } from '../lib/download';
import { getPref, setPref } from '../lib/localPrefs';
import { parseLesson, splitTags } from '../lib/text';
import templateCsv from '../../examples/vorlage.csv?raw';
import { lookupExact, useDictInfo } from '../dict/dict';
import { enrichDraft, type EnrichNote } from '../dict/dictCore';
import type { WordDraft } from '../types';

type Row = ParsedRow & { note?: EnrichNote };

const DELIM_LABELS: Record<Delimiter, string> = { '\t': 'Tabulator', ';': 'Semikolon', ',': 'Komma' };
const FIELDS = Object.keys(COLUMN_LABELS) as ColumnField[];

export function Import() {
  const words = useWords() ?? [];
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState('');
  const [delimiter, setDelimiter] = useState<Delimiter | undefined>();
  const [hasHeader, setHasHeader] = useState<boolean | undefined>();
  const [mapping, setMapping] = useState<ColumnField[] | undefined>();
  const [source, setSource] = useState(() => getPref('importSource', 'Genki 1'));
  const [lesson, setLesson] = useState('');
  const [tags, setTags] = useState('');
  const [strategy, setStrategy] = useState<DuplicateStrategy>('skip');
  const [busy, setBusy] = useState(false);
  const dictInfo = useDictInfo();
  const dictReady = !!(dictInfo?.core || dictInfo?.full);
  const [fillKanji, setFillKanji] = useState(() => getPref('importFillKanji', true));
  const [fillMeaning, setFillMeaning] = useState(() => getPref('importFillMeaning', true));

  // Automatische Analyse; manuelle Änderungen (Trennzeichen/Kopfzeile/Spalten) überschreiben sie.
  const analysis = useMemo(() => (text.trim() ? analyzeTable(text, delimiter) : null), [text, delimiter]);
  const header = hasHeader ?? analysis?.hasHeader ?? false;
  const cols = mapping ?? analysis?.mapping ?? [];

  const parsedRaw = useMemo(() => {
    if (!analysis) return [];
    return rowsToDrafts(analysis.rows, cols, header, {
      source: source.trim() || undefined,
      lesson: parseLesson(lesson),
      tags: splitTags(tags),
    });
  }, [analysis, cols, header, source, lesson, tags]);

  // Fehlende Angaben aus dem Wörterbuch ergänzen (nur wenn eindeutig, nichts wird überschrieben)
  const [enriched, setEnriched] = useState<Row[] | null>(null);
  useEffect(() => {
    setEnriched(null);
    if (!dictReady || (!fillKanji && !fillMeaning) || parsedRaw.length === 0) return;
    let cancelled = false;
    (async () => {
      const out: Row[] = [];
      for (const row of parsedRaw) {
        const d = row.partial;
        const candidates = await lookupExact(d.kanji ?? '', d.kana ?? '');
        const { draft: e, note } = enrichDraft(d, candidates);
        const merged: Partial<WordDraft> = {
          ...d,
          kana: d.kana || e.kana || '',
          kanji: fillKanji ? e.kanji : d.kanji,
          meaning_de: fillMeaning ? e.meaning_de : d.meaning_de,
          part_of_speech: fillMeaning ? e.part_of_speech : d.part_of_speech,
        };
        const changed = merged.kana !== d.kana || merged.kanji !== d.kanji || merged.meaning_de !== d.meaning_de || merged.part_of_speech !== d.part_of_speech;
        const error = validateDraft(merged);
        out.push({
          ...row,
          partial: merged as WordDraft,
          draft: error ? null : (merged as WordDraft),
          error,
          note: changed ? 'ergänzt' : note === 'ergänzt' ? null : note,
        });
      }
      if (!cancelled) setEnriched(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [parsedRaw, dictReady, fillKanji, fillMeaning]);
  const parsed: Row[] = enriched ?? parsedRaw;

  const plan = useMemo(
    () => planImport(parsed.flatMap((p) => (p.draft ? [p.draft] : [])), words, strategy, Date.now()),
    [parsed, words, strategy],
  );

  const errors = parsed.filter((p) => p.error).length;
  const dupCount = plan.rows.filter((r) => r.kind !== 'new').length;

  function reset(newText: string) {
    setText(newText);
    setDelimiter(undefined);
    setHasHeader(undefined);
    setMapping(undefined);
  }

  async function onFile(file: File) {
    reset(await readTextFile(file));
  }

  async function doImport() {
    setBusy(true);
    try {
      setPref('importSource', source);
      // Plan frisch aus der Datenbank berechnen (falls sich inzwischen etwas geändert hat)
      const fresh = await previewImport(
        parsed.flatMap((p) => (p.draft ? [p.draft] : [])),
        strategy,
      );
      await applyImport(fresh);
      toast(
        `${fresh.create.length} neu importiert` +
          (fresh.update.length ? `, ${fresh.update.length} zusammengeführt` : '') +
          (fresh.skipped ? `, ${fresh.skipped} übersprungen` : ''),
      );
      reset('');
      navigate('/vokabeln');
    } finally {
      setBusy(false);
    }
  }

  // Status pro Zeile für die Vorschau (Fehlerzeilen haben keinen Plan-Eintrag)
  let planIndex = 0;
  const rowStatus = parsed.map((p) => {
    const extra = p.note === 'ergänzt' ? ' · ergänzt' : p.note === 'mehrdeutig' ? ' · mehrdeutig, bitte prüfen' : '';
    if (p.error) return { cls: 'err', label: p.error + extra };
    const r = plan.rows[planIndex++];
    if (r.kind === 'new') return { cls: p.note === 'mehrdeutig' ? 'dup' : 'ok', label: 'neu' + extra };
    return { cls: 'dup', label: `Duplikat → ${DUPLICATE_LABELS[strategy]}` + extra };
  });

  const colCount = cols.length;

  return (
    <div className="page import">
      <h2>Vokabeln importieren</h2>

      <div className="card">
        <p className="muted small">
          Zeilen aus Excel / Google Sheets kopieren und hier einfügen (Strg+V). Spalten z. B.:
          <code> Kana · Kanji · Bedeutung</code>. Mehrere Bedeutungen in einer Zelle mit Komma trennen.
        </p>
        <textarea
          className="paste"
          rows={6}
          placeholder={'たべる\t食べる\tessen\nのむ\t飲む\ttrinken'}
          value={text}
          onChange={(e) => reset(e.target.value)}
          lang="ja"
        />
        <div className="row wrap">
          <button type="button" onClick={() => fileRef.current?.click()}>
            CSV-Datei wählen …
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              e.target.value = '';
            }}
          />
          <button type="button" className="link" onClick={() => downloadText('tango-vorlage.csv', templateCsv, 'text/csv')}>
            Vorlage herunterladen
          </button>
          {text && (
            <button type="button" className="link" onClick={() => reset('')}>
              Leeren
            </button>
          )}
        </div>
      </div>

      {analysis && (
        <>
          <div className="card">
            <h3>Einstellungen</h3>
            <div className="row wrap">
              <label>
                <span>Trennzeichen</span>
                <select value={analysis.delimiter} onChange={(e) => { setDelimiter(e.target.value as Delimiter); setMapping(undefined); }}>
                  {(Object.keys(DELIM_LABELS) as Delimiter[]).map((d) => (
                    <option key={d} value={d}>
                      {DELIM_LABELS[d]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check">
                <input type="checkbox" checked={header} onChange={(e) => setHasHeader(e.target.checked)} />
                <span>Erste Zeile ist Überschrift</span>
              </label>
            </div>
            <p className="muted small">Gilt für alle Zeilen, wenn die Spalte fehlt:</p>
            <div className="row wrap">
              <label className="grow">
                <span>Quelle</span>
                <input value={source} onChange={(e) => setSource(e.target.value)} />
              </label>
              <label className="narrow">
                <span>Lektion</span>
                <input value={lesson} onChange={(e) => setLesson(e.target.value)} inputMode="numeric" placeholder="–" />
              </label>
              <label className="grow">
                <span>Tags</span>
                <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="–" />
              </label>
            </div>
            {dictReady ? (
              <div className="enrich-options">
                <span className="muted small">Aus dem Wörterbuch ergänzen (nur wenn eindeutig, nichts wird überschrieben):</span>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={fillKanji}
                    onChange={(e) => {
                      setFillKanji(e.target.checked);
                      setPref('importFillKanji', e.target.checked);
                    }}
                  />
                  <span>fehlende Kanji</span>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={fillMeaning}
                    onChange={(e) => {
                      setFillMeaning(e.target.checked);
                      setPref('importFillMeaning', e.target.checked);
                    }}
                  />
                  <span>fehlende Bedeutung und Wortart</span>
                </label>
                {enriched === null && (fillKanji || fillMeaning) && <span className="muted small">Suche im Wörterbuch …</span>}
              </div>
            ) : (
              <p className="muted small">
                Tipp: Mit geladenem Wörterbuch (Mehr → Wörterbuch) ergänzt der Import fehlende Kanji, Bedeutungen und
                Wortarten automatisch.
              </p>
            )}
            {dupCount > 0 && (
              <label>
                <span>{dupCount} Duplikat(e) gefunden (gleiche Kana + Kanji):</span>
                <select value={strategy} onChange={(e) => setStrategy(e.target.value as DuplicateStrategy)}>
                  {(Object.keys(DUPLICATE_LABELS) as DuplicateStrategy[]).map((s) => (
                    <option key={s} value={s}>
                      {DUPLICATE_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="card preview">
            <h3>Vorschau</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    {Array.from({ length: colCount }, (_, c) => (
                      <th key={c}>
                        <select
                          value={cols[c]}
                          onChange={(e) => {
                            const next = [...cols];
                            next[c] = e.target.value as ColumnField;
                            setMapping(next);
                          }}
                          className={cols[c] === 'ignore' ? 'ignored' : ''}
                        >
                          {FIELDS.map((fld) => (
                            <option key={fld} value={fld}>
                              {COLUMN_LABELS[fld]}
                            </option>
                          ))}
                        </select>
                      </th>
                    ))}
                    <th>Wird übernommen als</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.slice(0, 100).map((p, i) => (
                    <tr key={p.line} className={rowStatus[i].cls}>
                      <td className="muted">{p.line}</td>
                      {Array.from({ length: colCount }, (_, c) => (
                        <td key={c} className={cols[c] === 'ignore' ? 'ignored' : ''} lang="ja">
                          {p.cells[c] ?? ''}
                        </td>
                      ))}
                      <td className="result-cell" lang="ja">
                        {p.partial.kanji ? `${p.partial.kanji}（${p.partial.kana}）` : p.partial.kana}
                        {p.partial.meaning_de?.length ? <span lang="de"> – {p.partial.meaning_de.join(', ')}</span> : null}
                        {p.partial.part_of_speech && <small lang="de"> · {p.partial.part_of_speech}</small>}
                      </td>
                      <td className="status-cell">{rowStatus[i].label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.length > 100 && <p className="muted small">… und {parsed.length - 100} weitere Zeilen</p>}
          </div>

          <div className="bottom-actions sticky">
            <button type="button" className="primary big" disabled={busy || plan.create.length + plan.update.length === 0} onClick={doImport}>
              {plan.create.length} Vokabel(n) importieren
              {plan.update.length > 0 && ` + ${plan.update.length} zusammenführen`}
            </button>
            {errors > 0 && <p className="muted small">{errors} Zeile(n) mit Fehler werden übersprungen.</p>}
          </div>
        </>
      )}
    </div>
  );
}
