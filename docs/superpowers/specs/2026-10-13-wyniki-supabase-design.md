# Zaklęty Ogród — tabela wyników i wznawianie gry (Supabase)

Data: 2026-10-13 · Status: zatwierdzony projekt, do planu wdrożenia

## Cel

1. Wspólna tabela wyników online: najwyższy ukończony poziom każdego gracza, top 10 na ekranie startowym.
2. Wznawianie przerwanej gry dokładnie w tym samym labiryncie (pozycja, klucz, odkryta mgła).

Gra działa w pełni także bez bazy (brak sieci, uśpiony projekt, błąd) — wtedy bez tabeli i bez „Kontynuuj”.

## Decyzje

| Temat | Decyzja |
|---|---|
| Backend | Supabase, projekt „Labirynt” (`tnqgzkzxzzsaflhjywgb`, eu-west-1) |
| Tożsamość | Anonimowe logowanie Supabase — bez kont, tożsamość przypisana do przeglądarki |
| Wynik | Najwyższy ukończony poziom; remis → wcześniej osiągnięty wyżej |
| Nick | Pole na ekranie startowym, zapamiętane w przeglądarce; bez nicku wynik nie trafia do tabeli |
| Wznawianie | Ekran startowy: `Enter` — kontynuuj (ten sam labirynt), `N` — nowa gra |
| Tabela | Top 10 na ekranie startowym + „Ty: N. miejsce” poza dziesiątką |
| Komunikacja | Czysty `fetch` do REST API Supabase, bez bibliotek |

## 1. Baza danych

Migracja `wyniki_i_zapisy` (stosowana przez Supabase MCP `apply_migration`):

```sql
-- Tabela wyników: jeden wiersz na gracza, zapis tylko przez funkcję zapisz_wynik.
create table public.wyniki (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  nick text not null check (char_length(nick) between 1 and 20 and nick = btrim(nick)),
  poziom int not null check (poziom between 1 and 500),
  osiagniety timestamptz not null default now()
);
create index wyniki_ranking on public.wyniki (poziom desc, osiagniety asc);

alter table public.wyniki enable row level security;
create policy "wyniki: odczyt dla wszystkich" on public.wyniki
  for select to anon, authenticated using (true);
-- brak polityk insert/update/delete — zapis wyłącznie przez zapisz_wynik

-- Stan przerwanej gry: jeden wiersz na gracza, widoczny tylko dla niego.
create table public.zapisy (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  stan jsonb not null check (pg_column_size(stan) <= 16384),
  zaktualizowany timestamptz not null default now()
);

alter table public.zapisy enable row level security;
create policy "zapisy: własny odczyt" on public.zapisy
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "zapisy: własne dodanie" on public.zapisy
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "zapisy: własna zmiana" on public.zapisy
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "zapisy: własne usunięcie" on public.zapisy
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Wynik tylko rośnie; przy wyższym poziomie odświeża się czas osiągnięcia; nick zawsze aktualny.
create function public.zapisz_wynik(p_nick text, p_poziom int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'brak sesji';
  end if;
  insert into public.wyniki (user_id, nick, poziom)
  values ((select auth.uid()), btrim(p_nick), p_poziom)
  on conflict (user_id) do update set
    nick = excluded.nick,
    osiagniety = case when excluded.poziom > public.wyniki.poziom then now() else public.wyniki.osiagniety end,
    poziom = greatest(public.wyniki.poziom, excluded.poziom);
end;
$$;
revoke execute on function public.zapisz_wynik(text, int) from public, anon;
grant execute on function public.zapisz_wynik(text, int) to authenticated;

-- Miejsce gracza w rankingu (null, gdy nie ma wyniku).
create function public.moje_miejsce()
returns table (miejsce bigint, poziom int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.wyniki w
      where w.poziom > m.poziom or (w.poziom = m.poziom and w.osiagniety < m.osiagniety)) + 1,
    m.poziom
  from public.wyniki m
  where m.user_id = (select auth.uid());
$$;
revoke execute on function public.moje_miejsce() from public, anon;
grant execute on function public.moje_miejsce() to authenticated;
```

