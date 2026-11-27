// Hearing experience (F8): every sound is rendered silently in the browser and measured, so a future change
// can't bring back harsh, clipping, unbalanced or tiring sound. The sound board (sounds.html) shows the same numbers.
const { test, expect } = require('@playwright/test');

const FEEDBACK = ['tick', 'type'];                       // repeat often: must stay quiet and short
const EVENTS = ['clue', 'pour', 'glitch', 'blackout', 'rewind', 'clone', 'portal', 'win'];

async function measureAll(page) {
  await page.goto('/sounds.html', { waitUntil: 'domcontentloaded' });
  return page.evaluate(async () => {
    const { VOICES, renderVoice, PICK } = await import('/game/fx.js');
    const { LEGACY, legacyChain } = await import('/game/sfx-legacy.js');
    const db = x => (x > 0 ? 20 * Math.log10(x) : -120);
    const measure = d => {
      let peak = 0; for (const x of d) peak = Math.max(peak, Math.abs(x));
      const floor = peak * 0.01;                                     // "audible" = within 40 dB of its own peak
      let first = -1, last = 0;
      for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > floor) { if (first < 0) first = i; last = i; }
      let sum = 0, zc = 0;
      for (let i = first; i <= last; i++) { sum += d[i] * d[i]; if (i > first && (d[i] >= 0) !== (d[i - 1] >= 0)) zc++; }
      const n = last - first + 1;
      return { peakDb: db(peak), loudDb: db(Math.sqrt(sum / n)), ms: n / 44.1, bright: zc / 2 / (n / 44100) };
    };
    const out = {};
    for (const k of Object.keys(VOICES)) {
      out[k] = { now: measure(await renderVoice(VOICES, k, { picks: PICK })), old: LEGACY[k] ? measure(await renderVoice(LEGACY, k, { chainFn: legacyChain })) : null };
      if (k === 'tick') out.tickUrgent = { now: measure(await renderVoice(VOICES, k, { args: [true], picks: PICK })) };
    }
    return out;
  });
}

let M;
test.beforeEach(async ({ page }) => { if (!M) M = await measureAll(page); });

test('audio: nothing distorts (every peak stays below -3 dB)', () => {
  for (const [k, v] of Object.entries(M)) expect(v.now.peakDb, k).toBeLessThan(-3);
});

// Ravi approved the recorded tick B by ear (F10). Approved sounds get a slightly higher, still-capped limit;
// every other sound keeps the 3000 Hz rule.
const EAR_APPROVED = { tick: 4500, tickUrgent: 4500 };
test('audio: no harsh static (no sound brighter than 3000 Hz, ear-approved ones capped at 4500 Hz)', () => {
  for (const [k, v] of Object.entries(M)) expect(v.now.bright, `${k} brightness`).toBeLessThan(EAR_APPROVED[k] || 3000);
});

test('audio: event sounds are balanced within 10 dB of each other', () => {
  const l = EVENTS.map(k => M[k].now.loudDb);
  expect(Math.max(...l) - Math.min(...l)).toBeLessThan(10);
});

// Ravi's ratings (F9) found the tick too quiet at 8 dB below the events; his ear sets the gap at 5 dB.
test('audio: tick and typing sit at least 5 dB below the quietest event, and stay short', () => {
  const quietestEvent = Math.min(...EVENTS.map(k => M[k].now.loudDb));
  for (const k of FEEDBACK) {
    expect(M[k].now.loudDb, `${k} loudness`).toBeLessThan(quietestEvent - 5);
    expect(M[k].now.ms, `${k} length`).toBeLessThan(120);
  }
  expect(M.tickUrgent.now.loudDb, 'urgent tick is a little stronger').toBeGreaterThan(M.tick.now.loudDb);
});

test('audio: nothing drags on (every sound is under 2.5 s)', () => {
  for (const [k, v] of Object.entries(M)) expect(v.now.ms, k).toBeLessThan(2500);
});

test('audio: the new set is not much louder overall than the old one (no surprise blast)', () => {
  const avg = key => EVENTS.reduce((s, k) => s + M[k][key].loudDb, 0) / EVENTS.length;
  expect(avg('now') - avg('old')).toBeLessThan(6);
});

test('audio: no sound before the first click, and Sound full/soft/off is remembered', async ({ page }) => {
  await page.addInitScript(() => {
    window.__audioContexts = 0;
    const Real = window.AudioContext;
    window.AudioContext = class extends Real { constructor(...a) { super(...a); window.__audioContexts++; } };
  });
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#start')).toBeEnabled({ timeout: 20_000 });
  expect(await page.evaluate(() => window.__audioContexts)).toBe(0);
  await page.click('#start');
  expect(await page.evaluate(() => window.__audioContexts)).toBe(1);
  // The mission list has its own Sound button (the top bar is hidden there), kept in sync with the others.
  await expect(page.locator('#hub-sound')).toHaveText('Sound: full');
  await page.click('#hub-sound');
  await expect(page.locator('#hub-sound')).toHaveText('Sound: soft');
  await page.click('#hub-sound');
  await expect(page.locator('#hub-sound')).toHaveText('Sound: off');
  await expect(page.locator('#mute')).toHaveText('Sound: off');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#hub-sound')).toHaveText('Sound: off', { timeout: 20_000 });
});

test('audio: every screen has a visible Sound button (mission list, Missions 2 and 3, Mission 1 top bar)', async ({ page }) => {
  const { openHub, startMission1 } = require('./helpers');
  await openHub(page);
  await expect(page.locator('#hub .sound-btn')).toBeVisible();
  for (const m of ['m2', 'm3']) {
    await page.click(`#go-${m}`);
    await page.click('#qz-skip');
    await expect(page.locator(`#${m} .sound-btn`)).toBeVisible();
    await page.click(`#${m}-back`);
  }
  await startMission1(page);
  await expect(page.locator('#mute')).toBeVisible();
});

test('audio: the sound board loads, measures every sound, and has no errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/sounds.html');
  await expect(page.locator('#rows tr')).toHaveCount(11);
  await page.waitForFunction(() => [...document.querySelectorAll('.m .newv')].every(e => e.textContent.startsWith('new ')), null, { timeout: 20_000 });
  await page.locator('#rows select').first().selectOption('Better');
  await page.click('#copy');
  await expect(page.locator('#out')).toHaveValue(/Clock tick: Better/);
  expect(errors).toEqual([]);
});
