// Rysowanie gry na canvasie: las (z cieniami chmur i liśćmi), polana ze żwiru, żywopłot,
// mgła z przejściami, przedmioty i efekty. Część statyczna planszy rysowana raz do warstwy w pamięci.
import { indeks } from './maze.js';
import { uklad, pas, kafle, stanPola } from './uklad.js';
import {
  pozycjaGracza, kryciePola, aktualizujMgle, stanIskry, stanSwietlika, pozycjaChmury, pozycjaLiscia,
  unoszenieKlucza, blyskKlucza, pulsDrzwi, rozblysk, animStatyczna,
} from './animacje.js';

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
  blysk: '#fffbe0',
  drzwiZamkniete: '#ff6b6b',
  drzwiOtwarte: '#5ee08a',
  swietlik: '#f6f7a8',
  iskra: '#ffd23f',
  rozblysk: '#e9ffe9',
  chmura: '#000000',
};

/** Ile komórek (ścieżka + pas żywopłotu) obejmuje jeden kafel tekstury żwiru i żywopłotu. */
const KOMOREK_NA_KAFEL = 3;
/** Bok kafla tekstury lasu w px CSS — stały, żeby tło nie zmieniało skali między poziomami. */
const KAFEL_LASU_PX = 256;
/** Warstwy cienia chmury: [skala promienia, krycie] — razem ≤ 0,25. */
const WARSTWY_CHMURY = [[1, 0.06], [0.75, 0.07], [0.5, 0.08]];

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

/** Wypełnia `styl` z kryciem `alfa` względem bieżącego globalAlpha (i je przywraca). */
function zKryciem(ctx, alfa, rysowanie) {
  const poprzednie = ctx.globalAlpha;
  ctx.globalAlpha = poprzednie * alfa;
  rysowanie();
  ctx.globalAlpha = poprzednie;
}

const PAMIEC_POL = new WeakMap();

/** Pola siatki labiryntu — liczone raz na labirynt (labirynt się nie zmienia; `R` tworzy nowy obiekt). */
export function polaPlanszy(labirynt) {
  let pola = PAMIEC_POL.get(labirynt);
  if (!pola) {
    pola = kafle(labirynt);
    PAMIEC_POL.set(labirynt, pola);
  }
  return pola;
}

/** Stan mgły każdego pola siatki dla bieżącego stanu gry. */
export function stanyPol(stan) {
  return polaPlanszy(stan.labirynt).map((p) => stanPola(p.sasiedzi, stan.odkryte, stan.widoczne));
}

/** Geometria planszy w obszarze: układ, lewy górny róg pola (także dla ułamkowych pozycji) i prostokąt pola siatki. */
function geometria(labirynt, szer, wys) {
  const u = uklad(labirynt, szer, wys);
  return {
    u,
    komX: (x) => u.ox + u.sc + x * (u.kom + u.sc),
    komY: (y) => u.oy + u.sc + y * (u.kom + u.sc),
    prostokat: (p) => {
      const a = pas(u, p.gx, u.ox);
      const b = pas(u, p.gy, u.oy);
      return [a.start, b.start, a.dl, b.dl];
    },
  };
}

function wypelnijPola(ctx, pola, prostokat, warunek, styl) {
  ctx.beginPath();
  for (let k = 0; k < pola.length; k++) if (warunek(k)) ctx.rect(...prostokat(pola[k]));
  ctx.fillStyle = styl;
  ctx.fill();
}

