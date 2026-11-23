# Lizenzen

## Eigener Code
Der Code dieses Projekts ist ein privates Projekt. (Lizenz nach Wunsch ergänzen, z. B. MIT.)

## Verwendete Bibliotheken (werden mit der App ausgeliefert)

| Bibliothek | Zweck | Lizenz |
|---|---|---|
| [React](https://react.dev) | Oberfläche | MIT |
| [Dexie.js](https://dexie.org) / dexie-react-hooks | Datenbank (IndexedDB) | Apache-2.0 |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | Wiederholungsalgorithmus FSRS | MIT |
| [WanaKana](https://wanakana.com) | Romaji ↔ Kana | MIT |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) | QR-Code zum Verbinden weiterer Geräte | MIT |
| [Workbox](https://developer.chrome.com/docs/workbox) (über vite-plugin-pwa) | Offline-Betrieb (Service Worker) | MIT |
| [@patdx/kuromoji](https://github.com/patdx/kuromoji.js) (Fork von kuromoji.js) | Zerlegung japanischer Texte in Wörter | Apache-2.0 |
| IPADIC (Wörterbuch von kuromoji, NAIST/IPA) | Daten der Textanalyse | IPADIC-Lizenz (frei, mit Copyright-Hinweis) |

## Werkzeuge (nur zum Entwickeln, nicht in der App enthalten)
Vite (MIT), vite-plugin-pwa (MIT), TypeScript (Apache-2.0), Vitest (MIT).

## Fremddaten (Stufe 3)

Die Daten werden beim Veröffentlichen automatisch heruntergeladen und umgewandelt
(`scripts/fetch-data.mjs`, `scripts/build-data.mjs`) und **monatlich** aktualisiert. Sie liegen nicht im Repository.
In der App werden sie erst auf Wunsch geladen (Mehr → Wörterbuch & Lesedaten).

| Daten | Herkunft | Lizenz | Pflichten / Umsetzung |
|---|---|---|---|
| **Wadoku** (japanisch–deutsch) | [www.wadoku.de](https://www.wadoku.de), EDICT2-Export, Ulrich Apel und Wadoku e.V. | [Wadoku.de-Daten-Lizenz](https://www.wadoku.de/wiki/display/WAD/Wadoku.de-Daten+Lizenz) | Weitergabe in kostenloser, werbefreier Software erlaubt mit vollständiger Herkunftsangabe; Link zur Lizenz auf der Startseite; sichtbarer Link zu www.wadoku.de unter dem Suchfeld. → Startseite (Fußzeile), Schnelleingabe (unter den Vorschlägen), Pop-up beim Lesen, „Über & Quellen“. Gekürzt: ohne Sätze und Namen, höchstens 5 Bedeutungen. |
| **JMdict** „common“ (nur Häufigkeit, Wortart, englische Ergänzung) | [EDRDG](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project), über [jmdict-simplified](https://github.com/scriptin/jmdict-simplified) | [EDRDG-Lizenz](https://www.edrdg.org/edrdg/licence.html), CC BY-SA 4.0 | Hinweis auf eigenem Bildschirm („Über & Quellen“) mit Links; regelmäßige Aktualisierung → GitHub-Workflow monatlich. Abgeleitete Daten unter gleicher Lizenz. Die **deutschen** JMdict-Bedeutungen werden bewusst nicht verwendet (Rechte liegen bei separaten Bearbeitern). |
| **Tatoeba** (Beispielsätze jpn + deu) | [tatoeba.org](https://tatoeba.org) | [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) | Autor jedes Satzes und jeder Übersetzung wird in der Leseansicht genannt und verlinkt. |

Die Beispielvokabeln in `/examples` sind allgemeiner Grundwortschatz mit eigenen Übersetzungen.
