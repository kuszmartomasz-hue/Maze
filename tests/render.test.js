import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rysuj, rysujTlo } from '../src/render.js';
import { nowyPoziom } from '../src/game.js';
import { BEZ_TEKSTUR } from '../src/tekstury.js';
import { mulberry32 } from './helpers.js';

/** Atrapa kontekstu 2D: zapisuje nazwy wywołanych metod, createPattern zwraca wzór ze skalą. */
function atrapaCtx() {
  const cel = {
    wywolania: [],
    skale: [],
    createPattern() {
      return { setTransform: (m) => cel.skale.push(m.a) };
    },
  };
  return new Proxy(cel, {
    get(c, klucz) {
      if (klucz in c) return c[klucz];
      return () => c.wywolania.push(klucz);
    },
    set(c, klucz, wartosc) {
      c[klucz] = wartosc;
      return true;
    },
  });
}

test('render: bez tekstur (błąd wczytania) rysuje kolorami zastępczymi, także we mgle', () => {
  for (const poziom of [1, 3]) {
    const ctx = atrapaCtx();
    rysujTlo(ctx, 800, 600, BEZ_TEKSTUR);
    rysuj(ctx, nowyPoziom(poziom, 30, mulberry32(5)), 784, 584, BEZ_TEKSTUR);
    assert.ok(ctx.wywolania.includes('fillRect'));
    assert.ok(ctx.wywolania.includes('rect'));
    assert.equal(ctx.skale.length, 0);
  }
});

test('render: tekstury skalowane — las stały kafel, żwir i żywopłot względem komórki', () => {
  const obraz = { width: 512, height: 512 };
  const tekstury = { zywoplot: obraz, zwir: obraz, las: obraz };
  const ctx = atrapaCtx();
  rysujTlo(ctx, 800, 600, tekstury);
  assert.equal(ctx.skale[0], 256 / 512);
  rysuj(ctx, nowyPoziom(1, 30, mulberry32(5)), 784, 584, tekstury);
  assert.equal(ctx.skale.length, 3);
  assert.equal(ctx.skale[1], ctx.skale[2]);
});

test('render: ekran startowy (stan null) nie rysuje planszy', () => {
  const ctx = atrapaCtx();
  rysuj(ctx, null, 784, 584, BEZ_TEKSTUR);
  assert.deepEqual(ctx.wywolania, []);
});
