// Spięcie modułów, odświeżanie i przełączanie ekranów.
import {
  nowyPoziom, nowyLabirynt, ruch, limitRozmiaru, wczytajRekord, zapiszRekord, RUCHY,
  stanDoZapisu, stanZZapisu, normalizujNick, wczytajNick, zapiszNick,
} from './game.js';
import { utworzBaze } from './baza.js';
import {
  dopasujCanvas, rysujTlo, rysujPlansze, rysujKlatke, rysujTloAnimowane, polaPlanszy, stanyPol,
} from './render.js';
import { uklad } from './uklad.js';
import {
  ruchStaly, nowyRuch, odbicie, aktualizujMgle, iskry, swietliki, chmury, liscie, wejsciePlanszy, CZAS_ROZBLYSKU,
} from './animacje.js';
import { wczytajTekstury, BEZ_TEKSTUR } from './tekstury.js';
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
const poleNicku = document.getElementById('nick');
const nickUwaga = document.getElementById('nick-uwaga');
const akcjaStart = document.getElementById('akcja-start');
const akcjaWznow = document.getElementById('akcja-wznow');
const akcjaCzekaj = document.getElementById('akcja-czekaj');
const wznowPoziom = document.getElementById('wznow-poziom');
const rankingStatus = document.getElementById('ranking-status');
const rankingLista = document.getElementById('ranking-lista');
const rankingJa = document.getElementById('ranking-ja');

const MARGINES = 8;

function pobierzStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
const storage = pobierzStorage();
const baza = utworzBaze({ storage });
/** Zapis po ruchu najwyżej raz na tyle ms. */
const ODSTEP_ZAPISU_MS = 3000;

let ekran = 'start';
let stan = null;
let ctx = null;
let wymiary = { w: 0, h: 0 };
let timerKomunikatu = 0;
let tekstury = BEZ_TEKSTUR;
let zapis = null; // przerwana gra (dane JSON) — z bazy albo z ostatniego zapisu w tej karcie
let timerZapisu = 0;
let ostatniZapis = 0;
let zapisSprawdzony = false; // odczyt zapisu z bazy zakończony (także błędem)
let czekaNaZapis = false; // Enter wciśnięty przed końcem odczytu — start po odczycie

const ograniczonyRuch = window.matchMedia('(prefers-reduced-motion: reduce)');
let anim = null; // stan animacji bieżącego labiryntu (animacje.js)
let tlo = { chmury: [], liscie: [] }; // cienie chmur i liście nad lasem
let warstwa = null; // statyczna plansza w pamięci: { canvas, labirynt, w, h, dpr, tekstury }
let blokada = false; // rozbłysk po ukończeniu poziomu — klawisze ignorowane
let petlaDziala = false;

function dopasuj() {
  const r = obszar.getBoundingClientRect();
  wymiary = { w: Math.max(1, Math.floor(r.width)), h: Math.max(1, Math.floor(r.height)) };
  ctx = dopasujCanvas(canvas, wymiary.w, wymiary.h, window.devicePixelRatio || 1);
  tlo.chmury = ograniczony() ? [] : chmury(wymiary.w, wymiary.h, Math.random);
  odswiezLiscie();
  odswiez();
}

function limit() {
  return limitRozmiaru(wymiary.w - 2 * MARGINES, wymiary.h - 2 * MARGINES);
}

const teraz = () => performance.now();
const ograniczony = () => ograniczonyRuch.matches;
const obszarGry = () => ({ w: wymiary.w - 2 * MARGINES, h: wymiary.h - 2 * MARGINES });

/** Nowy stan animacji dla bieżącego labiryntu (nowy poziom, `R`, wznowienie). */
function nowaAnimacja() {
  const czas = teraz();
  const ogr = ograniczony();
  anim = {
    ograniczony: ogr,
    ruch: ruchStaly(stan.gracz),
    mgla: aktualizujMgle(null, stanyPol(stan), czas),
    iskry: [],
    swietliki: ogr ? [] : swietliki(polaPlanszy(stan.labirynt), Math.random),
    wejscie: ogr ? null : czas,
    rozblysk: null,
  };
}

