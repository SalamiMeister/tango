import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  analyzeTable,
  detectDelimiter,
  parsePartOfSpeech,
  parseTable,
  rowsToDrafts,
} from './tableImport';
import { planImport } from './duplicates';
import type { Word } from '../types';

describe('detectDelimiter', () => {
  it('erkennt Tabulator (Excel-Kopie)', () => {
    expect(detectDelimiter('たべる\t食べる\tessen\nのむ\t飲む\ttrinken')).toBe('\t');
  });
  it('erkennt Semikolon', () => {
    expect(detectDelimiter('たべる;食べる;essen, speisen\nのむ;飲む;trinken')).toBe(';');
  });
  it('erkennt Komma, auch wenn Semikolons in Zellen vorkommen', () => {
    expect(detectDelimiter('a,b,c\nd,"e;f",g')).toBe(',');
  });
});

describe('parseTable', () => {
  it('beachtet Anführungszeichen und leere Zeilen', () => {
    const rows = parseTable('kana;bedeutung\r\n\r\nたべる;"essen; speisen"\nいう;"sagen ""so"""\n', ';');
    expect(rows).toEqual([
      ['kana', 'bedeutung'],
      ['たべる', 'essen; speisen'],
      ['いう', 'sagen "so"'],
    ]);
  });
  it('entfernt das BOM am Anfang (Excel „CSV UTF-8“)', () => {
    expect(parseTable('﻿kana;kanji', ';')).toEqual([['kana', 'kanji']]);
  });
});

describe('analyzeTable – Spalten erraten', () => {
  it('ohne Überschrift: Kana, Kanji, Bedeutung', () => {
    const a = analyzeTable('たべる\t食べる\tessen\nのむ\t飲む\ttrinken\nほん\t本\tBuch');
    expect(a.hasHeader).toBe(false);
    expect(a.mapping).toEqual(['kana', 'kanji', 'meaning']);
  });
  it('ohne Überschrift: Kanji, Kana, Romaji, Bedeutung, Lektion', () => {
    const a = analyzeTable('食べる;たべる;taberu;essen;3\n飲む;のむ;nomu;trinken;3\n学生;がくせい;gakusei;Student;1');
    expect(a.mapping).toEqual(['kanji', 'kana', 'romaji', 'meaning', 'lesson']);
  });
  it('mit Überschrift', () => {
    const a = analyzeTable('Lektion;Bedeutung;Kana;Kanji\n1;Student;がくせい;学生');
    expect(a.hasHeader).toBe(true);
    expect(a.mapping).toEqual(['lesson', 'meaning', 'kana', 'kanji']);
  });
  it('nur Romaji + Deutsch', () => {
    const a = analyzeTable('taberu;essen\nnomu;trinken');
    expect(a.mapping).toEqual(['romaji', 'meaning']);
    const rows = rowsToDrafts(a.rows, a.mapping, a.hasHeader);
    expect(rows[0].draft?.kana).toBe('たべる');
  });
});

describe('rowsToDrafts', () => {
  it('teilt Bedeutungen, setzt Standardwerte und meldet Fehler', () => {
    const rows = [
      ['たべる', '食べる', 'essen, speisen', 'ru-verb'],
      ['', '', 'ohne Kana', ''],
      ['みる', '見る', '', ''],
      ['テレビ', '', 'Fernseher', 'n'],
    ];
    const res = rowsToDrafts(rows, ['kana', 'kanji', 'meaning', 'pos'], false, { source: 'Genki 1', lesson: 3, tags: ['neu'] });
    expect(res[0].draft).toMatchObject({
      kana: 'たべる',
      kanji: '食べる',
      meaning_de: ['essen', 'speisen'],
      part_of_speech: 'ru-Verb',
      source: 'Genki 1',
      lesson: 3,
      tags: ['neu'],
    });
    expect(res[1].error).toBe('Kana fehlt');
    expect(res[2].error).toBe('Bedeutung fehlt');
    expect(res[3].draft?.kanji).toBeUndefined();
    expect(res[3].draft?.part_of_speech).toBe('Nomen');
  });
  it('wandelt Romaji in der Kana-Spalte um', () => {
    const res = rowsToDrafts([['taberu', 'essen']], ['kana', 'meaning'], false);
    expect(res[0].draft?.kana).toBe('たべる');
  });
});

describe('parsePartOfSpeech', () => {
  it.each([
    ['u-verb', 'u-Verb'],
    ['Ru Verb', 'ru-Verb'],
    ['irreg. Verb', 'irreg. Verb'],
    ['i-adj', 'i-Adj.'],
    ['na-Adj.', 'na-Adj.'],
    ['Adv', 'Adverb'],
    ['xyz', undefined],
  ])('%s → %s', (input, expected) => {
    expect(parsePartOfSpeech(input)).toBe(expected);
  });
});

describe('Beispieldateien', () => {
  it('examples/beispiel-vokabeln.csv ergibt 10 gültige Vokabeln', () => {
    const text = readFileSync('examples/beispiel-vokabeln.csv', 'utf-8');
    const a = analyzeTable(text);
    const rows = rowsToDrafts(a.rows, a.mapping, a.hasHeader);
    expect(rows).toHaveLength(10);
    expect(rows.every((r) => r.draft)).toBe(true);
  });
  it('examples/test-20-woerter.txt (Einfügen ohne Überschrift) ergibt 20 Vokabeln', () => {
    const text = readFileSync('examples/test-20-woerter.txt', 'utf-8');
    const a = analyzeTable(text);
    expect(a.mapping).toEqual(['kana', 'kanji', 'meaning']);
    const rows = rowsToDrafts(a.rows, a.mapping, a.hasHeader);
    expect(rows.filter((r) => r.draft)).toHaveLength(20);
  });
});

describe('planImport – Duplikate', () => {
  const existing: Word = {
    id: 'w1',
    kana: 'たべる',
    kanji: '食べる',
    meaning_de: ['essen'],
    tags: [],
    active: true,
    created_at: 0,
    updated_at: 0,
    deleted: false,
  };
  const drafts = [
    { kana: 'たべる', kanji: '食べる', meaning_de: ['speisen'], tags: ['x'] },
    { kana: 'のむ', kanji: '飲む', meaning_de: ['trinken'], tags: [] },
    { kana: 'のむ', kanji: '飲む', meaning_de: ['saufen'], tags: [] },
  ];

  it('überspringen', () => {
    const p = planImport(drafts, [existing], 'skip', 1);
    expect(p.create).toHaveLength(1);
    expect(p.skipped).toBe(2);
    expect(p.update).toHaveLength(0);
  });
  it('zusammenführen (auch innerhalb des Imports)', () => {
    const p = planImport(drafts, [existing], 'merge', 1);
    expect(p.update).toHaveLength(1);
    expect(p.update[0].meaning_de).toEqual(['essen', 'speisen']);
    expect(p.create).toHaveLength(1);
    expect(p.create[0].meaning_de).toEqual(['trinken', 'saufen']);
  });
  it('trotzdem anlegen', () => {
    const p = planImport(drafts, [existing], 'create', 1);
    expect(p.create).toHaveLength(3);
  });
  it('gelöschte Wörter zählen nicht als Duplikat', () => {
    const p = planImport(drafts.slice(0, 1), [{ ...existing, deleted: true }], 'skip', 1);
    expect(p.create).toHaveLength(1);
  });
});
