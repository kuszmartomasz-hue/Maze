# Zrzuty wzorcowe „Zaklętego Ogrodu” — testy wizualne

Generuje je `node zrzuty.mjs` (Playwright, viewport 1280×800, SwiftShader). Cały run trwa ok. 3,5 min (renderowanie 3D w programowym GL jest wolne).
Powtarzalność: Supabase podstawiony przez `page.route` (stała tabela 4 graczy, `moje_miejsce` → `[]`), labirynt z `nowyPoziom(poziom, 30, mulberry32(20240607 + poziom))` podawany jako zapis, `Math.random` w stronie podmieniony na mulberry32, nick „Ania” w localStorage, ruchy z BFS po odkodowanym labiryncie, ≥ 1,8 s odczekania przed zrzutem.

## Stabilność między dwoma przebiegami
**Żaden zrzut nie jest identyczny bajt w bajt.** Układ, labirynt i teksty są za to identyczne; różnią się tylko elementy animowane zegarem ściennym (nie deterministyczne mimo stałego ziarna: faza animacji zależy od `performance.now`/rAF, a przy wolnym renderze 3D liczba klatek między akcjami jest inna).

| zrzut | różnych pikseli | różnica > 16/255 | uwagi |
|---|---|---|---|
| 01 | ok. 43 % | ok. 14 % | tło 3D (kołysanie drzew, światło) |
| 02 | ok. 50 % | ok. 4 % | j.w. + świetliki, pierścień klucza |
| 03 | ok. 41 % | ok. 3 % | j.w. |
| 04 | ok. 80 % | ok. 10 % | j.w. + faza kamery po ruchach |
| 05 (2D) | 0,6 % | 0,2 % | tylko świetliki i opadające liście |

W teście regresji porównuj więc z tolerancją (np. `pixelmatch`/`toHaveScreenshot` z `maxDiffPixelRatio` ok. 0,15 dla 3D i 0,01 dla 2D, próg koloru ≥ 16–60) albo maskuj świetliki/liście/tło z lasem. Zrzut 05 jest najbardziej stabilny.

## Zrzuty
1. **01-ekran-startowy-tabela.png** — ekran startowy nad sceną 3D: tytuł, „Najwyższy poziom”, pole nicku z „Ania”, instrukcje, „Enter — kontynuuj (poziom 1) · N — nowa gra”, tabela wyników (Ania 12, Bartek 9, Celina 7, Darek 4). Sprawdzać: obecność i kolejność 4 wierszy, numerację, wyrównanie liczb, brak komunikatu „Wczytywanie…”, widoczny las w tle (3D się zainicjowało). Niestabilne tylko tło.
2. **02-poziom1-klucz-i-drzwi.png** — poziom 1 w 3D tuż po starcie: kula gracza w kręgu światła, żywopłot, ścieżki, las, złoty klucz (pierścień w prawym górnym rogu). HUD: „Poziom 1”, „Brak klucza”. Sprawdzać: kamera śledząca wycentrowana na graczu, kolory/tekstury żywopłotu i żwiru, cienie, klucz widoczny, HUD. Drzwi wyjścia leżą poza kadrem (kamera jest blisko gracza).
3. **03-poziom3-mgla.png** — pierwszy poziom z mgłą (12×12): widać tylko 3 pola wokół gracza, reszta labiryntu to ciemność, las na zewnątrz nadal widoczny; w HUD plakietka „Mgła”. Sprawdzać: czarny obszar poza zasięgiem, plakietkę „Mgła”, że nie „wycieka” widok dalszych korytarzy.
4. **04-poziom2-klucz-zdobyty.png** — poziom 2 po przejściu BFS-em do klucza: HUD „Klucz zdobyty” (żółty), klucza nie ma już na planszy. Sprawdzać: tekst i kolor HUD, zniknięcie klucza, pozycja kamery po serii ruchów. Uwaga: drzwi wyjścia są poza kadrem, więc ich otwarcie NIE jest na zrzucie — zob. uwagi.
5. **05-zapasowy-renderer-2d.png** — zapasowy renderer 2D (three.js zablokowany przez `route.abort`): pełny labirynt z góry, niebieski gracz, złoty klucz, czerwone drzwi z dziurką, HUD „Brak klucza”, las-tekstura w tle. Sprawdzać: że przy błędzie ładowania 3D gra startuje w 2D, canvas #plansza widoczny, układ i pozycje elementów. Najlepszy kandydat na test pikselowy (różni się tylko świetlikami/liśćmi).

## Uwagi
- Aby pokazać otwarte drzwi, trzeba byłoby dojść do wyjścia z kluczem (kamera podąża za graczem) lub zrobić zrzut w 2D; na razie 04 sprawdza stan „klucz zdobyty”.
- Przed uruchomieniem: `npm start` (serwer na porcie 8000), potem `node tests/wizualne/zrzuty.mjs`.
