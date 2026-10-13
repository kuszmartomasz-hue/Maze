// Zrzuty wzorcowe „Zaklętego Ogrodu” do testów wizualnych. Uruchomienie: node zrzuty.mjs
import { createRequire } from 'node:module';
const require = createRequire('/root/AplikacjaMowy/');
const { chromium } = require('playwright-core');
const { nowyPoziom, stanDoZapisu, ruch } = await import('../../src/game.js');
const { mulberry32 } = await import('../helpers.js');

const SUPA = 'https://tnqgzkzxzzsaflhjywgb.supabase.co';
const DIR = new URL('.', import.meta.url).pathname;
const ZIARNO = 20240607;
const TOP = [
  { user_id: 'u1', nick: 'Ania', poziom: 12 },
  { user_id: 'u2', nick: 'Bartek', poziom: 9 },
  { user_id: 'u3', nick: 'Celina', poziom: 7 },
  { user_id: 'u4', nick: 'Darek', poziom: 4 },
];
const KLAWISZE = { gora: 'ArrowUp', prawo: 'ArrowRight', dol: 'ArrowDown', lewo: 'ArrowLeft' };
const BITY = { gora: [1, 0, -1], prawo: [2, 1, 0], dol: [4, 0, 1], lewo: [8, -1, 0] };

// Najkrótsza ścieżka (lista kierunków) z odkodowanego zapisu labiryntu
function sciezka(zapis, cel) {
  const { szerokosc: w, wysokosc: h } = zapis;
  const m = [...zapis.przejscia].map((c) => parseInt(c, 16));
  const start = zapis.gracz.y * w + zapis.gracz.x, koniec = cel.y * w + cel.x;
  const skad = new Map([[start, null]]);
  const kolejka = [start];
  while (kolejka.length) {
    const i = kolejka.shift();
    if (i === koniec) break;
    for (const [k, [bit, dx, dy]] of Object.entries(BITY)) {
      if (!(m[i] & bit)) continue;
      const j = ((i / w | 0) + dy) * w + (i % w) + dx;
      if (!skad.has(j)) { skad.set(j, [i, k]); kolejka.push(j); }
    }
  }
  const wynik = [];
  for (let i = koniec; skad.get(i); i = skad.get(i)[0]) wynik.unshift(skad.get(i)[1]);
  return wynik;
}

const browser = await chromium.launch({
  executablePath: '/root/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

async function scenariusz(plik, poziom, { opcje = {}, blokujThree = false, kroki = async () => {} } = {}) {
  const zapis = stanDoZapisu(nowyPoziom(poziom, 30, mulberry32(ZIARNO + poziom)));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, ...opcje });
  await ctx.route(`${SUPA}/**`, (r) => {
    const u = r.request().url();
    const json = (b) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (u.includes('/auth/v1/signup') || u.includes('/auth/v1/token')) return json({ access_token: 'T', refresh_token: 'R', expires_at: 9999999999, user: { id: 'U' } });
    if (u.includes('/rest/v1/zapisy') && r.request().method() === 'GET') return json([{ stan: zapis }]);
    if (u.includes('moje_miejsce')) return json([]);
    if (u.includes('/rest/v1/wyniki')) return json(TOP);
    return r.fulfill({ status: 204, body: '' });
  });
  if (blokujThree) await ctx.route('**/vendor/three/**', (r) => r.abort());
  await ctx.addInitScript((ziarno) => {
    let a = ziarno >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    try { localStorage.setItem('labirynt.nick', 'Ania'); } catch {}
  }, ZIARNO);
  const p = await ctx.newPage();
  const bledy = [];
  p.on('pageerror', (e) => bledy.push(e.message));
  await p.goto('http://localhost:8000/');
  await p.waitForSelector('#akcja-wznow:not([hidden])');
  await p.waitForSelector('#ranking-lista:not([hidden])');
  await p.waitForTimeout(1800);
  await kroki(p, zapis);
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `${DIR}${plik}.png`, timeout: 180000 });
  if (bledy.length) console.log('BŁĘDY JS', plik, bledy);
  await ctx.close();
}

const start = async (p) => { await p.keyboard.press('Enter'); await p.waitForTimeout(1800); };
async function idz(p, kierunki) {
  for (const k of kierunki) { await p.keyboard.press(KLAWISZE[k]); await p.waitForTimeout(350); }
}

await scenariusz('01-ekran-startowy-tabela', 1);
await scenariusz('02-poziom1-klucz-i-drzwi', 1, { kroki: start });
await scenariusz('03-poziom3-mgla', 3, { kroki: async (p, z) => { await start(p); await idz(p, sciezka(z, z.klucz).slice(0, 4)); } });
await scenariusz('04-poziom2-klucz-zdobyty', 2, { kroki: async (p, z) => {
  await start(p);
  await idz(p, sciezka(z, z.klucz));
  await p.waitForSelector('#hud-klucz.ma-klucz, #hud-klucz:not(:has-text("Brak"))').catch(() => {});
} });
await scenariusz('05-zapasowy-renderer-2d', 1, { blokujThree: true, kroki: start });
await browser.close();
