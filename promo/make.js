// Builds the LinkedIn promo (1080x1080 MP4, ~35 s) from promo/out/raw.webm + events.json (made by record.js).
//   1. game sounds: rebuilt offline from the event log with the game's own voices, in sync with the footage
//   2. music: composed here in the game's key (C major pentatonic), so there is nothing to license
//   3. captions + end card: HTML rendered to PNG in the game's fonts
//   4. ffmpeg: cut the clips, lay out the square frame, mix, normalise loudness, encode for LinkedIn
// Run (with tests/serve.js running): node promo/make.js
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require(path.join(__dirname, '../tests/node_modules/@playwright/test'));

const BASE = process.env.BASE || 'http://127.0.0.1:8799';
const OUT = path.join(__dirname, 'out');
const TMP = path.join(OUT, 'tmp');
const SR = 44100;
const S = 1080, GAME_H = 810, BAND = (S - GAME_H) / 2;   // the whole 4:3 game screen, nothing cropped   // square frame: caption band, game, brand band

// The edit: [start in raw.webm, length, caption]
// The edit. Each clip is tied to a moment in the recording (a mark or a sound from events.json), not a fixed second,
// so re-recording after a game change still lands on the right moments. [anchor, offset (s), length (s), caption]
const SHOTS = [
  ['start', 0.3, 3.0, 'It’s 4:55 PM on release day. <em>Again.</em>'],
  ['mark:play readLog', -0.2, 4.0, 'Read the whole 60,000-line log? Claude’s memory <em>fills up.</em>'],
  ['sound:rewind', -0.4, 3.0, 'At 5:00 the day resets. Claude <em>forgets everything</em>…'],
  ['mark:notes', -1.5, 3.2, '…except the <em>3 notes</em> you write down for it.'],
  ['mark:result: Send clone', -1.9, 3.2, 'Send a <em>subagent</em> to explore.'],
  ['mark:result: Open portal', -1.6, 3.2, 'Connect your tools with <em>MCP</em>.'],
  ['mark:result: Run the tests', -0.4, 3.0, 'Make Claude <em>prove the fix</em> before you trust it.'],
  ['mark:result: Skill carved', -1.4, 3.0, 'Teach every future session with <em>skills</em> and <em>hooks</em>.'],
  ['lastsound:win', -0.1, 3.0, '<em>Break the loop.</em>'],
  ['mark:END', 0.2, 3.4, 'Learn to work with Claude <em>by playing.</em>'],
];
const END_CARD = 4.0;
const TOTAL = SHOTS.reduce((s, c) => s + c[2], 0) + END_CARD;

const ff = args => execFileSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
function wav(file, channels, int16) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + int16.length, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * channels * 2, 28); h.writeUInt16LE(channels * 2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(int16.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, int16]));
}

