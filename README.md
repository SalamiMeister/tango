# Tango – Japanisch-Vokabeltrainer

Persönlicher, kostenloser Vokabeltrainer für Japanisch (Deutsch als Muttersprache).
Läuft im Browser auf Handy und PC, funktioniert offline, lernt mit Spaced Repetition (FSRS).

Die verbindliche Planung steht in [SPEC.md](SPEC.md), technische Entscheidungen in [ENTSCHEIDUNGEN.md](ENTSCHEIDUNGEN.md).

**Stand: Stufe 2** – Stufe 1 (Schnelleingabe, Import, Backup, Vokabelliste, Karteikarten mit FSRS, offlinefähig) plus automatische Synchronisation über ein privates GitHub-Repo, die Modi Multiple Choice, Eintippen, Hören und Zuordnen, Wischgesten und Tastenkürzel.

Online: **https://salamimeister.github.io/tango/**

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

Prüft automatisch: Tabellen-/CSV-Import, Duplikaterkennung, FSRS-Anbindung, Kartenauswahl, Antwortprüfung beim Eintippen, Auswahl falscher Antworten, Zusammenführen bei Backup und Synchronisation.

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

> Die Daten liegen pro Gerät/Browser getrennt. Zum Abgleich die Synchronisation einrichten (Abschnitt 6b) – oder von Hand per **Mehr → Backup exportieren / einspielen**.

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

> Datenschutz: Die App selbst ist öffentlich erreichbar, deine **Vokabeln aber nicht** – sie liegen im Browser deines Geräts und, falls eingerichtet, in deinem **privaten** Sync-Repo.

## 6b. Synchronisation einrichten (einmalig, ca. 5 Minuten)

Vokabeln und Lernstand werden automatisch zwischen deinen Geräten abgeglichen. Gespeichert wird eine Datei
`tango-sync.json` in einem **privaten** GitHub-Repo – nur du kannst sie sehen. Kostenlos, keine Kreditkarte.

