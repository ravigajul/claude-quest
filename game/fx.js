// Small tween engine + synthesized audio. No dependencies.

export const ease = {
  linear: t => t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  inCubic: t => t * t * t,
};

const tweens = new Set();

export function tween({ dur = 600, delay = 0, easing = ease.outCubic, update, done }) {
  return new Promise(resolve => {
    const t = { start: performance.now() + delay, dur, easing, update, done: () => { done && done(); resolve(); } };
    tweens.add(t);
  });
}

export function tickTweens(now) {
  for (const t of tweens) {
    if (now < t.start) continue;
    const p = Math.min(1, (now - t.start) / t.dur);
    t.update(t.easing(p), p);
    if (p >= 1) { tweens.delete(t); t.done(); }
  }
}

export const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------- audio ----------
// Sound design (v2.3): soft sine/triangle voices with smooth envelopes, filtered "air" instead of raw static,
// every pitch from one key (C major pentatonic) so overlapping sounds harmonise, a light reverb for space,
// and a limiter so nothing ever distorts. Feedback sounds (tick, typing) sit well below event sounds.
// Every voice is (ctx, destination, ...args), so tests and the sound board can render it offline.

const N = { C3: 130.81, G3: 196.0, C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0, C6: 1046.5, E6: 1318.5 };

export const LEVELS = { full: 0.9, soft: 0.45, off: 0 };
const LEVEL_KEY = 'cq-sound';
let level = (() => { try { const v = localStorage.getItem(LEVEL_KEY); return v in LEVELS ? v : 'full'; } catch (e) { return 'full'; } })();
let ctx = null, chain = null;

let noiseBuf = null;
function noiseBuffer(c) {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
  const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return (noiseBuf = b);
}
function impulse(c, seconds, decay) {
  const len = Math.floor(c.sampleRate * seconds), b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
  return b;
}

// dry bus -> (tone-down filter + small reverb) -> limiter -> volume -> speakers
export function buildChain(c, gain = LEVELS.full) {
  const bus = c.createGain();
  const dry = c.createGain();   // quick, repeated sounds skip the reverb so they never smear into each other
  const tame = c.createBiquadFilter(); tame.type = 'lowpass'; tame.frequency.value = 7500; tame.Q.value = 0.5;
  const verb = c.createConvolver(); verb.buffer = impulse(c, 1.4, 3);
  const wet = c.createGain(); wet.gain.value = 0.16;
  const limit = c.createDynamicsCompressor();
  limit.threshold.value = -14; limit.knee.value = 10; limit.ratio.value = 6; limit.attack.value = 0.003; limit.release.value = 0.2;
  const vol = c.createGain(); vol.gain.value = gain;
  bus.connect(tame); bus.connect(verb); verb.connect(wet); wet.connect(tame); dry.connect(tame);
  tame.connect(limit); limit.connect(vol); vol.connect(c.destination);
  return { bus, dry, vol };
}

// One note: smooth attack, exponential release, optional glide and overtones (for bell-like tones).
function note(c, out, freq, { dur = 0.3, type = 'sine', vol = 0.2, attack = 0.006, delay = 0, glide = 1, partials = [], detune = 0, lowpass = 0 } = {}) {
  const t0 = c.currentTime + delay, end = t0 + dur;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  let dest = out;
  if (lowpass) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass; f.connect(out); dest = f; }
  g.connect(dest);
  for (const [mult, pv] of [[1, 1], ...partials]) {
    const o = c.createOscillator(), pg = c.createGain();
    o.type = mult === 1 ? type : 'sine';
    o.detune.value = detune;
    o.frequency.setValueAtTime(freq * mult, t0);
    if (glide !== 1) o.frequency.exponentialRampToValueAtTime(freq * mult * glide, end);
    pg.gain.value = pv; o.connect(pg); pg.connect(g);
    o.start(t0); o.stop(end + 0.05);
  }
}
// Filtered noise ("air", "whoosh", "click"), never raw static.
function air(c, out, { dur = 0.3, vol = 0.08, filter = 'bandpass', freq = 1200, freqEnd = 0, q = 1, delay = 0, attack = 0.01 } = {}) {
  const t0 = c.currentTime + delay, end = t0 + dur;
  const s = c.createBufferSource(); s.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter(); f.type = filter; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t0);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, end);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, end);
  s.connect(f); f.connect(g); g.connect(out);
  s.start(t0, Math.random()); s.stop(end + 0.05);
}

export const DRY = new Set(['tick', 'type', 'card']);

