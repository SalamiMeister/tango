// Lädt die aktuellen Rohdaten nach data-raw/ und entpackt sie. Aufruf: npm run data:fetch
// Läuft auch automatisch beim Veröffentlichen (GitHub Actions, monatlich aktualisiert –
// die JMdict-Lizenz verlangt regelmäßige Aktualisierung).
//
// Benötigt die Programme tar und bzip2 (unter Windows: in „Git Bash“ ausführen).

import { mkdirSync, writeFileSync, existsSync, statSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAW = 'data-raw';
const UA = { 'User-Agent': 'tango-vokabeltrainer-build' };
const MAX_AGE_DAYS = 25; // vorhandene Dateien, die jünger sind, werden nicht erneut geladen

async function download(url, file) {
  if (existsSync(file) && (Date.now() - statSync(file).mtimeMs) / 86400000 < MAX_AGE_DAYS) {
    console.log(`✓ vorhanden: ${file}`);
    return false;
  }
  console.log(`↓ ${url}`);
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`Download fehlgeschlagen (${res.status}): ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return true;
}

function run(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, stdio: 'inherit' });
}

// ---------------------------------------------------------------- Wadoku (aktuellste EDICT2-Datei suchen)
{
  const dir = join(RAW, 'wadoku');
  mkdirSync(dir, { recursive: true });
  const page = await (await fetch('https://www.wadoku.de/wiki/display/WAD/Downloads+und+Links', { headers: UA })).text();
  const names = [...page.matchAll(/wadokudict2_(\d{8})\.tar\.xz/g)].map((m) => m[0]).sort();
  const name = names.at(-1);
  if (!name) throw new Error('Wadoku-Datei auf der Download-Seite nicht gefunden.');
  if (await download(`https://www.wadoku.de/downloads/edict-export/${name}`, join(dir, 'wadokudict2.tar.xz'))) {
    for (const f of readdirSync(dir)) if (f !== 'wadokudict2.tar.xz') rmSync(join(dir, f), { recursive: true });
    run('tar', ['-xJf', 'wadokudict2.tar.xz'], dir);
  }
}

// ---------------------------------------------------------------- JMdict common (neueste Version von jmdict-simplified)
{
  const dir = join(RAW, 'jmdict');
  mkdirSync(dir, { recursive: true });
  const rel = await (await fetch('https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest', { headers: UA })).json();
  const asset = rel.assets?.find((a) => /^jmdict-eng-common-.*\.json\.tgz$/.test(a.name));
  if (!asset) throw new Error('JMdict-common-Datei im neuesten Release nicht gefunden.');
  if (await download(asset.browser_download_url, join(dir, 'jmdict-eng-common.json.tgz'))) {
    for (const f of readdirSync(dir)) if (f.endsWith('.json')) rmSync(join(dir, f));
    run('tar', ['-xzf', 'jmdict-eng-common.json.tgz'], dir);
  }
}

// ---------------------------------------------------------------- Tatoeba (Japanisch, Deutsch, Verknüpfungen)
{
  const dir = join(RAW, 'tatoeba');
  mkdirSync(dir, { recursive: true });
  const files = {
    'jpn_sentences_detailed.tsv.bz2': 'https://downloads.tatoeba.org/exports/per_language/jpn/jpn_sentences_detailed.tsv.bz2',
    'deu_sentences_detailed.tsv.bz2': 'https://downloads.tatoeba.org/exports/per_language/deu/deu_sentences_detailed.tsv.bz2',
    'jpn-deu_links.tsv.bz2': 'https://downloads.tatoeba.org/exports/per_language/jpn/jpn-deu_links.tsv.bz2',
  };
  for (const [name, url] of Object.entries(files)) {
    if (await download(url, join(dir, name)) || !existsSync(join(dir, name.replace('.bz2', '')))) {
      run('bzip2', ['-dkf', name], dir);
    }
  }
}

console.log('Rohdaten bereit. Weiter mit: npm run data');
