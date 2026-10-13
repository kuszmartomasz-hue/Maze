// Renderer 3D (three.js): las o zmierzchu, żywopłot, gracz, klucz, drzwi, mgła wojny i kamera śledząca.
// Geometria planszy pochodzi z swiat3d.js, przebieg animacji z animacji.js — tu tylko obiekty sceny.
import * as THREE from 'three';
import {
  WYSOKOSC_ZYWOPLOTU, rozmiarPlanszy3d, srodekKomorki3d, blokiZywoplotu, polaSiatki3d, drzewaLasu, kamera3d,
} from './swiat3d.js';
import {
  pozycjaGracza, postep, kryciePola, aktualizujMgle, stanIskry, stanSwietlika, unoszenieKlucza, pulsDrzwi, rozblysk,
  easeOutCubic,
} from './animacje.js';
import { stanyPol } from './render.js';
import { generujLabirynt, indeks, N, S } from './maze.js';

const KOLORY = {
  niebo: 0x1d2638,
  mgla: 0x07090d,
  gracz: 0x4fc3ff,
  klucz: 0xffc83d,
  zamkniete: new THREE.Color(0xff6b6b),
  otwarte: new THREE.Color(0x5ee08a),
};
/** Wysokość brył mgły wojny — wyższa od żywopłotu z wariacją. */
const WYSOKOSC_MGLY = 1.35;
const GESTOSC_MGLY = { zwykla: 0.018, gesta: 0.05 };
/** Dojazd kamery z ujęcia całej planszy do gracza na początku poziomu. */
const CZAS_NAJAZDU = 900;
const CZAS_OTWARCIA = 600;
const KAT_OTWARCIA = (100 * Math.PI) / 180;
const PROMIEN_GRACZA = 0.28;
const WYSOKOSC_LOTU = 0.62;

/** Deterministyczny generator liczb (mulberry32) — ten sam las dla tego samego rozmiaru planszy. */
function ziarno(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Złączenie geometrii bez indeksów (pozycje, normalne, uv) — korona drzewa z dwóch stożków. */
function zlacz(geometrie) {
  const czesci = geometrie.map((g) => g.toNonIndexed());
  const wynik = new THREE.BufferGeometry();
  for (const nazwa of ['position', 'normal', 'uv']) {
    const rozmiar = czesci[0].getAttribute(nazwa).itemSize;
    const dane = new Float32Array(czesci.reduce((s, g) => s + g.getAttribute(nazwa).array.length, 0));
    let o = 0;
    for (const g of czesci) {
      dane.set(g.getAttribute(nazwa).array, o);
      o += g.getAttribute(nazwa).array.length;
    }
    wynik.setAttribute(nazwa, new THREE.BufferAttribute(dane, rozmiar));
  }
  czesci.forEach((g) => g.dispose());
  geometrie.forEach((g) => g.dispose());
  return wynik;
}

/** Kołysanie koron w shaderze: wierzchołki przesuwane proporcjonalnie do wysokości, faza z pozycji instancji. */
function dodajKolysanie(material, czasUniform) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCzas = czasUniform;
    shader.vertexShader = `uniform float uCzas;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float faza = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.53;
        float kolys = sin(uCzas * 1.1 + faza) * 0.06 + sin(uCzas * 2.3 + faza * 1.7) * 0.02;
        transformed.x += kolys * position.y;
        transformed.z += kolys * 0.6 * position.y;
      #endif`,
    );
  };
  return material;
}

