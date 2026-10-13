# Zaklęty Ogród — tabela wyników i wznawianie gry: plan wdrożenia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gra zapisuje wyniki w Supabase (top 10 na ekranie startowym) i pozwala wznowić przerwaną grę w tym samym labiryncie.

**Architecture:** Czyste funkcje w `src/game.js` zamieniają stan gry na JSON i z powrotem (z walidacją) oraz normalizują nick. Nowy `src/baza.js` rozmawia z Supabase przez `fetch` (anonimowa sesja, RPC, tabele), z wstrzykiwanymi zależnościami i bez rzucania wyjątków. `src/input.js` przepuszcza pisanie w polu nicku. `src/main.js` spina zapis stanu, wznowienie i tabelę na ekranie startowym.

**Tech Stack:** HTML + CSS + JavaScript (ES modules), `fetch`, Supabase (Auth + PostgREST), `node --test` (Node ≥ 18).

**Spec:** `docs/superpowers/specs/2026-10-13-wyniki-supabase-design.md`

**Stan bazy:** migracje już wdrożone i przetestowane (`supabase/migrations/`), logowanie anonimowe włączone. Odpowiedzi REST sprawdzone na żywo 2026-10-13:
- `POST /auth/v1/signup` z `{}` → `{ access_token, refresh_token, expires_at (sekundy epoki), expires_in, token_type, user: { id, is_anonymous: true } }`;
- `POST /auth/v1/token?grant_type=refresh_token` → ten sam kształt;
- `POST /rest/v1/rpc/zapisz_wynik` → 204, pusta treść;
- `POST /rest/v1/rpc/moje_miejsce` → `[{ "miejsce": 1, "poziom": 2 }]` (pusta tablica bez wyniku);
- `POST /rest/v1/zapisy` z `Prefer: resolution=merge-duplicates,return=minimal` → 201 (pierwszy), 200 (nadpisanie), pusta treść;
- `GET /rest/v1/zapisy?select=stan` → `[{ "stan": {...} }]`;
- zły token → 401 `PGRST301`.

**Odstępstwo od specyfikacji:** „Nowa gra” (`N`) nie woła `usunStan()` — nowy zapis poziomu 1 i tak nadpisuje wiersz (upsert), a równoległe DELETE + POST mogłyby dojść w odwrotnej kolejności i skasować świeży zapis. `usunStan()` zostaje w API `baza.js` (przetestowane, na przyszłość). Zadanie 5 nanosi to na specyfikację.

## Global Constraints

- Bez bibliotek i bundlera; Supabase tylko przez `fetch`.
- `SUPABASE_URL = 'https://tnqgzkzxzzsaflhjywgb.supabase.co'`, `SUPABASE_KLUCZ = 'sb_publishable_RfoBfZmDXH2nWBTPf-y1-A_PSWDqWjl'`; nigdy klucza `service_role` / `sb_secret_…`.
- Metody `baza.js` nigdy nie rzucają: błąd, brak sieci, przekroczenie 5 s → `null` / `false`.
- Klucze `localStorage`: `labirynt.sesja`, `labirynt.nick` (obok istniejącego `labirynt.najwyzszyPoziom`).
- Nick: 1–20 znaków (punktów kodowych) po obcięciu spacji; pusty → brak wpisu do tabeli.
- Poziom 1–500; wersja zapisu `1`; wymiary labiryntu w zapisie 2–200.
- Zapis po ruchu najwyżej raz na 3000 ms.
- Nicki wstawiane do DOM wyłącznie przez `textContent`.
- `game.js`, `baza.js` — bez DOM i `window` (testowalne w Node; `fetch`/`storage` wstrzykiwane).
- Komentarze i identyfikatory po polsku, jak w istniejącym kodzie.

## Review Focus

1. **Odświeżenie tokenu bez sieci** → gracz NIE dostaje nowej anonimowej tożsamości (straciłby wynik i zapis); nowe logowanie tylko przy odpowiedzi 4xx. Test: Zadanie 2.
2. **Uszkodzony lub spreparowany zapis w bazie** (zła maska, niesymetryczne przejścia, pozycja poza planszą, labirynt niespójny, śmieci) → `stanZZapisu` zwraca `null`, ekran startowy bez „Kontynuuj”, brak wyjątku. Test: Zadanie 1.
3. **Pisanie nicku z literami W/A/S/D/R/N i spacją** → litery trafiają do pola, gra nie reaguje. Test: Zadanie 3.
4. **Nick z emoji, spacjami, > 20 znaków** → obcięcie po punktach kodowych zgodne z `char_length` w bazie (inaczej RPC odrzuci wynik). Test: Zadanie 1.
5. **Baza nie odpowiada (offline, uśpiony projekt, przekroczenie czasu)** → gra grywalna, tabela „chwilowo niedostępna”, brak wyjątków w konsoli. Test: Zadanie 2 (timeout, wyjątek sieci, HTTP 500) + ręcznie w Zadaniu 4.

---

## Struktura plików

| Plik | Zmiana | Odpowiedzialność |
|---|---|---|
| `src/game.js` | Modify | `stanDoZapisu`, `stanZZapisu`, `normalizujNick`, `wczytajNick`, `zapiszNick` |
| `src/konfiguracja.js` | Create | Publiczny adres i klucz Supabase |
| `src/baza.js` | Create | `utworzBaze(...)` — sesja anonimowa, wyniki, zapisy |
| `src/input.js` | Modify | `KeyN` → `nowaGra`; pole tekstowe przepuszcza pisanie |
| `index.html`, `style.css` | Modify | Pole nicku, akcje startu/wznowienia, tabela wyników |
| `src/main.js` | Modify | Zapis stanu, wznowienie, tabela, nick |
| `tests/zapis.test.js`, `tests/baza.test.js`, `tests/input.test.js` | Create | Testy |
| `tests/helpers.js` | Modify | `removeItem` w `pamiecStorage` |
| `wymagania.md`, spec | Modify | Dokumentacja |

---

### Task 1: Zapis i odtworzenie stanu, nick

**Files:**
- Modify: `src/game.js` (import w linii 2; nowe funkcje na końcu pliku)
- Modify: `tests/helpers.js`
- Test: `tests/zapis.test.js` (nowy)

**Interfaces:**
- Consumes: `nowyPoziom`, `czyMgla`, `aktualizujWidocznosc` (wewnętrzna w `game.js`), `odleglosci`, `indeks`, `pozycjaZIndeksu`, `wSiatce`, `KIERUNKI` z `maze.js`
- Produces (`src/game.js`):
  - `WERSJA_ZAPISU = 1`, `MAX_POZIOM = 500`, `KLUCZ_NICKU = 'labirynt.nick'`, `MAX_NICK = 20`
  - `stanDoZapisu(stan) → object` — pełny zapis albo `{ wersja: 1, poziom: N + 1, nowy: true }` dla ukończonego poziomu
  - `stanZZapisu(dane, limit = Infinity, rng = Math.random) → stan | null`
  - `normalizujNick(tekst) → string | null`
  - `wczytajNick(storage) → string | null`, `zapiszNick(storage, nick: string | null) → void`

- [ ] **Step 1: Dodaj `removeItem` do atrapy storage**

W `tests/helpers.js` w obiekcie zwracanym przez `pamiecStorage` dopisz po `setItem`:

```js
    removeItem: (k) => { delete dane[k]; },
```

- [ ] **Step 2: Napisz testy**