function kolo(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Las na całym obszarze — tło pod planszą i ekranami. */
export function rysujTlo(ctx, szerokoscCss, wysokoscCss, tekstury) {
  ctx.fillStyle = wypelnienie(ctx, tekstury.las, KAFEL_LASU_PX, KOLORY.las);
  ctx.fillRect(0, 0, szerokoscCss, wysokoscCss);
}

/** Cienie chmur i liście nad lasem (rysowane pod planszą). */
export function rysujTloAnimowane(ctx, szer, wys, chmury, liscie, czas) {
  ctx.fillStyle = KOLORY.chmura;
  for (const c of chmury) {
    const { x, y, r } = pozycjaChmury(c, czas, szer);
    for (const [skala, alfa] of WARSTWY_CHMURY) {
      zKryciem(ctx, alfa, () => {
        ctx.beginPath();
        ctx.ellipse(x, y, r * skala, r * skala * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
  for (const l of liscie) {
    const { x, y, kat } = pozycjaLiscia(l, czas, wys);
    ctx.fillStyle = l.kolor;
    ctx.beginPath();
    ctx.ellipse(x, y, 5, 2.5, kat, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Statyczna część planszy: cień polany, żwir, żywopłot — rysowana raz do warstwy w pamięci. */
export function rysujPlansze(ctx, stan, szer, wys, tekstury) {
  const { u, prostokat } = geometria(stan.labirynt, szer, wys);
  const pola = polaPlanszy(stan.labirynt);
  const bokKafla = KOMOREK_NA_KAFEL * (u.kom + u.sc);

  // Polana: żwir pod całą planszą, z miękkim cieniem na las
  ctx.save();
  ctx.shadowColor = KOLORY.cien;
  ctx.shadowBlur = Math.max(8, u.sc * 2);
  ctx.fillStyle = wypelnienie(ctx, tekstury.zwir, bokKafla, KOLORY.zwir);
  ctx.fillRect(u.ox, u.oy, u.szer, u.wys);
  ctx.restore();

  // Żywopłot
  wypelnijPola(ctx, pola, prostokat, (k) => pola[k].zywoplot, wypelnienie(ctx, tekstury.zywoplot, bokKafla, KOLORY.zywoplot));
}

/** Ruchoma część planszy w chwili `czas`: drzwi, klucz, mgła z przejściami, świetliki, gracz, iskry, rozbłysk. */
export function rysujKlatke(ctx, stan, szer, wys, anim, czas) {
  const { labirynt, odkryte } = stan;
  const { u, komX, komY, prostokat } = geometria(labirynt, szer, wys);
  const pola = polaPlanszy(labirynt);
  const ruchome = !anim.ograniczony;

  // Drzwi i klucz — tylko na odkrytych polach
  const odkrytePole = (p) => odkryte.has(indeks(labirynt, p.x, p.y));
  if (odkrytePole(stan.wyjscie)) {
    rysujDrzwi(ctx, komX(stan.wyjscie.x), komY(stan.wyjscie.y), u.kom, stan.maKlucz, ruchome ? pulsDrzwi(czas) : 0);
  }
  if (!stan.maKlucz && odkrytePole(stan.klucz)) {
    const dy = ruchome ? unoszenieKlucza(czas) * u.kom : 0;
    rysujKlucz(ctx, komX(stan.klucz.x), komY(stan.klucz.y) + dy, u.kom, ruchome ? blyskKlucza(czas) : null);
  }

  // Mgła i przyciemnienie: pola w pełni zakryte jedną ścieżką, pola w trakcie przejścia osobno z kryciem
  const przejscia = anim.mgla ?? aktualizujMgle(null, stanyPol(stan), czas);
  const krycia = przejscia.map((p) => kryciePola(p, czas));
  wypelnijPola(ctx, pola, prostokat, (k) => krycia[k].mgla >= 0.999, KOLORY.mgla);
  wypelnijPola(ctx, pola, prostokat, (k) => krycia[k].cien >= 0.999, KOLORY.przyciemnienie);
  for (let k = 0; k < pola.length; k++) {
    const { mgla, cien } = krycia[k];
    for (const [alfa, styl] of [[mgla, KOLORY.mgla], [cien, KOLORY.przyciemnienie]]) {
      if (alfa <= 0.001 || alfa >= 0.999) continue;
      zKryciem(ctx, alfa, () => {
        ctx.fillStyle = styl;
        ctx.fillRect(...prostokat(pola[k]));
      });
    }
  }

  // Świetliki nad odkrytym żywopłotem
  ctx.fillStyle = KOLORY.swietlik;
  const r = Math.max(1.5, u.kom * 0.06);
  for (const s of anim.swietliki) {
    if (krycia[s.k].mgla > 0.5) continue;
    const { dx, dy, alfa } = stanSwietlika(s, czas);
    const [x, y, w, h] = prostokat(pola[s.k]);
    const cx = x + w / 2 + dx * u.kom;
    const cy = y + h / 2 + dy * u.kom;
    zKryciem(ctx, alfa * 0.25, () => kolo(ctx, cx, cy, r * 3));
    zKryciem(ctx, alfa, () => kolo(ctx, cx, cy, r));
  }

  // Gracz — koło z obrysem, w wyświetlanej (interpolowanej) pozycji
  const g = pozycjaGracza(anim.ruch, czas);
  ctx.beginPath();
  ctx.arc(komX(g.x) + u.kom / 2, komY(g.y) + u.kom / 2, u.kom * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = KOLORY.gracz;
  ctx.fill();
  ctx.lineWidth = gruboscObrysu(u.kom);
  ctx.strokeStyle = KOLORY.obrys;
  ctx.stroke();

  // Iskry po podniesieniu klucza
  ctx.fillStyle = KOLORY.iskra;
  for (const i of anim.iskry) {
    const st = stanIskry(i, czas);
    if (!st) continue;
    zKryciem(ctx, st.alfa, () => kolo(ctx, komX(st.x) + u.kom / 2, komY(st.y) + u.kom / 2, Math.max(1.5, u.kom * 0.05)));
  }

  // Rozbłysk przy drzwiach po ukończeniu poziomu
  if (anim.rozblysk != null) {
    const b = rozblysk(anim.rozblysk, czas);
    if (b) {
      zKryciem(ctx, b.alfa, () => {
        ctx.beginPath();
        ctx.arc(komX(stan.wyjscie.x) + u.kom / 2, komY(stan.wyjscie.y) + u.kom / 2, u.kom * (0.5 + 2.5 * b.promien), 0, Math.PI * 2);
        ctx.strokeStyle = KOLORY.rozblysk;
        ctx.lineWidth = Math.max(2, u.kom * 0.15) * (1 - b.promien * 0.5);
        ctx.stroke();
      });
    }
  }
}

/** Cała plansza bez animacji — ograniczony ruch i zgodność z wcześniejszym API. */
export function rysuj(ctx, stan, szerokoscCss, wysokoscCss, tekstury) {
  if (!stan) return;
  rysujPlansze(ctx, stan, szerokoscCss, wysokoscCss, tekstury);
  rysujKlatke(ctx, stan, szerokoscCss, wysokoscCss, animStatyczna(stan), 0);
}

/** Klucz: kółko (główka) + trzon z ząbkami, z ciemnym obrysem pod spodem; `blysk` 0..1 — pas światła. */
function rysujKlucz(ctx, x, y, kom, blysk) {
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
  if (blysk != null) {
    const bx = x + s * (0.15 + 0.7 * blysk);
    zKryciem(ctx, 0.8, () => {
      ctx.beginPath();
      ctx.moveTo(bx, cy - s * 0.2);
      ctx.lineTo(bx + s * 0.08, cy + s * 0.2);
      ctx.strokeStyle = KOLORY.blysk;
      ctx.lineWidth = Math.max(1, s * 0.06);
      ctx.stroke();
    });
  }
}

/**
 * Drzwi: zamknięte = pełny prostokąt z dziurką od klucza; otwarte = pusta rama z otwartym skrzydłem
 * i pulsującą poświatą (`puls` 0..1). Z obrysem.
 */
function rysujDrzwi(ctx, x, y, kom, otwarte, puls) {
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
    if (puls > 0) {
      zKryciem(ctx, 0.15 + 0.25 * puls, () => {
        ctx.fillStyle = KOLORY.drzwiOtwarte;
        ctx.fillRect(l - s * 0.08, t - s * 0.08, w + s * 0.16, h + s * 0.16);
      });
    }
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