/** Miękka okrągła plamka światła — tekstura cząsteczek (iskry, świetliki) i poświaty. */
function teksturaPlamki() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Otoczenie do odbić metalu: gradient zmierzchu (chłodne niebo, ciepły horyzont, ciemna ziemia). */
function otoczenie(renderer) {
  const scena = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const kolory = [];
  const poz = geo.getAttribute('position');
  const gora = new THREE.Color(0x3a5a9a);
  const horyzont = new THREE.Color(0xffb070);
  const dol = new THREE.Color(0x141a12);
  for (let i = 0; i < poz.count; i++) {
    const y = poz.getY(i) / 10;
    const k = y > 0 ? horyzont.clone().lerp(gora, Math.min(1, y * 1.6)) : horyzont.clone().lerp(dol, Math.min(1, -y * 3));
    kolory.push(k.r, k.g, k.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(kolory, 3));
  scena.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const cel = pmrem.fromScene(scena, 0.04);
  pmrem.dispose();
  geo.dispose();
  return cel.texture;
}

function teksturaZObrazu(obraz, anizotropia) {
  if (!obraz) return null;
  const t = new THREE.Texture(obraz);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anizotropia;
  t.needsUpdate = true;
  return t;
}

/** Klucz: złote ucho (torus), trzon i ząbki. */
function modelKlucza(material) {
  const g = new THREE.Group();
  const ucho = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 12, 28), material);
  ucho.position.y = 0.2;
  const trzon = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.42, 12), material);
  trzon.position.y = -0.11;
  const zab1 = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.04), material);
  zab1.position.set(0.07, -0.26, 0);
  const zab2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.04), material);
  zab2.position.set(0.055, -0.16, 0);
  for (const m of [ucho, trzon, zab1, zab2]) {
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

/** Drzwi: kamienna rama i skrzydło obracane na zawiasie (grupa `zawias`). */
function modelDrzwi(materialRamy, materialSkrzydla) {
  const g = new THREE.Group();
  const czesci = [
    [new THREE.BoxGeometry(0.1, 1.15, 0.14), -0.44, 0.575],
    [new THREE.BoxGeometry(0.1, 1.15, 0.14), 0.44, 0.575],
    [new THREE.BoxGeometry(0.98, 0.1, 0.16), 0, 1.15],
  ];
  for (const [geo, x, y] of czesci) {
    const m = new THREE.Mesh(geo, materialRamy);
    m.position.set(x, y, 0);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  const zawias = new THREE.Group();
  zawias.position.set(-0.39, 0, 0);
  const skrzydlo = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.04, 0.06), materialSkrzydla);
  skrzydlo.position.set(0.39, 0.54, 0);
  skrzydlo.castShadow = true;
  const klamka = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), materialRamy);
  klamka.position.set(0.68, 0.52, 0.05);
  zawias.add(skrzydlo, klamka);
  g.add(zawias);
  g.userData.zawias = zawias;
  return g;
}

/**
 * Tworzy renderer 3D na `canvas` (osobny element). Rzuca wyjątek, gdy WebGL niedostępny.
 * `przyUtracie` wywoływane po utracie kontekstu WebGL — wtedy scenę trzeba porzucić.
 */
export function utworzScene3d(canvas, tekstury, przyUtracie) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  try {
    return zbudujScene3d(renderer, canvas, tekstury, przyUtracie);
  } catch (e) {
    renderer.dispose();
    throw e;
  }
}

