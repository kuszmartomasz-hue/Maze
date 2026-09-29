# Labirynt — wymagania

## 1. Cel
Przeglądarkowa gra logiczna „Labirynt” tworzona jako ćwiczenie vibe-codingu. Ma być kompletna, działająca
i łatwa do pokazania. Zakres celowo umiarkowany.

**Kryterium sukcesu:** gracz uruchamia grę w przeglądarce, przechodzi kolejne coraz większe losowe labirynty
(zdobywa klucz → dochodzi do wyjścia), od poziomu 3 odkrywając planszę we mgle, a rekord poziomu zostaje zapamiętany.

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
| `src/game.js` | Stan gry i zasady: ruch, kolizje ze ścianami, klucz, wyjście, poziomy, rekord, widoczność/mgła (bez DOM) |
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
- **Zmiana względem pierwotnego planu:** sam rozmiar labiryntu słabo podnosi trudność, bo cała plansza
  jest widoczna i drogę widać od razu. Dlatego od poziomu 3 włącza się **mgła** (sekcja 7) — to ona jest
  głównym źródłem trudności, rozmiar tylko ją wzmacnia.

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

## 7. Mgła (od poziomu 3)
- Poziomy 1–2 bez mgły (nauka zasad). Od poziomu 3 plansza jest zakryta.
- **Widoczne** są komórki osiągalne z pozycji gracza w co najwyżej **3 krokach** po korytarzach
  (BFS z limitem głębokości) — ściany zasłaniają widok, więc nie widać „przez mur” do sąsiedniego korytarza.
- **Odkryte** komórki (kiedykolwiek widoczne na tym labiryncie) pozostają narysowane, ale przyciemnione;
  nieodkryte są jednolicie ciemne (bez ścian).
- Klucz i drzwi wyjścia rysowane są tylko na komórkach odkrytych — trzeba ich poszukać.
- Odkrycie aktualizuje się po każdym ruchu (także nieudanym — bez zmian) i na starcie poziomu.
- `R` (nowy labirynt) i nowy poziom zerują odkrycie.
- Logika w `game.js` jako czyste funkcje: `widoczneKomorki(labirynt, pozycja, zasieg)` → zbiór komórek,
  stan przechowuje zbiór odkrytych; `render.js` tylko go rysuje. Zasięg (3) i próg poziomu (3) jako stałe.
- Ekran startowy wspomina o mgle w instrukcji; HUD od poziomu 3 pokazuje „Mgła”.

## 8. Ekrany
1. **Start:** tytuł, rekord („Najwyższy poziom: N”), instrukcja sterowania, `Enter`/`Spacja` = start.
2. **Gra:** labirynt + HUD (numer poziomu, status klucza, skróty `R` / `Esc`).
3. **Poziom ukończony:** „Poziom N ukończony”, `Enter`/`Spacja` = następny poziom.

## 9. Zapis
- `localStorage`, klucz `labirynt.najwyzszyPoziom` — najwyższy ukończony poziom.
- Odczyt/zapis w `try/catch`; brak dostępu do storage nie może psuć gry (rekord = 0).

## 10. Oprawa
- Minimalistyczna: ściany jako linie, gracz jako koło, klucz i drzwi wyjścia jako proste kształty
  (drzwi wyraźnie inne w stanie zamkniętym i otwartym). Wszystko rysowane w canvasie, bez obrazków i fontów zewnętrznych.
- Brak dźwięku.
- Canvas dopasowuje się do okna (także po `resize`), zachowując kwadratowe komórki; ostre linie na ekranach HiDPI
  (`devicePixelRatio`).
- Czytelne kontrasty kolorów (gracz, klucz, wyjście rozróżnialne także bez rozróżniania barw — kształtem).

## 11. Poza zakresem
Stoper, limit czasu, pauza, przeciwnicy, monety/punkty, podpowiedź drogi, sterowanie dotykiem i myszą,
dźwięk, seed labiryntu, tabela wyników online, motywy graficzne.

## 12. Kryteria akceptacji / testy
Automatyczne (`node --test`):
- Wygenerowany labirynt jest spójny (BFS ze startu odwiedza wszystkie komórki) i doskonały
  (liczba przejść = liczba komórek − 1), dla wielu rozmiarów i ziaren.
- Ściany są symetryczne (przejście A→B ⇔ B→A); brak przejść poza siatkę.
- Wyjście i klucz są osiągalne, różne od startu i od siebie.
- Ruch w ścianę nie zmienia pozycji; ruch w wolny korytarz zmienia o jedną komórkę.
- Wyjście bez klucza nie kończy poziomu; z kluczem kończy.
- Rozmiar poziomu: 8, 10, 12… i obcięcie do limitu.
- Rekord zapisuje się tylko, gdy nowy poziom > dotychczasowy.
- Mgła: na poziomach 1–2 wszystkie komórki odkryte; od 3 na starcie odkryte tylko komórki w zasięgu 3 kroków.
- `widoczneKomorki` nie zwraca komórki za ścianą (sąsiedniej fizycznie, ale odległej po korytarzu > 3).
- Zbiór odkrytych tylko rośnie w trakcie poziomu; `R` i nowy poziom go zerują.

Ręczne (w przeglądarce):
- Pełny przebieg: start → poziom 1 → klucz → wyjście → poziom 2 (większy) → poziom 3 (mgła, odkrywanie planszy) → `R` → `Esc` → rekord na ekranie startowym.
- Po odświeżeniu strony rekord się zachowuje.
- Zmiana rozmiaru okna nie psuje planszy.
- Brak błędów w konsoli.
