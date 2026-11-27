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
let ctx = null;
let master = null;
let muted = false;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  } catch (e) { ctx = null; }
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.35;
}
export const isMuted = () => muted;

function tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0 } = {}) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function noise(dur, vol = 0.2, delay = 0) {
  if (!ctx || muted) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource();
  const g = ctx.createGain();
  g.gain.value = vol;
  s.buffer = buf; s.connect(g); g.connect(master);
  s.start(ctx.currentTime + delay);
}

export const sfx = {
  tick: (urgent) => tone(urgent ? 1500 : 1100, 0.04, { type: 'square', vol: urgent ? 0.12 : 0.06 }),
  card: () => { tone(420, 0.12, { type: 'triangle', vol: 0.2, slide: 300 }); },
  clue: () => { tone(660, 0.18, { vol: 0.2 }); tone(990, 0.3, { vol: 0.15, delay: 0.08 }); },
  pour: () => { noise(0.6, 0.12); tone(200, 0.6, { type: 'sawtooth', vol: 0.05, slide: -120 }); },
  glitch: () => { noise(0.35, 0.3); tone(90, 0.4, { type: 'square', vol: 0.15, slide: -40 }); },
  blackout: () => { tone(300, 1.2, { type: 'sawtooth', vol: 0.2, slide: -260 }); noise(1.2, 0.2); },
  rewind: () => { for (let i = 0; i < 10; i++) tone(1200 - i * 80, 0.08, { type: 'square', vol: 0.05, delay: i * 0.09 }); tone(200, 1.4, { vol: 0.12, slide: 600 }); },
  clone: () => { tone(500, 0.5, { type: 'triangle', vol: 0.15, slide: 500 }); },
  portal: () => { tone(180, 1.0, { vol: 0.2, slide: 400 }); tone(270, 1.0, { vol: 0.12, slide: 600, delay: 0.1 }); },
  win: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.9, { vol: 0.16, delay: i * 0.14 })); },
  type: () => tone(1800 + Math.random() * 400, 0.015, { type: 'square', vol: 0.02 }),
};
