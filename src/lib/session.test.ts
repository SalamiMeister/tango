import { describe, expect, it } from 'vitest';
import { buildSessionQueue, canLearnExtraNew, countNewToday, queueParts, streakDays } from './session';
import { newReview, rateReview } from './fsrs';
import { recordsToApply } from './merge';
import { DEFAULT_SETTINGS, type Review, type Word } from '../types';

const NOW = new Date('2026-04-10T12:00:00').getTime();
const DAY = 86_400_000;

function word(id: string, extra: Partial<Word> = {}): Word {
  return {
    id,
    kana: id,
    meaning_de: [id],
    tags: [],
    active: true,
    created_at: Number(id.replace(/\D/g, '')) || 0,
    updated_at: 0,
    deleted: false,
    ...extra,
  };
}
function both(w: Word): Review[] {
  return [newReview(w.id, 'jp_de', 0), newReview(w.id, 'de_jp', 0)];
}

describe('queueParts', () => {
  it('beide Richtungen: DE→JP erst, nachdem JP→DE gelernt wurde', () => {
    const words = [word('w1'), word('w2')];
    const reviews = words.flatMap(both);
    const { fresh } = queueParts(words, reviews, DEFAULT_SETTINGS, { direction: 'both' }, NOW);
    expect(fresh.map((r) => r.id)).toEqual(['w1:jp_de', 'w2:jp_de']);
  });

  it('Tageslimit für neue Karten', () => {
    const words = Array.from({ length: 30 }, (_, i) => word(`w${i + 1}`));
    const reviews = words.flatMap(both);
    const settings = { ...DEFAULT_SETTINGS, newPerDay: 5 };
    expect(queueParts(words, reviews, settings, { direction: 'jp_de' }, NOW).fresh).toHaveLength(5);
    // 3 heute schon gelernt → noch 2 übrig
    const learned = reviews.map((r, i) => (i < 6 && r.direction === 'jp_de' ? rateReview(r, 3, NOW - 1000) : r));
    expect(countNewToday(learned, NOW)).toBe(3);
    expect(queueParts(words, learned, settings, { direction: 'jp_de' }, NOW).fresh).toHaveLength(2);
  });

  it('Zusatz-Neue über das Tageslimit hinaus', () => {
    const words = Array.from({ length: 30 }, (_, i) => word(`w${i + 1}`));
    const settings = { ...DEFAULT_SETTINGS, newPerDay: 5 };
    // Heute schon 5 neue gelernt → Limit erreicht
    const reviews = words
      .flatMap(both)
      .filter((r) => r.direction === 'jp_de')
      .map((r, i) => (i < 5 ? rateReview(r, 3, NOW - 1000) : r));
    const normal = queueParts(words, reviews, settings, { direction: 'jp_de' }, NOW);
    expect(normal.fresh).toHaveLength(0);
    expect(normal.heldBack).toBe(25);
    expect(canLearnExtraNew(normal)).toBe(true);

    const extra = queueParts(words, reviews, settings, { direction: 'jp_de', extraNew: 10 }, NOW);
    expect(extra.fresh.map((r) => r.word_id)).toEqual(words.slice(5, 15).map((w) => w.id));
    expect(extra.heldBack).toBe(15);
  });

  it('kein „weitere neue“, solange das Limit nicht erreicht ist oder nichts Neues da ist', () => {
    const words = Array.from({ length: 3 }, (_, i) => word(`w${i + 1}`));
    const reviews = words.flatMap(both);
    const settings = { ...DEFAULT_SETTINGS, newPerDay: 5 };
    const p = queueParts(words, reviews, settings, { direction: 'jp_de' }, NOW);
    expect(p.heldBack).toBe(0);
    expect(canLearnExtraNew(p)).toBe(false);
    const onlyDue = queueParts(words, reviews, settings, { direction: 'jp_de', onlyDue: true, extraNew: 10 }, NOW);
    expect(onlyDue.fresh).toHaveLength(0);
    expect(canLearnExtraNew(onlyDue)).toBe(false);
  });

  it('inaktive, gelöschte und gefilterte Wörter werden ausgelassen', () => {
    const words = [word('w1'), word('w2', { active: false }), word('w3', { deleted: true }), word('w4', { lesson: 2 })];
    const reviews = words.flatMap(both);
    const all = queueParts(words, reviews, DEFAULT_SETTINGS, { direction: 'jp_de' }, NOW).fresh;
    expect(all.map((r) => r.word_id)).toEqual(['w1', 'w4']);
    const l2 = queueParts(words, reviews, DEFAULT_SETTINGS, { direction: 'jp_de', lesson: 2 }, NOW).fresh;
    expect(l2.map((r) => r.word_id)).toEqual(['w4']);
  });

  it('fällige Karten: überfälligste zuerst, zukünftige nicht', () => {
    const words = [word('w1'), word('w2'), word('w3')];
    const r1 = { ...rateReview(newReview('w1', 'jp_de', 0), 4, NOW - 10 * DAY), due: NOW - 2 * DAY };
    const r2 = { ...rateReview(newReview('w2', 'jp_de', 0), 4, NOW - 10 * DAY), due: NOW - 5 * DAY };
    const r3 = { ...rateReview(newReview('w3', 'jp_de', 0), 4, NOW - 10 * DAY), due: NOW + DAY };
    const { due } = queueParts(words, [r1, r2, r3], DEFAULT_SETTINGS, { direction: 'jp_de' }, NOW);
    expect(due.map((r) => r.word_id)).toEqual(['w2', 'w1']);
  });
});

