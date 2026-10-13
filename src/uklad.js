// Geometria planszy w układzie blokowym: ścieżki przedzielone pasami żywopłotu. Bez DOM i window.
import { E, S, indeks } from './maze.js';

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

/**
 * Pola siatki (2N+1)×(2M+1), wierszami: { gx, gy, zywoplot, sasiedzi }.
 * Nieparzyste gx i gy — komórka; jedno parzyste — pas między dwiema komórkami (żwir przy przejściu);
 * oba parzyste — narożnik (zawsze żywopłot). `sasiedzi` — komórki, od których pole bierze stan mgły.
 */
export function kafle(labirynt) {
  const { szerokosc: n, wysokosc: m, przejscia } = labirynt;
  const komorka = (x, y) => (x >= 0 && y >= 0 && x < n && y < m ? indeks(labirynt, x, y) : -1);
  const wynik = [];
  for (let gy = 0; gy <= 2 * m; gy++) {
    for (let gx = 0; gx <= 2 * n; gx++) {
      let zywoplot;
      let sasiedzi;
      if (gx % 2 === 1 && gy % 2 === 1) {
        zywoplot = false;
        sasiedzi = [komorka((gx - 1) / 2, (gy - 1) / 2)];
      } else if (gx % 2 === 1) {
        // pas poziomy między komórką powyżej a poniżej
        const x = (gx - 1) / 2;
        const gora = komorka(x, gy / 2 - 1);
        const dol = komorka(x, gy / 2);
        zywoplot = gora === -1 || dol === -1 || !(przejscia[gora] & S);
        sasiedzi = [gora, dol];
      } else if (gy % 2 === 1) {
        // pas pionowy między komórką z lewej a z prawej
        const y = (gy - 1) / 2;
        const lewa = komorka(gx / 2 - 1, y);
        const prawa = komorka(gx / 2, y);
        zywoplot = lewa === -1 || prawa === -1 || !(przejscia[lewa] & E);
        sasiedzi = [lewa, prawa];
      } else {
        zywoplot = true;
        sasiedzi = [
          komorka(gx / 2 - 1, gy / 2 - 1), komorka(gx / 2, gy / 2 - 1),
          komorka(gx / 2 - 1, gy / 2), komorka(gx / 2, gy / 2),
        ];
      }
      wynik.push({ gx, gy, zywoplot, sasiedzi: sasiedzi.filter((i) => i !== -1) });
    }
  }
  return wynik;
}

/** Stan mgły pola: widoczne, jeśli widać którąkolwiek sąsiednią komórkę; odkryte, jeśli którąkolwiek odkryto. */
export function stanPola(sasiedzi, odkryte, widoczne) {
  if (sasiedzi.some((i) => widoczne.has(i))) return 'widoczne';
  if (sasiedzi.some((i) => odkryte.has(i))) return 'odkryte';
  return 'nieodkryte';
}
