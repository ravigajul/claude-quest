// Mission 2: The Vague Story.
// A product owner hands over a one-line story. The player builds a real prompt from parts and runs it.
// Each run shows Claude's output and a review (coverage, invented rules, usable, importable), so the
// player learns what each part of a prompt does by watching the output change.

const REQS = [
  { id: 'R1', src: 'story', title: 'Valid code applies the discount', steps: 'Add $60 of items. Enter SAVE10. Click Apply.', exp: '10% off: the total drops by $6.00.' },
  { id: 'R2', src: 'story', title: 'Invalid code shows an error', steps: 'Enter NOTREAL. Click Apply.', exp: 'Message "This code is not valid." Total unchanged.' },
  { id: 'R5', src: 'ticket', title: 'Minimum order of $50', steps: 'Cart total $49.99. Enter SAVE10. Click Apply.', exp: 'Message "Spend $50 to use this code." No discount.' },
  { id: 'R6', src: 'ticket', title: 'Only one code per order', steps: 'Apply SAVE10, then enter FREESHIP and click Apply.', exp: 'Message "Only one code per order." SAVE10 stays applied.' },
  { id: 'R7', src: 'ticket', title: 'Expired code', steps: 'Enter SUMMER24 (expired). Click Apply.', exp: 'Message "This code has expired." No discount.' },
  { id: 'R10', src: 'ticket', title: 'Discount removed if the cart drops below $50', steps: 'Apply SAVE10 at $60, then remove items until the cart is $40.', exp: 'Discount removed and the $50 message is shown.' },
  { id: 'R3', src: 'design', title: 'Apply is disabled when the field is empty', steps: 'Leave the promo field empty.', exp: 'The Apply button is disabled.' },
  { id: 'R4', src: 'design', title: 'Code field allows at most 12 characters', steps: 'Type a 13-character code.', exp: 'The field stops accepting input at 12 characters.' },
  { id: 'R8', src: 'answers', title: 'Codes are not case-sensitive', steps: 'Enter save10 in lower case. Click Apply.', exp: 'Discount applies, same as SAVE10.' },
  { id: 'R9', src: 'answers', title: 'Codes cannot be used on gift cards', steps: 'Cart with only a $100 gift card. Enter SAVE10.', exp: 'Message "Codes can\'t be used on gift cards."' },
];
const INVENTED = {
  stack: { title: 'Up to 3 promo codes can be combined', steps: 'Apply SAVE10, FREESHIP and VIP5.', exp: 'All three discounts apply.', why: 'Nothing says this. The ticket actually says one code per order.' },
  caseSens: { title: 'Codes are case-sensitive', steps: 'Enter save10 in lower case.', exp: 'Rejected as invalid.', why: 'A guess, and the wrong one: Priya says codes are not case-sensitive.' },
};

const STORY = 'As a member, I want to apply a promo code at checkout so that I can save money.';
const EXAMPLE = 'Title: Login with valid password\nSteps: 1. Open /login  2. Enter user qa1 and the valid password  3. Click Sign in\nExpected: Dashboard opens and shows "Welcome, qa1"';

