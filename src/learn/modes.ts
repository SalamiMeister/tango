// Die Lernmodi und wie sie aus der Adresse gelesen werden.

import type { DirectionSetting, PartOfSpeech, Settings } from '../types';
import type { SessionFilter } from '../lib/session';
import type { Route } from '../router';

export type Mode = 'karten' | 'auswahl' | 'tippen' | 'hoeren' | 'zuordnen';

export const MODES: { id: Mode; label: string; short: string; fsrs: boolean }[] = [
  { id: 'karten', label: 'Karteikarten', short: 'Karten', fsrs: true },
  { id: 'auswahl', label: 'Multiple Choice', short: 'Auswahl', fsrs: true },
  { id: 'tippen', label: 'Eintippen', short: 'Tippen', fsrs: true },
  { id: 'hoeren', label: 'Hören', short: 'Hören', fsrs: true },
  { id: 'zuordnen', label: 'Zuordnen (ohne Wertung)', short: 'Zuordnen', fsrs: false },
];

export function modeFromRoute(route: Route): Mode {
  const m = route.query.get('modus');
  return MODES.some((x) => x.id === m) ? (m as Mode) : 'karten';
}

/** Filter aus der Adresse, z. B. #/lernen?modus=tippen&lektion=3&wortart=Nomen */
export function filterFromRoute(route: Route, settings: Settings, mode: Mode): SessionFilter {
  const q = route.query;
  const lesson = q.get('lektion');
  const dir = q.get('richtung') as DirectionSetting | null;
  return {
    // Hören fragt immer Japanisch → Deutsch ab
    direction: mode === 'hoeren' ? 'jp_de' : (dir ?? settings.direction),
    lesson: lesson ? Number(lesson) : undefined,
    tag: q.get('tag') ?? undefined,
    pos: (q.get('wortart') as PartOfSpeech | null) ?? undefined,
    onlyDue: q.get('nurFaellig') === '1',
    onlyProblem: q.get('problem') === '1',
    extraNew: Number(q.get('extraNeu')) || undefined,
  };
}

/** Adresse derselben Lerneinheit mit zusätzlichen neuen Karten (über das Tageslimit hinaus). */
export function extraNewPath(route: Route, count: number): string {
  const q = new URLSearchParams(route.query);
  q.set('extraNeu', String(count));
  q.delete('nurFaellig');
  q.delete('problem');
  return `/lernen?${q}`;
}

/** Adresse derselben Lerneinheit ohne Zusatz-Neue. */
export function regularPath(route: Route): string {
  const q = new URLSearchParams(route.query);
  q.delete('extraNeu');
  const s = q.toString();
  return s ? `/lernen?${s}` : '/lernen';
}
