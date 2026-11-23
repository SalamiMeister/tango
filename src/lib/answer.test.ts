import { describe, expect, it } from 'vitest';
import { checkGerman, checkJapanese, editDistance, normalizeGerman } from './answer';
import { pickDistractors } from './choices';
import type { Word } from '../types';

describe('normalizeGerman', () => {
  it.each([
    ['Der Lehrer', 'lehrer'],
    ['  sich freuen ', 'freuen'],
    ['Universität', 'universitaet'],
    ['(mit dem Zug) fahren', 'fahren'],
    ['Straße!', 'strasse'],
    ['to eat', 'eat'],
  ])('%s → %s', (input, out) => {
    expect(normalizeGerman(input)).toBe(out);
  });
});

describe('checkGerman (JP→DE)', () => {
  const meanings = ['Lehrer', 'Lehrerin'];
  it('Groß-/Kleinschreibung und Artikel egal', () => {
    expect(checkGerman('der lehrer', meanings)).toBe('correct');
    expect(checkGerman('LEHRERIN', meanings)).toBe('correct');
  });
  it('eine von mehreren Bedeutungen genügt, auch mit Komma eingegeben', () => {
    expect(checkGerman('gehen', ['gehen', 'fahren'])).toBe('correct');
    expect(checkGerman('laufen, fahren', ['gehen', 'fahren'])).toBe('correct');
  });
  it('Klammern in der Bedeutung sind optional', () => {
    expect(checkGerman('fahren', ['(mit dem Zug) fahren'])).toBe('correct');
  });
  it('Umlaute dürfen umschrieben werden', () => {
    expect(checkGerman('Universitaet', ['Universität'])).toBe('correct');
  });
  it('ein Tippfehler bei längeren Wörtern → typo', () => {
    expect(checkGerman('Lehrr', meanings)).toBe('typo');
    expect(checkGerman('Bibliotehk', ['Bibliothek'])).toBe('typo'); // Buchstabendreher
    expect(checkGerman('Bibliotek', ['Bibliothek'])).toBe('typo');
    expect(checkGerman('Biblotek', ['Bibliothek'])).toBe('wrong'); // zwei Fehler
  });
  it('kurze Wörter müssen exakt stimmen', () => {
    expect(checkGerman('Bich', ['Buch'])).toBe('wrong');
  });
  it('leer oder falsch → wrong', () => {
    expect(checkGerman('', meanings)).toBe('wrong');
    expect(checkGerman('Schüler', meanings)).toBe('wrong');
  });
});

describe('checkJapanese (DE→JP)', () => {
  const taberu = { kana: 'たべる', kanji: '食べる' };
  it('Romaji, Kana und Kanji werden akzeptiert', () => {
    expect(checkJapanese('taberu', taberu)).toBe('correct');
    expect(checkJapanese('たべる', taberu)).toBe('correct');
    expect(checkJapanese('食べる', taberu)).toBe('correct');
    expect(checkJapanese(' TABERU ', taberu)).toBe('correct');
  });
  it('Katakana-Wörter auch mit Hiragana/Romaji', () => {
    const coffee = { kana: 'コーヒー' };
    expect(checkJapanese('ko-hi-', coffee)).toBe('correct');
    expect(checkJapanese('こーひー', coffee)).toBe('correct');
    expect(checkJapanese('コーヒー', coffee)).toBe('correct');
  });
  it('ん am Ende', () => {
    expect(checkJapanese('hon', { kana: 'ほん', kanji: '本' })).toBe('correct');
    expect(checkJapanese('shinbun', { kana: 'しんぶん' })).toBe('correct');
  });
  it('falsch', () => {
    expect(checkJapanese('nomu', taberu)).toBe('wrong');
    expect(checkJapanese('', taberu)).toBe('wrong');
  });
});

describe('editDistance', () => {
  it('zählt Änderungen', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('abc', 'abc')).toBe(0);
    expect(editDistance('abcd', 'abdc')).toBe(1);
  });
});

describe('pickDistractors', () => {
  const w = (id: string, extra: Partial<Word>): Word => ({
    id,
    kana: id,
    meaning_de: [id],
    tags: [],
    active: true,
    created_at: 0,
    updated_at: 0,
    deleted: false,
    ...extra,
  });
  const target = w('taberu', { lesson: 3, part_of_speech: 'ru-Verb', meaning_de: ['essen'] });
  const pool = [
    target,
    w('nomu', { lesson: 3, part_of_speech: 'u-Verb' }),
    w('miru', { lesson: 3, part_of_speech: 'ru-Verb' }),
    w('hon', { lesson: 4, part_of_speech: 'Nomen' }),
    w('neru', { lesson: 5, part_of_speech: 'ru-Verb' }),
    w('kuu', { lesson: 3, meaning_de: ['Essen'] }), // gleiche Bedeutung → ausgeschlossen
  ];
  it('bevorzugt gleiche Lektion und Wortart, schließt gleiche Bedeutung aus', () => {
    const picks = pickDistractors(target, pool, 3).map((x) => x.id);
    expect(picks).toHaveLength(3);
    expect(picks[0]).toBe('miru'); // Lektion + Wortart
    expect(picks[1]).toBe('nomu'); // Lektion
    expect(picks).not.toContain('kuu');
    expect(picks).not.toContain('taberu');
  });
  it('liefert weniger, wenn der Pool klein ist', () => {
    expect(pickDistractors(target, [target, pool[1]], 3)).toHaveLength(1);
  });
});
