import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  easeOutCubic, easeInOutSine, postep, ruchStaly, pozycjaGracza, nowyRuch, odbicie,
  aktualizujMgle, kryciePola, CZAS_RUCHU, CZAS_ODKRYCIA, CZAS_PRZYCIEMNIENIA, ODBICIE,
  iskry, stanIskry, swietliki, stanSwietlika, chmury, pozycjaChmury, liscie, pozycjaLiscia,
  unoszenieKlucza, blyskKlucza, pulsDrzwi, wejsciePlanszy, rozblysk, animStatyczna,
  CZAS_ISKIER, CZAS_ROZBLYSKU, CZAS_WEJSCIA,
} from '../src/animacje.js';

import { mulberry32 } from './helpers.js';
import { kafle } from '../src/uklad.js';
import { generujLabirynt } from '../src/maze.js';

const blisko = (a, b, opis) => assert.ok(Math.abs(a - b) < 1e-9, `${opis}: ${a} ≠ ${b}`);

test('łagodzenie i postęp: granice 0 i 1, zakres 0..1', () => {
  for (const f of [easeOutCubic, easeInOutSine]) {
    blisko(f(0), 0, f.name);
    blisko(f(1), 1, f.name);
  }
  assert.ok(easeOutCubic(0.5) > 0.5, 'easeOutCubic hamuje pod koniec');
  assert.equal(postep(100, 50, 200), 0);
  assert.equal(postep(100, 200, 200), 0.5);
  assert.equal(postep(100, 900, 200), 1);
  assert.equal(postep(100, 100, 0), 1, 'zerowe trwanie = koniec');
  assert.equal(postep(-Infinity, 0, 300), 1, 'od -∞ = koniec');
});

test('ruch gracza: start, koniec, stały gracz', () => {
  const r = nowyRuch(ruchStaly({ x: 2, y: 3 }), { x: 3, y: 3 }, 1000);
  assert.deepEqual(pozycjaGracza(r, 1000), { x: 2, y: 3 });
  assert.deepEqual(pozycjaGracza(r, 1000 + CZAS_RUCHU), { x: 3, y: 3 });
  assert.deepEqual(pozycjaGracza(r, 99999), { x: 3, y: 3 });
  const pol = pozycjaGracza(r, 1000 + CZAS_RUCHU / 2);
  assert.ok(pol.x > 2.5 && pol.x < 3, `w połowie czasu dalej niż w połowie drogi: ${pol.x}`);
  assert.deepEqual(pozycjaGracza(ruchStaly({ x: 5, y: 1 }), 0), { x: 5, y: 1 });
});

test('ruch gracza: przerwany w połowie startuje z bieżącej pozycji, bez skoku', () => {
  const r1 = nowyRuch(ruchStaly({ x: 0, y: 0 }), { x: 1, y: 0 }, 0);
  const wPolowie = pozycjaGracza(r1, 60);
  const r2 = nowyRuch(r1, { x: 2, y: 0 }, 60);
  assert.deepEqual(pozycjaGracza(r2, 60), wPolowie, 'nowy ruch zaczyna się tam, gdzie gracz był widoczny');
  assert.deepEqual(pozycjaGracza(r2, 60 + CZAS_RUCHU), { x: 2, y: 0 });
  // szybka seria: pozycja nigdy nie cofa się
  let r = ruchStaly({ x: 0, y: 0 });
  let poprzednie = 0;
  for (let i = 1; i <= 10; i++) {
    r = nowyRuch(r, { x: i, y: 0 }, i * 30);
    for (let t = i * 30; t < i * 30 + 30; t += 5) {
      const x = pozycjaGracza(r, t).x;
      assert.ok(x >= poprzednie - 1e-9, `cofnięcie przy t=${t}: ${x} < ${poprzednie}`);
      poprzednie = x;
    }
  }
});

test('odbicie: wychylenie w stronę ściany i powrót; nie przerywa trwającego ruchu', () => {
  const stoi = ruchStaly({ x: 4, y: 4 });
  const o = odbicie(stoi, { dx: 1, dy: 0 }, 500);
  const szczyt = pozycjaGracza(o, 500 + CZAS_RUCHU / 2);
  blisko(szczyt.x, 4 + ODBICIE, 'szczyt odbicia');
  assert.equal(szczyt.y, 4);
  assert.deepEqual(pozycjaGracza(o, 500 + CZAS_RUCHU), { x: 4, y: 4 });

  const wRuchu = nowyRuch(stoi, { x: 5, y: 4 }, 1000);
  assert.equal(odbicie(wRuchu, { dx: 1, dy: 0 }, 1050), wRuchu, 'odbicie w trakcie ruchu ignorowane');
  // po odbiciu kolejne odbicie jest dozwolone (seria uderzeń w ścianę)
  assert.notEqual(odbicie(o, { dx: 1, dy: 0 }, 550), o);
});