/** Liście tylko w pasach lasu obok planszy (na ekranie startowym — na całej szerokości). */
function odswiezLiscie() {
  if (ograniczony()) {
    tlo.liscie = [];
    return;
  }
  let plansza = null;
  if (stan) {
    const { w, h } = obszarGry();
    const u = uklad(stan.labirynt, w, h);
    plansza = { x: MARGINES + u.ox, y: MARGINES + u.oy, szer: u.szer, wys: u.wys };
  }
  tlo.liscie = liscie(wymiary.w, wymiary.h, plansza, Math.random);
}

/** Statyczna plansza (cień, żwir, żywopłot) w pamięci — przebudowa tylko po zmianie labiryntu, rozmiaru lub tekstur. */
function warstwaPlanszy() {
  const dpr = window.devicePixelRatio || 1;
  const { w, h } = obszarGry();
  const aktualna = warstwa && warstwa.labirynt === stan.labirynt && warstwa.w === w && warstwa.h === h
    && warstwa.dpr === dpr && warstwa.tekstury === tekstury;
  if (aktualna) return warstwa.canvas;
  const c = warstwa?.canvas ?? document.createElement('canvas');
  const wctx = dopasujCanvas(c, w, h, dpr);
  wctx.clearRect(0, 0, w, h);
  rysujPlansze(wctx, stan, w, h, tekstury);
  warstwa = { canvas: c, labirynt: stan.labirynt, w, h, dpr, tekstury };
  return c;
}

/** Jedna klatka: las, cienie chmur i liście, plansza z warstwy w pamięci i jej ruchoma część. */
function klatka(czas) {
  if (!ctx) return;
  rysujTlo(ctx, wymiary.w, wymiary.h, tekstury);
  if (!ograniczony()) rysujTloAnimowane(ctx, wymiary.w, wymiary.h, tlo.chmury, tlo.liscie, czas);
  if (!stan || !anim || ekran === 'start') return;
  const { w, h } = obszarGry();
  ctx.save();
  ctx.translate(MARGINES, MARGINES);
  if (anim.wejscie != null) {
    const { alfa, skala } = wejsciePlanszy(anim.wejscie, czas);
    ctx.globalAlpha = alfa;
    ctx.translate(w / 2, h / 2);
    ctx.scale(skala, skala);
    ctx.translate(-w / 2, -h / 2);
  }
  ctx.drawImage(warstwaPlanszy(), 0, 0, w, h);
  rysujKlatke(ctx, stan, w, h, anim, czas);
  ctx.restore();
}

function petla(czas) {
  if (ograniczony()) {
    petlaDziala = false;
    klatka(czas);
    return;
  }
  klatka(czas);
  requestAnimationFrame(petla);
}

