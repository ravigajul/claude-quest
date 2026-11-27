// The game's ORIGINAL sounds (before v2.3), kept only so the sound board can play old vs new side by side.
// Same signature as VOICES in fx.js: (ctx, destination, ...args).
function tone(c, out, freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0 } = {}) {
  const t0 = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(c, out, dur, vol = 0.2, delay = 0) {
  const len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(), g = c.createGain(); g.gain.value = vol; s.buffer = buf; s.connect(g); g.connect(out); s.start(c.currentTime + delay);
}
export function legacyChain(c) { const m = c.createGain(); m.gain.value = 0.35; m.connect(c.destination); return m; }
export const LEGACY = {
  tick: (c, o, urgent) => tone(c, o, urgent ? 1500 : 1100, 0.04, { type: 'square', vol: urgent ? 0.12 : 0.06 }),
  type: (c, o) => tone(c, o, 1800 + Math.random() * 400, 0.015, { type: 'square', vol: 0.02 }),
  card: (c, o) => tone(c, o, 420, 0.12, { type: 'triangle', vol: 0.2, slide: 300 }),
  clue: (c, o) => { tone(c, o, 660, 0.18, { vol: 0.2 }); tone(c, o, 990, 0.3, { vol: 0.15, delay: 0.08 }); },
  pour: (c, o) => { noise(c, o, 0.6, 0.12); tone(c, o, 200, 0.6, { type: 'sawtooth', vol: 0.05, slide: -120 }); },
  glitch: (c, o) => { noise(c, o, 0.35, 0.3); tone(c, o, 90, 0.4, { type: 'square', vol: 0.15, slide: -40 }); },
  blackout: (c, o) => { tone(c, o, 300, 1.2, { type: 'sawtooth', vol: 0.2, slide: -260 }); noise(c, o, 1.2, 0.2); },
  rewind: (c, o) => { for (let i = 0; i < 10; i++) tone(c, o, 1200 - i * 80, 0.08, { type: 'square', vol: 0.05, delay: i * 0.09 }); tone(c, o, 200, 1.4, { vol: 0.12, slide: 600 }); },
  clone: (c, o) => tone(c, o, 500, 0.5, { type: 'triangle', vol: 0.15, slide: 500 }),
  portal: (c, o) => { tone(c, o, 180, 1.0, { vol: 0.2, slide: 400 }); tone(c, o, 270, 1.0, { vol: 0.12, slide: 600, delay: 0.1 }); },
  win: (c, o) => { [523, 659, 784, 1046].forEach((f, i) => tone(c, o, f, 0.9, { vol: 0.16, delay: i * 0.14 })); },
};
