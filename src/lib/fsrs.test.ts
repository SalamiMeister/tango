import { describe, expect, it } from 'vitest';
import { formatInterval, newReview, previewIntervals, rateReview, STATE } from './fsrs';

const T0 = new Date('2026-04-01T10:00:00Z').getTime();
const MIN = 60_000;
const DAY = 86_400_000;

describe('FSRS-Anbindung', () => {
  it('neue Karte ist sofort fällig und im Zustand „neu“', () => {
    const r = newReview('w1', 'jp_de', T0);
    expect(r.id).toBe('w1:jp_de');
    expect(r.state).toBe(STATE.New);
    expect(r.due).toBe(T0);
    expect(r.history).toEqual([]);
  });

  it('„Nochmal“ bei neuer Karte → wenige Minuten, Zustand „lernt“', () => {
    const r = rateReview(newReview('w1', 'jp_de', T0), 1, T0);
    expect(r.state).toBe(STATE.Learning);
    expect(r.due - T0).toBeLessThanOrEqual(10 * MIN);
    expect(r.history).toEqual([{ t: T0, r: 1, s: STATE.New }]);
    expect(r.updated_at).toBe(T0);
  });

  it('„Leicht“ bei neuer Karte → mindestens ein Tag, Zustand „Wiederholung“', () => {
    const r = rateReview(newReview('w1', 'jp_de', T0), 4, T0);
    expect(r.state).toBe(STATE.Review);
    expect(r.due - T0).toBeGreaterThanOrEqual(DAY);
  });

  it('Intervalle wachsen bei wiederholtem „Gut“', () => {
    let r = newReview('w1', 'de_jp', T0);
    let now = T0;
    const intervals: number[] = [];
    for (let i = 0; i < 6; i++) {
      r = rateReview(r, 3, now);
      intervals.push(r.due - now);
      now = r.due;
    }
    expect(r.state).toBe(STATE.Review);
    // ab der Wiederholungsphase muss jedes Intervall länger sein als das vorige
    const reviewIntervals = intervals.filter((iv) => iv >= DAY);
    for (let i = 1; i < reviewIntervals.length; i++) {
      expect(reviewIntervals[i]).toBeGreaterThan(reviewIntervals[i - 1]);
    }
    expect(r.history).toHaveLength(6);
  });

  it('Vergessen („Nochmal“ in der Wiederholung) zählt als Lapse', () => {
    let r = rateReview(newReview('w1', 'jp_de', T0), 4, T0);
    r = rateReview(r, 1, r.due);
    expect(r.lapses).toBe(1);
    expect(r.state).toBe(STATE.Relearning);
  });

  it('Original wird nicht verändert', () => {
    const r = newReview('w1', 'jp_de', T0);
    const copy = structuredClone(r);
    rateReview(r, 3, T0);
    expect(r).toEqual(copy);
  });

  it('Vorschau: Nochmal < Schwer < Gut < Leicht', () => {
    const p = previewIntervals(newReview('w1', 'jp_de', T0), T0);
    expect(p[1]).toBeLessThan(p[2]);
    expect(p[2]).toBeLessThan(p[3]);
    expect(p[3]).toBeLessThan(p[4]);
  });

  it('bricht nicht ab, wenn die Uhr vor der letzten Bewertung liegt', () => {
    const r = rateReview(newReview('w1', 'jp_de', T0), 3, T0);
    expect(() => rateReview(r, 3, T0 - 60 * MIN)).not.toThrow();
  });

  it('Datensatz übersteht JSON-Export/-Import', () => {
    const r = rateReview(newReview('w1', 'jp_de', T0), 3, T0);
    const back = JSON.parse(JSON.stringify(r));
    expect(rateReview(back, 3, r.due)).toEqual(rateReview(r, 3, r.due));
  });
});

describe('formatInterval', () => {
  it.each([
    [30_000, '< 1 Min'],
    [10 * MIN, '10 Min'],
    [3 * 60 * MIN, '3 Std'],
    [4 * DAY, '4 T'],
    [90 * DAY, '3 Mon'],
    [400 * DAY, '1,1 J'],
  ])('%d ms → %s', (ms, text) => {
    expect(formatInterval(ms)).toBe(text);
  });
});
