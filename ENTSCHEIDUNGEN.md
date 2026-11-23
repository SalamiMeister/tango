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

## 2026-11-23 – Lange Vokale beim Eintippen

Romaji-Anzeige bleibt Tipp-Romaji (おはよう → „ohayou“). Genki schreibt lange Vokale doppelt („ohayoo“, „sensee“), Hepburn mit Makron („ohayō“). Automatisch „richtig“ umzuschreiben geht nicht zuverlässig (おもう = „omou“, nicht „omō“). Wer will, trägt das Romaji-Feld von Hand ein.

Beim **Eintippen (DE→JP)** zählen alle drei Schreibweisen als richtig (`longVowelKey` in `lib/answer.ts`): gleicher Vokal doppelt, o+u, e+i und der Strich ー werden gleichgesetzt – nur für **denselben** langen Vokal. Kurz und lang bleiben verschieden (おばさん ≠ おばあさん, ゆき ≠ ゆうき, ビル ≠ ビール). Eine abweichende Schreibweise wird als „Gut“ gewertet, die App zeigt dazu die richtige Kana-Schreibweise. Bekannte Grenze: Wortpaare, die sich nur in おう/おお unterscheiden (こうり/こおり), gelten als gleich – sehr selten. Abgesichert durch Tests mit Gegenbeispielen und einen Kreuztest aller Beispielwörter.

## 2026-11-23 – Stufe 3 (Wörterbuch & Lesen)

**Wörterbuch: Wadoku für Deutsch, JMdict „common“ nur ergänzend.** Die deutschen Bedeutungen in JMdict haben eigene, ungeklärte Rechte; Wadoku erlaubt die Weitergabe in kostenloser, werbefreier Software mit Herkunftsangabe. Verwendet wird der EDICT2-Export (einfaches Textformat, „Beta“). Weil dort manche Leerzeichen fehlen („elektrischeBahn“), bereinigt `scripts/gloss.mjs` die Bedeutungen (mit Tests). JMdict „common“ liefert Häufigkeitsmarkierung, Wortart und „wird meist in Kana geschrieben“ (dann wird kein Kanji vorgeschlagen, z. B. おはよう). Für die Reihenfolge der Vorschläge zählt außerdem, wie oft die Grundform in den 249.000 japanischen Tatoeba-Sätzen vorkommt (先生 vor 先制).

**Zwei Wörterbuch-Pakete:** „häufig“ (~26.000 Einträge, ~1 MB) für alle; „erweitert“ (~400.000, ~15 MB) optional, eher für den PC. Beide in IndexedDB (Tabelle `dict`, Datenbank-Version 2), nicht synchronisiert. Ist das häufige Wörterbuch geladen, prüft die App höchstens wöchentlich, ob es neuere Daten gibt, und aktualisiert es still.

**Daten werden beim Veröffentlichen erzeugt, nicht im Repo gespeichert.** `npm run data:fetch` lädt die aktuellen Rohdaten (Wadoku-Dateiname und JMdict-Release werden automatisch ermittelt), `npm run data` wandelt sie um. Der GitHub-Workflow macht das bei jedem Push und zusätzlich monatlich (EDRDG verlangt regelmäßige Aktualisierung).

**Satzzerlegung: `@patdx/kuromoji`** (gepflegter Fork von kuromoji.js, ESM, eigener Loader). Tatoeba-Sätze werden schon beim Build zerlegt (kein Analyse-Download nötig, um Beispielsätze zu lesen). Für eigene Texte lädt die App das Analyse-Wörterbuch (~17 MB) beim ersten Speichern; die Dateien liegen als `*.dat.gz.bin` vor, damit kein Server sie automatisch entpackt – die App entpackt selbst (DecompressionStream). Der Service Worker speichert sie danach für offline.

**Bekanntheitsquote:** Nur Inhaltswörter zählen (keine Partikeln, Hilfsverben, Satzzeichen, Zahlen, Namen, unselbständigen Wörter). „Bekannt“ = eigene aktive Vokabel, die mindestens einmal gelernt wurde (optional auch ungelernte). Verglichen wird über die Grundform (飲みます → 飲む) und Kana/Kanji. Tatoeba: nur Sätze mit deutscher Übersetzung und 4–40 Zeichen (~49.000).

**Import ergänzt aus dem Wörterbuch** – nur wenn eindeutig, nie überschreibend: fehlende Kana (aus Kanji), Kanji, Bedeutung, Wortart. Mehrere Kandidaten werden über die angegebene deutsche Bedeutung eingegrenzt (はし + „Brücke“ → 橋), sonst „mehrdeutig, bitte prüfen“. Kanji- und Bedeutungs-Ergänzung sind getrennt abschaltbar.

**Navigation:** „Lesen“ ersetzt „Import“ in der unteren Leiste; Import ist über die Vokabelliste erreichbar.
