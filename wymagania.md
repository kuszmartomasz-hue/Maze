# Labirynt — wymagania

## 1. Cel
Przeglądarkowa gra logiczna „Labirynt” tworzona jako ćwiczenie vibe-codingu. Ma być kompletna, działająca
i łatwa do pokazania. Zakres celowo umiarkowany.

**Kryterium sukcesu:** gracz uruchamia grę w przeglądarce, przechodzi kolejne coraz większe losowe labirynty
(zdobywa klucz → dochodzi do wyjścia), a rekord poziomu zostaje zapamiętany.

## 2. Technologia
- HTML + CSS + JavaScript (ES modules), rysowanie w `<canvas>`, bez frameworków i bundlera, bez zależności runtime.
- Testy logiki: wbudowany runner `node --test` (Node ≥ 18), bez bibliotek.
- Uruchamianie: moduły ES nie działają z `file://`, więc serwer statyczny: `python3 -m http.server 8000`
  w katalogu projektu → `http://localhost:8000`.

## 3. Struktura plików
| Plik | Odpowiedzialność |
|------|------------------|
| `index.html` | Canvas, HUD, nakładki ekranów, ładowanie `src/main.js` |
| `style.css` | Wygląd strony, HUD i nakładek |
| `src/maze.js` | Czyste funkcje: generowanie labiryntu, BFS/odległości, wybór pozycji startu/wyjścia/klucza |
| `src/game.js` | Stan gry i zasady: ruch, kolizje ze ścianami, klucz, wyjście, poziomy, rekord (bez DOM) |
| `src/render.js` | Rysowanie stanu na canvasie |
| `src/input.js` | Obsługa klawiatury → akcje gry |
| `src/main.js` | Spięcie modułów, pętla/odświeżanie, przełączanie ekranów |
| `tests/*.test.js` | Testy `maze.js` i `game.js` |

`maze.js` i `game.js` nie mogą odwoływać się do DOM ani `window` (testowalne w Node). Losowość wstrzykiwana
jako funkcja `rng` (domyślnie `Math.random`), aby testy mogły używać deterministycznego generatora.

## 4. Labirynt
- Siatka kwadratowych komórek, labirynt „doskonały” (każde dwie komórki łączy dokładnie jedna ścieżka),
  generowany algorytmem **recursive backtracker** (iteracyjnie, ze stosem — bez rekurencji, by nie przepełnić stosu).
- Nowy losowy labirynt przy każdym poziomie i przy każdym użyciu „Nowy labirynt”.
- **Start:** lewy górny róg (0,0).
- **Wyjście:** komórka najdalsza od startu (odległość BFS).
- **Klucz:** komórka o największej odległości od ścieżki start→wyjście (wymusza zboczenie w odnogę);
  przy remisie dowolna z nich; nigdy start ani wyjście. Jeśli wszystkie komórki leżą na tej ścieżce
  (labirynt bez odnóg), klucz trafia na losową komórkę ścieżki inną niż start i wyjście.

## 5. Poziomy i trudność
- Poziom 1: 8×8 komórek; każdy kolejny +2 w obu wymiarach.
- Limit: rozmiar rośnie, dopóki komórka ma co najmniej 12 px przy bieżącym rozmiarze obszaru gry;
  po osiągnięciu limitu kolejne poziomy mają rozmiar maksymalny. Gra nie ma końca.
- Gra zawsze zaczyna się od poziomu 1.
- Brak warunku przegranej (świadoma decyzja — brak stopera i przeciwników).

## 6. Rozgrywka i sterowanie
- Sterowanie wyłącznie klawiaturą: strzałki oraz WASD. Ruch skokowy o jedną komórkę;
  przytrzymanie klawisza = powtarzanie (autorepeat systemu).
- Ruch w ścianę jest ignorowany (gracz stoi w miejscu).
- Wejście na komórkę z kluczem podnosi klucz (znika z planszy, HUD pokazuje „klucz zdobyty”).
- Wyjście jest zamknięte, dopóki gracz nie ma klucza; wejście na nie bez klucza nic nie robi
  (HUD może krótko podpowiedzieć „Potrzebujesz klucza”). Z kluczem → poziom ukończony.
- `R` — nowy losowy labirynt na bieżącym poziomie (klucz resetowany).
- `Esc` — powrót do ekranu startowego (bieżący postęp poziomu przepada, rekord zostaje).
- Pauzy nie ma (nic nie biegnie w czasie).

## 7. Ekrany
1. **Start:** tytuł, rekord („Najwyższy poziom: N”), instrukcja sterowania, `Enter`/`Spacja` = start.
2. **Gra:** labirynt + HUD (numer poziomu, status klucza, skróty `R` / `Esc`).
3. **Poziom ukończony:** „Poziom N ukończony”, `Enter`/`Spacja` = następny poziom.

## 8. Zapis
- `localStorage`, klucz `labirynt.najwyzszyPoziom` — najwyższy ukończony poziom.
- Odczyt/zapis w `try/catch`; brak dostępu do storage nie może psuć gry (rekord = 0).

## 9. Oprawa
- Minimalistyczna: ściany jako linie, gracz jako koło, klucz i drzwi wyjścia jako proste kształty
  (drzwi wyraźnie inne w stanie zamkniętym i otwartym). Wszystko rysowane w canvasie, bez obrazków i fontów zewnętrznych.
- Brak dźwięku.
- Canvas dopasowuje się do okna (także po `resize`), zachowując kwadratowe komórki; ostre linie na ekranach HiDPI
  (`devicePixelRatio`).
- Czytelne kontrasty kolorów (gracz, klucz, wyjście rozróżnialne także bez rozróżniania barw — kształtem).

## 10. Poza zakresem
Stoper, limit czasu, pauza, przeciwnicy, monety/punkty, podpowiedź drogi, sterowanie dotykiem i myszą,
dźwięk, seed labiryntu, tabela wyników online, motywy graficzne.

## 11. Kryteria akceptacji / testy
Automatyczne (`node --test`):
- Wygenerowany labirynt jest spójny (BFS ze startu odwiedza wszystkie komórki) i doskonały
  (liczba przejść = liczba komórek − 1), dla wielu rozmiarów i ziaren.
- Ściany są symetryczne (przejście A→B ⇔ B→A); brak przejść poza siatkę.
- Wyjście i klucz są osiągalne, różne od startu i od siebie.
- Ruch w ścianę nie zmienia pozycji; ruch w wolny korytarz zmienia o jedną komórkę.
- Wyjście bez klucza nie kończy poziomu; z kluczem kończy.
- Rozmiar poziomu: 8, 10, 12… i obcięcie do limitu.
- Rekord zapisuje się tylko, gdy nowy poziom > dotychczasowy.

Ręczne (w przeglądarce):
- Pełny przebieg: start → poziom 1 → klucz → wyjście → poziom 2 (większy) → `R` → `Esc` → rekord na ekranie startowym.
- Po odświeżeniu strony rekord się zachowuje.
- Zmiana rozmiaru okna nie psuje planszy.
- Brak błędów w konsoli.