test('ruch i odbicie przy ograniczonym ruchu: od razu na polu, bez wychylenia', () => {
  const r = nowyRuch(ruchStaly({ x: 0, y: 0 }), { x: 1, y: 0 }, 0, true);
  assert.deepEqual(pozycjaGracza(r, 0), { x: 1, y: 0 });
  const o = odbicie(r, { dx: 1, dy: 0 }, 10, true);
  assert.deepEqual(pozycjaGracza(o, 70), { x: 1, y: 0 });
});

test('mgła: bez historii od razu; odkrycie 300 ms, przyciemnienie 200 ms', () => {
  const p0 = aktualizujMgle(null, ['nieodkryte', 'widoczne', 'odkryte'], 0);
  assert.deepEqual(p0.map((p) => kryciePola(p, 0)), [
    { mgla: 1, cien: 0 }, { mgla: 0, cien: 0 }, { mgla: 0, cien: 1 },
  ]);

  const p1 = aktualizujMgle(p0, ['widoczne', 'odkryte', 'widoczne'], 1000);
  // odkrycie: mgła 1 → 0 w 300 ms
  assert.equal(kryciePola(p1[0], 1000).mgla, 1);
  blisko(kryciePola(p1[0], 1000 + CZAS_ODKRYCIA / 2).mgla, 0.5, 'połowa odkrycia');
  assert.equal(kryciePola(p1[0], 1000 + CZAS_ODKRYCIA).mgla, 0);
  // wyjście z zasięgu: cień 0 → 1 w 200 ms
  blisko(kryciePola(p1[1], 1000 + CZAS_PRZYCIEMNIENIA / 2).cien, 0.5, 'połowa przyciemnienia');
  assert.equal(kryciePola(p1[1], 1000 + CZAS_PRZYCIEMNIENIA).cien, 1);
  // powrót w zasięg: cień 1 → 0 w 200 ms
  assert.equal(kryciePola(p1[2], 1000 + CZAS_PRZYCIEMNIENIA).cien, 0);
  // pole bez zmiany stanu zachowuje swój obiekt
  const p2 = aktualizujMgle(p1, ['widoczne', 'odkryte', 'widoczne'], 1100);
  assert.equal(p2[0], p1[0]);
});

test('mgła: zmiana w trakcie przejścia startuje z bieżącego krycia', () => {
  const p0 = aktualizujMgle(null, ['widoczne'], 0);
  const p1 = aktualizujMgle(p0, ['odkryte'], 0);
  const p2 = aktualizujMgle(p1, ['widoczne'], 100); // w połowie przyciemniania
  blisko(kryciePola(p2[0], 100).cien, 0.5, 'start z bieżącego cienia');
  assert.equal(kryciePola(p2[0], 100 + CZAS_PRZYCIEMNIENIA).cien, 0);
});

test('mgła: ograniczony ruch i tablica innego labiryntu → bez przejść', () => {
  const p0 = aktualizujMgle(null, ['nieodkryte'], 0);
  const p1 = aktualizujMgle(p0, ['widoczne'], 10, true);
  assert.deepEqual(kryciePola(p1[0], 10), { mgla: 0, cien: 0 });
  const inny = aktualizujMgle(p0, ['widoczne', 'widoczne', 'odkryte'], 10);
  assert.equal(inny.length, 3);
  assert.deepEqual(inny.map((p) => kryciePola(p, 10)), [
    { mgla: 0, cien: 0 }, { mgla: 0, cien: 0 }, { mgla: 0, cien: 1 },
  ]);
});

test('iskry: deterministyczne przy stałym rng, rozbiegają się i gasną po 500 ms', () => {
  const a = iskry(3, 4, mulberry32(9), 1000);
  const b = iskry(3, 4, mulberry32(9), 1000);
  assert.equal(a.length, 14);
  assert.deepEqual(a, b);
  const s0 = stanIskry(a[0], 1000);
  assert.deepEqual([s0.x, s0.y, s0.alfa], [3, 4, 1]);
  const s1 = stanIskry(a[0], 1000 + CZAS_ISKIER / 2);
  assert.ok(Math.hypot(s1.x - 3, s1.y - 4) > 0.4, 'iskra odleciała');
  blisko(s1.alfa, 0.5, 'krycie w połowie');
  assert.equal(stanIskry(a[0], 1000 + CZAS_ISKIER), null);
});