// Hand-made (coded) voices. Recorded sounds replace some of them below, with these as the fallback.
export const CODED = {
  // feedback: short, soft, low in the mix (they repeat a lot)
  tick: (c, o, urgent) => { air(c, o, { dur: 0.035, vol: urgent ? 0.2 : 0.125, freq: urgent ? 2600 : 2000, q: 6, attack: 0.002 }); note(c, o, urgent ? N.E5 : N.C5, { dur: 0.05, vol: urgent ? 0.095 : 0.063 }); },
  type: (c, o) => air(c, o, { dur: 0.018, vol: 0.035, filter: 'lowpass', freq: 1500 + Math.random() * 400, attack: 0.001 }),
  card: (c, o) => { note(c, o, N.G4, { dur: 0.22, type: 'triangle', vol: 0.165, glide: 1.06, partials: [[2, 0.25]] }); air(c, o, { dur: 0.05, vol: 0.02, freq: 1800, q: 2, attack: 0.002 }); },
  // events: musical, a little longer, with space
  clue: (c, o) => { note(c, o, N.E5, { dur: 0.6, vol: 0.057, partials: [[2, 0.3], [3, 0.08]] }); note(c, o, N.A5, { dur: 0.8, vol: 0.05, delay: 0.09, partials: [[2, 0.25]] }); },
  // pouring: a flowing swish that settles, with little bubbles rising through it
  pour: (c, o) => {
    air(c, o, { dur: 0.7, vol: 0.07, freq: 1800, freqEnd: 700, q: 1.2, attack: 0.06 });
    [N.G4, N.C5, N.A4, N.D5, N.E5].forEach((f, i) => note(c, o, f, { dur: 0.07, vol: 0.05, delay: 0.08 + i * 0.1 + Math.random() * 0.03, glide: 1.5 }));
  },
  // a soft "nope": two falling notes with a gentle wobble, not a jolt
  glitch: (c, o) => { note(c, o, N.E4, { dur: 0.16, type: 'triangle', vol: 0.15, detune: 18, lowpass: 1800 }); note(c, o, N.C4, { dur: 0.32, type: 'triangle', vol: 0.15, delay: 0.13, detune: -18, lowpass: 1500 }); air(c, o, { dur: 0.12, vol: 0.025, filter: 'lowpass', freq: 700 }); },
  // a soft impact, then a power-down whose tone darkens as it falls
  blackout: (c, o) => { note(c, o, 82, { dur: 0.35, vol: 0.28, glide: 0.6, attack: 0.004 }); CODED.blackoutTail(c, o); },
  blackoutTail: (c, o) => {
    note(c, o, N.G4, { dur: 1.2, type: 'triangle', vol: 0.1, glide: 0.25, lowpass: 1400, delay: 0.03 });
    note(c, o, N.C4, { dur: 1.2, type: 'triangle', vol: 0.08, glide: 0.25, lowpass: 900, delay: 0.03 });
    air(c, o, { dur: 1.0, vol: 0.06, freq: 2000, freqEnd: 150, q: 0.8, attack: 0.01 });
  },
  rewind: (c, o) => { [N.C6, N.A5, N.G5, N.E5, N.D5, N.C5, N.A4, N.G4].forEach((f, i) => note(c, o, f, { dur: 0.16, type: 'triangle', vol: 0.06, delay: i * 0.09 })); air(c, o, { dur: 1.1, vol: 0.05, freq: 500, freqEnd: 2600, q: 1.5, attack: 0.2 }); },
  clone: (c, o) => { note(c, o, N.G4, { dur: 0.55, vol: 0.075, glide: 2, detune: 9, attack: 0.04 }); note(c, o, N.G4, { dur: 0.55, vol: 0.075, glide: 2, detune: -9, attack: 0.04 }); },
  // a gateway opening: a quick rising sweep, then a sparkle of high notes
  portal: (c, o) => {
    note(c, o, N.C4, { dur: 0.7, vol: 0.08, glide: 2, attack: 0.08, partials: [[1.5, 0.4]] });
    air(c, o, { dur: 0.7, vol: 0.05, freq: 400, freqEnd: 2600, q: 3, attack: 0.1 });
    [N.G5, N.C6, N.E6].forEach((f, i) => note(c, o, f, { dur: 0.45, vol: 0.035, delay: 0.55 + i * 0.07, partials: [[2, 0.2]] }));
  },
  win: (c, o) => {
    [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => note(c, o, f, { dur: 1.1, vol: 0.047, delay: i * 0.12, partials: [[2, 0.2], [3, 0.05]] }));
    [N.C4, N.G4, N.E5].forEach(f => note(c, o, f, { dur: 1.8, vol: 0.019, delay: 0.5, attack: 0.25 }));
  },
};

