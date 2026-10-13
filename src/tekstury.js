// Ładowanie tekstur planszy. Brak obrazka nie psuje gry — renderer użyje koloru zastępczego.

export const PLIKI = {
  zywoplot: 'assets/zywoplot.jpg',
  zwir: 'assets/zwir.jpg',
  las: 'assets/las.jpg',
};

export const BEZ_TEKSTUR = { zywoplot: null, zwir: null, las: null };

function wczytajObraz(src, utworzObraz) {
  return new Promise((rozwiaz) => {
    const obraz = utworzObraz();
    obraz.onload = () => rozwiaz(obraz);
    obraz.onerror = () => rozwiaz(null);
    obraz.src = src;
  });
}

/** Wczytuje wszystkie tekstury; każda to obraz albo null, gdy się nie wczytała. Nigdy nie odrzuca. */
export async function wczytajTekstury(pliki = PLIKI, utworzObraz = () => new Image()) {
  const wpisy = await Promise.all(
    Object.entries(pliki).map(async ([nazwa, src]) => [nazwa, await wczytajObraz(src, utworzObraz)]),
  );
  return Object.fromEntries(wpisy);
}
