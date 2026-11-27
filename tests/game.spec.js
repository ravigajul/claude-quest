// Laptop-size checks. Each test names the review finding it guards (see tests/README.md).
const { test, expect } = require('@playwright/test');
const { watchErrors, openHub, startMission1, closeResults, playCard, playMission1ToEnd } = require('./helpers');

test('loads without errors and lists 8 missions', async ({ page }) => {
  const errors = watchErrors(page);
  await openHub(page);
  await expect(page.locator('.hub-grid .mission')).toHaveCount(8);
  await expect(page.locator('#hub-count')).toHaveText(/\/45$/);
  expect(errors).toEqual([]);
});

test('Mission 1 can be played start to finish', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await startMission1(page);
  const log = await playMission1ToEnd(page);
  expect(log.join('\n'), log.join('\n')).toContain('END: Morning, finally.');
  expect(errors).toEqual([]);
});

test('A1: day 1 cannot be won; Level 2 is never skipped', async ({ page }) => {
  await startMission1(page);
  for (const id of ['grep', 'ask', 'conftest', 'checkout']) { await playCard(page, id); await closeResults(page); }
  await expect(page.locator('#card-diagnose')).toHaveCount(0);
  await expect(page.locator('#obj-end')).toBeVisible();
  await page.click('#obj-end');
  await expect(page.locator('#etch')).toBeVisible({ timeout: 20_000 });
  await page.locator('#etch .tablet:not([disabled])').first().click();
  await page.click('#etch-go');
  await expect(page.locator('#levelup h2')).toContainText(/Clone and the Portal/i, { timeout: 20_000 });
});

test('A4: the tour describes the Messages panel truthfully', async ({ page }) => {
  await openHub(page, { seen: false });
  await page.click('#go-m1');
  await page.click('#qz-skip');
  await page.click('#pr-skip');
  await page.click('#brief-go');
  await page.click('#lv-go');
  await expect(page.locator('#tour')).toBeVisible();
  for (let i = 0; i < 5; i++) await page.click('#tour-next');
  await expect(page.locator('#tour-t')).toHaveText('Messages');
  await expect(page.locator('#tour-p')).not.toContainText('each command');
});

test('How to play callout points at the button once per launch', async ({ page }) => {
  await openHub(page);
  await page.click('#go-m1');
  await page.click('#qz-skip');
  await page.click('#brief-go');
  await page.click('#lv-go');
  await expect(page.locator('#tour-btn')).toHaveClass(/attn/, { timeout: 3000 });
  await expect(page.locator('#tour-btn')).toHaveAttribute('data-tip', /Take the 1-minute tour|Replay/);
});

test('top bar: Level and Day columns side by side, clock under Day', async ({ page }) => {
  await startMission1(page);
  const box = await page.evaluate(() => {
    const r = s => document.querySelector(s).getBoundingClientRect();
    return { lvl: r('.top .stat.lvl'), day: r('#loop-sub'), clock: r('#clock') };
  });
  expect(Math.abs(box.lvl.top - box.day.top)).toBeLessThan(6);   // tops aligned
  expect(box.day.left).toBeGreaterThan(box.lvl.right);          // Day column right of Level
  expect(box.clock.top).toBeGreaterThan(box.day.top);            // clock under the Day label
  await expect(page.locator('#loop-sub')).toHaveText('Day 1');
});

test('Missions button asks first, then returns to the mission list', async ({ page }) => {
  await startMission1(page);
  await page.click('#exit-btn');
  await expect(page.locator('#exit-dlg')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#exit-dlg')).toBeHidden();
  await page.click('#exit-btn');
  await page.click('#exit-yes');
  await expect(page.locator('#hub')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#intro')).toBeHidden();
});

test('keyboard: Tab stays inside a pop-up and Escape continues', async ({ page }) => {
  await startMission1(page);
  await page.focus('#card-grep');
  await page.keyboard.press('Enter');
  await expect(page.locator('#result')).toBeVisible({ timeout: 10_000 });
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('#result'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('#result')).toBeHidden();
});

// ---- Mission 2 ----
async function startMission2(page) {
  await openHub(page);
  await page.click('#go-m2');
  await page.click('#qz-skip');
  await page.waitForSelector('#m2:not([hidden])');
}
const chip = (page, text) => page.locator('#m2-parts .m2-chip', { hasText: text });
async function send(page) {
  await page.click('#m2-run');
  await page.waitForFunction(() => !document.querySelector('#m2-out-h').textContent.includes('thinking'));
  await closeResults(page);
}

test('A2: asking questions on the last session never strands the player', async ({ page }) => {
  await startMission2(page);
  for (let i = 0; i < 5; i++) await send(page);
  await expect(page.locator('#m2-runs')).toHaveText(/^1 of 6/);
  await chip(page, 'Ask me questions').click();
  await send(page);
  await expect(page.locator('#m2-run')).toBeEnabled();
  await expect(page.locator('#m2-runs')).toHaveText(/^1 of 6/);   // the question round was free
});

test('A6: the prompt is locked while Claude is thinking', async ({ page }) => {
  await startMission2(page);
  await page.click('#m2-run');
  await expect(page.locator('#m2-run')).toBeDisabled();
  const before = await chip(page, 'Give one example').getAttribute('aria-pressed');
  await chip(page, 'Give one example').click({ force: true });
  expect(await chip(page, 'Give one example').getAttribute('aria-pressed')).toBe(before);
  await page.waitForFunction(() => !document.querySelector('#m2-out-h').textContent.includes('thinking'));
  await closeResults(page);
  await expect(page.locator('#m2-runs')).toHaveText(/^5 of 6/);
});
