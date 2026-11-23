// Einstellungen → Synchronisation: einrichten, Status, weiteres Gerät verbinden (QR-Code / Link), trennen.

import { useState } from 'react';
import qrcode from 'qrcode-generator';
import { checkRepo } from '../sync/github';
import { DEFAULT_SYNC_PATH, getSyncConfig, setSyncConfig, syncNow, useSyncState } from '../sync/syncManager';
import { SYNC_TEXT } from './SyncBadge';
import { useToast } from './Toast';

/** Einrichtungs-Link für ein weiteres Gerät. Der Schlüssel steht NACH dem #, wird also nie an einen Server geschickt. */
export function setupLink(repo: string, token: string): string {
  const q = new URLSearchParams({ r: repo, t: token });
  return `${location.origin}${location.pathname}#/sync?${q}`;
}

/** Liest Repo + Schlüssel aus einem eingefügten Einrichtungs-Link. */
export function parseSetupLink(text: string): { repo: string; token: string } | null {
  const i = text.indexOf('#/sync?');
  if (i < 0) return null;
  const q = new URLSearchParams(text.slice(i + '#/sync?'.length).trim());
  const repo = q.get('r');
  const token = q.get('t');
  return repo && token ? { repo, token } : null;
}

export async function connect(repo: string, token: string): Promise<void> {
  const cfg = { repo: repo.trim(), token: token.trim(), path: DEFAULT_SYNC_PATH };
  await checkRepo(cfg); // wirft mit verständlicher Meldung, wenn etwas nicht passt
  setSyncConfig(cfg);
  await syncNow();
}

export function SyncSettings() {
  const toast = useToast();
  const sync = useSyncState();
  const cfg = getSyncConfig();
  const [repo, setRepo] = useState('');
  const [token, setToken] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showQr, setShowQr] = useState(false);

  async function doConnect(r: string, t: string) {
    setBusy(true);
    setError('');
    try {
      await connect(r, t);
      toast('Synchronisation eingerichtet');
      setToken('');
      setLink('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!cfg) {
    return (
      <div className="card">
        <h3>Synchronisation</h3>
        <p className="muted small">
          Gleicht Vokabeln und Lernstand automatisch zwischen deinen Geräten ab – über ein <b>privates</b> GitHub-Repo.
          Einmalige Einrichtung (ca. 5 Min) siehe README, Abschnitt „Synchronisation einrichten“.
        </p>
        <label>
          <span>Repo (besitzer/name)</span>
          <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="SalamiMeister/tango-daten" autoCapitalize="off" autoCorrect="off" />
        </label>
        <label>
          <span>Zugangsschlüssel (Fine-grained Token)</span>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" autoComplete="off" />
        </label>
        <button type="button" className="primary" disabled={busy || !repo || !token} onClick={() => doConnect(repo, token)}>
          {busy ? 'Verbinde …' : 'Verbinden'}
        </button>

        <p className="muted small" style={{ marginTop: 16 }}>
          Schon auf einem anderen Gerät eingerichtet? Dort „Weiteres Gerät verbinden“ wählen und den QR-Code scannen –
          oder den Link hier einfügen:
        </p>
        <div className="row">
          <input className="grow" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Einrichtungs-Link einfügen" autoComplete="off" />
          <button
            type="button"
            disabled={busy || !link}
            onClick={() => {
              const p = parseSetupLink(link);
              if (p) doConnect(p.repo, p.token);
              else setError('Das ist kein gültiger Einrichtungs-Link.');
            }}
          >
            OK
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  const linkText = setupLink(cfg.repo, cfg.token);
  const qrSvg = (() => {
    if (!showQr) return '';
    const qr = qrcode(0, 'M');
    qr.addData(linkText);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  })();

  return (
    <div className="card">
      <h3>Synchronisation</h3>
      <p>
        <span className={`sync-dot sd-${sync.status}`} /> {SYNC_TEXT[sync.status]}
        {sync.lastSyncedAt && sync.status !== 'syncing' && (
          <span className="muted small"> · zuletzt {new Date(sync.lastSyncedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </p>
      {sync.status === 'error' && sync.error && <p className="error small">{sync.error}</p>}
      <p className="muted small">
        Repo: <code>{cfg.repo}</code> · Datei: <code>{cfg.path}</code>
      </p>
      <div className="row wrap">
        <button type="button" className="primary" onClick={() => syncNow()} disabled={sync.status === 'syncing'}>
          Jetzt synchronisieren
        </button>
        <button type="button" onClick={() => setShowQr((v) => !v)}>
          {showQr ? 'QR-Code ausblenden' : 'Weiteres Gerät verbinden'}
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => {
            setSyncConfig(null);
            toast('Synchronisation auf diesem Gerät beendet (Daten bleiben erhalten)');
          }}
        >
          Trennen
        </button>
      </div>
      {showQr && (
        <div className="qr-box">
          <p className="small">
            Mit der Handy-Kamera scannen. <b>Der Code enthält deinen Zugangsschlüssel</b> – nicht weitergeben.
          </p>
          <div className="qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <button
            type="button"
            className="link"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(linkText);
                toast('Link kopiert');
              } catch {
                toast('Kopieren nicht möglich', { error: true });
              }
            }}
          >
            Stattdessen Link kopieren
          </button>
          <p className="muted small">
            iPhone: Die zum Home-Bildschirm hinzugefügte App hat einen eigenen Speicher. Dort den Link unter
            Mehr → Synchronisation einfügen, statt ihn in Safari zu öffnen.
          </p>
        </div>
      )}
    </div>
  );
}
