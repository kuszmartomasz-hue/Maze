# Zaklęty Ogród — tekstury i układ blokowy: plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plansza rysowana jako ogrodowy labirynt: bloki żywopłotu, żwirowe ścieżki, las dookoła — z teksturami JPG i kolorami zastępczymi.

**Architecture:** Nowy czysty moduł `src/uklad.js` liczy geometrię układu blokowego (rozmiary, pasy siatki (2N+1)×(2M+1), stan mgły pól). Nowy moduł `src/tekstury.js` ładuje obrazki bez odrzucania Promise. `src/render.js` rysuje las, polanę, żywopłot, mgłę i przedmioty z obrysem; `src/main.js` spina ładowanie tekstur z odświeżaniem. Logika gry (`maze.js`, `game.js` poza `limitRozmiaru`) bez zmian.

**Tech Stack:** HTML + CSS + JavaScript (ES modules), Canvas 2D, `node --test` (Node ≥ 18), Pillow (jednorazowa konwersja grafik).

**Spec:** `docs/superpowers/specs/2026-10-13-tekstury-ogrod-design.md`

**Odstępstwo od specyfikacji (uzasadnione):** `uklad` i `stanPola` trafiają do nowego `src/uklad.js` zamiast do `src/render.js`, bo `limitRozmiaru` w `game.js` potrzebuje tej samej geometrii, a `game.js` nie powinien importować renderera. Zadanie 6 nanosi to na specyfikację.

## Global Constraints

- Bez frameworków, bundlera i zależności runtime; testy tylko `node --test`.
- `maze.js`, `game.js`, `uklad.js` — bez DOM i `window` (testowalne w Node).
- Ścieżki do zasobów względne (`assets/...`) — działa lokalnie i pod `https://kuszmartomasz-hue.github.io/Maze/`.
- Tekstury w repo: `assets/zywoplot.jpg`, `assets/zwir.jpg`, `assets/las.jpg`, 512×512, < 150 KB każda; `assets/*.png` ignorowane przez git.
- Grubość żywopłotu: `sc = max(1, round(kom / 2))`.
- `MIN_KOMORKA_PX = 12` (bez zmian); `limitRozmiaru` zwraca min. 2.
- Kolory zastępcze: żywopłot `#2f4a2a`, żwir `#b8a27f`, las `#0d1410`; obrys `#0b0d10`.
- `KOMOREK_NA_KAFEL = 3`, `KAFEL_LASU_PX = 256`.
- Komentarze i identyfikatory po polsku, jak w istniejącym kodzie.
- Każde zadanie kończy się zielonym `node --test` i commitem.

## Review Focus

1. **Tekstura się nie wczyta** (404, brak sieci) → gra działa z kolorem zastępczym, bez wyjątku. Testy: Zadanie 4 (loader zwraca `null`), Zadanie 5 (render z `null`).
2. **Okno zmniejszone w trakcie poziomu** (rozmiar labiryntu ustalony przy starcie poziomu) → plansza nadal mieści się w oknie, komórka spada poniżej 12 px. Test: Zadanie 2 (N=30 w 200×200).
3. **Bardzo małe okno** → `uklad` nie zapętla się i zwraca `kom ≥ 1`; `limitRozmiaru` zwraca 2. Test: Zadanie 2.
4. **Labirynt prostokątny** (pomylone x/y w geometrii) → pasy i przejścia zgodne z maskami. Test: Zadanie 3 (labirynt 8×6).
5. **Mgła w narożnikach na brzegu planszy** (mniej niż 4 sąsiadów) → poprawny stan, brak indeksów −1. Test: Zadanie 3.

---

## Struktura plików

| Plik | Zmiana | Odpowiedzialność |
|---|---|---|
| `assets/zywoplot.jpg`, `assets/zwir.jpg`, `assets/las.jpg` | Create | Zoptymalizowane tekstury |
| `src/uklad.js` | Create | Geometria układu blokowego, pola siatki, stan mgły pól |
| `src/tekstury.js` | Create | Ładowanie tekstur → `{ zywoplot, zwir, las }` (obraz lub `null`) |
| `src/game.js` | Modify `:1-21` | `limitRozmiaru` z pasami żywopłotu |
| `src/render.js` | Rewrite | Las, polana, żywopłot, mgła, przedmioty z obrysem |
| `src/main.js` | Modify | Ładowanie tekstur, rysowanie tła na całym canvasie |
| `style.css` | Modify | Tło strony i przezroczystość nakładek pod las |
| `tests/uklad.test.js`, `tests/tekstury.test.js`, `tests/render.test.js` | Create | Testy nowych modułów |
| `tests/game.test.js` | Modify `:94` | Nowy wzór `limitRozmiaru` |
| `README.md`, `wymagania.md`, spec | Modify | Dokumentacja |

---

### Task 1: Zoptymalizowane tekstury JPG

**Files:**
- Create: `assets/zywoplot.jpg`, `assets/zwir.jpg`, `assets/las.jpg`
- Modify: `README.md`

**Interfaces:**
- Produces: pliki `assets/{zywoplot,zwir,las}.jpg` (512×512) używane w Zadaniu 4.

- [ ] **Step 1: Wygeneruj JPG z lokalnych PNG**

Run:
```bash
cd /root/vibe-coding/day3 && python3 -c "
from PIL import Image
for n in ('zywoplot', 'zwir', 'las'):
    Image.open(f'assets/{n}.png').convert('RGB').resize((512, 512), Image.LANCZOS).save(f'assets/{n}.jpg', quality=85, optimize=True)
"
```

- [ ] **Step 2: Sprawdź rozmiary**

Run: `ls -l assets/*.jpg && file assets/*.jpg`
Expected: trzy pliki 512×512, każdy < 150 000 B. Jeśli któryś jest większy — powtórz Step 1 z `quality=78`.

