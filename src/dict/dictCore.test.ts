import { describe, expect, it } from 'vitest';
import { enrichDraft, entryToDraft, kataToHira, normalizeQuery, rankEntries, rawToEntry, type RawEntry } from './dictCore';

const raw: RawEntry[] = [
  ['橋', 'はし', 'Brücke/Verbindung', 'Nomen', 1, 'w', 222],
  ['箸', 'はし', 'Essstäbchen', 'Nomen', 1, 'w', 36],
  ['端', 'はし', 'Kante/Rand/Ende', 'Nomen', 1, 'w', 25],
  ['食べる', 'たべる', 'essen/speisen', 'ru-Verb', 1, 'w', 900],
  ['珈琲', 'コーヒー', 'Kaffee', 'Nomen', 3, 'w', 400],
  ['お早う;御早う', 'おはよう', 'guten Morgen!', 'Ausdruck', 3, 'w', 48],
  ['幾', 'いく', '(engl.) some, several', '', 1, 'j', 3],
  ['行く', 'いく', 'gehen/fahren', 'u-Verb', 1, 'w', 2000],
  ['先制', 'せんせい', 'guter Start', 'Nomen', 1, 'w', 2],
  ['先生', 'せんせい', 'Lehrer/Lehrerin', 'Nomen', 1, 'w', 1389],
];
const entries = raw.map((r) => rawToEntry(r, 'core'));
const find = (kana: string) => entries.filter((e) => e.kana === kana);

describe('Hilfsfunktionen', () => {
  it('kataToHira behält den Langvokal-Strich', () => {
    expect(kataToHira('コーヒー')).toBe('こーひー');
  });
  it('normalizeQuery: Romaji und Katakana → Hiragana', () => {
    expect(normalizeQuery('taberu')).toBe('たべる');
    expect(normalizeQuery('コーヒー')).toBe('こーひー');
    expect(normalizeQuery('  ')).toBe('');
  });
  it('rawToEntry: Suchformen enthalten Kanji, Kana und Hiragana', () => {
    expect(entries[4].forms).toEqual(['珈琲', 'コーヒー', 'こーひー']);
    expect(entries[5].kanji).toEqual(['お早う', '御早う']);
  });
});

describe('rankEntries', () => {
  it('häufige Wörter zuerst (先生 vor 先制, 行く vor 幾)', () => {
    expect(rankEntries(find('せんせい'), 'せんせい')[0].kanji[0]).toBe('先生');
    expect(rankEntries(find('いく'), 'iku')[0].kanji[0]).toBe('行く');
  });
  it('genaue Treffer vor Präfix-Treffern', () => {
    const r = rankEntries([entries[3], entries[0]], 'はし');
    expect(r[0].kana).toBe('はし');
  });
});

describe('entryToDraft', () => {
  it('übernimmt Kanji, Bedeutungen, Wortart', () => {
    expect(entryToDraft(entries[3])).toEqual({ kana: 'たべる', kanji: '食べる', meaning_de: ['essen', 'speisen'], part_of_speech: 'ru-Verb' });
  });
  it('Wörter, die meist in Kana stehen, ohne Kanji (コーヒー, おはよう)', () => {
    expect(entryToDraft(entries[4]).kanji).toBeUndefined();
    expect(entryToDraft(entries[5]).kanji).toBeUndefined();
  });
  it('englische Notlösung ohne Markierung im Entwurf', () => {
    expect(entryToDraft(entries[6]).meaning_de).toEqual(['some, several']);
  });
});

describe('enrichDraft (Import ergänzen)', () => {
  it('nur Kana, eindeutig → Kanji, Bedeutung und Wortart ergänzt', () => {
    const r = enrichDraft({ kana: 'たべる', meaning_de: [] }, find('たべる'));
    expect(r.note).toBe('ergänzt');
    expect(r.draft).toMatchObject({ kana: 'たべる', kanji: '食べる', meaning_de: ['essen', 'speisen'], part_of_speech: 'ru-Verb' });
  });
  it('Kana + Bedeutung wählt das passende Kanji (はし + Brücke → 橋)', () => {
    const r = enrichDraft({ kana: 'はし', meaning_de: ['Brücke'] }, find('はし'));
    expect(r.draft.kanji).toBe('橋');
    const r2 = enrichDraft({ kana: 'はし', meaning_de: ['Essstäbchen'] }, find('はし'));
    expect(r2.draft.kanji).toBe('箸');
  });
  it('mehrdeutig ohne Bedeutung → nichts raten', () => {
    const r = enrichDraft({ kana: 'はし', meaning_de: [] }, find('はし'));
    expect(r.note).toBe('mehrdeutig');
    expect(r.draft.kanji).toBeUndefined();
    expect(r.draft.meaning_de).toEqual([]);
  });
  it('nur Kanji → Lesung ergänzt', () => {
    const r = enrichDraft({ kanji: '先生', meaning_de: [] }, entries);
    expect(r.draft).toMatchObject({ kana: 'せんせい', meaning_de: ['Lehrer', 'Lehrerin'] });
  });
  it('vorhandene Angaben werden nie überschrieben', () => {
    const r = enrichDraft({ kana: 'たべる', kanji: '食べる', meaning_de: ['futtern'] }, find('たべる'));
    expect(r.draft.meaning_de).toEqual(['futtern']);
    expect(r.draft.part_of_speech).toBe('ru-Verb');
  });
  it('vollständige Einträge bleiben unverändert', () => {
    const d = { kana: 'たべる', kanji: '食べる', meaning_de: ['essen'], part_of_speech: 'ru-Verb' as const };
    expect(enrichDraft(d, find('たべる'))).toEqual({ draft: d, note: null });
  });
  it('kein Treffer → „nicht gefunden“', () => {
    expect(enrichDraft({ kana: 'ほげ', meaning_de: [] }, []).note).toBe('nicht gefunden');
  });
  it('Katakana-Wort ohne Kanji: kein Ateji-Kanji (珈琲)', () => {
    const r = enrichDraft({ kana: 'コーヒー', meaning_de: [] }, find('コーヒー'));
    expect(r.draft.kanji).toBeUndefined();
    expect(r.draft.meaning_de).toEqual(['Kaffee']);
  });
});