describe('Filter Wortart und Problemwörter', () => {
  it('Wortart-Filter', () => {
    const words = [word('w1', { part_of_speech: 'Nomen' }), word('w2', { part_of_speech: 'u-Verb' })];
    const res = queueParts(words, words.flatMap(both), DEFAULT_SETTINGS, { direction: 'jp_de', pos: 'u-Verb' }, NOW);
    expect(res.fresh.map((r) => r.word_id)).toEqual(['w2']);
  });
  it('Problemwörter kommen auch, wenn sie nicht fällig sind', () => {
    const words = [word('w1'), word('w2')];
    // w1: gelernt und zweimal vergessen, nächste Fälligkeit in der Zukunft
    let r1 = rateReview(newReview('w1', 'jp_de', 0), 4, NOW - 20 * DAY);
    r1 = rateReview(r1, 1, r1.due);
    r1 = rateReview(r1, 3, r1.due);
    r1 = rateReview(r1, 1, r1.due);
    r1 = { ...rateReview(r1, 3, r1.due), due: NOW + 5 * DAY };
    const r2 = { ...rateReview(newReview('w2', 'jp_de', 0), 4, NOW - 10 * DAY), due: NOW + DAY };
    const res = queueParts(words, [r1, r2], DEFAULT_SETTINGS, { direction: 'jp_de', onlyProblem: true }, NOW);
    expect(res.due.map((r) => r.word_id)).toEqual(['w1']);
    expect(res.fresh).toEqual([]);
  });
});

describe('buildSessionQueue', () => {
  const mk = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => newReview(`${prefix}${i}`, 'jp_de', 0));
  it('begrenzt auf die Einheitsgröße und mischt Neues ein', () => {
    const q = buildSessionQueue({ due: mk(15, 'd'), fresh: mk(10, 'n') }, 20);
    expect(q).toHaveLength(20);
    expect(q.filter((r) => r.word_id.startsWith('n'))).toHaveLength(5);
    expect(q[0].word_id.startsWith('d')).toBe(true);
  });
  it('fällige haben Vorrang vor neuen', () => {
    const q = buildSessionQueue({ due: mk(25, 'd'), fresh: mk(10, 'n') }, 20);
    expect(q.every((r) => r.word_id.startsWith('d'))).toBe(true);
  });
});

describe('streakDays', () => {
  it('zählt Tage in Folge (heute noch nicht gelernt zählt bis gestern)', () => {
    const r = newReview('w1', 'jp_de', 0);
    r.history = [NOW - 3 * DAY, NOW - 2 * DAY, NOW - DAY].map((t) => ({ t, r: 3, s: 0 }));
    expect(streakDays([r], NOW)).toBe(3);
    r.history.push({ t: NOW, r: 3, s: 2 });
    expect(streakDays([r], NOW)).toBe(4);
    expect(streakDays([r], NOW + 3 * DAY)).toBe(0);
  });
});

describe('recordsToApply (Backup/Sync)', () => {
  it('neuere und fehlende Datensätze gewinnen', () => {
    const local = [
      { id: 'a', updated_at: 5, v: 'lokal' },
      { id: 'b', updated_at: 5, v: 'lokal' },
    ];
    const incoming = [
      { id: 'a', updated_at: 9, v: 'neu' },
      { id: 'b', updated_at: 1, v: 'alt' },
      { id: 'c', updated_at: 1, v: 'neu' },
    ];
    expect(recordsToApply(local, incoming, (r) => r.id).map((r) => r.id)).toEqual(['a', 'c']);
  });
});
