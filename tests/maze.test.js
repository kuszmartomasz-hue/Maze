import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generujLabirynt, wybierzPozycje, odleglosci, sciezka, KIERUNKI, indeks, wSiatce,
} from '../src/maze.js';
import { mulberry32 } from './helpers.js';

const ROZMIARY = [[2, 2], [3, 5], [8, 8], [10, 10], [15, 7], [30, 30], [1, 6]];
const ZIARNA = [1, 2, 3, 42, 1234, 99999];

function liczbaPrzejsc(lab) {
  let n = 0;
  for (const m of lab.przejscia) for (const k of KIERUNKI) if (m & k.bit) n++;
  return n / 2;
}

test('labirynt jest spójny i doskonały dla wielu rozmiarów i ziaren', () => {
  for (const [w, h] of ROZMIARY) {
    for (const z of ZIARNA) {
      const lab = generujLabirynt(w, h, mulberry32(z));
      const odl = odleglosci(lab, 0);
      assert.ok(odl.every((d) => d >= 0), `niespójny ${w}x${h} ziarno ${z}`);
      assert.equal(liczbaPrzejsc(lab), w * h - 1, `niedoskonały ${w}x${h} ziarno ${z}`);
    }
  }
});

test('ściany są symetryczne i brak przejść poza siatkę', () => {
  for (const [w, h] of ROZMIARY) {
    for (const z of ZIARNA) {
      const lab = generujLabirynt(w, h, mulberry32(z));
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const m = lab.przejscia[indeks(lab, x, y)];
          for (const k of KIERUNKI) {
            if (!(m & k.bit)) continue;
            const nx = x + k.dx;
            const ny = y + k.dy;
            assert.ok(wSiatce(lab, nx, ny), `przejście poza siatkę z (${x},${y})`);
            assert.ok(lab.przejscia[indeks(lab, nx, ny)] & k.przeciwny, `asymetria (${x},${y})`);
          }
        }
      }
    }
  }
});

test('duży labirynt generuje się bez przepełnienia stosu', () => {
  const lab = generujLabirynt(200, 200, mulberry32(7));
  assert.equal(liczbaPrzejsc(lab), 200 * 200 - 1);
});

test('wyjście jest najdalej od startu, klucz osiągalny i różny od startu i wyjścia', () => {
  for (const [w, h] of ROZMIARY) {
    for (const z of ZIARNA) {
      if (w * h < 3) continue;
      const rng = mulberry32(z);
      const lab = generujLabirynt(w, h, rng);
      const { start, wyjscie, klucz } = wybierzPozycje(lab, rng);
      const odl = odleglosci(lab, start);
      assert.equal(start, 0);
      assert.equal(odl[wyjscie], Math.max(...odl));
      assert.ok(odl[klucz] >= 0);
      assert.notEqual(klucz, start);
      assert.notEqual(klucz, wyjscie);
      assert.notEqual(wyjscie, start);
    }
  }
});

test('klucz leży najdalej od ścieżki start→wyjście', () => {
  for (const z of ZIARNA) {
    const rng = mulberry32(z);
    const lab = generujLabirynt(12, 12, rng);
    const { start, wyjscie, klucz } = wybierzPozycje(lab, rng);
    const odlDrogi = odleglosci(lab, sciezka(lab, start, wyjscie));
    assert.equal(odlDrogi[klucz], Math.max(...odlDrogi));
    assert.ok(odlDrogi[klucz] > 0);
  }
});

test('labirynt bez odnóg: klucz na ścieżce, inny niż start i wyjście', () => {
  for (const z of ZIARNA) {
    const rng = mulberry32(z);
    const lab = generujLabirynt(1, 6, rng);
    const { start, wyjscie, klucz } = wybierzPozycje(lab, rng);
    assert.equal(wyjscie, 5);
    assert.ok(klucz > start && klucz < wyjscie);
  }
});
