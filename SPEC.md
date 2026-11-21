# SPEC – Japanisch-Vokabeltrainer (Arbeitstitel: „Tango“)

Diese Datei ist die verbindliche Vorgabe für die Entwicklung. Bitte vor jeder größeren Änderung lesen und bei Abweichungen aktualisieren.

## 1. Ziel

Ein kostenloser, persönlicher Vokabeltrainer für Japanisch (Deutsch als Muttersprache), der den Uni-Kurs (Lehrbuch Genki 1, später Genki 2 / andere Quellen) ergänzt.

- Läuft auf **Handy und Desktop** aus einer Codebasis.
- Funktioniert **offline**.
- **Schnelle Eingabe und Import** neuer Vokabeln ist zentral.
- Lernen über **Spaced Repetition** plus mehrere Abfragemodi.
- **Lesepassagen**, die aus bereits gelernten Wörtern bestehen.

Der Nutzer programmiert selbst nur rudimentär (Python/Java). Code soll daher einfach, gut kommentiert und mit einem Befehl startbar sein. Die README erklärt Installation, Start und Deployment Schritt für Schritt auf Deutsch.

### Ausdrücklich NICHT im Umfang
- Hiragana-/Katakana-Trainer (wird mit einer anderen App gelernt).
- Kanji-Schreibtraining (Strichfolge) – evtl. viel später.
- Nutzerkonten für mehrere Personen.

## 2. Plattform & Tech-Stack

- **Progressive Web App (PWA)**: im Browser nutzbar, auf dem Handy zum Startbildschirm hinzufügbar, offlinefähig über einen Service Worker.
- **Vite + React + TypeScript** (alternativ Svelte, falls deutlich einfacher – Entscheidung zu Beginn dokumentieren).
- **IndexedDB über Dexie.js** als lokale Datenbank.
- **ts-fsrs** für den Wiederholungsalgorithmus (FSRS).
- **WanaKana** für Romaji→Kana-Umwandlung bei der Eingabe.
- **kuromoji.js** (oder vergleichbar) zur Zerlegung japanischer Sätze in Wörter (für Lesepassagen).
- **Web Speech API** (`ja-JP`) für Sprachausgabe – keine Audiodateien nötig.
- **Hosting**: statisch auf GitHub Pages (kostenlos). Kein eigener Server.
- **Synchronisation**: Microsoft Graph API (OneDrive, App-Ordner `approot`) mit **MSAL.js**, Anmeldung mit privatem Microsoft-Konto (siehe Abschnitt 8).
- Code-Verwaltung: Git + GitHub. Projektordner liegt lokal und **nicht** in einem OneDrive-Ordner.
- Mobile-first-Layout, große Tipp-Flächen, Dark Mode.
- Oberflächensprache: Deutsch.

## 3. Datenmodell

> Umsetzung: Zeitpunkte werden als Millisekunden-Zahl gespeichert (siehe ENTSCHEIDUNGEN.md).

### Vokabel (`Word`)
| Feld | Typ | Pflicht | Hinweis |
|---|---|---|---|
| id | string (UUID) | ja | |
| kana | string | ja | z. B. たべる |
| kanji | string | nein | z. B. 食べる |
| romaji | string | nein | wird bei Bedarf automatisch erzeugt |
| meaning_de | string[] | ja | mehrere Bedeutungen erlaubt |
| part_of_speech | enum | nein | Nomen, u-Verb, ru-Verb, irreg. Verb, i-Adj., na-Adj., Adverb, Ausdruck, Partikel, Sonstiges |
| source | string | nein | z. B. „Genki 1“ |
| lesson | number | nein | Genki-Lektion |
| tags | string[] | nein | frei |
| note | string | nein | Eselsbrücken, Beispiele |
| active | boolean | ja | nur aktive Wörter werden gelernt |
| created_at | date | ja | |
| updated_at | date | ja | für Synchronisation (gilt für alle Tabellen) |
| deleted | boolean | ja | „weiches“ Löschen für Synchronisation (gilt für alle Tabellen) |

