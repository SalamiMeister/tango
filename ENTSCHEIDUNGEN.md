# Technische Entscheidungen

Kurze Begründungen für Festlegungen, die SPEC.md offen lässt oder leicht abwandelt.

## 2026-11-20 – Stufe 1

**React statt Svelte.** SPEC nennt React als Standard. React hat die größte Verbreitung (viele Beispiele/Hilfen im Netz) und Dexie bietet mit `dexie-react-hooks` eine fertige Anbindung, die die Oberfläche bei Datenänderungen automatisch aktualisiert.

**Kein Router-Paket, sondern Hash-Adressen (`#/vokabeln`).** Funktioniert auf GitHub Pages ohne Zusatzkonfiguration und offline; 30 Zeilen eigener Code (`src/router.ts`) statt einer weiteren Abhängigkeit.

**Zeitpunkte als Zahl (Millisekunden seit 1970) statt Date-Objekt.** Lässt sich direkt vergleichen (`updated_at` beim Zusammenführen), übersteht JSON-Export ohne Umwandlung und ist in IndexedDB sortierbar. Abweichung von „date“ in SPEC Abschnitt 3 nur in der Darstellung.

**Lernstand-ID = `<wort-id>:<richtung>`.** Damit erzeugen zwei Geräte für dasselbe Wort dieselbe ID – wichtig für den Sync in Stufe 2.

**Bewertungs-Historie im Lernstand** (`history: [{t, r, s}]`) statt eigener Tabelle. Einfach und reicht für Statistik (Stufe 4) und „Problemwörter“.

**Neue Karten bei „beide Richtungen“:** DE→JP einer Vokabel wird erst eingeführt, nachdem JP→DE einmal gelernt wurde. Das Tageslimit zählt Karten (eine Vokabel = 2 Karten).

**Lernphase innerhalb der Einheit:** Karten, die in ≤ 20 Minuten wieder fällig sind (z. B. nach „Nochmal“), kommen in derselben Einheit 3–5 Karten später erneut.

**Tastenkürzel schon in Stufe 1** (Leertaste, 1–4, Rücktaste = rückgängig, N = neue Vokabel), weil der Aufwand klein ist. Wischgesten folgen in Stufe 2.

**Icons werden per Skript erzeugt** (`npm run icons`), damit keine Grafikbibliothek nötig ist.
