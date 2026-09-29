// Obsługa klawiatury → akcje gry.

const MAPA = {
  ArrowUp: 'gora',
  KeyW: 'gora',
  ArrowDown: 'dol',
  KeyS: 'dol',
  ArrowLeft: 'lewo',
  KeyA: 'lewo',
  ArrowRight: 'prawo',
  KeyD: 'prawo',
  KeyR: 'nowy',
  Escape: 'menu',
  Enter: 'potwierdz',
  NumpadEnter: 'potwierdz',
  Space: 'potwierdz',
};

/** Rejestruje nasłuch klawiatury; `obsluz(akcja)` wywoływane dla rozpoznanych klawiszy. */
export function podlaczKlawiature(cel, obsluz) {
  cel.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const akcja = MAPA[e.code];
    if (!akcja) return;
    e.preventDefault();
    obsluz(akcja, e.repeat);
  });
}