Utwórz `tests/zapis.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nowyPoziom, ruch, rozmiarPoziomu, stanDoZapisu, stanZZapisu,
  normalizujNick, wczytajNick, zapiszNick, KLUCZ_NICKU, RUCHY,
} from '../src/game.js';
import { E, W } from '../src/maze.js';
import { mulberry32, pamiecStorage } from './helpers.js';

/** Stan po kilku ruchach (żeby odkryte i pozycja różniły się od startowych). */
function rozegrany(poziom, ziarno) {
  const s = nowyPoziom(poziom, 30, mulberry32(ziarno));
  for (let i = 0; i < 40; i++) ruch(s, Object.keys(RUCHY)[i % 4]);
  s.ukonczony = false;
  return s;
}

const przezJson = (o) => JSON.parse(JSON.stringify(o));

test('zapis stanu: wierne odtworzenie we mgle (poziom 3)', () => {
  const s = rozegrany(3, 11);
  const t = stanZZapisu(przezJson(stanDoZapisu(s)));
  assert.ok(t);
  assert.equal(t.poziom, 3);
  assert.equal(t.mgla, true);
  assert.deepEqual(Array.from(t.labirynt.przejscia), Array.from(s.labirynt.przejscia));
  assert.equal(t.labirynt.szerokosc, s.labirynt.szerokosc);
  assert.deepEqual(t.gracz, s.gracz);
  assert.deepEqual(t.klucz, s.klucz);
  assert.deepEqual(t.wyjscie, s.wyjscie);
  assert.equal(t.maKlucz, s.maKlucz);
  assert.equal(t.ukonczony, false);
  assert.deepEqual(t.odkryte, s.odkryte);
  assert.deepEqual(t.widoczne, s.widoczne);
});

test('zapis stanu: poziom bez mgły ma wszystko odkryte', () => {
  const s = rozegrany(1, 3);
  const t = stanZZapisu(przezJson(stanDoZapisu(s)));
  assert.equal(t.mgla, false);
  assert.equal(t.odkryte.size, t.labirynt.szerokosc * t.labirynt.wysokosc);
});

test('zapis stanu: ukończony poziom → nowy labirynt następnego poziomu', () => {
  const s = rozegrany(3, 5);
  s.ukonczony = true;
  const d = stanDoZapisu(s);
  assert.deepEqual(d, { wersja: 1, poziom: 4, nowy: true });
  const t = stanZZapisu(przezJson(d), 30, mulberry32(1));
  assert.equal(t.poziom, 4);
  assert.equal(t.mgla, true);
  assert.equal(t.labirynt.szerokosc, rozmiarPoziomu(4, 30));
});

test('zapis stanu: wznowiony labirynt zachowuje rozmiar mimo mniejszego limitu', () => {
  const s = rozegrany(10, 2);
  const t = stanZZapisu(przezJson(stanDoZapisu(s)), 8);
  assert.equal(t.labirynt.szerokosc, s.labirynt.szerokosc);
});

test('zapis stanu: uszkodzone lub spreparowane dane → null', () => {
  const wzor = przezJson(stanDoZapisu(rozegrany(3, 11)));
  const zepsuty = (zmiana) => {
    const d = przezJson(wzor);
    zmiana(d);
    return stanZZapisu(d);
  };
  const lab = { szerokosc: wzor.szerokosc, wysokosc: wzor.wysokosc };
  // komórka z przejściem na wschód — do psucia symetrii i spójności
  const i = wzor.przejscia.findIndex((m) => m & E);
  const sasiad = i + 1;

  assert.equal(zepsuty((d) => { d.wersja = 2; }), null, 'wersja');
  assert.equal(zepsuty((d) => { d.poziom = 0; }), null, 'poziom 0');
  assert.equal(zepsuty((d) => { d.poziom = 501; }), null, 'poziom 501');
  assert.equal(zepsuty((d) => { d.poziom = 2.5; }), null, 'poziom ułamkowy');
  assert.equal(zepsuty((d) => { d.szerokosc = 1; }), null, 'szerokość 1');
  assert.equal(zepsuty((d) => { d.przejscia.pop(); }), null, 'za krótkie przejścia');
  assert.equal(zepsuty((d) => { d.przejscia[0] = 16; }), null, 'maska spoza 0–15');
  assert.equal(zepsuty((d) => { d.przejscia[0] |= 1; }), null, 'przejście poza siatkę (N z wiersza 0)');
  assert.equal(zepsuty((d) => { d.przejscia[sasiad] &= ~W; }), null, 'przejście niesymetryczne');
  assert.equal(zepsuty((d) => { d.przejscia[i] &= ~E; d.przejscia[sasiad] &= ~W; }), null, 'labirynt niespójny');
  assert.equal(zepsuty((d) => { d.gracz.x = lab.szerokosc; }), null, 'gracz poza siatką');
  assert.equal(zepsuty((d) => { d.klucz = null; }), null, 'brak klucza');
  assert.equal(zepsuty((d) => { d.maKlucz = 'tak'; }), null, 'maKlucz nie boolean');
  assert.equal(zepsuty((d) => { d.odkryte = [-1]; }), null, 'odkryte poza zakresem');
  for (const smiec of [null, undefined, 'abc', 42, [], {}]) assert.equal(stanZZapisu(smiec), null);
  assert.equal(stanZZapisu({ wersja: 1, poziom: 501, nowy: true }), null, 'nowy poziom > 500');
});

test('nick: obcięcie spacji, limit 20 punktów kodowych, pusty → null', () => {
  assert.equal(normalizujNick('  Ania  '), 'Ania');
  assert.equal(normalizujNick('x'.repeat(25)), 'x'.repeat(20));
  assert.equal(normalizujNick('😀'.repeat(25)), '😀'.repeat(20));
  assert.equal(normalizujNick('a'.repeat(19) + ' b'), 'a'.repeat(19));
  assert.equal(normalizujNick('   '), null);
  assert.equal(normalizujNick(''), null);
  assert.equal(normalizujNick(null), null);
});

test('nick: zapis i odczyt z storage, brak storage nie psuje gry', () => {
  const st = pamiecStorage();
  assert.equal(wczytajNick(st), null);
  zapiszNick(st, 'Ania');
  assert.equal(st.dane[KLUCZ_NICKU], 'Ania');
  assert.equal(wczytajNick(st), 'Ania');
  zapiszNick(st, null);
  assert.equal(KLUCZ_NICKU in st.dane, false);
  const zepsuty = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); }, removeItem() { throw new Error('x'); } };
  assert.equal(wczytajNick(zepsuty), null);
  assert.doesNotThrow(() => zapiszNick(zepsuty, 'Ania'));
  assert.equal(wczytajNick(null), null);
});
```

- [ ] **Step 3: Uruchom testy — mają nie przejść**

Run: `node --test tests/zapis.test.js`
Expected: FAIL — `stanDoZapisu` nie jest eksportowany.

- [ ] **Step 4: Zaimplementuj w `src/game.js`**

Zamień linię 2:

```js
import { generujLabirynt, wybierzPozycje, odleglosci, indeks, pozycjaZIndeksu, KIERUNKI } from './maze.js';
```

na:

```js
import { generujLabirynt, wybierzPozycje, odleglosci, indeks, pozycjaZIndeksu, wSiatce, KIERUNKI } from './maze.js';
```

Na końcu pliku dopisz:

