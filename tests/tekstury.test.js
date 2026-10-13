import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wczytajTekstury, PLIKI, BEZ_TEKSTUR } from '../src/tekstury.js';

/** Atrapa Image: po ustawieniu src asynchronicznie woła onload albo onerror. */
function atrapaObrazu(czyUdany) {
  return () => {
    const obraz = {
      onload: null,
      onerror: null,
      set src(v) {
        this._src = v;
        queueMicrotask(() => (czyUdany(v) ? this.onload() : this.onerror()));
      },
      get src() { return this._src; },
    };
    return obraz;
  };
}

test('tekstury: wszystkie wczytane, ścieżki względne', async () => {
  const t = await wczytajTekstury(PLIKI, atrapaObrazu(() => true));
  assert.deepEqual(Object.keys(t).sort(), ['las', 'zwir', 'zywoplot']);
  for (const [nazwa, sciezka] of Object.entries(PLIKI)) {
    assert.equal(t[nazwa].src, sciezka);
    assert.ok(!sciezka.startsWith('/'), 'ścieżka musi być względna (GitHub Pages)');
  }
});

test('tekstury: błąd wczytania daje null, reszta działa, Promise nie jest odrzucany', async () => {
  const t = await wczytajTekstury(PLIKI, atrapaObrazu((src) => !src.includes('las')));
  assert.equal(t.las, null);
  assert.ok(t.zywoplot && t.zwir);
  assert.deepEqual(BEZ_TEKSTUR, { zywoplot: null, zwir: null, las: null });
});
