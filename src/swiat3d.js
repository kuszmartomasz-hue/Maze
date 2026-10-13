// Geometria świata 3D: pola, żywopłot, las, kamera. Czysta matematyka — bez three.js i DOM.
// Jednostki: ścieżka = 1, pas żywopłotu = 0.5, oś Y w górę, plansza wycentrowana w (0, 0);
// kolumna siatki gx → oś X, wiersz gy → oś Z (północ = −Z).
import { kafle } from './uklad.js';

export const SZEROKOSC_SCIEZKI = 1;
export const SZEROKOSC_ZYWOPLOTU = 0.5;
export const WYSOKOSC_ZYWOPLOTU = 1.1;

const KROK = SZEROKOSC_SCIEZKI + SZEROKOSC_ZYWOPLOTU;
const dlugosc = (n) => n * SZEROKOSC_SCIEZKI + (n + 1) * SZEROKOSC_ZYWOPLOTU;

/** Rozmiar planszy w świecie: { szer, gleb } = N·1 + (N+1)·0.5 (i analogicznie M). */
export function rozmiarPlanszy3d(labirynt) {
  return { szer: dlugosc(labirynt.szerokosc), gleb: dlugosc(labirynt.wysokosc) };
}

/** Środek i długość pasa siatki `g` wzdłuż osi o całkowitej długości `calosc`. */
function pas3d(g, calosc) {
  const j = Math.floor(g / 2);
  const parzysty = g % 2 === 0;
  const dl = parzysty ? SZEROKOSC_ZYWOPLOTU : SZEROKOSC_SCIEZKI;
  const start = (parzysty ? 0 : SZEROKOSC_ZYWOPLOTU) + j * KROK;
  return { srodek: start + dl / 2 - calosc / 2, dl };
}

/** Środek i wymiary pola siatki (gx, gy): { x, z, sx, sz }. */
export function poleSiatki3d(labirynt, gx, gy) {
  const { szer, gleb } = rozmiarPlanszy3d(labirynt);
  const a = pas3d(gx, szer);
  const b = pas3d(gy, gleb);
  return { x: a.srodek, z: b.srodek, sx: a.dl, sz: b.dl };
}

/** Środek komórki labiryntu (x, y — także ułamkowe, dla płynnego ruchu): { x, z }. */
export function srodekKomorki3d(labirynt, x, y) {
  const { szer, gleb } = rozmiarPlanszy3d(labirynt);
  return {
    x: SZEROKOSC_ZYWOPLOTU + SZEROKOSC_SCIEZKI / 2 + x * KROK - szer / 2,
    z: SZEROKOSC_ZYWOPLOTU + SZEROKOSC_SCIEZKI / 2 + y * KROK - gleb / 2,
  };
}

/** Wszystkie pola siatki: [{ x, z, sx, sz, k, zywoplot }] w kolejności kafle() (k = indeks). */
export function polaSiatki3d(labirynt) {
  return kafle(labirynt).map((p, k) => ({ ...poleSiatki3d(labirynt, p.gx, p.gy), k, zywoplot: p.zywoplot }));
}

/** Bloki żywopłotu (pola siatki z zywoplot=true): [{ x, z, sx, sz, k }] — k = indeks pola w kafle(). */
export function blokiZywoplotu(labirynt) {
  return polaSiatki3d(labirynt)
    .filter((p) => p.zywoplot)
    .map(({ x, z, sx, sz, k }) => ({ x, z, sx, sz, k }));
}

const MARGINES_LASU = 1.2;
const SZEROKOSC_PASA_LASU = 2;
const ROZSTAW_DRZEW = 1.6;

/**
 * Drzewa lasu wokół polany, deterministycznie z rng: [{ x, z, wysokosc, promien, obrot, odcien }].
 * `rzedy` pasów lasu o szerokości ~2 jednostek; nic wewnątrz prostokąta planszy powiększonego o margines 1.2.
 */
export function drzewaLasu(labirynt, rng, rzedy = 5) {
  const { szer, gleb } = rozmiarPlanszy3d(labirynt);
  const polX = szer / 2 + MARGINES_LASU;
  const polZ = gleb / 2 + MARGINES_LASU;
  const zasieg = rzedy * SZEROKOSC_PASA_LASU;
  const drzewa = [];
  // Siatka z rozrzutem; liczba wywołań rng na punkt jest stała, więc wynik zależy tylko od ziarna.
  for (let x = -polX - zasieg; x <= polX + zasieg; x += ROZSTAW_DRZEW) {
    for (let z = -polZ - zasieg; z <= polZ + zasieg; z += ROZSTAW_DRZEW) {
      const dx = (rng() - 0.5) * ROZSTAW_DRZEW * 0.8;
      const dz = (rng() - 0.5) * ROZSTAW_DRZEW * 0.8;
      const wysokosc = 2.5 + rng() * 2.5;
      const promien = 0.5 + rng() * 0.4;
      const obrot = rng() * Math.PI * 2;
      const odcien = rng();
      const px = x + dx;
      const pz = z + dz;
      if (Math.abs(px) < polX && Math.abs(pz) < polZ) continue;
      if (Math.abs(px) > polX + zasieg || Math.abs(pz) > polZ + zasieg) continue;
      drzewa.push({ x: px, z: pz, wysokosc, promien, obrot, odcien });
    }
  }
  return drzewa;
}

const KAT_KAMERY = (55 * Math.PI) / 180;
const FOV_PIONOWY = (50 * Math.PI) / 180;
const WIDOCZNE_KOMORKI = 9;

/**
 * Kamera śledząca dla pozycji gracza {x, z} w świecie: kąt 55° nad ziemią, odległość tak, by widać ~9×9 komórek;
 * zawsze patrzy na północ (−Z), nie obraca się. → { pozycja:{x,y,z}, cel:{x,y,z} }
 */
export function kamera3d(graczSwiat, aspekt) {
  const pol = (WIDOCZNE_KOMORKI * KROK) / 2;
  const tg = Math.tan(FOV_PIONOWY / 2);
  const odleglosc = Math.max(pol / tg, pol / (tg * aspekt));
  return {
    pozycja: {
      x: graczSwiat.x,
      y: odleglosc * Math.sin(KAT_KAMERY),
      z: graczSwiat.z + odleglosc * Math.cos(KAT_KAMERY),
    },
    cel: { x: graczSwiat.x, y: 0, z: graczSwiat.z },
  };
}
