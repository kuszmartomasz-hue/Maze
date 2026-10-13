import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SZEROKOSC_SCIEZKI, SZEROKOSC_ZYWOPLOTU, WYSOKOSC_ZYWOPLOTU,
  rozmiarPlanszy3d, poleSiatki3d, srodekKomorki3d, blokiZywoplotu, polaSiatki3d, drzewaLasu, kamera3d,
} from '../src/swiat3d.js';
import { kafle } from '../src/uklad.js';
import { generujLabirynt } from '../src/maze.js';
import { mulberry32 } from './helpers.js';

const bliskie = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg ?? ''} ${a} ≠ ${b}`);
const lab = (n, m, ziarno = 7) => generujLabirynt(n, m, mulberry32(ziarno));

test('stałe świata', () => {
  assert.equal(SZEROKOSC_SCIEZKI, 1);
  assert.equal(SZEROKOSC_ZYWOPLOTU, 0.5);
  assert.ok(WYSOKOSC_ZYWOPLOTU > 1);
});

test('rozmiar planszy: N·1 + (N+1)·0.5, osobno szerokość i głębokość', () => {
  const r = rozmiarPlanszy3d(lab(8, 6));
  bliskie(r.szer, 8 + 9 * 0.5);
  bliskie(r.gleb, 6 + 7 * 0.5);
});

test('pola siatki stykają się bez przerw i nakładek, suma = rozmiar planszy', () => {
  for (const [n, m] of [[8, 8], [8, 6], [3, 5]]) {
    const l = lab(n, m);
    const r = rozmiarPlanszy3d(l);
    for (let gy = 0; gy <= 2 * m; gy++) {
      let prawa = -r.szer / 2;
      let suma = 0;
      for (let gx = 0; gx <= 2 * n; gx++) {
        const p = poleSiatki3d(l, gx, gy);
        bliskie(p.x - p.sx / 2, prawa, `gx=${gx}`);
        prawa = p.x + p.sx / 2;
        suma += p.sx;
      }
      bliskie(suma, r.szer);
      bliskie(prawa, r.szer / 2);
    }
    for (let gx = 0; gx <= 2 * n; gx++) {
      let dol = -r.gleb / 2;
      let suma = 0;
      for (let gy = 0; gy <= 2 * m; gy++) {
        const p = poleSiatki3d(l, gx, gy);
        bliskie(p.z - p.sz / 2, dol, `gy=${gy}`);
        dol = p.z + p.sz / 2;
        suma += p.sz;
      }
      bliskie(suma, r.gleb);
    }
  }
});

test('pole siatki: nieparzyste = ścieżka (1), parzyste = żywopłot (0.5)', () => {
  const l = lab(4, 4);
  const p = poleSiatki3d(l, 1, 2);
  bliskie(p.sx, 1);
  bliskie(p.sz, 0.5);
});

test('środek komórki (0,0) i (N−1,M−1) symetryczny względem 0 dla planszy kwadratowej', () => {
  const l = lab(8, 8);
  const a = srodekKomorki3d(l, 0, 0);
  const b = srodekKomorki3d(l, 7, 7);
  bliskie(a.x, -b.x);
  bliskie(a.z, -b.z);
  assert.ok(a.x < 0 && a.z < 0);
});

test('środek komórki zgadza się z polem siatki i interpoluje ułamki', () => {
  const l = lab(8, 6);
  const p = poleSiatki3d(l, 5, 3); // komórka (2, 1)
  const s = srodekKomorki3d(l, 2, 1);
  bliskie(s.x, p.x);
  bliskie(s.z, p.z);
  const polowa = srodekKomorki3d(l, 2.5, 1);
  bliskie(polowa.x, s.x + 0.75);
  bliskie(polowa.z, s.z);
});

test('bloki żywopłotu: tyle, ile pól zywoplot w kafle(), k zgodne', () => {
  const l = lab(8, 6);
  const kf = kafle(l);
  const bloki = blokiZywoplotu(l);
  assert.equal(bloki.length, kf.filter((p) => p.zywoplot).length);
  for (const b of bloki) {
    assert.ok(kf[b.k].zywoplot);
    const p = poleSiatki3d(l, kf[b.k].gx, kf[b.k].gy);
    assert.deepEqual({ x: b.x, z: b.z, sx: b.sx, sz: b.sz }, p);
  }
  assert.equal(new Set(bloki.map((b) => b.k)).size, bloki.length);
});

test('labirynt prostokątny 8×6: x od szerokości, z od wysokości', () => {
  const l = lab(8, 6);
  const wszystkie = polaSiatki3d(l);
  assert.equal(wszystkie.length, 17 * 13);
  const maxX = Math.max(...wszystkie.map((p) => p.x + p.sx / 2));
  const maxZ = Math.max(...wszystkie.map((p) => p.z + p.sz / 2));
  bliskie(maxX, (8 + 9 * 0.5) / 2);
  bliskie(maxZ, (6 + 7 * 0.5) / 2);
  wszystkie.forEach((p, i) => assert.equal(p.k, i));
  const kf = kafle(l);
  wszystkie.forEach((p, i) => assert.equal(p.zywoplot, kf[i].zywoplot));
});

test('drzewa: deterministyczne przy stałym rng i żadne nie stoi na planszy (margines 1.2)', () => {
  const l = lab(8, 6);
  const a = drzewaLasu(l, mulberry32(5));
  const b = drzewaLasu(l, mulberry32(5));
  assert.deepEqual(a, b);
  assert.ok(a.length > 50);
  const r = rozmiarPlanszy3d(l);
  for (const d of a) {
    const wPlanszy = Math.abs(d.x) < r.szer / 2 + 1.2 && Math.abs(d.z) < r.gleb / 2 + 1.2;
    assert.ok(!wPlanszy, `drzewo na planszy: ${d.x}, ${d.z}`);
    assert.ok(d.wysokosc > 0 && d.promien > 0);
    assert.ok(Number.isFinite(d.obrot) && Number.isFinite(d.odcien));
  }
  assert.notDeepEqual(a, drzewaLasu(l, mulberry32(6)));
  assert.ok(drzewaLasu(l, mulberry32(5), 2).length < a.length);
});

test('kamera: nad graczem, patrzy w dół na gracza, stoi na południe od niego', () => {
  for (const aspekt of [0.5, 1, 1.78]) {
    const gracz = { x: 3, z: -2 };
    const k = kamera3d(gracz, aspekt);
    assert.ok(k.pozycja.y > 0);
    assert.deepEqual(k.cel, { x: 3, y: 0, z: -2 });
    assert.ok(k.pozycja.z > gracz.z, 'kamera na +Z (południe)');
    bliskie(k.pozycja.x, gracz.x, 'bez obrotu na boki');
    const dy = k.cel.y - k.pozycja.y;
    const dz = k.cel.z - k.pozycja.z;
    assert.ok(dy < 0 && dz < 0, 'patrzy w dół i na północ');
    const kat = Math.atan2(-dy, -dz) * 180 / Math.PI;
    assert.ok(kat > 50 && kat < 60, `kąt ${kat}`);
  }
  assert.ok(kamera3d({ x: 0, z: 0 }, 0.5).pozycja.y > kamera3d({ x: 0, z: 0 }, 1.78).pozycja.y);
});
