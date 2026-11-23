// Wandelt die heruntergeladenen Rohdaten (data-raw/) in kompakte Dateien für die App um (public/data/).
// Aufruf: npm run data   (vorher: npm run data:fetch)
//
//  - Wörterbuch: Wadoku (deutsche Bedeutungen) + JMdict „common“ (Häufigkeit, Wortart, Englisch als Notlösung)
//  - Beispielsätze: Tatoeba (japanisch mit deutscher Übersetzung), vorab mit kuromoji in Wörter zerlegt
//  - kuromoji-Wörterbuch: wird nach public/kuromoji/ kopiert (für eigene Texte im Browser)

import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as kuromoji from '@patdx/kuromoji';
import NodeDictionaryLoader from '@patdx/kuromoji/node';
import { isKana, toHiragana, toRomaji } from 'wanakana';
import { cleanGloss } from './gloss.mjs';

const RAW = 'data-raw';
const OUT = 'public/data';
mkdirSync(OUT, { recursive: true });

function findFile(dir, test) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) {
      const r = findFile(p, test);
      if (r) return r;
    } else if (test(name.name)) return p;
  }
  return null;
}

const hasKanji = (s) => /\p{Script=Han}/u.test(s);
const clean = (s) => s.replace(/･/g, '');

// ---------------------------------------------------------------- JMdict common

/** JMdict-Wortart → unsere Wortarten */
function mapPos(tags) {
  for (const t of tags) {
    if (t === 'v1' || t === 'v1-s') return 'ru-Verb';
    if (t === 'vk' || t === 'vs-i' || t === 'vs-s' || t === 'vz') return 'irreg. Verb';
    if (t.startsWith('v5')) return 'u-Verb';
    if (t === 'adj-i' || t === 'adj-ix') return 'i-Adj.';
    if (t === 'adj-na') return 'na-Adj.';
    if (t === 'adv' || t === 'adv-to') return 'Adverb';
    if (t === 'prt') return 'Partikel';
    if (t === 'exp' || t === 'int') return 'Ausdruck';
    if (t === 'n' || t === 'pn' || t === 'n-suf' || t === 'n-pref') return 'Nomen';
  }
  return undefined;
}

const jmFile = findFile(join(RAW, 'jmdict'), (n) => n.endsWith('.json'));
if (!jmFile) throw new Error('JMdict-Datei fehlt – erst „npm run data:fetch“ ausführen.');
const jm = JSON.parse(readFileSync(jmFile, 'utf8'));
/** Schlüssel „kanji|kana“ bzw. „|kana“ → { pos, en } */
const common = new Map();
for (const w of jm.words) {
  const pos = mapPos(w.sense[0]?.partOfSpeech ?? []);
  const en = w.sense
    .slice(0, 3)
    .map((s) => s.gloss.filter((g) => g.lang === 'eng').map((g) => g.text).slice(0, 2).join(', '))
    .filter(Boolean);
  // „uk“ = wird meist in Kana geschrieben (z. B. おはよう statt お早う)
  const uk = (w.sense[0]?.misc ?? []).includes('uk');
  const info = { pos, en, id: w.id, uk };
  const kanas = w.kana.map((k) => k.text);
  if (w.kanji.length === 0 || uk) for (const k of kanas) if (!common.has(`|${k}`)) common.set(`|${k}`, info);
  for (const kj of w.kanji) for (const k of kanas) common.set(`${kj.text}|${k}`, info);
}
console.log(`JMdict common: ${jm.words.length} Wörter (${jm.dictDate})`);

const BUILT = new Date().toISOString();

// ---------------------------------------------------------------- Tatoeba

const tok = await new kuromoji.TokenizerBuilder({
  loader: new NodeDictionaryLoader({ dic_path: 'node_modules/@patdx/kuromoji/dict/' }),
}).build();

/** Inhaltswort? (zählt für die Bekanntheitsquote) */
export function isContent(t) {
  if (['助詞', '助動詞', '記号', 'フィラー', 'その他'].includes(t.pos)) return false;
  if (t.pos_detail_1 === '数' || t.pos_detail_1 === '非自立' || t.pos_detail_1 === '接尾' || t.pos_detail_1 === '固有名詞') return false;
  if (/^[\s\d０-９a-zA-Zａ-ｚＡ-Ｚ]+$/.test(t.surface_form)) return false;
  return true;
}

