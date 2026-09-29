// Deterministyczny generator liczb pseudolosowych (mulberry32) dla testów.
export function mulberry32(ziarno) {
  let a = ziarno >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pamięciowy odpowiednik localStorage. */
export function pamiecStorage(poczatek = {}) {
  const dane = { ...poczatek };
  return {
    getItem: (k) => (k in dane ? dane[k] : null),
    setItem: (k, v) => { dane[k] = String(v); },
    dane,
  };
}
