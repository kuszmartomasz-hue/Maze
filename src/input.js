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
  KeyN: 'nowaGra',
  Escape: 'menu',
  Enter: 'potwierdz',
  NumpadEnter: 'potwierdz',
  Space: 'potwierdz',
};

const wPoluTekstowym = (el) => el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA';

/**
 * Rejestruje nasłuch klawiatury; `obsluz(akcja, powtorzenie)` wywoływane dla rozpoznanych klawiszy.
 * W polu tekstowym (nick) klawisze piszą — przechodzi tylko Enter; Escape opuszcza pole.
 */
export function podlaczKlawiature(cel, obsluz) {
  cel.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (wPoluTekstowym(e.target)) {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.target.blur();
        return;
      }
      if (e.code !== 'Enter' && e.code !== 'NumpadEnter') return;
    }
    const akcja = MAPA[e.code];
    if (!akcja) return;
    e.preventDefault();
    obsluz(akcja, e.repeat);
  });
}
