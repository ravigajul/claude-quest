// Game engine: loop state machine, evidence, diagnosis, memory between loops, Mirror + CLAUDE.md save file.
import { MISSION as M } from './mission.js?v=20261127141358';
import { GUIDE, MISSIONS, BY_ID, CARD_TEACHES } from './guide.js?v=20261127141358';
import { runQuiz, postScore, QUIZ } from './quiz.js?v=20261127141358';
import { startMission2 } from './mission2.js?v=20261127141358';
import { sfx, initAudio, setMuted, isMuted, wait } from './fx.js?v=20261127141358';

const $ = sel => document.querySelector(sel);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const EV_IDS = Object.keys(M.evidence);
const HINT_TEXT_MS = 12000, HINT_CARD_MS = 25000, CHOICE_NUDGE_MS = 15000;

// ---------- 3D scene, with a stub when WebGL is unavailable ----------
let scene;
const stub = new Proxy({}, { get: () => () => Promise.resolve() });
async function boot3d() {
  try {
    const mod = await import('./scene3d.js?v=20261127141358');
    scene = mod.createScene($('#world'));
    scene.onSfx(n => sfx[n] && sfx[n]());
  } catch (e) {
    console.warn('3D unavailable, using 2D mode', e);
    document.body.classList.add('no3d');
    scene = stub;
  }
}

// ---------- state ----------
const fresh = () => ({
  loop: 1, minute: M.startMinute, ctx: M.baseContext, trust: 100,
  ev: new Set(), lost: new Set(), diagnosed: false, fixed: false, won: false, busy: false,
  notes: [],            // [{type:'ev'|'diag'|'lesson', id}]
  freeNote: '',
  used: new Set(), usedLoop: new Set(), lessonsEarned: new Set(),
  blackouts: 0, peak: 0, ctxItems: [], log: [], hintsUsed: 0, wrongGuesses: 0, lastEv: null,
  // Loop 3 ("make it stick"): unlocked after the first green run
  greenOnce: false, planned: false, diskFull: false, cleaned: false, verified: false,
  skill: false, hook: false, skillLoop: 0, hookLoop: 0,
});
const sticking = () => S.greenOnce;
const S = fresh();

const noted = type => new Set(S.notes.filter(n => n.type === type).map(n => n.id));
const warned = () => {
  const m = new Map();
  for (const id of noted('lesson')) if (M.lessons[id].warns) m.set(M.lessons[id].warns, M.lessons[id].text);
  return m;
};

// ---------- terminal ----------
const term = () => $('#term-lines');
function line(kind, text, { instant = false } = {}) {
  if (kind === 'cmd' || kind === 'you') return Promise.resolve();
  const el = document.createElement('div');
  el.className = `ln ln-${kind}`;
  const who = { dana: `${M.human} · your teammate`, sys: 'narrator', you: 'Claude', past: 'your notes · CLAUDE.md', cmd: 'Claude ran' }[kind] || '';
  const w = document.createElement('span');
  w.className = 'who';
  w.textContent = who;
  const body = document.createElement('span');
  body.className = 'txt';
  el.append(w, body);
  term().appendChild(el);
  term().scrollTop = term().scrollHeight;
  if (instant || reduced) { body.textContent = text; term().scrollTop = term().scrollHeight; return Promise.resolve(); }
  return new Promise(res => {
    let i = 0;
    const step = () => {
      i = Math.min(text.length, i + 2);
      body.textContent = text.slice(0, i);
      if (i % 6 === 0) sfx.type();
      term().scrollTop = term().scrollHeight;
      if (i < text.length) setTimeout(step, 14); else res();
    };
    step();
  });
}

function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.className = 'toast show';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = 'toast'), 2600);
}

// ---------- Field Guide + levels ----------
const learned = new Set((() => { try { return JSON.parse(localStorage.getItem('cq-learned') || '[]'); } catch (e) { return []; } })());
let pendingTeach = null;
function learn(id) {
  if (!id || learned.has(id) || !BY_ID[id]) return false;
  learned.add(id);
  try { localStorage.setItem('cq-learned', JSON.stringify([...learned])); } catch (e) {}
  renderGuideCount();
  return true;
}
function renderGuideCount() { $('#guide-count').textContent = `${learned.size}/${GUIDE.length}`; }

const LEVELS = {
  1: { name: 'Amnesia', bg: '#070a1f', fog: '#0d1236',
       goal: 'Each day is one Claude session. At 5:00 it ends and Claude forgets everything. You can\u2019t fix it today: ask Claude to find clues, then write 3 notes (its CLAUDE.md) for tomorrow. Click the cards at the bottom to tell Claude what to do.',
       news: [], teaches: [] },
  2: { name: 'The Clone and the Portal', bg: '#2a0636', fog: '#6a1466',
       goal: 'A new session: Claude starts empty again, but reads your 3 notes first. Use them to diagnose, fix and prove it before 5:00 PM.',
       news: ['Claude reads your notes at the start of the session, like CLAUDE.md', 'Send clone: a helper explores and reports back (subagent)', 'Open portal: pull in the ops ticket from outside the repo (MCP)'],
       teaches: ['memory', 'rewind'] },
  3: { name: 'Make It Stick', bg: '#022a20', fog: '#0a6a4e',
       goal: 'Fixing it once was not enough. Fix it, prove it, and set up the repo so the next session cannot get it wrong.',
       news: ['Plan mode: freeze time and choose the route', 'Clean up: a destructive command behind a permission prompt', 'Carve a skill: a procedure every future session follows', 'Set a hook: tests that run themselves'],
       teaches: [] },
};
const level = () => (S.greenOnce ? 3 : S.loop === 1 ? 1 : 2);
let shownLevel = 0;

function applyTheme(lv, animate = true) {
  document.body.dataset.level = lv;
  scene.setTheme && scene.setTheme(LEVELS[lv].bg, LEVELS[lv].fog, animate);
}

function showLevel() {
  const lv = level();
  const L = LEVELS[lv];
  const up = lv !== shownLevel;
  applyTheme(lv);
  $('#lv-tag').textContent = lv === 1 ? 'Level 1 of 3' : up ? `Level up · Level ${lv} of 3` : `Same level · try again (day ${S.loop})`;
  $('#lv-tag').className = 'lv-tag' + (up || lv === 1 ? '' : ' same');
  const pips = $('#lv-pips'); pips.textContent = '';
  for (let i = 1; i <= 3; i++) { const b = document.createElement('i'); if (i <= lv) b.className = 'on'; pips.appendChild(b); }
  $('#lv-title').textContent = L.name;
  $('#lv-goal').textContent = up || lv === 1 ? L.goal : `You did not finish before 5:00 PM, so you are still on Level ${lv}. ${L.goal}`;
  const nw = $('#lv-new'); nw.textContent = '';
  for (const n of up ? L.news : []) { const li = document.createElement('li'); li.textContent = n; nw.appendChild(li); }
  $('#lv-new-wrap').hidden = !nw.children.length;
  const lw = $('#lv-learn'); lw.textContent = '';
  for (const id of L.teaches) if (learn(id)) { const li = document.createElement('li'); li.textContent = `${BY_ID[id].name}: ${BY_ID[id].how}`; lw.appendChild(li); }
  $('#lv-learn-wrap').hidden = !lw.children.length;
  shownLevel = lv;
  $('#lv-go').textContent = lv === 1 ? 'Begin day 1' : `Begin day ${S.loop}`;
  $('#levelup').hidden = false;
  sfx.clue();
  $('#lv-go').focus({ preventScroll: true });
  return new Promise(res => { $('#lv-go').onclick = () => { $('#levelup').hidden = true; res(); }; });
}

function openGuide() {
  const body = $('#g-body'); body.textContent = '';
  $('#g-count').textContent = `${learned.size} of ${GUIDE.length} learned`;
  for (const m of MISSIONS) {
    const sec = document.createElement('section'); sec.className = 'g-mission' + (m.status === 'soon' ? ' soon' : '');
    const h = document.createElement('h4');
    const items = GUIDE.filter(g => g.mission === m.id);
    const got = items.filter(g => learned.has(g.id)).length;
    h.textContent = m.status === 'soon' ? `${m.name} · mission coming soon · ${items.length} concepts` : `${m.name} · ${got} of ${items.length}`;
    const grid = document.createElement('div'); grid.className = 'g-grid';
    for (const g of items) {
      const d = document.createElement('div');
      const has = learned.has(g.id);
      d.className = 'g-item' + (has ? ' got' : m.status === 'soon' ? ' locked' : '');
      const b = document.createElement('b'); b.textContent = g.name;
      const p = document.createElement('span'); p.textContent = has || m.status === 'soon' ? g.what : 'Not met yet. Keep playing to unlock it.';
      d.append(b, p);
      if (has) {
        const how = document.createElement('span'); how.innerHTML = '<span class="r-lbl">How</span>'; how.append(g.how);
        const tr = document.createElement('span'); tr.innerHTML = '<span class="r-lbl">Try it at work</span>'; tr.append(g.tryIt);
        d.append(how, tr);
      }
      grid.appendChild(d);
    }
    sec.append(h, grid);
    body.appendChild(sec);
  }
  $('#guide').hidden = false;
  $('#g-close').focus({ preventScroll: true });
}

