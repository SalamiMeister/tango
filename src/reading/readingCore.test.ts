import { describe, expect, it } from 'vitest';
import {
  buildAiPrompt,
  buildKnownSet,
  furiganaSegments,
  isContentToken,
  knownRatio,
  splitAiText,
  toCompact,
  wordIdsInTokens,
  type KuromojiToken,
} from './readingCore';
import { newReview, rateReview } from '../lib/fsrs';
import type { Token, Word } from '../types';

function word(id: string, kana: string, kanji?: string, extra: Partial<Word> = {}): Word {
  return { id, kana, kanji, meaning_de: [id], tags: [], active: true, created_at: 0, updated_at: 0, deleted: false, ...extra };
}

// 私は毎朝コーヒーを飲みます。 – so zerlegt kuromoji (vereinfacht)
const kt = (surface_form: string, basic_form: string, reading: string, pos: string, pos_detail_1 = '一般'): KuromojiToken => ({
  surface_form,
  basic_form,
  reading,
  pos,
  pos_detail_1,
});
const sentence: KuromojiToken[] = [
  kt('私', '私', 'ワタシ', '名詞', '代名詞'),
  kt('は', 'は', 'ハ', '助詞', '係助詞'),
  kt('毎朝', '毎朝', 'マイアサ', '名詞', '副詞可能'),
  kt('コーヒー', 'コーヒー', 'コーヒー', '名詞'),
  kt('を', 'を', 'ヲ', '助詞', '格助詞'),
  kt('飲み', '飲む', 'ノミ', '動詞', '自立'),
  kt('ます', 'ます', 'マス', '助動詞', '*'),
  kt('。', '。', '。', '記号', '句点'),
];

describe('toCompact / isContentToken', () => {
  it('Partikeln, Hilfsverben und Satzzeichen sind keine Inhaltswörter', () => {
    const c = toCompact(sentence);
    expect(c.filter((t) => t[3] === 1).map((t) => t[1])).toEqual(['私', '毎朝', 'コーヒー', '飲む']);
  });
  it('Lesung nur bei Kanji, in Hiragana', () => {
    const c = toCompact(sentence);
    expect(c[0][2]).toBe('わたし');
    expect(c[3][2]).toBe(''); // コーヒー hat keine Kanji
    expect(c[5]).toEqual(['飲み', '飲む', 'のみ', 1]);
  });
  it('Namen, Zahlen und unselbständige Wörter zählen nicht', () => {
    expect(isContentToken(kt('田中', '田中', 'タナカ', '名詞', '固有名詞'))).toBe(false);
    expect(isContentToken(kt('三', '三', 'サン', '名詞', '数'))).toBe(false);
    expect(isContentToken(kt('いる', 'いる', 'イル', '動詞', '非自立'))).toBe(false);
  });
});

describe('Bekanntheitsquote', () => {
  const words = [word('w1', 'わたし', '私'), word('w2', 'コーヒー'), word('w3', 'のむ', '飲む'), word('w4', 'まいあさ', '毎朝')];
  const learned = (id: string) => rateReview(newReview(id, 'jp_de', 0), 3, 1000);
  const tokens = toCompact(sentence);

  it('zählt nur gelernte Vokabeln (Standard)', () => {
    const known = buildKnownSet(words, [learned('w1'), learned('w2'), learned('w3')]);
    expect(knownRatio(tokens, known)).toEqual({ known: 3, total: 4, ratio: 0.75 });
  });
  it('optional auch ungelernte Vokabeln', () => {
    const known = buildKnownSet(words, [], true);
    expect(knownRatio(tokens, known).ratio).toBe(1);
  });
  it('konjugierte Verben werden über die Grundform erkannt', () => {
    const known = buildKnownSet([word('w3', 'のむ', '飲む')], [], true);
    expect(knownRatio(tokens, known).known).toBe(1);
  });
  it('in Kana geschriebene Wörter werden erkannt, auch Katakana ↔ Hiragana', () => {
    const t: Token[] = [['たべる', 'たべる', '', 1], ['ケーキ', 'ケーキ', '', 1]];
    const known = buildKnownSet([word('a', 'たべる', '食べる'), word('b', 'ケーキ')], [], true);
    expect(knownRatio(t, known).ratio).toBe(1);
  });
  it('inaktive und gelöschte Vokabeln zählen nicht', () => {
    const known = buildKnownSet([word('w1', 'わたし', '私', { active: false }), word('w2', 'コーヒー', undefined, { deleted: true })], [], true);
    expect(knownRatio(tokens, known).known).toBe(0);
  });
  it('Satz ohne Inhaltswörter gilt als bekannt', () => {
    expect(knownRatio([['。', '。', '', 0]], new Set()).ratio).toBe(1);
  });
  it('findet eigene Vokabeln im Text', () => {
    expect(wordIdsInTokens(tokens, words).sort()).toEqual(['w1', 'w2', 'w3', 'w4']);
  });
});

describe('furiganaSegments', () => {
  it.each([
    ['食べ', 'たべ', [{ text: '食', rt: 'た' }, { text: 'べ' }]],
    ['お茶', 'おちゃ', [{ text: 'お' }, { text: '茶', rt: 'ちゃ' }]],
    ['学生', 'がくせい', [{ text: '学生', rt: 'がくせい' }]],
    ['飲み物', 'のみもの', [{ text: '飲み物', rt: 'のみもの' }]],
    ['ケーキ', '', [{ text: 'ケーキ' }]],
  ])('%s (%s)', (surface, reading, expected) => {
    expect(furiganaSegments(surface, reading)).toEqual(expected);
  });
});

describe('KI-Text und Prompt', () => {
  it('teilt Japanisch und Übersetzung an „---“', () => {
    expect(splitAiText('今日は雨です。\n---\nHeute regnet es.')).toEqual({ ja: '今日は雨です。', de: 'Heute regnet es.' });
    expect(splitAiText('今日は雨です。')).toEqual({ ja: '今日は雨です。', de: '' });
  });
  it('Prompt enthält aktive Vokabeln bis zur Lektion und die Formatregel', () => {
    const words = [
      word('a', 'たべる', '食べる', { lesson: 3, meaning_de: ['essen'] }),
      word('b', 'でんしゃ', '電車', { lesson: 10, meaning_de: ['Zug'] }),
      word('c', 'みる', '見る', { lesson: 3, active: false }),
    ];
    const { prompt, count } = buildAiPrompt(words, { lesson: 5, sentences: 6, onlyUpToLesson: true, topic: 'Frühstück' });
    expect(count).toBe(1);
    expect(prompt).toContain('食べる（たべる） = essen');
    expect(prompt).not.toContain('電車');
    expect(prompt).toContain('Lektion 5');
    expect(prompt).toContain('Thema: Frühstück');
    expect(prompt).toContain('---');
  });
});
