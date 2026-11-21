// Zusammenführen von Datensätzen: pro Datensatz gewinnt der neueste Stand
// (updated_at). Wird für den JSON-Import genutzt und später für den OneDrive-Sync.

export interface Mergeable {
  updated_at: number;
}

/**
 * Liefert die eingehenden Datensätze, die lokal geschrieben werden müssen:
 * solche, die es lokal noch nicht gibt, oder die neuer sind als der lokale Stand.
 */
export function recordsToApply<T extends Mergeable>(
  local: T[],
  incoming: T[],
  key: (r: T) => string,
): T[] {
  const localByKey = new Map(local.map((r) => [key(r), r]));
  return incoming.filter((r) => {
    const l = localByKey.get(key(r));
    return !l || r.updated_at > l.updated_at;
  });
}
