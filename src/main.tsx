// Einstiegspunkt: startet React und meldet den Service Worker (Offline-Betrieb) an.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { ToastProvider } from './components/Toast';
import { setPref } from './lib/localPrefs';
import './styles.css';

// Service Worker: speichert die App für den Offline-Betrieb und lädt Updates im Hintergrund.
registerSW({
  immediate: true,
  onOfflineReady() {
    setPref('offlineReady', true);
  },
});

// Browser bitten, unsere Daten nicht automatisch zu löschen (z. B. bei Speichermangel).
navigator.storage?.persist?.().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