Uwagi:
- Gracze anonimowi mają rolę `authenticated` (z `is_anonymous = true` w tokenie) — polityki działają dla nich bez zmian.
- W `on conflict do update` wyrażenia `set` widzą stare wartości wiersza (`public.wyniki.*`), więc porównanie w `osiagniety` działa niezależnie od kolejności przypisań.
- Po migracji: `get_advisors` (security, performance) bez ostrzeżeń dotyczących tych tabel, poza jednym
  zamierzonym: `zapisz_wynik` jako `security definer` wykonywalna przez `authenticated` — to jedyna droga
  zapisu wyniku (brak polityk insert/update na `wyniki`).
- Wdrożone 2026-10-13: migracje w `supabase/migrations/`; druga migracja zmienia `moje_miejsce`
  na `security invoker` (tabela `wyniki` jest czytelna dla wszystkich, więc uprawnienia właściciela są zbędne).

**Do włączenia ręcznie w panelu Supabase:** *Authentication → Sign In / Providers → Allow anonymous sign-ins*.

## 2. Moduł `src/baza.js`

Komunikacja z Supabase przez `fetch`, bez bibliotek. Konfiguracja w `src/konfiguracja.js`:

```js
export const SUPABASE_URL = 'https://tnqgzkzxzzsaflhjywgb.supabase.co';
export const SUPABASE_KLUCZ = 'sb_publishable_RfoBfZmDXH2nWBTPf-y1-A_PSWDqWjl';
```

Klucz publikowalny (`sb_publishable_…`, nie legacy `anon` JWT) jest jawny z założenia — dostępu pilnuje RLS.
Klucza `service_role` / `sb_secret_…` nigdy nie umieszczamy w kodzie.

Interfejs (wszystkie funkcje asynchroniczne, **nigdy nie rzucają**; błąd, brak sieci lub przekroczenie
5 s → `null` / `false`):

| Funkcja | Wywołanie REST | Wynik |
|---|---|---|
| `utworzBaze({ fetch, storage, teraz, url, klucz })` | — | obiekt z poniższymi metodami (zależności wstrzykiwane do testów) |
| `sesja()` | `POST /auth/v1/signup` (pierwszy raz), `POST /auth/v1/token?grant_type=refresh_token` (gdy token wygasa za < 60 s) | `{ access_token, user_id }` albo `null` |
| `zapiszWynik(nick, poziom)` | `POST /rest/v1/rpc/zapisz_wynik` | `true` / `false` |
| `pobierzTop10()` | `GET /rest/v1/wyniki?select=user_id,nick,poziom&order=poziom.desc,osiagniety.asc&limit=10` | tablica albo `null` |
| `mojeMiejsce()` | `POST /rest/v1/rpc/moje_miejsce` | `{ miejsce, poziom }` albo `null` |
| `zapiszStan(dane, { keepalive })` | `POST /rest/v1/zapisy` z `Prefer: resolution=merge-duplicates` | `true` / `false` |
| `wczytajStan()` | `GET /rest/v1/zapisy?select=stan` | obiekt stanu albo `null` |
| `usunStan()` | `DELETE /rest/v1/zapisy?user_id=eq.<id>` | `true` / `false` |

- Nagłówki: `apikey: <klucz>`, `Authorization: Bearer <access_token>`, `Content-Type: application/json`.
- Sesja w `localStorage` pod `labirynt.sesja`: `{ access_token, refresh_token, expires_at, user_id }`.
  Nieudane odświeżenie (np. usunięty użytkownik) → nowe anonimowe logowanie.
- Jedno logowanie naraz: równoległe wywołania czekają na tę samą obietnicę sesji.
- Przekroczenie czasu: `AbortController`, 5 s.

## 3. Zapis i odtworzenie stanu (`src/game.js`, czyste funkcje)

