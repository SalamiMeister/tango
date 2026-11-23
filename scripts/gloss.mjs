// Bereinigung der Wadoku-Bedeutungen (wird von build-data.mjs genutzt, Tests in gloss.test.mjs)

/**
 * Der Wadoku-EDICT-Export (Beta) verliert manchmal Leerzeichen:
 *  - „elektrischeBahn“  → kurzer Rest: Leerzeichen einfügen → „elektrische Bahn“
 *  - „PonsTeil des Hinterhirns“, „guten Morgen!Gruß am Morgen“ → lange Erläuterung: abschneiden
 *  - reine Herkunfts-/Stilkürzel („schweiz.“, „ugs.“) → weglassen
 */
export function cleanGloss(g) {
  let out = g.replace(/‑/g, '-').trim();
  if (/^[a-zäöüß]+\.$/.test(out)) return '';
  for (let guard = 0; guard < 5; guard++) {
    const i = out.search(/[a-zäöüß.)][A-ZÄÖÜ]|[!?][A-Za-zÄÖÜäöüß]/);
    if (i < 0) break;
    const rest = out.slice(i + 1);
    if ('!?'.includes(out[i]) || (rest.includes(' ') && rest.length > 15)) {
      out = out.slice(0, i + 1);
      break;
    }
    out = out.slice(0, i + 1) + ' ' + rest;
  }
  out = out.trim();
  return out.length > 70 ? out.slice(0, 68) + '…' : out;
}