- [ ] **Step 3: Dopisz instrukcję do README**

W `README.md` po sekcji `### Testy` dodaj:

````markdown
### Grafiki

Tekstury w `assets/*.jpg` powstają z większych PNG (prompty w `assets/prompty/`, PNG nie trafiają do repo):

```sh
python3 -c "
from PIL import Image
for n in ('zywoplot', 'zwir', 'las'):
    Image.open(f'assets/{n}.png').convert('RGB').resize((512, 512), Image.LANCZOS).save(f'assets/{n}.jpg', quality=85, optimize=True)
"
```
````

- [ ] **Step 4: Commit**

```bash
git add assets/*.jpg README.md
git status -s   # upewnij się, że żaden assets/*.png nie jest dodany
git commit -m "Tekstury ogrodu: żywopłot, żwir, las (JPG 512×512)"
```

---

### Task 2: Geometria układu blokowego i nowy `limitRozmiaru`

**Files:**
- Create: `src/uklad.js`
- Modify: `src/game.js:1-21`
- Test: `tests/uklad.test.js` (nowy), `tests/game.test.js:94`

**Interfaces:**
- Produces (`src/uklad.js`):
  - `gruboscZywoplotu(kom: number) → number`
  - `dlugoscPlanszy(n: number, kom: number) → number`
  - `uklad(labirynt, szerokoscPx, wysokoscPx) → { kom, sc, ox, oy, szer, wys }`
  - `pas(u, g: number, o: number) → { start: number, dl: number }` — pas siatki `g` wzdłuż osi z początkiem `o` (parzysty = żywopłot, nieparzysty = ścieżka)
- Produces (`src/game.js`): `limitRozmiaru(szerokoscPx, wysokoscPx) → number` (nowy wzór)

- [ ] **Step 1: Napisz testy geometrii**

Utwórz `tests/uklad.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gruboscZywoplotu, dlugoscPlanszy, uklad, pas } from '../src/uklad.js';

const lab = (szerokosc, wysokosc) => ({ szerokosc, wysokosc });

test('grubość żywopłotu: połowa ścieżki, co najmniej 1 px', () => {
  assert.equal(gruboscZywoplotu(12), 6);
  assert.equal(gruboscZywoplotu(13), 7);
  assert.equal(gruboscZywoplotu(1), 1);
  assert.equal(dlugoscPlanszy(8, 12), 8 * 12 + 9 * 6);
});

test('układ: plansza mieści się, jest wycentrowana, komórka największa możliwa', () => {
  const obszary = [[600, 480], [1920, 1000], [320, 640], [200, 200]];
  for (const [w, h] of obszary) {
    for (const [n, m] of [[2, 2], [8, 8], [26, 26], [30, 30], [8, 6]]) {
      const u = uklad(lab(n, m), w, h);
      assert.ok(u.kom >= 1);
      assert.equal(u.sc, gruboscZywoplotu(u.kom));
      assert.equal(u.szer, dlugoscPlanszy(n, u.kom));
      assert.equal(u.wys, dlugoscPlanszy(m, u.kom));
      assert.ok(u.szer <= w && u.wys <= h, `${n}×${m} nie mieści się w ${w}×${h}`);
      assert.equal(u.ox, Math.floor((w - u.szer) / 2));
      assert.equal(u.oy, Math.floor((h - u.wys) / 2));
      assert.ok(dlugoscPlanszy(n, u.kom + 1) > w || dlugoscPlanszy(m, u.kom + 1) > h, 'komórka mogła być większa');
    }
  }
});

test('układ: okno zmniejszone w trakcie poziomu — duży labirynt nadal się mieści', () => {
  const u = uklad(lab(30, 30), 200, 200);
  assert.ok(u.kom < 12);
  assert.ok(u.szer <= 200 && u.wys <= 200);
});

test('układ: bardzo małe okno — bez zapętlenia, kom = 1', () => {
  const u = uklad(lab(30, 30), 10, 10);
  assert.equal(u.kom, 1);
  assert.equal(u.sc, 1);
});

test('pas: naprzemiennie żywopłot i ścieżka, ostatni pas kończy planszę', () => {
  const u = { kom: 12, sc: 6 };
  assert.deepEqual(pas(u, 0, 0), { start: 0, dl: 6 });
  assert.deepEqual(pas(u, 1, 0), { start: 6, dl: 12 });
  assert.deepEqual(pas(u, 2, 0), { start: 18, dl: 6 });
  assert.deepEqual(pas(u, 3, 10), { start: 34, dl: 12 });
  const ostatni = pas(u, 16, 0);
  assert.equal(ostatni.start + ostatni.dl, dlugoscPlanszy(8, 12));
});
```

W `tests/game.test.js` zamień linię 94:

```js
  assert.equal(limitRozmiaru(600, 480), Math.floor(480 / MIN_KOMORKA_PX));
```

na:

```js
  assert.equal(limitRozmiaru(600, 480), 26); // 26·12 + 27·6 = 474 ≤ 480, 27 komórek = 492
  for (const bok of [100, 480, 731, 1400]) {
    const n = limitRozmiaru(bok, bok + 50);
    assert.ok(dlugoscPlanszy(n, MIN_KOMORKA_PX) <= bok, `limit ${n} nie mieści się w ${bok}`);
    assert.ok(dlugoscPlanszy(n + 1, MIN_KOMORKA_PX) > bok, `limit ${n} za mały dla ${bok}`);
  }
  assert.equal(limitRozmiaru(10, 10), 2);
```

i dopisz import na górze `tests/game.test.js` (po imporcie z `../src/maze.js`):

```js
import { dlugoscPlanszy } from '../src/uklad.js';
```

