// The 3D world: codebase city, sky clock, context tank, clone, portal, rewind, sunrise.
import * as THREE from '../vendor/three/build/three.module.min.js';
import { EffectComposer } from '../vendor/three/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/three/jsm/postprocessing/OutputPass.js';
import { tween, tickTweens, ease, wait } from './fx.js?v=20261127160429';

const NIGHT_BG = new THREE.Color('#070a1f');
const NIGHT_FOG = new THREE.Color('#0d1236');
const DAWN_BG = new THREE.Color('#ff9a6b');
const DAWN_FOG = new THREE.Color('#ffb98a');
const TOKEN_CALM = new THREE.Color('#7fe3ff');
const TOKEN_WARM = new THREE.Color('#ffb547');
const TOKEN_HOT = new THREE.Color('#ff4d6d');
const EDGE = new THREE.Color('#3b4fb8');
const AMBER = new THREE.Color('#ffb547');

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  if (!renderer.getContext()) throw new Error('no webgl');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = NIGHT_BG.clone();
  scene.fog = new THREE.FogExp2(NIGHT_FOG.clone(), 0.022);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
  const camHome = new THREE.Vector3(0, 7, 24);
  const lookAt = new THREE.Vector3(0, 6, -6);
  camera.position.copy(camHome);

  scene.add(new THREE.AmbientLight('#6070ff', 0.6));
  const sunLight = new THREE.DirectionalLight('#ffd2a1', 0);
  sunLight.position.set(0, 10, -40);
  scene.add(sunLight);

  // ---------- stars ----------
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  for (let i = 0; i < 900; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.45;
    const r = 160;
    sp.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.8 + 10, -Math.abs(r * Math.sin(ph) * Math.sin(th)) - 20);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ color: '#c9d4ff', size: 0.7, transparent: true, opacity: 0.8, fog: false });
  scene.add(new THREE.Points(starGeo, starMat));

  // ---------- ground ----------
  const grid = new THREE.GridHelper(200, 100, '#2a3a9a', '#141c55');
  grid.position.y = 0;
  scene.add(grid);

  // ---------- city of file towers ----------
  const city = new THREE.Group();
  scene.add(city);
  const towers = [];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const edgeGeo = new THREE.EdgesGeometry(boxGeo);
  const named = { 'ci.log': [-6, -8], 'tests/conftest.py': [5, -12], 'checkout.py': [0, -18] };
  const taken = new Set(Object.values(named).map(p => p.join(',')));
  const spots = [];
  for (let x = -22; x <= 22; x += 3.2) for (let z = -40; z <= -4; z += 3.4) spots.push([Math.round(x * 10) / 10, z]);
  const addTower = (x, z, h, name) => {
    const mat = new THREE.MeshStandardMaterial({ color: '#0c1030', emissive: '#0a0f35', roughness: 0.8 });
    const mesh = new THREE.Mesh(boxGeo, mat);
    const w = name ? 2.2 : 1.2 + Math.random() * 1.2;
    mesh.scale.set(w, h, w);
    mesh.position.set(x, 0, z);
    const lineMat = new THREE.LineBasicMaterial({ color: name ? AMBER.clone() : EDGE.clone(), transparent: true, opacity: name ? 0.9 : 0.55 });
    const lines = new THREE.LineSegments(edgeGeo, lineMat);
    mesh.add(lines);
    city.add(mesh);
    towers.push({ mesh, lineMat, h, name, base: lineMat.color.clone() });
  };
  for (const [x, z] of spots) {
    if (Math.abs(x) < 3 && z > -10) continue; // keep an avenue open toward the clock
    if (Math.random() < 0.28) continue;
    if (taken.has(`${x},${z}`)) continue;
    const dist = Math.abs(x) / 22;
    addTower(x + (Math.random() - 0.5), z, 2 + Math.random() * 7 + dist * 6, null);
  }
  for (const [name, [x, z]] of Object.entries(named)) addTower(x, z, 9, name);
  const towerByName = n => towers.find(t => t.name === n);

  // ---------- sky clock ----------
  const clock = new THREE.Group();
  clock.position.set(0, 21, -48);
  scene.add(clock);
  const ringMat = new THREE.MeshBasicMaterial({ color: AMBER.clone(), transparent: true, opacity: 0.6, fog: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(12, 0.18, 12, 128), ringMat);
  clock.add(ring);
  const faceMat = new THREE.MeshBasicMaterial({ color: '#141a4a', transparent: true, opacity: 0.55, fog: false });
  clock.add(new THREE.Mesh(new THREE.CircleGeometry(11.8, 96), faceMat));
  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const big = i % 5 === 0;
    const t = new THREE.Mesh(new THREE.BoxGeometry(big ? 0.35 : 0.12, big ? 1.6 : 0.6, 0.1),
      new THREE.MeshBasicMaterial({ color: big ? AMBER.clone() : new THREE.Color('#8a7bd8'), fog: false, transparent: true }));
    const a = (i / 60) * Math.PI * 2;
    const r = big ? 10.6 : 11;
    t.position.set(Math.sin(a) * r, Math.cos(a) * r, 0.05);
    t.rotation.z = -a;
    clock.add(t);
    ticks.push(t);
  }
  const handMat = new THREE.MeshBasicMaterial({ color: '#fff1d6', fog: false });
  const minuteHand = new THREE.Group();
  const mh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 10, 0.1), handMat);
  mh.position.y = 4.4; minuteHand.add(mh); minuteHand.position.z = 0.2;
  const hourHand = new THREE.Group();
  const hh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.2, 0.1), handMat);
  hh.position.y = 2.6; hourHand.add(hh); hourHand.position.z = 0.15;
  clock.add(minuteHand, hourHand);
  const hub = new THREE.Mesh(new THREE.CircleGeometry(0.7, 32), new THREE.MeshBasicMaterial({ color: AMBER.clone(), fog: false }));
  hub.position.z = 0.3; clock.add(hub);
  let clockMinute = 48;
  const setHands = m => {
    minuteHand.rotation.z = -(m / 60) * Math.PI * 2;
    hourHand.rotation.z = -((4 + m / 60) / 12) * Math.PI * 2;
  };
  setHands(clockMinute);

  // ---------- context tank ----------
  const tank = new THREE.Group();
  tank.visible = false;   // the context jar is now drawn in the page (.ctxp), crisp and always visible
  scene.add(tank);
  const TANK_H = 7, TANK_R = 1.7, N = 1800;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(TANK_R, TANK_R, TANK_H, 40, 1, true),
    new THREE.MeshBasicMaterial({ color: '#9fb4ff', transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.y = TANK_H / 2;
  tank.add(glass);
  const rimMat = new THREE.MeshBasicMaterial({ color: '#b9c8ff', transparent: true, opacity: 0.8 });
  for (const y of [0, TANK_H]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(TANK_R, 0.06, 8, 64), rimMat);
    rim.rotation.x = Math.PI / 2; rim.position.y = y; tank.add(rim);
  }
  // capacity line at the rot threshold
  const rotLine = new THREE.Mesh(new THREE.TorusGeometry(TANK_R + 0.02, 0.03, 6, 64),
    new THREE.MeshBasicMaterial({ color: TOKEN_HOT.clone(), transparent: true, opacity: 0.5 }));
  rotLine.rotation.x = Math.PI / 2; rotLine.position.y = TANK_H * 0.7; tank.add(rotLine);

  const pPos = new Float32Array(N * 3);
  const pData = [];
  for (let i = 0; i < N; i++) {
    pData.push({ a: Math.random() * Math.PI * 2, r: Math.sqrt(Math.random()) * (TANK_R - 0.15), h: (i / N) * TANK_H * 0.98 + Math.random() * 0.1, s: 0.2 + Math.random() * 0.6 });
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color: TOKEN_CALM.clone(), size: 0.13, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const particles = new THREE.Points(pGeo, pMat);
  tank.add(particles);
  let level = 0;          // 0..1 shown fill
  let vortex = 0;         // 0..1 blackout swirl
  pGeo.setDrawRange(0, 0);

  // pouring stream
  const SN = 260;
  const sPos = new Float32Array(SN * 3);
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const sMat = new THREE.PointsMaterial({ color: TOKEN_WARM.clone(), size: 0.16, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const stream = new THREE.Points(sGeo, sMat);
  tank.add(stream);
  let pouring = 0;

  const tankColor = lv => {
    const c = new THREE.Color();
    if (lv < 0.5) c.lerpColors(TOKEN_CALM, TOKEN_WARM, lv / 0.5);
    else c.lerpColors(TOKEN_WARM, TOKEN_HOT, Math.min(1, (lv - 0.5) / 0.4));
    return c;
  };

  // ---------- clone ----------
  const cloneMat = new THREE.MeshStandardMaterial({ color: '#bfe9ff', emissive: '#6fd0ff', emissiveIntensity: 2, transparent: true, opacity: 0.85 });
  const cloneMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), cloneMat);
  cloneMesh.visible = false;
  scene.add(cloneMesh);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), new THREE.MeshBasicMaterial({ color: '#ffe3a1' }));
  orb.visible = false;
  cloneMesh.add(orb); orb.position.y = -0.9;

  // ---------- portal ----------
  const portal = new THREE.Group();
  portal.position.set(11, 13, -14);
  portal.scale.setScalar(0.001);
  portal.visible = false;
  scene.add(portal);
  const portalRing = new THREE.Mesh(new THREE.TorusGeometry(3, 0.22, 16, 96), new THREE.MeshBasicMaterial({ color: '#c77dff' }));
  portal.add(portalRing);
  const portalDisc = new THREE.Mesh(new THREE.CircleGeometry(2.8, 64), new THREE.MeshBasicMaterial({ color: '#3a0f6b', transparent: true, opacity: 0.85 }));
  portal.add(portalDisc);
  const ticket = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.3), new THREE.MeshBasicMaterial({ color: '#f4efff', transparent: true, opacity: 0, side: THREE.DoubleSide }));
  scene.add(ticket);
  ticket.visible = false;

  // ---------- sun ----------
  const sun = new THREE.Mesh(new THREE.SphereGeometry(9, 48, 48), new THREE.MeshBasicMaterial({ color: '#ffd27a', fog: false }));
  sun.position.set(0, -14, -90); sun.visible = false;
  scene.add(sun);

  // ---------- post ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.4, 0.3);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- layout ----------
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.8 ? 72 : 55;
    camera.updateProjectionMatrix();
    // place the tank in the left foreground, inside the view at any aspect
    const depth = 12;
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * depth;
    const halfW = halfH * camera.aspect;
    const narrow = camera.aspect < 0.8;
    tank.position.set(-halfW * (narrow ? 0.62 : 0.7), camHome.y - halfH * (narrow ? 0.05 : 0.3), camHome.z - depth);
    tank.scale.setScalar(narrow ? 0.55 : 0.85);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- frame loop ----------
  let shake = 0;
  const clockLook = new THREE.Vector3();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    tickTweens(now);
    const t = now / 1000;

    // camera drift + shake
    const drift = reduced ? 0 : 1;
    camera.position.set(camHome.x + Math.sin(t * 0.15) * 1.2 * drift, camHome.y + Math.sin(t * 0.21) * 0.4 * drift, camHome.z);
    if (shake > 0 && !reduced) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      shake *= 0.9; if (shake < 0.01) shake = 0;
    }
    clockLook.copy(lookAt);
    camera.lookAt(clockLook);

    // tank particles
    const count = Math.floor(level * N);
    pGeo.setDrawRange(0, count);
    for (let i = 0; i < count; i++) {
      const p = pData[i];
      p.a += dt * (p.s + vortex * 9);
      const r = p.r * (1 - vortex * 0.85);
      const h = p.h * (1 - vortex * 0.6) + Math.sin(t * 2 + i) * 0.03;
      pPos[i * 3] = Math.cos(p.a) * r;
      pPos[i * 3 + 1] = h;
      pPos[i * 3 + 2] = Math.sin(p.a) * r;
    }
    pGeo.attributes.position.needsUpdate = true;
    pMat.color.copy(tankColor(level));
    rimMat.color.copy(level > 0.85 ? TOKEN_HOT : new THREE.Color('#b9c8ff'));

    // stream
    if (pouring > 0) {
      for (let i = 0; i < SN; i++) {
        const k = ((t * 1.6 + i / SN) % 1);
        sPos[i * 3] = (Math.random() - 0.5) * 0.25;
        sPos[i * 3 + 1] = TANK_H + 5 - k * (5 + TANK_H * (1 - level));
        sPos[i * 3 + 2] = (Math.random() - 0.5) * 0.25;
      }
      sGeo.attributes.position.needsUpdate = true;
    }
    sMat.opacity = pouring;

    // portal spin
    if (portal.visible) { portalRing.rotation.z += dt * 1.5; portalDisc.material.opacity = 0.6 + Math.sin(t * 6) * 0.2; }
    cloneMesh.rotation.y += dt * 3;
    clock.rotation.z = Math.sin(t * 0.3) * 0.01;

    composer.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- API ----------
  const api = {
    setClock(m, animate = true) {
      const from = clockMinute; clockMinute = m;
      if (!animate) { setHands(m); return Promise.resolve(); }
      return tween({ dur: 700, easing: ease.inOutCubic, update: e => setHands(from + (m - from) * e) });
    },
    setUrgent(u) {
      ringMat.color.copy(u ? TOKEN_HOT : AMBER);
    },
    setLevel(target, { pour = false } = {}) {
      const from = level;
      target = Math.max(0, Math.min(1, target));
      if (pour) pouring = 1;
      return tween({ dur: pour ? 1400 : 700, easing: ease.inOutCubic, update: e => { level = from + (target - from) * e; } })
        .then(() => tween({ dur: 400, update: e => { pouring = 1 - e; } }));
    },
    shake(a = 0.6) { shake = a; },
    async blackout(toLevel) {
      await tween({ dur: 900, easing: ease.inCubic, update: e => { vortex = e; } });
      towers.forEach(tw => (tw.lineMat.opacity = 0.1));
      level = toLevel;
      await tween({ dur: 900, update: e => { vortex = 1 - e; towers.forEach(tw => (tw.lineMat.opacity = 0.1 + e * (tw.name ? 0.8 : 0.45))); } });
    },
    pulseTower(name) {
      const tw = towerByName(name); if (!tw) return;
      const white = new THREE.Color('#ffffff');
      tween({ dur: 1200, update: e => { tw.lineMat.color.lerpColors(white, tw.base, e); tw.mesh.material.emissive.setRGB(0.3 * (1 - e), 0.25 * (1 - e), 0.1 * (1 - e)); } });
    },
    async sendClone(towerName) {
      sfxHook && sfxHook('clone');
      const tw = towerByName(towerName) || towers[0];
      const start = new THREE.Vector3(tank.position.x + 2.5, tank.position.y + 4, tank.position.z);
      const end = tw.mesh.position.clone().add(new THREE.Vector3(0, tw.h + 1.5, 0));
      const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 8, 0));
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      cloneMesh.visible = true; orb.visible = false;
      await tween({ dur: 1500, easing: ease.inOutCubic, update: e => cloneMesh.position.copy(curve.getPoint(e)) });
      // search the tower
      for (let i = 0; i < 3; i++) { api.pulseTower(towerName); await wait(220); }
      orb.visible = true;
      await tween({ dur: 1300, easing: ease.inOutCubic, update: e => cloneMesh.position.copy(curve.getPoint(1 - e)) });
      await tween({ dur: 350, update: e => cloneMesh.scale.setScalar(1 - e) });
      cloneMesh.visible = false; cloneMesh.scale.setScalar(1);
    },
    async openPortal() {
      portal.visible = true;
      await tween({ dur: 900, easing: ease.outBack, update: e => portal.scale.setScalar(Math.max(0.001, e)) });
      ticket.visible = true;
      ticket.position.copy(portal.position);
      const target = new THREE.Vector3(3, 9, 6);
      await tween({ dur: 1400, easing: ease.inOutCubic, update: e => {
        ticket.position.lerpVectors(portal.position, target, e);
        ticket.rotation.y = e * Math.PI * 2;
        ticket.material.opacity = Math.min(1, e * 2);
      } });
      await wait(400);
      await tween({ dur: 600, update: e => { ticket.material.opacity = 1 - e; portal.scale.setScalar(Math.max(0.001, 1 - e)); } });
      ticket.visible = false; portal.visible = false;
    },
    async rewind() {
      const from = clockMinute;
      await Promise.all([
        tween({ dur: 2200, easing: ease.inOutCubic, update: e => setHands(from - e * (from - 48 + 120)) }),
        tween({ dur: 2200, easing: ease.inOutCubic, update: e => {
          const k = Math.sin(e * Math.PI);
          towers.forEach((tw, i) => { tw.mesh.scale.y = tw.h * (1 - k * 0.85 * ((i % 5) / 5 + 0.4)); });
          vortex = k * 0.6;
        } }),
      ]);
      clockMinute = 48; setHands(48);
      towers.forEach(tw => (tw.mesh.scale.y = tw.h));
      vortex = 0;
      level = 0;
    },
    async sunrise() {
      const bg0 = scene.background.clone(), fog0 = scene.fog.color.clone(); sun.visible = true;
      await api.setClock(61);
      await Promise.all([
        tween({ dur: 3500, easing: ease.inOutCubic, update: e => {
          scene.background.lerpColors(bg0, DAWN_BG, e);
          scene.fog.color.lerpColors(fog0, DAWN_FOG, e);
          scene.fog.density = 0.022 - e * 0.01;
          sun.position.y = -14 + e * 26;
          sunLight.intensity = e * 2;
          starMat.opacity = 0.8 * (1 - e);
          bloom.strength = 0.45 - e * 0.15;
        } }),
        tween({ dur: 2600, delay: 300, easing: ease.outCubic, update: e => {
          ticks.forEach((tk, i) => {
            const a = (i / 60) * Math.PI * 2;
            const r = (i % 5 === 0 ? 10.6 : 11) + e * (14 + (i % 7) * 3);
            tk.position.set(Math.sin(a) * r, Math.cos(a) * r, e * (i % 3) * 4);
            tk.rotation.x = e * (i % 4);
            tk.material.opacity = 1 - e;
          });
          ringMat.opacity = 0.6 * (1 - e);
          faceMat.opacity = 0.55 * (1 - e);
        } }),
      ]);
    },
    async falseDawn() {
      // The sky starts to warm as the clock reaches 5:00, then snaps back to night.
      const bg0 = scene.background.clone(), fog0 = scene.fog.color.clone();
      sun.visible = true;
      await api.setClock(60);
      await tween({ dur: 1800, easing: ease.inOutCubic, update: e => {
        scene.background.lerpColors(bg0, DAWN_BG, e * 0.45);
        scene.fog.color.lerpColors(fog0, DAWN_FOG, e * 0.45);
        sun.position.y = -14 + e * 10;
        sunLight.intensity = e * 0.8;
      } });
      shake = 1.4;
      const bg1 = scene.background.clone(), fog1 = scene.fog.color.clone();
      await tween({ dur: 500, easing: ease.inCubic, update: e => {
        scene.background.lerpColors(bg1, NIGHT_BG, e);
        scene.fog.color.lerpColors(fog1, NIGHT_FOG, e);
        sun.position.y = -4 - e * 10;
        sunLight.intensity = 0.8 * (1 - e);
      } });
      sun.visible = false;
    },
    setTheme(bg, fog, animate = true) {
      NIGHT_BG.set(bg); NIGHT_FOG.set(fog);
      if (sun.visible) return Promise.resolve();
      const b0 = scene.background.clone(), f0 = scene.fog.color.clone();
      if (!animate) { scene.background.copy(NIGHT_BG); scene.fog.color.copy(NIGHT_FOG); return Promise.resolve(); }
      return tween({ dur: 1600, easing: ease.inOutCubic, update: e => {
        scene.background.lerpColors(b0, NIGHT_BG, e);
        scene.fog.color.lerpColors(f0, NIGHT_FOG, e);
      } });
    },
    resetDay() {
      scene.background.copy(NIGHT_BG); scene.fog.color.copy(NIGHT_FOG); scene.fog.density = 0.022;
      sun.position.y = -14; sun.visible = false; sunLight.intensity = 0; starMat.opacity = 0.8; bloom.strength = 0.45;
      ticks.forEach((tk, i) => {
        const a = (i / 60) * Math.PI * 2, r = i % 5 === 0 ? 10.6 : 11;
        tk.position.set(Math.sin(a) * r, Math.cos(a) * r, 0.05); tk.rotation.set(0, 0, -a); tk.material.opacity = 1;
      });
      ringMat.opacity = 0.6; faceMat.opacity = 0.55; ringMat.color.copy(AMBER);
      clockMinute = 48; setHands(48); level = 0;
    },
    onSfx(fn) { sfxHook = fn; },
  };
  let sfxHook = null;
  return api;
}
