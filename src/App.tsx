// Grundgerüst: Seite je nach Adresse, Navigation unten, schwebender „+“-Knopf.

import { useCallback, useEffect, useState } from 'react';
import { useRoute } from './router';
import { useSettings } from './hooks';
import { Home } from './pages/Home';
import { Learn } from './pages/Learn';
import { WordList } from './pages/WordList';
import { WordEdit } from './pages/WordEdit';
import { Import } from './pages/Import';
import { SettingsPage } from './pages/SettingsPage';
import { ReadingList } from './pages/ReadingList';
import { ReadingView } from './pages/ReadingView';
import { NewText } from './pages/NewText';
import { PromptPage } from './pages/PromptPage';
import { QuickAdd } from './components/QuickAdd';
import { QuickAddContext } from './components/quickAddContext';
import { SyncBadge } from './components/SyncBadge';
import { SyncSetup } from './pages/SyncSetup';
import type { WordDraft } from './types';

const NAV = [
  { path: '', label: 'Start', icon: '⌂' },
  { path: 'lernen', label: 'Lernen', icon: '▶' },
  { path: 'vokabeln', label: 'Vokabeln', icon: '☰' },
  { path: 'lesen', label: 'Lesen', icon: '読' },
  { path: 'einstellungen', label: 'Mehr', icon: '⚙' },
];

export function App() {
  const route = useRoute();
  const settings = useSettings();
  // null = geschlossen, sonst offen (ggf. mit Vorbelegung)
  const [quickAdd, setQuickAdd] = useState<Partial<WordDraft> | null>(null);
  const [section, id, sub] = route.parts;
  const learning = section === 'lernen';
  const readingDetail = section === 'lesen' && !!id;
  const pathKey = route.parts.join('/');
  const openQuickAdd = useCallback((initial?: Partial<WordDraft>) => setQuickAdd(initial ?? {}), []);

  // Beim Seitenwechsel die Schnelleingabe schließen
  useEffect(() => setQuickAdd(null), [pathKey]);

  // Farbschema anwenden (hell / dunkel / wie System)
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // Taste „n“ öffnet die Schnelleingabe (außer beim Lernen und in Eingabefeldern)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select') || learning || e.ctrlKey || e.metaKey) return;
      if (e.key === 'n' || e.key === '+') {
        e.preventDefault();
        setQuickAdd({});
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [learning]);

  let page;
  switch (section) {
    case 'lernen':
      page = <Learn route={route} />;
      break;
    case 'vokabeln':
      page = id ? <WordEdit id={id} /> : <WordList />;
      break;
    case 'import':
      page = <Import />;
      break;
    case 'lesen':
      if (id === 'neu') page = <NewText />;
      else if (id === 'prompt') page = <PromptPage />;
      else if ((id === 'text' || id === 'satz') && sub) page = <ReadingView kind={id} id={sub} />;
      else page = <ReadingList route={route} />;
      break;
    case 'einstellungen':
      page = <SettingsPage />;
      break;
    case 'sync':
      page = <SyncSetup route={route} />;
      break;
    default:
      page = <Home />;
  }

  return (
    <QuickAddContext.Provider value={openQuickAdd}>
      <div className={`app ${learning ? 'is-learning' : ''}`}>
        {!learning && <SyncBadge />}
        <main>{page}</main>

        {/* Auf Import- und Leseseiten würde der Knopf andere Knöpfe verdecken */}
        {!learning && section !== 'import' && !readingDetail && (
          <button type="button" className="fab" onClick={() => setQuickAdd({})} aria-label="Neue Vokabel (Taste N)" title="Neue Vokabel (Taste N)">
            +
          </button>
        )}

        {!learning && (
          <nav className="bottom-nav">
            {NAV.map((n) => (
              <a key={n.path} href={`#/${n.path}`} className={(section ?? '') === n.path ? 'active' : ''}>
                <span className="nav-icon" lang={n.path === 'lesen' ? 'ja' : undefined}>
                  {n.icon}
                </span>
                <span>{n.label}</span>
              </a>
            ))}
          </nav>
        )}

        {quickAdd && <QuickAdd initial={quickAdd} onClose={() => setQuickAdd(null)} />}
      </div>
    </QuickAddContext.Provider>
  );
}