```js
stanDoZapisu(stan) → {
  wersja: 2, poziom, szerokosc, wysokosc,
  przejscia: string,               // maski jako hex, 1 znak na komórkę
  gracz: {x, y}, klucz: {x, y}, wyjscie: {x, y},
  maKlucz: boolean, odkryte: string, // bitmapa hex, 4 komórki na znak
}
stanDoZapisu(stan) dla ukończonego poziomu → { wersja: 2, poziom: stan.poziom + 1, nowy: true }

stanZZapisu(dane, limit = Infinity, rng = Math.random) → stan | null
```

- `{ nowy: true }` → `nowyPoziom(poziom, limit, rng)`.
- Zwarty format (wersja 2, po recenzji 2026-10-13): wersja 1 z tablicami liczb przekraczała limit 16 KB
  już przy planszy 26×26 (poziom 10); plansza 200×200 zajmuje teraz ok. 50 KB, limit `zapisy` podniesiony
  do 64 KB migracją `20261013000002_zapisy_limit_64kb.sql`.
- Pełny zapis → walidacja; `null`, gdy: `wersja !== 2`; napisy `przejscia`/`odkryte` złej długości lub spoza `[0-9a-f]`; poziom nie jest liczbą całkowitą 1–500;
  wymiary nie są liczbami całkowitymi 2–200 albo `przejscia.length !== szerokosc·wysokosc`;
  maska spoza 0–15, przejście poza siatkę lub niesymetryczne; pozycje poza siatką;
  labirynt niespójny (BFS z gracza nie dochodzi do wszystkich komórek); odkryte poza zakresem.
- Odtworzony stan: `mgla = czyMgla(poziom)`, widoczność przeliczona (`aktualizujWidocznosc`),
  `odkryte` = zapisane ∪ widoczne.
- Wznowiony labirynt zachowuje swój rozmiar, nawet jeśli jest większy niż obecny `limitRozmiaru`
  (renderer zmniejszy komórki).

## 4. Moment zapisu (`src/main.js`)

- start poziomu (`rozpocznijPoziom`), `R` (nowy labirynt), zdobycie klucza — od razu;
- ruch — najwyżej raz na 3 s (zapis odroczony, ostatni stan wygrywa);
- ukończenie poziomu — `zapiszWynik(nick, poziom)` (gdy jest nick) i zapis `{ nowy: true }` następnego poziomu;
- `pagehide` — zapis z `keepalive: true`, jeśli trwa gra;
- `N` (nowa gra) — start poziomu 1; jego zapis nadpisuje poprzedni (upsert). `usunStan()` nie jest wołane, bo równoległe DELETE i POST mogłyby dojść w odwrotnej kolejności.

## 5. Ekran startowy i klawiatura

`index.html` — w karcie startowej:
- pole `<input id="nick" maxlength="20" autocomplete="nickname" placeholder="Twój nick">` z etykietą;
  pod nim dopisek „Bez nicku wynik nie trafi do tabeli” (ukryty, gdy nick wpisany);
- akcje: bez zapisu — „`Enter` — start”; z zapisem — „`Enter` — kontynuuj (poziom N)” i „`N` — nowa gra”;
- sekcja „Tabela wyników”: lista `<ol>` (miejsce, nick, poziom), własny wiersz wyróżniony,
  pod listą „Ty: N. miejsce, poziom P”, gdy gracz jest poza top 10;
  przy błędzie — „Tabela wyników chwilowo niedostępna”; podczas ładowania — „Wczytywanie…”.
- Nicki zawsze przez `textContent`, nigdy `innerHTML`.

`src/input.js`:
- nowy klawisz `KeyN` → akcja `nowaGra`;
- gdy zdarzenie pochodzi z pola tekstowego (`e.target` to `INPUT`): przechodzi tylko `Enter`
  (akcja `potwierdz`) i `Escape` (wyjście z pola — `blur`, bez akcji `menu`); pozostałe klawisze
  (w tym Spacja, WASD, `R`, `N`) piszą w polu.

