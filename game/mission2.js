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
  { id: 'ticket', src: true, label: 'Attach ticket ADO-4821 (via MCP)', line: '@ado:ADO-4821  (acceptance criteria pulled through the Azure DevOps MCP connector)' },
  { id: 'design', src: true, label: 'Attach the design screenshot', line: '[image: checkout-promo-design.png]' },
  { id: 'answers', src: true, auto: true, label: 'Priya\'s answers (in the conversation)', line: 'Priya\'s answers: codes are not case-sensitive; codes cannot be used on gift cards; one code per order.' },
  { id: 'clarify', label: 'Ask me questions before you start', line: 'Before writing anything, ask me the questions you need answered.' },
  { id: 'example', label: 'Give one example in our format', line: `Use exactly this format and level of detail:\n${EXAMPLE}` },
  { id: 'free', group: 'format', label: 'Output: no format given', line: '' },
  { id: 'table', group: 'format', label: 'Output: a table', line: 'Return the test cases as a table.' },
  { id: 'ado', group: 'format', label: 'Output: CSV for Azure DevOps import', line: 'Return CSV with the columns: Title, Steps, Expected Result, Source. One row per test case, no extra text.' },
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

export function startMission2(api) {
  const { $, learn, BY_ID, showResult, sfx, toast, runQuiz, goHub, markDone } = api;
  const on = new Set(['vague', 'free', 'story']);
  let runs = 0, answered = false, prev = null, done = false, first = null;
  const box = $('#m2');

  const order = ['role', 'vague', 'specific', 'story', 'ticket', 'design', 'answers', 'clarify', 'example', 'free', 'table', 'ado', 'guard'];
  const part = id => PARTS.find(p => p.id === id);
  const buildPrompt = () => order.filter(id => on.has(id) && part(id).line).map(id => part(id).line).join('\n\n');

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
        b.textContent = p.label;
        b.onclick = () => {
          if (done) return;
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

  function render() {
    renderParts();
    $('#m2-prompt').textContent = buildPrompt();
    $('#m2-runs').textContent = `${MAX_RUNS - runs} of ${MAX_RUNS} sessions left`;
    for (const b of [$('#m2-run'), $('#m2-run-top')]) {
      b.disabled = done || runs >= MAX_RUNS;
      b.textContent = runs === 0 ? 'Send to Claude' : 'Send revised prompt';
    }
    $('#m2-src-ticket').classList.toggle('used', on.has('ticket'));
    $('#m2-src-design').classList.toggle('used', on.has('design'));
    $('#m2-src-priya').classList.toggle('used', answered);
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
      out = 'Title,Steps,Expected Result,Source\n' + g.all.map(c => `"${c.title}","${stepsOf(c)}","${expOf(c)}","${c.real ? c.src : 'none'}"`).join('\n');
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
  function renderReview(g) {
    $('#m2-review').hidden = false;
    $('#m2-cov').textContent = `${g.coverage} of ${REQS.length}`;
    $('#m2-cov').className = g.coverage === REQS.length ? 'ok' : 'bad';
    $('#m2-inv').textContent = String(g.invented.length);
    $('#m2-inv').className = g.invented.length ? 'bad' : 'ok';
    $('#m2-use').textContent = g.usable ? 'Yes' : 'No';
    $('#m2-use').className = g.usable ? 'ok' : 'bad';
    $('#m2-imp').textContent = g.importable ? 'Yes' : 'No';
    $('#m2-imp').className = g.importable ? 'ok' : 'bad';
    const notes = $('#m2-notes'); notes.textContent = '';
    const add = (t, cls) => { const li = document.createElement('li'); li.textContent = t; if (cls) li.className = cls; notes.appendChild(li); };
    for (const c of g.invented) add(`Invented: "${c.title}". ${c.why}`, 'bad');
    const missing = REQS.length - g.coverage;
    if (missing) {
      const srcs = [];
      if (!on.has('ticket')) srcs.push('the ticket');
      if (!on.has('design')) srcs.push('the design');
      if (!on.has('answers')) srcs.push('Priya\'s head');
      add(srcs.length
        ? `Your reviewer knows of ${missing} requirement${missing > 1 ? 's' : ''} you did not test. Some of them live in ${srcs.join(', ')}.`
        : `${missing} known requirement${missing > 1 ? 's were' : ' was'} skipped. Claude stopped early: what did you actually ask it to cover?`);
    }
    if (!on.has('role')) add('Your manual testers asked: "What do we do with Python code?" Claude did not know who the tests were for.', 'bad');
    else if (!on.has('example')) add('Steps like "check that it works" cannot be executed. Claude guessed the level of detail.', 'bad');
    if (!on.has('ado')) add(on.has('table') ? 'A table reads well, but the Azure DevOps import needs CSV with named columns.' : 'Free text: someone now has to retype every case into Azure DevOps.', 'bad');
  }

  // ---------- run ----------
  const EFFECTS = [
    { id: 'specific', text: 'You asked for every criterion, boundary and error case, so Claude stopped stopping at three.', teach: 'specific' },
    { id: 'ticket', text: 'Claude pulled ADO-4821 through MCP: four rules from the acceptance criteria are now covered.', teach: 'mcp' },
    { id: 'design', text: 'Claude read the screenshot: the 12-character limit and the disabled Apply button only exist in the design.', teach: 'images' },
    { id: 'answers', text: 'Priya\'s answers turned two guesses into facts.', teach: null },
    { id: 'role', text: 'Claude now knows who will read this: manual test cases, not Python code.', teach: 'role' },
    { id: 'example', text: 'One example and every step is now concrete enough to execute.', teach: 'examples' },
    { id: 'ado', text: 'CSV with named columns: it imports straight into Azure DevOps.', teach: 'structure' },
    { id: 'guard', text: 'No invented rules: things Claude could not trace became open questions instead.', teach: 'grounding' },
  ];

  async function run() {
    if (done || runs >= MAX_RUNS) return;
    runs++;
    sfx.card();
    $('#m2-run').disabled = true; $('#m2-run-top').disabled = true;
    $('#m2-out').textContent = '';
    $('#m2-out').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    $('#m2-out-h').textContent = 'Claude is thinking…';
    await new Promise(r => setTimeout(r, 700));

    // Clarifying questions come back instead of test cases, once.
    if (on.has('clarify') && !answered) {
      answered = true;
      on.add('answers');
      $('#m2-out-h').textContent = `Session ${runs}: Claude asked before writing`;
      $('#m2-out').textContent = 'Before I write anything, a few questions:\n\n1. Are promo codes case-sensitive?\n2. Can a code be used on gift cards?\n3. Can more than one code be used on an order?';
      $('#m2-chat').hidden = false;
      sfx.clue();
      render();
      await showResult({ title: 'Claude asked instead of guessing', concept: 'Clarifying questions', teach: 'clarify',
        body: 'Priya answered all three in the chat. Those answers are now part of the conversation, so they are in every prompt you send from here.',
        found: ['Not case-sensitive', 'Not valid on gift cards', 'One code per order'] });
      return;
    }

    const g = generate();
    $('#m2-out-h').textContent = `Session ${runs}: Claude's answer`;
    $('#m2-out').textContent = formatOutput(g);
    renderReview(g);

    // What changed because of the prompt: show each new effect once, and unlock its concept.
    const changed = [];
    for (const e of EFFECTS) {
      const nowOn = on.has(e.id);
      const wasOn = prev ? prev.on.has(e.id) : false;
      if (nowOn && !wasOn) changed.push(e);
    }
    prev = { on: new Set(on), coverage: g.coverage };
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
      body: 'One quick check of what you know now, then your results.' });
    const q = await runQuiz('m2', 'post');
    showOutcome(q);
  }

  // The outcome screen: what happened, before vs after, what you learned, what to take to work.
  function showOutcome(q) {
    const final = { prompt: buildPrompt(), coverage: REQS.length };
    const f = first || { prompt: final.prompt, coverage: REQS.length, invented: 0 };
    $('#od-title').textContent = 'Priya imported your 10 test cases.';
    $('#od-sub').textContent = `It took you ${runs} of ${MAX_RUNS} sessions. Your first prompt got ${f.coverage} of 10 requirements${f.invented ? ` and made up ${f.invented} rule${f.invented > 1 ? 's' : ''}` : ''}. Your final prompt got all 10 and made up nothing.`;
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
    first = null;
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