/** Bez ograniczonego ruchu klatki rysuje pętla; przy ograniczonym — jedna klatka po każdym zdarzeniu. */
function odswiez() {
  if (!ctx) return;
  if (ograniczony()) klatka(teraz());
  else if (!petlaDziala) {
    petlaDziala = true;
    requestAnimationFrame(petla);
  }
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

const nick = () => normalizujNick(poleNicku.value);

function aktualizujNick() {
  zapiszNick(storage, nick());
  nickUwaga.hidden = Boolean(nick());
}

function pokazAkcjeStartu() {
  akcjaStart.hidden = Boolean(zapis);
  akcjaWznow.hidden = !zapis;
  if (zapis) wznowPoziom.textContent = `poziom ${zapis.poziom}`;
}

/** Zapis stanu gry do bazy: od razu albo najwyżej raz na ODSTEP_ZAPISU_MS (wysyłany jest najświeższy stan). */
function zapiszStanGry({ odrazu = false, keepalive = false } = {}) {
  if (!stan) return;
  zapis = stanDoZapisu(stan);
  clearTimeout(timerZapisu);
  const wyslij = () => {
    ostatniZapis = Date.now();
    baza.zapiszStan(zapis, { keepalive });
  };
  const czekaj = ostatniZapis + ODSTEP_ZAPISU_MS - Date.now();
  if (odrazu || czekaj <= 0) wyslij();
  else timerZapisu = setTimeout(wyslij, czekaj);
}

/** Przerwana gra z bazy; uszkodzony zapis jest ignorowany. */
async function wczytajZapis() {
  const dane = await baza.wczytajStan();
  // w tej karcie już zagrano — lokalny zapis jest świeższy
  if (!zapis) zapis = dane && stanZZapisu(dane, limit()) ? dane : null;
  zapisSprawdzony = true;
  akcjaCzekaj.hidden = true;
  if (ekran !== 'start') return;
  pokazAkcjeStartu();
  if (czekaNaZapis) potwierdzStart();
}

/** Enter na ekranie startowym: kontynuacja albo nowa gra — dopiero gdy wiadomo, czy jest zapis. */
function potwierdzStart() {
  aktualizujNick();
  poleNicku.blur();
  if (!zapisSprawdzony) {
    czekaNaZapis = true;
    akcjaStart.hidden = true;
    akcjaCzekaj.hidden = false;
    return;
  }
  czekaNaZapis = false;
  if (zapis) wznow();
  else nowaGra();
}

function wierszRankingu(miejsce, w, mojId) {
  const li = document.createElement('li');
  li.classList.toggle('ja', w.user_id === mojId);
  for (const [klasa, tekst] of [['miejsce', `${miejsce}.`], ['nick', w.nick], ['poziom', String(w.poziom)]]) {
    const el = document.createElement('span');
    el.className = klasa;
    el.textContent = tekst; // nicki od innych graczy — nigdy innerHTML
    li.append(el);
  }
  return li;
}

async function odswiezRanking() {
  rankingStatus.textContent = 'Wczytywanie…';
  rankingStatus.hidden = false;
  const [top, ja, s] = await Promise.all([baza.pobierzTop10(), baza.mojeMiejsce(), baza.sesja()]);
  rankingLista.replaceChildren();
  rankingLista.hidden = true;
  rankingJa.hidden = true;
  if (!top) {
    rankingStatus.textContent = 'Tabela wyników chwilowo niedostępna';
    return;
  }
  if (top.length === 0) {
    rankingStatus.textContent = 'Nikt jeszcze nie ukończył poziomu — bądź pierwszy!';
    return;
  }
  rankingStatus.hidden = true;
  top.forEach((w, i) => rankingLista.append(wierszRankingu(i + 1, w, s?.user_id)));
  rankingLista.hidden = false;
  if (ja && ja.miejsce > top.length) {
    rankingJa.textContent = `Ty: ${ja.miejsce}. miejsce, poziom ${ja.poziom}`;
    rankingJa.hidden = false;
  }
}

function pokazEkran(nazwa) {
  ekran = nazwa;
  ekrany.start.hidden = nazwa !== 'start';
  ekrany.ukonczony.hidden = nazwa !== 'ukonczony';
  if (nazwa === 'start') {
    rekordEl.textContent = `Najwyższy poziom: ${wczytajRekord(storage)}`;
    pokazAkcjeStartu();
    odswiezRanking();
    if (!nick()) poleNicku.focus(); // pisanie nicku od razu trafia do pola, a nie w skróty gry
  }
  hudKomunikat.textContent = '';
  odswiezLiscie();
  odswiez();
}

function rozpocznijPoziom(poziom) {
  stan = nowyPoziom(poziom, limit());
  nowaAnimacja();
  pokazEkran('gra');
  zapiszStanGry({ odrazu: true });
}

/** Nowa gra od poziomu 1 — nowy zapis nadpisuje poprzedni (upsert), bez osobnego usuwania. */
function nowaGra() {
  czekaNaZapis = false;
  clearTimeout(timerZapisu);
  rozpocznijPoziom(1);
}

function wznow() {
  const odtworzony = stanZZapisu(zapis, limit());
  if (!odtworzony) {
    nowaGra();
    return;
  }
  stan = odtworzony;
  nowaAnimacja();
  pokazEkran('gra');
  zapiszStanGry({ odrazu: true }); // dla { nowy: true } utrwala wylosowany labirynt
}

/** Rozbłysk przy drzwiach, potem ekran „ukończony”; przy ograniczonym ruchu od razu. */
function zakonczPoziom(czas) {
  if (anim.ograniczony) {
    pokazEkran('ukonczony');
    return;
  }
  anim.rozblysk = czas;
  blokada = true;
  aktualizujHud();
  setTimeout(() => {
    blokada = false;
    pokazEkran('ukonczony');
  }, CZAS_ROZBLYSKU);
}

function obsluz(akcja, powtorzenie) {
  if (blokada) return;
  if (ekran === 'start') {
    if (powtorzenie) return;
    if (akcja === 'potwierdz') {
      potwierdzStart();
    } else if (akcja === 'nowaGra') {
      nowaGra();
    }
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
      zapiszStanGry({ odrazu: true });
      stan = null;
      pokazEkran('start');
      return;
    case 'nowy':
      if (powtorzenie) return;
      nowyLabirynt(stan);
      nowaAnimacja();
      hudKomunikat.textContent = '';
      zapiszStanGry({ odrazu: true });
      break;
    case 'gora':
    case 'dol':
    case 'lewo':
    case 'prawo': {
      const zdarzenie = ruch(stan, akcja);
      const czas = teraz();
      if (zdarzenie === 'sciana') anim.ruch = odbicie(anim.ruch, RUCHY[akcja], czas, anim.ograniczony);
      else anim.ruch = nowyRuch(anim.ruch, stan.gracz, czas, anim.ograniczony);
      anim.mgla = aktualizujMgle(anim.mgla, stanyPol(stan), czas, anim.ograniczony);
      if (zdarzenie === 'klucz') {
        if (!anim.ograniczony) anim.iskry = iskry(stan.klucz.x, stan.klucz.y, Math.random, czas);
        komunikat('Klucz zdobyty!');
        zapiszStanGry({ odrazu: true });
      } else if (zdarzenie === 'zamkniete') {
        komunikat('Potrzebujesz klucza');
      } else if (zdarzenie === 'ukonczony') {
        // zapisy od razu, nie po animacji
        zapiszRekord(storage, stan.poziom);
        if (nick()) baza.zapiszWynik(nick(), stan.poziom);
        zapiszStanGry({ odrazu: true }); // zapis wskazuje następny poziom
        ukonczonyTytul.textContent = `Poziom ${stan.poziom} ukończony`;
        zakonczPoziom(czas);
        return;
      } else if (zdarzenie === 'ruch') {
        zapiszStanGry();
      }
      break;
    }
    default:
      return;
  }
  odswiez();
}

poleNicku.value = wczytajNick(storage) ?? '';
nickUwaga.hidden = Boolean(nick());
poleNicku.addEventListener('input', () => { nickUwaga.hidden = Boolean(nick()); });
poleNicku.addEventListener('change', aktualizujNick);

podlaczKlawiature(window, obsluz);
window.addEventListener('resize', dopasuj);
new ResizeObserver(dopasuj).observe(obszar);
// Zmiana ustawienia systemowego w trakcie gry — nowy stan animacji i tło zgodne z ustawieniem.
ograniczonyRuch.addEventListener('change', () => {
  if (stan) nowaAnimacja();
  dopasuj();
});
// Zamknięcie karty w trakcie gry — ostatni zapis z keepalive, żeby żądanie przeżyło stronę.
window.addEventListener('pagehide', () => {
  if (stan && ekran === 'gra') zapiszStanGry({ odrazu: true, keepalive: true });
});
dopasuj();
pokazEkran('start');
wczytajZapis();
// Tekstury dochodzą w tle; do tego czasu (i przy błędzie) renderer używa kolorów zastępczych.
wczytajTekstury().then((wczytane) => {
  tekstury = wczytane;
  odswiez();
});
