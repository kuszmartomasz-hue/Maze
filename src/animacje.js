// Czyste funkcje animacji: łagodzenie, ruch gracza, przejścia mgły, cząsteczki i efekty.
// Bez DOM — czas (ms, np. z performance.now()) i losowość (`rng`) zawsze podawane z zewnątrz.

export const CZAS_RUCHU = 120;
export const CZAS_ODKRYCIA = 300;
export const CZAS_PRZYCIEMNIENIA = 200;
export const CZAS_ISKIER = 500;
export const CZAS_ROZBLYSKU = 600;
export const CZAS_WEJSCIA = 300;
/** Wychylenie odbicia od ściany jako część boku pola. */
export const ODBICIE = 0.04;

export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

/** Postęp 0..1 animacji trwającej `trwanie` ms od chwili `od`. */
export function postep(od, czas, trwanie) {
  if (!(trwanie > 0)) return 1;
  return Math.min(1, Math.max(0, (czas - od) / trwanie));
}

// --- Ruch gracza (pozycje w jednostkach pól, mogą być ułamkowe) ---

/** Gracz stojący na polu `poz`. */
export function ruchStaly(poz) {
  return { od: { x: poz.x, y: poz.y }, do: { x: poz.x, y: poz.y }, start: 0, trwanie: 0, odbicie: null };
}

/** Wyświetlana pozycja gracza w chwili `czas`. */
export function pozycjaGracza(ruch, czas) {
  const p = postep(ruch.start, czas, ruch.trwanie);
  if (ruch.odbicie) {
    const s = Math.sin(Math.PI * p) * ODBICIE;
    return { x: ruch.do.x + ruch.odbicie.dx * s, y: ruch.do.y + ruch.odbicie.dy * s };
  }
  const t = easeOutCubic(p);
  return { x: ruch.od.x + (ruch.do.x - ruch.od.x) * t, y: ruch.od.y + (ruch.do.y - ruch.od.y) * t };
}

/** Przejście do pola `cel` od bieżącej wyświetlanej pozycji — przerwany ruch nie skacze. */
export function nowyRuch(poprzedni, cel, czas, ograniczony = false) {
  if (ograniczony) return ruchStaly(cel);
  return {
    od: pozycjaGracza(poprzedni, czas),
    do: { x: cel.x, y: cel.y },
    start: czas,
    trwanie: CZAS_RUCHU,
    odbicie: null,
  };
}

/** Odbicie od ściany w kierunku {dx, dy}: wychylenie i powrót. Trwający ruch ani odbicie nie są przerywane. */
export function odbicie(poprzedni, kierunek, czas, ograniczony = false) {
  const wRuchu = postep(poprzedni.start, czas, poprzedni.trwanie) < 1;
  if (ograniczony || wRuchu) return poprzedni;
  return {
    od: { ...poprzedni.do },
    do: { ...poprzedni.do },
    start: czas,
    trwanie: CZAS_RUCHU,
    odbicie: { dx: kierunek.dx, dy: kierunek.dy },
  };
}

// --- Mgła: przejścia krycia pól ---

const KRYCIE = {
  nieodkryte: { mgla: 1, cien: 0 },
  odkryte: { mgla: 0, cien: 1 },
  widoczne: { mgla: 0, cien: 0 },
};

/** Krycie pola w chwili `czas`: części pełnej mgły i pełnego przyciemnienia (0..1). */
export function kryciePola(p, czas) {
  const cel = KRYCIE[p.stan];
  const trwanie = cel.mgla < p.z.mgla ? CZAS_ODKRYCIA : CZAS_PRZYCIEMNIENIA;
  const t = postep(p.od, czas, trwanie);
  return { mgla: p.z.mgla + (cel.mgla - p.z.mgla) * t, cien: p.z.cien + (cel.cien - p.z.cien) * t };
}

/**
 * Przejścia mgły po zmianie stanów pól. `przejscia` — poprzednia tablica albo null (brak historii — bez przejść;
 * tablica innej długości pochodzi z innego labiryntu i jest pomijana). Pole o zmienionym stanie przechodzi
 * od bieżącego krycia do nowego od chwili `czas`.
 */
export function aktualizujMgle(przejscia, stany, czas, ograniczony = false) {
  const historia = przejscia && przejscia.length === stany.length ? przejscia : null;
  return stany.map((stan, k) => {
    const p = historia?.[k];
    if (!p || ograniczony) return { stan, od: -Infinity, z: KRYCIE[stan] };
    if (p.stan === stan) return p;
    return { stan, od: czas, z: kryciePola(p, czas) };
  });
}

// --- Iskry przy podniesieniu klucza (jednostki pól) ---

/** Iskry wylatujące z pola (x, y). */
export function iskry(x, y, rng, czas, ile = 14) {
  return Array.from({ length: ile }, () => {
    const kat = rng() * Math.PI * 2;
    const v = 1 + rng() * 1.5; // pól na sekundę
    return { x, y, vx: Math.cos(kat) * v, vy: Math.sin(kat) * v, start: czas };
  });
}

/** Położenie i krycie iskry; null po CZAS_ISKIER. */
export function stanIskry(iskra, czas) {
  const p = postep(iskra.start, czas, CZAS_ISKIER);
  if (p >= 1) return null;
  const s = Math.max(0, czas - iskra.start) / 1000;
  return { x: iskra.x + iskra.vx * s, y: iskra.y + iskra.vy * s, alfa: 1 - p };
}