- [ ] **Step 2: Uruchom testy — mają nie przejść**

Run: `node --test`
Expected: FAIL — `Cannot find module '.../src/uklad.js'`.

- [ ] **Step 3: Utwórz `src/uklad.js`**

```js
// Geometria planszy w układzie blokowym: ścieżki przedzielone pasami żywopłotu. Bez DOM i window.

/** Grubość pasa żywopłotu dla boku komórki `kom` — połowa ścieżki, co najmniej 1 px. */
export function gruboscZywoplotu(kom) {
  return Math.max(1, Math.round(kom / 2));
}

/** Długość planszy w px dla `n` komórek o boku `kom`: n ścieżek + (n + 1) pasów żywopłotu. */
export function dlugoscPlanszy(n, kom) {
  return n * kom + (n + 1) * gruboscZywoplotu(kom);
}

/** Największy całkowity bok komórki, przy którym plansza mieści się w obszarze; plansza wycentrowana. */
export function uklad(labirynt, szerokoscPx, wysokoscPx) {
  const { szerokosc: n, wysokosc: m } = labirynt;
  let kom = Math.max(1, Math.floor(Math.min(szerokoscPx / n, wysokoscPx / m)));
  while (kom > 1 && (dlugoscPlanszy(n, kom) > szerokoscPx || dlugoscPlanszy(m, kom) > wysokoscPx)) kom--;
  const szer = dlugoscPlanszy(n, kom);
  const wys = dlugoscPlanszy(m, kom);
  return {
    kom,
    sc: gruboscZywoplotu(kom),
    ox: Math.floor((szerokoscPx - szer) / 2),
    oy: Math.floor((wysokoscPx - wys) / 2),
    szer,
    wys,
  };
}

/** Początek i długość pasa siatki `g` wzdłuż osi zaczynającej się w `o` (parzysty = żywopłot, nieparzysty = ścieżka). */
export function pas(u, g, o) {
  const j = Math.floor(g / 2);
  return g % 2 === 0
    ? { start: o + j * (u.kom + u.sc), dl: u.sc }
    : { start: o + u.sc + j * (u.kom + u.sc), dl: u.kom };
}
```

- [ ] **Step 4: Zmień `limitRozmiaru` w `src/game.js`**

Po linii 2 (import z `./maze.js`) dodaj:

```js
import { dlugoscPlanszy } from './uklad.js';
```

Zamień linie 18–21:

```js
/** Największy rozmiar siatki, przy którym komórka ma co najmniej MIN_KOMORKA_PX. */
export function limitRozmiaru(szerokoscPx, wysokoscPx) {
  return Math.max(2, Math.floor(Math.min(szerokoscPx, wysokoscPx) / MIN_KOMORKA_PX));
}
```

na:

```js
/** Największy rozmiar siatki, przy którym komórka ma co najmniej MIN_KOMORKA_PX (z pasami żywopłotu). */
export function limitRozmiaru(szerokoscPx, wysokoscPx) {
  const bok = Math.min(szerokoscPx, wysokoscPx);
  let n = 2;
  while (dlugoscPlanszy(n + 1, MIN_KOMORKA_PX) <= bok) n++;
  return n;
}
```

- [ ] **Step 5: Uruchom testy**

Run: `node --test`
Expected: PASS — wszystkie (16 dotychczasowych + 5 nowych).

- [ ] **Step 6: Commit**

```bash
git add src/uklad.js src/game.js tests/uklad.test.js tests/game.test.js
git commit -m "Geometria układu blokowego z żywopłotem i nowy limit rozmiaru planszy"
```

---

### Task 3: Pola siatki i stan mgły pól

**Files:**
- Modify: `src/uklad.js`
- Test: `tests/uklad.test.js`

**Interfaces:**
- Consumes: `indeks(lab, x, y)`, `E`, `S` z `src/maze.js`
- Produces (`src/uklad.js`):
  - `kafle(labirynt) → Array<{ gx: number, gy: number, zywoplot: boolean, sasiedzi: number[] }>` — wszystkie pola siatki (2N+1)×(2M+1) wierszami; `sasiedzi` to indeksy komórek (bez −1), od których pole bierze stan mgły
  - `stanPola(sasiedzi: number[], odkryte: Set<number>, widoczne: Set<number>) → 'widoczne' | 'odkryte' | 'nieodkryte'`

- [ ] **Step 1: Dopisz testy**

Na górze `tests/uklad.test.js` rozszerz importy:

```js
import { gruboscZywoplotu, dlugoscPlanszy, uklad, pas, kafle, stanPola } from '../src/uklad.js';
import { generujLabirynt, indeks, E, S } from '../src/maze.js';
import { mulberry32 } from './helpers.js';
```

Na końcu pliku dopisz:

