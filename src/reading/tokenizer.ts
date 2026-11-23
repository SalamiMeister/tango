// Textanalyse im Browser mit kuromoji (zerlegt japanische Texte in Wörter).
// Das Analyse-Wörterbuch (ca. 17 MB) wird erst beim ersten Gebrauch geladen und
// danach vom Service Worker für den Offline-Betrieb gespeichert.

import * as kuromoji from '@patdx/kuromoji';
import type { Token } from '../types';
import { toCompact, type KuromojiToken } from './readingCore';

type Tokenizer = { tokenize(text: string): KuromojiToken[] };

let tokenizerPromise: Promise<Tokenizer> | null = null;

/** Lädt eine Wörterbuch-Datei und entpackt sie, falls der Server sie gepackt geliefert hat. */
async function loadFile(name: string): Promise<ArrayBufferLike> {
  const res = await fetch(`${import.meta.env.BASE_URL}kuromoji/${name}.bin`);
  if (!res.ok) throw new Error(`Textanalyse: ${name} nicht ladbar (Fehler ${res.status})`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // gzip beginnt mit 1F 8B – dann selbst entpacken
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer();
  }
  return buf;
}

export function getTokenizer(): Promise<Tokenizer> {
  if (!tokenizerPromise) {
    tokenizerPromise = new kuromoji.TokenizerBuilder({ loader: { loadArrayBuffer: loadFile } })
      .build()
      .then((t) => t as unknown as Tokenizer)
      .catch((e) => {
        tokenizerPromise = null; // beim nächsten Versuch neu laden
        throw e;
      });
  }
  return tokenizerPromise;
}

/** Ist die Textanalyse schon geladen/gespeichert? (für Hinweise in der Oberfläche) */
export async function isTokenizerCached(): Promise<boolean> {
  if (tokenizerPromise) return true;
  try {
    return (await caches.keys()).includes('kuromoji');
  } catch {
    return false;
  }
}

/** Text → Wörter (kompaktes Format). Zeilenumbrüche bleiben als eigene Tokens erhalten. */
export async function tokenizeText(text: string): Promise<Token[]> {
  const t = await getTokenizer();
  const out: Token[] = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (line) out.push(...toCompact(t.tokenize(line)));
    if (i < lines.length - 1) out.push(['\n', '\n', '', 0]);
  });
  return out;
}