### Lernstand (`Review`)
Pro Wort **und Richtung** (JP→DE, DE→JP) ein eigener FSRS-Zustand (fällig am, Stabilität, Schwierigkeit, Historie der Bewertungen).

### Lesetext (`Passage`)
id, japanischer Text, optionale Übersetzung, Quelle (z. B. Tatoeba, selbst eingefügt, KI-generiert), Liste der enthaltenen Wörter, Anteil bekannter Wörter.

### Wörterbuch (`DictEntry`, schreibgeschützt)
Großes Hintergrund-Wörterbuch für Vorschläge (siehe Abschnitt 5). Getrennt von den eigenen Vokabeln gespeichert.

## 4. Vokabeln eingeben & importieren (hohe Priorität)

1. **Schnelleingabe-Formular**
   - Eingabe in Romaji wird live zu Kana umgewandelt (WanaKana).
   - Während der Eingabe Vorschläge aus dem Wörterbuch (Kanji, Lesung, Bedeutung) – ein Tipp übernimmt alles.
   - „Sticky“-Felder: Quelle und Lektion bleiben für die nächste Eingabe gesetzt.
   - Enter speichert und leert das Formular für das nächste Wort.
2. **Einfügen aus Tabelle**: Text mit Tabulator- oder Semikolon-Trennung (direkt aus Excel/Google Sheets kopiert) in ein Feld einfügen → Vorschau mit Spaltenzuordnung → Import.
3. **CSV-Datei-Import** mit derselben Vorschau.
4. **Duplikaterkennung** (gleiche Kana + gleiches Kanji) mit Wahl: überspringen / zusammenführen / trotzdem anlegen.
5. **Massenbearbeitung**: mehrere Wörter auswählen → Lektion, Tags, aktiv/inaktiv setzen.
6. **Export/Import der gesamten Datenbank** als JSON (Backup und Übertragung Handy ↔ Desktop).

Eine Beispiel-CSV mit 10 Wörtern und eine Vorlage zum Ausfüllen liegen im Repo unter `/examples`.

## 5. Hintergrund-Wörterbuch

- Freie Wörterbuchdaten (JMdict – CC BY-SA; enthält englische und teils deutsche Bedeutungen; für Deutsch zusätzlich Wadoku prüfen, **Lizenz vorher klären und in der README dokumentieren**).
- Nur als Nachschlage- und Vorschlagsquelle, **nicht** als Lernliste. Eigene Vokabeln entstehen, indem man einen Eintrag übernimmt („aktiviert“).
- Optional: Wörter nach Häufigkeit oder JLPT-Stufe filtern und gezielt übernehmen.
- Daten werden einmalig per Skript in ein kompaktes Format umgewandelt und beim ersten Start geladen (Größe beachten; ggf. erst auf Nachfrage herunterladen).

## 6. Lernmodi

Alle Modi lassen sich filtern: nach Lektion, Tag, Wortart, „nur fällige“, „nur Problemwörter“.

1. **Karteikarten (Kern, mit FSRS)**
   - Richtung JP→DE, DE→JP oder gemischt.
   - Vorderseite → Tippen zum Umdrehen → Bewertung: Nochmal / Schwer / Gut / Leicht.
   - Wischgesten auf dem Handy, Tastenkürzel am Desktop (Leertaste umdrehen, 1–4 bewerten).
   - Tägliches Limit für neue Karten einstellbar.
2. **Multiple Choice**
   - 4 Antworten; falsche Antworten bevorzugt aus derselben Lektion bzw. derselben Wortart.
   - Ergebnisse fließen in den FSRS-Lernstand ein (falsch = „Nochmal“).
3. **Eintippen**
   - DE→JP: Eingabe in Romaji, Umwandlung zu Kana; Kana und Kanji werden als richtig akzeptiert.
   - JP→DE: tolerante Prüfung (Groß-/Kleinschreibung, Artikel, eine von mehreren Bedeutungen genügt); bei Grenzfällen „Ich lag richtig“-Knopf.
