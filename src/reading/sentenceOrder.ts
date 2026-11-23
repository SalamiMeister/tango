// Merkt sich die Reihenfolge der zuletzt angezeigten Satzliste, damit man in der
// Leseansicht mit „Nächster Satz“ weiterblättern kann.

let order: number[] = [];

export function setSentenceOrder(ids: number[]): void {
  order = ids;
}

export function nextSentenceId(current: number): number | undefined {
  const i = order.indexOf(current);
  return i >= 0 ? order[i + 1] : undefined;
}
