// Czyste funkcje labiryntu: generowanie, BFS, wybór startu/wyjścia/klucza.
// Bez DOM i window — testowalne w Node.

// Bity otwartych przejść w komórce.
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;

export const KIERUNKI = [
  { bit: N, dx: 0, dy: -1, przeciwny: S },
  { bit: E, dx: 1, dy: 0, przeciwny: W },
  { bit: S, dx: 0, dy: 1, przeciwny: N },
  { bit: W, dx: -1, dy: 0, przeciwny: E },
];

export function indeks(lab, x, y) {
  return y * lab.szerokosc + x;
}

export function pozycjaZIndeksu(lab, i) {
  return { x: i % lab.szerokosc, y: Math.floor(i / lab.szerokosc) };
}

export function wSiatce(lab, x, y) {
  return x >= 0 && y >= 0 && x < lab.szerokosc && y < lab.wysokosc;
}

export function czyOtwarte(lab, x, y, bit) {
  return (lab.przejscia[indeks(lab, x, y)] & bit) !== 0;
}

/**
 * Generuje labirynt doskonały algorytmem recursive backtracker (iteracyjnie, ze stosem).
 * Zwraca { szerokosc, wysokosc, przejscia: Uint8Array } — przejscia[i] to maska bitów N/E/S/W.
 */
export function generujLabirynt(szerokosc, wysokosc, rng = Math.random) {
  const lab = { szerokosc, wysokosc, przejscia: new Uint8Array(szerokosc * wysokosc) };
  const odwiedzone = new Uint8Array(szerokosc * wysokosc);
  const stos = [0];
  odwiedzone[0] = 1;

  while (stos.length > 0) {
    const biezacy = stos[stos.length - 1];
    const { x, y } = pozycjaZIndeksu(lab, biezacy);
    const kandydaci = [];
    for (const k of KIERUNKI) {
      const nx = x + k.dx;
      const ny = y + k.dy;
      if (wSiatce(lab, nx, ny) && !odwiedzone[indeks(lab, nx, ny)]) kandydaci.push(k);
    }
    if (kandydaci.length === 0) {
      stos.pop();
      continue;
    }
    const k = kandydaci[Math.floor(rng() * kandydaci.length)];
    const nastepny = indeks(lab, x + k.dx, y + k.dy);
    lab.przejscia[biezacy] |= k.bit;
    lab.przejscia[nastepny] |= k.przeciwny;
    odwiedzone[nastepny] = 1;
    stos.push(nastepny);
  }
  return lab;
}

/** Indeksy komórek sąsiednich, do których prowadzi otwarte przejście. */
export function sasiedzi(lab, i) {
  const { x, y } = pozycjaZIndeksu(lab, i);
  const wynik = [];
  for (const k of KIERUNKI) {
    if (lab.przejscia[i] & k.bit) wynik.push(indeks(lab, x + k.dx, y + k.dy));
  }
  return wynik;
}

/**
 * BFS po korytarzach z jednego lub wielu źródeł (indeksów).
 * Zwraca Int32Array odległości (-1 = nieosiągnięta lub dalej niż maxGlebokosc).
 */
export function odleglosci(lab, zrodla, maxGlebokosc = Infinity) {
  const lista = Array.isArray(zrodla) ? zrodla : [zrodla];
  const odl = new Int32Array(lab.szerokosc * lab.wysokosc).fill(-1);
  const kolejka = [];
  for (const z of lista) {
    if (odl[z] === -1) {
      odl[z] = 0;
      kolejka.push(z);
    }
  }
  for (let glowa = 0; glowa < kolejka.length; glowa++) {
    const c = kolejka[glowa];
    if (odl[c] >= maxGlebokosc) continue;
    for (const n of sasiedzi(lab, c)) {
      if (odl[n] === -1) {
        odl[n] = odl[c] + 1;
        kolejka.push(n);
      }
    }
  }
  return odl;
}

/** Ścieżka (lista indeksów) od a do b po korytarzach. */
export function sciezka(lab, a, b) {
  const odl = odleglosci(lab, b);
  if (odl[a] === -1) return [];
  const wynik = [a];
  let c = a;
  while (c !== b) {
    c = sasiedzi(lab, c).find((n) => odl[n] === odl[c] - 1);
    wynik.push(c);
  }
  return wynik;
}

/** Indeksy o maksymalnej wartości w tablicy odległości (z pominięciem wykluczonych). */
function najdalsze(odl, wykluczone) {
  let max = -1;
  let wynik = [];
  for (let i = 0; i < odl.length; i++) {
    if (wykluczone.has(i)) continue;
    if (odl[i] > max) {
      max = odl[i];
      wynik = [i];
    } else if (odl[i] === max) {
      wynik.push(i);
    }
  }
  return { max, wynik };
}

/**
 * Wybiera start (0,0), wyjście (najdalej od startu) i klucz (najdalej od ścieżki start→wyjście).
 * Zwraca indeksy { start, wyjscie, klucz }.
 */
export function wybierzPozycje(lab, rng = Math.random) {
  const start = 0;
  const odlStart = odleglosci(lab, start);
  const wyjscie = najdalsze(odlStart, new Set()).wynik[0];

  const droga = sciezka(lab, start, wyjscie);
  const odlOdDrogi = odleglosci(lab, droga);
  const { max, wynik } = najdalsze(odlOdDrogi, new Set([start, wyjscie]));

  let kandydaci = wynik;
  if (max <= 0) {
    // Labirynt bez odnóg: losowa komórka ścieżki inna niż start i wyjście.
    kandydaci = droga.filter((i) => i !== start && i !== wyjscie);
  }
  const klucz = kandydaci[Math.floor(rng() * kandydaci.length)];
  return { start, wyjscie, klucz };
}
