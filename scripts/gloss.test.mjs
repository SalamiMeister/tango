import { describe, expect, it } from 'vitest';
import { cleanGloss } from './gloss.mjs';

describe('cleanGloss (Wadoku-Bedeutungen bereinigen)', () => {
  it.each([
    ['elektrischeBahn', 'elektrische Bahn'],
    ['elektrischerZug', 'elektrischer Zug'],
    ['PonsTeil des Hinterhirns', 'Pons'],
    ['guten Morgen!Gruß am Morgen; wörtl. es ist früh!', 'guten Morgen!'],
    ['guten Tag!im Unterhaltungs‑, Film‑ und Rundfunkgewerbe', 'guten Tag!'],
    ['schweiz.', ''],
    ['S-Bahn', 'S-Bahn'],
    ['danke!', 'danke!'],
    ['geschweige denn …', 'geschweige denn …'],
    ['Vom-Wind-Angeblasen-Werden', 'Vom-Wind-Angeblasen-Werden'],
  ])('%s → %s', (input, out) => {
    expect(cleanGloss(input)).toBe(out);
  });
  it('kürzt sehr lange Bedeutungen', () => {
    expect(cleanGloss('a'.repeat(100))).toHaveLength(69);
  });
});