```js
export const WERSJA_ZAPISU = 1;
export const MAX_POZIOM = 500;
const MAX_BOK_ZAPISU = 200;

/** Stan gry → prosty obiekt JSON do zapisu w bazie. Po ukończonym poziomie — wskazanie następnego. */
export function stanDoZapisu(stan) {
  if (stan.ukonczony) return { wersja: WERSJA_ZAPISU, poziom: stan.poziom + 1, nowy: true };
  const { labirynt } = stan;
  return {
    wersja: WERSJA_ZAPISU,
    poziom: stan.poziom,
    szerokosc: labirynt.szerokosc,
    wysokosc: labirynt.wysokosc,
    przejscia: Array.from(labirynt.przejscia),
    gracz: { x: stan.gracz.x, y: stan.gracz.y },
    klucz: { x: stan.klucz.x, y: stan.klucz.y },
    wyjscie: { x: stan.wyjscie.x, y: stan.wyjscie.y },
    maKlucz: stan.maKlucz,
    odkryte: [...stan.odkryte],
  };
}

const calkowita = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

/**
 * Zapis z bazy → stan gry albo null, gdy dane są uszkodzone lub niespójne (pochodzą od klienta — nie ufamy im).
 * `{ nowy: true }` → nowy labirynt na wskazanym poziomie; pełny zapis zachowuje swój rozmiar niezależnie od `limit`.
 */
export function stanZZapisu(dane, limit = Infinity, rng = Math.random) {
  if (!dane || typeof dane !== 'object' || dane.wersja !== WERSJA_ZAPISU) return null;
  if (!calkowita(dane.poziom, 1, MAX_POZIOM)) return null;
  if (dane.nowy === true) return nowyPoziom(dane.poziom, limit, rng);

  const { szerokosc, wysokosc, przejscia } = dane;
  if (!calkowita(szerokosc, 2, MAX_BOK_ZAPISU) || !calkowita(wysokosc, 2, MAX_BOK_ZAPISU)) return null;
  if (!Array.isArray(przejscia) || przejscia.length !== szerokosc * wysokosc) return null;
  if (!przejscia.every((m) => calkowita(m, 0, 15))) return null;
  const labirynt = { szerokosc, wysokosc, przejscia: Uint8Array.from(przejscia) };

  // Każde przejście w siatce i symetryczne (A→B ⇔ B→A)
  for (let i = 0; i < przejscia.length; i++) {
    const { x, y } = pozycjaZIndeksu(labirynt, i);
    for (const k of KIERUNKI) {
      if (!(przejscia[i] & k.bit)) continue;
      if (!wSiatce(labirynt, x + k.dx, y + k.dy)) return null;
      if (!(przejscia[indeks(labirynt, x + k.dx, y + k.dy)] & k.przeciwny)) return null;
    }
  }

  const pozycja = (p) => p !== null && typeof p === 'object'
    && calkowita(p.x, 0, szerokosc - 1) && calkowita(p.y, 0, wysokosc - 1);
  if (![dane.gracz, dane.klucz, dane.wyjscie].every(pozycja)) return null;
  if (typeof dane.maKlucz !== 'boolean') return null;
  if (!Array.isArray(dane.odkryte) || !dane.odkryte.every((i) => calkowita(i, 0, przejscia.length - 1))) return null;

  // Spójność: z pozycji gracza osiągalne wszystkie komórki
  if (odleglosci(labirynt, indeks(labirynt, dane.gracz.x, dane.gracz.y)).includes(-1)) return null;

  const stan = {
    poziom: dane.poziom,
    mgla: czyMgla(dane.poziom),
    labirynt,
    gracz: { x: dane.gracz.x, y: dane.gracz.y },
    klucz: { x: dane.klucz.x, y: dane.klucz.y },
    wyjscie: { x: dane.wyjscie.x, y: dane.wyjscie.y },
    maKlucz: dane.maKlucz,
    ukonczony: false,
    odkryte: new Set(dane.odkryte),
  };
  aktualizujWidocznosc(stan);
  return stan;
}

export const KLUCZ_NICKU = 'labirynt.nick';
export const MAX_NICK = 20;

/** Nick do tabeli: bez spacji na brzegach, maks. MAX_NICK punktów kodowych (jak char_length w bazie); pusty → null. */
export function normalizujNick(tekst) {
  if (typeof tekst !== 'string') return null;
  const nick = Array.from(tekst.trim()).slice(0, MAX_NICK).join('').trim();
  return nick || null;
}

/** Odczyt nicku; brak dostępu do storage → null. */
export function wczytajNick(storage) {
  try {
    return normalizujNick(storage.getItem(KLUCZ_NICKU));
  } catch {
    return null;
  }
}

/** Zapis nicku (null usuwa); brak dostępu do storage nie psuje gry. */
export function zapiszNick(storage, nick) {
  try {
    if (nick) storage.setItem(KLUCZ_NICKU, nick);
    else storage.removeItem(KLUCZ_NICKU);
  } catch {
    // brak dostępu do storage nie psuje gry
  }
}
```

- [ ] **Step 5: Uruchom testy**

Run: `node --test`
Expected: PASS — wszystkie.

- [ ] **Step 6: Commit**

```bash
git add src/game.js tests/zapis.test.js tests/helpers.js
git commit -m "Zapis i odtworzenie stanu gry z walidacją, normalizacja nicku"
```

---

### Task 2: Moduł `baza.js`

**Files:**
- Create: `src/konfiguracja.js`, `src/baza.js`
- Test: `tests/baza.test.js`

**Interfaces:**
- Produces (`src/baza.js`):
  - `KLUCZ_SESJI = 'labirynt.sesja'`
  - `utworzBaze({ fetch, storage, teraz, url, klucz, limitCzasuMs, ostrzez } = {}) → Baza`
  - `Baza.sesja() → Promise<{ access_token, refresh_token, expires_at, user_id } | null>`
  - `Baza.zapiszWynik(nick: string, poziom: number) → Promise<boolean>`
  - `Baza.pobierzTop10() → Promise<Array<{ user_id, nick, poziom }> | null>`
  - `Baza.mojeMiejsce() → Promise<{ miejsce, poziom } | null>`
  - `Baza.zapiszStan(dane: object, { keepalive = false } = {}) → Promise<boolean>`
  - `Baza.wczytajStan() → Promise<object | null>`
  - `Baza.usunStan() → Promise<boolean>`

- [ ] **Step 1: Konfiguracja**

Utwórz `src/konfiguracja.js`:

```js
// Publiczna konfiguracja Supabase. Klucz publikowalny jest jawny z założenia — dostępu do danych pilnuje RLS.
export const SUPABASE_URL = 'https://tnqgzkzxzzsaflhjywgb.supabase.co';
export const SUPABASE_KLUCZ = 'sb_publishable_RfoBfZmDXH2nWBTPf-y1-A_PSWDqWjl';
```

- [ ] **Step 2: Napisz testy**

