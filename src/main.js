// Spięcie modułów, odświeżanie i przełączanie ekranów.
import { nowyPoziom, nowyLabirynt, ruch, limitRozmiaru, wczytajRekord, zapiszRekord } from './game.js';
import { dopasujCanvas, rysuj } from './render.js';
import { podlaczKlawiature } from './input.js';

const canvas = document.getElementById('plansza');
const obszar = document.getElementById('obszar');
const ekrany = {
  start: document.getElementById('ekran-start'),
  ukonczony: document.getElementById('ekran-ukonczony'),
};
const hud = document.getElementById('hud');
const hudPoziom = document.getElementById('hud-poziom');
const hudKlucz = document.getElementById('hud-klucz');
const hudMgla = document.getElementById('hud-mgla');
const hudKomunikat = document.getElementById('hud-komunikat');
const rekordEl = document.getElementById('rekord');
const ukonczonyTytul = document.getElementById('ukonczony-tytul');

const MARGINES = 8;

function pobierzStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
const storage = pobierzStorage();

let ekran = 'start';
let stan = null;
let ctx = null;
let wymiary = { w: 0, h: 0 };
let timerKomunikatu = 0;

function dopasuj() {
  const r = obszar.getBoundingClientRect();
  wymiary = { w: Math.max(1, Math.floor(r.width)), h: Math.max(1, Math.floor(r.height)) };
  ctx = dopasujCanvas(canvas, wymiary.w, wymiary.h, window.devicePixelRatio || 1);
  odswiez();
}

function limit() {
  return limitRozmiaru(wymiary.w - 2 * MARGINES, wymiary.h - 2 * MARGINES);
}

function odswiez() {
  if (!ctx) return;
  ctx.save();
  ctx.translate(MARGINES, MARGINES);
  rysuj(ctx, ekran === 'start' ? null : stan, wymiary.w - 2 * MARGINES, wymiary.h - 2 * MARGINES);
  ctx.restore();
  aktualizujHud();
}

function aktualizujHud() {
  // visibility zamiast display — HUD nie zmienia wysokości obszaru gry
  hud.classList.toggle('ukryty', ekran === 'start' || !stan);
  if (!stan) return;
  hudPoziom.textContent = `Poziom ${stan.poziom}`;
  hudKlucz.textContent = stan.maKlucz ? 'Klucz zdobyty' : 'Brak klucza';
  hudKlucz.classList.toggle('zdobyty', stan.maKlucz);
  hudMgla.hidden = !stan.mgla;
}

function komunikat(tekst) {
  hudKomunikat.textContent = tekst;
  clearTimeout(timerKomunikatu);
  timerKomunikatu = setTimeout(() => { hudKomunikat.textContent = ''; }, 1500);
}

function pokazEkran(nazwa) {
  ekran = nazwa;
  ekrany.start.hidden = nazwa !== 'start';
  ekrany.ukonczony.hidden = nazwa !== 'ukonczony';
  if (nazwa === 'start') rekordEl.textContent = `Najwyższy poziom: ${wczytajRekord(storage)}`;
  hudKomunikat.textContent = '';
  odswiez();
}

function rozpocznijPoziom(poziom) {
  stan = nowyPoziom(poziom, limit());
  pokazEkran('gra');
}

function obsluz(akcja, powtorzenie) {
  if (ekran === 'start') {
    if (akcja === 'potwierdz' && !powtorzenie) rozpocznijPoziom(1);
    return;
  }
  if (ekran === 'ukonczony') {
    if (akcja === 'potwierdz' && !powtorzenie) rozpocznijPoziom(stan.poziom + 1);
    else if (akcja === 'menu') {
      stan = null;
      pokazEkran('start');
    }
    return;
  }
  // ekran gry
  switch (akcja) {
    case 'menu':
      stan = null;
      pokazEkran('start');
      return;
    case 'nowy':
      if (powtorzenie) return;
      nowyLabirynt(stan);
      hudKomunikat.textContent = '';
      break;
    case 'gora':
    case 'dol':
    case 'lewo':
    case 'prawo': {
      const zdarzenie = ruch(stan, akcja);
      if (zdarzenie === 'klucz') komunikat('Klucz zdobyty!');
      else if (zdarzenie === 'zamkniete') komunikat('Potrzebujesz klucza');
      else if (zdarzenie === 'ukonczony') {
        zapiszRekord(storage, stan.poziom);
        ukonczonyTytul.textContent = `Poziom ${stan.poziom} ukończony`;
        pokazEkran('ukonczony');
        return;
      }
      break;
    }
    default:
      return;
  }
  odswiez();
}

podlaczKlawiature(window, obsluz);
window.addEventListener('resize', dopasuj);
new ResizeObserver(dopasuj).observe(obszar);
dopasuj();
pokazEkran('start');
