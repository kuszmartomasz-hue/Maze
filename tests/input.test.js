import { test } from 'node:test';
import assert from 'node:assert/strict';
import { podlaczKlawiature } from '../src/input.js';

function przygotuj() {
  let sluchacz = null;
  const akcje = [];
  podlaczKlawiature({ addEventListener: (_, f) => { sluchacz = f; } }, (a, powt) => akcje.push([a, powt]));
  const nacisnij = (code, target = { tagName: 'BODY' }) => {
    const e = { code, target, repeat: false, ctrlKey: false, metaKey: false, altKey: false, zablokowany: false };
    e.preventDefault = () => { e.zablokowany = true; };
    sluchacz(e);
    return e;
  };
  return { akcje, nacisnij };
}

test('klawiatura: N → nowa gra, Escape poza polem → menu', () => {
  const { akcje, nacisnij } = przygotuj();
  nacisnij('KeyN');
  nacisnij('Escape');
  nacisnij('KeyW');
  assert.deepEqual(akcje, [['nowaGra', false], ['menu', false], ['gora', false]]);
});

test('klawiatura: w polu nicku litery i spacja piszą, nie sterują grą', () => {
  const { akcje, nacisnij } = przygotuj();
  const pole = { tagName: 'INPUT', blur() { this.rozmyte = true; } };
  for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyN', 'Space', 'ArrowUp']) {
    const e = nacisnij(code, pole);
    assert.equal(e.zablokowany, false, `${code} nie może blokować pisania`);
  }
  assert.deepEqual(akcje, []);
});

test('klawiatura: w polu nicku Enter zatwierdza, Escape tylko opuszcza pole', () => {
  const { akcje, nacisnij } = przygotuj();
  const pole = { tagName: 'INPUT', rozmyte: false, blur() { this.rozmyte = true; } };
  nacisnij('Enter', pole);
  nacisnij('NumpadEnter', pole);
  nacisnij('Escape', pole);
  assert.deepEqual(akcje, [['potwierdz', false], ['potwierdz', false]]);
  assert.equal(pole.rozmyte, true);
});
