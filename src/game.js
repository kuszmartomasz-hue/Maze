// Stan gry i zasady: ruch, klucz, wyjście, poziomy, rekord, mgła. Bez DOM i window.
import { generujLabirynt, wybierzPozycje, odleglosci, indeks, pozycjaZIndeksu, wSiatce, KIERUNKI } from './maze.js';
import { dlugoscPlanszy } from './uklad.js';

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

/** Największy rozmiar siatki, przy którym komórka ma co najmniej MIN_KOMORKA_PX (z pasami żywopłotu). */
export function limitRozmiaru(szerokoscPx, wysokoscPx) {
  const bok = Math.min(szerokoscPx, wysokoscPx);
  let n = 2;
  while (dlugoscPlanszy(n + 1, MIN_KOMORKA_PX) <= bok) n++;
  return n;
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

export const WERSJA_ZAPISU = 2;
export const MAX_POZIOM = 500;
export const MAX_BOK_ZAPISU = 200;

/** Maski przejść jako napis hex — 1 znak na komórkę (zwarty zapis w jsonb). */
const przejsciaDoNapisu = (przejscia) => Array.from(przejscia, (m) => m.toString(16)).join('');

/** Zbiór odkrytych komórek jako bitmapa hex — 4 komórki na znak. */
function odkryteDoNapisu(odkryte, liczba) {
  const cyfry = new Uint8Array(Math.ceil(liczba / 4));
  for (const i of odkryte) cyfry[i >> 2] |= 1 << (i & 3);
  return Array.from(cyfry, (c) => c.toString(16)).join('');
}

function odkryteZNapisu(napis, liczba) {
  const wynik = new Set();
  for (let i = 0; i < liczba; i++) if (parseInt(napis[i >> 2], 16) & (1 << (i & 3))) wynik.add(i);
  return wynik;
}

const HEX = /^[0-9a-f]*$/;

/** Stan gry → prosty obiekt JSON do zapisu w bazie. Po ukończonym poziomie — wskazanie następnego. */
export function stanDoZapisu(stan) {
  if (stan.ukonczony) return { wersja: WERSJA_ZAPISU, poziom: stan.poziom + 1, nowy: true };
  const { labirynt } = stan;
  return {
    wersja: WERSJA_ZAPISU,
    poziom: stan.poziom,
    szerokosc: labirynt.szerokosc,
    wysokosc: labirynt.wysokosc,
    przejscia: przejsciaDoNapisu(labirynt.przejscia),
    gracz: { x: stan.gracz.x, y: stan.gracz.y },
    klucz: { x: stan.klucz.x, y: stan.klucz.y },
    wyjscie: { x: stan.wyjscie.x, y: stan.wyjscie.y },
    maKlucz: stan.maKlucz,
    odkryte: odkryteDoNapisu(stan.odkryte, labirynt.przejscia.length),
  };
}

const calkowita = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

/**
 * Zapis z bazy → stan gry albo null, gdy dane są uszkodzone lub niespójne (pochodzą od klienta — nie ufamy im).
 * `{ nowy: true }` → nowy labirynt na wskazanym poziomie; pełny zapis zachowuje swój rozmiar niezależnie od `limit`.
 */
export function stanZZapisu(dane, limit = Infinity, rng = Math.random) {
  if (!dane || typeof dane !== 'object' || dane.wersja !== WERSJA_ZAPISU) return null;
  if (!calkowita(dane.poziom, 1, MAX_POZIOM)) return null;
  if (dane.nowy === true) return nowyPoziom(dane.poziom, limit, rng);

  const { szerokosc, wysokosc } = dane;
  if (!calkowita(szerokosc, 2, MAX_BOK_ZAPISU) || !calkowita(wysokosc, 2, MAX_BOK_ZAPISU)) return null;
  const liczba = szerokosc * wysokosc;
  if (typeof dane.przejscia !== 'string' || dane.przejscia.length !== liczba || !HEX.test(dane.przejscia)) return null;
  const przejscia = Uint8Array.from(dane.przejscia, (c) => parseInt(c, 16));
  const labirynt = { szerokosc, wysokosc, przejscia };

  // Każde przejście w siatce i symetryczne (A→B ⇔ B→A)
  for (let i = 0; i < przejscia.length; i++) {
    const { x, y } = pozycjaZIndeksu(labirynt, i);
    for (const k of KIERUNKI) {
      if (!(przejscia[i] & k.bit)) continue;
      if (!wSiatce(labirynt, x + k.dx, y + k.dy)) return null;
      if (!(przejscia[indeks(labirynt, x + k.dx, y + k.dy)] & k.przeciwny)) return null;
    }
  }

  const pozycja = (p) => p !== null && typeof p === 'object'
    && calkowita(p.x, 0, szerokosc - 1) && calkowita(p.y, 0, wysokosc - 1);
  if (![dane.gracz, dane.klucz, dane.wyjscie].every(pozycja)) return null;
  if (typeof dane.maKlucz !== 'boolean') return null;
  if (typeof dane.odkryte !== 'string' || dane.odkryte.length !== Math.ceil(liczba / 4) || !HEX.test(dane.odkryte)) return null;

  // Spójność: z pozycji gracza osiągalne wszystkie komórki
  if (odleglosci(labirynt, indeks(labirynt, dane.gracz.x, dane.gracz.y)).includes(-1)) return null;

  const stan = {
    poziom: dane.poziom,
    mgla: czyMgla(dane.poziom),
    labirynt,
    gracz: { x: dane.gracz.x, y: dane.gracz.y },
    klucz: { x: dane.klucz.x, y: dane.klucz.y },
    wyjscie: { x: dane.wyjscie.x, y: dane.wyjscie.y },
    maKlucz: dane.maKlucz,
    ukonczony: false,
    odkryte: odkryteZNapisu(dane.odkryte, liczba),
  };
  aktualizujWidocznosc(stan);
  return stan;
}

export const KLUCZ_NICKU = 'labirynt.nick';
export const MAX_NICK = 20;

/** Nick do tabeli: bez spacji na brzegach, maks. MAX_NICK punktów kodowych (jak char_length w bazie); pusty → null. */
export function normalizujNick(tekst) {
  if (typeof tekst !== 'string') return null;
  const nick = Array.from(tekst.trim()).slice(0, MAX_NICK).join('').trim();
  return nick || null;
}

/** Odczyt nicku; brak dostępu do storage → null. */
export function wczytajNick(storage) {
  try {
    return normalizujNick(storage.getItem(KLUCZ_NICKU));
  } catch {
    return null;
  }
}

/** Zapis nicku (null usuwa); brak dostępu do storage nie psuje gry. */
export function zapiszNick(storage, nick) {
  try {
    if (nick) storage.setItem(KLUCZ_NICKU, nick);
    else storage.removeItem(KLUCZ_NICKU);
  } catch {
    // brak dostępu do storage nie psuje gry
  }
}