// The parts of a prompt. `group` radio parts are mutually exclusive.
const PARTS = [
  { id: 'role', label: 'Set the role and reader', line: 'You are a senior QA engineer writing manual test cases for our manual testing team.' },
  { id: 'vague', group: 'task', label: 'Task: "Test this story."', line: 'Test this story.' },
  { id: 'specific', group: 'task', label: 'Task: cover every criterion and edge case', line: 'Write manual test cases that cover every acceptance criterion, boundary and error case for this story.' },
  { id: 'story', fixed: true, label: 'The story', line: `Story: "${STORY}"` },
  { id: 'ticket', src: true, label: 'Attach ticket {ID} (via MCP)', line: 'Read {ITEM} {ID} and its acceptance criteria using the {TOOL} MCP tools.' },
  { id: 'design', src: true, label: 'Attach the design screenshot', line: '[image: checkout-promo-design.png]' },
  { id: 'answers', src: true, auto: true, label: 'Priya\'s answers (in the conversation)', line: 'Priya\'s answers: codes are not case-sensitive; codes cannot be used on gift cards; one code per order.' },
  { id: 'clarify', label: 'Ask me questions before you start', line: 'Before writing anything, ask me the questions you need answered.' },
  { id: 'example', label: 'Give one example in our format', line: `Use exactly this format and level of detail:\n${EXAMPLE}` },
  { id: 'free', group: 'format', label: 'Output: no format given', line: '' },
  { id: 'table', group: 'format', label: 'Output: a table', line: 'Return the test cases as a table.' },
  { id: 'ado', group: 'format', label: 'Output: CSV for {TOOL} import', line: 'Return CSV with the columns: {COLS}. One row per test case, no extra text.' },
  { id: 'guard', label: 'Only what you can trace; list assumptions', line: 'Only include test cases you can trace to the story, the ticket, the design or my answers. Put anything you would have to assume under "Open questions" instead of writing a test for it.' },
];

const GROUPS = [
  { name: 'Who Claude is', ids: ['role'] },
  { name: 'The task', ids: ['vague', 'specific'] },
  { name: 'Context', ids: ['ticket', 'design', 'answers'] },
  { name: 'How to work', ids: ['clarify', 'example', 'guard'] },
  { name: 'Output', ids: ['free', 'table', 'ado'] },
];

const MAX_RUNS = 6;

// Where the team's stories live. Every {KEY} in the mission's text is filled from the chosen tracker.
const TRACKERS = {
  ado: { name: 'Azure DevOps', TOOL: 'Azure DevOps', ID: 'ADO-4821', ITEM: 'work item',
    CMD: 'claude mcp add azure-devops -- npx -y @azure-devops/mcp <your-org>',
    SERVERWHY: 'That registers Microsoft\u2019s Azure DevOps MCP server with Claude Code. You sign in with your own Azure account, and Claude can now read (and, if you allow it, update) work items in any session.',
    COLS: 'Title, Steps, Expected Result, Source', csvHeader: 'Title,Steps,Expected Result,Source' },
  jira: { name: 'Jira', TOOL: 'Jira', ID: 'PROMO-482', ITEM: 'Jira issue',
    CMD: 'claude mcp add --transport http atlassian https://mcp.atlassian.com/v2/mcp',
    SERVERWHY: 'That connects Atlassian\u2019s official remote MCP server. The first time, /mcp opens your browser so you sign in to Atlassian with your own account. Claude can then read (and, if you allow it, update) Jira issues in any session.',
    COLS: 'Summary, Test Step, Expected Result, Source', csvHeader: 'Summary,Test Step,Expected Result,Source' },
};
let T = TRACKERS.ado;
const fill = str => str.replace(/\{([A-Z]+)\}/g, (m, k) => (k in T ? T[k] : m));
const F = x => typeof x === 'string' ? fill(x) : Array.isArray(x) ? x.map(F)
  : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, F(v)])) : x;

