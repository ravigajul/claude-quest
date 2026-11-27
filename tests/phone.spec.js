// Phone-size checks (Pixel 7 touch screen).
const { test, expect } = require('@playwright/test');
const { watchErrors, startMission1 } = require('./helpers');

test('phone: jar, evidence board and side panels are all visible', async ({ page }) => {
  const errors = watchErrors(page);
  await startMission1(page);
  const h = await page.evaluate(() => Object.fromEntries(['.ctxp', '.board', '.side', '#objective', '#hand']
    .map(s => [s, Math.round(document.querySelector(s).getBoundingClientRect().height)])));
  for (const [sel, height] of Object.entries(h)) expect(height, `${sel} height`).toBeGreaterThan(100);
  // order: jar above the board, cards above Dana and the goal
  const top = s => page.evaluate(s => document.querySelector(s).getBoundingClientRect().top, s);
  expect(await top('.ctxp')).toBeLessThan(await top('.board'));
  expect(await top('#hand')).toBeLessThan(await top('.side'));
  expect(errors).toEqual([]);
});

test('phone: every card shows its one-line explanation', async ({ page }) => {
  await startMission1(page);
  const blurb = page.locator('#card-grep .blurb');
  await expect(blurb).toBeVisible();
  expect(Number(await blurb.evaluate(e => getComputedStyle(e).opacity))).toBe(1);
});

test('phone: Your job text uses the full width', async ({ page }) => {
  await startMission1(page);
  const w = await page.evaluate(() => ({ key: document.querySelector('.obj-key').getBoundingClientRect().width, box: document.querySelector('#objective').getBoundingClientRect().width }));
  expect(w.key).toBeGreaterThan(w.box * 0.8);
});

test('phone: Level and Day sit side by side', async ({ page }) => {
  await startMission1(page);
  const b = await page.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { lvl: r('.top .stat.lvl'), day: r('#loop-sub') }; });
  expect(Math.abs(b.lvl.top - b.day.top)).toBeLessThan(6);
  expect(b.day.left).toBeGreaterThan(b.lvl.right);
});

// Lesson (2026-11-27): a missing CSS reset made Mission 3 wider than the phone, cutting off the right edge.
test('phone: no mission screen is wider than the phone', async ({ page }) => {
  await (require('./helpers').openHub)(page);
  const fits = sel => page.evaluate(s => { const e = document.querySelector(s); return e.scrollWidth <= document.documentElement.clientWidth + 1; }, sel);
  expect(await fits('#hub')).toBe(true);
  for (const m of ['m2', 'm3']) {
    await page.click(`#go-${m}`);
    await page.click('#qz-skip');
    await page.waitForSelector(`#${m}:not([hidden])`);
    expect(await fits(`#${m}`), `#${m} fits`).toBe(true);
    await page.click(`#${m}-back`);
  }
});