4. **Hören**: Wort wird vorgelesen, Bedeutung wählen oder tippen.
5. **Zuordnen**: 5–6 Paare JP ↔ DE verbinden, auf Zeit (Abwechslung, kein FSRS-Einfluss).

## 7. Lesepassagen

Ziel: kurze Texte lesen, die fast nur aus bekannten Wörtern bestehen.

**Quellen (in dieser Reihenfolge umsetzen):**
1. **Beispielsätze aus Tatoeba** (CC BY 2.0 FR, Japanisch mit englischen/deutschen Übersetzungen). Sätze werden mit kuromoji zerlegt, mit den eigenen Vokabeln abgeglichen und nach Anteil bekannter Wörter sortiert. Standardfilter: ≥ 90 % bekannt.
2. **Eigene Texte einfügen** (z. B. vom Kurs oder generiert) – die App markiert bekannte/unbekannte Wörter.
3. **„Prompt für KI erzeugen“-Knopf**: Die App erzeugt einen fertigen Text-Prompt mit der Liste der aktiven Vokabeln und Grammatik bis Lektion X. Der Nutzer kopiert ihn in Claude/einen anderen Chat und fügt den erhaltenen Text über Quelle 2 wieder ein. (Kein API-Schlüssel, keine Kosten.)
4. *(Optional, später)* Direkte Generierung über eine KI-API mit eigenem Schlüssel.

**Leseansicht:**
- Wort antippen → Lesung und Bedeutung als Pop-up; unbekanntes Wort mit einem Tipp als neue Vokabel übernehmen.
- Furigana ein-/ausblendbar.
- Vorlesen des Satzes / Textes.
- Übersetzung erst auf Tipp aufdecken.

## 8. Synchronisation über OneDrive

- Einmalige Anmeldung mit Microsoft-Konto (MSAL.js, Token wird im Browser gespeichert und automatisch erneuert). Danach keine weitere Aktion nötig.
- Speicherort: App-Ordner im OneDrive des Nutzers (`/Apps/<App-Name>/`); die App bekommt nur Zugriff auf diesen Ordner (Berechtigung `Files.ReadWrite.AppFolder`).
- Inhalt: eine JSON-Datei mit Vokabeln, Lernständen, Lesetexten und Einstellungen (Wörterbuch wird **nicht** synchronisiert).
- **Automatisch:** beim Öffnen der App, nach jeder abgeschlossenen Lerneinheit und beim Verlassen/Ausblenden der App. Zusätzlich ein Knopf „Jetzt synchronisieren“.
- **Konflikte:** jeder Datensatz hat `updated_at`; beim Zusammenführen gewinnt pro Datensatz der neueste Stand. Gelöschte Einträge werden als „gelöscht“ markiert statt entfernt, damit sie nicht zurückkehren.
- **Offline:** Lernen funktioniert immer lokal; Änderungen werden gesammelt und beim nächsten Online-Moment hochgeladen.
- Kleine Statusanzeige (z. B. Wolkensymbol: synchron / ausstehend / Fehler) – Fehler nie als blockierender Dialog.
- Manueller JSON-Export/-Import bleibt als Backup erhalten.
- README enthält eine bebilderte Schritt-für-Schritt-Anleitung zur App-Registrierung im Microsoft-Entra-Portal (kostenlos) inkl. Redirect-URIs für `localhost` und GitHub Pages.

## 9. Reibungslose Bedienung (Leitprinzip)

Motivation hängt an niedriger Hürde. Jede Funktion wird daran gemessen:

