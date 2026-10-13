// Geometria planszy w układzie blokowym: ścieżki przedzielone pasami żywopłotu. Bez DOM i window.

/** Grubość pasa żywopłotu dla boku komórki `kom` — połowa ścieżki, co najmniej 1 px. */
export function gruboscZywoplotu(kom) {
  return Math.max(1, Math.round(kom / 2));
}

/** Długość planszy w px dla `n` komórek o boku `kom`: n ścieżek + (n + 1) pasów żywopłotu. */
export function dlugoscPlanszy(n, kom) {
  return n * kom + (n + 1) * gruboscZywoplotu(kom);
}

/** Największy całkowity bok komórki, przy którym plansza mieści się w obszarze; plansza wycentrowana. */
export function uklad(labirynt, szerokoscPx, wysokoscPx) {
  const { szerokosc: n, wysokosc: m } = labirynt;
  let kom = Math.max(1, Math.floor(Math.min(szerokoscPx / n, wysokoscPx / m)));
  while (kom > 1 && (dlugoscPlanszy(n, kom) > szerokoscPx || dlugoscPlanszy(m, kom) > wysokoscPx)) kom--;
  const szer = dlugoscPlanszy(n, kom);
  const wys = dlugoscPlanszy(m, kom);
  return {
    kom,
    sc: gruboscZywoplotu(kom),
    ox: Math.floor((szerokoscPx - szer) / 2),
    oy: Math.floor((wysokoscPx - wys) / 2),
    szer,
    wys,
  };
}

/** Początek i długość pasa siatki `g` wzdłuż osi zaczynającej się w `o` (parzysty = żywopłot, nieparzysty = ścieżka). */
export function pas(u, g, o) {
  const j = Math.floor(g / 2);
  return g % 2 === 0
    ? { start: o + j * (u.kom + u.sc), dl: u.sc }
    : { start: o + u.sc + j * (u.kom + u.sc), dl: u.kom };
}