Utwórz `tests/baza.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utworzBaze, KLUCZ_SESJI } from '../src/baza.js';
import { pamiecStorage } from './helpers.js';

const URL = 'https://przyklad.supabase.co';
const KLUCZ = 'sb_publishable_test';
const SESJA = (n) => ({
  access_token: `T${n}`, refresh_token: `R${n}`, expires_at: 2000, expires_in: 3600, token_type: 'bearer',
  user: { id: 'U1', is_anonymous: true },
});

function odpowiedz(status, tresc) {
  return { ok: status >= 200 && status < 300, status, text: async () => (tresc === undefined ? '' : JSON.stringify(tresc)) };
}

/**
 * Atrapa fetch: `trasy` mapuje 'METODA /ścieżka' (bez query) na { status, tresc } albo funkcję (opcje, adres) → to samo.
 * Zapisuje wszystkie wywołania.
 */
function atrapaFetch(trasy) {
  const wywolania = [];
  const fetch = async (adres, opcje) => {
    wywolania.push({ adres, ...opcje, tresc: opcje.body ? JSON.parse(opcje.body) : undefined });
    const sciezka = adres.slice(URL.length).split('?')[0];
    const trasa = trasy[`${opcje.method} ${sciezka}`];
    if (!trasa) return odpowiedz(404, { message: 'brak trasy' });
    const r = typeof trasa === 'function' ? await trasa(opcje, adres) : trasa;
    return odpowiedz(r.status, r.tresc);
  };
  return { fetch, wywolania, ile: (metoda, sciezka) => wywolania.filter((w) => w.method === metoda && w.adres.startsWith(URL + sciezka)).length };
}

function baza(trasy, { storage = pamiecStorage(), teraz = 1000, limitCzasuMs = 5000 } = {}) {
  const f = atrapaFetch(trasy);
  const b = utworzBaze({ fetch: f.fetch, storage, teraz: () => teraz * 1000, url: URL, klucz: KLUCZ, limitCzasuMs, ostrzez: () => {} });
  return { b, f, storage };
}

const LOGOWANIE = { 'POST /auth/v1/signup': { status: 200, tresc: SESJA(1) } };

test('sesja: pierwsze logowanie anonimowe zapisuje sesję, kolejne jej używa', async () => {
  const { b, f, storage } = baza(LOGOWANIE);
  const s = await b.sesja();
  assert.deepEqual(s, { access_token: 'T1', refresh_token: 'R1', expires_at: 2000, user_id: 'U1' });
  assert.deepEqual(JSON.parse(storage.dane[KLUCZ_SESJI]), s);
  await b.sesja();
  assert.equal(f.ile('POST', '/auth/v1/signup'), 1);
  const w = f.wywolania[0];
  assert.equal(w.headers.apikey, KLUCZ);
  assert.deepEqual(w.tresc, {});
});

test('sesja: wygasająca (< 60 s) odświeżana tokenem, bez nowego konta', async () => {
  const storage = pamiecStorage({ [KLUCZ_SESJI]: JSON.stringify({ access_token: 'T1', refresh_token: 'R1', expires_at: 2000, user_id: 'U1' }) });
  const { b, f } = baza({ ...LOGOWANIE, 'POST /auth/v1/token': { status: 200, tresc: { ...SESJA(2), expires_at: 9000 } } }, { storage, teraz: 1950 });
  const s = await b.sesja();
  assert.equal(s.access_token, 'T2');
  assert.equal(f.ile('POST', '/auth/v1/signup'), 0);
  assert.ok(f.wywolania[0].adres.endsWith('/auth/v1/token?grant_type=refresh_token'));
  assert.deepEqual(f.wywolania[0].tresc, { refresh_token: 'R1' });
  assert.equal(JSON.parse(storage.dane[KLUCZ_SESJI]).access_token, 'T2');
});

test('sesja: odrzucony refresh token (4xx) → nowe logowanie anonimowe', async () => {
  const storage = pamiecStorage({ [KLUCZ_SESJI]: JSON.stringify({ access_token: 'T0', refresh_token: 'R0', expires_at: 10, user_id: 'U0' }) });
  const { b, f } = baza({ ...LOGOWANIE, 'POST /auth/v1/token': { status: 400, tresc: { error: 'invalid_grant' } } }, { storage });
  const s = await b.sesja();
  assert.equal(s.user_id, 'U1');
  assert.equal(f.ile('POST', '/auth/v1/signup'), 1);
});

test('sesja: refresh bez sieci NIE zakłada nowego konta (tożsamość zostaje)', async () => {
  const zapisana = { access_token: 'T0', refresh_token: 'R0', expires_at: 10, user_id: 'U0' };
  const storage = pamiecStorage({ [KLUCZ_SESJI]: JSON.stringify(zapisana) });
  const { b, f } = baza({ ...LOGOWANIE, 'POST /auth/v1/token': () => { throw new TypeError('Failed to fetch'); } }, { storage });
  assert.equal(await b.sesja(), null);
  assert.equal(f.ile('POST', '/auth/v1/signup'), 0);
  assert.deepEqual(JSON.parse(storage.dane[KLUCZ_SESJI]), zapisana);
  assert.equal(await b.zapiszWynik('Ania', 3), false);
});

test('sesja: uszkodzona sesja w storage → nowe logowanie', async () => {
  const storage = pamiecStorage({ [KLUCZ_SESJI]: '{zle' });
  const { b, f } = baza(LOGOWANIE, { storage });
  assert.equal((await b.sesja()).user_id, 'U1');
  assert.equal(f.ile('POST', '/auth/v1/signup'), 1);
});

test('sesja: równoległe wywołania → jedno logowanie', async () => {
  const { b, f } = baza({ ...LOGOWANIE, 'POST /rest/v1/rpc/zapisz_wynik': { status: 204 }, 'GET /rest/v1/zapisy': { status: 200, tresc: [] } });
  await Promise.all([b.sesja(), b.zapiszWynik('Ania', 2), b.wczytajStan(), b.sesja()]);
  assert.equal(f.ile('POST', '/auth/v1/signup'), 1);
});

test('zapiszWynik: RPC z tokenem gracza', async () => {
  const { b, f } = baza({ ...LOGOWANIE, 'POST /rest/v1/rpc/zapisz_wynik': { status: 204 } });
  assert.equal(await b.zapiszWynik('Ania', 7), true);
  const w = f.wywolania.at(-1);
  assert.equal(w.adres, `${URL}/rest/v1/rpc/zapisz_wynik`);
  assert.equal(w.method, 'POST');
  assert.equal(w.headers.apikey, KLUCZ);
  assert.equal(w.headers.Authorization, 'Bearer T1');
  assert.deepEqual(w.tresc, { p_nick: 'Ania', p_poziom: 7 });
});

test('pobierzTop10 i mojeMiejsce: zapytania i odpowiedzi', async () => {
  const top = [{ user_id: 'U1', nick: 'Ania', poziom: 5 }];
  const { b, f } = baza({
    ...LOGOWANIE,
    'GET /rest/v1/wyniki': { status: 200, tresc: top },
    'POST /rest/v1/rpc/moje_miejsce': { status: 200, tresc: [{ miejsce: 1, poziom: 5 }] },
  });
  assert.deepEqual(await b.pobierzTop10(), top);
  assert.equal(
    f.wywolania.find((w) => w.adres.includes('/rest/v1/wyniki')).adres,
    `${URL}/rest/v1/wyniki?select=user_id,nick,poziom&order=poziom.desc,osiagniety.asc&limit=10`,
  );
  assert.deepEqual(await b.mojeMiejsce(), { miejsce: 1, poziom: 5 });
});

test('mojeMiejsce: gracz bez wyniku → null', async () => {
  const { b } = baza({ ...LOGOWANIE, 'POST /rest/v1/rpc/moje_miejsce': { status: 200, tresc: [] } });
  assert.equal(await b.mojeMiejsce(), null);
});

test('zapisy: upsert z keepalive, odczyt, usunięcie własnego wiersza', async () => {
  const { b, f } = baza({
    ...LOGOWANIE,
    'POST /rest/v1/zapisy': { status: 201 },
    'GET /rest/v1/zapisy': { status: 200, tresc: [{ stan: { wersja: 1, poziom: 4, nowy: true } }] },
    'DELETE /rest/v1/zapisy': { status: 204 },
  });
  assert.equal(await b.zapiszStan({ wersja: 1 }, { keepalive: true }), true);
  const zapis = f.wywolania.at(-1);
  assert.equal(zapis.headers.Prefer, 'resolution=merge-duplicates,return=minimal');
  assert.equal(zapis.keepalive, true);
  assert.deepEqual(zapis.tresc, { stan: { wersja: 1 } });
  assert.deepEqual(await b.wczytajStan(), { wersja: 1, poziom: 4, nowy: true });
  assert.equal(await b.usunStan(), true);
  assert.equal(f.wywolania.at(-1).adres, `${URL}/rest/v1/zapisy?user_id=eq.U1`);
});

test('wczytajStan: brak zapisu → null', async () => {
  const { b } = baza({ ...LOGOWANIE, 'GET /rest/v1/zapisy': { status: 200, tresc: [] } });
  assert.equal(await b.wczytajStan(), null);
});

test('błędy: HTTP 500, wyjątek sieci, brak logowania → null/false bez wyjątku', async () => {
  const blad500 = { status: 500, tresc: { message: 'x' } };
  const { b } = baza({
    ...LOGOWANIE,
    'POST /rest/v1/rpc/zapisz_wynik': blad500,
    'GET /rest/v1/wyniki': () => { throw new TypeError('Failed to fetch'); },
    'POST /rest/v1/rpc/moje_miejsce': blad500,
    'POST /rest/v1/zapisy': blad500,
    'GET /rest/v1/zapisy': blad500,
  });
  assert.equal(await b.zapiszWynik('Ania', 1), false);
  assert.equal(await b.pobierzTop10(), null);
  assert.equal(await b.mojeMiejsce(), null);
  assert.equal(await b.zapiszStan({}), false);
  assert.equal(await b.wczytajStan(), null);

  const { b: bezLogowania } = baza({ 'POST /auth/v1/signup': blad500, 'GET /rest/v1/wyniki': { status: 200, tresc: [] } });
  assert.equal(await bezLogowania.sesja(), null);
  assert.equal(await bezLogowania.zapiszWynik('Ania', 1), false);
  assert.deepEqual(await bezLogowania.pobierzTop10(), [], 'tabela czytelna także bez sesji');
});

test('przekroczenie czasu → false, bez wiszenia', async () => {
  const wiszacy = (opcje) => new Promise((_, odrzuc) => {
    opcje.signal.addEventListener('abort', () => odrzuc(new Error('przerwane')));
  });
  const { b } = baza({ ...LOGOWANIE, 'POST /rest/v1/rpc/zapisz_wynik': wiszacy }, { limitCzasuMs: 20 });
  const start = Date.now();
  assert.equal(await b.zapiszWynik('Ania', 1), false);
  assert.ok(Date.now() - start < 1000);
});
```