// ---------- first-time tour of the Mission 1 screen ----------
const TOUR = [
  { sel: '#hand', t: 'Tell Claude what to do', p: 'Each card is a request you can give Claude. Click one and Claude does it. Each shows its cost: minutes from your 12, and how much it adds to Claude\u2019s context.' },
  { sel: '#clock-wrap', t: 'The clock', p: 'Each day is one Claude session: 12 minutes, from 4:48 to 5:00. At 5:00 the session ends and Claude forgets it all, just as real Claude remembers nothing from yesterday\u2019s chat. Only the 3 notes you write (CLAUDE.md) carry over.' },
  { sel: '.ctxp', t: 'The jar: Claude\u2019s context window', p: 'Everything Claude reads pours into this jar, with its size. Big reads fill it fast. Past 70k Claude slows down; past 100k it blacks out and loses details. In Claude Code, /context shows the same breakdown.' },
  { sel: '.board', t: 'The evidence board', p: 'Clues Claude finds appear here. This is what Claude knows right now, and it is wiped when the session ends.' },
  { sel: '.progress', t: 'Your goal for the day', p: 'Day 1 can\u2019t be won. Find clues and notice which moves waste time. The checklist here updates as you play.' },
  { sel: '.side .term', t: 'Messages', p: 'A running log of the session: Dana\u2019s replies, each command Claude ran (its tool calls) and the narrator. From day 2, this is also where Claude reads your notes (CLAUDE.md) at the start of the session.' },
];
// Once per launch, point at "How to play" for a few seconds so players know the tour can be replayed.
let tourNudged = false;
function nudgeTourBtn() {
  if (tourNudged) return; tourNudged = true;
  const b = $('#tour-btn'); if (!b || !b.offsetParent) return;
  let done = false; try { done = localStorage.getItem('cq-tour-m1') === 'done'; } catch (e) {}
  // Only say "replay" to players who actually went through the whole tour.
  b.dataset.tip = done ? 'Lost? Replay the tour here any time' : 'New here? Take the 1-minute tour';
  b.classList.add('attn');
  const off = () => b.classList.remove('attn');
  setTimeout(off, 4500);
  b.addEventListener('click', off, { once: true });
}