/** Token im App-Format: [Oberfläche, Grundform, Lesung in Hiragana (nur bei Kanji), Inhaltswort 1/0] */
function compactTokens(text) {
  return tok.tokenize(text).map((t) => [
    t.surface_form,
    t.basic_form && t.basic_form !== '*' ? t.basic_form : t.surface_form,
    hasKanji(t.surface_form) && t.reading && t.reading !== '*' ? toHiragana(t.reading) : '',
    isContent(t) ? 1 : 0,
  ]);
}

const tDir = join(RAW, 'tatoeba');
/** Grundform → Anzahl Vorkommen in Tatoeba */
const freq = new Map();
function readTsv(file) {
  return readFileSync(join(tDir, file), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split('\t'));
}
if (existsSync(join(tDir, 'jpn_sentences_detailed.tsv'))) {
  const jpnRows = readTsv('jpn_sentences_detailed.tsv');
  const jpn = new Map(jpnRows.map((r) => [r[0], { text: r[2], user: r[3] }]));
  // Worthäufigkeit (Grundform) über alle japanischen Sätze – zum Sortieren der Wörterbuch-Vorschläge
  for (const r of jpnRows) for (const t of tok.tokenize(r[2])) if (isContent(t)) freq.set(t.basic_form, (freq.get(t.basic_form) ?? 0) + 1);
  console.log(`Häufigkeiten aus ${jpnRows.length} Sätzen gezählt`);
  const deu = new Map(readTsv('deu_sentences_detailed.tsv').map((r) => [r[0], { text: r[2], user: r[3] }]));
  const seen = new Set();
  const sentences = [];
  for (const [jid, did] of readTsv('jpn-deu_links.tsv')) {
    const j = jpn.get(jid);
    const d = deu.get(did);
    if (!j || !d || seen.has(jid) || seen.has(j.text)) continue;
    if (j.text.length > 40 || j.text.length < 4) continue;
    seen.add(jid);
    seen.add(j.text);
    sentences.push([Number(jid), j.text, j.user === '\\N' ? '' : j.user, Number(did), d.text, d.user === '\\N' ? '' : d.user, compactTokens(j.text)]);
  }
  sentences.sort((a, b) => a[1].length - b[1].length);
  writeFileSync(
    join(OUT, 'tatoeba.json'),
    JSON.stringify({ meta: { built: BUILT, license: 'CC BY 2.0 FR', source: 'https://tatoeba.org' }, sentences }),
  );
  console.log(`Tatoeba: ${sentences.length} Sätze mit deutscher Übersetzung`);
} else {
  console.log('Tatoeba-Dateien fehlen – Beispielsätze übersprungen.');
}

// ---------------------------------------------------------------- Wadoku

const wdFile = findFile(join(RAW, 'wadoku'), (n) => n === 'wadokudict2' || n === 'wadokudict');
if (!wdFile) throw new Error('Wadoku-Datei fehlt – erst „npm run data:fetch“ ausführen.');
const lines = readFileSync(wdFile, 'utf8').split('\n');

/**
 * Eintrag im App-Format (kompakt als Liste):
 * [kanjiFormen (mit ; getrennt, oder ""), kana, Bedeutungen (mit / getrennt), Wortart oder "", Merkmale, Quelle "w"/"j", Häufigkeit in Tatoeba]
 * Merkmale (Bits): 1 = häufig (JMdict common), 2 = wird meist in Kana geschrieben
 */
const entries = [];
const usedCommon = new Set();
let skipped = 0;
let names = 0;

const romajiPlain = (s) => toRomaji(s).toLowerCase().replace(/[^a-z]/g, '');
const stripMacrons = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');


