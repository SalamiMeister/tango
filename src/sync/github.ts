// Zugriff auf eine Datei in einem PRIVATEN GitHub-Repository über die GitHub-API.
// Der Zugangsschlüssel (fine-grained Token) braucht nur „Contents: Read and write“
// für genau dieses eine Repo.

import { isSnapshot, type Snapshot } from './syncCore';

export interface SyncConfig {
  /** „besitzer/repo“, z. B. „SalamiMeister/tango-daten“ */
  repo: string;
  token: string;
  /** Pfad der Datei im Repo */
  path: string;
}

export class SyncError extends Error {
  constructor(
    message: string,
    public kind: 'auth' | 'notfound' | 'conflict' | 'public' | 'network' | 'other',
  ) {
    super(message);
  }
}

const API = 'https://api.github.com';

async function gh(cfg: SyncConfig, url: string, init: RequestInit = {}, accept = 'application/vnd.github+json'): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API}${url}`, {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: accept,
        Authorization: `Bearer ${cfg.token.trim()}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new SyncError('Keine Verbindung zu GitHub (offline?)', 'network');
  }
  if (res.status === 401) throw new SyncError('Zugangsschlüssel ungültig oder abgelaufen.', 'auth');
  if (res.status === 403) throw new SyncError('Keine Berechtigung – der Schlüssel braucht „Contents: Read and write“ für dieses Repo.', 'auth');
  return res;
}

function repoPath(cfg: SyncConfig): string {
  const [owner, name] = cfg.repo.trim().split('/');
  if (!owner || !name) throw new SyncError('Repo bitte als „besitzer/name“ angeben.', 'other');
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
}

/** Prüft, ob das Repo erreichbar, PRIVAT und beschreibbar ist. */
export async function checkRepo(cfg: SyncConfig): Promise<void> {
  const res = await gh(cfg, repoPath(cfg));
  if (res.status === 404) throw new SyncError('Repo nicht gefunden – oder der Schlüssel hat keinen Zugriff darauf.', 'notfound');
  if (!res.ok) throw new SyncError(`GitHub meldet Fehler ${res.status}.`, 'other');
  const info = (await res.json()) as { private?: boolean; permissions?: { push?: boolean } };
  if (!info.private) {
    throw new SyncError('Das Repo ist öffentlich! Deine Lerndaten wären für alle sichtbar. Bitte ein PRIVATES Repo verwenden.', 'public');
  }
  if (info.permissions && info.permissions.push === false) {
    throw new SyncError('Der Schlüssel darf nicht schreiben – bitte „Contents: Read and write“ wählen.', 'auth');
  }
}

// --- Base64 mit UTF-8 (btoa/atob können nur Latin-1)
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function fromBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export interface RemoteFile {
  data: Snapshot | null;
  /** Versionskennung der Datei (für sicheres Überschreiben) */
  sha?: string;
}

/** Lädt die Sync-Datei. Gibt data=null zurück, wenn es sie noch nicht gibt. */
export async function readRemote(cfg: SyncConfig): Promise<RemoteFile> {
  const url = `${repoPath(cfg)}/contents/${cfg.path.split('/').map(encodeURIComponent).join('/')}`;
  const res = await gh(cfg, url);
  if (res.status === 404) {
    // Datei fehlt – oder das ganze Repo? Das klärt checkRepo mit besserer Meldung.
    await checkRepo(cfg);
    return { data: null };
  }
  if (!res.ok) throw new SyncError(`GitHub meldet Fehler ${res.status} beim Lesen.`, 'other');
  const meta = (await res.json()) as { sha: string; content?: string; encoding?: string };
  let text: string;
  if (meta.content && meta.encoding === 'base64') {
    text = fromBase64(meta.content);
  } else {
    // Dateien über 1 MB liefert die API nur als „raw“
    const raw = await gh(cfg, url, {}, 'application/vnd.github.raw+json');
    if (!raw.ok) throw new SyncError(`GitHub meldet Fehler ${raw.status} beim Lesen.`, 'other');
    text = await raw.text();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SyncError('Die Sync-Datei im Repo ist beschädigt (kein gültiges JSON).', 'other');
  }
  if (!isSnapshot(parsed)) throw new SyncError('Die Datei im Repo ist keine Tango-Sync-Datei.', 'other');
  return { data: parsed, sha: meta.sha };
}

/** Schreibt die Sync-Datei. sha = Version, die wir gelesen haben (Schutz gegen gleichzeitiges Schreiben). */
export async function writeRemote(cfg: SyncConfig, data: Snapshot, sha?: string, device = 'Gerät'): Promise<void> {
  const url = `${repoPath(cfg)}/contents/${cfg.path.split('/').map(encodeURIComponent).join('/')}`;
  const res = await gh(cfg, url, {
    method: 'PUT',
    body: JSON.stringify({
      message: `Sync von ${device} (${new Date().toLocaleString('de-DE')})`,
      content: toBase64(JSON.stringify(data)),
      ...(sha ? { sha } : {}),
    }),
  });
  if (res.status === 409 || res.status === 422) {
    throw new SyncError('Die Datei wurde gerade von einem anderen Gerät geändert.', 'conflict');
  }
  if (res.status === 404) throw new SyncError('Repo nicht gefunden – oder der Schlüssel hat keinen Zugriff darauf.', 'notfound');
  if (!res.ok) throw new SyncError(`GitHub meldet Fehler ${res.status} beim Speichern.`, 'other');
}