function runTour(force = false) {
  try { if (!force && localStorage.getItem('cq-tour-m1')) return Promise.resolve(); } catch (e) {}
  const box = $('#tour'), ring = $('#tour-ring'), bub = $('#tour-bubble');
  let i = 0;
  return new Promise(res => {
    const end = (done) => { box.hidden = true; window.removeEventListener('resize', place); try { if (done || localStorage.getItem('cq-tour-m1') !== 'done') localStorage.setItem('cq-tour-m1', done ? 'done' : 'skipped'); } catch (e) {} res(); };
    const place = () => {
      const st = TOUR[i];
      const el = document.querySelector(st.sel);
      const r = el.getBoundingClientRect();
      const pad = 6;
      Object.assign(ring.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
      $('#tour-n').textContent = `Quick tour · ${i + 1} of ${TOUR.length}`;
      $('#tour-t').textContent = st.t;
      $('#tour-p').textContent = st.p;
      $('#tour-next').textContent = i + 1 < TOUR.length ? 'Next' : 'Start playing';
      const bw = bub.offsetWidth, bh = bub.offsetHeight, vw = innerWidth, vh = innerHeight;
      let top = r.bottom + 14 + bh < vh ? r.bottom + 14 : r.top - bh - 14;
      if (top < 10) top = Math.min(vh - bh - 10, r.top + 10);
      let left = Math.min(Math.max(10, r.left + r.width / 2 - bw / 2), vw - bw - 10);
      if (r.width > vw * 0.6 && r.height > vh * 0.3) { top = r.top + 20; left = r.left + 20; }
      Object.assign(bub.style, { top: `${top}px`, left: `${left}px` });
    };
    $('#tour-next').onclick = () => { i++; if (i >= TOUR.length) end(true); else place(); };
    $('#tour-skip').onclick = () => end(false);
    window.addEventListener('resize', place);
    box.hidden = false;
    place();
    $('#tour-next').focus({ preventScroll: true });
  });
}

// ---------- HUD ----------
const fmtClock = m => (m >= 60 ? '5:00' : `4:${String(m).padStart(2, '0')}`);

function renderHud() {
  $('#loop-n').textContent = `${level()}/3`;
  $('#lvl-name').textContent = LEVELS[level()].name;
  $('#loop-sub').textContent = `· day ${S.loop}`;
  $('#clock').textContent = fmtClock(S.minute);
  $('#clock-wrap').classList.toggle('urgent', S.minute >= 56 && !S.won);
  $('#mins-left').textContent = `${Math.max(0, M.endMinute - S.minute)} min left`;
  $('#ctx-fill').style.width = Math.min(100, (S.ctx / M.capacity) * 100) + '%';
  $('#ctx-fill').dataset.level = S.ctx > M.rotThreshold ? 'hot' : S.ctx > 45 ? 'warm' : 'calm';
  $('#ctx-num').textContent = `${Math.round(S.ctx)}k / ${M.capacity}k`;
  renderContext();
  $('#ctx-rot').hidden = S.ctx <= M.rotThreshold;
  $('#trust-fill').style.width = S.trust + '%';
  $('#trust-num').textContent = S.trust;

  // case file: steps
  const steps = $('#steps');
  steps.textContent = '';
  const n = S.ev.size;
  const lv = level();
  $('#goal-h').textContent = `Level ${lv} goal · ${LEVELS[lv].name}`;
  $('#goal-lead').textContent = lv === 1
    ? 'You can\u2019t fix it today. Ask Claude to find as many clues as it can before 5:00, and notice which requests waste time.'
    : lv === 2 ? 'Fix the tests and prove it before 5:00 PM.'
    : 'Fix it, prove it, and leave a skill and a hook behind.';
  const rows = lv === 1 ? [
    [n >= 1, `Find your first clue (${n} of 5 found)`],
    [n >= 3, 'Find at least 3 clues'],
    [false, 'At 5:00, write 3 notes for tomorrow\u2019s Claude'],
  ] : sticking() ? [
    [S.usedLoop.has('plan'), 'Plan the route (optional, saves time)'],
    [S.fixed, 'Fix it'],
    [S.verified, 'Prove it with the tests'],
    [S.skill, 'Carve a skill'],
    [S.hook, 'Set a hook'],
  ] : [
    [n >= M.minEvidenceToDiagnose, `Gather evidence (at least ${M.minEvidenceToDiagnose})`],
    [S.diagnosed, 'Diagnose the root cause'],
    [S.fixed, 'Fix it'],
    [S.won, 'Prove it with the tests'],
  ];
  const current = rows.findIndex(r => !r[0]);
  rows.forEach(([done, txt], i) => {
    const li = document.createElement('li');
    li.className = done ? 'done' : i === current ? 'now' : '';
    li.textContent = txt;
    steps.appendChild(li);
  });

  // evidence board: one slot per piece of evidence, filled as you find it
  const box = $('#evidence');
  box.textContent = '';
  const nev = noted('ev');
  for (const id of EV_IDS) {
    const e = M.evidence[id];
    const d = document.createElement('div');
    if (S.ev.has(id)) {
      d.className = 'slot found' + (nev.has(id) ? ' noted' : '');
      const h = document.createElement('div'); h.className = 'slot-h';
      const t = document.createElement('b'); t.textContent = e.title;
      const src = document.createElement('span'); src.textContent = nev.has(id) ? 'from CLAUDE.md' : e.src;
      h.append(t, src);
      const pre = document.createElement('pre'); pre.textContent = e.text;
      d.append(h, pre);
    } else if (S.lost.has(id)) {
      d.className = 'slot lost';
      d.textContent = 'Lost in the blackout';
    } else {
      d.className = 'slot empty';
      const b = document.createElement('b'); b.textContent = '?';
      d.append(b, document.createTextNode('Not found yet'));
    }
    box.appendChild(d);
  }
  $('#board-count').textContent = `${S.ev.size} of ${EV_IDS.length} found`;
}

// ---------- cards ----------
function costOf(c) {
  if (c.id === 'plan') return 0;
  const rot = S.ctx > M.rotThreshold ? 1 : 0;
  return Math.max(1, c.min + rot - (S.planned ? 1 : 0));
}

function cardState(c) {
  if (c.phase === 'stick') {
    if (!sticking()) return 'hidden';
    if (c.id === 'plan') return S.usedLoop.has('plan') ? 'hidden' : 'ready';
    if (c.id === 'clean') return S.diskFull && !S.cleaned ? 'ready' : 'hidden';
    if (c.id === 'skill') return S.skill ? 'hidden' : 'ready';
    if (c.id === 'hook') return S.hook ? 'hidden' : 'ready';
  }
  // once the cause is known, investigation cards have nothing left to give
  if (S.diagnosed && ['tool', 'power', 'trap'].includes(c.kind) && !c.phase) return 'hidden';
  if (c.loop && S.loop < c.loop) return 'locked';
  if (c.needsEv && !c.needsEv.every(e => S.ev.has(e))) return 'hidden';
  if (c.id === 'diagnose') return S.diagnosed ? 'hidden' : S.ev.size >= M.minEvidenceToDiagnose ? 'ready' : 'hidden';
  if (c.id === 'fix') return S.diagnosed && !S.fixed ? 'ready' : 'hidden';
  if (c.id === 'verify') return S.fixed && !S.verified ? 'ready' : 'hidden';
  if (c.id === 'retry' && S.usedLoop.has('retry')) return 'spent';
  if (c.reveal.length && c.reveal.every(r => S.ev.has(r))) return 'known';
  return 'ready';
}

function renderHand() {
  const hand = $('#hand');
  hand.textContent = '';
  const w = warned();
  const rot = S.ctx > M.rotThreshold ? 1 : 0;
  let lockedShown = false;
  for (const c of M.cards) {
    const st = cardState(c);
    // Keep every playable option on screen: drop cards with nothing left to give, merge locked ones.
    if (st === 'hidden' || st === 'known' || st === 'spent') continue;
    if (st === 'locked') {
      if (lockedShown || c.phase) continue;
      lockedShown = true;
      const n = M.cards.filter(x => !x.phase && cardState(x) === 'locked').length;
      const b = document.createElement('div');
      b.className = 'card s-locked';
      b.innerHTML = '<span class="kind">locked</span><span class="name"></span><span class="target">Unlocks on day 2.</span>';
      b.querySelector('.name').textContent = `${n} new features`;
      hand.appendChild(b);
      continue;
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.id = `card-${c.id}`;
    b.className = `card k-${c.kind} s-${st}`;
    b.innerHTML = `<span class="try">Try this</span><span class="kind"></span><span class="name"></span><span class="target"></span>
      <span class="blurb"></span><span class="warn" hidden></span><span class="cost"><i class="c-min"></i><i class="c-tok"></i></span>`;
    const kindLabel = { power: 'Claude feature', fix: 'ask Claude to', think: 'ask Claude to', trap: 'ask Claude to', tool: 'ask Claude to' }[c.kind];
    b.querySelector('.kind').textContent = st === 'known' ? 'already found' : st === 'spent' ? 'used' : kindLabel;
    b.querySelector('.name').textContent = c.name;
    b.querySelector('.target').textContent = c.target;
    b.querySelector('.blurb').textContent = c.blurb;
    b.title = c.blurb;
    b.querySelector('.c-min').textContent = c.id === 'plan' ? 'time frozen' : `${costOf(c)} min`;
    b.querySelector('.c-tok').textContent = `+${c.tok}k context`;
    if (w.has(c.id)) {
      const wn = b.querySelector('.warn');
      wn.hidden = false;
      wn.textContent = `Your note: ${w.get(c.id)}`;
    }
    if (st === 'spent') b.disabled = true;
    b.addEventListener('click', () => play(c, b));
    hand.appendChild(b);
  }
  hand.classList.toggle('busy', S.busy);
  renderObjective();
}

// ---------- objective: what to do next, with hints only if the player hesitates ----------
function objective() {
  const has = id => S.ev.has(id);
  const l1 = S.loop === 1;
  if (sticking()) {
    if (!S.usedLoop.has('plan') && !S.verified) return { step: 'Plan', text: 'This time the fix must stick. Plan the whole route first.', hint: 'Plan mode freezes the clock. A good plan makes every action faster.', card: 'plan' };
    if (S.diagnosed && !S.fixed) return { step: 'Fix it', text: 'Apply the fix you know works.', hint: 'Freeze the clock in UTC inside the fixture.', card: 'fix' };
    if (S.fixed && !S.verified && S.diskFull && !S.cleaned) return { step: 'Clear the way', text: 'The disk is full. Free space so the tests can run.', hint: 'You will need permission. Give the smallest one that works.', card: 'clean' };
    if (S.fixed && !S.verified) return { step: 'Prove it', text: 'Run the tests.', hint: 'Evidence first, then the rest.', card: 'verify' };
    if (S.verified && !S.skill) return { step: 'Make it stick', text: 'Teach every future session how to triage this.', hint: 'Carve a skill with concrete steps.', card: 'skill' };
    if (S.verified && !S.hook) return { step: 'Make it stick', text: 'Make the tests run on their own after every change.', hint: 'Set a hook on the right event.', card: 'hook' };
    if (!S.diagnosed && S.ev.size < M.minEvidenceToDiagnose) return { step: 'Investigate', text: 'Claude forgot the cause. Find the evidence again, fast.', hint: 'The clone and the portal are quick.', card: 'clone' };
    if (!S.diagnosed) return { step: 'Diagnose', text: 'Explain why it fails.', hint: 'Morning, 17:00, UTC.', card: 'diagnose' };
  }
  if (S.fixed) return { step: 'Prove it', text: 'Show that your fix works before you tell Dana.', hint: 'Claims need evidence. What would prove it?', card: 'verify' };
  if (S.diagnosed) return { step: 'Fix it', text: 'Choose a fix that works at any hour.', hint: 'A fix that hides the failure is not a fix.', card: 'fix' };
  if (S.ev.size < M.minEvidenceToDiagnose) {
    if (!has('fail')) return { step: 'Investigate', text: 'Start by finding out exactly what is failing.', hint: l1 ? 'Failures are recorded in the CI log. You do not need all 60,000 lines of it.' : 'The clone (a subagent) can investigate the code in its own context.', card: l1 ? 'grep' : 'clone' };
    return { step: 'Investigate', text: 'One failure. Now find out what makes it fail.', hint: 'The person who asked often knows when it started. Or look at the code the test depends on.', card: 'ask' };
  }
  if (!has('morning')) return { step: 'Investigate or diagnose', text: 'Do you know enough to explain the failure?', hint: 'Dana knows something the logs do not. When did it start?', card: 'ask' };
  if (!has('fixture')) return { step: 'Investigate or diagnose', text: 'Green this morning, red now. What depends on the time?', hint: 'The failure names a fixture. Where does it build the promo?', card: l1 ? 'conftest' : 'clone' };
  if (!has('utc')) return { step: 'Investigate or diagnose', text: 'Something about time breaks this test. What clock is CI using?', hint: l1 ? 'The full log header says how the runner is set up. It is expensive to read.' : 'The answer may be in a ticket, not in the code.', card: l1 ? 'readLog' : 'portal' };
  return { step: 'Diagnose', text: 'You have the evidence. Explain why it fails.', hint: 'Read your evidence top to bottom. Morning, 17:00, UTC.', card: 'diagnose' };
}

const hintTimers = {};
function clearHints() { clearTimeout(hintTimers.a); clearTimeout(hintTimers.b); }
function renderObjective() {
  const o = objective();
  $('#obj-step').textContent = o.step;
  $('#obj-text').textContent = o.text;
  $('#obj-hint').textContent = o.hint;
  document.querySelectorAll('.card.suggest').forEach(c => c.classList.remove('suggest'));
  clearHints();
  const box = $('#objective');
  box.classList.remove('hinted');
  if (S.busy || S.won) return;
  hintTimers.a = setTimeout(() => box.classList.add('hinted'), HINT_TEXT_MS);
  hintTimers.b = setTimeout(() => {
    const el = document.getElementById(`card-${o.card}`);
    if (el && !el.disabled && !S.busy) { el.classList.add('suggest'); S.hintsUsed++; }
  }, HINT_CARD_MS);
}

// ---------- modals ----------
function showResult({ title, concept, body, ev = [], found = [], lesson, cmd, cost, nothing, tone = '', teach }) {
  const box = $('#result');
  const tid = teach || pendingTeach;
  pendingTeach = null;
  const fresh = learn(tid);
  $('#r-teach').hidden = !fresh;
  if (fresh) {
    const g = BY_ID[tid];
    $('#r-teach-name').textContent = g.name;
    $('#r-teach-what').textContent = g.what;
    $('#r-teach-how').textContent = g.how;
    $('#r-teach-try').textContent = g.tryIt;
    sfx.clue();
  }
  box.className = `result ${tone}`;
  $('#r-concept').textContent = concept || '';
  $('#r-concept').hidden = !concept;
  $('#r-title').textContent = title;
  $('#r-cost').textContent = cost || '';
  $('#r-body').textContent = body || '';
  $('#r-body').hidden = !body;
  const f = $('#r-found');
  f.textContent = '';
  for (const id of ev) {
    const li = document.createElement('li');
    const h = document.createElement('b'); h.textContent = `New evidence · ${M.evidence[id].src}`;
    const pre = document.createElement('pre'); pre.textContent = M.evidence[id].text;
    li.append(h, pre);
    f.appendChild(li);
  }
  for (const x of found) { const li = document.createElement('li'); li.textContent = x; f.appendChild(li); }
  if (nothing) { const li = document.createElement('li'); li.className = 'none'; li.textContent = nothing; f.appendChild(li); }
  f.hidden = !f.children.length;
  $('#r-lesson').textContent = lesson || '';
  $('#r-lesson-wrap').hidden = !lesson || fresh;
  $('#r-cmd').textContent = cmd || '';
  $('#r-cmd-wrap').hidden = !cmd;
  box.hidden = false;
  $('#r-ok').focus({ preventScroll: true });
  return new Promise(res => { $('#r-ok').onclick = () => { box.hidden = true; res(); }; });
}

function showChoice(spec) {
  const box = $('#choice');
  $('#c-title').textContent = spec.question;
  const evBox = $('#c-evidence');
  evBox.textContent = '';
  for (const id of EV_IDS) {
    if (!S.ev.has(id)) continue;
    const d = document.createElement('div');
    d.className = 'c-ev';
    const b = document.createElement('b'); b.textContent = M.evidence[id].src;
    const pre = document.createElement('pre'); pre.textContent = M.evidence[id].text;
    d.append(b, pre);
    evBox.appendChild(d);
  }
  evBox.closest('.c-evwrap').hidden = !evBox.children.length;
  $('#choice').classList.toggle('no-ev', !evBox.children.length);
  const nudge = $('#c-nudge');
  nudge.textContent = `Hint: ${spec.nudge}`;
  nudge.hidden = true;
  const t = setTimeout(() => { nudge.hidden = false; S.hintsUsed++; }, CHOICE_NUDGE_MS);
  const opts = $('#c-options');
  opts.textContent = '';
  box.hidden = false;
  return new Promise(res => {
    const shuffled = [...spec.options].sort(() => Math.random() - 0.5);
    shuffled.forEach((o, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'c-opt';
      const k = document.createElement('span'); k.className = 'c-key'; k.textContent = 'ABCD'[i];
      const tx = document.createElement('span'); tx.textContent = o.text;
      b.append(k, tx);
      b.onclick = () => { clearTimeout(t); box.hidden = true; res(o); };
      opts.appendChild(b);
    });
    opts.firstChild.focus({ preventScroll: true });
  });
}

const PRIMER = [
  { t: 'You ask. Claude does the work.', p: 'Claude Code is an AI assistant that runs in your terminal. You type a request in plain English. Claude decides the steps, then <b>reads files, runs commands and edits code</b> for you. Each of those steps is called a <b>tool call</b>.' },
  { t: 'Everything it reads fills its context.', p: 'Claude&rsquo;s <b>context window</b> is its working memory for this session: your messages plus everything it has read. It has a size limit, measured in <b>tokens</b> (pieces of words). A quick search adds a little. Reading a whole log adds a lot. When it gets too full, Claude slows down, and older details get squashed into a summary.' },
  { t: 'A new session starts with no memory.', p: 'When a session ends, Claude <b>forgets all of it</b>. Tomorrow&rsquo;s session knows nothing about today. The fix is a file called <b>CLAUDE.md</b> in your project: Claude reads it at the start of every session, so anything written there carries over.' },
  { t: 'It can sound sure and still be wrong.', p: 'Claude writes the most likely-sounding answer. Usually that&rsquo;s right, but sometimes a confident answer is wrong. That&rsquo;s called a <b>hallucination</b>. Your job is to ask for <b>proof</b>: run the tests, show the output.' },
  { t: 'That\u2019s all you need for this game.', p: 'You play the <b>developer</b>. Each card is a request you give Claude. Watch its context jar fill. When the day (the session) ends, write the 3 notes Claude will need tomorrow.' },
];
function showPrimer() {
  return new Promise(res => {
    let i = 0;
    const box = $('#primer');
    const draw = () => {
      $('#pr-n').textContent = `${i + 1} of ${PRIMER.length}`;
      $('#pr-t').textContent = PRIMER[i].t;
      $('#pr-p').innerHTML = PRIMER[i].p;   // static text written in this file
      box.querySelectorAll('.pr-scene').forEach(sc => sc.classList.toggle('on', Number(sc.dataset.s) === i + 1));
      $('#pr-back').hidden = i === 0;
      $('#pr-next').textContent = i + 1 < PRIMER.length ? 'Next' : 'Got it';
    };
    const end = () => { box.hidden = true; try { localStorage.setItem('cq-primer', '1'); } catch (e) {} res(); };
    $('#pr-next').onclick = () => { if (++i >= PRIMER.length) end(); else draw(); };
    $('#pr-back').onclick = () => { if (i > 0) { i--; draw(); } };
    $('#pr-skip').onclick = end;
    box.hidden = false; draw();
    $('#pr-next').focus({ preventScroll: true });
  });
}
const primerSeen = () => { try { return !!localStorage.getItem('cq-primer'); } catch (e) { return false; } };

function showBrief() {
  return new Promise(res => {
    $('#brief').hidden = false;
    $('#brief-go').focus({ preventScroll: true });
    $('#brief-go').onclick = () => { $('#brief').hidden = true; res(); };
  });
}

// ---------- playing a card ----------
async function play(c, el) {
  if (S.busy || S.won) return;
  S.busy = true;
  clearHints();
  $('#hand').classList.add('busy');
  sfx.card();
  el.classList.add('played');

  pendingTeach = CARD_TEACHES[c.id] || null;
  const rot = S.ctx > M.rotThreshold ? 1 : 0;
  const cost = costOf(c);
  S.used.add(c.id); S.usedLoop.add(c.id);
  if (c.cmd && c.id !== 'verify') { S.log.push(c.cmd); line('cmd', c.cmd, { instant: true }); }
  if (rot) line('sys', 'Claude\u2019s context is past 70%. It is slower: +1 minute.', { instant: true });

  if (c.id === 'clone') scene.sendClone('tests/conftest.py');
  if (c.id === 'portal') { sfx.portal(); scene.openPortal(); }
  if (c.id === 'readLog' || c.id === 'readRepo') sfx.pour();

  await advanceClock(cost);
  addContext(c.tok, `${c.name} ${c.target}`);
  bumpContext(c.tok);
  await scene.setLevel(Math.min(1.05, S.ctx / M.capacity), { pour: c.tok >= 10 });
  if (c.id === 'clone' || c.id === 'portal') await wait(reduced ? 0 : 1400);
  renderHud();

  if (S.ctx > M.capacity) await blackout();
  else if (c.id === 'retry') await hallucinate();
  else if (c.id === 'diagnose') await diagnose();
  else if (c.id === 'fix') await chooseFix();
  else if (c.id === 'plan') await planMode();
  else if (c.id === 'clean') await permissionGate();
  else if (c.id === 'skill') await carveSkill();
  else if (c.id === 'hook') await setHook();
  else if (c.id === 'verify') {
    if (sticking() && !S.cleaned) {
      S.diskFull = true;
      S.log.push('Bash(pytest tests/test_checkout.py)  ✗ OSError: No space left on device');
      sfx.glitch(); scene.shake(0.4);
      await showResult({ title: 'The tests cannot even start', concept: 'Permissions', tone: 'bad',
        body: 'OSError: No space left on device. The runner disk is full: test-results/ has grown to 40 GB, one batch of reports from every loop you lived through.',
        found: ['New card: Clean up test-results/'], cost: `${cost} min · +${c.tok}k context` });
    } else {
      S.log.push(c.cmd);
      await showResult({ title: 'Run the tests', concept: c.concept, body: '14 passed. CI is green.', cmd: c.cmd, lesson: c.lesson, cost: `${cost} min · +${c.tok}k context` });
      if (!sticking()) { await win(); return; }
      S.verified = true;
    }
  } else {
    const got = [];
    for (const r of c.reveal) if (!S.ev.has(r)) { S.ev.add(r); S.lost.delete(r); got.push(r); }
    if (got.length) { sfx.clue(); S.lastEv = got[got.length - 1]; }
    if (c.id === 'ask') line('dana', M.evidence.morning.text, { instant: true });
    if (got.includes('fail')) scene.pulseTower('ci.log');
    if (got.includes('fixture')) scene.pulseTower('tests/conftest.py');
    if (got.includes('active')) scene.pulseTower('checkout.py');
    renderHud();
    await showResult({
      title: `${c.name}: ${c.target}`, concept: c.concept, ev: got, cmd: c.cmd, lesson: c.lesson,
      cost: `${cost} min · +${c.tok}k context`,
      nothing: c.reveal.length && !got.length ? 'Nothing new. You already had this.' : '',
    });
  }

  renderHud();
  S.busy = false;
  if (sticking() && S.verified && S.skill && S.hook) { await win(); return; }
  if (S.minute >= M.endMinute) { await collapse(); return; }
  renderHand();
}

const CX_COLORS = ['#7fe3ff', '#b49cff', '#7cf0a8', '#ffb547', '#ff8fd8', '#9fb4ff', '#ffd86b', '#6ee7d8'];
function addContext(tok, label) {
  S.ctx += tok; S.peak = Math.max(S.peak, S.ctx);
  if (label) S.ctxItems.push({ label, tok, c: CX_COLORS[S.ctxItems.length % CX_COLORS.length], fresh: true });
}
function renderContext() {
  const box = document.querySelector('.ctxp');
  if (!box) return;
  box.dataset.level = S.ctx > M.rotThreshold ? 'hot' : S.ctx > 45 ? 'warm' : 'calm';
  $('#cx-used').textContent = `${Math.round(S.ctx)}k`;
  const segs = $('#cx-segs'), list = $('#cx-list');
  segs.textContent = ''; list.textContent = '';
  for (const it of S.ctxItems) {
    const seg = document.createElement('div');
    seg.className = 'cx-seg' + (it.fresh ? ' new' : '');
    seg.style.background = it.c;
    seg.style.height = Math.min(100, (it.tok / M.capacity) * 100) + '%';
    seg.title = `${it.label}: ${it.tok}k`;
    segs.appendChild(seg);
    const li = document.createElement('li');
    li.className = (it.fresh ? 'new ' : '') + (it.tok >= 40 ? 'big' : '');
    const sw = document.createElement('i'); sw.style.background = it.c;
    const tx = document.createElement('span'); tx.textContent = it.label;
    const n = document.createElement('b'); n.textContent = `${it.tok}k`;
    li.append(sw, tx, n);
    list.appendChild(li);
    it.fresh = false;
  }
  const free = Math.max(0, M.capacity - Math.round(S.ctx));
  $('#cx-bar').style.setProperty('--fill', `${Math.min(100, (S.ctx / M.capacity) * 100) * 2}px`);
  $('#cx-free').textContent = free ? `${free}k free before blackout` : 'Full: blackout';
}
function bumpContext(tok, label) {
  const box = document.querySelector('.ctxp');
  const target = box && box.offsetParent ? box : $('#ctx-num');
  if (!target) return;
  const r = target.getBoundingClientRect();
  const b = document.createElement('div');
  b.className = 'cx-bump' + (tok >= 40 ? ' big' : '');
  b.textContent = `+${tok}k`;
  b.style.left = `${r.left + 16}px`; b.style.top = `${r.top + (box && box.offsetParent ? 40 : 18)}px`;
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 1500);
  const pour = $('#cx-pour');
  if (pour) { const last = S.ctxItems[S.ctxItems.length - 1]; pour.style.background = last ? last.c : 'var(--token)'; pour.classList.remove('go'); void pour.offsetWidth; pour.classList.add('go'); }
  if (box) { box.classList.add('flash'); setTimeout(() => box.classList.remove('flash'), 700); }
}

async function advanceClock(cost) {
  const target = Math.min(M.endMinute, S.minute + cost);
  for (let m = S.minute + 1; m <= target; m++) {
    S.minute = m;
    sfx.tick(m >= 56);
    renderHud();
    scene.setClock(m);
    scene.setUrgent(m >= 56);
    await wait(reduced ? 60 : 180);
  }
}

async function diagnose() {
  const o = await showChoice(M.diagnosis);
  if (o.correct) {
    S.diagnosed = true;
    sfx.clue();
    S.log.push(`# diagnosis: ${o.text}`);
    line('you', `Diagnosis: ${o.text}`, { instant: true });
    renderHud();
    await showResult({ title: 'Diagnosis confirmed', concept: 'Reasoning from evidence', body: o.why,
      lesson: 'Asking Claude to explain the root cause before editing anything catches wrong guesses early.' });
  } else {
    S.wrongGuesses++;
    S.trust = Math.max(0, S.trust - 10);
    sfx.glitch(); scene.shake(0.5);
    S.log.push(`# wrong diagnosis: ${o.text}`);
    line('dana', 'hm, are you sure? that does not match what I am seeing', { instant: true });
    await advanceClock(1);
    renderHud();
    await showResult({ title: 'That does not fit the evidence', concept: 'Hallucination', tone: 'bad', body: o.why,
      found: ['Trust -10 · 1 extra minute'],
      lesson: 'A confident explanation that ignores the evidence is a hallucination. Make Claude cite the lines that support its claim.' });
  }
}

async function chooseFix() {
  const o = await showChoice(M.fix);
  if (o.correct) {
    S.fixed = true;
    S.log.push('Edit(tests/conftest.py: freeze_time(UTC); expires = now + 1 day)');
    line('cmd', 'Edit(tests/conftest.py: freeze_time(UTC); expires = now + 1 day)', { instant: true });
    renderHud();
    await showResult({ title: 'Fixture patched', concept: 'Reviewing changes', body: o.why + ' But you have not proved it yet.',
      cmd: 'Edit(tests/conftest.py: freeze_time(UTC); expires = now + 1 day)' });
    return;
  }
  S.trust = Math.max(0, S.trust - (o.bad || 0));
  if (o.lesson) S.lessonsEarned.add(o.lesson);
  if (o.cost) await advanceClock(o.cost);
  S.log.push(`# rejected fix: ${o.text}`);
  if (o.bad) { sfx.glitch(); scene.shake(0.6); document.body.classList.add('glitch'); setTimeout(() => document.body.classList.remove('glitch'), 900); }
  line('dana', o.bad ? 'wait, you changed the TEST? that is not a fix' : 'infra says maybe tomorrow', { instant: true });
  renderHud();
  await showResult({ title: o.bad ? 'Dana rejects your change' : 'That will not happen today', concept: o.bad ? 'Reviewing changes' : 'Scope', tone: o.bad ? 'bad' : '',
    body: o.why, found: o.bad ? [`Trust -${o.bad}`] : [`${o.cost} minutes lost`] });
}

async function planMode() {
  document.body.classList.add('frozen');
  line('sys', 'Plan mode. The clock stops. Claude can look, but not touch.', { instant: true });
  const o = await showChoice(M.plan);
  document.body.classList.remove('frozen');
  if (o.correct) {
    S.planned = true; S.diskFull = true;
    S.log.push('# plan mode: plan approved (check runner, clean with permission, fix, test, skill, hook)');
    sfx.clue();
    renderHud();
    await showResult({ title: 'Plan approved', concept: 'Plan mode', body: o.why,
      found: ['Every action costs 1 minute less this loop', 'Found: the runner disk is full'],
      lesson: 'In Claude Code, Shift+Tab enters plan mode: Claude reads and proposes, you approve, then it edits.',
      cmd: 'ExitPlanMode(plan)  # approved by you' });
  } else {
    S.wrongGuesses++;
    S.trust = Math.max(0, S.trust - 5);
    await advanceClock(1);
    S.log.push(`# plan mode: rejected plan (${o.id})`);
    sfx.glitch();
    renderHud();
    await showResult({ title: 'You would not approve that plan', concept: 'Plan mode', tone: 'bad', body: o.why,
      found: ['Trust -5 · 1 minute lost · no time bonus'],
      lesson: 'Reviewing the plan before any edit is the cheapest moment to catch a bad idea.' });
  }
}

async function permissionGate() {
  document.body.classList.add('forcefield');
  scene.forceField && scene.forceField(true);
  sfx.glitch();
  const o = await showChoice(M.permission);
  document.body.classList.remove('forcefield');
  scene.forceField && scene.forceField(false);
  if (o.correct || o.cleans) {
    S.cleaned = true;
    S.diskFull = false;
    S.log.push(`Bash(rm -rf test-results/)  # permission: ${o.id === 'once' ? 'allowed once' : o.id}`);
  }
  if (o.bad) { S.trust = Math.max(0, S.trust - o.bad); S.lessonsEarned.add('perm'); sfx.glitch(); scene.shake(0.5); }
  if (o.cost) await advanceClock(o.cost);
  renderHud();
  await showResult({
    title: o.correct ? 'Allowed once. Disk cleaned.' : o.cleans ? 'Cleaned, but at a cost' : 'Denied',
    concept: 'Permissions', tone: o.correct ? '' : 'bad', body: o.why,
    found: o.bad ? [`Trust -${o.bad}`] : o.cost ? [`${o.cost} minute lost`] : ['40 GB freed'],
    lesson: 'Claude Code asks before risky commands. Approve them once; keep allow-lists for safe, read-only commands.',
    cmd: o.correct || o.cleans ? 'Bash(rm -rf test-results/)' : '',
  });
}

async function carveSkill() {
  const o = await showChoice(M.skillSpec);
  if (o.correct) {
    S.skill = true; S.skillLoop = S.loop;
    S.log.push('Write(.claude/skills/triage-failing-test/SKILL.md)');
    sfx.clue();
    renderHud();
    await showResult({ title: 'Skill carved: triage-failing-test', concept: 'Skills', body: o.why + ' Like your notes, skills are files, so this one survives the loop.',
      cmd: 'Write(.claude/skills/triage-failing-test/SKILL.md)', lesson: 'Claude loads a skill when a task matches its description. Write one for any procedure you explain more than twice.' });
  } else {
    S.trust = Math.max(0, S.trust - (o.bad || 0));
    await advanceClock(1);
    sfx.glitch();
    renderHud();
    await showResult({ title: 'That skill would make things worse', concept: 'Skills', tone: 'bad', body: o.why, found: [`Trust -${o.bad} · 1 minute lost`] });
  }
}

async function setHook() {
  const o = await showChoice(M.hookSpec);
  if (o.correct) {
    S.hook = true; S.hookLoop = S.loop;
    S.log.push('Edit(.claude/settings.json: hooks.PostToolUse Edit|Write → pytest)');
    sfx.clue();
    renderHud();
    await showResult({ title: 'Hook set: tests run after every edit', concept: 'Hooks', body: o.why + ' The hook lives in settings.json, so it survives the loop too.',
      cmd: 'Edit(.claude/settings.json: hooks.PostToolUse)', lesson: 'Hooks are run by Claude Code itself, not by Claude remembering. Use them for checks that must never be skipped.' });
  } else {
    if (o.bad) S.trust = Math.max(0, S.trust - o.bad);
    await advanceClock(o.cost || 1);
    sfx.glitch();
    renderHud();
    await showResult({ title: 'Wrong trigger', concept: 'Hooks', tone: 'bad', body: o.why,
      found: [o.bad ? `Trust -${o.bad}` : '', `${o.cost || 1} minute lost`].filter(Boolean) });
  }
}

async function blackout() {
  pendingTeach = 'compaction';
  sfx.blackout();
  scene.shake(1.2);
  document.body.classList.add('blackout');
  const keep = noted('ev');
  const lostNow = [...S.ev].filter(id => !keep.has(id));
  await scene.blackout(0.3);
  lostNow.forEach(id => { S.ev.delete(id); S.lost.add(id); });
  S.ctx = 30; S.blackouts++;
  S.ctxItems = [{ label: 'Compacted summary (details lost)', tok: 30, c: '#ff6b6b', fresh: true }];
  await advanceClock(1);
  document.body.classList.remove('blackout');
  S.log.push('# context full: auto-compacted. Details summarized away.');
  line('sys', 'BLACKOUT. Claude\u2019s context overflowed and was compacted.', { instant: true });
  renderHud();
  await showResult({
    title: 'Blackout: Claude\u2019s context overflowed', concept: 'Compaction', tone: 'bad',
    body: 'Claude tried to hold more than its context window allows. Everything was squashed into a short summary and the details were lost.' +
      (keep.size ? ' Evidence from your CLAUDE.md notes survived, because memory files are re-read after compaction.' : ''),
    found: lostNow.map(id => `Lost: ${M.evidence[id].title}`),
    lesson: 'Claude Code sessions do the same when they fill up. Search and use subagents instead of reading everything.',
    cmd: 'auto-compact  # context limit reached',
  });
}

async function hallucinate() {
  sfx.glitch();
  scene.shake(0.9);
  document.body.classList.add('glitch');
  setTimeout(() => document.body.classList.remove('glitch'), 900);
  S.trust = Math.max(0, S.trust - 30);
  S.lessonsEarned.add('retry');
  line('dana', 'still red?? it failed 3 times in a row now instead of once. did you actually run it?', { instant: true });
  renderHud();
  await showResult({
    title: 'Dana: "still red?? did you actually run it?"', concept: 'Hallucination', tone: 'bad',
    body: 'The failure happens every time, so retrying just fails three times. Claude said it was fixed without any evidence, and you passed that on to Dana.',
    found: ['Trust -30'],
    lesson: 'A confident "fixed" with no test output is a hallucination. Always ask Claude to show the passing run.',
    cmd: 'Edit(@retry(3))  # never ran the tests',
  });
}

// ---------- loop lifecycle ----------
async function startLoop() {
  S.ctxItems = [{ label: S.loop > 1 ? 'Start: system prompt, Dana\u2019s request, your notes' : 'Start: system prompt and Dana\u2019s request', tok: M.baseContext, c: '#5c6a9e' }];
  S.minute = M.startMinute; S.ctx = M.baseContext; S.fixed = false; S.lastEv = null;
  S.ev = new Set(noted('ev')); S.lost = new Set(); S.usedLoop = new Set(); S.log = [];
  S.diagnosed = noted('diag').size > 0;
  S.planned = false; S.diskFull = false; S.cleaned = false; S.verified = false;
  S.busy = true;
  term().textContent = '';
  scene.setClock(S.minute, false);
  scene.setUrgent(false);
  scene.setLevel(S.ctx / M.capacity);
  renderHud(); renderHand();
  $('#hand').classList.add('busy');
  await showLevel();
  if (S.loop === 1) { await runTour(); nudgeTourBtn(); }

  if (S.loop === 1) {
    await line('sys', '4:48 PM. You open a new Claude Code session. Claude knows nothing yet: every session starts empty. Your job is to tell it what to look at.');
  } else {
    await line('sys', `4:48 PM. Again. Day ${S.loop} is a brand-new Claude session: everything Claude read yesterday is gone. It reads your notes first, the way it reads CLAUDE.md.`);
    S.log.push(`Read(CLAUDE.md)  # ${S.notes.length + (S.freeNote ? 1 : 0)} notes you wrote`);
    line('cmd', 'Read(CLAUDE.md)', { instant: true });
    for (const n of S.notes) await line('past', noteText(n));
    if (S.freeNote) await line('past', S.freeNote);
    if (S.loop === 2) await line('sys', 'Two new Claude features unlocked: Send clone (a subagent) and Open portal (an MCP connector).');
    if (sticking() && !S.stickIntroDone) {
      S.stickIntroDone = true;
      await line('sys', 'New Claude features: Plan mode, Carve a skill, Set a hook. The fix only counts if the next session cannot get it wrong.');
    }
    if (S.skill || S.hook) await line('past', `Still here from earlier loops: ${[S.skill && 'your skill', S.hook && 'your hook'].filter(Boolean).join(' and ')}.`);
  }
  await line('dana', M.request);
  S.busy = false;
  renderHud();
  renderHand();
}

function noteText(n) {
  if (n.type === 'ev') return `${M.evidence[n.id].title}: ${M.evidence[n.id].text.split('\n')[0]}`;
  if (n.type === 'diag') return `Root cause: ${M.diagnosis.options.find(o => o.correct).text}`;
  return M.lessons[n.id].text;
}

async function collapse() {
  S.busy = true;
  clearHints();
  renderHand();
  await line('sys', '5:00 PM. The release is missed. The loop collapses.');
  await wait(600);
  sfx.rewind();
  document.body.classList.add('rewinding');
  await scene.rewind();
  document.body.classList.remove('rewinding');
  showEtch();
}

// ---------- memory etching ----------
function showEtch() {
  const box = $('#etch-options');
  box.textContent = '';
  const chosen = new Set(S.notes.map(n => `${n.type}:${n.id}`));
  const opts = [];
  if (S.diagnosed) opts.push({ type: 'diag', id: 'tz', tag: 'root cause', text: M.diagnosis.options.find(o => o.correct).text });
  for (const id of EV_IDS) {
    if (S.ev.has(id)) opts.push({ type: 'ev', id, tag: 'evidence', text: noteText({ type: 'ev', id }) });
    else if (S.lost.has(id)) opts.push({ type: 'ev', id, tag: 'lost', text: 'Claude knew something here, but the blackout took it.', disabled: true });
  }
  const lessons = new Set(S.lessonsEarned);
  if (S.used.has('readLog')) lessons.add('grep');
  if (S.used.has('readRepo')) lessons.add('repo');
  if (S.used.has('ask')) lessons.add('ask');
  if (!lessons.size) lessons.add('grep');
  for (const id of lessons) opts.push({ type: 'lesson', id, tag: 'lesson', text: M.lessons[id].text });

  for (const o of opts) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `tablet t-${o.tag.replace(' ', '-')}`;
    b.disabled = !!o.disabled;
    b.id = `tab-${o.type}-${o.id}`;
    const tg = document.createElement('span'); tg.className = 'tag'; tg.textContent = o.tag;
    const tt = document.createElement('span'); tt.className = 'tt'; tt.textContent = o.text;
    b.append(tg, tt);
    const key = `${o.type}:${o.id}`;
    if (chosen.has(key)) b.classList.add('on');
    b.addEventListener('click', () => {
      if (b.classList.contains('on')) { b.classList.remove('on'); chosen.delete(key); }
      else if (chosen.size < 3) { b.classList.add('on'); chosen.add(key); sfx.clue(); }
      else toast('Only 3 notes survive a loop. Remove one first.');
      $('#etch-count').textContent = `${chosen.size} / 3 kept`;
    });
    box.appendChild(b);
  }
  $('#etch-count').textContent = `${chosen.size} / 3 kept`;
  $('#etch-free').value = S.freeNote;
  $('#etch-loop').textContent = S.loop;
  $('#etch').hidden = false;
  $('#etch-go').onclick = () => {
    S.notes = [...chosen].map(k => { const [type, id] = k.split(':'); return { type, id }; });
    S.freeNote = $('#etch-free').value.trim().slice(0, 140);
    $('#etch').hidden = true;
    S.loop++;
    startLoop();
  };
}

