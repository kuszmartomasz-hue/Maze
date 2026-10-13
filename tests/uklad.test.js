import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gruboscZywoplotu, dlugoscPlanszy, uklad, pas, kafle, stanPola } from '../src/uklad.js';
import { generujLabirynt, indeks, E, S } from '../src/maze.js';
import { mulberry32 } from './helpers.js';

const lab = (szerokosc, wysokosc) => ({ szerokosc, wysokosc });

test('grubość żywopłotu: połowa ścieżki, co najmniej 1 px', () => {
  assert.equal(gruboscZywoplotu(12), 6);
  assert.equal(gruboscZywoplotu(13), 7);
  assert.equal(gruboscZywoplotu(1), 1);
  assert.equal(dlugoscPlanszy(8, 12), 8 * 12 + 9 * 6);
});

test('układ: plansza mieści się, jest wycentrowana, komórka największa możliwa', () => {
  const obszary = [[600, 480], [1920, 1000], [320, 640], [200, 200]];
  for (const [w, h] of obszary) {
    for (const [n, m] of [[2, 2], [8, 8], [26, 26], [30, 30], [8, 6]]) {
      const u = uklad(lab(n, m), w, h);
      assert.ok(u.kom >= 1);
      assert.equal(u.sc, gruboscZywoplotu(u.kom));
      assert.equal(u.szer, dlugoscPlanszy(n, u.kom));
      assert.equal(u.wys, dlugoscPlanszy(m, u.kom));
      assert.ok(u.szer <= w && u.wys <= h, `${n}×${m} nie mieści się w ${w}×${h}`);
      assert.equal(u.ox, Math.floor((w - u.szer) / 2));
      assert.equal(u.oy, Math.floor((h - u.wys) / 2));
      assert.ok(dlugoscPlanszy(n, u.kom + 1) > w || dlugoscPlanszy(m, u.kom + 1) > h, 'komórka mogła być większa');
    }
  }
});

test('układ: okno zmniejszone w trakcie poziomu — duży labirynt nadal się mieści', () => {
  const u = uklad(lab(30, 30), 200, 200);
  assert.ok(u.kom < 12);
  assert.ok(u.szer <= 200 && u.wys <= 200);
});

test('układ: bardzo małe okno — bez zapętlenia, kom = 1', () => {
  const u = uklad(lab(30, 30), 10, 10);
  assert.equal(u.kom, 1);
  assert.equal(u.sc, 1);
});

test('pas: naprzemiennie żywopłot i ścieżka, ostatni pas kończy planszę', () => {
  const u = { kom: 12, sc: 6 };
  assert.deepEqual(pas(u, 0, 0), { start: 0, dl: 6 });
  assert.deepEqual(pas(u, 1, 0), { start: 6, dl: 12 });
  assert.deepEqual(pas(u, 2, 0), { start: 18, dl: 6 });
  assert.deepEqual(pas(u, 3, 10), { start: 34, dl: 12 });
  const ostatni = pas(u, 16, 0);
  assert.equal(ostatni.start + ostatni.dl, dlugoscPlanszy(8, 12));
});

test('kafle: siatka (2N+1)×(2M+1), przejścia zgodne z maskami, labirynt prostokątny', () => {
  const l = generujLabirynt(8, 6, mulberry32(7));
  const pola = kafle(l);
  assert.equal(pola.length, 17 * 13);
  const pole = (gx, gy) => pola[gy * 17 + gx];

  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 8; x++) {
      const i = indeks(l, x, y);
      const k = pole(2 * x + 1, 2 * y + 1);
      assert.equal(k.zywoplot, false);
      assert.deepEqual(k.sasiedzi, [i]);
      if (x < 7) assert.equal(pole(2 * x + 2, 2 * y + 1).zywoplot, !(l.przejscia[i] & E));
      if (y < 5) assert.equal(pole(2 * x + 1, 2 * y + 2).zywoplot, !(l.przejscia[i] & S));
    }
  }
  // labirynt doskonały: przejść między komórkami = komórek − 1
  const przejscia = pola.filter((p) => !p.zywoplot && (p.gx % 2 === 0 || p.gy % 2 === 0));
  assert.equal(przejscia.length, 8 * 6 - 1);
  // narożniki i obwód zawsze żywopłot
  for (const p of pola) {
    if (p.gx % 2 === 0 && p.gy % 2 === 0) assert.ok(p.zywoplot, `narożnik ${p.gx},${p.gy}`);
    if (p.gx === 0 || p.gy === 0 || p.gx === 16 || p.gy === 12) assert.ok(p.zywoplot, `obwód ${p.gx},${p.gy}`);
  }
});

test('kafle: sąsiedzi pól żywopłotu, także na brzegu planszy', () => {
  const l = generujLabirynt(8, 6, mulberry32(7));
  const pola = kafle(l);
  const pole = (gx, gy) => pola[gy * 17 + gx];
  assert.deepEqual(pole(0, 0).sasiedzi, [indeks(l, 0, 0)]);
  assert.deepEqual(pole(16, 12).sasiedzi, [indeks(l, 7, 5)]);
  assert.deepEqual(pole(2, 0).sasiedzi, [indeks(l, 0, 0), indeks(l, 1, 0)]);
  assert.deepEqual(pole(2, 2).sasiedzi, [indeks(l, 0, 0), indeks(l, 1, 0), indeks(l, 0, 1), indeks(l, 1, 1)]);
  assert.deepEqual(pole(1, 0).sasiedzi, [indeks(l, 0, 0)]);
  assert.deepEqual(pole(2, 1).sasiedzi, [indeks(l, 0, 0), indeks(l, 1, 0)]);
  for (const p of pola) assert.ok(p.sasiedzi.length > 0 && p.sasiedzi.every((i) => i >= 0));
});

test('stan pola: widoczne ma pierwszeństwo, brak sąsiadów = nieodkryte', () => {
  const odkryte = new Set([1, 2]);
  const widoczne = new Set([2]);
  assert.equal(stanPola([1, 2], odkryte, widoczne), 'widoczne');
  assert.equal(stanPola([1, 5], odkryte, widoczne), 'odkryte');
  assert.equal(stanPola([5, 6], odkryte, widoczne), 'nieodkryte');
  assert.equal(stanPola([], odkryte, widoczne), 'nieodkryte');
});
