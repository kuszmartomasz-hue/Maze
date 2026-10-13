import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rysuj, rysujTlo, rysujPlansze, rysujKlatke, rysujTloAnimowane, polaPlanszy, stanyPol } from '../src/render.js';
import { nowyPoziom, nowyLabirynt, ruch } from '../src/game.js';
import {
  ruchStaly, nowyRuch, aktualizujMgle, iskry, swietliki, chmury, liscie,
} from '../src/animacje.js';
import { BEZ_TEKSTUR } from '../src/tekstury.js';
import { mulberry32 } from './helpers.js';

/** Atrapa kontekstu 2D: zapisuje nazwy wywołanych metod, createPattern zwraca wzór ze skalą. */
function atrapaCtx() {
  const cel = {
    wywolania: [],
    skale: [],
    globalAlpha: 1,
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

/** Pełny stan animacji w trakcie: ruch, przejścia mgły, iskry, świetliki, rozbłysk. */
function animWTrakcie(stan, czas) {
  const przed = aktualizujMgle(null, stanyPol(stan), 0);
  const kierunek = ['prawo', 'dol', 'lewo', 'gora'].find((k) => ruch(stan, k) !== 'sciana');
  return {
    ograniczony: false,
    ruch: nowyRuch(ruchStaly({ x: 0, y: 0 }), stan.gracz, czas - 50),
    mgla: aktualizujMgle(przed, stanyPol(stan), czas - 100),
    iskry: iskry(stan.klucz.x, stan.klucz.y, mulberry32(1), czas - 100),
    swietliki: swietliki(polaPlanszy(stan.labirynt), mulberry32(2)),
    wejscie: null,
    rozblysk: kierunek ? czas - 200 : null,
  };
}

test('render: pola siatki liczone raz na labirynt', () => {
  const s = nowyPoziom(3, 30, mulberry32(5));
  const a = polaPlanszy(s.labirynt);
  assert.equal(polaPlanszy(s.labirynt), a, 'ten sam labirynt — ta sama tablica');
  nowyLabirynt(s, mulberry32(6));
  assert.notEqual(polaPlanszy(s.labirynt), a, 'nowy labirynt — nowe pola');
  assert.equal(stanyPol(s).length, polaPlanszy(s.labirynt).length);
});

test('render: klatka w trakcie animacji bez wyjątku i z przywróconym globalAlpha', () => {
  for (const poziom of [1, 3]) {
    const s = nowyPoziom(poziom, 30, mulberry32(5));
    for (const czas of [1000, 1050, 1300, 5000]) {
      const ctx = atrapaCtx();
      ctx.globalAlpha = 0.5; // wejście planszy ustawia krycie przed klatką
      rysujPlansze(ctx, s, 784, 584, BEZ_TEKSTUR);
      rysujKlatke(ctx, s, 784, 584, animWTrakcie(s, czas), czas);
      assert.equal(ctx.globalAlpha, 0.5, `globalAlpha zmienione (poziom ${poziom}, t=${czas})`);
      assert.ok(ctx.wywolania.includes('arc'), 'gracz narysowany');
    }
  }
});

test('render: tło animowane bez wyjątku i z przywróconym globalAlpha', () => {
  const ctx = atrapaCtx();
  ctx.globalAlpha = 1;
  rysujTloAnimowane(ctx, 1100, 800, chmury(1100, 800, mulberry32(3)), liscie(1100, 800, null, mulberry32(3)), 1234);
  assert.equal(ctx.globalAlpha, 1);
  assert.ok(ctx.wywolania.includes('ellipse'));
});
