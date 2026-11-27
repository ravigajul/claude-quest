// Lessons learned (L1, L2…) and Ravi's feedback (F1, F2…) from docs/lessons.md, each turned into a test,
// so the game never drifts back into an old mistake. The guard test at the top fails if docs/lessons.md
// gains a lesson or feedback item that has no test here yet.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { openHub, startMission1 } = require('./helpers');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

test('guard: every lesson and feedback item in docs/lessons.md has a test here', () => {
  const doc = read('docs/lessons.md');
  const lessons = doc.split('**Lessons learned')[1].split('**Ravi\'s feedback log')[0];
  const feedback = doc.split('**Ravi\'s feedback log')[1];
  const ids = [
    ...[...lessons.matchAll(/^(\d+)\. \*\*/gm)].map(m => 'L' + m[1]),
    ...[...feedback.matchAll(/^(F\d+)\./gm)].map(m => m[1]),
  ];
  expect(ids.length).toBeGreaterThan(10);
  const me = read('tests/lessons.spec.js');
  const missing = ids.filter(id => !me.includes(`test('${id}:`));
  expect(missing, 'Add a test named "<id>: ..." for each of these').toEqual([]);
});

// ---------- Lessons learned ----------
test('L1: every live mission has a hub button, 5 quiz questions, a full Field Guide and a playthrough test', async ({ page }) => {
  await openHub(page);
  const info = await page.evaluate(async () => {
    const { MISSIONS, GUIDE } = await import('/game/guide.js');
    const { QUIZ } = await import('/game/quiz.js');
    return MISSIONS.filter(m => m.status === 'live').map(m => ({
      id: m.id,
      button: !!document.querySelector('#go-' + m.id),
      quiz: (QUIZ[m.id] || []).length,
      emptyGuide: GUIDE.filter(g => g.mission === m.id && !(g.what && g.how && g.tryIt)).map(g => g.id),
    }));
  });
  const specs = read('tests/game.spec.js');
  expect(info.length).toBeGreaterThanOrEqual(3);
  for (const m of info) {
    expect(m.button, `${m.id} hub button`).toBe(true);
    expect(m.quiz, `${m.id} quiz questions`).toBe(5);
    expect(m.emptyGuide, `${m.id} Field Guide entries without how/tryIt`).toEqual([]);
    expect(specs, `${m.id} needs a playthrough test`).toContain(`Mission ${m.id.slice(1)} can be played start to finish`);
  }
});

test('L2: the page carries its own CSS reset, so local runs match the published site', () => {
  // Any spacing: the source writes it spaced out, the published page's header writes it compact.
  expect(read('index.html')).toMatch(/\*,\s*\*::before,\s*\*::after\s*\{\s*box-sizing:\s*border-box;?\s*\}/);
});

test('L3: tests wait for things to happen, not for fixed long sleeps', () => {
  for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && f !== 'lessons.spec.js')) {
    const sleeps = [...read('tests/' + f).matchAll(/waitForTimeout\((\d+)\)/g)].map(m => Number(m[1]));
    expect(sleeps.filter(ms => ms > 500), `${f} has long fixed sleeps`).toEqual([]);
  }
});

test('L4: only real Claude features: no retired command names or placeholder text in the Field Guide', async ({ page }) => {
  await openHub(page);
  const guide = await page.evaluate(async () => (await import('/game/guide.js')).GUIDE);
  const text = guide.map(g => [g.name, g.what, g.how, g.tryIt].join(' ')).join('\n');
  expect(text).not.toMatch(/\/review(?![-\w])/);     // the built-in review is /code-review
  expect(text).not.toMatch(/TODO|TBD|lorem/i);
});

test('L5: the published social picture is a real 1200×630 PNG', () => {
  const png = fs.readFileSync(path.join(root, 'social.png'));
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
});

test('L6: the review skill makes us look at laptop and phone screenshots', () => {
  const skill = read('.claude/skills/game-review/SKILL.md');
  expect(skill).toContain('1366×768');
  expect(skill).toContain('390×844');
  expect(skill).toMatch(/Learn from this round/);
});

test('L7: tests are never weakened to get green, and failing tests block the deploy', () => {
  expect(read('CLAUDE.md').split('\n').length, 'keep CLAUDE.md short: link docs, don\'t paste them').toBeLessThan(40);
  expect(read('CLAUDE.md')).toMatch(/Never weaken, skip or delete a test/);
  expect(read('.claude/skills/game-review/SKILL.md')).toMatch(/Never skip, weaken or delete a test/);
  expect(read('.github/workflows/pages.yml')).toMatch(/build:\s*\n\s*needs: test/);
});

test('L8: "Wake up" stays disabled until the game is ready, so an early click is never lost', async ({ page }) => {
  let release;
  const gate = new Promise(r => { release = r; });
  await page.route('**/three.module.min.js', async route => { await gate; await route.continue(); });   // a slow network
  await page.goto('/index.html');
  await expect(page.locator('#start')).toBeDisabled();
  await expect(page.locator('#start')).toHaveText('Loading…');
  release();
  await expect(page.locator('#start')).toBeEnabled({ timeout: 20_000 });
  await page.click('#start');
  await expect(page.locator('#hub')).toBeVisible();
});