// --- Świetliki nad żywopłotem ---

/** 8–16 świetlików nad losowymi polami żywopłotu (`pola` z kafle()). */
export function swietliki(pola, rng) {
  const kandydaci = [];
  for (let k = 0; k < pola.length; k++) if (pola[k].zywoplot) kandydaci.push(k);
  const ile = Math.min(16, Math.max(8, Math.round(kandydaci.length / 60)));
  return Array.from({ length: ile }, () => ({
    k: kandydaci[Math.floor(rng() * kandydaci.length)],
    faza: rng() * Math.PI * 2,
    okres: 1000 + rng() * 2000,
    promien: 0.3 + rng() * 0.7,
  }));
}

/** Przesunięcie świetlika względem środka pola (w bokach pola) i jego krycie 0,2–1. */
export function stanSwietlika(s, czas) {
  const t = (czas / s.okres) * Math.PI * 2 + s.faza;
  return {
    dx: Math.cos(t * 0.5) * s.promien,
    dy: Math.sin(t * 0.7) * s.promien,
    alfa: 0.6 + 0.4 * Math.sin(t),
  };
}

// --- Tło: cienie chmur i liście (px CSS całego canvasu) ---

/** Duże, miękkie cienie chmur. */
export function chmury(szer, wys, rng, ile = 4) {
  return Array.from({ length: ile }, () => {
    const r = Math.max(szer, wys) * (0.15 + rng() * 0.15);
    return { x0: rng() * (szer + 2 * r), y: rng() * wys, r, predkosc: 8 + rng() * 8 };
  });
}

/** Chmura płynie w prawo i po wyjściu za ekran wraca z lewej. */
export function pozycjaChmury(c, czas, szer) {
  const droga = szer + 2 * c.r;
  const x = ((((c.x0 + (c.predkosc * czas) / 1000) % droga) + droga) % droga) - c.r;
  return { x, y: c.y, r: c.r };
}

const KOLORY_LISCI = ['#c9a227', '#b5651d', '#8a5a2b', '#d4a017'];

/**
 * Liście dryfujące nad lasem. `plansza` = {x, y, szer, wys} w px — liście tylko w pasach po jej bokach
 * (pas węższy niż 24 px — bez liści); null — cała szerokość (ekran startowy).
 * Kołysanie mieści się w pasie z marginesem 6 px.
 */
export function liscie(szer, wys, plansza, rng, ile = 5) {
  const pasy = plansza
    ? [[0, plansza.x], [plansza.x + plansza.szer, szer]].filter(([a, b]) => b - a >= 24)
    : [[0, szer]];
  if (!pasy.length) return [];
  return Array.from({ length: ile }, () => {
    const [a, b] = pasy[Math.floor(rng() * pasy.length)];
    const pol = (b - a) / 2;
    const amp = Math.min(12, pol - 6);
    return {
      srodek: a + pol + (rng() * 2 - 1) * (pol - 6 - amp),
      amp,
      y0: rng() * wys,
      predkosc: 15 + rng() * 15,
      faza: rng() * Math.PI * 2,
      kolor: KOLORY_LISCI[Math.floor(rng() * KOLORY_LISCI.length)],
    };
  });
}

/** Liść opada, kołysze się na boki i obraca; po wyjściu na dole wraca na górę. */
export function pozycjaLiscia(l, czas, wys) {
  const s = czas / 1000;
  const droga = wys + 40;
  const y = ((((l.y0 + l.predkosc * s) % droga) + droga) % droga) - 20;
  return { x: l.srodek + Math.sin(s * 1.3 + l.faza) * l.amp, y, kat: Math.sin(s * 2 + l.faza) * 0.6 };
}

// --- Przedmioty i przejścia ---

/** Unoszenie klucza jako część boku pola (okres 2 s, amplituda 6%). */
export const unoszenieKlucza = (czas) => Math.sin((czas / 2000) * Math.PI * 2) * 0.06;

/** Błysk na kluczu: położenie pasa światła 0..1 przez 400 ms co 3 s; poza tym null. */
export function blyskKlucza(czas) {
  const faza = ((czas % 3000) + 3000) % 3000;
  return faza < 400 ? faza / 400 : null;
}

/** Puls poświaty otwartych drzwi 0..1 (okres 1,5 s). */
export const pulsDrzwi = (czas) => easeInOutSine((Math.sin((czas / 1500) * Math.PI * 2) + 1) / 2);

/** Wejście planszy: krycie 0 → 1 i skala 0,97 → 1 w CZAS_WEJSCIA. */
export function wejsciePlanszy(start, czas) {
  const t = easeOutCubic(postep(start, czas, CZAS_WEJSCIA));
  return { alfa: t, skala: 0.97 + 0.03 * t };
}

/** Rozbłysk przy drzwiach po ukończeniu poziomu: promień 0..1 i krycie; null po CZAS_ROZBLYSKU. */
export function rozblysk(start, czas) {
  const p = postep(start, czas, CZAS_ROZBLYSKU);
  if (p >= 1) return null;
  return { promien: easeOutCubic(p), alfa: 1 - p };
}

/** Stan animacji bez ruchu — ograniczony ruch i rysowanie jednorazowe. */
export function animStatyczna(stan) {
  return { ograniczony: true, ruch: ruchStaly(stan.gracz), mgla: null, iskry: [], swietliki: [], wejscie: null, rozblysk: null };
}