```js
test('kafle: siatka (2N+1)×(2M+1), przejścia zgodne z maskami, labirynt prostokątny', () => {
  const l = generujLabirynt(8, 6, mulberry32(7));
  const pola = kafle(l);
  assert.equal(pola.length, 17 * 13);
  const pole = (gx, gy) => pola[gy * 17 + gx];

  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 8; x++) {
      const i = indeks(l, x, y);
      const k = pole(2 * x + 1, 2 * y + 1);
      assert.equal(k.zywoplot, false);
      assert.deepEqual(k.sasiedzi, [i]);
      if (x < 7) assert.equal(pole(2 * x + 2, 2 * y + 1).zywoplot, !(l.przejscia[i] & E));
      if (y < 5) assert.equal(pole(2 * x + 1, 2 * y + 2).zywoplot, !(l.przejscia[i] & S));
    }
  }
  // labirynt doskonały: przejść między komórkami = komórek − 1
  const przejscia = pola.filter((p) => !p.zywoplot && (p.gx % 2 === 0 || p.gy % 2 === 0));
  assert.equal(przejscia.length, 8 * 6 - 1);
  // narożniki i obwód zawsze żywopłot
  for (const p of pola) {
    if (p.gx % 2 === 0 && p.gy % 2 === 0) assert.ok(p.zywoplot, `narożnik ${p.gx},${p.gy}`);
    if (p.gx === 0 || p.gy === 0 || p.gx === 16 || p.gy === 12) assert.ok(p.zywoplot, `obwód ${p.gx},${p.gy}`);
  }
});

test('kafle: sąsiedzi pól żywopłotu, także na brzegu planszy', () => {
  const l = generujLabirynt(8, 6, mulberry32(7));
  const pola = kafle(l);
  const pole = (gx, gy) => pola[gy * 17 + gx];
  assert.deepEqual(pole(0, 0).sasiedzi, [indeks(l, 0, 0)]);
  assert.deepEqual(pole(16, 12).sasiedzi, [indeks(l, 7, 5)]);
  assert.deepEqual(pole(2, 0).sasiedzi, [indeks(l, 0, 0), indeks(l, 1, 0)]);
  assert.deepEqual(pole(2, 2).sasiedzi, [indeks(l, 0, 0), indeks(l, 1, 0), indeks(l, 0, 1), indeks(l, 1, 1)]);
  assert.deepEqual(pole(1, 0).sasiedzi, [indeks(l, 0, 0)]);
  assert.deepEqual(pole(2, 1).sasiedzi, [indeks(l, 0, 0), indeks(l, 1, 0)]);
  for (const p of pola) assert.ok(p.sasiedzi.length > 0 && p.sasiedzi.every((i) => i >= 0));
});

test('stan pola: widoczne ma pierwszeństwo, brak sąsiadów = nieodkryte', () => {
  const odkryte = new Set([1, 2]);
  const widoczne = new Set([2]);
  assert.equal(stanPola([1, 2], odkryte, widoczne), 'widoczne');
  assert.equal(stanPola([1, 5], odkryte, widoczne), 'odkryte');
  assert.equal(stanPola([5, 6], odkryte, widoczne), 'nieodkryte');
  assert.equal(stanPola([], odkryte, widoczne), 'nieodkryte');
});
```

- [ ] **Step 2: Uruchom testy — mają nie przejść**

Run: `node --test tests/uklad.test.js`
Expected: FAIL — `kafle is not a function` / brak eksportu `kafle`.

- [ ] **Step 3: Dopisz `kafle` i `stanPola` do `src/uklad.js`**

Na górze pliku, pod komentarzem, dodaj import:

```js
import { E, S, indeks } from './maze.js';
```

Na końcu pliku dopisz:

```js
/**
 * Pola siatki (2N+1)×(2M+1), wierszami: { gx, gy, zywoplot, sasiedzi }.
 * Nieparzyste gx i gy — komórka; jedno parzyste — pas między dwiema komórkami (żwir przy przejściu);
 * oba parzyste — narożnik (zawsze żywopłot). `sasiedzi` — komórki, od których pole bierze stan mgły.
 */
export function kafle(labirynt) {
  const { szerokosc: n, wysokosc: m, przejscia } = labirynt;
  const komorka = (x, y) => (x >= 0 && y >= 0 && x < n && y < m ? indeks(labirynt, x, y) : -1);
  const wynik = [];
  for (let gy = 0; gy <= 2 * m; gy++) {
    for (let gx = 0; gx <= 2 * n; gx++) {
      let zywoplot;
      let sasiedzi;
      if (gx % 2 === 1 && gy % 2 === 1) {
        zywoplot = false;
        sasiedzi = [komorka((gx - 1) / 2, (gy - 1) / 2)];
      } else if (gx % 2 === 1) {
        // pas poziomy między komórką powyżej a poniżej
        const x = (gx - 1) / 2;
        const gora = komorka(x, gy / 2 - 1);
        const dol = komorka(x, gy / 2);
        zywoplot = gora === -1 || dol === -1 || !(przejscia[gora] & S);
        sasiedzi = [gora, dol];
      } else if (gy % 2 === 1) {
        // pas pionowy między komórką z lewej a z prawej
        const y = (gy - 1) / 2;
        const lewa = komorka(gx / 2 - 1, y);
        const prawa = komorka(gx / 2, y);
        zywoplot = lewa === -1 || prawa === -1 || !(przejscia[lewa] & E);
        sasiedzi = [lewa, prawa];
      } else {
        zywoplot = true;
        sasiedzi = [
          komorka(gx / 2 - 1, gy / 2 - 1), komorka(gx / 2, gy / 2 - 1),
          komorka(gx / 2 - 1, gy / 2), komorka(gx / 2, gy / 2),
        ];
      }
      wynik.push({ gx, gy, zywoplot, sasiedzi: sasiedzi.filter((i) => i !== -1) });
    }
  }
  return wynik;
}

/** Stan mgły pola: widoczne, jeśli widać którąkolwiek sąsiednią komórkę; odkryte, jeśli którąkolwiek odkryto. */
export function stanPola(sasiedzi, odkryte, widoczne) {
  if (sasiedzi.some((i) => widoczne.has(i))) return 'widoczne';
  if (sasiedzi.some((i) => odkryte.has(i))) return 'odkryte';
  return 'nieodkryte';
}
```

- [ ] **Step 4: Uruchom testy**

Run: `node --test`
Expected: PASS — wszystkie.

- [ ] **Step 5: Commit**

```bash
git add src/uklad.js tests/uklad.test.js
git commit -m "Pola siatki blokowej i stan mgły dla żywopłotu"
```

---

### Task 4: Ładowanie tekstur

**Files:**
- Create: `src/tekstury.js`
- Test: `tests/tekstury.test.js`

