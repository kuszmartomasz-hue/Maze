import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nowyPoziom, nowyLabirynt, ruch, rozmiarPoziomu, limitRozmiaru, widoczneKomorki,
  wczytajRekord, zapiszRekord, RUCHY, ZASIEG_MGLY, POZIOM_MGLY, KLUCZ_REKORDU, MIN_KOMORKA_PX,
} from '../src/game.js';
import { indeks, sciezka, pozycjaZIndeksu, odleglosci, N, E, S, W } from '../src/maze.js';
import { mulberry32, pamiecStorage } from './helpers.js';

function kierunekDo(a, b) {
  if (b.x > a.x) return 'prawo';
  if (b.x < a.x) return 'lewo';
  if (b.y > a.y) return 'dol';
  return 'gora';
}

/** Prowadzi gracza po ścieżce do celu, zwraca listę zdarzeń. */
function idzDo(stan, cel) {
  const lab = stan.labirynt;
  const droga = sciezka(lab, indeks(lab, stan.gracz.x, stan.gracz.y), indeks(lab, cel.x, cel.y));
  const zdarzenia = [];
  for (let i = 1; i < droga.length; i++) {
    zdarzenia.push(ruch(stan, kierunekDo(stan.gracz, pozycjaZIndeksu(lab, droga[i]))));
  }
  return zdarzenia;
}

test('ruch w ścianę nie zmienia pozycji; w korytarz zmienia o jedną komórkę', () => {
  const stan = nowyPoziom(1, Infinity, mulberry32(5));
  const m = stan.labirynt.przejscia[0];
  // Start (0,0): góra i lewo to zawsze ściany zewnętrzne.
  assert.equal(ruch(stan, 'gora'), 'sciana');
  assert.equal(ruch(stan, 'lewo'), 'sciana');
  assert.deepEqual(stan.gracz, { x: 0, y: 0 });
  for (const [kier, bit] of [['prawo', E], ['dol', S]]) {
    const s = nowyPoziom(1, Infinity, mulberry32(5));
    const zd = ruch(s, kier);
    if (m & bit) {
      assert.notEqual(zd, 'sciana');
      assert.equal(Math.abs(s.gracz.x) + Math.abs(s.gracz.y), 1);
    } else {
      assert.equal(zd, 'sciana');
      assert.deepEqual(s.gracz, { x: 0, y: 0 });
    }
  }
});

test('ruch w ścianę wewnętrzną nie zmienia pozycji', () => {
  const stan = nowyPoziom(1, Infinity, mulberry32(11));
  const lab = stan.labirynt;
  // znajdź komórkę z wewnętrzną ścianą i postaw tam gracza
  for (let i = 0; i < lab.przejscia.length; i++) {
    const p = pozycjaZIndeksu(lab, i);
    for (const [kier, k] of Object.entries(RUCHY)) {
      const nx = p.x + k.dx;
      const ny = p.y + k.dy;
      if (nx < 0 || ny < 0 || nx >= lab.szerokosc || ny >= lab.wysokosc) continue;
      if (lab.przejscia[i] & k.bit) continue;
      stan.gracz = { ...p };
      assert.equal(ruch(stan, kier), 'sciana');
      assert.deepEqual(stan.gracz, p);
      return;
    }
  }
  assert.fail('brak wewnętrznej ściany');
});

test('wyjście bez klucza nie kończy poziomu; z kluczem kończy', () => {
  for (const z of [1, 2, 3, 4]) {
    const stan = nowyPoziom(1, Infinity, mulberry32(z));
    const zd1 = idzDo(stan, stan.wyjscie);
    // Klucz leży poza ścieżką start→wyjście, więc tu go nie zbieramy.
    assert.equal(zd1.at(-1), 'zamkniete');
    assert.equal(stan.ukonczony, false);
    assert.equal(stan.maKlucz, false);

    const zd2 = idzDo(stan, stan.klucz);
    assert.equal(zd2.at(-1), 'klucz');
    assert.equal(stan.maKlucz, true);

    const zd3 = idzDo(stan, stan.wyjscie);
    assert.equal(zd3.at(-1), 'ukonczony');
    assert.equal(stan.ukonczony, true);
  }
});

test('rozmiar poziomu: 8, 10, 12… i obcięcie do limitu', () => {
  assert.equal(rozmiarPoziomu(1), 8);
  assert.equal(rozmiarPoziomu(2), 10);
  assert.equal(rozmiarPoziomu(3), 12);
  assert.equal(rozmiarPoziomu(10), 26);
  assert.equal(rozmiarPoziomu(10, 20), 20);
  assert.equal(rozmiarPoziomu(50, 20), 20);
  assert.equal(limitRozmiaru(600, 480), Math.floor(480 / MIN_KOMORKA_PX));
  assert.equal(nowyPoziom(20, 30, mulberry32(1)).labirynt.szerokosc, 30);
  assert.equal(nowyPoziom(2, 30, mulberry32(1)).labirynt.wysokosc, 10);
});