test('świetliki: 8–16 na polach żywopłotu, migoczą w zakresie 0,2–1', () => {
  for (const [n, m] of [[8, 8], [30, 30], [2, 2]]) {
    const pola = kafle(generujLabirynt(n, m, mulberry32(n)));
    const s = swietliki(pola, mulberry32(1));
    assert.ok(s.length >= 8 && s.length <= 16, `${n}×${m}: ${s.length}`);
    for (const sw of s) assert.ok(pola[sw.k].zywoplot, 'świetlik nad żywopłotem');
    for (let t = 0; t < 5000; t += 37) {
      const { dx, dy, alfa } = stanSwietlika(s[0], t);
      assert.ok(alfa >= 0.2 - 1e-9 && alfa <= 1 + 1e-9, `alfa ${alfa}`);
      assert.ok(Math.abs(dx) <= 1 && Math.abs(dy) <= 1, 'krąży w promieniu pola');
    }
  }
});

test('chmury: płyną w prawo i zawijają się na całej szerokości', () => {
  const c = chmury(1000, 600, mulberry32(2));
  assert.equal(c.length, 4);
  for (const ch of c) {
    for (let t = 0; t < 600000; t += 9973) {
      const { x, r } = pozycjaChmury(ch, t, 1000);
      assert.ok(x >= -r - 1e-6 && x <= 1000 + r + 1e-6, `x ${x} poza drogą`);
    }
    const a = pozycjaChmury(ch, 0, 1000).x;
    const b = pozycjaChmury(ch, 100, 1000).x;
    assert.ok(b > a || b < a - 500, 'ruch w prawo (albo zawinięcie)');
  }
});

test('liście: zawsze nad lasem po bokach planszy, nigdy nad planszą', () => {
  const plansza = { x: 300, y: 50, szer: 500, wys: 500 };
  const l = liscie(1100, 600, plansza, mulberry32(4));
  assert.equal(l.length, 5);
  for (const lisc of l) {
    for (let t = 0; t < 120000; t += 113) {
      const { x, y } = pozycjaLiscia(lisc, t, 600);
      assert.ok(x <= plansza.x - 6 || x >= plansza.x + plansza.szer + 6, `liść nad planszą: x=${x}`);
      assert.ok(x >= 6 && x <= 1094, `liść poza ekranem: x=${x}`);
      assert.ok(y >= -20 && y <= 620, `y=${y}`);
    }
  }
  assert.deepEqual(liscie(500, 600, { x: 10, y: 10, szer: 480, wys: 480 }, mulberry32(4)), [], 'wąskie pasy — bez liści');
  assert.equal(liscie(800, 600, null, mulberry32(4)).length, 5, 'ekran startowy — cała szerokość');
});

test('klucz, drzwi, wejście planszy, rozbłysk', () => {
  for (let t = 0; t < 4000; t += 50) {
    assert.ok(Math.abs(unoszenieKlucza(t)) <= 0.06 + 1e-9);
    const p = pulsDrzwi(t);
    assert.ok(p >= 0 && p <= 1);
  }
  assert.equal(blyskKlucza(3000), 0);
  blisko(blyskKlucza(3200), 0.5, 'błysk w połowie');
  assert.equal(blyskKlucza(3500), null);
  assert.deepEqual(wejsciePlanszy(1000, 1000), { alfa: 0, skala: 0.97 });
  assert.deepEqual(wejsciePlanszy(1000, 1000 + CZAS_WEJSCIA), { alfa: 1, skala: 1 });
  assert.deepEqual(rozblysk(0, 0), { promien: 0, alfa: 1 });
  assert.equal(rozblysk(0, CZAS_ROZBLYSKU), null);
});

test('animStatyczna: gracz na swoim polu, bez efektów', () => {
  const a = animStatyczna({ gracz: { x: 2, y: 5 } });
  assert.equal(a.ograniczony, true);
  assert.deepEqual(pozycjaGracza(a.ruch, 12345), { x: 2, y: 5 });
  assert.deepEqual([a.mgla, a.iskry, a.swietliki, a.wejscie, a.rozblysk], [null, [], [], null, null]);
});