for (const line of lines) {
  const m = line.match(/^(.+?) \[(.+?)\] \/(.*)\/\s*$/);
  if (!m) continue;
  const forms = m[1].split(';').map(clean).filter(Boolean);
  const reading = clean(m[2]);
  if (forms.length === 0 || !reading) continue;
  // Sätze, Redewendungen mit Satzzeichen und sehr lange Einträge weglassen
  if (/[。、！？!?\s]/.test(m[1]) || forms[0].length > 12 || reading.length > 16) {
    skipped++;
    continue;
  }
  let glosses = [...new Set(m[3].split('/').map(cleanGloss).filter(Boolean))].slice(0, 5);
  if (glosses.length === 0) continue;
  // Namenseinträge („橋 [はし] /Hashi/“): Bedeutung ist nur die Umschrift der Lesung
  if (glosses.length === 1 && stripMacrons(glosses[0]) === romajiPlain(reading)) {
    names++;
    continue;
  }

  // Kana-Schreibweise: Ist die erste reine Kana-Form Katakana (コーヒー), diese nehmen, sonst die Lesung.
  const firstKana = forms.find((f) => isKana(f));
  const kana = firstKana && /^[ァ-ヺー・]+$/.test(firstKana) ? firstKana : reading;
  const kanjiForms = [...new Set(forms.filter((f) => hasKanji(f)))].slice(0, 3);

  // Häufig? (über JMdict common)
  let info;
  for (const kf of kanjiForms) {
    info = common.get(`${kf}|${kana}`) ?? common.get(`${kf}|${reading}`);
    if (info) break;
  }
  if (!info && (kanjiForms.length === 0 || firstKana)) info = common.get(`|${kana}`) ?? common.get(`|${reading}`);
  if (info) usedCommon.add(info.id);
  // Katakana-Wörter mit Ateji (珈琲) und „uk“-Wörter werden meist in Kana geschrieben
  const usuallyKana = info?.uk || kana !== reading;
  const flags = (info ? 1 : 0) | (usuallyKana ? 2 : 0);

  const f = Math.max(0, ...kanjiForms.map((k) => freq.get(k) ?? 0), usuallyKana || kanjiForms.length === 0 ? freq.get(kana) ?? 0 : 0);
  entries.push([kanjiForms.join(';'), kana, glosses.join('/'), info?.pos ?? '', flags, 'w', f]);
}

// Häufige JMdict-Wörter, die Wadoku nicht hat → mit englischer Bedeutung ergänzen
let englishOnly = 0;
for (const w of jm.words) {
  if (usedCommon.has(w.id)) continue;
  const info = common.get(w.kanji.length ? `${w.kanji[0].text}|${w.kana[0].text}` : `|${w.kana[0].text}`);
  if (!info || info.en.length === 0) continue;
  entries.push([
    w.kanji.map((k) => k.text).slice(0, 3).join(';'),
    w.kana[0].text,
    `(engl.) ${info.en.join('/')}`,
    info.pos ?? '',
    1 | (info.uk ? 2 : 0),
    'j',
    Math.max(0, ...w.kanji.map((k) => freq.get(k.text) ?? 0), freq.get(w.kana[0].text) ?? 0),
  ]);
  englishOnly++;
}

const core = entries.filter((e) => e[4] & 1);
const rest = entries.filter((e) => !(e[4] & 1));
const meta = {
  built: BUILT,
  wadoku: wdFile.match(/\d{8}/)?.[0] ?? '',
  jmdict: jm.dictDate,
};
writeFileSync(join(OUT, 'dict-core.json'), JSON.stringify({ meta, entries: core }));
writeFileSync(join(OUT, 'dict-full.json'), JSON.stringify({ meta, entries: rest }));
// Kleine Versionsdatei: Die App prüft damit, ob es neuere Daten gibt
writeFileSync(
  join(OUT, 'meta.json'),
  JSON.stringify({ ...meta, core: core.length, full: rest.length, coreBytes: Buffer.byteLength(JSON.stringify(core)), fullBytes: Buffer.byteLength(JSON.stringify(rest)) }),
);
console.log(
  `Wörterbuch: ${core.length} häufige + ${rest.length} weitere Einträge (${englishOnly} nur Englisch, ${skipped} Sätze/lange Einträge und ${names} Namen ausgelassen)`,
);

// ---------------------------------------------------------------- kuromoji-Wörterbuch für den Browser

const kDir = 'public/kuromoji';
mkdirSync(kDir, { recursive: true });
for (const f of readdirSync('node_modules/@patdx/kuromoji/dict')) {
  // Endung .bin: so packt kein Server die Datei automatisch aus – die App entpackt selbst
  copyFileSync(join('node_modules/@patdx/kuromoji/dict', f), join(kDir, `${f}.bin`));
}
console.log('kuromoji-Wörterbuch nach public/kuromoji/ kopiert');
