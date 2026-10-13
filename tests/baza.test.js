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

test('sesja: 429 i inne 4xx poza 400/401 przy odświeżaniu NIE zakładają nowego konta', async () => {
  for (const status of [403, 408, 429]) {
    const zapisana = { access_token: 'T0', refresh_token: 'R0', expires_at: 10, user_id: 'U0' };
    const storage = pamiecStorage({ [KLUCZ_SESJI]: JSON.stringify(zapisana) });
    const { b, f } = baza({ ...LOGOWANIE, 'POST /auth/v1/token': { status, tresc: { error_code: 'over_request_rate_limit' } } }, { storage });
    assert.equal(await b.sesja(), null, `status ${status}`);
    assert.equal(f.ile('POST', '/auth/v1/signup'), 0, `status ${status}`);
    assert.deepEqual(JSON.parse(storage.dane[KLUCZ_SESJI]), zapisana);
  }
});

test('sesja: odrzucony token 401 → nowe logowanie', async () => {
  const storage = pamiecStorage({ [KLUCZ_SESJI]: JSON.stringify({ access_token: 'T0', refresh_token: 'R0', expires_at: 10, user_id: 'U0' }) });
  const { b, f } = baza({ ...LOGOWANIE, 'POST /auth/v1/token': { status: 401, tresc: {} } }, { storage });
  assert.equal((await b.sesja()).user_id, 'U1');
  assert.equal(f.ile('POST', '/auth/v1/signup'), 1);
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
