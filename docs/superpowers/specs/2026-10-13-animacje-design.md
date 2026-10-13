# Zaklęty Ogród — animacje

Data: 2026-10-13 · Status: zatwierdzony projekt, do planu wdrożenia

## Cel

Ożywić grę: płynny ruch gracza, animowane przedmioty, stopniowe odkrywanie mgły, klimat ogrodu
(cienie chmur, świetliki, liście) i płynne przejścia między ekranami — bez zmiany zasad gry i bez
pogorszenia płynności na dużych planszach.

## Decyzje

| Temat | Decyzja |
|---|---|
| Zakres | Wszystkie pięć grup: ruch gracza, przedmioty, mgła, klimat, przejścia ekranów |
| Pętla | `requestAnimationFrame` tylko na ekranie gry; statyczna warstwa planszy w pamięci |
| Logika gry | Bez zmian — stan zmienia się natychmiast, animacje go „doganiają” wizualnie |
| Ograniczony ruch | `prefers-reduced-motion: reduce` → bez interpolacji, bez animacji tła i błysków |
| Las | Cienie chmur nad lasem zamiast kołysania tekstury |
| Logowanie | Osobny projekt (nie w tej specyfikacji) |

## 1. Fundament: pętla i warstwy

- **Warstwa statyczna** (`OffscreenCanvas` albo niewidoczny `<canvas>`): las, cień polany, żwir, żywopłot.
  Budowana od nowa tylko gdy zmieni się: labirynt (nowy poziom, `R`, wznowienie), rozmiar okna / `dpr`,
  albo dojdą tekstury. Każda klatka zaczyna się od `drawImage` tej warstwy.
- **Klatka dynamiczna** (w tej kolejności): cienie chmur i liście (nad lasem), drzwi i klucz (z animacją),
  mgła i przyciemnienie (z przejściami), świetliki (nad odkrytym żywopłotem), gracz (interpolowany),
  efekty (iskry, rozbłysk).
- **Pętla** (`requestAnimationFrame`) działa stale: na ekranie gry rysuje pełną klatkę, na ekranach
  startowym i „ukończony” — tylko las z cieniami chmur i liśćmi (bez planszy pod ekranem startowym,
  z ostatnią planszą pod ekranem „ukończony”). Przy ograniczonym ruchu pętla nie działa — klatka
  rysowana tylko po zdarzeniach, jak dziś. Karta w tle → przeglądarka sama wstrzymuje `requestAnimationFrame`.
- **Siatka pól** (`kafle(labirynt)`) zapamiętywana na labirynt (`WeakMap`), nie liczona co klatkę.
- **Czas animacji** z `performance.now()`, przekazywany do czystych funkcji jako argument.
- **Budżet:** klatka (JS) < 8 ms na planszy 54×54 przy włączonej mgle.

## 2. Płynny ruch gracza

- Przejście między polami: **120 ms**, `easeOutCubic`.
- Nowy ruch w trakcie przejścia → nowe przejście od **bieżącej wyświetlanej** pozycji do nowego pola
  (bez kolejkowania, bez opóźniania logiki). Przytrzymany klawisz = płynny bieg.
- Ruch w ścianę → „odbicie”: przesunięcie o 4% boku pola w stronę ściany i powrót, łącznie 120 ms.
- `R`, nowy poziom, wznowienie → pozycja ustawiana bez przejścia.

## 3. Przedmioty

- **Klucz:** unoszenie `sin` o amplitudzie 6% boku pola, okres 2 s; co 3 s błysk (jasny pas przesuwający się
  po kluczu, 400 ms).
- **Podniesienie klucza:** 14 złotych iskier z pola klucza, rozbiegają się i gasną w 500 ms
  (generator z wstrzykiwanym `rng`).
- **Drzwi otwarte:** zielona poświata pulsująca (okres 1,5 s); zamknięte bez animacji.

## 4. Mgła

- Każda komórka pamięta czas zmiany stanu mgły (`nieodkryte` → `widoczne`, `widoczne` → `odkryte`, `odkryte` → `widoczne`).
- Odkrycie: krycie mgły maleje 1 → 0 w **300 ms**. Wyjście z zasięgu: przyciemnienie rośnie 0 → pełne w **200 ms**.
  Powrót w zasięg: przyciemnienie maleje w 200 ms.
- Pola żywopłotu dziedziczą stan od sąsiadów (`stanPola`) — przejście liczone od najnowszej zmiany sąsiadów.
- Poziomy bez mgły: brak przejść.

## 5. Klimat ogrodu

- **Cienie chmur:** 3–4 duże miękkie elipsy (gradient radialny, krycie ≤ 0,25) sunące wolno (≈ 12 px/s)
  po całym canvasie; rysowane nad lasem i pod planszą (plansza je zasłania).
