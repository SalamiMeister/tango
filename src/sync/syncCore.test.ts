import { describe, expect, it } from 'vitest';
import { isSnapshot, planSync, type Snapshot } from './syncCore';
import type { Word } from '../types';

function word(id: string, updated_at: number, extra: Partial<Word> = {}): Word {
  return { id, kana: id, meaning_de: [id], tags: [], active: true, created_at: 0, updated_at, deleted: false, ...extra };
}
function snap(words: Word[]): Snapshot {
  return { app: 'tango', format: 1, exported_at: '', words, reviews: [], passages: [], settings: [] };
}

describe('planSync', () => {
  it('erste Synchronisation: Cloud leer → alles hochladen', () => {
    const p = planSync(snap([word('a', 1)]), null);
    expect(p.needsUpload).toBe(true);
    expect(p.toLocal.words).toEqual([]);
  });

  it('Desktop-Vokabel erscheint auf dem Handy (Cloud neuer → lokal übernehmen)', () => {
    const handy = snap([word('a', 1)]);
    const cloud = snap([word('a', 1), word('b', 5)]);
    const p = planSync(handy, cloud);
    expect(p.toLocal.words.map((w) => w.id)).toEqual(['b']);
    expect(p.needsUpload).toBe(false);
  });

  it('pro Datensatz gewinnt der neueste Stand – in beide Richtungen', () => {
    const local = snap([word('a', 10, { meaning_de: ['lokal'] }), word('b', 1)]);
    const cloud = snap([word('a', 5), word('b', 7, { meaning_de: ['cloud'] })]);
    const p = planSync(local, cloud);
    expect(p.toLocal.words.map((w) => w.id)).toEqual(['b']);
    expect(p.needsUpload).toBe(true); // a ist lokal neuer
  });

  it('Löschungen werden übertragen und kommen nicht zurück', () => {
    const local = snap([word('a', 1)]);
    const cloud = snap([word('a', 9, { deleted: true })]);
    const p = planSync(local, cloud);
    expect(p.toLocal.words[0].deleted).toBe(true);
    expect(p.needsUpload).toBe(false);
  });

  it('nichts geändert → kein Upload', () => {
    const s = snap([word('a', 3)]);
    expect(planSync(s, snap([word('a', 3)]))).toEqual({
      toLocal: { words: [], reviews: [], passages: [], settings: [] },
      needsUpload: false,
    });
  });
});

describe('isSnapshot', () => {
  it('erkennt Tango-Dateien', () => {
    expect(isSnapshot(snap([]))).toBe(true);
    expect(isSnapshot({ foo: 1 })).toBe(false);
    expect(isSnapshot(null)).toBe(false);
  });
});