**Interfaces:**
- Consumes: pliki z Zadania 1.
- Produces (`src/tekstury.js`):
  - `PLIKI = { zywoplot: 'assets/zywoplot.jpg', zwir: 'assets/zwir.jpg', las: 'assets/las.jpg' }`
  - `BEZ_TEKSTUR = { zywoplot: null, zwir: null, las: null }`
  - `wczytajTekstury(pliki = PLIKI, utworzObraz = () => new Image()) → Promise<{ zywoplot, zwir, las }>` — każda wartość to obraz albo `null`; Promise nigdy nie jest odrzucany.

- [ ] **Step 1: Napisz testy**

Utwórz `tests/tekstury.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wczytajTekstury, PLIKI, BEZ_TEKSTUR } from '../src/tekstury.js';

/** Atrapa Image: po ustawieniu src asynchronicznie woła onload albo onerror. */
function atrapaObrazu(czyUdany) {
  return () => {
    const obraz = {
      onload: null,
      onerror: null,
      set src(v) {
        this._src = v;
        queueMicrotask(() => (czyUdany(v) ? this.onload() : this.onerror()));
      },
      get src() { return this._src; },
    };
    return obraz;
  };
}

test('tekstury: wszystkie wczytane, ścieżki względne', async () => {
  const t = await wczytajTekstury(PLIKI, atrapaObrazu(() => true));
  assert.deepEqual(Object.keys(t).sort(), ['las', 'zwir', 'zywoplot']);
  for (const [nazwa, sciezka] of Object.entries(PLIKI)) {
    assert.equal(t[nazwa].src, sciezka);
    assert.ok(!sciezka.startsWith('/'), 'ścieżka musi być względna (GitHub Pages)');
  }
});

test('tekstury: błąd wczytania daje null, reszta działa, Promise nie jest odrzucany', async () => {
  const t = await wczytajTekstury(PLIKI, atrapaObrazu((src) => !src.includes('las')));
  assert.equal(t.las, null);
  assert.ok(t.zywoplot && t.zwir);
  assert.deepEqual(BEZ_TEKSTUR, { zywoplot: null, zwir: null, las: null });
});
```

- [ ] **Step 2: Uruchom testy — mają nie przejść**

Run: `node --test tests/tekstury.test.js`
Expected: FAIL — `Cannot find module '.../src/tekstury.js'`.

- [ ] **Step 3: Utwórz `src/tekstury.js`**

```js
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
```

- [ ] **Step 4: Uruchom testy**

Run: `node --test`
Expected: PASS — wszystkie.

- [ ] **Step 5: Commit**

```bash
git add src/tekstury.js tests/tekstury.test.js
git commit -m "Ładowanie tekstur z kolorami zastępczymi przy błędzie"
```

---

### Task 5: Nowy renderer i spięcie w `main.js`

**Files:**
- Rewrite: `src/render.js`
- Modify: `src/main.js`, `style.css`
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: `uklad`, `pas`, `kafle`, `stanPola` (`src/uklad.js`); `wczytajTekstury`, `BEZ_TEKSTUR` (`src/tekstury.js`); `indeks` (`src/maze.js`)
- Produces (`src/render.js`):
  - `dopasujCanvas(canvas, szerokoscCss, wysokoscCss, dpr) → ctx` (bez zmian)
  - `rysujTlo(ctx, szerokoscCss, wysokoscCss, tekstury)` — las na całym obszarze
  - `rysuj(ctx, stan, szerokoscCss, wysokoscCss, tekstury)` — polana, żywopłot, mgła, przedmioty; `stan === null` → nic

- [ ] **Step 1: Napisz test dymny renderera**

Utwórz `tests/render.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rysuj, rysujTlo } from '../src/render.js';
import { nowyPoziom } from '../src/game.js';
import { BEZ_TEKSTUR } from '../src/tekstury.js';
import { mulberry32 } from './helpers.js';

/** Atrapa kontekstu 2D: zapisuje nazwy wywołanych metod, createPattern zwraca wzór ze skalą. */
function atrapaCtx() {
  const cel = {
    wywolania: [],
    skale: [],
    createPattern() {
      return { setTransform: (m) => cel.skale.push(m.a) };
    },
  };
  return new Proxy(cel, {
    get(c, klucz) {
      if (klucz in c) return c[klucz];
      return () => c.wywolania.push(klucz);
    },
    set(c, klucz, wartosc) {
      c[klucz] = wartosc;
      return true;
    },
  });
}

test('render: bez tekstur (błąd wczytania) rysuje kolorami zastępczymi, także we mgle', () => {
  for (const poziom of [1, 3]) {
    const ctx = atrapaCtx();
    rysujTlo(ctx, 800, 600, BEZ_TEKSTUR);
    rysuj(ctx, nowyPoziom(poziom, 30, mulberry32(5)), 784, 584, BEZ_TEKSTUR);
    assert.ok(ctx.wywolania.includes('fillRect'));
    assert.ok(ctx.wywolania.includes('rect'));
    assert.equal(ctx.skale.length, 0);
  }
});

test('render: tekstury skalowane — las stały kafel, żwir i żywopłot względem komórki', () => {
  const obraz = { width: 512, height: 512 };
  const tekstury = { zywoplot: obraz, zwir: obraz, las: obraz };
  const ctx = atrapaCtx();
  rysujTlo(ctx, 800, 600, tekstury);
  assert.equal(ctx.skale[0], 256 / 512);
  rysuj(ctx, nowyPoziom(1, 30, mulberry32(5)), 784, 584, tekstury);
  assert.equal(ctx.skale.length, 3);
  assert.equal(ctx.skale[1], ctx.skale[2]);
});

test('render: ekran startowy (stan null) nie rysuje planszy', () => {
  const ctx = atrapaCtx();
  rysuj(ctx, null, 784, 584, BEZ_TEKSTUR);
  assert.deepEqual(ctx.wywolania, []);
});
```

