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

## 2026-11-21 – Stufe 2

**Synchronisation über ein privates GitHub-Repo statt OneDrive** (Entscheidung des Nutzers). Für die OneDrive-Anbindung müsste die App im Microsoft-Entra-Portal registriert werden. Das geht mit einem privaten Microsoft-Konto allein nicht mehr; nötig ist ein Azure-Konto mit Abo (meist mit Kreditkarte), und ob die Registrierung nach Ablauf der Testphase weiter funktioniert, ist offiziell nicht zugesichert. GitHub ist bereits vorhanden und kostenlos. Die Daten liegen als `tango-sync.json` in einem privaten Repo; jeder Sync, der etwas hochlädt, erzeugt dort einen Commit (praktischer Nebeneffekt: Versionsgeschichte der Lerndaten).
- Zugriff per **Fine-grained Token**, nur „Contents: Read and write“ für dieses eine Repo. Gespeichert im localStorage des Geräts, nicht in der Datenbank und nicht im Backup.
- Die App prüft beim Verbinden, dass das Repo **privat** ist, und verweigert sonst.
- Gleichzeitiges Schreiben zweier Geräte: GitHub lehnt das Überschreiben mit veralteter Version (sha) ab → neu lesen, zusammenführen, nochmal (bis 3 Versuche).
- Zusammenführen pro Datensatz nach `updated_at` (wie beim JSON-Backup). Hat dieselbe Karte auf zwei Geräten offline Bewertungen bekommen, gewinnt der neuere Stand komplett (die ältere Bewertung geht verloren) – für eine Person mit zwei Geräten vertretbar.
- Weitere Geräte: Einrichtungs-Link/QR-Code. Der Token steht hinter dem `#` (wird nie an einen Server geschickt) und wird nach dem Öffnen sofort aus Adresszeile und Verlauf entfernt; eingerichtet wird erst nach einem Tipp auf „Verbinden“.

**Ein gemeinsamer Ablauf für alle FSRS-Modi** (`learn/useReviewSession.ts`). Bei Auswahl/Eintippen wird die Bewertung sofort beim Antworten gespeichert; „Ich lag richtig“ ersetzt sie.

**Wertung:** Multiple Choice/Hören richtig = Gut, falsch = Nochmal. Eintippen richtig = Gut, ein Tippfehler (ab 5 Buchstaben, inkl. Buchstabendreher) = Schwer, falsch = Nochmal. Hören fragt immer JP→DE ab. Zuordnen beeinflusst FSRS nicht.

**Problemwörter** = Karte mindestens zweimal vergessen (Lapses ≥ 2 oder ≥ 2× „Nochmal“ nach der ersten Lernphase). Mit dem Filter werden sie unabhängig von der Fälligkeit geübt.

**Wischgesten** auf der Karteikarte: ← Nochmal, → Gut, ↑ Leicht, ↓ Schwer.
