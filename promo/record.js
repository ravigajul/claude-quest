// Records a promo playthrough of Mission 1 (video + a log of every sound and when it played).
// Run: cd tests && node serve.js & ; node ../promo/record.js   → promo/out/raw.webm, promo/out/events.json
// Headless browsers record no sound, so promo/mix.js rebuilds the audio from the event log, in sync.
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../tests/node_modules/@playwright/test'));

const BASE = process.env.BASE || 'http://127.0.0.1:8799';
const OUT = path.join(__dirname, 'out');
const W = 1200, H = 900;   // 4:3, so the square video shows the whole screen with nothing cropped

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.webm')) fs.unlinkSync(path.join(OUT, f));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--window-size=${W},${H}`] });
  const context = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } } });
  const page = await context.newPage();
  const videoStart = Date.now();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('cq-primer', '1'); localStorage.setItem('cq-tour-m1', 'done'); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#start:not([disabled])', { timeout: 30_000 });
  // Log every sound the game asks for (same module instance the game uses).
  await page.evaluate(async () => {
    const { sfx } = await import('/game/fx.js');
    window.__sounds = [];
    for (const k of Object.keys(sfx)) { const real = sfx[k]; sfx[k] = (...a) => { window.__sounds.push({ k, t: Date.now(), a: a.slice(0, 1) }); return real(...a); }; }
    window.__marks = [];
  });
  await page.waitForTimeout(1500);   // the title screen, for the opening shot
  await page.click('#start');
  await page.waitForSelector('#hub:not([hidden])');
  await page.waitForTimeout(1200);
  await page.click('#go-m1');
  await page.click('#qz-skip');
  await page.waitForTimeout(900);
  await page.click('#brief-go');
  await page.waitForTimeout(900);
  await page.click('#lv-go');

  const log = await page.evaluate(async () => {
    const { MISSION } = await import('/game/mission.js');
    const correct = [];
    const walk = o => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (o.correct && o.text) correct.push(o.text); Object.values(o).forEach(walk); } };
    walk(MISSION);
    const w = ms => new Promise(r => setTimeout(r, ms));
    const vis = s => { const e = document.querySelector(s); return e && !e.closest('[hidden]') && e.getClientRects().length ? e : null; };
    const mark = s => window.__marks.push({ s, t: Date.now() });
    const PACE = 900;   // a watchable pace: every action holds on screen for a moment
    const order = ['grep', 'ask', 'conftest', 'clone', 'portal', 'diagnose', 'plan', 'clean', 'fix', 'verify', 'skill', 'hook', 'checkout', 'readLog'];
    const day1 = ['readLog', 'grep', 'ask', 'conftest', 'checkout'];   // day 1: read the whole log, so the jar overflows
    const t0 = Date.now();
    while (Date.now() - t0 < 300000) {
      await w(150);
      if (vis('#mirror')) { mark('END'); break; }
      if (vis('#quiz')) { await w(PACE); if (vis('#qz-next')) { vis('#qz-next').click(); continue; } const o = document.querySelectorAll('#qz-opts .c-opt'); if (o.length) { o[1].click(); continue; } }
      if (vis('#lv-go')) { mark('level: ' + (document.querySelector('#levelup h2')?.innerText || '')); await w(PACE * 1.6); vis('#lv-go').click(); continue; }
      if (vis('#tour')) { vis('#tour-skip').click(); continue; }
      if (vis('#choice')) {
        await w(PACE);
        const opts = [...document.querySelectorAll('#c-options .c-opt')].filter(b => !b.disabled);
        const pick = opts.find(b => correct.some(t => b.innerText.includes(t.slice(0, 40)))) || opts[0];
        mark('choice'); pick.click(); continue;
      }
      if (vis('#result') && vis('#r-ok')) { mark('result: ' + document.querySelector('#r-title').innerText); await w(PACE * 1.4); vis('#r-ok').click(); continue; }
      if (vis('#etch')) {
        await w(PACE);
        const tabs = [...document.querySelectorAll('#etch .tablet')].filter(b => !b.disabled);
        for (const b of tabs) if (document.querySelectorAll('#etch .tablet.on').length < 3 && !b.classList.contains('on')) { b.click(); await w(PACE / 2); }
        mark('notes'); await w(PACE); vis('#etch-go').click(); continue;
      }
      if (document.querySelector('#hand.busy')) continue;
      const ready = id => { const c = document.querySelector('#card-' + id); return c && !c.disabled; };
      const day = document.querySelector('#loop-sub').textContent;
      const id = (day === 'Day 1' ? day1 : order).find(ready);
      if (id) { await w(PACE); mark(`play ${id} (${day})`); document.querySelector('#card-' + id).click(); continue; }
      if (vis('#obj-end')) { await w(PACE); mark('skip to 5:00'); vis('#obj-end').click(); continue; }
    }
    return { marks: window.__marks, sounds: window.__sounds };
  });
  await page.waitForTimeout(4000);   // hold on the sunrise / ending
  const video = page.video();
  await context.close();
  fs.renameSync(await video.path(), path.join(OUT, 'raw.webm'));
  const rel = list => list.map(e => ({ ...e, t: (e.t - videoStart) / 1000 }));
  fs.writeFileSync(path.join(OUT, 'events.json'), JSON.stringify({ marks: rel(log.marks), sounds: rel(log.sounds), errors }, null, 1));
  await browser.close();
  console.log(`recorded ${(Date.now() - videoStart) / 1000 | 0}s, ${log.sounds.length} sounds, ${log.marks.length} marks, errors: ${errors.length}`);
  for (const m of rel(log.marks)) console.log(m.t.toFixed(1).padStart(6), m.s);
})();
