// Kleine Text-Helfer rund um Japanisch und Listen.
import { toRomaji, toKana, isKana } from 'wanakana';

/** Enthält der Text mindestens ein Kanji? */
export function hasKanji(s: string): boolean {
  return /\p{Script=Han}/u.test(s);
}

/** Besteht der Text (ohne Leerzeichen, ー, 〜) nur aus Hiragana/Katakana? */
export function isKanaOnly(s: string): boolean {
  const t = s.replace(/[\s〜~・]/g, '');
  return t.length > 0 && isKana(t);
}

/** Enthält der Text lateinische Buchstaben? */
export function hasLatin(s: string): boolean {
  return /[a-zäöüß]/i.test(s);
}

/**
 * Wandelt Romaji in Kana um. Kleinbuchstaben → Hiragana, GROSSBUCHSTABEN → Katakana.
 * Bereits vorhandene Kana bleiben unverändert.
 * imeMode=true: ein einzelnes „n“ am Ende bleibt stehen (man könnte noch „na“ tippen).
 */
export function romajiToKana(s: string, imeMode = false): string {
  return toKana(s, imeMode ? { IMEMode: true } : {});
}

/** Kana → Romaji (Hepburn), z. B. たべる → taberu */
export function kanaToRomaji(s: string): string {
  return toRomaji(s);
}

/** Zerlegt „essen; speisen, fressen“ in ["essen", "speisen", "fressen"]. */
export function splitMeanings(s: string): string[] {
  return dedupe(
    s
      .split(/[;,、；]/)
      .map((x) => x.trim())
      .filter(Boolean),
  );
}

/** Zerlegt „verb, genki1 ; wichtig“ in Tags. */
export function splitTags(s: string): string[] {
  return dedupe(
    s
      .split(/[,;、]/)
      .map((x) => x.trim())
      .filter(Boolean),
  );
}

/** Entfernt Duplikate (ohne Beachtung von Groß-/Kleinschreibung), Reihenfolge bleibt. */
export function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const k = item.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

/** Liest eine Lektionsnummer aus „3“, „L3“, „Lektion 3“. Sonst undefined. */
export function parseLesson(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const m = s.match(/\d+/);
  return m ? Number(m[0]) : undefined;
}