// ---------- win + mirror ----------
async function falseDawn() {
  S.busy = true;
  clearHints();
  renderHand();
  line('dana', 'GREEN!! ok shipping', { instant: true });
  sfx.win();
  await (scene.falseDawn ? scene.falseDawn() : wait(1500));
  sfx.glitch();
  document.body.classList.add('glitch');
  setTimeout(() => document.body.classList.remove('glitch'), 900);
  await showResult({
    title: 'Tests green. Level 2 done!', concept: 'Level 2 complete', tone: 'good',
    body: 'You fixed the bug and proved it with the tests. Nice work. So why does release day start again? ' +
      'Because the fix is saved in the code, but the know-how is not. It took Claude two sessions and your notes to find the right route. ' +
      'Next week, when a new Claude session meets a failing test like this one, it starts from zero again and may reach for @retry, the wrong fix, all over again. ' +
      'Level 3 is about making the lesson stick for every future session, not just today.',
    found: ['Level 3 unlocks: Plan mode, Skills (the steps to follow) and Hooks (tests that run automatically after every edit)'],
    lesson: 'At work: when you and Claude solve something the hard way, save how you did it (CLAUDE.md, a skill, a hook), so the next session gets it right first time.',
  });
  S.greenOnce = true;
  S.lessonsEarned.add('plan');
  sfx.rewind();
  document.body.classList.add('rewinding');
  await scene.rewind();
  document.body.classList.remove('rewinding');
  showEtch();
}

