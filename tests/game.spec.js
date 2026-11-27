// Laptop-size checks. Each test names the review finding it guards (see tests/README.md).
const { test, expect } = require('@playwright/test');
const { watchErrors, openHub, startMission1, closeResults, playCard, playMission1ToEnd } = require('./helpers');

test('loads without errors and lists 8 missions', async ({ page }) => {
  const errors = watchErrors(page);
  await openHub(page);
  await expect(page.locator('.hub-grid .mission')).toHaveCount(8);
  await expect(page.locator('.hub-grid .mission.locked')).toHaveCount(5);
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
  // Click Send, then the chip and Send again in the same instant, so Claude is surely still thinking.
  const r = await page.evaluate(() => {
    const c = [...document.querySelectorAll('#m2-parts .m2-chip')].find(e => e.textContent.includes('Give one example'));
    const before = c.getAttribute('aria-pressed');
    document.querySelector('#m2-run').click();
    const thinking = document.querySelector('#m2-out-h').textContent.includes('thinking');
    const sendLocked = document.querySelector('#m2-run').disabled;
    c.click(); document.querySelector('#m2-run').click();
    return { thinking, sendLocked, same: c.getAttribute('aria-pressed') === before };
  });
  expect(r).toEqual({ thinking: true, sendLocked: true, same: true });
  await page.waitForFunction(() => !document.querySelector('#m2-out-h').textContent.includes('thinking'));
  await closeResults(page);
  await expect(page.locator('#m2-runs')).toHaveText(/^5 of 6/);
});

// ---- Mission 3 ----
// Picks the option whose text starts with `start` in the open choice pop-up.
// Waits for the result pop-up, then continues past it.
async function ok(page) {
  await page.locator('#result:not([hidden])').waitFor();
  await closeResults(page);
}
async function pick(page, start) {
  await page.locator('#choice:not([hidden])').waitFor();
  await page.locator('#c-options .c-opt', { hasText: start }).click();
}

test('Mission 3 can be played start to finish, with a wrong turn on the way', async ({ page }) => {
  const errors = watchErrors(page);
  await openHub(page);
  await page.click('#go-m3');
  await page.click('#qz-skip');
  await expect(page.locator('#m3')).toBeVisible();
  await expect(page.locator('#m3-pipe li.now')).toContainText('Find what changed');

  // 1. Find: a wrong answer first costs support tickets, then the right one.
  await page.click('#m3-go');
  await pick(page, 'Are the API tests passing?');
  await expect(page.locator('#r-title')).toHaveText('Not quite');
  await ok(page);
  await expect(page.locator('#m3-tickets')).toHaveText('46');
  await pick(page, 'Call GET /members/42');
  await ok(page);

  // 2. Sort: a wrong verdict is refused; the right ones go through.
  const row = i => page.locator('#m3-sort .m3-row').nth(i);
  await row(0).locator('button', { hasText: 'Safe' }).click();
  await expect(row(0)).not.toHaveClass(/ok/);
  for (const [i, v] of [[0, 'Breaks apps'], [1, 'Breaks apps'], [2, 'Privacy risk'], [3, 'Safe']]) {
    await row(i).locator('button', { hasText: v }).click();
    await expect(row(i)).toHaveClass(/ok/);
  }
  await expect(page.locator('#r-title')).toHaveText('Two breaking changes and a privacy leak');
  await ok(page);

  // 3. Save as a command.
  await page.click('#m3-go');
  await pick(page, 'In the repo, as .claude/commands');
  await pick(page, 'Write $ARGUMENTS');
  await ok(page);
  await expect(page.locator('#m3-cmd')).toContainText('$ARGUMENTS');

  // 4. CI and model, then the finale blocks pull request #219.
  await page.click('#m3-go');
  await pick(page, 'Add a CI step that runs claude -p');
  await pick(page, 'A fast, small model');
  await ok(page);
  await expect(page.locator('#m3-ci')).toContainText('RESULT: FAIL', { timeout: 15_000 });
  await expect(page.locator('#r-title')).toHaveText('Pull request #219 was blocked before it merged', { timeout: 10_000 });
  await ok(page);
  await page.click('#qz-skip').catch(() => {});
  await expect(page.locator('#m3done')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#o3-yml')).toContainText('secrets.ANTHROPIC_API_KEY');
  await expect(page.locator('#o3-learn li')).toHaveCount(4);
  expect(errors).toEqual([]);

  // Back on the hub, Mission 3 shows as completed.
  await page.click('#o3-hub');
  await expect(page.locator('#st-m3')).toContainText('Completed');
});

test('Mission 2 can be played start to finish', async ({ page }) => {
  const errors = watchErrors(page);
  await startMission2(page);
  const tap = async label => { await chip(page, label).click(); };
  await tap('Set the role');
  await tap('Task: cover every');
  await tap('Attach ticket');                     // asks how to connect the tracker first
  await pick(page, 'In your terminal run');
  await ok(page);
  await tap('Attach the design');                 // asks how to give Claude an image
  await pick(page, 'Copy the image and paste');
  await ok(page);
  await tap('Ask me questions');
  await tap('Give one example');
  await tap('Output: CSV');
  await tap('Only what you can trace');
  await page.click('#m2-run');                    // Claude asks Priya first (free round)
  await expect(page.locator('#r-title')).toHaveText('Claude asked instead of guessing', { timeout: 10_000 });
  await ok(page);
  await page.click('#m2-run');                    // now it writes the tests
  await expect(page.locator('#r-title')).toHaveText('All 10 covered. Nothing invented.', { timeout: 10_000 });
  await ok(page);
  await page.click('#qz-skip').catch(() => {});
  await expect(page.locator('#m2done')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('#od-title')).toHaveText('Priya imported your 10 test cases.');
  expect(errors).toEqual([]);
});