**Schritt 1 – privates Daten-Repo anlegen**
1. [github.com/new](https://github.com/new) öffnen.
2. Name: `tango-daten` · Sichtbarkeit: **Private** · **„Add README“ einschalten** (das Repo darf nicht ganz leer sein).
3. **Create repository**.

> Nicht das App-Repo `tango` verwenden – das ist öffentlich! Die App weigert sich auch, mit einem öffentlichen Repo zu synchronisieren.

**Schritt 2 – Zugangsschlüssel (Token) erstellen**
1. [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new) öffnen
   (GitHub → Profilbild → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token).
2. **Token name:** `Tango Sync` · **Expiration:** möglichst lang (z. B. 1 Jahr oder „No expiration“, falls angeboten).
3. **Repository access:** „Only select repositories“ → `tango-daten` auswählen.
4. **Permissions → Repository permissions → Contents:** „**Read and write**“. (Sonst nichts ändern.)
5. **Generate token** → den angezeigten Schlüssel (`github_pat_…`) kopieren. Er wird nur einmal angezeigt.

Der Schlüssel kann **nur** die Dateien in `tango-daten` lesen und schreiben – sonst nichts.

**Schritt 3 – in der App verbinden (PC)**
1. Tango öffnen → **Mehr → Synchronisation**.
2. Repo: `SalamiMeister/tango-daten` · Zugangsschlüssel einfügen → **Verbinden**.
3. Oben rechts erscheint ein Wölkchen: ☁✓ = synchron, ☁• = Änderungen ausstehend, ☁⨯ = offline, ☁! = Fehler (antippen = jetzt synchronisieren).

**Schritt 4 – Handy verbinden**
1. Am PC: **Mehr → Synchronisation → Weiteres Gerät verbinden** → QR-Code erscheint.
2. **Android:** QR-Code mit der Kamera scannen → Link öffnen → **Verbinden**.
   **iPhone:** Die zum Home-Bildschirm hinzugefügte App hat einen eigenen Speicher, getrennt von Safari. Daher am PC
   „Stattdessen Link kopieren“, den Link z. B. per Mail/Notiz aufs Handy schicken, in der Tango-App unter
   **Mehr → Synchronisation → Einrichtungs-Link einfügen** einfügen.

Wann synchronisiert wird: beim Öffnen der App bzw. Zurückkehren in die App, nach jeder Lerneinheit, beim Verlassen,
wenn das Gerät wieder online ist, und 30 Sekunden nach jeder Änderung. Offline lernen geht immer; die Änderungen
werden nachgeholt. Bei Konflikten gewinnt pro Vokabel/Karte der neueste Stand.

Wenn der Schlüssel abläuft: neuen Token erstellen (Schritt 2), dann **Trennen** und neu **Verbinden**. Es gehen keine Daten verloren.

## 7. Bedienung in Kürze

| Wo | Was |
|---|---|
| Start | Großer Knopf „Lernen (N)“ startet sofort Karteikarten (20 Karten). Darunter mit einem Tipp: **Auswahl**, **Tippen**, **Hören**, **Zuordnen**. „Gezielt lernen“: Modus, Lektion, Richtung, Wortart, nur fällige, nur Problemwörter. |
| „+“-Knopf / Taste **N** | Schnelleingabe: Romaji tippen → wird zu Kana (GROSSBUCHSTABEN → Katakana). **Enter** speichert, Quelle + Lektion bleiben stehen. |
| Import | Zeilen aus Excel/Google Sheets einfügen oder CSV wählen → Spalten werden erraten, per Auswahlfeld korrigierbar → Import. |
| Vokabeln | Suchen (auch per Romaji), filtern, antippen zum Bearbeiten, Häkchen für Massenbearbeitung. |
| Mehr | Tageslimit, Einheitsgröße, Richtung, Farbschema, Backup. |

### Lernmodi

| Modus | So geht's | Wertung (FSRS) |
|---|---|---|
| Karteikarten | Tippen/Leertaste = umdrehen, dann bewerten. **Wischen:** ← Nochmal · → Gut · ↑ Leicht · ↓ Schwer | wie gewählt |
| Multiple Choice | 4 Antworten, falsche bevorzugt aus gleicher Lektion/Wortart | richtig = Gut, falsch = Nochmal |
| Eintippen | DE→JP: Romaji tippen (wird zu Kana), Kana oder Kanji zählen. JP→DE: Groß-/Kleinschreibung, Artikel, Klammern egal, eine Bedeutung genügt | richtig = Gut, Tippfehler = Schwer, falsch = Nochmal; „Ich lag richtig“ = Gut |
| Hören | Wort wird vorgelesen, Bedeutung wählen | wie Multiple Choice (Richtung JP→DE) |
| Zuordnen | 6 Paare auf Zeit verbinden | keine – reine Abwechslung |

**Problemwörter** = Karten, die mindestens zweimal vergessen wurden. Mit „nur Problemwörter“ werden sie geübt, auch wenn sie noch nicht fällig sind.

**Tastenkürzel:**
- Karteikarten: Leertaste/Enter = umdrehen · 1 Nochmal · 2 Schwer · 3 Gut · 4 Leicht
- Multiple Choice / Hören: 1–4 = Antwort wählen · Enter = weiter · Hören: Leertaste oder R = nochmal anhören
- Eintippen: Enter = prüfen, Enter = weiter
- Überall beim Lernen: Rücktaste oder Strg+Z = letzte Bewertung zurücknehmen · Esc = beenden
- Sonst: N = neue Vokabel

**Hören** braucht eine japanische Stimme auf dem Gerät. Fehlt sie, zeigt die App einen Hinweis.
Windows: Einstellungen → Zeit und Sprache → Sprache → Japanisch hinzufügen (mit Sprachausgabe).
Android: Einstellungen → Sprachausgabe (Text-in-Sprache) → Sprachdaten für Japanisch installieren. iPhone hat sie meist schon.

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
  learn/              Lernmodi (Karteikarte, Auswahl, Eintippen, Hören, Zuordnen) + Ablauf einer Einheit
  sync/               Synchronisation über GitHub (syncCore = Zusammenführen, github = API, syncManager = wann)
  lib/
    answer.ts         Prüfung getippter Antworten
    choices.ts        falsche Antworten für Multiple Choice
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
