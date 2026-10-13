import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nowyPoziom, ruch, rozmiarPoziomu, stanDoZapisu, stanZZapisu,
  normalizujNick, wczytajNick, zapiszNick, KLUCZ_NICKU, RUCHY,
} from '../src/game.js';
import { E, W } from '../src/maze.js';
import { mulberry32, pamiecStorage } from './helpers.js';

/** Stan po kilku ruchach (żeby odkryte i pozycja różniły się od startowych). */
function rozegrany(poziom, ziarno) {
  const s = nowyPoziom(poziom, 30, mulberry32(ziarno));
  for (let i = 0; i < 40; i++) ruch(s, Object.keys(RUCHY)[i % 4]);
  s.ukonczony = false;
  return s;
}

const przezJson = (o) => JSON.parse(JSON.stringify(o));

test('zapis stanu: wierne odtworzenie we mgle (poziom 3)', () => {
  const s = rozegrany(3, 11);
  const t = stanZZapisu(przezJson(stanDoZapisu(s)));
  assert.ok(t);
  assert.equal(t.poziom, 3);
  assert.equal(t.mgla, true);
  assert.deepEqual(Array.from(t.labirynt.przejscia), Array.from(s.labirynt.przejscia));
  assert.equal(t.labirynt.szerokosc, s.labirynt.szerokosc);
  assert.deepEqual(t.gracz, s.gracz);
  assert.deepEqual(t.klucz, s.klucz);
  assert.deepEqual(t.wyjscie, s.wyjscie);
  assert.equal(t.maKlucz, s.maKlucz);
  assert.equal(t.ukonczony, false);
  assert.deepEqual(t.odkryte, s.odkryte);
  assert.deepEqual(t.widoczne, s.widoczne);
});

test('zapis stanu: poziom bez mgły ma wszystko odkryte', () => {
  const s = rozegrany(1, 3);
  const t = stanZZapisu(przezJson(stanDoZapisu(s)));
  assert.equal(t.mgla, false);
  assert.equal(t.odkryte.size, t.labirynt.szerokosc * t.labirynt.wysokosc);
});

test('zapis stanu: ukończony poziom → nowy labirynt następnego poziomu', () => {
  const s = rozegrany(3, 5);
  s.ukonczony = true;
  const d = stanDoZapisu(s);
  assert.deepEqual(d, { wersja: 1, poziom: 4, nowy: true });
  const t = stanZZapisu(przezJson(d), 30, mulberry32(1));
  assert.equal(t.poziom, 4);
  assert.equal(t.mgla, true);
  assert.equal(t.labirynt.szerokosc, rozmiarPoziomu(4, 30));
});

test('zapis stanu: wznowiony labirynt zachowuje rozmiar mimo mniejszego limitu', () => {
  const s = rozegrany(10, 2);
  const t = stanZZapisu(przezJson(stanDoZapisu(s)), 8);
  assert.equal(t.labirynt.szerokosc, s.labirynt.szerokosc);
});

test('zapis stanu: uszkodzone lub spreparowane dane → null', () => {
  const wzor = przezJson(stanDoZapisu(rozegrany(3, 11)));
  const zepsuty = (zmiana) => {
    const d = przezJson(wzor);
    zmiana(d);
    return stanZZapisu(d);
  };
  const lab = { szerokosc: wzor.szerokosc, wysokosc: wzor.wysokosc };
  // komórka z przejściem na wschód — do psucia symetrii i spójności
  const i = wzor.przejscia.findIndex((m) => m & E);
  const sasiad = i + 1;

  assert.equal(zepsuty((d) => { d.wersja = 2; }), null, 'wersja');
  assert.equal(zepsuty((d) => { d.poziom = 0; }), null, 'poziom 0');
  assert.equal(zepsuty((d) => { d.poziom = 501; }), null, 'poziom 501');
  assert.equal(zepsuty((d) => { d.poziom = 2.5; }), null, 'poziom ułamkowy');
  assert.equal(zepsuty((d) => { d.szerokosc = 1; }), null, 'szerokość 1');
  assert.equal(zepsuty((d) => { d.przejscia.pop(); }), null, 'za krótkie przejścia');
  assert.equal(zepsuty((d) => { d.przejscia[0] = 16; }), null, 'maska spoza 0–15');
  assert.equal(zepsuty((d) => { d.przejscia[0] |= 1; }), null, 'przejście poza siatkę (N z wiersza 0)');
  assert.equal(zepsuty((d) => { d.przejscia[sasiad] &= ~W; }), null, 'przejście niesymetryczne');
  assert.equal(zepsuty((d) => { d.przejscia[i] &= ~E; d.przejscia[sasiad] &= ~W; }), null, 'labirynt niespójny');
  assert.equal(zepsuty((d) => { d.gracz.x = lab.szerokosc; }), null, 'gracz poza siatką');
  assert.equal(zepsuty((d) => { d.klucz = null; }), null, 'brak klucza');
  assert.equal(zepsuty((d) => { d.maKlucz = 'tak'; }), null, 'maKlucz nie boolean');
  assert.equal(zepsuty((d) => { d.odkryte = [-1]; }), null, 'odkryte poza zakresem');
  for (const smiec of [null, undefined, 'abc', 42, [], {}]) assert.equal(stanZZapisu(smiec), null);
  assert.equal(stanZZapisu({ wersja: 1, poziom: 501, nowy: true }), null, 'nowy poziom > 500');
});

test('nick: obcięcie spacji, limit 20 punktów kodowych, pusty → null', () => {
  assert.equal(normalizujNick('  Ania  '), 'Ania');
  assert.equal(normalizujNick('x'.repeat(25)), 'x'.repeat(20));
  assert.equal(normalizujNick('😀'.repeat(25)), '😀'.repeat(20));
  assert.equal(normalizujNick('a'.repeat(19) + ' b'), 'a'.repeat(19));
  assert.equal(normalizujNick('   '), null);
  assert.equal(normalizujNick(''), null);
  assert.equal(normalizujNick(null), null);
});

test('nick: zapis i odczyt z storage, brak storage nie psuje gry', () => {
  const st = pamiecStorage();
  assert.equal(wczytajNick(st), null);
  zapiszNick(st, 'Ania');
  assert.equal(st.dane[KLUCZ_NICKU], 'Ania');
  assert.equal(wczytajNick(st), 'Ania');
  zapiszNick(st, null);
  assert.equal(KLUCZ_NICKU in st.dane, false);
  const zepsuty = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  assert.equal(wczytajNick(zepsuty), null);
  assert.doesNotThrow(() => zapiszNick(zepsuty, 'Ania'));
  assert.equal(wczytajNick(null), null);
});