- [ ] **Step 3: Uruchom testy — mają nie przejść**

Run: `node --test tests/baza.test.js`
Expected: FAIL — `Cannot find module '.../src/baza.js'`.

- [ ] **Step 4: Utwórz `src/baza.js`**

```js
// Komunikacja z Supabase przez fetch (REST), bez bibliotek. Żadna metoda nie rzuca — błąd → null / false.
import { SUPABASE_URL, SUPABASE_KLUCZ } from './konfiguracja.js';

export const KLUCZ_SESJI = 'labirynt.sesja';
const LIMIT_CZASU_MS = 5000;
/** Token odświeżany, gdy do wygaśnięcia zostało mniej niż tyle sekund. */
const ZAPAS_WAZNOSCI_S = 60;
const SCIEZKA_TOP10 = '/rest/v1/wyniki?select=user_id,nick,poziom&order=poziom.desc,osiagniety.asc&limit=10';

export function utworzBaze({
  fetch: pobierz = (...a) => globalThis.fetch(...a),
  storage = null,
  teraz = () => Date.now(),
  url = SUPABASE_URL,
  klucz = SUPABASE_KLUCZ,
  limitCzasuMs = LIMIT_CZASU_MS,
  ostrzez = (e) => console.warn('Supabase:', e?.message ?? e),
} = {}) {
  let sesjaWToku = null;

  function wczytajSesje() {
    try {
      const s = JSON.parse(storage?.getItem(KLUCZ_SESJI) ?? 'null');
      return s && s.access_token && s.refresh_token ? s : null;
    } catch {
      return null;
    }
  }

  function zapiszSesje(s) {
    try {
      storage?.setItem(KLUCZ_SESJI, JSON.stringify(s));
    } catch {
      // brak storage — sesja tylko w pamięci tej karty
    }
  }

  /** Żądanie HTTP z limitem czasu. 2xx → treść JSON (null przy pustej); inaczej wyjątek z polem `status`. */
  async function zadanie(sciezka, { metoda = 'GET', token = null, tresc, naglowki = {}, keepalive = false } = {}) {
    const przerwij = new AbortController();
    const timer = setTimeout(() => przerwij.abort(), limitCzasuMs);
    try {
      const odp = await pobierz(url + sciezka, {
        method: metoda,
        headers: {
          apikey: klucz,
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...naglowki,
        },
        body: tresc === undefined ? undefined : JSON.stringify(tresc),
        signal: przerwij.signal,
        keepalive,
      });
      if (!odp.ok) {
        const blad = new Error(`HTTP ${odp.status} ${sciezka}`);
        blad.status = odp.status;
        throw blad;
      }
      const tekst = await odp.text();
      return tekst ? JSON.parse(tekst) : null;
    } finally {
      clearTimeout(timer);
    }
  }

  function zOdpowiedzi(d) {
    if (!d?.access_token || !d?.refresh_token || !d?.user?.id) throw new Error('niepełna sesja');
    return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at, user_id: d.user.id };
  }

  async function ustalSesje() {
    const zapisana = wczytajSesje();
    if (zapisana && zapisana.expires_at - ZAPAS_WAZNOSCI_S > teraz() / 1000) return zapisana;
    if (zapisana) {
      try {
        const s = zOdpowiedzi(await zadanie('/auth/v1/token?grant_type=refresh_token', {
          metoda: 'POST', tresc: { refresh_token: zapisana.refresh_token },
        }));
        zapiszSesje(s);
        return s;
      } catch (e) {
        // Tylko odrzucony token (4xx) uzasadnia nowe konto; brak sieci nie może zabrać graczowi tożsamości.
        if (!(e.status >= 400 && e.status < 500)) throw e;
      }
    }
    const s = zOdpowiedzi(await zadanie('/auth/v1/signup', { metoda: 'POST', tresc: {} }));
    zapiszSesje(s);
    return s;
  }

  /** Bieżąca sesja (logowanie anonimowe lub odświeżenie w razie potrzeby); równoległe wywołania czekają na jedno. */
  async function sesja() {
    if (!sesjaWToku) sesjaWToku = ustalSesje().finally(() => { sesjaWToku = null; });
    try {
      return await sesjaWToku;
    } catch (e) {
      ostrzez(e);
      return null;
    }
  }

  /** Wykonuje `dzialanie(sesja)`; brak sesji lub błąd → `zapasowo`. */
  async function zSesja(dzialanie, zapasowo) {
    const s = await sesja();
    if (!s) return zapasowo;
    try {
      return await dzialanie(s);
    } catch (e) {
      ostrzez(e);
      return zapasowo;
    }
  }

  return {
    sesja,

    zapiszWynik: (nick, poziom) => zSesja(async (s) => {
      await zadanie('/rest/v1/rpc/zapisz_wynik', {
        metoda: 'POST', token: s.access_token, tresc: { p_nick: nick, p_poziom: poziom },
      });
      return true;
    }, false),

    /** Tabela jest publiczna — przy braku sesji pytamy samym kluczem publikowalnym. */
    async pobierzTop10() {
      try {
        const s = await sesja();
        const wynik = await zadanie(SCIEZKA_TOP10, { token: s?.access_token });
        return Array.isArray(wynik) ? wynik : null;
      } catch (e) {
        ostrzez(e);
        return null;
      }
    },

    mojeMiejsce: () => zSesja(async (s) => {
      const wynik = await zadanie('/rest/v1/rpc/moje_miejsce', { metoda: 'POST', token: s.access_token, tresc: {} });
      return Array.isArray(wynik) && wynik.length ? wynik[0] : null;
    }, null),

    zapiszStan: (dane, { keepalive = false } = {}) => zSesja(async (s) => {
      await zadanie('/rest/v1/zapisy', {
        metoda: 'POST',
        token: s.access_token,
        tresc: { stan: dane },
        naglowki: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        keepalive,
      });
      return true;
    }, false),

    wczytajStan: () => zSesja(async (s) => {
      const wynik = await zadanie('/rest/v1/zapisy?select=stan', { token: s.access_token });
      return Array.isArray(wynik) && wynik.length ? wynik[0].stan : null;
    }, null),

    usunStan: () => zSesja(async (s) => {
      await zadanie(`/rest/v1/zapisy?user_id=eq.${encodeURIComponent(s.user_id)}`, { metoda: 'DELETE', token: s.access_token });
      return true;
    }, false),
  };
}
```

- [ ] **Step 5: Uruchom testy**

Run: `node --test`
Expected: PASS — wszystkie.

- [ ] **Step 6: Commit**

```bash
git add src/konfiguracja.js src/baza.js tests/baza.test.js
git commit -m "Moduł baza.js: anonimowa sesja Supabase, wyniki i zapisy przez fetch"
```

---

### Task 3: Klawiatura — `N` i pole tekstowe

**Files:**
- Modify: `src/input.js`
- Test: `tests/input.test.js` (nowy)

**Interfaces:**
- Produces: akcja `'nowaGra'` (klawisz `KeyN`); w polu tekstowym tylko `Enter` → `'potwierdz'`, `Escape` → `blur()` bez akcji.

- [ ] **Step 1: Napisz testy**

