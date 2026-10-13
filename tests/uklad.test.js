import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gruboscZywoplotu, dlugoscPlanszy, uklad, pas } from '../src/uklad.js';

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