- **Ein Tipp bis zum Lernen:** Startbildschirm hat einen großen Knopf „Lernen (N fällig)“, der sofort mit sinnvollen Standardeinstellungen startet. Filter und Modi sind optional, nicht Pflicht.
- **Sitzungen sind jederzeit abbrechbar** ohne Verlust; jede bewertete Karte ist sofort gespeichert.
- **Kurze Einheiten:** Standard-Sitzung ca. 5 Minuten / 20 Karten, danach „Weiter oder fertig?“.
- **Keine Bestätigungsdialoge** für Alltagsaktionen; stattdessen „Rückgängig“-Leiste für einige Sekunden (z. B. nach Löschen oder falscher Bewertung).
- **Schnell:** App startet offline in unter 2 Sekunden, Kartenwechsel ohne spürbare Verzögerung.
- **Einhändig auf dem Handy bedienbar:** wichtige Knöpfe im unteren Bildschirmbereich.
- **Neue Vokabeln von überall:** schwebender „+“-Knopf öffnet die Schnelleingabe.
- **Keine Überforderung:** Tageslimit für neue Karten; wenn viele Karten überfällig sind, werden sie verteilt statt alle auf einmal angezeigt.
- Erinnerung/Benachrichtigung optional und standardmäßig aus.

## 10. Statistik & Motivation

- Startbildschirm: heute fällig, neue Karten, Lernserie (Tage in Folge).
- Fortschritt pro Lektion (neu / in Lernphase / sicher).
- Liste der Problemwörter (häufig „Nochmal“).
- Einfacher Verlauf: gelernte Karten pro Tag.

## 11. Ausbaustufen

### Stufe 1 – Grundgerüst (zuerst umsetzen)
- Projekt-Setup, PWA, offlinefähig, Deployment auf GitHub Pages.
- Datenmodell + Dexie.
- Schnelleingabe (ohne Wörterbuch-Vorschläge), Einfügen aus Tabelle, CSV-Import, JSON-Export/-Import.
- Vokabelliste mit Suche, Filter, Bearbeiten, aktiv/inaktiv.
- Karteikarten mit FSRS in beide Richtungen.
- Startbildschirm mit fälligen Karten.

**Fertig, wenn:** 20 Genki-Vokabeln in unter 2 Minuten per Einfügen importiert werden können, sie auf Handy und Desktop lernbar sind und die App im Flugmodus funktioniert.

### Stufe 2 – Synchronisation & Abfragemodi
- **Zuerst:** OneDrive-Synchronisation (Abschnitt 8) inkl. Anleitung zur App-Registrierung.
- Danach: Multiple Choice, Eintippen (WanaKana), Hören, Zuordnen.
- Tastenkürzel und Wischgesten.

**Fertig, wenn:** eine am Desktop eingegebene Vokabel nach dem Öffnen der App auf dem Handy ohne weiteres Zutun erscheint und eine am Handy gelernte Karte am Desktop den neuen Lernstand zeigt.

### Stufe 3 – Wörterbuch & Lesen
- Hintergrund-Wörterbuch mit Vorschlägen bei der Eingabe.
- Lesepassagen (Tatoeba, eigene Texte, Prompt-Knopf), Leseansicht.

### Stufe 4 – Komfort
- Statistiken.
- Feinschliff der Bedienung anhand der Prinzipien aus Abschnitt 9 nach einigen Wochen echter Nutzung.

## 12. Qualität & Arbeitsweise

- Das Datenmodell enthält von Anfang an `updated_at` und ein `deleted`-Flag an allen synchronisierten Datensätzen, damit die Synchronisation in Stufe 2 ohne Umbau möglich ist.

- Jede Stufe in kleinen, lauffähigen Schritten; nach jedem Schritt kurz erklären, was neu ist und wie man es testet.
- Unit-Tests für: FSRS-Anbindung, CSV-/Tabellen-Import, Antwortprüfung beim Eintippen, Bekanntheitsquote von Sätzen.
- Keine Daten verlassen das Gerät, außer der Nutzer exportiert sie oder aktiviert später die Synchronisation.
- Lizenzen aller Fremddaten (JMdict, Tatoeba, ggf. Wadoku) in `LICENSES.md` dokumentieren und in der App unter „Über“ nennen.
- Vokabelinhalte aus kostenpflichtigen Fremdangeboten werden nicht automatisch ausgelesen; Importe sind nur eigene Listen.
