// Wird über den Einrichtungs-Link / QR-Code geöffnet: #/sync?r=<repo>&t=<schlüssel>
// Der Schlüssel wird sofort aus der Adresszeile entfernt; eingerichtet wird erst nach einem Tipp.

import { useEffect, useState } from 'react';
import type { Route } from '../router';
import { navigate } from '../router';
import { connect } from '../components/SyncSettings';
import { useToast } from '../components/Toast';

export function SyncSetup({ route }: { route: Route }) {
  const toast = useToast();
  // Werte einmalig übernehmen, bevor die Adresse bereinigt wird
  const [data] = useState(() => ({ repo: route.query.get('r') ?? '', token: route.query.get('t') ?? '' }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Schlüssel aus Adresszeile und Verlauf entfernen
    history.replaceState(null, '', `${location.pathname}#/sync`);
  }, []);

  if (!data.repo || !data.token) {
    return (
      <div className="page center">
        <h2>Ungültiger Einrichtungs-Link</h2>
        <button type="button" onClick={() => navigate('/einstellungen')}>
          Zu den Einstellungen
        </button>
      </div>
    );
  }

  return (
    <div className="page center">
      <h2>Synchronisation einrichten</h2>
      <p>
        Dieses Gerät mit <code>{data.repo}</code> verbinden?
      </p>
      <p className="muted small">Vorhandene Daten auf diesem Gerät bleiben erhalten und werden zusammengeführt.</p>
      {error && <p className="error">{error}</p>}
      <div className="bottom-actions">
        <button
          type="button"
          className="primary big"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await connect(data.repo, data.token);
              toast('Synchronisation eingerichtet');
              navigate('/');
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Verbinde …' : 'Verbinden'}
        </button>
        <button type="button" className="big" onClick={() => navigate('/')}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
