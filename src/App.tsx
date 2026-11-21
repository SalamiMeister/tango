// Grundgerüst: Seite je nach Adresse, Navigation unten, schwebender „+“-Knopf.

import { useEffect, useState } from 'react';
import { useRoute } from './router';
import { useSettings } from './hooks';
import { Home } from './pages/Home';
import { Learn } from './pages/Learn';
import { WordList } from './pages/WordList';
import { WordEdit } from './pages/WordEdit';
import { Import } from './pages/Import';
import { SettingsPage } from './pages/SettingsPage';
import { QuickAdd } from './components/QuickAdd';

const NAV = [
  { path: '', label: 'Start', icon: '⌂' },
  { path: 'lernen', label: 'Lernen', icon: '▶' },
  { path: 'vokabeln', label: 'Vokabeln', icon: '☰' },
  { path: 'import', label: 'Import', icon: '⇪' },
  { path: 'einstellungen', label: 'Mehr', icon: '⚙' },
];

export function App() {
  const route = useRoute();
  const settings = useSettings();
  const [quickAdd, setQuickAdd] = useState(false);
  const [section, id] = route.parts;
  const learning = section === 'lernen';
  const pathKey = route.parts.join('/');

  // Beim Seitenwechsel die Schnelleingabe schließen
  useEffect(() => setQuickAdd(false), [pathKey]);

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
        setQuickAdd(true);
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
    case 'einstellungen':
      page = <SettingsPage />;
      break;
    default:
      page = <Home />;
  }

  return (
    <div className={`app ${learning ? 'is-learning' : ''}`}>
      <main>{page}</main>

      {/* Auf der Import-Seite würde der Knopf den Import-Knopf verdecken */}
      {!learning && section !== 'import' && (
        <button type="button" className="fab" onClick={() => setQuickAdd(true)} aria-label="Neue Vokabel (Taste N)" title="Neue Vokabel (Taste N)">
          +
        </button>
      )}

      {!learning && (
        <nav className="bottom-nav">
          {NAV.map((n) => (
            <a key={n.path} href={`#/${n.path}`} className={(section ?? '') === n.path ? 'active' : ''}>
              <span className="nav-icon">{n.icon}</span>
              <span>{n.label}</span>
            </a>
          ))}
        </nav>
      )}

      {quickAdd && <QuickAdd onClose={() => setQuickAdd(false)} />}
    </div>
  );
}