export function startMission2(api) {
  const { $, learn, BY_ID, sfx, toast, runQuiz, goHub, markDone } = api;
  const showResult = o => api.showResult(F(o));
  const showChoice = spec => api.showChoice(F(spec));
  try { T = TRACKERS[localStorage.getItem('cq-tracker')] || TRACKERS.ado; } catch (e) { T = TRACKERS.ado; }
  const on = new Set(['vague', 'free', 'story']);
  let inFlight = false;   // true while Claude is "thinking": the prompt can't change and Send can't be pressed again
  let runs = 0, answered = false, prev = null, done = false, first = null, newChip = null, mcpReady = false, imgReady = false;
  const box = $('#m2');

  const order = ['role', 'vague', 'specific', 'story', 'ticket', 'design', 'answers', 'clarify', 'example', 'free', 'table', 'ado', 'guard'];
  const part = id => PARTS.find(p => p.id === id);
  const buildPrompt = () => order.filter(id => on.has(id) && part(id).line).map(id => fill(part(id).line)).join('\n\n');

  function renderParts() {
    const wrap = $('#m2-parts'); wrap.textContent = '';
    for (const g of GROUPS) {
      const sec = document.createElement('div'); sec.className = 'm2-group';
      const single = g.ids.some(id => part(id).group);
      const h = document.createElement('span'); h.className = 'r-lbl';
      h.textContent = g.name + ' · ';
      const mode = document.createElement('em'); mode.className = 'm2-mode ' + (single ? 'one' : 'any');
      mode.textContent = single ? 'pick one' : 'add any';
      h.appendChild(mode);
      sec.appendChild(h);
      const row = document.createElement('div'); row.className = 'm2-chips' + (single ? ' seg' : '');
      if (single) row.setAttribute('role', 'radiogroup');
      for (const id of g.ids) {
        const p = part(id);
        if (p.auto && !answered) continue;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'm2-chip' + (on.has(id) ? ' on' : '') + (p.group ? ' radio' : '');
        if (p.group) { b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(on.has(id))); }
        else b.setAttribute('aria-pressed', String(on.has(id)));
        b.textContent = fill(p.label);
        if (newChip === id) { b.classList.add('fresh'); const t = document.createElement('span'); t.className = 'new-tag'; t.textContent = 'NEW'; b.appendChild(t); }
        b.onclick = async () => {
          if (done || inFlight) return;
          // Attaching the ticket or the design first needs the player to know HOW in Claude Code.
          if (id === 'ticket' && !on.has('ticket') && !mcpReady) { if (!(await setupMcp())) return; }
          if (id === 'design' && !on.has('design') && !imgReady) { if (!(await setupImage())) return; }
          if (p.group) { PARTS.filter(x => x.group === p.group).forEach(x => on.delete(x.id)); on.add(id); }
          else if (on.has(id)) on.delete(id); else on.add(id);
          sfx.card();
          render();
        };
        row.appendChild(b);
      }
      sec.appendChild(row);
      wrap.appendChild(sec);
    }
  }

  function renderTracker() {
    const row = $('#m2-tracker'); row.textContent = '';
    for (const [k, t] of Object.entries(TRACKERS)) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'm2-chip radio' + (T === t ? ' on' : '');
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(T === t));
      b.textContent = t.name;
      b.disabled = runs > 0 && T !== t;
      b.onclick = () => {
        if (T === t || runs > 0) return;
        T = t; mcpReady = false; on.delete('ticket');
        try { localStorage.setItem('cq-tracker', k); } catch (e) {}
        sfx.card(); render();
      };
      row.appendChild(b);
    }
    $('#m2-tracker-note').hidden = runs === 0;
    document.querySelectorAll('[data-t]').forEach(el => { el.textContent = T[el.dataset.t]; });
  }

  function render() {
    renderTracker();
    renderParts();
    $('#m2-prompt').textContent = buildPrompt();
    $('#m2-runs').textContent = `${MAX_RUNS - runs} of ${MAX_RUNS} sessions left`;
    for (const b of [$('#m2-run'), $('#m2-run-top')]) {
      b.disabled = done || inFlight || runs >= MAX_RUNS;
      b.textContent = runs === 0 ? 'Send to Claude' : 'Send revised prompt';
    }
    $('#m2-src-ticket').classList.toggle('used', on.has('ticket'));
    $('#m2-src-design').classList.toggle('used', on.has('design'));
    $('#m2-src-priya').classList.toggle('used', answered);
  }

  // ---------- how-to steps: connecting MCP and giving Claude an image ----------
  const MCP_CHOICE = {
    question: 'Claude: "I can\u2019t see {ID}. No {TOOL} connector is set up." How do you give Claude access to your tickets?',
    nudge: 'MCP servers are added to Claude Code once, from your terminal, and then work in every session.',
    options: [
      { id: 'add', correct: true, text: 'In your terminal run: {CMD}. Then type /mcp in Claude Code to check it is connected and signed in.',
        why: '{SERVERWHY}' },
      { id: 'password', text: 'Put your {TOOL} username and password in the prompt so Claude can log in.',
        why: 'Never put credentials in a prompt. They end up in the conversation history, and Claude still has no tool to log in with.' },
      { id: 'url', text: 'Paste the ticket\u2019s URL into the prompt and ask Claude to open it.',
        why: 'Your {TOOL} is private. Without a connector Claude can\u2019t sign in, so it gets a login page, or worse, guesses what the ticket says.' },
      { id: 'copy', text: 'Copy the ticket\u2019s text from the browser and paste it into every prompt.',
        why: 'It works for one ticket, but you\u2019ll repeat it for every ticket forever, and it goes stale when the ticket changes. A connector reads the live ticket whenever Claude needs it.' },
    ],
  };
  const IMG_CHOICE = {
    question: 'You have checkout-promo-design.png. How do you get it into Claude Code?',
    nudge: 'Claude Code runs in your terminal, but it can still read images.',
    options: [
      { id: 'paste', correct: true, text: 'Copy the image and paste it with Ctrl+V (Ctrl, even on a Mac), or drag the file into the terminal, or type its path.',
        why: 'Claude Code takes images by paste (Ctrl+V, not Cmd+V, on a Mac), by drag and drop, or by file path. Claude then reads the field limits and button states straight from the design.' },
      { id: 'describe', text: 'Describe the design in words: "there is a promo field and an Apply button".',
        why: 'You will forget the details that matter, like the 12-character limit and the disabled state. That is exactly what the image carries.' },
      { id: 'link', text: 'Upload it to a shared drive and paste the link.',
        why: 'Claude can\u2019t open links that need your sign-in. Give it the image itself.' },
      { id: 'cant', text: 'You can\u2019t. Claude Code is text-only, so ask a developer to read the design.',
        why: 'Claude reads images: designs, screenshots of errors, diagrams. You can hand it the picture directly.' },
    ],
  };

  async function setupMcp() {
    const o = await showChoice(MCP_CHOICE);
    if (!o.correct) { sfx.glitch(); await showResult({ title: 'That won\u2019t get Claude the ticket', concept: 'MCP connectors', tone: 'bad', body: o.why, found: ['Try again: tick "Attach ticket" to choose differently.'] }); return false; }
    mcpReady = true;
    sfx.clue();
    await showResult({ title: '{TOOL} connected', concept: 'MCP connectors', teach: 'mcp', body: o.why,
      found: ['Claude can now read {ID} and its acceptance criteria.'],
      cmd: '{CMD}' });
    return true;
  }
  async function setupImage() {
    const o = await showChoice(IMG_CHOICE);
    if (!o.correct) { sfx.glitch(); await showResult({ title: 'Claude still can\u2019t see the design', concept: 'Screenshots as input', tone: 'bad', body: o.why, found: ['Try again: tick "Attach the design screenshot" to choose differently.'] }); return false; }
    imgReady = true;
    sfx.clue();
    await showResult({ title: 'Design attached', concept: 'Screenshots as input', teach: 'images', body: o.why,
      cmd: 'Ctrl+V   (or drag checkout-promo-design.png into the terminal)' });
    return true;
  }

  // ---------- what Claude produces for the current prompt ----------
  function generate() {
    const known = REQS.filter(r => r.src === 'story' || (r.src === 'ticket' && on.has('ticket')) || (r.src === 'design' && on.has('design')) || (r.src === 'answers' && on.has('answers')));
    const cases = on.has('specific') ? known : known.slice(0, 3);
    const invented = [];
    const openQs = [];
    if (!on.has('guard')) {
      invented.push(INVENTED.stack);
      if (!on.has('answers')) invented.push(INVENTED.caseSens);
    } else {
      if (!on.has('answers')) openQs.push('Are promo codes case-sensitive?', 'Can codes be used on gift cards?');
      if (!on.has('ticket')) openQs.push('Is there a minimum order value or an expiry rule?');
      if (!on.has('design')) openQs.push('Are there limits on the code field (length, empty state)?');
    }
    const all = [...cases.map(c => ({ ...c, real: true })), ...invented.map(c => ({ ...c, real: false }))];
    return { cases, invented, openQs, all,
      usable: on.has('role') && on.has('example'),
      importable: on.has('ado'),
      coverage: cases.length };
  }

  function formatOutput(g) {
    const vague = !on.has('example');
    const stepsOf = c => (vague ? `Check that "${c.title.toLowerCase()}" works.` : c.steps);
    const expOf = c => (vague ? 'It works correctly.' : c.exp);
    if (!on.has('role')) {
      // No role or reader: Claude writes automated test code, which manual testers cannot run.
      const fn = c => 'def test_' + c.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '(page):\n    ...  # ' + stepsOf(c);
      return g.all.map(fn).join('\n\n') + (g.openQs.length ? '\n\n# Open questions:\n' + g.openQs.map(q => '# - ' + q).join('\n') : '');
    }
    let out;
    if (on.has('ado')) {
      out = T.csvHeader + '\n' + g.all.map(c => `"${c.title}","${stepsOf(c)}","${expOf(c)}","${c.real ? c.src : 'none'}"`).join('\n');
    } else if (on.has('table')) {
      out = '| Test | Steps | Expected |\n|---|---|---|\n' + g.all.map(c => `| ${c.title} | ${stepsOf(c)} | ${expOf(c)} |`).join('\n');
    } else {
      out = 'Sure! Here are some test cases for the promo code feature:\n\n' + g.all.map((c, i) => `${i + 1}. ${c.title}. ${stepsOf(c)} ${expOf(c)}`).join('\n') + '\n\nLet me know if you want more!';
    }
    if (g.openQs.length && !on.has('ado')) out += '\n\nOpen questions:\n' + g.openQs.map(q => '- ' + q).join('\n');
    if (g.openQs.length && on.has('ado')) out += '\n\n# Open questions (not tested): ' + g.openQs.join(' | ');
    return out;
  }

  // ---------- review panel ----------
  const LABEL = id => `"${fill(part(id).label).replace(/^(Task|Output): /, '').replace(/"/g, '')}"`;

  function renderReview(g, diff) {
    $('#m2-review').hidden = false;
    const ul = $('#m2-checks'); ul.textContent = '';
    const row = (ok, title, html) => {
      const li = document.createElement('li'); li.className = ok ? 'ok' : 'bad';
      const ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = ok ? '✓' : '✗';
      const b = document.createElement('b'); b.textContent = fill(title);
      const w = document.createElement('span'); w.className = 'why';
      html = fill(html);
      // html is built only from our own strings (labels and fixed text), never from user input
      w.innerHTML = html;
      li.append(ic, b, w); ul.appendChild(li);
    };
    const E = t => `<em>${t}</em>`;

    // 1. Coverage: where each requirement came from, and whether the task let Claude use them.
    const bits = ['The story gave 2.'];
    const missing = [];
    if (on.has('ticket')) bits.push(`${E('Attach ticket')} (MCP) added 4.`); else missing.push('the ticket (4 more)');
    if (on.has('design')) bits.push(`${E('Attach the design')} added 2.`); else missing.push('the design (2 more)');
    if (on.has('answers')) bits.push(`${E('Priya’s answers')} added 2.`); else missing.push('Priya’s answers (2 more)');
    let cov = bits.join(' ');
    if (missing.length) cov += ` Not in your prompt: ${missing.join(', ')}.`;
    const known = 2 + (on.has('ticket') ? 4 : 0) + (on.has('design') ? 2 : 0) + (on.has('answers') ? 2 : 0);
    if (!on.has('specific') && known > 3) cov += ` But your task ${E(LABEL('vague'))} let Claude stop after 3 cases.`;
    if (!on.has('answers') && !answered) cov += ' Priya only shares her answers if Claude asks.';
    row(g.coverage === REQS.length, `Requirements covered: ${g.coverage} of ${REQS.length}`, cov);

    // 2. Invented rules.
    row(!g.invented.length, g.invented.length ? `Rules Claude made up: ${g.invented.length}` : 'Nothing made up',
      g.invented.length
        ? `Nothing in your prompt told Claude what to do when it didn\u2019t know, so it guessed. ${g.invented.map(c => `"${c.title}": ${c.why}`).join(' ')}`
        : `${E('Only what you can trace')} sent unknowns to "Open questions" instead of tests.`);

    // 3. Usable by manual testers.
    row(g.usable, g.usable ? 'Manual testers can run it' : 'Manual testers can’t run it',
      !on.has('role') ? `No ${E('role and reader')}: Claude didn’t know the tests were for manual testers, so it wrote Python code.`
      : !on.has('example') ? `No ${E('example in our format')}: Claude guessed the detail level and wrote steps like "check that it works".`
      : `${E('Role')} gave manual test cases, and ${E('one example')} made every step concrete.`);

    // 4. Importable into {TOOL}.
    row(g.importable, g.importable ? 'Imports into {TOOL}' : 'Doesn’t import into {TOOL}',
      on.has('ado') ? `${E(LABEL('ado'))} gave the exact columns the import needs.`
      : on.has('table') ? `You picked ${E(LABEL('table'))}. It reads well, but the import needs CSV with named columns.`
      : `You picked ${E(LABEL('free'))}, so Claude wrote chatty text that someone would have to retype.`);

    const passed = [g.coverage === REQS.length, !g.invented.length, g.usable, g.importable].filter(Boolean).length;
    $('#m2-verdict').textContent = passed === 4 ? 'All 4 done.' : `${passed} of 4 done. Each red line names the selection that caused it.`;

    const d = $('#m2-diff');
    if (diff && (diff.added.length || diff.removed.length)) {
      const parts = [];
      if (diff.added.length) parts.push(`<b>You added</b> ${diff.added.map(id => E(LABEL(id))).join(', ')}`);
      if (diff.removed.length) parts.push(`<b>You removed</b> ${diff.removed.map(id => E(LABEL(id))).join(', ')}`);
      d.innerHTML = fill(`Since your last run: ${parts.join('. ')}. Requirements ${diff.covBefore} → ${g.coverage}, made-up rules ${diff.invBefore} → ${g.invented.length}.`);
      d.hidden = false;
    } else d.hidden = true;
  }

  // ---------- run ----------
  const EFFECTS = [
    { id: 'specific', text: 'You asked for every criterion, boundary and error case, so Claude stopped stopping at three.', teach: 'specific' },
    { id: 'ticket', text: 'Claude pulled {ID} through MCP: four rules from the acceptance criteria are now covered.', teach: null },
    { id: 'design', text: 'Claude read the screenshot: the 12-character limit and the disabled Apply button only exist in the design.', teach: null },
    { id: 'answers', text: 'Priya\'s answers turned two guesses into facts.', teach: null },
    { id: 'role', text: 'Claude now knows who will read this: manual test cases, not Python code.', teach: 'role' },
    { id: 'example', text: 'One example and every step is now concrete enough to execute.', teach: 'examples' },
    { id: 'ado', text: 'CSV with named columns: it imports straight into {TOOL}.', teach: 'structure' },
    { id: 'guard', text: 'No invented rules: things Claude could not trace became open questions instead.', teach: 'grounding' },
  ];

  async function run() {
    if (done || inFlight || runs >= MAX_RUNS) return;
    inFlight = true;
    try { await runOnce(); } finally { inFlight = false; render(); }
  }

  async function runOnce() {
    runs++;
    sfx.card();
    $('#m2-run').disabled = true; $('#m2-run-top').disabled = true;
    $('#m2-out').textContent = '';
    $('#m2-out').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    $('#m2-out-h').textContent = 'Claude is thinking…';
    await new Promise(r => setTimeout(r, 700));

    // Clarifying questions come back instead of test cases, once.
    if (on.has('clarify') && !answered) {
      if (!first) first = { prompt: buildPrompt(), coverage: 0, invented: 0, asked: true, run: runs };
      answered = true;
      on.add('answers');
      $('#m2-out-h').textContent = `Session ${runs}: Claude asked before writing (questions don\u2019t use up a session)`;
      $('#m2-out').textContent = 'Before I write anything, a few questions:\n\n1. Are promo codes case-sensitive?\n2. Can a code be used on gift cards?\n3. Can more than one code be used on an order?';
      $('#m2-chat').hidden = false;
      sfx.clue();
      render();
      await showResult({ title: 'Claude asked instead of guessing', concept: 'Clarifying questions', teach: 'clarify',
        body: 'Instead of guessing, Claude asked Priya 3 questions and she answered them. You don\u2019t need to do anything with them: her answers are now ticked under Context as "Priya\u2019s answers" and go into your next prompt automatically.',
        found: ['Her answers: not case-sensitive · never on gift cards · one code per order', 'Next: click "Send revised prompt". This time Claude writes the tests.'] });
      newChip = 'answers';
      runs--;   // Claude only asked questions, so this round does not use up a session (and can never strand the player on the last one)
      render();
      return;
    }

    newChip = null;
    const g = generate();
    $('#m2-out-h').textContent = `Session ${runs}: Claude's answer`;
    $('#m2-out').textContent = formatOutput(g);
    const visible = id => id !== 'story' && id !== 'clarify';
    const diff = prev ? {
      added: [...on].filter(id => !prev.on.has(id) && visible(id) && !(part(id).group && ['vague', 'free'].includes(id))),
      removed: [...prev.on].filter(id => !on.has(id) && visible(id) && !['vague', 'free'].includes(id)),
      covBefore: prev.coverage, invBefore: prev.invented,
    } : null;
    renderReview(g, diff);

    // What changed because of the prompt: show each new effect once, and unlock its concept.
    const changed = [];
    for (const e of EFFECTS) {
      const nowOn = on.has(e.id);
      const wasOn = prev ? prev.on.has(e.id) : false;
      if (nowOn && !wasOn) changed.push(e);
    }
    prev = { on: new Set(on), coverage: g.coverage, invented: g.invented.length };
    render();

    if (!first) first = { prompt: buildPrompt(), coverage: g.coverage, invented: g.invented.length, usable: g.usable, importable: g.importable, run: runs };
    const win = g.coverage === REQS.length && !g.invented.length && g.usable && g.importable;
    const teachable = changed.filter(e => e.teach && BY_ID[e.teach]);
    if (win) {
      teachable.forEach(e => learn(e.teach));   // the outcome screen explains them all
    } else if (teachable.length === 1) {
      const e = teachable[0];
      await showResult({ title: 'What changed because of your prompt', concept: BY_ID[e.teach].name, body: e.text, teach: e.teach });
    } else if (changed.length) {
      const fresh = teachable.filter(e => learn(e.teach)).map(e => BY_ID[e.teach].name);
      await showResult({ title: 'What changed because of your prompt', concept: `${changed.length} changes`,
        body: 'Each part you added changed the answer in a different way:',
        found: [...changed.map(e => e.text), ...(fresh.length ? [`Added to your Field Guide: ${fresh.join(', ')}`] : [])] });
    }
    if (!changed.length && runs > 1) toast('Nothing in your prompt changed, so neither did the answer.');

    if (win) { await finish(); return; }
    if (runs >= MAX_RUNS) {
      sfx.glitch();
      await showResult({ title: 'Sprint planning started without your tests', tone: 'bad', concept: 'Out of sessions',
        body: 'You used every session. Look at the review: each red line points at a part of the prompt that was missing. Try again with what you know now.' });
      reset();
    }
  }

  async function finish() {
    done = true;
    markDone('m2');
    sfx.win();
    render();
    await showResult({ title: 'All 10 covered. Nothing invented.', concept: 'Priya is importing your tests',
      body: 'Next: a quick knowledge check (skipped if you already aced it), then your results.' });
    const q = await runQuiz('m2', 'post');
    showOutcome(q);
  }

  // The outcome screen: what happened, before vs after, what you learned, what to take to work.
  function showOutcome(q) {
    const final = { prompt: buildPrompt(), coverage: REQS.length };
    const f = first || { prompt: final.prompt, coverage: REQS.length, invented: 0 };
    $('#od-title').textContent = 'Priya imported your 10 test cases.';
    $('#od-sub').textContent = `It took you ${runs} of ${MAX_RUNS} sessions. ` + (f.asked
      ? 'Your first prompt had Claude ask Priya questions before writing anything, which is how her rules got into your tests.'
      : `Your first prompt got ${f.coverage} of 10 requirements${f.invented ? ` and made up ${f.invented} rule${f.invented > 1 ? 's' : ''}` : ''}.`) +
      ' Your final prompt got all 10 and made up nothing.';
    const stats = $('#od-stats'); stats.textContent = '';
    const stat = (label, a, b) => {
      const d = document.createElement('div'); d.className = 'od-stat';
      const l = document.createElement('span'); l.textContent = label;
      const v = document.createElement('b'); v.textContent = a == null ? b : `${a} → ${b}`;
      d.append(l, v); stats.appendChild(d);
    };
    stat('Requirements covered', `${f.coverage}/10`, '10/10');
    stat('Rules Claude made up', f.invented, 0);
    stat('Sessions used', null, `${runs} of ${MAX_RUNS}`);
    if (q && q.aced) stat('Knowledge check', null, '5/5 earlier');
    if (q && q.score != null) stat('Knowledge check', q.before != null ? `${q.before}/${q.total}` : null, `${q.score}/${q.total}`);
    $('#od-first').textContent = f.prompt;
    $('#od-final').textContent = final.prompt.replace(/\[image[^\]]*\]/, '[paste your design screenshot here]');
    const used = ['specific', 'mcp', 'images', 'clarify', 'role', 'examples', 'structure', 'grounding']
      .filter(id => ({ specific: on.has('specific'), mcp: on.has('ticket'), images: on.has('design'), clarify: answered, role: on.has('role'), examples: on.has('example'), structure: on.has('ado'), grounding: on.has('guard') })[id]);
    const ul = $('#od-learn'); ul.textContent = '';
    for (const id of used) {
      const g = BY_ID[id]; if (!g) continue;
      learn(id);
      const li = document.createElement('li');
      const b = document.createElement('b'); b.textContent = g.name;
      const p = document.createElement('span'); p.textContent = g.how;
      li.append(b, p); ul.appendChild(li);
    }
    box.hidden = true;
    $('#m2done').hidden = false;
    $('#m2done').scrollTop = 0;
  }

  function reset() {
    on.clear(); ['vague', 'free', 'story'].forEach(x => on.add(x));
    runs = 0; answered = false; prev = null; done = false;
    $('#m2-out-h').textContent = 'Claude\'s answer will appear here';
    $('#m2-out').textContent = '';
    $('#m2-review').hidden = true;
    $('#m2-chat').hidden = true;
    $('#m2done').hidden = true;
    first = null; mcpReady = false; imgReady = false;
    render();
  }

  $('#m2-run').onclick = run;
  $('#m2-run-top').onclick = run;
  $('#od-copy').onclick = async () => {
    try { await navigator.clipboard.writeText($('#od-final').textContent); toast('Prompt copied'); } catch (e) { toast('Select the text and copy it'); }
  };
  $('#od-hub').onclick = () => { $('#m2done').hidden = true; goHub(); };
  $('#m2-back').onclick = () => { box.hidden = true; goHub(); };
  $('#od-again').onclick = () => { reset(); box.hidden = false; box.scrollTop = 0; };
  reset();
  box.hidden = false;
  box.scrollTop = 0;
}
