// Einstellungen → Wörterbuch & Lesedaten: auf Wunsch laden, aktualisieren, entfernen.

import { useEffect, useState } from 'react';
import { fetchDataMeta, installDict, removeDict, useDictInfo, type DataMeta } from '../dict/dict';
import { examplesCached, loadExamples } from '../reading/tatoeba';
import { getTokenizer, isTokenizerCached } from '../reading/tokenizer';
import { useToast } from './Toast';

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('de-DE') : '');

export function DataSettings() {
  const toast = useToast();
  const info = useDictInfo();
  const [meta, setMeta] = useState<DataMeta | null>(null);
  const [progress, setProgress] = useState<{ what: string; p: number } | null>(null);
  const [examples, setExamples] = useState(false);
  const [analysis, setAnalysis] = useState(false);

  useEffect(() => {
    fetchDataMeta().then(setMeta);
    examplesCached().then(setExamples);
    isTokenizerCached().then(setAnalysis);
  }, []);

  async function install(pack: 'core' | 'full') {
    const what = pack === 'core' ? 'Wörterbuch' : 'Erweitertes Wörterbuch';
    setProgress({ what, p: 0 });
    try {
      const n = await installDict(pack, (p) => setProgress({ what, p }));
      toast(`${what} geladen: ${n.toLocaleString('de-DE')} Einträge`);
    } catch (e) {
      toast((e as Error).message, { error: true, duration: 8000 });
    } finally {
      setProgress(null);
    }
  }

  async function run(what: string, fn: () => Promise<unknown>, done: () => void) {
    setProgress({ what, p: -1 });
    try {
      await fn();
      done();
      toast(`${what} geladen`);
    } catch (e) {
      toast((e as Error).message, { error: true, duration: 8000 });
    } finally {
      setProgress(null);
    }
  }

  const coreOutdated = !!(info?.core && meta && meta.built > info.core);
  const fullOutdated = !!(info?.full && meta && meta.built > info.full);
  const busy = progress !== null;

  return (
    <div className="card">
      <h3>Wörterbuch &amp; Lesedaten</h3>
      <p className="muted small">
        Werden nur auf Wunsch geladen und danach offline gespeichert. Sie werden nicht synchronisiert.
      </p>

      <div className="data-row">
        <div>
          <b>Wörterbuch</b> – häufige Wörter{meta ? `, ${meta.core.toLocaleString('de-DE')} Einträge` : ''}
          <div className="muted small">
            {info?.core ? `geladen (Stand ${fmtDate(info.core)})` : 'Vorschläge bei der Eingabe, Import-Ergänzung, Pop-ups beim Lesen · ca. 1 MB'}
          </div>
        </div>
        <button type="button" className={info?.core ? '' : 'primary'} disabled={busy} onClick={() => install('core')}>
          {info?.core ? (coreOutdated ? 'Aktualisieren' : 'Neu laden') : 'Laden'}
        </button>
      </div>

      <div className="data-row">
        <div>
          <b>Erweitertes Wörterbuch</b>{meta ? ` – weitere ${meta.full.toLocaleString('de-DE')} Einträge` : ''}
          <div className="muted small">
            {info?.full
              ? `geladen (Stand ${fmtDate(info.full)})${fullOutdated ? ' – Update verfügbar' : ''}`
              : 'Seltene Wörter und Fachbegriffe · ca. 15 MB Download, braucht viel Speicher (eher für den PC)'}
          </div>
        </div>
        {info?.full ? (
          <div className="row">
            {fullOutdated && (
              <button type="button" disabled={busy} onClick={() => install('full')}>
                Aktualisieren
              </button>
            )}
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={async () => {
                await removeDict('full');
                toast('Erweitertes Wörterbuch entfernt');
              }}
            >
              Entfernen
            </button>
          </div>
        ) : (
          <button type="button" disabled={busy || !info?.core} title={!info?.core ? 'Zuerst das Wörterbuch laden' : ''} onClick={() => install('full')}>
            Laden
          </button>
        )}
      </div>

      <div className="data-row">
        <div>
          <b>Beispielsätze</b> (Tatoeba)
          <div className="muted small">{examples ? 'geladen' : 'ca. 49.000 Sätze mit deutscher Übersetzung · ca. 5 MB'}</div>
        </div>
        <button type="button" disabled={busy || examples} onClick={() => run('Beispielsätze', loadExamples, () => setExamples(true))}>
          {examples ? '✓' : 'Laden'}
        </button>
      </div>

      <div className="data-row">
        <div>
          <b>Textanalyse</b> (für eigene Texte)
          <div className="muted small">{analysis ? 'geladen' : 'zerlegt eingefügte Texte in Wörter · ca. 17 MB'}</div>
        </div>
        <button type="button" disabled={busy || analysis} onClick={() => run('Textanalyse', getTokenizer, () => setAnalysis(true))}>
          {analysis ? '✓' : 'Laden'}
        </button>
      </div>

      {progress && (
        <div className="load-progress">
          <span className="small">{progress.what} wird geladen …</span>
          <div className="progress">
            <div style={{ width: progress.p < 0 ? '100%' : `${Math.round(progress.p * 100)}%` }} className={progress.p < 0 ? 'indeterminate' : ''} />
          </div>
        </div>
      )}
    </div>
  );
}
