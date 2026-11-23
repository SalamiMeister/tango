// Steuert, WANN synchronisiert wird, und merkt sich den Status für die Anzeige.
//
// Automatisch: beim Öffnen/Zurückkehren in die App, nach jeder Lerneinheit,
// beim Verlassen/Ausblenden, wenn das Gerät wieder online ist, und 30 s nach
// einer Änderung. Fehler werden nur angezeigt, nie als blockierender Dialog.

import { useSyncExternalStore } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../db';
import { exportBackup } from '../repo';
import { getPref, setPref } from '../lib/localPrefs';
import { readRemote, SyncError, writeRemote, type SyncConfig } from './github';
import { planSync, type Snapshot } from './syncCore';

export type SyncStatus = 'off' | 'synced' | 'pending' | 'syncing' | 'error' | 'offline';

export interface SyncState {
  status: SyncStatus;
  lastSyncedAt?: number;
  error?: string;
  /** Wie viele Datensätze beim letzten Mal von anderen Geräten kamen */
  lastReceived?: number;
}

// ------------------------------------------------------------ Konfiguration (nur dieses Gerät)

export const DEFAULT_SYNC_PATH = 'tango-sync.json';

export function getSyncConfig(): SyncConfig | null {
  const c = getPref<SyncConfig | null>('syncConfig', null);
  return c && c.repo && c.token ? { ...c, path: c.path || DEFAULT_SYNC_PATH } : null;
}

export function setSyncConfig(cfg: SyncConfig | null): void {
  setPref('syncConfig', cfg);
  setPref('lastSyncedAt', 0);
  setState({ status: cfg ? 'pending' : 'off', error: undefined, lastSyncedAt: undefined });
}

function deviceName(): string {
  return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'Handy' : 'PC';
}

// ------------------------------------------------------------ Status (für React)

let state: SyncState = {
  status: getSyncConfig() ? 'pending' : 'off',
  lastSyncedAt: getPref<number>('lastSyncedAt', 0) || undefined,
};
const listeners = new Set<() => void>();

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

// ------------------------------------------------------------ Synchronisieren

let running: Promise<void> | null = null;
let again = false;

/** Synchronisiert jetzt (läuft schon eine? → danach noch einmal). */
export function syncNow(): Promise<void> {
  if (!getSyncConfig()) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce(): Promise<void> {
  const cfg = getSyncConfig();
  if (!cfg) return;
  if (!navigator.onLine) {
    setState({ status: 'offline' });
    return;
  }
  setState({ status: 'syncing', error: undefined });
  try {
    for (let attempt = 1; ; attempt++) {
      const startedAt = Date.now();
      const remote = await readRemote(cfg);
      const local = (await exportBackup()) as Snapshot;
      const plan = planSync(local, remote.data);

      // 1. Neueres aus der Cloud lokal übernehmen
      const received =
        plan.toLocal.words.length + plan.toLocal.reviews.length + plan.toLocal.passages.length + plan.toLocal.settings.length;
      if (received > 0) {
        await db.transaction('rw', [db.words, db.reviews, db.passages, db.settings], async () => {
          await db.words.bulkPut(plan.toLocal.words);
          await db.reviews.bulkPut(plan.toLocal.reviews);
          await db.passages.bulkPut(plan.toLocal.passages);
          await db.settings.bulkPut(plan.toLocal.settings);
        });
      }

      // 2. Eigene Änderungen hochladen (zusammengeführter Stand)
      if (plan.needsUpload) {
        try {
          await writeRemote(cfg, (await exportBackup()) as Snapshot, remote.sha, deviceName());
        } catch (e) {
          // Anderes Gerät war schneller → neu lesen und nochmal zusammenführen
          if (e instanceof SyncError && e.kind === 'conflict' && attempt < 3) continue;
          throw e;
        }
      }

      // Alles bis zum Start dieses Durchgangs ist jetzt synchron.
      const newest = Math.max(
        startedAt,
        ...plan.toLocal.words.map((r) => r.updated_at),
        ...plan.toLocal.reviews.map((r) => r.updated_at),
        ...plan.toLocal.settings.map((r) => r.updated_at),
      );
      setPref('lastSyncedAt', newest);
      setState({ status: 'synced', lastSyncedAt: Date.now(), lastReceived: received, error: undefined });
      return;
    }
  } catch (e) {
    if (e instanceof SyncError && e.kind === 'network') {
      setState({ status: 'offline' });
    } else {
      setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  }
}

// ------------------------------------------------------------ Automatische Auslöser

let timer: number | undefined;

/** Sync in Kürze anstoßen (mehrere Anstöße werden zusammengefasst). */
export function requestSync(_reason: string, delayMs = 1000): void {
  if (!getSyncConfig()) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => syncNow(), delayMs);
}

/** Einmal beim App-Start aufrufen. */
export function startAutoSync(): void {
  // Beim Öffnen
  requestSync('start', 300);

  // Zurück in die App (Handy: App war im Hintergrund) bzw. App wird verlassen
  document.addEventListener('visibilitychange', () => {
    if (!getSyncConfig()) return;
    if (document.visibilityState === 'visible') {
      const last = getPref<number>('lastSyncedAt', 0);
      if (Date.now() - last > 30_000) requestSync('visible', 300);
    } else if (state.status === 'pending') {
      syncNow(); // beim Ausblenden sofort versuchen
    }
  });

  // Wieder online
  window.addEventListener('online', () => requestSync('online', 500));

  // Lokale Änderungen beobachten → Status „ausstehend“ und Sync nach 30 s
  liveQuery(async () => {
    const [w, r, s] = await Promise.all([
      db.words.orderBy('updated_at').last(),
      db.reviews.orderBy('updated_at').last(),
      db.settings.toArray(),
    ]);
    return Math.max(w?.updated_at ?? 0, r?.updated_at ?? 0, ...s.map((x) => x.updated_at));
  }).subscribe((maxUpdated) => {
    // Während eines Syncs schreibt der Sync selbst – das ist keine neue Änderung
    if (!getSyncConfig() || running) return;
    if (maxUpdated > getPref<number>('lastSyncedAt', 0)) {
      if (state.status === 'synced' || state.status === 'off') setState({ status: 'pending' });
      requestSync('change', 30_000);
    }
  });
}