async function win() {
  if (!S.greenOnce) { await falseDawn(); return; }
  S.won = true;
  clearHints();
  renderHud();
  renderHand();
  line('dana', 'GREEN. shipping it. how did you even find that', { instant: true });
  sfx.win();
  document.body.classList.add('dawn');
  await scene.sunrise();
  await line('sys', 'The clock moves past 5:00 PM for the first time. The loop is broken.');
  await wait(reduced ? 200 : 1200);
  markDone('m1');
  const q = await runQuiz('m1', 'post');
  showMirror(q);
}

function buildClaudeMd() {
  const known = S.notes.filter(n => n.type !== 'lesson').map(n => `- ${noteText(n)}`);
  const lessons = S.notes.filter(n => n.type === 'lesson').map(n => `- ${M.lessons[n.id].text}`);
  if (S.freeNote) lessons.push(`- ${S.freeNote}`);
  return [
    '# CLAUDE.md',
    '',
    'Project memory for the checkout service. Claude reads this at the start of every session.',
    '',
    '## Known issues',
    ...(known.length ? known : ['- (none carried yet)']),
    '- Verified fix: tests/conftest.py promo_today freezes the clock in UTC and sets expiry to now + 1 day.',
    '',
    '## How to work in this repo',
    ...lessons,
    '- Search logs with grep for FAIL instead of reading them whole.',
    '- Ask me when a failure started before digging into code.',
    '- Use an Explore subagent for codebase questions so the main context stays small.',
    '- Check Azure DevOps (MCP) for related tickets before guessing at causes.',
    '- Explain the root cause, citing evidence, before editing anything.',
    '- Never weaken, skip or retry a test to make CI green.',
    '- Run `pytest tests/test_checkout.py` and show the output before saying a fix works.',
    ...(S.skill ? ['- For failing tests, use the triage-failing-test skill.'] : []),
    ...(S.hook ? ['- A PostToolUse hook runs the checkout tests after every edit. Do not disable it.'] : []),
    '',
  ].join('\n');
}