(async () => {
  fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
  const events = JSON.parse(fs.readFileSync(path.join(OUT, 'events.json'), 'utf8'));
  const when = anchor => {
    if (anchor === 'start') return 0;
    const [kind, what] = anchor.split(/:(.*)/s);
    const hit = kind === 'mark' ? events.marks.find(m => m.s.startsWith(what))
      : kind === 'sound' ? events.sounds.find(s => s.k === what)
      : events.sounds.filter(s => s.k === what).pop();
    if (!hit) throw new Error(`No "${anchor}" in the recording; check promo/record.js still plays that far`);
    return hit.t;
  };
  const EDL = SHOTS.map(([anchor, off, dur, cap]) => [Math.max(0, when(anchor) + off), dur, cap]);
  const rawLen = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(OUT, 'raw.webm')]).toString());
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(BASE + '/sounds.html', { waitUntil: 'domcontentloaded' });

  // 1. game sounds, offline, at the exact times they played during the recording
  const sfx = await page.evaluate(async ({ sounds, len, SR }) => {
    const { VOICES, DRY, buildChain, LEVELS, loadSamples, PICK } = await import('/game/fx.js');
    const c = new OfflineAudioContext(1, Math.ceil(len * SR), SR);
    const chain = buildChain(c, LEVELS.full);
    await loadSamples(c, PICK);
    const q = t => Math.round(t * SR / 128) * 128 / SR;   // suspend() works in 128-sample steps
    const groups = new Map(); let lastType = -1;
    for (const e of sounds) {
      if (e.t < 0 || e.t > len - 0.1) continue;
      if (e.k === 'type') { if (e.t - lastType < 0.045) continue; lastType = e.t; }   // same throttle as the game
      const t = Math.max(q(e.t), 128 / SR);
      if (!groups.has(t)) groups.set(t, []);
      groups.get(t).push(e);
    }
    for (const [t, list] of groups) c.suspend(t).then(() => {
      for (const e of list) VOICES[e.k](c, DRY.has(e.k) ? chain.dry : chain.bus, ...(e.a || []));
      c.resume();
    });
    const d = (await c.startRendering()).getChannelData(0);
    const out = new Int16Array(d.length);
    for (let i = 0; i < d.length; i++) out[i] = Math.max(-1, Math.min(1, d[i])) * 32767;
    let s = ''; const u8 = new Uint8Array(out.buffer);
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }, { sounds: events.sounds, len: rawLen, SR });
  wav(path.join(TMP, 'sfx.wav'), 1, Buffer.from(sfx, 'base64'));

  // 2. music: soft pad + bass + a plucked arpeggio that builds, lifts at "Break the loop", resolves on the end card
  const liftAt = SHOTS.slice(0, 8).reduce((s, c) => s + c[2], 0);   // when "Break the loop" starts
  const music = await page.evaluate(async ({ len, SR, liftAt }) => {
    const c = new OfflineAudioContext(2, Math.ceil(len * SR), SR);
    const master = c.createGain(); master.gain.value = 0.5;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
    master.connect(comp); comp.connect(c.destination);
    const verb = c.createConvolver(); const ir = c.createBuffer(2, SR * 2.2, SR);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); }
    verb.buffer = ir; const wet = c.createGain(); wet.gain.value = 0.35; verb.connect(wet); wet.connect(master);
    const hz = m => 440 * Math.pow(2, (m - 69) / 12);
    const voice = (midi, t, dur, { type = 'sine', vol = 0.1, attack = 0.01, release = 0.3, cutoff = 4000, pan = 0, detune = 0 } = {}) => {
      const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(), p = c.createStereoPanner();
      o.type = type; o.frequency.value = hz(midi); o.detune.value = detune;
      f.type = 'lowpass'; f.frequency.value = cutoff; p.pan.value = pan;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack);
      g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release)); g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(f); f.connect(g); g.connect(p); p.connect(master); p.connect(verb);
      o.start(t); o.stop(t + dur + 0.05);
    };
    const BEAT = 60 / 96, BAR = BEAT * 4;
    const CHORDS = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]];   // C, Am, F, G
    const end = len - 4.0;   // end card starts here
    for (let bar = 0, t = 0; t < end; bar++, t += BAR) {
      const ch = CHORDS[Math.floor(bar / 1) % 4];
      const lifted = t >= liftAt - 0.01;
      for (const [i, n] of ch.entries()) {
        voice(n + 12, t, BAR + 0.4, { type: 'triangle', vol: 0.045, attack: 0.6, release: 0.8, cutoff: lifted ? 2400 : 1300, pan: (i - 1) * 0.4, detune: 6 });
        voice(n + 12, t, BAR + 0.4, { type: 'sine', vol: 0.035, attack: 0.6, release: 0.8, pan: (1 - i) * 0.4, detune: -6 });
      }
      voice(ch[0] - 12, t, BAR, { type: 'sine', vol: t > 3 ? 0.16 : 0.08, attack: 0.04, release: 0.5, cutoff: 600 });
      if (t >= 2.9) {   // the arpeggio enters after the opening line
        const arp = [ch[0] + 24, ch[1] + 24, ch[2] + 24, ch[1] + 24, ch[0] + 36, ch[2] + 24, ch[1] + 24, ch[2] + 24];
        arp.forEach((n, i) => { const at = t + i * BEAT / 2; if (at < end) voice(n, at, 0.35, { type: 'triangle', vol: lifted ? 0.06 : 0.04, attack: 0.005, release: 0.3, cutoff: lifted ? 5000 : 2800, pan: i % 2 ? 0.35 : -0.35 }); });
      }
    }
    // end card: resolve on C major, with a little sparkle, and let it ring out
    for (const n of [48, 55, 60, 64, 67]) voice(n, end, 3.8, { type: 'triangle', vol: 0.05, attack: 0.05, release: 2.8, cutoff: 3000 });
    [72, 76, 79, 84].forEach((n, i) => voice(n, end + 0.1 + i * 0.12, 1.6, { type: 'sine', vol: 0.03, attack: 0.005, release: 1.4 }));
    master.gain.setValueAtTime(0.5, len - 1.2); master.gain.linearRampToValueAtTime(0, len);
    const b = await c.startRendering();
    const L = b.getChannelData(0), R = b.getChannelData(1), out = new Int16Array(L.length * 2);
    for (let i = 0; i < L.length; i++) { out[2 * i] = Math.max(-1, Math.min(1, L[i])) * 32767; out[2 * i + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
    let s = ''; const u8 = new Uint8Array(out.buffer);
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }, { len: TOTAL, SR, liftAt });
  wav(path.join(TMP, 'music.wav'), 2, Buffer.from(music, 'base64'));

  // 3. captions (transparent, top band) and the end card, drawn in the game's fonts
  const shell = body => `<!doctype html><html><head><meta charset="utf-8">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800;900&family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans:wght@500;600&display=swap">
    <style>html,body{margin:0;width:${S}px;height:${S}px;background:transparent;overflow:hidden}
    .cap{position:absolute;left:0;right:0;top:0;height:${BAND}px;display:flex;align-items:center;justify-content:center;padding:0 64px;box-sizing:border-box;
      font:800 50px/1.02 'Big Shoulders Display',sans-serif;color:#fff;text-align:center;letter-spacing:.005em}
    .cap em{font-style:normal;color:#ffb547}
    .brand{position:absolute;left:0;right:0;bottom:0;height:${BAND}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
      font:600 18px/1 'IBM Plex Mono',monospace;letter-spacing:.2em;text-transform:uppercase;color:#9aa1d8}
    .brand b{font:900 40px/1 'Big Shoulders Display',sans-serif;letter-spacing:.02em;color:#ffb547;text-transform:none}</style></head><body>${body}</body></html>`;
  const shot = async (html, file, transparent = true) => {
    await page.setViewportSize({ width: S, height: S });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: file, omitBackground: transparent });
  };
  for (const [i, c] of EDL.entries()) await shot(shell(`<div class="cap"><span>${c[2]}</span></div>`), path.join(TMP, `cap${i}.png`));
  await shot(shell(`<div class="brand"><b>5:00 PM Forever</b><span>Free · plays in your browser</span></div>`), path.join(TMP, 'brand.png'));
  await shot(`<!doctype html><html><head><meta charset="utf-8">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800;900&family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans:wght@500;600&display=swap">
    <style>html,body{margin:0;width:${S}px;height:${S}px;overflow:hidden;background:radial-gradient(ellipse at 50% 30%,#2a1a5e 0%,#0b0e26 60%);color:#e8eaff;
      display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-family:'IBM Plex Sans',sans-serif}
    .k{font:600 20px/1 'IBM Plex Mono',monospace;letter-spacing:.22em;text-transform:uppercase;color:#ffb547;margin-bottom:28px}
    h1{margin:0;font:900 170px/.86 'Big Shoulders Display',sans-serif}h1 span{display:block;color:#ffb547}
    p{margin:34px 0 0;font-size:32px;line-height:1.35;color:#c6cbef;max-width:820px}
    .url{margin-top:44px;padding:18px 34px;border-radius:14px;background:#ffb547;color:#1a1030;font:600 30px/1 'IBM Plex Mono',monospace}
    .by{margin-top:40px;font:500 20px/1 'IBM Plex Mono',monospace;color:#9aa1d8;letter-spacing:.06em}</style></head><body>
    <div class="k">A time-loop game about working with Claude</div>
    <h1>5:00 PM<span>Forever</span></h1>
    <p>Learn context, memory, subagents, MCP, skills and hooks by playing. Free, in your browser.</p>
    <div class="url">ravigajul.github.io/claude-quest</div>
    <div class="by">Created by Ravi Gajul · built with Claude</div></body></html>`, path.join(TMP, 'end.png'), false);
  await browser.close();

  // 4. cut each clip (video + its game sounds), lay out the square frame, caption it
  const parts = [];
  for (const [i, [start, dur]] of EDL.entries()) {
    const f = path.join(TMP, `part${i}.mp4`);
    ff(['-ss', String(start), '-t', String(dur), '-i', path.join(OUT, 'raw.webm'),
      '-ss', String(start), '-t', String(dur), '-i', path.join(TMP, 'sfx.wav'),
      '-i', path.join(TMP, `cap${i}.png`), '-i', path.join(TMP, 'brand.png'),
      '-filter_complex', `[0:v]scale=${S}:${GAME_H}:flags=lanczos,setsar=1,fps=30,pad=${S}:${S}:0:${BAND}:0x0b0e26[g];[g][2:v]overlay[a];[a][3:v]overlay,` +
        `fade=in:st=0:d=0.15,fade=out:st=${dur - 0.15}:d=0.15[v];[1:a]aformat=sample_rates=${SR}:channel_layouts=stereo,afade=in:d=0.05,afade=out:st=${dur - 0.08}:d=0.08[aud]`,
      '-map', '[v]', '-map', '[aud]', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le', '-t', String(dur), f.replace('.mp4', '.mkv')]);
    parts.push(f.replace('.mp4', '.mkv'));
  }
  const endPart = path.join(TMP, 'partEnd.mkv');
  ff(['-loop', '1', '-t', String(END_CARD), '-i', path.join(TMP, 'end.png'), '-f', 'lavfi', '-t', String(END_CARD), '-i', `anullsrc=r=${SR}:cl=stereo`,
    '-filter_complex', `[0:v]fps=30,scale=${S}:${S},setsar=1,fade=in:st=0:d=0.4[v]`, '-map', '[v]', '-map', '1:a',
    '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le', endPart]);
  parts.push(endPart);
  fs.writeFileSync(path.join(TMP, 'list.txt'), parts.map(p => `file '${p}'`).join('\n'));
  const joined = path.join(TMP, 'joined.mkv');
  ff(['-f', 'concat', '-safe', '0', '-i', path.join(TMP, 'list.txt'), '-c', 'copy', joined]);

  // mix game sounds over the music (music ducks a little under them), normalise to -14 LUFS (social video), encode
  const final = path.join(OUT, '5pm-forever-linkedin.mp4');
  ff(['-i', joined, '-i', path.join(TMP, 'music.wav'),
    '-filter_complex', '[0:a]volume=1.6,asplit[s][s1];[1:a]volume=0.9[m];[m][s]sidechaincompress=threshold=0.05:ratio=3:attack=20:release=250[md];' +
      '[md][s1]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=9,alimiter=limit=0.82:level=false[a]',
    '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-t', String(TOTAL), final]);
  console.log(`made ${final} (${TOTAL.toFixed(1)} s, ${(fs.statSync(final).size / 1e6).toFixed(1)} MB)`);
})();
