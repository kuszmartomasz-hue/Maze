// Rysowanie stanu gry na canvasie: las, polana ze żwiru, żywopłot, mgła, przedmioty.
import { indeks } from './maze.js';
import { uklad, pas, kafle, stanPola } from './uklad.js';

const KOLORY = {
  las: '#0d1410',
  zwir: '#b8a27f',
  zywoplot: '#2f4a2a',
  cien: 'rgba(0, 0, 0, 0.6)',
  mgla: '#07090d',
  przyciemnienie: 'rgba(7, 9, 13, 0.55)',
  obrys: '#0b0d10',
  gracz: '#4fc3ff',
  klucz: '#ffd23f',
  drzwiZamkniete: '#ff6b6b',
  drzwiOtwarte: '#5ee08a',
};

/** Ile komórek (ścieżka + pas żywopłotu) obejmuje jeden kafel tekstury żwiru i żywopłotu. */
const KOMOREK_NA_KAFEL = 3;
/** Bok kafla tekstury lasu w px CSS — stały, żeby tło nie zmieniało skali między poziomami. */
const KAFEL_LASU_PX = 256;

const gruboscObrysu = (kom) => Math.max(1, kom * 0.06);

/** Ustawia rozmiar canvasu pod okno z uwzględnieniem devicePixelRatio. Zwraca kontekst 2D. */
export function dopasujCanvas(canvas, szerokoscCss, wysokoscCss, dpr) {
  canvas.style.width = `${szerokoscCss}px`;
  canvas.style.height = `${wysokoscCss}px`;
  canvas.width = Math.round(szerokoscCss * dpr);
  canvas.height = Math.round(wysokoscCss * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** Wzór z tekstury, w którym jeden kafel ma `bokPx`; bez tekstury — kolor zastępczy. */
function wypelnienie(ctx, obraz, bokPx, kolor) {
  if (!obraz) return kolor;
  const wzor = ctx.createPattern(obraz, 'repeat');
  const skala = bokPx / obraz.width;
  wzor.setTransform({ a: skala, b: 0, c: 0, d: skala, e: 0, f: 0 });
  return wzor;
}

/** Las na całym obszarze — tło pod planszą i ekranami. */
export function rysujTlo(ctx, szerokoscCss, wysokoscCss, tekstury) {
  ctx.fillStyle = wypelnienie(ctx, tekstury.las, KAFEL_LASU_PX, KOLORY.las);
  ctx.fillRect(0, 0, szerokoscCss, wysokoscCss);
}

export function rysuj(ctx, stan, szerokoscCss, wysokoscCss, tekstury) {
  if (!stan) return;

  const { labirynt, odkryte, widoczne } = stan;
  const u = uklad(labirynt, szerokoscCss, wysokoscCss);
  const bokKafla = KOMOREK_NA_KAFEL * (u.kom + u.sc);
  const komX = (x) => pas(u, 2 * x + 1, u.ox).start;
  const komY = (y) => pas(u, 2 * y + 1, u.oy).start;
  const pola = kafle(labirynt);
  const prostokat = (p) => {
    const a = pas(u, p.gx, u.ox);
    const b = pas(u, p.gy, u.oy);
    return [a.start, b.start, a.dl, b.dl];
  };
  const wypelnijPola = (warunek, styl) => {
    ctx.beginPath();
    for (let k = 0; k < pola.length; k++) if (warunek(k)) ctx.rect(...prostokat(pola[k]));
    ctx.fillStyle = styl;
    ctx.fill();
  };

  // Polana: żwir pod całą planszą, z miękkim cieniem na las
  ctx.save();
  ctx.shadowColor = KOLORY.cien;
  ctx.shadowBlur = Math.max(8, u.sc * 2);
  ctx.fillStyle = wypelnienie(ctx, tekstury.zwir, bokKafla, KOLORY.zwir);
  ctx.fillRect(u.ox, u.oy, u.szer, u.wys);
  ctx.restore();

  // Żywopłot
  wypelnijPola((k) => pola[k].zywoplot, wypelnienie(ctx, tekstury.zywoplot, bokKafla, KOLORY.zywoplot));

  // Drzwi i klucz — tylko na odkrytych polach
  const odkrytePole = (p) => odkryte.has(indeks(labirynt, p.x, p.y));
  if (odkrytePole(stan.wyjscie)) rysujDrzwi(ctx, komX(stan.wyjscie.x), komY(stan.wyjscie.y), u.kom, stan.maKlucz);
  if (!stan.maKlucz && odkrytePole(stan.klucz)) rysujKlucz(ctx, komX(stan.klucz.x), komY(stan.klucz.y), u.kom);

  // Mgła: nieodkryte pola zakryte, odkryte poza zasięgiem przyciemnione (żywopłot też)
  const stany = pola.map((p) => stanPola(p.sasiedzi, odkryte, widoczne));
  wypelnijPola((k) => stany[k] === 'nieodkryte', KOLORY.mgla);
  wypelnijPola((k) => stany[k] === 'odkryte', KOLORY.przyciemnienie);

  // Gracz — koło z obrysem
  const g = stan.gracz;
  ctx.beginPath();
  ctx.arc(komX(g.x) + u.kom / 2, komY(g.y) + u.kom / 2, u.kom * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = KOLORY.gracz;
  ctx.fill();
  ctx.lineWidth = gruboscObrysu(u.kom);
  ctx.strokeStyle = KOLORY.obrys;
  ctx.stroke();
}

/** Klucz: kółko (główka) + trzon z ząbkami, z ciemnym obrysem pod spodem. */
function rysujKlucz(ctx, x, y, kom) {
  const s = kom;
  const cy = y + s / 2;
  const linia = Math.max(1.5, s * 0.1);
  ctx.beginPath();
  ctx.arc(x + s * 0.32, cy, s * 0.14, 0, Math.PI * 2);
  ctx.moveTo(x + s * 0.46, cy);
  ctx.lineTo(x + s * 0.8, cy);
  ctx.moveTo(x + s * 0.7, cy);
  ctx.lineTo(x + s * 0.7, cy + s * 0.14);
  ctx.moveTo(x + s * 0.8, cy);
  ctx.lineTo(x + s * 0.8, cy + s * 0.14);
  ctx.lineCap = 'round';
  ctx.strokeStyle = KOLORY.obrys;
  ctx.lineWidth = linia + 2 * gruboscObrysu(s);
  ctx.stroke();
  ctx.strokeStyle = KOLORY.klucz;
  ctx.lineWidth = linia;
  ctx.stroke();
}

/** Drzwi: zamknięte = pełny prostokąt z dziurką od klucza; otwarte = pusta rama z otwartym skrzydłem. Z obrysem. */
function rysujDrzwi(ctx, x, y, kom, otwarte) {
  const s = kom;
  const l = x + s * 0.22;
  const t = y + s * 0.14;
  const w = s * 0.56;
  const h = s * 0.72;
  const rama = Math.max(1.5, s * 0.08);
  const obrys = gruboscObrysu(s);
  if (!otwarte) {
    ctx.fillStyle = KOLORY.drzwiZamkniete;
    ctx.fillRect(l, t, w, h);
    ctx.lineWidth = obrys;
    ctx.strokeStyle = KOLORY.obrys;
    ctx.strokeRect(l, t, w, h);
    ctx.fillStyle = KOLORY.mgla;
    ctx.beginPath();
    ctx.arc(l + w / 2, t + h * 0.45, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(l + w / 2 - s * 0.03, t + h * 0.45, s * 0.06, h * 0.25);
  } else {
    ctx.strokeStyle = KOLORY.obrys;
    ctx.lineWidth = rama + 2 * obrys;
    ctx.strokeRect(l, t, w, h);
    ctx.strokeStyle = KOLORY.drzwiOtwarte;
    ctx.lineWidth = rama;
    ctx.strokeRect(l, t, w, h);
    ctx.beginPath();
    ctx.moveTo(l, t);
    ctx.lineTo(l + w * 0.45, t + h * 0.12);
    ctx.lineTo(l + w * 0.45, t + h * 0.88);
    ctx.lineTo(l, t + h);
    ctx.closePath();
    ctx.fillStyle = KOLORY.drzwiOtwarte;
    ctx.fill();
    ctx.lineWidth = obrys;
    ctx.strokeStyle = KOLORY.obrys;
    ctx.stroke();
  }
}