- [ ] **Step 2: Uruchom testy — mają nie przejść**

Run: `node --test tests/render.test.js`
Expected: FAIL — `rysujTlo` nie jest eksportowany.

- [ ] **Step 3: Przepisz `src/render.js`**

Całą zawartość pliku zastąp:

```js
// Rysowanie stanu gry na canvasie: las, polana ze żwiru, żywopłot, mgła, przedmioty.
import { indeks } from './maze.js';
import { uklad, pas, kafle, stanPola } from './uklad.js';

const KOLORY = {
  las: '#0d1410',
  zwir: '#b8a27f',
  zywoplot: '#2f4a2a',
  cien: 'rgba(0, 0, 0, 0.6)',
  mgla: '#07090d',
  przyciemnienie: 'rgba(7, 9, 13, 0.55)',
  obrys: '#0b0d10',
  gracz: '#4fc3ff',
  klucz: '#ffd23f',
  drzwiZamkniete: '#ff6b6b',
  drzwiOtwarte: '#5ee08a',
};

/** Ile komórek (ścieżka + pas żywopłotu) obejmuje jeden kafel tekstury żwiru i żywopłotu. */
const KOMOREK_NA_KAFEL = 3;
/** Bok kafla tekstury lasu w px CSS — stały, żeby tło nie zmieniało skali między poziomami. */
const KAFEL_LASU_PX = 256;

const gruboscObrysu = (kom) => Math.max(1, kom * 0.06);

/** Ustawia rozmiar canvasu pod okno z uwzględnieniem devicePixelRatio. Zwraca kontekst 2D. */
export function dopasujCanvas(canvas, szerokoscCss, wysokoscCss, dpr) {
  canvas.style.width = `${szerokoscCss}px`;
  canvas.style.height = `${wysokoscCss}px`;
  canvas.width = Math.round(szerokoscCss * dpr);
  canvas.height = Math.round(wysokoscCss * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** Wzór z tekstury, w którym jeden kafel ma `bokPx`; bez tekstury — kolor zastępczy. */
function wypelnienie(ctx, obraz, bokPx, kolor) {
  if (!obraz) return kolor;
  const wzor = ctx.createPattern(obraz, 'repeat');
  const skala = bokPx / obraz.width;
  wzor.setTransform({ a: skala, b: 0, c: 0, d: skala, e: 0, f: 0 });
  return wzor;
}

/** Las na całym obszarze — tło pod planszą i ekranami. */
export function rysujTlo(ctx, szerokoscCss, wysokoscCss, tekstury) {
  ctx.fillStyle = wypelnienie(ctx, tekstury.las, KAFEL_LASU_PX, KOLORY.las);
  ctx.fillRect(0, 0, szerokoscCss, wysokoscCss);
}

export function rysuj(ctx, stan, szerokoscCss, wysokoscCss, tekstury) {
  if (!stan) return;

  const { labirynt, odkryte, widoczne } = stan;
  const u = uklad(labirynt, szerokoscCss, wysokoscCss);
  const bokKafla = KOMOREK_NA_KAFEL * (u.kom + u.sc);
  const komX = (x) => pas(u, 2 * x + 1, u.ox).start;
  const komY = (y) => pas(u, 2 * y + 1, u.oy).start;
  const pola = kafle(labirynt);
  const prostokat = (p) => {
    const a = pas(u, p.gx, u.ox);
    const b = pas(u, p.gy, u.oy);
    return [a.start, b.start, a.dl, b.dl];
  };
  const wypelnijPola = (warunek, styl) => {
    ctx.beginPath();
    for (let k = 0; k < pola.length; k++) if (warunek(k)) ctx.rect(...prostokat(pola[k]));
    ctx.fillStyle = styl;
    ctx.fill();
  };

  // Polana: żwir pod całą planszą, z miękkim cieniem na las
  ctx.save();
  ctx.shadowColor = KOLORY.cien;
  ctx.shadowBlur = Math.max(8, u.sc * 2);
  ctx.fillStyle = wypelnienie(ctx, tekstury.zwir, bokKafla, KOLORY.zwir);
  ctx.fillRect(u.ox, u.oy, u.szer, u.wys);
  ctx.restore();

  // Żywopłot
  wypelnijPola((k) => pola[k].zywoplot, wypelnienie(ctx, tekstury.zywoplot, bokKafla, KOLORY.zywoplot));

  // Drzwi i klucz — tylko na odkrytych polach
  const odkrytePole = (p) => odkryte.has(indeks(labirynt, p.x, p.y));
  if (odkrytePole(stan.wyjscie)) rysujDrzwi(ctx, komX(stan.wyjscie.x), komY(stan.wyjscie.y), u.kom, stan.maKlucz);
  if (!stan.maKlucz && odkrytePole(stan.klucz)) rysujKlucz(ctx, komX(stan.klucz.x), komY(stan.klucz.y), u.kom);

  // Mgła: nieodkryte pola zakryte, odkryte poza zasięgiem przyciemnione (żywopłot też)
  const stany = pola.map((p) => stanPola(p.sasiedzi, odkryte, widoczne));
  wypelnijPola((k) => stany[k] === 'nieodkryte', KOLORY.mgla);
  wypelnijPola((k) => stany[k] === 'odkryte', KOLORY.przyciemnienie);

  // Gracz — koło z obrysem
  const g = stan.gracz;
  ctx.beginPath();
  ctx.arc(komX(g.x) + u.kom / 2, komY(g.y) + u.kom / 2, u.kom * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = KOLORY.gracz;
  ctx.fill();
  ctx.lineWidth = gruboscObrysu(u.kom);
  ctx.strokeStyle = KOLORY.obrys;
  ctx.stroke();
}

/** Klucz: kółko (główka) + trzon z ząbkami, z ciemnym obrysem pod spodem. */
function rysujKlucz(ctx, x, y, kom) {
  const s = kom;
  const cy = y + s / 2;
  const linia = Math.max(1.5, s * 0.1);
  ctx.beginPath();
  ctx.arc(x + s * 0.32, cy, s * 0.14, 0, Math.PI * 2);
  ctx.moveTo(x + s * 0.46, cy);
  ctx.lineTo(x + s * 0.8, cy);
  ctx.moveTo(x + s * 0.7, cy);
  ctx.lineTo(x + s * 0.7, cy + s * 0.14);
  ctx.moveTo(x + s * 0.8, cy);
  ctx.lineTo(x + s * 0.8, cy + s * 0.14);
  ctx.lineCap = 'round';
  ctx.strokeStyle = KOLORY.obrys;
  ctx.lineWidth = linia + 2 * gruboscObrysu(s);
  ctx.stroke();
  ctx.strokeStyle = KOLORY.klucz;
  ctx.lineWidth = linia;
  ctx.stroke();
}

/** Drzwi: zamknięte = pełny prostokąt z dziurką od klucza; otwarte = pusta rama z otwartym skrzydłem. Z obrysem. */
function rysujDrzwi(ctx, x, y, kom, otwarte) {
  const s = kom;
  const l = x + s * 0.22;
  const t = y + s * 0.14;
  const w = s * 0.56;
  const h = s * 0.72;
  const rama = Math.max(1.5, s * 0.08);
  const obrys = gruboscObrysu(s);
  if (!otwarte) {
    ctx.fillStyle = KOLORY.drzwiZamkniete;
    ctx.fillRect(l, t, w, h);
    ctx.lineWidth = obrys;
    ctx.strokeStyle = KOLORY.obrys;
    ctx.strokeRect(l, t, w, h);
    ctx.fillStyle = KOLORY.mgla;
    ctx.beginPath();
    ctx.arc(l + w / 2, t + h * 0.45, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(l + w / 2 - s * 0.03, t + h * 0.45, s * 0.06, h * 0.25);
  } else {
    ctx.strokeStyle = KOLORY.obrys;
    ctx.lineWidth = rama + 2 * obrys;
    ctx.strokeRect(l, t, w, h);
    ctx.strokeStyle = KOLORY.drzwiOtwarte;
    ctx.lineWidth = rama;
    ctx.strokeRect(l, t, w, h);
    ctx.beginPath();
    ctx.moveTo(l, t);
    ctx.lineTo(l + w * 0.45, t + h * 0.12);
    ctx.lineTo(l + w * 0.45, t + h * 0.88);
    ctx.lineTo(l, t + h);
    ctx.closePath();
    ctx.fillStyle = KOLORY.drzwiOtwarte;
    ctx.fill();
    ctx.lineWidth = obrys;
    ctx.strokeStyle = KOLORY.obrys;
    ctx.stroke();
  }
}
```

