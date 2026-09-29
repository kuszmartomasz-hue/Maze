// Rysowanie stanu gry na canvasie.
import { N, E, S, W, indeks } from './maze.js';

const KOLORY = {
  tlo: '#10131a',
  podloga: '#1b2130',
  mgla: '#07090d',
  przyciemnienie: 'rgba(7, 9, 13, 0.55)',
  sciana: '#c9d4e8',
  scianaPrzygaszona: '#5d6679',
  gracz: '#4fc3ff',
  klucz: '#ffd23f',
  drzwiZamkniete: '#ff6b6b',
  drzwiOtwarte: '#5ee08a',
};

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

export function rysuj(ctx, stan, szerokoscCss, wysokoscCss) {
  ctx.fillStyle = KOLORY.tlo;
  ctx.fillRect(0, 0, szerokoscCss, wysokoscCss);
  if (!stan) return;

  const { labirynt, odkryte, widoczne } = stan;
  const kom = Math.floor(Math.min(szerokoscCss / labirynt.szerokosc, wysokoscCss / labirynt.wysokosc));
  const ox = Math.floor((szerokoscCss - kom * labirynt.szerokosc) / 2);
  const oy = Math.floor((wysokoscCss - kom * labirynt.wysokosc) / 2);
  const px = (x) => ox + x * kom;
  const py = (y) => oy + y * kom;

  // Podłoga i mgła
  for (let y = 0; y < labirynt.wysokosc; y++) {
    for (let x = 0; x < labirynt.szerokosc; x++) {
      const i = indeks(labirynt, x, y);
      ctx.fillStyle = odkryte.has(i) ? KOLORY.podloga : KOLORY.mgla;
      ctx.fillRect(px(x), py(y), kom, kom);
    }
  }

  const odkrytePole = (p) => odkryte.has(indeks(labirynt, p.x, p.y));
  if (odkrytePole(stan.wyjscie)) rysujDrzwi(ctx, px(stan.wyjscie.x), py(stan.wyjscie.y), kom, stan.maKlucz);
  if (!stan.maKlucz && odkrytePole(stan.klucz)) rysujKlucz(ctx, px(stan.klucz.x), py(stan.klucz.y), kom);

  // Przyciemnienie odkrytych, ale obecnie niewidocznych (podłoga, klucz, drzwi)
  ctx.fillStyle = KOLORY.przyciemnienie;
  for (const i of odkryte) {
    if (widoczne.has(i)) continue;
    const x = i % labirynt.szerokosc;
    const y = Math.floor(i / labirynt.szerokosc);
    ctx.fillRect(px(x), py(y), kom, kom);
  }

  // Ściany — ostre linie: wyrównanie do połówek piksela przy nieparzystej grubości.
  // Najpierw przygaszone ściany komórek poza zasięgiem, potem jasne ściany widocznych.
  const grubosc = Math.max(1, Math.round(kom / 10));
  const przes = grubosc % 2 === 1 ? 0.5 : 0;
  ctx.lineWidth = grubosc;
  ctx.lineCap = 'square';
  const rysujSciany = (komorki, kolor) => {
    ctx.beginPath();
    for (const i of komorki) {
      const x = i % labirynt.szerokosc;
      const y = Math.floor(i / labirynt.szerokosc);
      const m = labirynt.przejscia[i];
      const x0 = px(x) + przes;
      const y0 = py(y) + przes;
      const x1 = x0 + kom;
      const y1 = y0 + kom;
      if (!(m & N)) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); }
      if (!(m & S)) { ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); }
      if (!(m & W)) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); }
      if (!(m & E)) { ctx.moveTo(x1, y0); ctx.lineTo(x1, y1); }
    }
    ctx.strokeStyle = kolor;
    ctx.stroke();
  };
  rysujSciany([...odkryte].filter((i) => !widoczne.has(i)), KOLORY.scianaPrzygaszona);
  rysujSciany(widoczne, KOLORY.sciana);

  // Gracz — koło
  const g = stan.gracz;
  ctx.fillStyle = KOLORY.gracz;
  ctx.beginPath();
  ctx.arc(px(g.x) + kom / 2, py(g.y) + kom / 2, kom * 0.32, 0, Math.PI * 2);
  ctx.fill();
}

/** Klucz: kółko (główka) + trzon z ząbkami. */
function rysujKlucz(ctx, x, y, kom) {
  const s = kom;
  ctx.strokeStyle = KOLORY.klucz;
  ctx.fillStyle = KOLORY.klucz;
  ctx.lineWidth = Math.max(1.5, s * 0.1);
  ctx.lineCap = 'round';
  const cy = y + s / 2;
  ctx.beginPath();
  ctx.arc(x + s * 0.32, cy, s * 0.14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + s * 0.46, cy);
  ctx.lineTo(x + s * 0.8, cy);
  ctx.moveTo(x + s * 0.7, cy);
  ctx.lineTo(x + s * 0.7, cy + s * 0.14);
  ctx.moveTo(x + s * 0.8, cy);
  ctx.lineTo(x + s * 0.8, cy + s * 0.14);
  ctx.stroke();
}

/** Drzwi: zamknięte = pełny prostokąt z dziurką od klucza; otwarte = pusta rama z otwartym skrzydłem. */
function rysujDrzwi(ctx, x, y, kom, otwarte) {
  const s = kom;
  const l = x + s * 0.22;
  const t = y + s * 0.14;
  const w = s * 0.56;
  const h = s * 0.72;
  ctx.lineWidth = Math.max(1.5, s * 0.08);
  if (!otwarte) {
    ctx.fillStyle = KOLORY.drzwiZamkniete;
    ctx.fillRect(l, t, w, h);
    ctx.fillStyle = KOLORY.mgla;
    ctx.beginPath();
    ctx.arc(l + w / 2, t + h * 0.45, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(l + w / 2 - s * 0.03, t + h * 0.45, s * 0.06, h * 0.25);
  } else {
    ctx.strokeStyle = KOLORY.drzwiOtwarte;
    ctx.strokeRect(l, t, w, h);
    ctx.fillStyle = KOLORY.drzwiOtwarte;
    ctx.beginPath();
    ctx.moveTo(l, t);
    ctx.lineTo(l + w * 0.45, t + h * 0.12);
    ctx.lineTo(l + w * 0.45, t + h * 0.88);
    ctx.lineTo(l, t + h);
    ctx.closePath();
    ctx.fill();
  }
}