function showMirror(q) {
  $('#m-loops').textContent = S.loop;
  $('#m-time').textContent = `${Math.max(0, M.endMinute - S.minute)} min`;
  $('#m-peak').textContent = `${Math.round(S.peak)}k`;
  $('#m-trust').textContent = S.trust;
  let v = `${S.loop} loops. You fixed it, proved it, and taught the next session how not to repeat it.`;
  v += S.wrongGuesses ? ` ${S.wrongGuesses} wrong diagnosis${S.wrongGuesses > 1 ? 'es' : ''}.` : ' Every diagnosis matched the evidence.';
  v += S.hintsUsed ? ` ${S.hintsUsed} hint${S.hintsUsed > 1 ? 's' : ''} used.` : ' No hints used.';
  if (q && q.aced) v += ' Knowledge check: already 5/5 from an earlier run.';
  if (q && q.score != null) v += q.before != null ? ` Knowledge check: ${q.before}/${q.total} before, ${q.score}/${q.total} now.` : ` Knowledge check: ${q.score}/${q.total}.`;
  $('#m-verdict').textContent = v;

  const tr = $('#m-transcript');
  tr.textContent = '';
  for (const l of [`> ${M.request}`, ...S.log]) {
    const d = document.createElement('div');
    d.textContent = l.startsWith('>') || l.startsWith('#') ? l : `⏺ ${l}`;
    if (l.startsWith('#')) d.className = 'cm';
    if (l.startsWith('>')) d.className = 'user';
    tr.appendChild(d);
  }

  const cc = $('#m-concepts');
  cc.textContent = '';
  $('#m-guide-h').textContent = `Your Field Guide: ${learned.size} of ${GUIDE.length} Claude concepts learned`;
  const m1 = GUIDE.filter(g => g.mission === 'm1');
  for (const g of [...m1.filter(g => learned.has(g.id)), ...m1.filter(g => !learned.has(g.id))]) {
    const got = learned.has(g.id);
    const d = document.createElement('div');
    d.className = 'concept' + (got ? '' : ' missed');
    const b = document.createElement('b'); b.textContent = (got ? '\u2605 ' : 'Not met yet: ') + g.name;
    const p = document.createElement('p'); p.textContent = got ? `${g.how} Try it: ${g.tryIt}` : g.what;
    d.append(b, p);
    cc.appendChild(d);
  }
  const other = GUIDE.filter(g => g.mission !== 'm1');
  const more = document.createElement('div'); more.className = 'concept missed';
  const mb = document.createElement('b'); mb.textContent = `${other.length} more concepts in the other missions. Mission 2, The Vague Story, is ready to play.`;
  const mp = document.createElement('p'); mp.textContent = other.map(g => g.name).join(' · ');
  more.append(mb, mp); cc.appendChild(more);

  const files = [{ name: 'CLAUDE.md', where: 'repo root', data: buildClaudeMd() }];
  if (S.skill) files.push({ name: 'SKILL.md', where: '.claude/skills/triage-failing-test/', data: buildSkillMd() });
  if (S.hook) files.push({ name: 'settings.json', where: '.claude/ (hooks section)', data: buildHookJson() });
  renderFiles(files);
  $('#mirror').hidden = false;
}

