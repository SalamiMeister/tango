// Einstellungen, Datensicherung (JSON) und „Über“.

import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../hooks';
import { exportBackup, importBackup, saveSettings } from '../repo';
import { useToast } from '../components/Toast';
import { downloadText, readTextFile } from '../lib/download';
import { getPref } from '../lib/localPrefs';
import { SyncSettings } from '../components/SyncSettings';
import { DataSettings } from '../components/DataSettings';
import type { DirectionSetting, Settings } from '../types';

export function SettingsPage() {
  const settings = useSettings();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const offlineReady = getPref('offlineReady', false);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const update = (patch: Partial<Settings>) => saveSettings({ ...settings, ...patch });

  async function doExport() {
    const data = await exportBackup();
    const date = new Date().toISOString().slice(0, 10);
    downloadText(`tango-backup-${date}.json`, JSON.stringify(data, null, 1), 'application/json');
    toast(`Backup mit ${data.words.filter((w) => !w.deleted).length} Vokabeln erstellt`);
  }

  async function doImport(file: File) {
    try {
      const data = JSON.parse(await readTextFile(file));
      const res = await importBackup(data);
      toast(`Backup eingespielt: ${res.words} Vokabeln, ${res.reviews} Lernstände übernommen`);
    } catch (e) {
      toast(`Import fehlgeschlagen: ${(e as Error).message}`, { error: true, duration: 8000 });
    }
  }

  return (
    <div className="page settings">
      <h2>Einstellungen</h2>

      <div className="card">
        <h3>Lernen</h3>
        <label>
          <span>Neue Karten pro Tag (jede Vokabel hat 2 Karten: JP→DE und DE→JP)</span>
          <input
            type="number"
            min={0}
            max={500}
            value={settings.newPerDay}
            onChange={(e) => update({ newPerDay: Math.max(0, Number(e.target.value) || 0) })}
          />
        </label>
        <label>
          <span>Karten pro Lerneinheit</span>
          <input
            type="number"
            min={5}
            max={200}
            value={settings.sessionSize}
            onChange={(e) => update({ sessionSize: Math.max(1, Number(e.target.value) || 20) })}
          />
        </label>
        <label>
          <span>Abfragerichtung</span>
          <select value={settings.direction} onChange={(e) => update({ direction: e.target.value as DirectionSetting })}>
            <option value="both">beide (gemischt)</option>
            <option value="jp_de">nur Japanisch → Deutsch</option>
            <option value="de_jp">nur Deutsch → Japanisch</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.showKanaOnFront}
            onChange={(e) => update({ showKanaOnFront: e.target.checked })}
          />
          <span>Bei JP→DE die Lesung (Kana) schon auf der Vorderseite zeigen</span>
        </label>
      </div>

      <div className="card">
        <h3>Darstellung</h3>
        <label>
          <span>Farbschema</span>
          <select value={settings.theme} onChange={(e) => update({ theme: e.target.value as Settings['theme'] })}>
            <option value="system">wie System</option>
            <option value="light">hell</option>
            <option value="dark">dunkel</option>
          </select>
        </label>
      </div>

      <SyncSettings />

      <div className="card">
        <h3>Daten</h3>
        <p className="muted small">
          Die Daten liegen auf diesem Gerät (und, falls eingerichtet, in deinem privaten Sync-Repo). Ein Backup
          kannst du jederzeit exportieren und auf einem anderen Gerät einspielen – vorhandene Daten bleiben
          erhalten, pro Eintrag gewinnt der neuere Stand.
        </p>
        <div className="row wrap">
          <button type="button" onClick={doExport}>
            Backup exportieren (JSON)
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>
            Backup einspielen …
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport(f);
              e.target.value = '';
            }}
          />
        </div>
        <ul className="status-list small">
          <li>{offlineReady ? '✓ Offline-Betrieb bereit' : '… Offline-Betrieb noch nicht eingerichtet (nur im Build / auf GitHub Pages)'}</li>
          <li>
            {persisted === true
              ? '✓ Speicher dauerhaft (Browser löscht die Daten nicht automatisch)'
              : persisted === false
                ? '⚠ Speicher nicht dauerhaft – bei Speichermangel könnte der Browser Daten löschen. Regelmäßig Backup machen! (Tipp: App zum Startbildschirm hinzufügen.)'
                : 'Speicherstatus unbekannt'}
          </li>
        </ul>
      </div>

      <DataSettings />

      <div className="card about" id="ueber">
        <h3>Über &amp; Quellen</h3>
        <p>
          <b>Tango</b> – persönlicher Japanisch-Vokabeltrainer · Version {__APP_VERSION__} · kostenlos und werbefrei
        </p>

        <h4>Wörterbuchdaten</h4>
        <p className="small">
          Deutsche Bedeutungen aus dem japanisch-deutschen Wörterbuch <b>Wadoku</b> (Ulrich Apel und Wadoku e.V.):{' '}
          <a href="https://www.wadoku.de" target="_blank" rel="noreferrer">
            www.wadoku.de
          </a>
          . Verwendet gemäß der{' '}
          <a href="https://www.wadoku.de/wiki/display/WAD/Wadoku.de-Daten+Lizenz" target="_blank" rel="noreferrer">
            Wadoku.de-Daten-Lizenz
          </a>{' '}
          (kostenlose Weitergabe mit Herkunftsangabe). Die Daten wurden für diese App gekürzt (ohne Sätze und Namen,
          höchstens 5 Bedeutungen je Eintrag).
        </p>
        <p className="small">
          Häufigkeit, Wortarten und englische Ergänzungen aus <b>JMdict</b>. This app uses the JMdict/EDICT dictionary
          files. These files are the property of the{' '}
          <a href="https://www.edrdg.org/" target="_blank" rel="noreferrer">
            Electronic Dictionary Research and Development Group
          </a>
          , and are used in conformance with the Group's{' '}
          <a href="https://www.edrdg.org/edrdg/licence.html" target="_blank" rel="noreferrer">
            licence
          </a>{' '}
          (CC BY-SA 4.0). Projektseite:{' '}
          <a href="https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project" target="_blank" rel="noreferrer">
            JMdict-EDICT Dictionary Project
          </a>
          . Die Daten werden monatlich aktualisiert.
        </p>

        <h4>Beispielsätze</h4>
        <p className="small">
          Sätze und Übersetzungen von{' '}
          <a href="https://tatoeba.org" target="_blank" rel="noreferrer">
            Tatoeba
          </a>{' '}
          unter{' '}
          <a href="https://creativecommons.org/licenses/by/2.0/fr/" target="_blank" rel="noreferrer">
            CC BY 2.0 FR
          </a>
          . Die Autorinnen und Autoren werden beim jeweiligen Satz genannt und verlinkt.
        </p>

        <h4>Software</h4>
        <p className="muted small">
          Wiederholungsplanung mit FSRS (ts-fsrs, MIT). Romaji→Kana mit WanaKana (MIT). Datenbank mit Dexie.js
          (Apache 2.0). Oberfläche mit React (MIT). QR-Codes mit qrcode-generator (MIT). Textanalyse mit kuromoji.js
          (@patdx/kuromoji, Apache 2.0) und dem Wörterbuch IPADIC (NAIST/IPA, freie Lizenz). Vollständige Liste in
          LICENSES.md im Repository.
        </p>
      </div>
    </div>
  );
}