- **Świetliki:** 8–16 punktów (zależnie od rozmiaru planszy), krążą w promieniu ~1 pola nad odkrytymi polami
  żywopłotu, migoczą (krycie 0,2–1, okres 1–3 s). We mgle widoczne tylko na odkrytych polach.
- **Liście:** 4–6 liści (proste kształty, odcienie żółci i brązu) dryfujących w dół nad lasem po bokach
  planszy, z kołysaniem; nie wlatują nad planszę.

## 6. Przejścia ekranów

- **Start poziomu:** plansza (warstwa statyczna + zawartość) przez 300 ms przechodzi od krycia 0 i skali 0,97 do 1.
- **Ukończenie poziomu:** rozbłysk przy drzwiach (pierścień światła rosnący i gasnący, 600 ms), potem
  ekran „Poziom ukończony”. W trakcie rozbłysku klawisze są ignorowane. Zapis wyniku i stanu — bez zmian
  (wysyłany od razu przy ukończeniu, nie po animacji).
- **Nakładki** (`.nakladka`): pojawianie/znikanie przez `opacity` 200 ms (CSS); `hidden` ustawiane po zakończeniu
  znikania.

## 7. Ograniczony ruch (`prefers-reduced-motion: reduce`)

- Gracz bez interpolacji i bez odbicia, klucz bez unoszenia i błysku, drzwi bez pulsu.
- Brak cieni chmur, świetlików, liści i iskier; mgła zmienia się od razu.
- Rozbłysk ukończenia zastąpiony natychmiastowym przejściem do ekranu „ukończony”; nakładki bez przejść.
- Odczyt przez `matchMedia`, z nasłuchem zmiany ustawienia w trakcie gry.

## 8. Struktura kodu

- `src/animacje.js` (nowy, bez DOM, testowalny w Node):
  - funkcje łagodzenia (`easeOutCubic`, `easeInOutSine`), `postep(od, czas, trwanie)` → 0..1,
  - ruch gracza: `nowyRuch(wyswietlana, cel, czas)`, `odbicie(pozycja, kierunek, czas)`, `pozycjaGracza(ruch, czas)`,
  - mgła: `aktualizujPrzejsciaMgly(przejscia, stanyPrzed, stanyPo, czas)`, `kryciePola(przejscie, czas)`,
  - cząsteczki: `iskry(x, y, rng, czas)`, `swietliki(pola, rng)`, `liscie(...)`, `chmury(...)` + ich położenie w czasie,
  - `ZMNIEJSZONY_RUCH`-świadome warianty przez parametr, nie stan globalny.
- `src/render.js`: `zbudujWarstweStatyczna(...)`, `rysujKlatke(ctx, stan, anim, czas, ...)`; zapamiętywanie `kafle`.
- `src/main.js`: pętla, wyzwalanie efektów po zdarzeniach z `ruch()` (`ruch`, `sciana`, `klucz`, `ukonczony`),
  blokada klawiszy w trakcie rozbłysku, przebudowa warstwy statycznej.
- `style.css`: przejścia nakładek; `@media (prefers-reduced-motion: reduce)`.

## 9. Testy

Automatyczne (`node --test`):
- łagodzenie i `postep` (granice, zakres 0..1);
- ruch: koniec przejścia = cel; przerwanie w połowie startuje z bieżącej pozycji; odbicie wraca do pola;
  tryb ograniczonego ruchu → natychmiast cel;
- mgła: odkrycie 1 → 0 w 300 ms, wyjście z zasięgu 0 → pełne w 200 ms, brak przejść bez mgły;
- cząsteczki deterministyczne przy stałym `rng`; iskry gasną po 500 ms; liście nie wchodzą nad planszę;
- renderer (atrapa canvasu): klatka bez wyjątku w każdym stanie (start, ruch, mgła, rozbłysk, bez tekstur);
  warstwa statyczna budowana raz na labirynt, nie co klatkę.

Ręczne / Playwright:
- pomiar czasu klatki na 54×54 z mgłą (< 8 ms JS);
- zrzuty: ruch w połowie przejścia, iskry, mgła w trakcie odkrywania, rozbłysk;
- `prefers-reduced-motion: reduce` (emulacja w Playwright) → brak animacji, gra działa;
- istniejące e2e (Supabase podstawiony) przechodzą.

## 10. Zmiany w wymaganiach (`wymagania.md`)

- §10 Oprawa: animacje z punktów 2–6, respektowanie `prefers-reduced-motion`.
- §3 Struktura plików: `src/animacje.js`.
- §12: testy z punktu 9.

## Poza zakresem

Dźwięk, animowane tekstury (sprite'y), konfigurowalna szybkość animacji, logowanie (osobny projekt).