function buildSkillMd() {
  return [
    '---',
    'name: triage-failing-test',
    'description: Use when a CI test fails. Finds the root cause from evidence before changing any code.',
    '---',
    '',
    '# Triage a failing test',
    '',
    '1. Grep the CI log for FAIL. Do not read the whole log.',
    '2. Ask the user when it started failing and what changed since.',
    '3. Check fixtures for time, timezone, date or randomness dependencies.',
    '4. State the root cause and quote the evidence lines that support it.',
    '5. Fix the cause. Never change the assertion, skip the test or add a retry.',
    '6. Run the failing test and show the output before saying it is fixed.',
    '',
  ].join('\n');
}

function buildHookJson() {
  return JSON.stringify({
    hooks: {
      PostToolUse: [
        { matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'pytest tests/test_checkout.py -q' }] },
      ],
    },
  }, null, 2) + '\n';
}

async function renderFiles(files) {
  const box = $('#m-files');
  box.textContent = '';
  let dl = null;
  try { dl = window.claude?.use ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
  for (const f of files) {
    const card = document.createElement('div');
    card.className = 'mfile';
    const h = document.createElement('div'); h.className = 'mfile-h';
    const b = document.createElement('b'); b.textContent = f.name;
    const w = document.createElement('span'); w.textContent = f.where;
    h.append(b, w);
    const pre = document.createElement('pre'); pre.textContent = f.data;
    const row = document.createElement('div'); row.className = 'btn-row';
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'btn'; copy.textContent = `Copy ${f.name}`;
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(f.data); toast(`${f.name} copied`); }
      catch (e) { const r = document.createRange(); r.selectNodeContents(pre); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast('Selected. Press Ctrl+C or Cmd+C to copy.'); }
    };
    row.appendChild(copy);
    if (dl) {
      const d = document.createElement('button'); d.type = 'button'; d.className = 'btn solid'; d.textContent = `Download ${f.name}`;
      d.onclick = async () => {
        try { await dl.save({ filename: f.name, data: f.data }); toast(`Saved ${f.name}`); }
        catch (e) { if (!e || e.code !== 'declined') toast('Download is not available here. Use Copy instead.'); }
      };
      row.appendChild(d);
    } else if (!window.claude) {
      // Standalone hosting (e.g. GitHub Pages): a normal browser download works.
      const d = document.createElement('button'); d.type = 'button'; d.className = 'btn solid'; d.textContent = `Download ${f.name}`;
      d.onclick = () => {
        const url = URL.createObjectURL(new Blob([f.data], { type: f.name.endsWith('.json') ? 'application/json' : 'text/markdown' }));
        const a = document.createElement('a'); a.href = url; a.download = f.name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast(`Saved ${f.name}`);
      };
      row.appendChild(d);
    }
    card.append(h, pre, row);
    box.appendChild(card);
  }
}

