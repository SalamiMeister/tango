// Hintergrund-Wörterbuch: laden (auf Wunsch), suchen, nachschlagen.
// Die Daten liegen in IndexedDB (Tabelle „dict“) und werden nicht synchronisiert.

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { DictEntry } from '../types';
import { kataToHira, normalizeQuery, rankEntries, rawToEntry, type RawEntry } from './dictCore';

export interface DataMeta {
  built: string;
  wadoku: string;
  jmdict: string;
  core: number;
  full: number;
  coreBytes: number;
  fullBytes: number;
}

export interface DictInfo {
  /** Datum der installierten Daten (meta.built) oder undefined */
  core?: string;
  full?: string;
}

const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${file}`;

/** Welche Teile sind installiert? (live) */
export function useDictInfo(): DictInfo | undefined {
  return useLiveQuery(async () => {
    const rec = await db.meta.get('dict');
    return (rec?.value as DictInfo) ?? {};
  }, []);
}

export async function getDictInfo(): Promise<DictInfo> {
  return ((await db.meta.get('dict'))?.value as DictInfo) ?? {};
}

/** Versionsinfo vom Server (klein). */
export async function fetchDataMeta(): Promise<DataMeta | null> {
  try {
    const res = await fetch(dataUrl('meta.json'), { cache: 'no-store' });
    return res.ok ? ((await res.json()) as DataMeta) : null;
  } catch {
    return null;
  }
}

/**
 * Lädt einen Teil des Wörterbuchs in die Datenbank (ersetzt eine ältere Version).
 * onProgress bekommt einen Wert zwischen 0 und 1.
 */
export async function installDict(pack: 'core' | 'full', onProgress?: (p: number) => void): Promise<number> {
  const res = await fetch(dataUrl(`dict-${pack}.json`), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Wörterbuch konnte nicht geladen werden (Fehler ${res.status}).`);
  const data = (await res.json()) as { meta: { built: string }; entries: RawEntry[] };
  onProgress?.(0.05);
  await db.dict.where('pack').equals(pack).delete();
  const CHUNK = 5000;
  for (let i = 0; i < data.entries.length; i += CHUNK) {
    await db.dict.bulkAdd(data.entries.slice(i, i + CHUNK).map((r) => rawToEntry(r, pack)));
    onProgress?.(0.05 + (0.95 * Math.min(i + CHUNK, data.entries.length)) / data.entries.length);
  }
  const info = await getDictInfo();
  await db.meta.put({ key: 'dict', value: { ...info, [pack]: data.meta.built } });
  return data.entries.length;
}

export async function removeDict(pack: 'core' | 'full'): Promise<void> {
  await db.dict.where('pack').equals(pack).delete();
  const info = await getDictInfo();
  delete info[pack];
  await db.meta.put({ key: 'dict', value: info });
}

/**
 * Ist die installierte Version älter als die auf dem Server? Dann das häufige
 * Wörterbuch still im Hintergrund aktualisieren (klein, ca. 1 MB). Höchstens einmal pro Woche prüfen.
 */
export async function autoUpdateDict(): Promise<void> {
  const info = await getDictInfo();
  if (!info.core || !navigator.onLine) return;
  const last = (await db.meta.get('dictChecked'))?.value as number | undefined;
  if (last && Date.now() - last < 7 * 86400000) return;
  await db.meta.put({ key: 'dictChecked', value: Date.now() });
  const meta = await fetchDataMeta();
  if (meta && meta.built > info.core) await installDict('core');
}

/** Präfix-Suche (für Vorschläge beim Tippen). */
export async function searchDict(query: string, limit = 8): Promise<DictEntry[]> {
  const q = normalizeQuery(query);
  if (!q) return [];
  const raw = query.trim();
  const hits = await db.dict
    .where('forms')
    .startsWithAnyOf(raw === q ? [q] : [q, raw])
    .limit(300)
    .toArray();
  // gleiche Einträge (über mehrere Schreibweisen gefunden) nur einmal
  const unique = [...new Map(hits.map((e) => [e.id, e])).values()];
  return rankEntries(unique, query).slice(0, limit);
}

/** Genaue Suche nach einer Schreibweise (Kanji oder Kana). */
export async function lookupExact(...forms: string[]): Promise<DictEntry[]> {
  const keys = [...new Set(forms.filter(Boolean).flatMap((f) => [f, kataToHira(f)]))];
  if (keys.length === 0) return [];
  const hits = await db.dict.where('forms').anyOf(keys).toArray();
  const unique = [...new Map(hits.map((e) => [e.id, e])).values()];
  return rankEntries(unique, forms[0]);
}
