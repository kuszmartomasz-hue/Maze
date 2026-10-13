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

/** Odbicie od ściany w kierunku {dx, dy}: wychylenie i powrót. Trwający ruch nie jest przerywany. */
export function odbicie(poprzedni, kierunek, czas, ograniczony = false) {
  const wRuchu = !poprzedni.odbicie && postep(poprzedni.start, czas, poprzedni.trwanie) < 1;
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