test('L9: if the 3D scene never loads, the game still starts (in 2D)', async ({ page }) => {
  test.setTimeout(60_000);
  await page.route('**/three.module.min.js', () => {});   // the download never finishes
  await page.goto('/index.html');
  await expect(page.locator('#start')).toBeEnabled({ timeout: 20_000 });
  await expect(page.locator('body')).toHaveClass(/no3d/);
  await page.click('#start');
  await expect(page.locator('#hub')).toBeVisible();
});

test('L10: the tests use their own reliable UTF-8 server, not python\'s http.server', async ({ request }) => {
  expect(read('tests/playwright.config.js')).toMatch(/node serve\.js/);
  expect(read('tests/playwright.config.js')).not.toMatch(/command:.*http\.server/);
  const res = await request.get('/index.html');
  expect(res.headers()['content-type']).toBe('text/html; charset=utf-8');
});

test('L11: the commit hook also checks the built copy that GitHub tests', () => {
  const gate = read('tests/commit-gate.sh');
  expect(gate).toMatch(/check_built/);
  expect(gate).toMatch(/files\.spec\.js lessons\.spec\.js/);
});

// ---------- Ravi's feedback ----------
test('F1: How to play is pointed out, and never says "replay" before the tour was taken', async ({ page }) => {
  await openHub(page, { seen: false });
  await page.click('#go-m1');
  await page.click('#qz-skip');
  await page.click('#pr-skip');
  await page.click('#brief-go');
  await page.click('#lv-go');
  await page.click('#tour-skip');
  await expect(page.locator('#tour-btn')).toHaveClass(/attn/, { timeout: 3000 });
  await expect(page.locator('#tour-btn')).not.toHaveAttribute('data-tip', /Replay/);
});

test('F2: every mission has a way back to the mission list', async ({ page }) => {
  await openHub(page);
  for (const id of ['#exit-btn', '#exit-dlg', '#m2-back', '#m3-back']) await expect(page.locator(id)).toHaveCount(1);
  await page.click('#go-m3');
  await page.click('#qz-skip');
  await page.click('#m3-back');
  await expect(page.locator('#hub')).toBeVisible();
});

test('F3: top bar keeps Level beside Day, tops aligned, and "min left" muted', async ({ page }) => {
  await startMission1(page);
  const b = await page.evaluate(() => {
    const r = s => document.querySelector(s).getBoundingClientRect();
    const c = s => getComputedStyle(document.querySelector(s)).color;
    return { lvl: r('.top .stat.lvl'), day: r('#loop-sub'), clockColor: c('#clock'), minsColor: c('#mins-left') };
  });
  expect(Math.abs(b.lvl.top - b.day.top)).toBeLessThan(6);
  expect(b.day.left).toBeGreaterThan(b.lvl.right);
  expect(b.minsColor).not.toBe(b.clockColor);
});

test('F4: the top bar (and its How to play callout) sits above the board', async ({ page }) => {
  await startMission1(page);
  const z = await page.evaluate(() => {
    const zi = s => Number(getComputedStyle(document.querySelector(s)).zIndex) || 0;
    const btn = document.querySelector('#tour-btn').getBoundingClientRect();
    const hit = document.elementFromPoint(btn.left + btn.width / 2, btn.top + btn.height / 2);
    return { top: zi('.top'), hitIsButton: hit && hit.closest('#tour-btn') !== null };
  });
  expect(z.top).toBeGreaterThanOrEqual(5);
  expect(z.hitIsButton).toBe(true);
});

test('F5: play counting stays off the artifact and skips Ravi\'s own setup', () => {
  expect(read('game/stats.js')).toMatch(/goatcounter/);
  expect(read('docs/stats.md')).toContain('#toggle-goatcounter');            // how Ravi excludes his own plays
  expect(read('docs/stats.md')).toMatch(/deploys never wipe them/);           // data lives on GoatCounter, not in the site
});

test('F6: a failing test blocks commits and pushes (hook) and deploys (CI)', () => {
  const gate = read('tests/commit-gate.sh');
  expect(gate).toMatch(/commit\|push/);
  expect(gate).toMatch(/exit 2/);
  expect(read('.github/workflows/pages.yml')).toMatch(/run: npm test/);
});

test('F7: CLAUDE.md stays short and links the docs instead of importing them', () => {
  const md = read('CLAUDE.md');
  for (const f of ['PLAN.md', 'docs/lessons.md', 'docs/roadmap.md', 'docs/deploy.md', 'docs/changelog.md']) {
    expect(md, `CLAUDE.md links ${f}`).toContain(`](${f})`);
    expect(fs.existsSync(path.join(root, f)), `${f} exists`).toBe(true);
  }
  expect(md, 'no @imports: they load the whole file into every session').not.toMatch(/^@|\s@docs\//m);
  expect(read('PLAN.md').split('\n').length, 'PLAN.md is an index, not the whole history').toBeLessThan(60);
});