Utwórz `tests/input.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { podlaczKlawiature } from '../src/input.js';

function przygotuj() {
  let sluchacz = null;
  const akcje = [];
  podlaczKlawiature({ addEventListener: (_, f) => { sluchacz = f; } }, (a, powt) => akcje.push([a, powt]));
  const nacisnij = (code, target = { tagName: 'BODY' }) => {
    const e = { code, target, repeat: false, ctrlKey: false, metaKey: false, altKey: false, zablokowany: false };
    e.preventDefault = () => { e.zablokowany = true; };
    sluchacz(e);
    return e;
  };
  return { akcje, nacisnij };
}

test('klawiatura: N → nowa gra, Escape poza polem → menu', () => {
  const { akcje, nacisnij } = przygotuj();
  nacisnij('KeyN');
  nacisnij('Escape');
  nacisnij('KeyW');
  assert.deepEqual(akcje, [['nowaGra', false], ['menu', false], ['gora', false]]);
});

test('klawiatura: w polu nicku litery i spacja piszą, nie sterują grą', () => {
  const { akcje, nacisnij } = przygotuj();
  const pole = { tagName: 'INPUT', blur() { this.rozmyte = true; } };
  for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyN', 'Space', 'ArrowUp']) {
    const e = nacisnij(code, pole);
    assert.equal(e.zablokowany, false, `${code} nie może blokować pisania`);
  }
  assert.deepEqual(akcje, []);
});

test('klawiatura: w polu nicku Enter zatwierdza, Escape tylko opuszcza pole', () => {
  const { akcje, nacisnij } = przygotuj();
  const pole = { tagName: 'INPUT', rozmyte: false, blur() { this.rozmyte = true; } };
  nacisnij('Enter', pole);
  nacisnij('NumpadEnter', pole);
  nacisnij('Escape', pole);
  assert.deepEqual(akcje, [['potwierdz', false], ['potwierdz', false]]);
  assert.equal(pole.rozmyte, true);
});
```

- [ ] **Step 2: Uruchom testy — mają nie przejść**

Run: `node --test tests/input.test.js`
Expected: FAIL — brak akcji `nowaGra`, litery z pola wywołują akcje.

- [ ] **Step 3: Zmień `src/input.js`**

W `MAPA` po `KeyR: 'nowy',` dodaj:

```js
  KeyN: 'nowaGra',
```

Zamień funkcję `podlaczKlawiature` na:

```js
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
```

- [ ] **Step 4: Uruchom testy**

Run: `node --test`
Expected: PASS — wszystkie.

- [ ] **Step 5: Commit**

```bash
git add src/input.js tests/input.test.js
git commit -m "Klawiatura: N — nowa gra, pisanie w polu nicku nie steruje grą"
```

---

### Task 4: Ekran startowy i spięcie w `main.js`

**Files:**
- Modify: `index.html` (karta `#ekran-start`), `style.css`, `src/main.js`

**Interfaces:**
- Consumes: `stanDoZapisu`, `stanZZapisu`, `normalizujNick`, `wczytajNick`, `zapiszNick` (Zadanie 1); `utworzBaze` i metody `Baza` (Zadanie 2); akcja `nowaGra` (Zadanie 3).

- [ ] **Step 1: `index.html` — karta startowa**

Zamień całą sekcję `<section id="ekran-start" class="nakladka">…</section>` na:

```html
    <section id="ekran-start" class="nakladka">
      <div class="karta">
        <h1>Zaklęty Ogród</h1>
        <p id="rekord" class="rekord">Najwyższy poziom: 0</p>
        <label class="pole-nicku">Twój nick
          <input id="nick" type="text" maxlength="20" autocomplete="nickname" spellcheck="false" placeholder="np. Ania">
        </label>
        <p id="nick-uwaga" class="uwaga">Bez nicku wynik nie trafi do tabeli</p>
        <ul class="instrukcja">
          <li><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> lub <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> — ruch</li>
          <li>Zdobądź <strong class="t-klucz">klucz</strong>, potem dojdź do <strong class="t-drzwi">wyjścia</strong>.</li>
          <li>Od poziomu 3 plansza tonie we <strong>mgle</strong> — widzisz tylko 3 kroki wzdłuż korytarzy.</li>
          <li><kbd>R</kbd> — nowy labirynt, <kbd>Esc</kbd> — powrót do menu (gra się zapisuje)</li>
        </ul>
        <p id="akcja-start" class="akcja"><kbd>Enter</kbd> / <kbd>Spacja</kbd> — start</p>
        <p id="akcja-wznow" class="akcja" hidden>
          <kbd>Enter</kbd> — kontynuuj (<span id="wznow-poziom">poziom 1</span>) · <kbd>N</kbd> — nowa gra
        </p>
        <section class="ranking" aria-labelledby="ranking-tytul">
          <h3 id="ranking-tytul">Tabela wyników</h3>
          <p id="ranking-status" class="uwaga">Wczytywanie…</p>
          <ol id="ranking-lista" hidden></ol>
          <p id="ranking-ja" class="uwaga" hidden></p>
        </section>
      </div>
    </section>
```

- [ ] **Step 2: `style.css` — nowe elementy**

W regule `.karta` dodaj na końcu (przed `}`):

```css
  max-height: 100%;
  overflow-y: auto;
```

Na końcu pliku dopisz:

```css
.pole-nicku {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 0 0 4px;
  color: var(--przygaszony);
}
.pole-nicku input {
  width: 12em;
  padding: 6px 10px;
  border: 1px solid #3a4460;
  border-radius: 6px;
  background: #222a3b;
  color: var(--tekst);
  font: inherit;
}
.pole-nicku input:focus { outline: 2px solid var(--akcent); outline-offset: 1px; }

.uwaga { margin: 0 0 14px; color: var(--przygaszony); font-size: 0.85em; }

.ranking { margin-top: 20px; padding-top: 14px; border-top: 1px solid #2a3145; }
.ranking h3 { margin: 0 0 8px; font-size: 16px; }
#ranking-lista {
  max-width: 300px;
  margin: 0 auto 8px;
  padding: 0;
  list-style: none;
  text-align: left;
}
#ranking-lista li { display: flex; gap: 10px; padding: 2px 8px; border-radius: 6px; }
#ranking-lista li.ja { background: #2a3145; outline: 1px solid var(--akcent); }
#ranking-lista .miejsce { width: 2em; text-align: right; color: var(--przygaszony); }
#ranking-lista .nick { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#ranking-lista .poziom { font-weight: 600; color: var(--akcent); }
```

- [ ] **Step 3: `src/main.js` — importy, elementy, stan**

Zamień linię 2:

```js
import { nowyPoziom, nowyLabirynt, ruch, limitRozmiaru, wczytajRekord, zapiszRekord } from './game.js';
```

na:

```js
import {
  nowyPoziom, nowyLabirynt, ruch, limitRozmiaru, wczytajRekord, zapiszRekord,
  stanDoZapisu, stanZZapisu, normalizujNick, wczytajNick, zapiszNick,
} from './game.js';
import { utworzBaze } from './baza.js';
```

Pod `const ukonczonyTytul = document.getElementById('ukonczony-tytul');` dodaj:

```js
const poleNicku = document.getElementById('nick');
const nickUwaga = document.getElementById('nick-uwaga');
const akcjaStart = document.getElementById('akcja-start');
const akcjaWznow = document.getElementById('akcja-wznow');
const wznowPoziom = document.getElementById('wznow-poziom');
const rankingStatus = document.getElementById('ranking-status');
const rankingLista = document.getElementById('ranking-lista');
const rankingJa = document.getElementById('ranking-ja');
```

Pod `const storage = pobierzStorage();` dodaj:

```js
const baza = utworzBaze({ storage });
/** Zapis po ruchu najwyżej raz na tyle ms. */
const ODSTEP_ZAPISU_MS = 3000;
```

Pod `let timerKomunikatu = 0;` dodaj:

```js
let zapis = null; // przerwana gra (dane JSON) — z bazy albo z ostatniego zapisu w tej karcie
let timerZapisu = 0;
let ostatniZapis = 0;
```