- [ ] **Step 4: Uruchom testy**

Run: `node --test`
Expected: PASS — wszystkie.

- [ ] **Step 5: Spięcie w `src/main.js`**

Zamień linię 3:

```js
import { dopasujCanvas, rysuj } from './render.js';
```

na:

```js
import { dopasujCanvas, rysuj, rysujTlo } from './render.js';
import { wczytajTekstury, BEZ_TEKSTUR } from './tekstury.js';
```

Pod `let timerKomunikatu = 0;` dodaj:

```js
let tekstury = BEZ_TEKSTUR;
```

Zamień funkcję `odswiez`:

```js
function odswiez() {
  if (!ctx) return;
  ctx.save();
  ctx.translate(MARGINES, MARGINES);
  rysuj(ctx, ekran === 'start' ? null : stan, wymiary.w - 2 * MARGINES, wymiary.h - 2 * MARGINES);
  ctx.restore();
  aktualizujHud();
}
```

na:

```js
function odswiez() {
  if (!ctx) return;
  rysujTlo(ctx, wymiary.w, wymiary.h, tekstury);
  ctx.save();
  ctx.translate(MARGINES, MARGINES);
  rysuj(ctx, ekran === 'start' ? null : stan, wymiary.w - 2 * MARGINES, wymiary.h - 2 * MARGINES, tekstury);
  ctx.restore();
  aktualizujHud();
}
```

Na końcu pliku, po `pokazEkran('start');`, dodaj:

```js
// Tekstury dochodzą w tle; do tego czasu (i przy błędzie) renderer używa kolorów zastępczych.
wczytajTekstury().then((wczytane) => {
  tekstury = wczytane;
  odswiez();
});
```

- [ ] **Step 6: Las widoczny pod nakładkami — `style.css`**

W `:root` zamień `--tlo: #10131a;` na `--tlo: #0d1410;`.
W `.nakladka` zamień `background: rgba(8, 10, 15, 0.82);` na `background: rgba(8, 12, 10, 0.6);`.

- [ ] **Step 7: Sprawdzenie w przeglądarce**

Run (w tle): `python3 -m http.server 8000` w `/root/vibe-coding/day3`, otwórz `http://192.168.0.183:8000` (Ctrl+F5).
Sprawdź:
- ekran startowy: las widoczny przez półprzezroczystą nakładkę;
- poziom 1: żwirowe ścieżki, żywopłot o połowę węższy niż ścieżka, obwód z żywopłotu, cień na granicy z lasem, brak widocznych szwów;
- klucz, drzwi (zamknięte i otwarte) i gracz czytelne na żwirze;
- poziom 3: mgła zakrywa też żywopłot, odkryte pola poza zasięgiem przyciemnione;
- zmiana rozmiaru okna (także mocne zmniejszenie w trakcie poziomu) — plansza się mieści;
- tymczasowo zmień nazwę `assets/las.jpg` → gra działa, tło ciemnozielone; przywróć plik;
- konsola przeglądarki (F12) bez błędów.

