# Tango – Japanisch-Vokabeltrainer

Persönlicher, kostenloser Vokabeltrainer für Japanisch (Deutsch als Muttersprache).
Läuft im Browser auf Handy und PC, funktioniert offline, lernt mit Spaced Repetition (FSRS).

Die verbindliche Planung steht in [SPEC.md](SPEC.md), technische Entscheidungen in [ENTSCHEIDUNGEN.md](ENTSCHEIDUNGEN.md).

**Stand: Stufe 1** – Schnelleingabe, Tabellen-/CSV-Import, JSON-Backup, Vokabelliste, Karteikarten mit FSRS, Startbildschirm, offlinefähig.

---

## 1. Einmalig einrichten

Benötigt: **Node.js** (LTS) und **Git**. Prüfen in PowerShell:

```bash
node --version
```

```bash
git --version
```

Falls etwas fehlt: [nodejs.org](https://nodejs.org) bzw. [git-scm.com](https://git-scm.com) installieren.

Dann im Projektordner die Bibliotheken installieren (dauert ca. 30 Sekunden, nur einmal nötig):

```bash
npm install
```

## 2. Starten

Entweder **Doppelklick auf `Starten.bat`** oder im Projektordner:

```bash
npm start
```

Der Browser öffnet sich mit `http://localhost:5173`. Änderungen am Code erscheinen sofort.
Beenden: im Terminal `Strg + C`.

> Im Entwicklungsmodus ist der Offline-Betrieb absichtlich aus. Zum Testen siehe Abschnitt 4.

## 3. Tests

```bash
npm test
```

Prüft automatisch: Tabellen-/CSV-Import, Duplikaterkennung, FSRS-Anbindung, Kartenauswahl, Zusammenführen von Backups.

## 4. Offline-Betrieb testen (am PC)

```bash
npm run build
```

```bash
npm run preview
```

Die fertige App öffnet sich unter `http://localhost:4173`. Seite einmal neu laden, dann
im Browser `F12` → Reiter **Network** (Netzwerk) → **Offline** anhaken → Seite neu laden. Die App muss weiter funktionieren.
(Oder einfach `npm run preview` mit `Strg + C` beenden und neu laden.)

Unter **Mehr → Daten** steht „✓ Offline-Betrieb bereit“, sobald alles gespeichert ist.

## 5. Auf dem Handy testen

**Schnell im WLAN (ohne Offline/Installation):**

```bash
npm run dev -- --host
```

Im Terminal erscheint eine Adresse wie `http://192.168.0.23:5173` – diese am Handy öffnen (gleiches WLAN).
Fragt die Windows-Firewall nach, „Private Netzwerke“ erlauben.
Offline-Betrieb und „Zum Startbildschirm hinzufügen“ gehen so **nicht**, weil Handys dafür HTTPS verlangen.

**Richtig (offline, installierbar):** über GitHub Pages, siehe Abschnitt 6. Danach am Handy die Adresse öffnen und
- Android/Chrome: Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“
- iPhone/Safari: Teilen-Symbol → „Zum Home-Bildschirm“

> Die Daten liegen pro Gerät/Browser getrennt. Übertragen geht vorerst per **Mehr → Backup exportieren / einspielen**; automatische Synchronisation über OneDrive kommt in Stufe 2.

## 6. Veröffentlichen auf GitHub Pages (kostenlos)

Einmalig:

1. Auf [github.com](https://github.com) anmelden → **New repository** → Name z. B. `tango` → *Public* (GitHub Pages ist für private Repos nur mit Bezahl-Konto verfügbar) → **Create repository**. Keine README anlegen lassen.
2. Im Projektordner (PowerShell) – `<DEIN-NAME>` ersetzen:
   ```bash
   git init -b main
   ```
   ```bash
   git add .
   ```
   ```bash
   git commit -m "Stufe 1"
   ```
   ```bash
   git remote add origin https://github.com/<DEIN-NAME>/tango.git
   ```
   ```bash
   git push -u origin main
   ```
   Beim ersten Push öffnet sich ein Anmeldefenster für GitHub.
3. Auf GitHub im Repository: **Settings → Pages → Build and deployment → Source: „GitHub Actions“**.
4. Reiter **Actions** öffnen: Der Lauf „Deploy auf GitHub Pages“ dauert ca. 1–2 Minuten. Danach ist die App unter
   `https://<DEIN-NAME>.github.io/tango/` erreichbar.

Danach genügt für jedes Update:

```bash
git add .
```

```bash
git commit -m "Beschreibung der Änderung"
```

```bash
git push
```

Hinweis: Eine neue Version wird im Hintergrund geladen und ist ab dem **übernächsten** Öffnen aktiv (App schließen und erneut öffnen).

> Datenschutz: Die App selbst ist öffentlich erreichbar, deine **Vokabeln aber nicht** – sie liegen nur im Browser deines Geräts.

## 7. Bedienung in Kürze

| Wo | Was |
|---|---|
| Start | Großer Knopf „Lernen (N)“ startet sofort eine Einheit (20 Karten). „Gezielt lernen“: nach Lektion/Richtung. |
| „+“-Knopf / Taste **N** | Schnelleingabe: Romaji tippen → wird zu Kana (GROSSBUCHSTABEN → Katakana). **Enter** speichert, Quelle + Lektion bleiben stehen. |
| Import | Zeilen aus Excel/Google Sheets einfügen oder CSV wählen → Spalten werden erraten, per Auswahlfeld korrigierbar → Import. |
| Vokabeln | Suchen (auch per Romaji), filtern, antippen zum Bearbeiten, Häkchen für Massenbearbeitung. |
| Mehr | Tageslimit, Einheitsgröße, Richtung, Farbschema, Backup. |

**Tastenkürzel beim Lernen:** Leertaste/Enter = umdrehen · 1 Nochmal · 2 Schwer · 3 Gut · 4 Leicht · Rücktaste = letzte Bewertung zurücknehmen · Esc = beenden.

### Import-Format

Beliebige Spaltenreihenfolge, Trennzeichen Tabulator, Semikolon oder Komma. Mit Überschrift werden die Spalten sicher erkannt:

```
Kana;Kanji;Bedeutung;Romaji;Wortart;Lektion;Quelle;Tags;Notiz
たべる;食べる;essen, speisen;taberu;ru-Verb;3;Genki 1;Verben;
```

- Mehrere Bedeutungen/Tags in einer Zelle mit Komma trennen.
- Wortarten: Nomen, u-Verb, ru-Verb, irreg. Verb, i-Adj., na-Adj., Adverb, Ausdruck, Partikel, Sonstiges (auch englische Kürzel wie `n`, `u-verb`, `i-adj` werden erkannt).
- Excel: „Speichern unter → **CSV UTF-8**“, sonst gehen japanische Zeichen verloren.
- Beispiele: [`examples/beispiel-vokabeln.csv`](examples/beispiel-vokabeln.csv), Vorlage [`examples/vorlage.csv`](examples/vorlage.csv), Einfüge-Test mit 20 Wörtern [`examples/test-20-woerter.txt`](examples/test-20-woerter.txt).

## 8. Projektaufbau

```
src/
  types.ts            Datentypen (Word, Review, …)
  db.ts               Datenbank-Schema (Dexie / IndexedDB)
  repo.ts             alle Lese-/Schreibzugriffe auf die Datenbank
  hooks.ts            Live-Daten für die Oberfläche
  router.ts           Seitenwechsel über #/adresse
  lib/
    fsrs.ts           Anbindung an den FSRS-Algorithmus
    session.ts        welche Karten heute dran sind
    tableImport.ts    Tabellen/CSV einlesen, Spalten erraten
    duplicates.ts     Duplikate erkennen, Import planen
    merge.ts          „neuester Stand gewinnt“ (Backup, später Sync)
    text.ts           Kana/Romaji-Helfer
    *.test.ts         automatische Tests
  pages/              Start, Lernen, Vokabeln, Bearbeiten, Import, Einstellungen
  components/         Schnelleingabe, Formular, Hinweis-Leiste
examples/             Beispiel-CSV und Vorlage
scripts/make-icons.mjs  erzeugt die App-Icons
```

Lizenzen: [LICENSES.md](LICENSES.md).