- [ ] **Step 4: `src/main.js` — nowe funkcje**

Pod funkcją `komunikat` dodaj:

```js
const nick = () => normalizujNick(poleNicku.value);

function aktualizujNick() {
  zapiszNick(storage, nick());
  nickUwaga.hidden = Boolean(nick());
}

function pokazAkcjeStartu() {
  akcjaStart.hidden = Boolean(zapis);
  akcjaWznow.hidden = !zapis;
  if (zapis) wznowPoziom.textContent = `poziom ${zapis.poziom}`;
}

/** Zapis stanu gry do bazy: od razu albo najwyżej raz na ODSTEP_ZAPISU_MS (wysyłany jest najświeższy stan). */
function zapiszStanGry({ odrazu = false, keepalive = false } = {}) {
  if (!stan) return;
  zapis = stanDoZapisu(stan);
  clearTimeout(timerZapisu);
  const wyslij = () => {
    ostatniZapis = Date.now();
    baza.zapiszStan(zapis, { keepalive });
  };
  const czekaj = ostatniZapis + ODSTEP_ZAPISU_MS - Date.now();
  if (odrazu || czekaj <= 0) wyslij();
  else timerZapisu = setTimeout(wyslij, czekaj);
}

/** Przerwana gra z bazy; uszkodzony zapis jest ignorowany. */
async function wczytajZapis() {
  const dane = await baza.wczytajStan();
  if (zapis) return; // w tej karcie już zagrano — lokalny zapis jest świeższy
  zapis = dane && stanZZapisu(dane, limit()) ? dane : null;
  if (ekran === 'start') pokazAkcjeStartu();
}

function wierszRankingu(miejsce, w, mojId) {
  const li = document.createElement('li');
  li.classList.toggle('ja', w.user_id === mojId);
  for (const [klasa, tekst] of [['miejsce', `${miejsce}.`], ['nick', w.nick], ['poziom', String(w.poziom)]]) {
    const el = document.createElement('span');
    el.className = klasa;
    el.textContent = tekst; // nicki od innych graczy — nigdy innerHTML
    li.append(el);
  }
  return li;
}

async function odswiezRanking() {
  rankingStatus.textContent = 'Wczytywanie…';
  rankingStatus.hidden = false;
  const [top, ja, s] = await Promise.all([baza.pobierzTop10(), baza.mojeMiejsce(), baza.sesja()]);
  rankingLista.replaceChildren();
  rankingLista.hidden = true;
  rankingJa.hidden = true;
  if (!top) {
    rankingStatus.textContent = 'Tabela wyników chwilowo niedostępna';
    return;
  }
  if (top.length === 0) {
    rankingStatus.textContent = 'Nikt jeszcze nie ukończył poziomu — bądź pierwszy!';
    return;
  }
  rankingStatus.hidden = true;
  top.forEach((w, i) => rankingLista.append(wierszRankingu(i + 1, w, s?.user_id)));
  rankingLista.hidden = false;
  if (ja && ja.miejsce > top.length) {
    rankingJa.textContent = `Ty: ${ja.miejsce}. miejsce, poziom ${ja.poziom}`;
    rankingJa.hidden = false;
  }
}
```

- [ ] **Step 5: `src/main.js` — ekrany i start poziomu**

W funkcji `pokazEkran` zamień linię:

```js
  if (nazwa === 'start') rekordEl.textContent = `Najwyższy poziom: ${wczytajRekord(storage)}`;
```

na:

```js
  if (nazwa === 'start') {
    rekordEl.textContent = `Najwyższy poziom: ${wczytajRekord(storage)}`;
    pokazAkcjeStartu();
    odswiezRanking();
  }
```

Zamień funkcję `rozpocznijPoziom`:

```js
function rozpocznijPoziom(poziom) {
  stan = nowyPoziom(poziom, limit());
  pokazEkran('gra');
}
```

na:

```js
function rozpocznijPoziom(poziom) {
  stan = nowyPoziom(poziom, limit());
  pokazEkran('gra');
  zapiszStanGry({ odrazu: true });
}

/** Nowa gra od poziomu 1 — nowy zapis nadpisuje poprzedni (upsert), bez osobnego usuwania. */
function nowaGra() {
  clearTimeout(timerZapisu);
  rozpocznijPoziom(1);
}

function wznow() {
  const odtworzony = stanZZapisu(zapis, limit());
  if (!odtworzony) {
    nowaGra();
    return;
  }
  stan = odtworzony;
  pokazEkran('gra');
  zapiszStanGry({ odrazu: true }); // dla { nowy: true } utrwala wylosowany labirynt
}
```

- [ ] **Step 6: `src/main.js` — obsługa akcji**

W funkcji `obsluz` zamień blok ekranu startowego:

```js
  if (ekran === 'start') {
    if (akcja === 'potwierdz' && !powtorzenie) rozpocznijPoziom(1);
    return;
  }
```

na:

```js
  if (ekran === 'start') {
    if (powtorzenie) return;
    if (akcja === 'potwierdz') {
      aktualizujNick();
      poleNicku.blur();
      if (zapis) wznow();
      else nowaGra();
    } else if (akcja === 'nowaGra') {
      nowaGra();
    }
    return;
  }
```

W bloku ekranu gry zamień przypadek `'menu'`:

```js
    case 'menu':
      stan = null;
      pokazEkran('start');
      return;
```

na:

```js
    case 'menu':
      zapiszStanGry({ odrazu: true });
      stan = null;
      pokazEkran('start');
      return;
```

W przypadku `'nowy'` po `hudKomunikat.textContent = '';` dodaj:

```js
      zapiszStanGry({ odrazu: true });
```

Zamień obsługę zdarzeń ruchu:

```js
      const zdarzenie = ruch(stan, akcja);
      if (zdarzenie === 'klucz') komunikat('Klucz zdobyty!');
      else if (zdarzenie === 'zamkniete') komunikat('Potrzebujesz klucza');
      else if (zdarzenie === 'ukonczony') {
        zapiszRekord(storage, stan.poziom);
        ukonczonyTytul.textContent = `Poziom ${stan.poziom} ukończony`;
        pokazEkran('ukonczony');
        return;
      }
      break;
```

na:

```js
      const zdarzenie = ruch(stan, akcja);
      if (zdarzenie === 'klucz') {
        komunikat('Klucz zdobyty!');
        zapiszStanGry({ odrazu: true });
      } else if (zdarzenie === 'zamkniete') {
        komunikat('Potrzebujesz klucza');
      } else if (zdarzenie === 'ukonczony') {
        zapiszRekord(storage, stan.poziom);
        if (nick()) baza.zapiszWynik(nick(), stan.poziom);
        zapiszStanGry({ odrazu: true }); // zapis wskazuje następny poziom
        ukonczonyTytul.textContent = `Poziom ${stan.poziom} ukończony`;
        pokazEkran('ukonczony');
        return;
      } else if (zdarzenie === 'ruch') {
        zapiszStanGry();
      }
      break;
```

- [ ] **Step 7: `src/main.js` — start strony**

Zamień końcówkę pliku:

```js
podlaczKlawiature(window, obsluz);
window.addEventListener('resize', dopasuj);
new ResizeObserver(dopasuj).observe(obszar);
dopasuj();
pokazEkran('start');
```

na:

```js
poleNicku.value = wczytajNick(storage) ?? '';
nickUwaga.hidden = Boolean(nick());
poleNicku.addEventListener('input', () => { nickUwaga.hidden = Boolean(nick()); });
poleNicku.addEventListener('change', aktualizujNick);

podlaczKlawiature(window, obsluz);
window.addEventListener('resize', dopasuj);
new ResizeObserver(dopasuj).observe(obszar);
// Zamknięcie karty w trakcie gry — ostatni zapis z keepalive, żeby żądanie przeżyło stronę.
window.addEventListener('pagehide', () => {
  if (stan && ekran === 'gra') zapiszStanGry({ odrazu: true, keepalive: true });
});
dopasuj();
pokazEkran('start');
wczytajZapis();
```

