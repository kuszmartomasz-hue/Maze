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
        // Tylko odrzucony token (400/401) uzasadnia nowe konto; brak sieci, limit żądań (429)
        // ani błąd pośrednika nie mogą zabrać graczowi tożsamości.
        if (e.status !== 400 && e.status !== 401) throw e;
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
