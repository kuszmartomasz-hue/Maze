// Stan gry i zasady: ruch, klucz, wyjście, poziomy, rekord, mgła. Bez DOM i window.
import { generujLabirynt, wybierzPozycje, odleglosci, indeks, pozycjaZIndeksu, KIERUNKI } from './maze.js';

export const ROZMIAR_STARTOWY = 8;
export const PRZYROST_ROZMIARU = 2;
export const MIN_KOMORKA_PX = 12;
export const ZASIEG_MGLY = 3;
export const POZIOM_MGLY = 3;
export const KLUCZ_REKORDU = 'labirynt.najwyzszyPoziom';

export const RUCHY = {
  gora: KIERUNKI[0],
  prawo: KIERUNKI[1],
  dol: KIERUNKI[2],
  lewo: KIERUNKI[3],
};

/** Największy rozmiar siatki, przy którym komórka ma co najmniej MIN_KOMORKA_PX. */
export function limitRozmiaru(szerokoscPx, wysokoscPx) {
  return Math.max(2, Math.floor(Math.min(szerokoscPx, wysokoscPx) / MIN_KOMORKA_PX));
}

/** Rozmiar labiryntu dla poziomu: 8, 10, 12… obcięty do limitu. */
export function rozmiarPoziomu(poziom, limit = Infinity) {
  return Math.min(ROZMIAR_STARTOWY + PRZYROST_ROZMIARU * (poziom - 1), limit);
}

export function czyMgla(poziom) {
  return poziom >= POZIOM_MGLY;
}

/** Zbiór indeksów komórek osiągalnych po korytarzach w co najwyżej `zasieg` krokach. */
export function widoczneKomorki(labirynt, pozycja, zasieg) {
  const odl = odleglosci(labirynt, indeks(labirynt, pozycja.x, pozycja.y), zasieg);
  const wynik = new Set();
  for (let i = 0; i < odl.length; i++) if (odl[i] !== -1) wynik.add(i);
  return wynik;
}

function aktualizujWidocznosc(stan) {
  const { labirynt } = stan;
  if (stan.mgla) {
    stan.widoczne = widoczneKomorki(labirynt, stan.gracz, ZASIEG_MGLY);
    for (const i of stan.widoczne) stan.odkryte.add(i);
  } else {
    const wszystkie = new Set();
    for (let i = 0; i < labirynt.szerokosc * labirynt.wysokosc; i++) wszystkie.add(i);
    stan.widoczne = wszystkie;
    stan.odkryte = new Set(wszystkie);
  }
}

function przygotujLabirynt(stan, rozmiar, rng) {
  const labirynt = generujLabirynt(rozmiar, rozmiar, rng);
  const poz = wybierzPozycje(labirynt, rng);
  stan.labirynt = labirynt;
  stan.gracz = pozycjaZIndeksu(labirynt, poz.start);
  stan.wyjscie = pozycjaZIndeksu(labirynt, poz.wyjscie);
  stan.klucz = pozycjaZIndeksu(labirynt, poz.klucz);
  stan.maKlucz = false;
  stan.ukonczony = false;
  stan.odkryte = new Set();
  aktualizujWidocznosc(stan);
  return stan;
}

/** Tworzy stan nowego poziomu. `limit` — maksymalny rozmiar siatki dla obszaru gry. */
export function nowyPoziom(poziom, limit = Infinity, rng = Math.random) {
  const stan = { poziom, mgla: czyMgla(poziom) };
  return przygotujLabirynt(stan, rozmiarPoziomu(poziom, limit), rng);
}

/** `R`: nowy losowy labirynt na bieżącym poziomie (ten sam rozmiar, klucz i odkrycie zerowane). */
export function nowyLabirynt(stan, rng = Math.random) {
  return przygotujLabirynt(stan, stan.labirynt.szerokosc, rng);
}

/**
 * Próba ruchu w kierunku ('gora' | 'dol' | 'lewo' | 'prawo'). Mutuje stan.
 * Zwraca zdarzenie: 'sciana' | 'ruch' | 'klucz' | 'zamkniete' | 'ukonczony'.
 */
export function ruch(stan, kierunek) {
  const k = RUCHY[kierunek];
  if (!k || stan.ukonczony) return 'sciana';
  const { labirynt, gracz } = stan;
  if (!(labirynt.przejscia[indeks(labirynt, gracz.x, gracz.y)] & k.bit)) {
    aktualizujWidocznosc(stan);
    return 'sciana';
  }
  stan.gracz = { x: gracz.x + k.dx, y: gracz.y + k.dy };
  aktualizujWidocznosc(stan);

  const naPolu = (p) => p.x === stan.gracz.x && p.y === stan.gracz.y;
  if (!stan.maKlucz && naPolu(stan.klucz)) {
    stan.maKlucz = true;
    return 'klucz';
  }
  if (naPolu(stan.wyjscie)) {
    if (!stan.maKlucz) return 'zamkniete';
    stan.ukonczony = true;
    return 'ukonczony';
  }
  return 'ruch';
}

/** Odczyt rekordu; brak dostępu do storage → 0. */
export function wczytajRekord(storage) {
  try {
    const n = parseInt(storage.getItem(KLUCZ_REKORDU), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Zapisuje rekord tylko, gdy poziom > dotychczasowy. Zwraca aktualny rekord. */
export function zapiszRekord(storage, poziom) {
  const dotychczasowy = wczytajRekord(storage);
  if (poziom <= dotychczasowy) return dotychczasowy;
  try {
    storage.setItem(KLUCZ_REKORDU, String(poziom));
  } catch {
    // brak dostępu do storage nie psuje gry
  }
  return poziom;
}
