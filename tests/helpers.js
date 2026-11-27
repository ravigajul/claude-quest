// Shared helpers: open the game in a known state and play it like a careful player.

// Collect real errors (ignore the missing favicon and blocked outside requests).
function watchErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/favicon|goatcounter|fonts\.g|net::ERR/.test(m.text())) errors.push('console: ' + m.text());
  });
  return errors;
}

// Fresh browser storage, then the mission list. `seen` skips the primer and the tour.
async function openHub(page, { seen = true } = {}) {
  await page.goto('/index.html');
  await page.evaluate(seen => {
    localStorage.clear(); sessionStorage.clear();
    if (seen) { localStorage.setItem('cq-primer', '1'); localStorage.setItem('cq-tour-m1', 'done'); }
  }, seen);
  await page.reload();
  await page.click('#start');
  await page.waitForSelector('#hub:not([hidden])');
}

// Mission 1 up to the first playable moment (knowledge check skipped).
async function startMission1(page) {
  await openHub(page);
  await page.click('#go-m1');
  await page.click('#qz-skip');
  await page.click('#brief-go');
  await page.click('#lv-go');
  await page.waitForSelector('#card-grep:not([disabled])');
  await page.waitForFunction(() => !document.querySelector('#hand').classList.contains('busy'));
}

// Click Continue on every result pop-up until none is open.
async function closeResults(page) {
  for (let i = 0; i < 10; i++) {
    const open = await page.evaluate(() => { const r = document.querySelector('#result'); return r && !r.hidden; });
    if (!open) return;
    await page.click('#r-ok');
    await page.waitForTimeout(150);
  }
}

// Play one card and wait until the game is ready for the next action.
async function playCard(page, id) {
  await page.click(`#card-${id}`);
  await page.waitForFunction(() => {
    const busy = document.querySelector('#hand').classList.contains('busy');
    const dlg = ['#result', '#choice', '#etch', '#levelup', '#mirror'].some(s => { const e = document.querySelector(s); return e && !e.hidden; });
    return !busy || dlg;
  });
}

// Plays Mission 1 to the end, choosing the right answers from the game's own data.
// Returns a short log of what happened.
async function playMission1ToEnd(page) {
  return page.evaluate(async () => {
    const { MISSION } = await import('/game/mission.js');
    const correct = [];
    const walk = o => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (o.correct && o.text) correct.push(o.text); Object.values(o).forEach(walk); } };
    walk(MISSION);
    const w = ms => new Promise(r => setTimeout(r, ms));
    const vis = s => { const e = document.querySelector(s); return e && !e.closest('[hidden]') && e.getClientRects().length ? e : null; };
    const log = []; const note = s => { if (log[log.length - 1] !== s) log.push(s); };
    const order = ['grep', 'ask', 'conftest', 'clone', 'portal', 'diagnose', 'plan', 'clean', 'fix', 'verify', 'skill', 'hook', 'checkout', 'readLog'];
    const t0 = Date.now();
    while (Date.now() - t0 < 160000) {
      await w(120);
      if (vis('#mirror')) { note('END: ' + document.querySelector('#mirror h2').innerText); break; }
      if (vis('#quiz')) { if (vis('#qz-next')) { vis('#qz-next').click(); continue; } const o = document.querySelectorAll('#qz-opts .c-opt'); if (o.length) { o[1].click(); continue; } }
      if (vis('#lv-go')) { note('level: ' + (document.querySelector('#levelup h2')?.innerText || '')); vis('#lv-go').click(); continue; }
      if (vis('#tour')) { vis('#tour-skip').click(); continue; }
      if (vis('#choice')) {
        const opts = [...document.querySelectorAll('#c-options .c-opt')].filter(b => !b.disabled);
        const pick = opts.find(b => correct.some(t => b.innerText.includes(t.slice(0, 40)))) || opts[0];
        pick.click(); continue;
      }
      if (vis('#result') && vis('#r-ok')) { note('result: ' + document.querySelector('#r-title').innerText); vis('#r-ok').click(); continue; }
      if (vis('#etch')) {
        const tabs = [...document.querySelectorAll('#etch .tablet')].filter(b => !b.disabled);
        for (const b of tabs) if (document.querySelectorAll('#etch .tablet.on').length < 3 && !b.classList.contains('on')) b.click();
        note('notes: ' + document.querySelectorAll('#etch .tablet.on').length);
        vis('#etch-go').click(); continue;
      }
      if (document.querySelector('#hand.busy')) continue;
      const ready = id => { const c = document.querySelector('#card-' + id); return c && !c.disabled; };
      const id = order.find(ready);
      if (id) { note('play ' + id + ' (' + document.querySelector('#loop-sub').textContent + ')'); document.querySelector('#card-' + id).click(); continue; }
      if (vis('#obj-end')) { note('skip to 5:00'); vis('#obj-end').click(); continue; }
    }
    return log;
  });
}

module.exports = { watchErrors, openHub, startMission1, closeResults, playCard, playMission1ToEnd };