Nick: `normalizujNick(tekst)` (czysta funkcja w `src/game.js`) — obcięcie spacji, maks. 20 znaków,
pusty → `null`. Zapamiętany w `localStorage` pod `labirynt.nick` przy `Enter`/`blur`.

Kolejność na starcie strony: ekran startowy od razu; równolegle `sesja()` → `wczytajStan()`
i `pobierzTop10()` + `mojeMiejsce()`; „Kontynuuj” i tabela dochodzą po odpowiedzi.

## 6. Błędy i bezpieczeństwo

- Każdy błąd bazy → gra działa dalej; w konsoli najwyżej `console.warn`, bez wyjątków.
- Ochrona wyników: RLS + funkcja `security definer` (tylko własny wynik, tylko w górę, poziom 1–500,
  nick 1–20 znaków). Fałszowania wyników przez spreparowane wywołania nie da się w pełni
  wykluczyć — akceptowane dla gry warsztatowej.
- Anonimowe konta: domyślny limit Supabase 30 rejestracji/h z jednego IP.
- Supabase Free usypia projekt po tygodniu bez ruchu — wtedy gra działa bez tabeli i wznawiania.

## 7. Testy

Automatyczne (`node --test`):
- `stanDoZapisu` → `stanZZapisu`: wierne odtworzenie (labirynt, pozycje, klucz, odkryte, widoczne);
  `{ nowy: true }` → nowy poziom; odrzucenie: zła wersja, złe wymiary, maska spoza zakresu,
  przejście niesymetryczne, pozycja poza siatką, labirynt niespójny, śmieci (`null`, string, `{}`).
- `normalizujNick`: obcięcie, limit 20, pusty → `null`.
- `baza.js` z atrapą `fetch` i `storage`: pierwsze logowanie zapisuje sesję; ważna sesja nie loguje
  ponownie; wygasająca odświeża; nieudane odświeżenie → nowe logowanie; równoległe wywołania → jedno
  logowanie; błąd HTTP, wyjątek sieci i przekroczenie czasu → `null`/`false` bez wyjątku;
  poprawne adresy, metody i nagłówki.
- `input.js`: klawisze z pola tekstowego nie wywołują akcji gry poza `Enter`.

Baza (SQL przez MCP, na dwóch symulowanych użytkownikach w transakcji z `rollback`):
- gracz B nie widzi zapisu gracza A; bezpośredni `insert`/`update` do `wyniki` odrzucony;
- `zapisz_wynik` z niższym poziomem nie obniża wyniku; nick 21 znaków odrzucony; poziom 501 odrzucony;
- `moje_miejsce` zgodne z kolejnością rankingu.

Ręczne (przeglądarka, lokalnie i na GitHub Pages):
- nick → gra → poziom ukończony → wynik w tabeli; zamknięcie karty w trakcie → po powrocie
  „Kontynuuj” odtwarza ten sam labirynt; `N` zaczyna od nowa;
- tryb offline (DevTools → Offline): gra działa, tabela „chwilowo niedostępna”, brak „Kontynuuj”;
- dwie przeglądarki → dwóch różnych graczy w tabeli.

## 8. Zmiany w wymaganiach (`wymagania.md`)

- §2 Technologia: Supabase jako zewnętrzna usługa (REST przez `fetch`), nadal bez zależności runtime.
- §3 Struktura plików: `src/baza.js`, `src/konfiguracja.js`.
- §8 Ekrany: ekran startowy z polem nicku, „Kontynuuj”/„Nowa gra” i tabelą wyników.
- §9 Zapis: wynik online, stan przerwanej gry w bazie, sesja i nick w `localStorage`.
- §11 Poza zakresem: usunąć „tabela wyników online”; dopisać „konta z logowaniem, wznawianie na innym urządzeniu”.
- §12: testy z pkt 7.

## Poza zakresem

Logowanie e-mailem/GitHubem, wznawianie na innym urządzeniu, walidacja wyników po stronie serwera
(Edge Function), stoper, historia rozgrywek, moderacja nicków.