// ---------- recorded sounds (Kenney, CC0; see vendor/kenney-sounds/SOURCES.md) ----------
// Each slot has candidates a/b/c. PICK says which one the game uses ('coded' = keep the hand-made voice).
// Every recording is level-matched to its slot's loudness target, so swapping one never changes the balance.
export const SAMPLE_SLOTS = {
  // targets are the recording's own level; the mix chain then sits them where Ravi's ratings asked (tick up, card down)
  tick: { target: -36, vary: 0.03 }, type: { target: -55, vary: 0.06 }, card: { target: -33, vary: 0.03 },
  glitch: { target: -31 }, blackout: { target: -31, tail: true }, clue: { target: -34 },
};
// Picked by Ravi by ear on the sound board (round 2, F10). Typing stays hand-made: the recorded one didn't fit.
export const PICK = { tick: 'b', type: 'coded', card: 'c', glitch: 'coded', blackout: 'coded', clue: 'a' };
export const SAMPLE_BASE = 'vendor/kenney-sounds/';
const loaded = new WeakMap();   // audio context -> { slot: { buf, gain } }

function rmsDb(buf) {
  const d = buf.getChannelData(0); let s = 0;
  for (let i = 0; i < d.length; i++) s += d[i] * d[i];
  return 10 * Math.log10(s / d.length || 1e-12);
}
export async function loadSamples(c, picks = PICK, base = SAMPLE_BASE) {
  const got = loaded.get(c) || {};
  await Promise.all(Object.entries(picks).map(async ([slot, pick]) => {
    if (pick === 'coded' || !SAMPLE_SLOTS[slot]) { delete got[slot]; return; }
    try {
      const res = await fetch(`${base}${slot}-${pick}.wav`);
      if (!res.ok) return;
      const buf = await c.decodeAudioData(await res.arrayBuffer());
      got[slot] = { buf, gain: Math.pow(10, (SAMPLE_SLOTS[slot].target - rmsDb(buf)) / 20) };
    } catch (e) { /* keep the coded voice */ }
  }));
  loaded.set(c, got);
  return got;
}
function playSample(c, out, slot, urgent) {
  const s = (loaded.get(c) || {})[slot];
  if (!s) return false;
  const src = c.createBufferSource(), g = c.createGain();
  src.buffer = s.buf;
  const vary = SAMPLE_SLOTS[slot].vary || 0;
  src.playbackRate.value = (urgent ? 1.12 : 1) * (1 + (Math.random() * 2 - 1) * vary);
  g.gain.value = s.gain * (urgent ? 1.6 : 1);
  src.connect(g); g.connect(out); src.start();
  if (SAMPLE_SLOTS[slot].tail && CODED[slot + 'Tail']) CODED[slot + 'Tail'](c, out);
  return true;
}
// What the game plays: the recorded sound if one is picked and loaded, otherwise the coded one.
export const VOICES = Object.fromEntries(Object.keys(CODED).filter(k => !k.endsWith('Tail'))
  .map(k => [k, (c, o, ...a) => { if (!playSample(c, o, k, a[0])) CODED[k](c, o, ...a); }]));

// The typewriter calls type() every few letters; never more than one click per 45 ms.
let lastType = 0;
function play(name, ...args) {
  if (!ctx || level === 'off') return;
  if (name === 'type') { const now = ctx.currentTime; if (now - lastType < 0.045) return; lastType = now; }
  try { VOICES[name](ctx, DRY.has(name) ? chain.dry : chain.bus, ...args); } catch (e) { /* never let a sound break the game */ }
}
export const sfx = Object.fromEntries(Object.keys(VOICES).map(k => [k, (...a) => play(k, ...a)]));

// Audio starts only after the player's first click (browsers require it, and nobody likes surprise sound).
export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    chain = buildChain(ctx, LEVELS[level]);
    loadSamples(ctx);   // recorded sounds arrive in the background; coded ones play until then
    // Pause sound while the tab is hidden; resume when it's back.
    document.addEventListener('visibilitychange', () => { if (!ctx) return; document.hidden ? ctx.suspend() : ctx.resume(); });
  } catch (e) { ctx = null; }
}
export const soundLevel = () => level;
export function setSoundLevel(l) {
  if (!(l in LEVELS)) return;
  level = l;
  try { localStorage.setItem(LEVEL_KEY, l); } catch (e) {}
  if (chain) chain.vol.gain.setTargetAtTime(LEVELS[l], ctx.currentTime, 0.05);
}
// Older calls still work.
export function setMuted(m) { setSoundLevel(m ? 'off' : 'full'); }
export const isMuted = () => level === 'off';

// Renders one sound offline (no speakers) and returns its samples, for tests and the sound board.
export async function renderVoice(voices, name, { chainFn = buildChain, args = [], seconds = 3, rate = 44100, picks = null } = {}) {
  const c = new OfflineAudioContext(1, rate * seconds, rate);
  const out = chainFn(c);
  if (picks) await loadSamples(c, picks, '/' + SAMPLE_BASE);
  voices[name](c, (DRY.has(name) && out.dry) || out.bus || out, ...args);
  const buf = await c.startRendering();
  return buf.getChannelData(0);
}
