// Kleines Wolkensymbol oben rechts: zeigt den Sync-Status, Tippen = jetzt synchronisieren.

import { syncNow, useSyncState, type SyncStatus } from '../sync/syncManager';

export const SYNC_TEXT: Record<SyncStatus, string> = {
  off: 'Synchronisation aus',
  synced: 'Synchron',
  pending: 'Änderungen ausstehend',
  syncing: 'Synchronisiere …',
  error: 'Sync-Fehler',
  offline: 'Offline – wird später synchronisiert',
};

const ICON: Record<SyncStatus, string> = {
  off: '☁',
  synced: '☁✓',
  pending: '☁•',
  syncing: '☁…',
  error: '☁!',
  offline: '☁⨯',
};

export function SyncBadge() {
  const s = useSyncState();
  if (s.status === 'off') return null;
  const title = s.status === 'error' && s.error ? `${SYNC_TEXT.error}: ${s.error}` : SYNC_TEXT[s.status];
  return (
    <button type="button" className={`sync-badge sb-${s.status}`} onClick={() => syncNow()} title={`${title} – tippen zum Synchronisieren`} aria-label={title}>
      {ICON[s.status]}
    </button>
  );
}
