# Zaklęty Ogród — tekstury i układ blokowy planszy

Data: 2026-10-13 · Status: zatwierdzony projekt, do planu wdrożenia

## Cel

Nadać grze klimat ogrodowego labiryntu na leśnej polanie: ściany z żywopłotu, ścieżki ze żwiru,
dookoła ciemny las. Zmiana dotyczy wyłącznie warstwy rysowania — logika gry (generowanie labiryntu,
ruch, klucz, mgła, rekord) pozostaje bez zmian.

Gra zmienia nazwę z „Labirynt” na **„Zaklęty Ogród”** (tytuł strony i ekran startowy).

## Decyzje

| Temat | Decyzja |
|---|---|
| Źródło tekstur | Pliki graficzne wygenerowane przez AI (prompty w `assets/prompty/`) |
| Klimat | Ogród z żywopłotem o zmierzchu, wokół las |
| Ściany | Układ blokowy: żywopłot zajmuje własne pola, nie jest linią |
| Grubość żywopłotu | Połowa szerokości ścieżki |
| Podłoga | Żwir |
| Tło poza planszą | Las (korony drzew z góry) |
| Postacie i przedmioty | Bez zmian kształtu, z ciemnym obrysem |

## 1. Pliki graficzne

- Źródła (1254×1254 PNG, ~10 MB razem): `assets/zywoplot.png`, `assets/zwir.png`, `assets/las.png` —
  zostają lokalnie, są ignorowane przez git (`assets/*.png` w `.gitignore`).
- Do repo trafiają wersje zoptymalizowane: **512×512 JPG** (cel: < 150 KB każda, < 0,5 MB razem):
  `assets/zywoplot.jpg`, `assets/zwir.jpg`, `assets/las.jpg`.
- Konwersja jednorazowa (Pillow), opisana w README, żeby dało się ją powtórzyć po podmianie grafik.
- Wszystkie ścieżki względne (`assets/...`) — działa lokalnie i pod `https://kuszmartomasz-hue.github.io/Maze/`.

## 2. Układ blokowy

Plansza N×M komórek jest rysowana jako naprzemienne pasy: żywopłot, ścieżka, żywopłot, …, żywopłot.

- `kom` — bok komórki (ścieżki) w px, `sc` — grubość żywopłotu, `sc = round(kom / 2)`, min. 1 px.
- Szerokość planszy: `N·kom + (N+1)·sc` (analogicznie wysokość dla M).
- Lewy górny róg komórki (x, y): `ox + sc + x·(kom + sc)`, `oy + sc + y·(kom + sc)`.
- Pole między dwiema sąsiednimi komórkami: żwir, gdy jest przejście; żywopłot, gdy jest ściana.
- Narożniki (punkty styku czterech komórek oraz obwód planszy) — zawsze żywopłot.

Nowa czysta funkcja w `src/render.js` (eksportowana do testów):

```js
uklad(labirynt, szerokoscPx, wysokoscPx) → { kom, sc, ox, oy, szer, wys }
```

Wybiera największe całkowite `kom`, przy którym plansza mieści się w podanym obszarze, i centruje ją.

`limitRozmiaru(szerokoscPx, wysokoscPx)` w `src/game.js` uwzględnia żywopłot: zwraca największe N,
dla którego `N·k + (N+1)·round(k/2) ≤ min(szer, wys)` przy `k = MIN_KOMORKA_PX` (12). Dolna granica 2 bez zmian.

## 3. Tła i tekstury

Kolejność rysowania w `rysuj`:

1. Las — wzór na całym canvasie (także pod ekranem startowym, gdy `stan` jest `null`).
2. Cień polany — miękki cień (`shadowBlur`) pod prostokątem planszy.
3. Żwir — wzór na całym prostokącie planszy.
4. Żywopłot — wzór na polach ścian i narożników.
5. Mgła i przyciemnienie (pkt 4).
6. Drzwi, klucz, gracz.

Wzory tworzone przez `ctx.createPattern(obraz, 'repeat')`, skalowane `pattern.setTransform(...)`
tak, by jeden kafel tekstury obejmował ~3 komórki (stała `KOMOREK_NA_KAFEL = 3`) — szczegóły
mają podobną wielkość na każdym poziomie. Las skalowany względem rozmiaru okna, nie komórki
(stały rozmiar kafla 256 px CSS), żeby tło nie „pulsowało” między poziomami.