test('rekord zapisuje się tylko, gdy nowy poziom > dotychczasowy', () => {
  const st = pamiecStorage();
  assert.equal(wczytajRekord(st), 0);
  assert.equal(zapiszRekord(st, 3), 3);
  assert.equal(st.dane[KLUCZ_REKORDU], '3');
  assert.equal(zapiszRekord(st, 2), 3);
  assert.equal(st.dane[KLUCZ_REKORDU], '3');
  assert.equal(zapiszRekord(st, 3), 3);
  assert.equal(zapiszRekord(st, 5), 5);
  assert.equal(wczytajRekord(st), 5);
});

test('brak dostępu do storage nie psuje gry', () => {
  const zepsuty = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceeded'); },
  };
  assert.equal(wczytajRekord(zepsuty), 0);
  assert.doesNotThrow(() => zapiszRekord(zepsuty, 4));
  assert.equal(wczytajRekord(null), 0);
  assert.equal(wczytajRekord(pamiecStorage({ [KLUCZ_REKORDU]: 'śmieci' })), 0);
});

test('mgła: poziomy 1–2 w pełni odkryte, od 3 tylko zasięg 3 kroków', () => {
  for (const p of [1, 2]) {
    const s = nowyPoziom(p, Infinity, mulberry32(p));
    assert.equal(s.mgla, false);
    assert.equal(s.odkryte.size, s.labirynt.szerokosc * s.labirynt.wysokosc);
  }
  for (const p of [POZIOM_MGLY, 4, 7]) {
    const s = nowyPoziom(p, Infinity, mulberry32(p));
    assert.equal(s.mgla, true);
    const odl = odleglosci(s.labirynt, 0);
    const oczekiwane = new Set();
    odl.forEach((d, i) => { if (d <= ZASIEG_MGLY) oczekiwane.add(i); });
    assert.deepEqual(s.odkryte, oczekiwane);
  }
});

test('widoczneKomorki nie widzi przez ścianę', () => {
  // Ręczny labirynt 2x3 w kształcie „U”: (0,0)↓(0,1)↓(0,2)→(1,2)↑(1,1)↑(1,0)
  // (0,0) i (1,0) sąsiadują fizycznie, ale po korytarzu dzieli je 5 kroków.
  const lab = { szerokosc: 2, wysokosc: 3, przejscia: new Uint8Array(6) };
  const otworz = (x, y, bit) => { lab.przejscia[indeks(lab, x, y)] |= bit; };
  otworz(0, 0, S); otworz(0, 1, N);
  otworz(0, 1, S); otworz(0, 2, N);
  otworz(0, 2, E); otworz(1, 2, W);
  otworz(1, 2, N); otworz(1, 1, S);
  otworz(1, 1, N); otworz(1, 0, S);

  const widoczne = widoczneKomorki(lab, { x: 0, y: 0 }, 3);
  assert.ok(!widoczne.has(indeks(lab, 1, 0)), 'widać przez ścianę');
  assert.ok(!widoczne.has(indeks(lab, 1, 1)));
  assert.deepEqual(
    [...widoczne].sort(),
    [indeks(lab, 0, 0), indeks(lab, 0, 1), indeks(lab, 0, 2), indeks(lab, 1, 2)].sort(),
  );
});

test('zbiór odkrytych tylko rośnie; R i nowy poziom go zerują', () => {
  const rng = mulberry32(21);
  const stan = nowyPoziom(5, Infinity, rng);
  const startowe = new Set(stan.odkryte);
  let poprzednie = new Set(stan.odkryte);
  for (let i = 0; i < 300; i++) {
    const kier = ['gora', 'dol', 'lewo', 'prawo'][Math.floor(rng() * 4)];
    ruch(stan, kier);
    for (const c of poprzednie) assert.ok(stan.odkryte.has(c), 'odkryta komórka zniknęła');
    assert.ok(stan.odkryte.size >= poprzednie.size);
    poprzednie = new Set(stan.odkryte);
  }
  assert.ok(stan.odkryte.size > startowe.size, 'błądzenie niczego nie odkryło');

  nowyLabirynt(stan, rng);
  assert.deepEqual(stan.gracz, { x: 0, y: 0 });
  assert.equal(stan.maKlucz, false);
  assert.deepEqual(stan.odkryte, widoczneKomorki(stan.labirynt, stan.gracz, ZASIEG_MGLY));

  const kolejny = nowyPoziom(6, Infinity, rng);
  assert.deepEqual(kolejny.odkryte, widoczneKomorki(kolejny.labirynt, { x: 0, y: 0 }, ZASIEG_MGLY));
});

test('R zachowuje rozmiar i poziom, resetuje klucz', () => {
  const rng = mulberry32(8);
  const stan = nowyPoziom(3, Infinity, rng);
  idzDo(stan, stan.klucz);
  assert.equal(stan.maKlucz, true);
  nowyLabirynt(stan, rng);
  assert.equal(stan.poziom, 3);
  assert.equal(stan.labirynt.szerokosc, 12);
  assert.equal(stan.maKlucz, false);
});