(Jeśli Zadanie 5 planu tekstur jest już wdrożone, zachowaj jego dopisek `wczytajTekstury().then(...)` na samym końcu pliku.)

- [ ] **Step 8: Testy automatyczne**

Run: `node --test`
Expected: PASS — wszystkie.

- [ ] **Step 9: Sprawdzenie w przeglądarce**

Run (w tle): `python3 -m http.server 8000` w `/root/vibe-coding/day3`, otwórz `http://192.168.0.183:8000` (Ctrl+F5), konsola (F12) otwarta.

Sprawdź:
1. Ekran startowy od razu; po chwili „Nikt jeszcze nie ukończył poziomu — bądź pierwszy!” albo tabela.
2. Wpisz nick zawierający `w`, `a`, `s`, `d`, `r`, `n` i spację — litery w polu, gra nie startuje; dopisek „Bez nicku…” znika.
3. `Enter` → poziom 1. Ukończ poziom → `Esc` → tabela z Twoim nickiem (wyróżniony), poziom 1.
4. Na poziomie 2 zrób kilka ruchów, zdobądź klucz, odczekaj 3 s, zamknij kartę. Otwórz ponownie → „`Enter` — kontynuuj (poziom 2)” → ten sam labirynt, klucz zdobyty, ta sama pozycja.
5. Ekran startowy z zapisem → `N` → poziom 1, nowy labirynt.
6. `Esc` w trakcie gry → ekran startowy → „Kontynuuj” → ta sama pozycja.
7. Bez nicku: ukończ poziom → wynik nie pojawia się w tabeli.
8. DevTools → Network → Offline, odśwież stronę: gra działa, „Tabela wyników chwilowo niedostępna”, brak „Kontynuuj”, w konsoli najwyżej ostrzeżenia `Supabase:`.
9. Druga przeglądarka (lub okno prywatne) → inny nick → dwa wpisy w tabeli.
10. W Supabase (MCP `execute_sql`): `select nick, poziom from public.wyniki; select user_id, stan->>'poziom' from public.zapisy;` — dane zgodne z rozgrywką.

- [ ] **Step 10: Commit**

```bash
git add index.html style.css src/main.js
git commit -m "Ekran startowy: nick, wznawianie gry i tabela wyników z Supabase"
```

---

### Task 5: Dokumentacja, porządki i publikacja

**Files:**
- Modify: `wymagania.md` (§2, §3, §8, §9, §11, §12), `docs/superpowers/specs/2026-10-13-wyniki-supabase-design.md`

- [ ] **Step 1: `wymagania.md` §2 Technologia**

Po pierwszym punkcie §2 dopisz:

```markdown
- Wyniki i zapis gry: Supabase (Auth anonimowe + PostgREST) wywoływany przez `fetch` — usługa zewnętrzna,
  bez bibliotek. Gra działa w pełni bez niej (bez tabeli wyników i wznawiania).
```

- [ ] **Step 2: `wymagania.md` §3 Struktura plików**

Pod wierszem `src/main.js` dopisz:

```markdown
| `src/baza.js` | Komunikacja z Supabase: anonimowa sesja, wyniki, zapis stanu gry (nigdy nie rzuca) |
| `src/konfiguracja.js` | Publiczny adres i klucz publikowalny Supabase |
| `supabase/migrations/*.sql` | Schemat bazy: tabele `wyniki`, `zapisy`, RLS, funkcje `zapisz_wynik`, `moje_miejsce` |
```

Zdanie o DOM zamień na: `` `maze.js`, `game.js` i `baza.js` nie mogą odwoływać się do DOM ani `window` (testowalne w Node; `fetch` i `storage` wstrzykiwane do `baza.js`). ``

- [ ] **Step 3: `wymagania.md` §8 Ekrany**

Zamień punkt 1:

```markdown
1. **Start:** tytuł, rekord („Najwyższy poziom: N”), instrukcja sterowania, `Enter`/`Spacja` = start.
```

na:

```markdown
1. **Start:** tytuł, rekord („Najwyższy poziom: N”), pole nicku (1–20 znaków; bez nicku wynik nie trafia
   do tabeli), instrukcja sterowania, tabela wyników (top 10, własny wiersz wyróżniony, „Ty: N. miejsce”
   poza dziesiątką). Bez zapisu: `Enter`/`Spacja` = start. Z zapisem przerwanej gry: `Enter` = kontynuuj
   (ten sam labirynt), `N` = nowa gra.
```

- [ ] **Step 4: `wymagania.md` §9 Zapis**

Dopisz na końcu §9:

```markdown
- Nick w `localStorage` (`labirynt.nick`), sesja anonimowa Supabase w `localStorage` (`labirynt.sesja`).
- Wynik online: najwyższy ukończony poziom gracza w tabeli `wyniki` (tylko rośnie), zapisywany po ukończeniu
  poziomu, gdy podano nick.
- Stan przerwanej gry w tabeli `zapisy`: przy starcie poziomu, `R`, zdobyciu klucza, `Esc`, zamknięciu karty
  i po ruchach (najwyżej raz na 3 s). Po ukończeniu poziomu zapis wskazuje następny poziom.
```

- [ ] **Step 5: `wymagania.md` §11 i §12**

W §11 zamień `dźwięk, seed labiryntu, tabela wyników online, przełączanie motywów graficznych.` (albo `…, tabela wyników online, motywy graficzne.`, jeśli plan tekstur nie jest jeszcze wdrożony — zachowaj pozostałe pozycje bez zmian) tak, by zniknęła pozycja „tabela wyników online”, i dopisz na końcu listy: `konta z logowaniem, wznawianie na innym urządzeniu, walidacja wyników po stronie serwera.`

W §12 w części automatycznej dopisz:

```markdown
- Zapis stanu: wierne odtworzenie; ukończony poziom → następny; uszkodzone dane → brak wznowienia.
- Nick: obcięcie spacji, maks. 20 znaków (punktów kodowych), pusty → brak wpisu.
- `baza.js` (atrapa `fetch`): logowanie, odświeżenie tokenu, brak nowej tożsamości przy braku sieci,
  błędy i przekroczenie czasu → `null`/`false` bez wyjątku.
- Pole nicku: litery i spacja nie sterują grą.
```

W części ręcznej dopisz:

```markdown
- Wynik w tabeli po ukończeniu poziomu; zamknięcie karty → „Kontynuuj” odtwarza ten sam labirynt; tryb offline.
```

- [ ] **Step 6: Specyfikacja — odstępstwo**

W `docs/superpowers/specs/2026-10-13-wyniki-supabase-design.md` w §4 zamień linię
`- `N` (nowa gra) — `usunStan()`, potem start poziomu 1.` na
`- `N` (nowa gra) — start poziomu 1; jego zapis nadpisuje poprzedni (upsert). `usunStan()` nie jest wołane, bo równoległe DELETE i POST mogłyby dojść w odwrotnej kolejności.`

- [ ] **Step 7: Pełne testy**

Run: `node --test`
Expected: PASS, `# fail 0`.

- [ ] **Step 8: Wyczyść dane testowe z bazy (po akceptacji użytkownika)**

Zapytaj użytkownika, czy usunąć wpisy z ręcznych testów. Jeśli tak (MCP `execute_sql`):

```sql
delete from auth.users where is_anonymous; -- kaskadowo usuwa wyniki i zapisy
```

- [ ] **Step 9: Commit i publikacja**

```bash
git add wymagania.md docs/superpowers/specs/2026-10-13-wyniki-supabase-design.md docs/superpowers/plans/
git commit -m "Wymagania: tabela wyników online i wznawianie gry"
git push github main
```

Po ~1 min: `gh api repos/kuszmartomasz-hue/Maze/pages/builds/latest --jq .status` → `built`. Otwórz https://kuszmartomasz-hue.github.io/Maze/ i powtórz punkty 1, 3, 4 i 8 z Zadania 4, Step 9.