- [ ] **Step 8: Commit**

```bash
git add src/render.js src/main.js style.css tests/render.test.js
git commit -m "Renderer ogrodu: las, żwir, żywopłot w układzie blokowym, mgła i obrysy"
```

---

### Task 6: Dokumentacja i publikacja

**Files:**
- Modify: `wymagania.md` (§3, §10, §11, §12), `docs/superpowers/specs/2026-10-13-tekstury-ogrod-design.md`

**Interfaces:**
- Consumes: wszystko z Zadań 1–5.

- [ ] **Step 1: `wymagania.md` §3 — struktura plików**

Zamień wiersz `src/render.js`:

```markdown
| `src/render.js` | Rysowanie stanu na canvasie |
```

na:

```markdown
| `src/render.js` | Rysowanie stanu na canvasie: las, żwir, żywopłot, mgła, przedmioty |
| `src/uklad.js` | Geometria układu blokowego (żywopłot między ścieżkami), stan mgły pól (bez DOM) |
| `src/tekstury.js` | Ładowanie tekstur z `assets/`, `null` przy błędzie |
| `assets/*.jpg` | Tekstury: żywopłot, żwir, las (512×512); prompty w `assets/prompty/` |
```

Zamień wiersz testów:

```markdown
| `tests/*.test.js` | Testy `maze.js` i `game.js` |
```

na:

```markdown
| `tests/*.test.js` | Testy `maze.js`, `game.js`, `uklad.js`, `tekstury.js` i dymny test `render.js` |
```

i zdanie pod tabelą `` `maze.js` i `game.js` nie mogą odwoływać się do DOM `` zamień na `` `maze.js`, `game.js` i `uklad.js` nie mogą odwoływać się do DOM ``.

- [ ] **Step 2: `wymagania.md` §10 — oprawa**

Zamień dwie pierwsze linie punktu §10:

```markdown
- Minimalistyczna: ściany jako linie, gracz jako koło, klucz i drzwi wyjścia jako proste kształty
  (drzwi wyraźnie inne w stanie zamkniętym i otwartym). Wszystko rysowane w canvasie, bez obrazków i fontów zewnętrznych.
```

na:

```markdown
- Ogród na leśnej polanie, widziany z góry: układ blokowy — ściany to pasy żywopłotu o połowie szerokości
  ścieżki, ścieżki ze żwiru, dookoła planszy las z miękkim cieniem na granicy polany.
- Tekstury jako zoptymalizowane pliki JPG w `assets/` (ścieżki względne); gdy się nie wczytają — kolory
  zastępcze, gra działa dalej. Bez fontów zewnętrznych.
- Gracz jako koło, klucz i drzwi wyjścia jako proste kształty rysowane w canvasie, z ciemnym obrysem
  (drzwi wyraźnie inne w stanie zamkniętym i otwartym). Mgła zakrywa i przyciemnia także żywopłot.
```

W tym samym punkcie zamień `zachowując kwadratowe komórki; ostre linie na ekranach HiDPI` na `zachowując kwadratowe komórki; ostra grafika na ekranach HiDPI`.

- [ ] **Step 3: `wymagania.md` §11 i §12**

W §11 zamień `dźwięk, seed labiryntu, tabela wyników online, motywy graficzne.` na `dźwięk, seed labiryntu, tabela wyników online, przełączanie motywów graficznych.`

W §12, w części automatycznej, po linii `- Zbiór odkrytych tylko rośnie…` dopisz:

```markdown
- Układ blokowy: plansza mieści się w obszarze i jest wycentrowana; żywopłot = połowa ścieżki;
  pola przejść zgodne z maskami labiryntu; narożniki i obwód zawsze żywopłot.
- `limitRozmiaru` uwzględnia pasy żywopłotu (komórka ≥ 12 px).
- Brak tekstury → `null` i rysowanie kolorem zastępczym, bez wyjątku.
```

W części ręcznej dopisz:

```markdown
- Tekstury bez widocznych szwów; klucz, drzwi i gracz czytelne na żwirze; mgła obejmuje żywopłot.
```

- [ ] **Step 4: Specyfikacja — odnotuj odstępstwo**

W `docs/superpowers/specs/2026-10-13-tekstury-ogrod-design.md` w §2 zamień `Nowa czysta funkcja w `src/render.js` (eksportowana do testów):` na `Nowa czysta funkcja w `src/uklad.js` (współdzielona z `limitRozmiaru` w `game.js`):`, a w §4 `Nowa czysta funkcja w `src/render.js`:` na `Nowa czysta funkcja w `src/uklad.js`:`.

- [ ] **Step 5: Pełne testy**

Run: `node --test`
Expected: PASS — wszystkie (16 dotychczasowych + nowe), `# fail 0`.

- [ ] **Step 6: Commit i publikacja**

```bash
git add wymagania.md docs/superpowers/specs/2026-10-13-tekstury-ogrod-design.md
git commit -m "Wymagania i specyfikacja: oprawa ogrodu z teksturami"
git push github main
```

Po ~1 min sprawdź: `gh api repos/kuszmartomasz-hue/Maze/pages/builds/latest --jq .status` → `built`, oraz `curl -s -o /dev/null -w "%{http_code}" https://kuszmartomasz-hue.github.io/Maze/assets/las.jpg` → `200`. Otwórz https://kuszmartomasz-hue.github.io/Maze/ i powtórz skrót sprawdzenia z Zadania 5, Step 7.