## 4. Mgła

Bez zmian w logice — `stan.odkryte` i `stan.widoczne` nadal są zbiorami indeksów komórek.

Pole żywopłotu lub przejścia dostaje stan od sąsiednich komórek:

- **widoczne** — jeśli którakolwiek sąsiednia komórka jest w `widoczne`,
- **odkryte** — jeśli którakolwiek sąsiednia komórka jest w `odkryte`,
- w przeciwnym razie — **nieodkryte**.

Sąsiedzi: pole między komórkami → 2 komórki; narożnik → do 4 komórek (mniej na obwodzie).

Nowa czysta funkcja w `src/render.js`:

```js
stanPola(komorkiSasiednie, odkryte, widoczne) → 'widoczne' | 'odkryte' | 'nieodkryte'
```

Rysowanie: nieodkryte → pełne `KOLORY.mgla`; odkryte, ale niewidoczne → `KOLORY.przyciemnienie`
(jak dziś). Las wokół planszy nigdy nie jest zakryty mgłą.

## 5. Gracz, klucz, drzwi

Kształty bez zmian. Każdy dostaje obrys w kolorze `KOLORY.obrys = '#0b0d10'` o grubości
`max(1, kom·0.06)`, żeby był czytelny na jasnym żwirze (szczególnie żółty klucz). Wymaganie
„rozróżnialne kształtem” pozostaje spełnione.

## 6. Ładowanie i błędy

- Nowy moduł `src/tekstury.js`: `wczytajTekstury()` → `Promise<{ zywoplot, zwir, las }>`,
  każdy element to `HTMLImageElement` albo `null`, gdy obrazek się nie wczytał (`onerror`).
  Promise nigdy nie jest odrzucany.
- `main.js` wywołuje `wczytajTekstury()` przy starcie, a po rozwiązaniu odświeża canvas.
  Do tego czasu i przy błędzie renderer używa kolorów zastępczych:
  żywopłot `#2f4a2a`, żwir `#b8a27f`, las `#0d1410`.
- Gra jest grywalna od pierwszej klatki — brak tekstur nie blokuje startu.

## 7. Nazwa gry (wdrożone 2026-10-13)

- `index.html`: `<title>Zaklęty Ogród</title>`, `<h1>Zaklęty Ogród</h1>`.
- `wymagania.md` i `README.md`: nazwa gry „Zaklęty Ogród”.

## 8. Zmiany w wymaganiach (`wymagania.md`)

- §10 Oprawa: zamiast „ściany jako linie … bez obrazków” — układ blokowy z żywopłotem, żwirowe
  ścieżki, las w tle; tekstury jako zoptymalizowane pliki JPG w `assets/`, z kolorami zastępczymi;
  bez fontów zewnętrznych. Gracz, klucz i drzwi nadal rysowane w canvasie, z obrysem.
- §11 Poza zakresem: usunąć „motywy graficzne” (jeden motyw jest teraz w zakresie; przełączanie
  motywów nadal poza zakresem).

## 9. Testy

Automatyczne (`node --test`), nowe:

- `uklad`: plansza mieści się w obszarze; `sc = round(kom/2)`; plansza wycentrowana;
  dla N=2 i dużych N `kom ≥ 1`.
- `limitRozmiaru`: dla limitu N komórka ma ≥ 12 px, dla N+1 już nie; minimum 2.
- `stanPola`: widoczne ma pierwszeństwo przed odkrytym; pusta lista sąsiadów → nieodkryte.

Istniejące 16 testów musi przechodzić; test `limitRozmiaru` w `tests/game.test.js` zostaje
zaktualizowany do nowego wzoru.

Ręcznie (lokalny serwer, potem GitHub Pages):

- tekstury widoczne, brak szwów, las wokół planszy, cień polany,
- mgła od poziomu 3 obejmuje też żywopłot,
- klucz, drzwi i gracz czytelne na żwirze,
- zmiana rozmiaru okna, ekran HiDPI,
- usunięty plik tekstury → gra działa z kolorem zastępczym.

## Poza zakresem

Animacje, dźwięk, nowe grafiki postaci, przełączanie motywów, ilustracja na ekranie startowym.
