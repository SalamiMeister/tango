// Kleine Einstellungen, die nur auf DIESEM Gerät gelten (nicht synchronisiert),
// z. B. die „klebenden“ Felder Quelle/Lektion der Schnelleingabe.
// localStorage kann im privaten Modus fehlen – daher immer try/catch.

export function getPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`tango.${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function setPref<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`tango.${key}`, JSON.stringify(value));
  } catch {
    /* ignorieren */
  }
}