function zbudujScene3d(renderer, canvas, tekstury, przyUtracie) {
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    przyUtracie?.();
  });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoftShadowMap usunięty w r186 — miękkość z shadow.radius
  const anizotropia = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scena = new THREE.Scene();
  scena.background = new THREE.Color(KOLORY.niebo);
  scena.fog = new THREE.FogExp2(KOLORY.niebo, GESTOSC_MGLY.zwykla);
  scena.environment = otoczenie(renderer);
  scena.environmentIntensity = 0.35;

  const kamera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);

  // --- Światła: chłodne niebo i ciepłe, niskie słońce z cieniem podążającym za graczem ---
  const niebo = new THREE.HemisphereLight(0x9fbcff, 0x3a3020, 1.6);
  const slonce = new THREE.DirectionalLight(0xffc89a, 2.8);
  const PRZESUNIECIE_SLONCA = new THREE.Vector3(-10, 10, 5);
  slonce.castShadow = true;
  slonce.shadow.mapSize.set(2048, 2048);
  slonce.shadow.radius = 3;
  slonce.shadow.bias = -0.0006;
  slonce.shadow.normalBias = 0.02;
  Object.assign(slonce.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
  scena.add(niebo, slonce, slonce.target);

  // --- Materiały ---
  const czasUniform = { value: 0 };
  const matZiemi = new THREE.MeshStandardMaterial({ color: 0x8a9a80, roughness: 1 });
  const matPolany = new THREE.MeshStandardMaterial({ color: 0xb8ad9a, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const matZywoplotu = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const matPnia = new THREE.MeshStandardMaterial({ color: 0x4a3423, roughness: 1 });
  const matKorony = dodajKolysanie(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }), czasUniform);
  const glebiaKorony = dodajKolysanie(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), czasUniform);
  const matMgly = new THREE.MeshStandardMaterial({ color: KOLORY.mgla, roughness: 1 });
  const matCienia = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const plamka = teksturaPlamki();

  // --- Ziemia lasu i polana ---
  const ziemia = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), matZiemi);
  ziemia.receiveShadow = true;
  const polana = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), matPolany);
  polana.position.y = 0.005;
  polana.receiveShadow = true;
  scena.add(ziemia, polana);

  // --- Gracz: świecąca kula, poświata i niebieskie światło ---
  const gracz = new THREE.Group();
  const kula = new THREE.Mesh(
    new THREE.SphereGeometry(PROMIEN_GRACZA, 32, 20),
    new THREE.MeshStandardMaterial({ color: 0x9fdcff, emissive: KOLORY.gracz, emissiveIntensity: 0.6, roughness: 0.25, metalness: 0.1 }),
  );
  kula.castShadow = true;
  const poswiata = new THREE.Sprite(new THREE.SpriteMaterial({
    map: plamka, color: KOLORY.gracz, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  poswiata.scale.setScalar(1.6);
  const swiatloGracza = new THREE.PointLight(KOLORY.gracz, 6, 6, 1.6);
  swiatloGracza.position.y = 0.5;
  gracz.add(kula, poswiata, swiatloGracza);
  scena.add(gracz);

  // --- Klucz ---
  const matKlucza = new THREE.MeshStandardMaterial({
    color: KOLORY.klucz, metalness: 1, roughness: 0.22, emissive: 0x5a3c00, emissiveIntensity: 0.6, envMapIntensity: 2.5,
  });
  const klucz = modelKlucza(matKlucza);
  klucz.scale.setScalar(1.5);
  const swiatloKlucza = new THREE.PointLight(0xffc860, 0, 3.5, 1.6);
  scena.add(klucz, swiatloKlucza);

  // --- Drzwi, poświata otwartych i rozbłysk ukończenia ---
  const matRamy = new THREE.MeshStandardMaterial({ color: 0x8b8578, roughness: 0.8 });
  const matSkrzydla = new THREE.MeshStandardMaterial({ color: KOLORY.zamkniete.clone(), emissive: KOLORY.zamkniete.clone(), emissiveIntensity: 0.35, roughness: 0.6 });
  const drzwi = modelDrzwi(matRamy, matSkrzydla);
  const swiatloDrzwi = new THREE.PointLight(0xff6b6b, 0, 4, 1.6);
  const swiatloRozblysku = new THREE.PointLight(0xd8ffe6, 0, 14, 1.4);
  const pierscien = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xb8ffd0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  scena.add(drzwi, swiatloDrzwi, swiatloRozblysku, pierscien);

  // --- Cząsteczki: iskry klucza i świetliki ---
  const MAX_ISKIER = 32;
  const MAX_SWIETLIKOW = 24;
  function czasteczki(ile, kolor, rozmiar) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ile * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ile * 3), 3));
    geo.setDrawRange(0, 0);
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      map: plamka, size: rozmiar, vertexColors: true, color: kolor, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    pts.frustumCulled = false;
    scena.add(pts);
    return pts;
  }
  const iskryPts = czasteczki(MAX_ISKIER, 0xffe08a, 0.22);
  const swietlikiPts = czasteczki(MAX_SWIETLIKOW, 0xd8ff7a, 0.28);

  // --- Obiekty zależne od labiryntu (przebudowa po zmianie stan.labirynt) ---
  let plansza = null; // { labirynt, zywoplot, mgla, cienie, pnie, korony, pola, kZywoplotu, kolorBazowy, mglaPop, cienPop }
  const pomoc = new THREE.Object3D();
  const kolor = new THREE.Color();
  let dekoracja = null; // labirynt ekranu startowego

  function usunPlansze() {
    if (!plansza) return;
    for (const m of [plansza.zywoplot, plansza.mgla, plansza.cienie, plansza.pnie, plansza.korony]) {
      scena.remove(m);
      m.geometry.dispose();
      m.dispose();
    }
    plansza = null;
  }

  function zbudujPlansze(labirynt) {
    usunPlansze();
    const rng = ziarno(labirynt.szerokosc * 7919 + labirynt.wysokosc * 104729 + 17);
    const { szer, gleb } = rozmiarPlanszy3d(labirynt);
    polana.scale.set(szer + 1.6, 1, gleb + 1.6);
    if (matPolany.map) matPolany.map.repeat.set((szer + 1.6) / 2.5, (gleb + 1.6) / 2.5);

    // Żywopłot
    const bloki = blokiZywoplotu(labirynt);
    const zywoplot = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), matZywoplotu, bloki.length);
    const kolorBazowy = new Float32Array(bloki.length);
    const kZywoplotu = new Map();
    bloki.forEach((b, i) => {
      const h = WYSOKOSC_ZYWOPLOTU * (1 + (rng() * 2 - 1) * 0.08);
      pomoc.position.set(b.x, 0, b.z);
      pomoc.rotation.set(0, 0, 0);
      pomoc.scale.set(b.sx, h, b.sz);
      pomoc.updateMatrix();
      zywoplot.setMatrixAt(i, pomoc.matrix);
      kolorBazowy[i] = 0.82 + rng() * 0.22;
      zywoplot.setColorAt(i, kolor.setRGB(kolorBazowy[i], kolorBazowy[i], kolorBazowy[i]));
      kZywoplotu.set(b.k, i);
    });
    zywoplot.castShadow = zywoplot.receiveShadow = true;

    // Mgła wojny (bryły) i przyciemnienie (płaskie kwadraty na ścieżkach; żywopłot ciemnieje kolorem instancji)
    const pola = polaSiatki3d(labirynt);
    const mgla = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), matMgly, pola.length);
    mgla.castShadow = true;
    const cienie = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), matCienia, pola.length);
    cienie.renderOrder = 1;
    pomoc.scale.set(0, 0, 0);
    pomoc.updateMatrix();
    for (let k = 0; k < pola.length; k++) {
      mgla.setMatrixAt(k, pomoc.matrix);
      cienie.setMatrixAt(k, pomoc.matrix);
    }

    // Las: pnie i korony (dwa stożki); kolor koron z odcienia
    const drzewa = drzewaLasu(labirynt, rng);
    const geoPnia = new THREE.CylinderGeometry(0.7, 1, 1, 7).translate(0, 0.5, 0);
    const geoKorony = zlacz([
      new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0),
      new THREE.ConeGeometry(0.72, 0.8, 7).translate(0, 0.95, 0),
    ]);
    const pnie = new THREE.InstancedMesh(geoPnia, matPnia, drzewa.length);
    const korony = new THREE.InstancedMesh(geoKorony, matKorony, drzewa.length);
    korony.customDepthMaterial = glebiaKorony;
    drzewa.forEach((d, i) => {
      pomoc.rotation.set(0, d.obrot, 0);
      pomoc.position.set(d.x, 0, d.z);
      pomoc.scale.set(d.promien * 0.18, d.wysokosc * 0.3, d.promien * 0.18);
      pomoc.updateMatrix();
      pnie.setMatrixAt(i, pomoc.matrix);
      pomoc.position.set(d.x, d.wysokosc * 0.16, d.z);
      pomoc.scale.set(d.promien * 1.05, (d.wysokosc * 0.62) / 1.35, d.promien * 1.05);
      pomoc.updateMatrix();
      korony.setMatrixAt(i, pomoc.matrix);
      korony.setColorAt(i, kolor.setHSL(0.26 + d.odcien * 0.09, 0.42 + d.odcien * 0.15, 0.14 + d.odcien * 0.1));
    });
    for (const m of [pnie, korony]) m.castShadow = m.receiveShadow = true;

    scena.add(zywoplot, mgla, cienie, pnie, korony);
    plansza = {
      labirynt, zywoplot, mgla, cienie, pnie, korony, pola, kZywoplotu, kolorBazowy,
      mglaPop: new Float32Array(pola.length), cienPop: new Float32Array(pola.length),
    };
  }

  /** Mgła i przyciemnienie pól — macierze i kolory instancji zmieniane tylko przy zmianie krycia. */
  function aktualizujMgleWojny(stan, anim, czas) {
    const przejscia = anim?.mgla ?? aktualizujMgle(null, stanyPol(stan), czas);
    const { pola, mgla, cienie, zywoplot, kZywoplotu, kolorBazowy, mglaPop, cienPop } = plansza;
    let zmianaMgly = false;
    let zmianaCienia = false;
    let zmianaKoloru = false;
    for (let k = 0; k < pola.length; k++) {
      const p = przejscia[k];
      if (!p) continue;
      const { mgla: m, cien: c } = kryciePola(p, czas);
      const pole = pola[k];
      if (Math.abs(m - mglaPop[k]) > 1e-3 || (m !== mglaPop[k] && (m === 0 || m === 1))) {
        mglaPop[k] = m;
        pomoc.rotation.set(0, 0, 0);
        pomoc.position.set(pole.x, 0, pole.z);
        pomoc.scale.set(m > 0 ? pole.sx * 1.002 : 0, WYSOKOSC_MGLY * m, m > 0 ? pole.sz * 1.002 : 0);
        pomoc.updateMatrix();
        mgla.setMatrixAt(k, pomoc.matrix);
        zmianaMgly = true;
      }
      if (Math.abs(c - cienPop[k]) > 1e-3 || (c !== cienPop[k] && (c === 0 || c === 1))) {
        cienPop[k] = c;
        const i = kZywoplotu.get(k);
        if (i != null) {
          const b = kolorBazowy[i] * (1 - 0.5 * c);
          zywoplot.setColorAt(i, kolor.setRGB(b, b, b));
          zmianaKoloru = true;
        } else {
          pomoc.rotation.set(0, 0, 0);
          pomoc.position.set(pole.x, 0.02, pole.z);
          pomoc.scale.set(pole.sx * c, 1, pole.sz * c);
          pomoc.updateMatrix();
          cienie.setMatrixAt(k, pomoc.matrix);
          zmianaCienia = true;
        }
      }
    }
    if (zmianaMgly) mgla.instanceMatrix.needsUpdate = true;
    if (zmianaCienia) cienie.instanceMatrix.needsUpdate = true;
    if (zmianaKoloru) zywoplot.instanceColor.needsUpdate = true;
  }

  // --- Kamera: płynny dojazd, najazd na początku poziomu, przelot nad lasem na ekranie startowym ---
  const kamPoz = new THREE.Vector3(0, 30, 30);
  const kamCel = new THREE.Vector3();
  const celPoz = new THREE.Vector3();
  const celCel = new THREE.Vector3();
  let aspekt = 1;
  let ostatniCzas = null;
  let skok = true; // następna klatka ustawia kamerę bez dojazdu

  /** Ujęcie całej planszy pod tym samym kątem co kamera gracza. */
  function ujecieCalosci(labirynt) {
    const { szer, gleb } = rozmiarPlanszy3d(labirynt);
    const k = kamera3d({ x: 0, z: 0 }, aspekt);
    const kierunek = new THREE.Vector3(k.pozycja.x - k.cel.x, k.pozycja.y - k.cel.y, k.pozycja.z - k.cel.z).normalize();
    const tg = Math.tan(THREE.MathUtils.degToRad(kamera.fov / 2));
    const odl = Math.max(gleb / 2 / tg, szer / 2 / (tg * aspekt)) * 1.3;
    return { pozycja: kierunek.multiplyScalar(odl), cel: new THREE.Vector3(0, 0, 0) };
  }

  function ustawKamere(dt) {
    if (skok) {
      kamPoz.copy(celPoz);
      kamCel.copy(celCel);
      skok = false;
    } else {
      const a = 1 - (1 - 0.12) ** (dt / 16.667);
      kamPoz.lerp(celPoz, a);
      kamCel.lerp(celCel, a);
    }
    kamera.position.copy(kamPoz);
    kamera.lookAt(kamCel);
  }

  // --- Stan elementów animowanych ---
  let otwarcie = null; // chwila otwarcia drzwi (−Infinity — otwarte od początku)
  let mglaGesta = false;

  function ustawDrzwi(labirynt, wyjscie) {
    const s = srodekKomorki3d(labirynt, wyjscie.x, wyjscie.y);
    drzwi.position.set(s.x, 0, s.z);
    const bity = labirynt.przejscia[indeks(labirynt, wyjscie.x, wyjscie.y)];
    drzwi.rotation.y = bity & (N | S) ? 0 : Math.PI / 2;
  }

  function klatkaGry(stan, anim, czas, dt) {
    const { labirynt } = stan;
    if (!plansza || plansza.labirynt !== labirynt) {
      zbudujPlansze(labirynt);
      ustawDrzwi(labirynt, stan.wyjscie);
      otwarcie = stan.maKlucz ? -Infinity : null;
      skok = true;
    }
    if (stan.maKlucz && otwarcie == null) otwarcie = czas;
    if (!stan.maKlucz) otwarcie = null;
    if (mglaGesta !== Boolean(stan.mgla)) {
      mglaGesta = Boolean(stan.mgla);
      scena.fog.density = mglaGesta ? GESTOSC_MGLY.gesta : GESTOSC_MGLY.zwykla;
    }
    aktualizujMgleWojny(stan, anim, czas);

    // Gracz: płynna pozycja i lekkie podskoki w ruchu
    const ruch = anim?.ruch;
    const poz = ruch ? pozycjaGracza(ruch, czas) : stan.gracz;
    const swiat = srodekKomorki3d(labirynt, poz.x, poz.y);
    const p = ruch ? postep(ruch.start, czas, ruch.trwanie) : 1;
    const podskok = ruch && !ruch.odbicie && p < 1 ? Math.sin(Math.PI * p) * 0.14 : 0;
    // ognik unosi się nad ścieżką — przy kącie kamery 55° nie chowa się za żywopłotem
    gracz.position.set(swiat.x, WYSOKOSC_LOTU + 0.04 * Math.sin(czas / 420) + podskok, swiat.z);
    kula.material.emissiveIntensity = 0.6 + 0.08 * Math.sin(czas / 300);
    gracz.visible = true;
    swiatloGracza.intensity = 6;

    // Klucz: tylko na odkrytym polu, dopóki nie podniesiony
    const odkryte = (q) => stan.odkryte.has(indeks(labirynt, q.x, q.y));
    const kluczWidoczny = !stan.maKlucz && odkryte(stan.klucz);
    klucz.visible = kluczWidoczny;
    if (kluczWidoczny) {
      const s = srodekKomorki3d(labirynt, stan.klucz.x, stan.klucz.y);
      const y = 0.62 + unoszenieKlucza(czas) * 2;
      klucz.position.set(s.x, y, s.z);
      klucz.rotation.set(0.25, czas * 0.0016, 0);
      swiatloKlucza.position.set(s.x, y + 0.3, s.z);
    }
    swiatloKlucza.intensity = kluczWidoczny ? 2.2 + 0.6 * Math.sin(czas / 250) : 0;

    // Drzwi: zamknięte czerwone, otwierane obrotem skrzydła i zmianą koloru na zielony z pulsującą poświatą
    const drzwiWidoczne = odkryte(stan.wyjscie);
    drzwi.visible = drzwiWidoczne;
    const t = otwarcie == null ? 0 : easeOutCubic(postep(otwarcie, czas, CZAS_OTWARCIA));
    drzwi.userData.zawias.rotation.y = -KAT_OTWARCIA * t;
    matSkrzydla.color.copy(KOLORY.zamkniete).lerp(KOLORY.otwarte, t);
    matSkrzydla.emissive.copy(matSkrzydla.color);
    const puls = otwarcie == null ? 0 : pulsDrzwi(czas);
    matSkrzydla.emissiveIntensity = 0.3 + 0.35 * puls * t;
    swiatloDrzwi.color.copy(matSkrzydla.color);
    swiatloDrzwi.position.set(drzwi.position.x, 1.1, drzwi.position.z);
    swiatloDrzwi.intensity = drzwiWidoczne ? (otwarcie == null ? 1.2 : 2 + 3 * puls * t) : 0;

    // Rozbłysk ukończenia
    const b = anim?.rozblysk != null ? rozblysk(anim.rozblysk, czas) : null;
    swiatloRozblysku.position.set(drzwi.position.x, 1.3, drzwi.position.z);
    swiatloRozblysku.intensity = b ? 60 * b.alfa : 0;
    pierscien.visible = Boolean(b);
    if (b) {
      pierscien.position.set(drzwi.position.x, 0.06, drzwi.position.z);
      pierscien.scale.setScalar(0.5 + 3 * b.promien);
      pierscien.material.opacity = b.alfa;
    }

    // Iskry klucza
    const s = srodekKomorki3d(labirynt, 0, 0);
    const krok = srodekKomorki3d(labirynt, 1, 1);
    const kx = krok.x - s.x;
    const kz = krok.z - s.z;
    const pozIskier = iskryPts.geometry.getAttribute('position');
    const kolIskier = iskryPts.geometry.getAttribute('color');
    let n = 0;
    for (const iskra of anim?.iskry ?? []) {
      if (n >= MAX_ISKIER) break;
      const st = stanIskry(iskra, czas);
      if (!st) continue;
      const sp = 1 - st.alfa;
      pozIskier.setXYZ(n, s.x + st.x * kx, 0.6 + sp * 0.9 - sp * sp * 0.6, s.z + st.y * kz);
      kolIskier.setXYZ(n, st.alfa, st.alfa * 0.85, st.alfa * 0.4);
      n++;
    }
    iskryPts.geometry.setDrawRange(0, n);
    pozIskier.needsUpdate = kolIskier.needsUpdate = n > 0;

    // Świetliki nad żywopłotem
    const pozSw = swietlikiPts.geometry.getAttribute('position');
    const kolSw = swietlikiPts.geometry.getAttribute('color');
    n = 0;
    for (const sw of anim?.swietliki ?? []) {
      if (n >= MAX_SWIETLIKOW) break;
      const pole = plansza.pola[sw.k];
      if (!pole || plansza.mglaPop[sw.k] > 0.5) continue;
      const st = stanSwietlika(sw, czas);
      pozSw.setXYZ(n, pole.x + st.dx, 1.55 + 0.25 * Math.sin(czas / 900 + sw.faza), pole.z + st.dy);
      kolSw.setXYZ(n, st.alfa, st.alfa, st.alfa);
      n++;
    }
    swietlikiPts.geometry.setDrawRange(0, n);
    pozSw.needsUpdate = kolSw.needsUpdate = n > 0;

    // Kamera: najazd z ujęcia całej planszy, potem śledzenie gracza
    const kg = kamera3d(swiat, aspekt);
    celPoz.set(kg.pozycja.x, kg.pozycja.y, kg.pozycja.z);
    celCel.set(kg.cel.x, kg.cel.y, kg.cel.z);
    const w = anim?.wejscie != null ? postep(anim.wejscie, czas, CZAS_NAJAZDU) : 1;
    if (w < 1) {
      const u = ujecieCalosci(labirynt);
      const e = easeInOutCubic(w);
      celPoz.lerpVectors(u.pozycja, celPoz, e);
      celCel.lerpVectors(u.cel, celCel, e);
      skok = true;
    }
    ustawKamere(dt);
    sledzCien(swiat.x, swiat.z);
  }

  function klatkaStartowa(czas, dt) {
    dekoracja ??= generujLabirynt(10, 10, ziarno(2024));
    if (!plansza || plansza.labirynt !== dekoracja) {
      zbudujPlansze(dekoracja);
      skok = true;
    }
    if (mglaGesta) {
      mglaGesta = false;
      scena.fog.density = GESTOSC_MGLY.zwykla;
    }
    gracz.visible = klucz.visible = drzwi.visible = pierscien.visible = false;
    swiatloGracza.intensity = swiatloKlucza.intensity = swiatloDrzwi.intensity = swiatloRozblysku.intensity = 0;
    iskryPts.geometry.setDrawRange(0, 0);
    swietlikiPts.geometry.setDrawRange(0, 0);
    const kat = czas * 0.00004;
    celPoz.set(Math.sin(kat) * 24, 15, Math.cos(kat) * 24);
    celCel.set(0, 0, 0);
    skok = true;
    ustawKamere(dt);
    sledzCien(0, 0);
  }

  function sledzCien(x, z) {
    slonce.target.position.set(x, 0, z);
    slonce.position.set(x + PRZESUNIECIE_SLONCA.x, PRZESUNIECIE_SLONCA.y, z + PRZESUNIECIE_SLONCA.z);
    slonce.target.updateMatrixWorld();
  }

  function ustawTekstury(t) {
    const nowe = {
      las: teksturaZObrazu(t?.las, anizotropia),
      zwir: teksturaZObrazu(t?.zwir, anizotropia),
      zywoplot: teksturaZObrazu(t?.zywoplot, anizotropia),
    };
    for (const [mat, tex, kolorBez, kolorZ] of [
      [matZiemi, nowe.las, [0.03, 0.045, 0.03], [1.1, 1.2, 1.05]],
      [matPolany, nowe.zwir, [0.25, 0.22, 0.18], [0.66, 0.7, 0.68]],
      // tekstura żywopłotu jest bardzo ciemna — rozjaśniona mnożnikiem koloru (> 1 w przestrzeni liniowej)
      [matZywoplotu, nowe.zywoplot, [0.08, 0.2, 0.06], [2.3, 2.1, 1.7]],
    ]) {
      mat.map?.dispose();
      mat.map = tex;
      mat.color.setRGB(...(tex ? kolorZ : kolorBez), THREE.LinearSRGBColorSpace);
      mat.needsUpdate = true;
    }
    nowe.las?.repeat.set(400 / 7, 400 / 7);
    if (nowe.zywoplot) nowe.zywoplot.repeat.set(1, 1);
    if (plansza && nowe.zwir) {
      nowe.zwir.repeat.set(polana.scale.x / 2.5, polana.scale.z / 2.5);
    }
  }

  ustawTekstury(tekstury);

  return {
    ustawRozmiar(w, h, dpr) {
      renderer.setPixelRatio(Math.min(2, dpr || 1));
      renderer.setSize(w, h, false);
      aspekt = w / Math.max(1, h);
      kamera.aspect = aspekt;
      kamera.updateProjectionMatrix();
    },
    ustawTekstury,
    klatka(stan, anim, czas, ekran) {
      const dt = ostatniCzas == null ? 16.667 : Math.min(100, Math.max(0, czas - ostatniCzas));
      ostatniCzas = czas;
      czasUniform.value = czas / 1000;
      if (stan && ekran !== 'start') klatkaGry(stan, anim, czas, dt);
      else klatkaStartowa(czas, dt);
      renderer.render(scena, kamera);
    },
    zniszcz() {
      usunPlansze();
      scena.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose(); m.dispose(); });
      });
      scena.environment?.dispose();
      plamka.dispose();
      renderer.dispose();
    },
  };
}
