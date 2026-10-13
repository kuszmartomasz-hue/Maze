import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nowyPoziom, ruch, rozmiarPoziomu, stanDoZapisu, stanZZapisu,
  normalizujNick, wczytajNick, zapiszNick, KLUCZ_NICKU, RUCHY, MAX_BOK_ZAPISU,
} from '../src/game.js';
import { E, W, generujLabirynt } from '../src/maze.js';
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
  assert.deepEqual(d, { wersja: 2, poziom: 4, nowy: true });
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

test('zapis stanu: zwarty format — największa plansza mieści się w limicie bazy (64 KB)', () => {
  const s = nowyPoziom(1, Infinity, mulberry32(4));
  s.labirynt = generujLabirynt(MAX_BOK_ZAPISU, MAX_BOK_ZAPISU, mulberry32(4));
  s.gracz = { x: 0, y: 0 };
  s.klucz = { x: 1, y: 0 };
  s.wyjscie = { x: 2, y: 0 };
  s.odkryte = new Set(Array.from({ length: MAX_BOK_ZAPISU ** 2 }, (_, i) => i));
  const d = stanDoZapisu(s);
  assert.equal(d.wersja, 2);
  assert.equal(typeof d.przejscia, 'string');
  assert.equal(typeof d.odkryte, 'string');
  assert.ok(JSON.stringify({ stan: d }).length <= 60000, `zapis ma ${JSON.stringify(d).length} B`);
  const t = stanZZapisu(przezJson(d));
  assert.deepEqual(Array.from(t.labirynt.przejscia), Array.from(s.labirynt.przejscia));
  assert.equal(t.odkryte.size, MAX_BOK_ZAPISU ** 2);
});

test('zapis stanu: uszkodzone lub spreparowane dane → null', () => {
  const wzor = przezJson(stanDoZapisu(rozegrany(3, 11)));
  const zepsuty = (zmiana) => {
    const d = przezJson(wzor);
    zmiana(d);
    return stanZZapisu(d);
  };
  const maska = (d, i) => parseInt(d.przejscia[i], 16);
  const ustawMaske = (d, i, m) => { d.przejscia = d.przejscia.slice(0, i) + m.toString(16) + d.przejscia.slice(i + 1); };
  // komórka z przejściem na wschód — do psucia symetrii i spójności
  const i = [...wzor.przejscia].findIndex((c) => parseInt(c, 16) & E);
  const sasiad = i + 1;

  assert.equal(zepsuty((d) => { d.wersja = 1; }), null, 'stara wersja');
  assert.equal(zepsuty((d) => { d.poziom = 0; }), null, 'poziom 0');
  assert.equal(zepsuty((d) => { d.poziom = 501; }), null, 'poziom 501');
  assert.equal(zepsuty((d) => { d.poziom = 2.5; }), null, 'poziom ułamkowy');
  assert.equal(zepsuty((d) => { d.szerokosc = 1; }), null, 'szerokość 1');
  assert.equal(zepsuty((d) => { d.przejscia = d.przejscia.slice(1); }), null, 'za krótkie przejścia');
  assert.equal(zepsuty((d) => { d.przejscia = [...d.przejscia]; }), null, 'przejścia nie jako napis');
  assert.equal(zepsuty((d) => { d.przejscia = 'g' + d.przejscia.slice(1); }), null, 'znak spoza hex');
  assert.equal(zepsuty((d) => { d.przejscia = d.przejscia.toUpperCase(); }), null, 'wielkie litery hex');
  assert.equal(zepsuty((d) => { ustawMaske(d, 0, maska(d, 0) | 1); }), null, 'przejście poza siatkę (N z wiersza 0)');
  assert.equal(zepsuty((d) => { ustawMaske(d, sasiad, maska(d, sasiad) & ~W); }), null, 'przejście niesymetryczne');
  assert.equal(zepsuty((d) => { ustawMaske(d, i, maska(d, i) & ~E); ustawMaske(d, sasiad, maska(d, sasiad) & ~W); }), null, 'labirynt niespójny');
  assert.equal(zepsuty((d) => { d.gracz.x = wzor.szerokosc; }), null, 'gracz poza siatką');
  assert.equal(zepsuty((d) => { d.klucz = null; }), null, 'brak klucza');
  assert.equal(zepsuty((d) => { d.maKlucz = 'tak'; }), null, 'maKlucz nie boolean');
  assert.equal(zepsuty((d) => { d.odkryte = d.odkryte.slice(1); }), null, 'odkryte złej długości');
  assert.equal(zepsuty((d) => { d.odkryte = 'z' + d.odkryte.slice(1); }), null, 'odkryte spoza hex');
  assert.equal(zepsuty((d) => { d.odkryte = [0, 1]; }), null, 'odkryte jako tablica');
  for (const smiec of [null, undefined, 'abc', 42, [], {}]) assert.equal(stanZZapisu(smiec), null);
  assert.equal(stanZZapisu({ wersja: 2, poziom: 501, nowy: true }), null, 'nowy poziom > 500');
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