function resetGame() {
  Object.assign(S, fresh());
  shownLevel = 0;
  document.body.classList.remove('dawn');
  scene.resetDay();
  $('#mirror').hidden = true;
  startLoop();
}

// ---------- missions ----------
function markDone(m) { try { localStorage.setItem(`cq-done-${m}`, '1'); } catch (e) {} }
function isDone(m) { try { return localStorage.getItem(`cq-done-${m}`) === '1'; } catch (e) { return false; } }

function showHub() {
  document.body.classList.remove('playing', 'dawn');
  applyTheme(1);
  $('#hub-count').textContent = `${learned.size}/${GUIDE.length}`;
  const status = m => !isDone(m) ? '' : '\u2713 Completed · play again any time' +
    (postScore(m) === QUIZ[m].length ? ' · knowledge check 5/5, so it is skipped next time' : '');
  $('#st-m1').textContent = status('m1');
  $('#st-m2').textContent = status('m2');
  $('#hub').hidden = false;
  $('#hub').scrollTop = 0;
  (isDone('m1') && !isDone('m2') ? $('#go-m2') : $('#go-m1')).focus({ preventScroll: true });
}

function goHub() {
  Object.assign(S, fresh());
  shownLevel = 0;
  $('#mirror').hidden = true;
  $('#m2').hidden = true;
  $('#m2done').hidden = true;
  scene.resetDay();
  renderHud();
  showHub();
}

async function playMission1() {
  $('#hub').hidden = true;
  Object.assign(S, fresh());
  shownLevel = 0;
  scene.resetDay();
  applyTheme(1);
  renderHud();
  const pre1 = await runQuiz('m1', 'pre');
  if (pre1.aced) toast('You aced this knowledge check last time, so it is skipped.');
  if (!primerSeen()) await showPrimer();
  await showBrief();
  document.body.classList.add('playing');
  startLoop();
}

async function playMission2() {
  $('#hub').hidden = true;
  document.body.dataset.level = 'm2';
  scene.setTheme && scene.setTheme('#04122a', '#0b3a66');
  const pre2 = await runQuiz('m2', 'pre');
  if (pre2.aced) toast('You aced this knowledge check last time, so it is skipped.');
  startMission2({
    $, learn, BY_ID, showResult, showChoice, sfx, toast, runQuiz, goHub, markDone,
  });
}

// ---------- boot ----------
async function main() {
  await boot3d();
  $('#prompt-text').textContent = M.request;
  applyTheme(1, false);
  renderGuideCount();
  $('#guide-btn').addEventListener('click', openGuide);
  $('#tour-btn').addEventListener('click', () => { if ($('#tour').hidden) runTour(true); });
  $('#g-close').addEventListener('click', () => { $('#guide').hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#guide').hidden) $('#guide').hidden = true; });
  renderHud();
  $('#start').addEventListener('click', () => {
    enterFullscreen();
    initAudio();
    $('#intro').hidden = true;
    showHub();
  });
  $('#mute').addEventListener('click', () => {
    initAudio();
    setMuted(!isMuted());
    $('#mute').textContent = isMuted() ? 'Sound off' : 'Sound on';
    $('#mute').setAttribute('aria-pressed', String(isMuted()));
  });
  $('#m-again').addEventListener('click', resetGame);
  $('#m-hub').addEventListener('click', goHub);
  $('#go-m1').addEventListener('click', playMission1);
  $('#hub-primer').addEventListener('click', async () => { $('#hub').hidden = true; await showPrimer(); $('#hub').hidden = false; });
  $('#go-m2').addEventListener('click', playMission2);
  setupTextSize();
  setupFullscreen();
}

// Full screen: entered from the Wake up click; optional everywhere (some viewers refuse it).
function enterFullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen().catch(() => { /* refused in this viewer: keep playing in the window */ });
}
function setupFullscreen() {
  const btn = $('#fullscreen');
  if (!document.documentElement.requestFullscreen) { btn.hidden = true; return; }
  const sync = () => {
    const on = !!document.fullscreenElement;
    btn.textContent = on ? 'Exit full screen' : 'Full screen';
    btn.setAttribute('aria-pressed', String(on));
  };
  btn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else enterFullscreen();
  });
  document.addEventListener('fullscreenchange', sync);
  sync();
}

// Text size: normal (112.5%) → large → extra large, remembered per viewer.
function setupTextSize() {
  const sizes = ['', 'l', 'xl'], names = ['normal', 'large', 'extra large'];
  let i = 0;
  try { i = Math.max(0, sizes.indexOf(localStorage.getItem('cq-textsize') || '')); } catch (e) { i = 0; }
  const apply = () => {
    if (sizes[i]) document.documentElement.dataset.size = sizes[i]; else delete document.documentElement.dataset.size;
    $('#textsize').setAttribute('aria-label', `Text size: ${names[i]}`);
    $('#textsize').title = `Text size: ${names[i]}`;
  };
  apply();
  $('#textsize').addEventListener('click', () => {
    i = (i + 1) % sizes.length;
    apply();
    toast(`Text size: ${names[i]}`);
    try { localStorage.setItem('cq-textsize', sizes[i]); } catch (e) { /* storage blocked: size still applies this visit */ }
  });
}
main();
