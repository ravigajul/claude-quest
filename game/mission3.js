// Mission 3: Contract Drift.
// A pull request merged on Friday quietly changed the members API. The tests still pass (they only check
// for status 200), but the app shows "Member since: undefined". The player directs Claude through four
// steps on a visible pipeline: find what changed, sort the changes (what /code-review and /security-review
// would have flagged), save the check as a /contract-check command, and run it headless on every pull
// request with a sensible model. The finale: the next drifting pull request is blocked automatically.

const CONTRACT = `# openapi.yaml · GET /members/{id} · 200
Member:
  memberSince: string (date)
  tier:        string  "basic" | "gold"
  name:        string
  status:      string`;

// Each line of the real response, and what the player has to recognise in it.
const RESPONSE = [
  { text: '{', kind: null },
  { text: '  "joinDate": "2019-04-02",', kind: 'rename' },
  { text: '  "tier": 3,', kind: 'type' },
  { text: '  "name": "Sam Ortiz",', kind: null },
  { text: '  "status": "active",', kind: null },
  { text: '  "phone": "+1 555 0142",', kind: 'phone' },
  { text: '  "updatedAt": "2026-11-27T09:14:00Z"', kind: 'added' },
  { text: '}', kind: null },
];

const DRIFTS = [
  { id: 'rename', field: 'memberSince → joinDate', what: 'A field was renamed.', answer: 'breaks',
    right: 'Every app that reads memberSince now gets nothing. That is the "Member since: undefined" bug.',
    wrong: 'Renaming a field breaks every app that reads the old name. The mobile app reads memberSince, which no longer exists.' },
  { id: 'type', field: 'tier: "gold" → 3', what: 'Text became a number.', answer: 'breaks',
    right: 'The app checks tier === "gold". With a number that is never true, so gold members lose their perks on screen.',
    wrong: 'Changing a field’s type breaks apps too: the app compares tier to the text "gold", and 3 never matches.' },
  { id: 'phone', field: '+ phone', what: 'A new field nobody documented.', answer: 'privacy',
    right: 'Adding a field is usually safe, but this one is a member’s phone number, now sent to every app that calls the API. That is personal data leaking.',
    wrong: 'New fields are usually safe, but look at what it holds: a member’s phone number, sent to every caller. That is a privacy risk.' },
  { id: 'added', field: '+ updatedAt', what: 'A new field nobody documented.', answer: 'safe',
    right: 'A new field with no personal data is safe: apps ignore fields they don’t know. It should still be added to openapi.yaml.',
    wrong: 'This one is harmless: a timestamp, no personal data, and apps simply ignore fields they don’t use.' },
];
const VERDICTS = [
  { id: 'breaks', label: 'Breaks apps' },
  { id: 'privacy', label: 'Privacy risk' },
  { id: 'safe', label: 'Safe' },
];

const COMMAND_FILE = `---
description: Compare an API endpoint's live response with openapi.yaml
---
Call $ARGUMENTS on staging and compare the response with its schema in openapi.yaml.
List every difference as a table: field, contract, actual, verdict.
Verdict is one of:
- BREAKING: a field was renamed, removed or changed type
- PRIVACY: personal data that is not in the contract
- SAFE: a new field with no personal data
Do not edit any files.
End with the line RESULT: FAIL if anything is BREAKING or PRIVACY, otherwise RESULT: PASS.`;

const WORKFLOW = `# .github/workflows/contract-check.yml
name: Contract check
on: pull_request
jobs:
  contract:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g @anthropic-ai/claude-code
      - name: Compare /members with openapi.yaml
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          claude -p "/contract-check /members" --model haiku \\
            --allowedTools "Read" "Bash(curl *)" > report.md
          cat report.md
          grep -q "RESULT: PASS" report.md`;

const CI_RUN = [
  '▶ Pull request #219 "Rename status to state" opened by Marco',
  '▶ Contract check · claude -p "/contract-check /members" --model haiku',
  '  Calling GET /members/42 on staging…',
  '  Comparing with openapi.yaml…',
  '',
  '  | field  | contract | actual      | verdict  |',
  '  |--------|----------|-------------|----------|',
  '  | status | string   | (missing)   | BREAKING |',
  '  | state  | (none)   | "active"    | BREAKING |',
  '',
  '  RESULT: FAIL',
  '✗ Contract check failed · merging is blocked until it passes',
];

const STEPS = [
  { id: 'find', name: 'Find what changed' },
  { id: 'sort', name: 'Sort the changes' },
  { id: 'save', name: 'Save it as /contract-check' },
  { id: 'ci', name: 'Run it on every pull request' },
];

// ---------- the choices ----------
const FIND = {
  question: 'Lena from support: "The app says Member since: undefined for everyone." Marco: "But all 48 API tests pass." What do you ask Claude?',
  nudge: 'Passing tests only prove what they check. Compare what the API promises with what it actually sends.',
  options: [
    { id: 'diff', correct: true, text: 'Call GET /members/42 on staging, compare the response with its schema in openapi.yaml, and list every difference.',
      why: 'The contract (openapi.yaml) says what the API promises. A real response shows what it actually sends. Comparing the two finds the drift directly.' },
    { id: 'tests', text: 'Are the API tests passing?',
      why: 'Claude runs them: 48 of 48 pass. They only check that the status code is 200, so they could never catch a renamed field. Passing tests prove only what they test.' },
    { id: 'repo', text: 'Read the whole backend repo and figure out what is wrong.',
      why: 'Claude reads hundreds of files, fills its context, and comes back with a long list of things that might be wrong. Give it a specific comparison instead.' },
    { id: 'patch', text: 'Change the mobile app to read joinDate instead of memberSince.',
      why: 'That patches one symptom in one app, and you still don’t know what else changed. The website and the partner apps are still broken.' },
  ],
};
const WHERE = {
  question: 'You’ll run this check on every endpoint, and so will your team. Where do you save the prompt?',
  nudge: 'A file in the repo is shared with everyone who clones it, including the build server.',
  options: [
    { id: 'project', correct: true, text: 'In the repo, as .claude/commands/contract-check.md, and commit it.',
      why: 'Every markdown file in .claude/commands becomes a slash command named after the file. Commit it, and everyone who clones the repo (and your CI) can type /contract-check.' },
    { id: 'user', text: 'In your home folder, as ~/.claude/commands/contract-check.md.',
      why: 'That works, but only for you, on this computer. Your team and the build server never get it. Personal commands are for your own habits; shared checks belong in the repo.' },
    { id: 'claudemd', text: 'Add "always check API contracts" to CLAUDE.md.',
      why: 'CLAUDE.md is read at the start of every session and uses context every time, and Claude decides when to act on it. A command runs exactly when you ask.' },
    { id: 'desktop', text: 'Keep the prompt in a text file on your desktop and paste it each time.',
      why: 'It works until you lose the file, tweak one copy, or a teammate needs it. A command is the same prompt, saved where everyone can use it.' },
  ],
};
const ARGS = {
  question: 'There are 40 endpoints. How does one command work for any of them, like /contract-check /orders?',
  nudge: 'Commands have a placeholder for whatever you type after the command name.',
  options: [
    { id: 'args', correct: true, text: 'Write $ARGUMENTS in the file where the endpoint goes.',
      why: 'Whatever you type after the command replaces $ARGUMENTS. /contract-check /orders checks /orders, and the same file works for all 40 endpoints.' },
    { id: 'many', text: 'Make 40 command files, one per endpoint.',
      why: 'Then every improvement has to be made 40 times, and they drift apart. One file with $ARGUMENTS does it.' },
    { id: 'guess', text: 'Leave the endpoint out. Claude will work out which one you mean.',
      why: 'Claude would have to guess, and it might check the wrong endpoint or all of them. Say exactly which one.' },
  ],
};
const CI = {
  question: 'Nobody remembered to check Friday’s pull request. How do you make /contract-check run on every one?',
  nudge: 'Claude Code can run without anyone typing: claude -p runs one prompt and prints the answer, which suits a pipeline.',
  options: [
    { id: 'headless', correct: true, text: 'Add a CI step that runs claude -p "/contract-check /members", with the API key stored as a CI secret, and fail the build if the report says FAIL.',
      why: 'claude -p (headless mode) runs one prompt with no one at the keyboard and prints the result. Since nobody is there to approve tools, you list the ones it may use with --allowedTools.' },
    { id: 'key', text: 'Same CI step, but paste the API key straight into the pipeline file so it just works.',
      why: 'Anyone who can read the repo can now use your key. Store it as a CI secret (secrets.ANTHROPIC_API_KEY) instead.' },
    { id: 'template', text: 'Add "please run /contract-check" to the pull request template.',
      why: 'That is a reminder, and Friday proved reminders get skipped. A CI step runs every time.' },
    { id: 'server', text: 'Leave Claude Code open on the build server and type the command when a pull request arrives.',
      why: 'Someone still has to be there to type. Headless mode (claude -p) needs nobody.' },
  ],
};
const MODEL = {
  question: 'The check runs on about 40 pull requests a day. It compares fields against a schema: a clear, mechanical task. Which model should the pipeline use?',
  nudge: 'Bigger models reason more deeply but are slower and cost more per run.',
  options: [
    { id: 'small', correct: true, text: 'A fast, small model (--model haiku). If it misses things, move up a size.',
      why: 'A well-defined comparison doesn’t need deep reasoning, and a small model is faster and cheaper on every run. Save the larger models for hard problems, like planning how to move every app to the new field.' },
    { id: 'big', text: 'The biggest model, on every pull request, to be safe.',
      why: 'It works, but you pay for deep reasoning 40 times a day on a mechanical check, and every build waits longer. Start small and move up only if the results show you need to.' },
    { id: 'same', text: 'It doesn’t matter, the models are all the same.',
      why: 'They differ in speed, cost and how deeply they reason. Choosing per task is part of using Claude well (/model in a session, --model in a script).' },
  ],
};

export function startMission3(api) {
  const { $, learn, sfx, toast, runQuiz, goHub, markDone, showResult, showChoice } = api;
  const box = $('#m3');
  let step = 0, tickets = 37, mistakes = 0, busy = false, sorted = {}, done = false;
  const firstTry = {};   // step id -> true if the player chose right first time

  const wait = ms => new Promise(r => setTimeout(r, ms));

  function renderPipe() {
    const ol = $('#m3-pipe'); ol.textContent = '';
    STEPS.forEach((s, i) => {
      const li = document.createElement('li');
      li.className = i < step ? 'done' : i === step && !done ? 'now' : '';
      if (done) li.className = 'done';
      const n = document.createElement('span'); n.className = 'pn'; n.textContent = i < step || done ? '✓' : String(i + 1);
      const t = document.createElement('span'); t.textContent = s.name;
      li.append(n, t); ol.appendChild(li);
    });
    $('#m3-tickets').textContent = String(tickets);
  }

  function renderResponse(showKinds) {
    const pre = $('#m3-resp'); pre.textContent = '';
    for (const line of RESPONSE) {
      const s = document.createElement('span');
      s.className = 'ln' + (showKinds && line.kind ? ' drift ' + (sorted[line.kind] ? 'v-' + DRIFTS.find(d => d.id === line.kind).answer : 'open') : '');
      s.textContent = line.text + '\n';
      pre.appendChild(s);
    }
  }

  function renderSort() {
    const wrap = $('#m3-sort'); wrap.textContent = '';
    wrap.hidden = step < 1;
    for (const d of DRIFTS) {
      const row = document.createElement('div'); row.className = 'm3-row' + (sorted[d.id] ? ' ok' : '');
      const h = document.createElement('div'); h.className = 'm3-row-h';
      const f = document.createElement('code'); f.textContent = d.field;
      const w = document.createElement('span'); w.textContent = d.what;
      h.append(f, w);
      const btns = document.createElement('div'); btns.className = 'm3-verdicts'; btns.setAttribute('role', 'group'); btns.setAttribute('aria-label', `Verdict for ${d.field}`);
      for (const v of VERDICTS) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'm2-chip radio' + (sorted[d.id] && v.id === d.answer ? ' on' : '');
        b.textContent = v.label; b.dataset.v = v.id;
        b.disabled = !!sorted[d.id] || step !== 1;
        b.onclick = () => judge(d, v.id);
        btns.appendChild(b);
      }
      row.append(h, btns);
      if (sorted[d.id]) { const p = document.createElement('p'); p.className = 'm3-why'; p.textContent = d.right; row.appendChild(p); }
      wrap.appendChild(row);
    }
  }

  function renderFiles() {
    $('#m3-cmd-card').hidden = step < 3 && !done;
    $('#m3-cmd').textContent = COMMAND_FILE;
    $('#m3-yml-card').hidden = step < 4 && !done;
    $('#m3-yml').textContent = WORKFLOW;
  }

  const JOB = [
    { h: 'Your job: find out what changed', p: 'The app broke on Friday, and every API test still passes. Ask Claude the right question.', btn: 'Ask Claude →' },
    { h: 'Your job: sort each change', p: 'Claude found 4 differences between the contract and the real response. Mark each one: does it break apps, leak personal data, or is it safe?', btn: null },
    { h: 'Your job: make the check reusable', p: 'Marco has fixed the API. You’ll need this check again for every endpoint, and so will your team. Save it as a command.', btn: 'Save the check →' },
    { h: 'Your job: run it on every pull request', p: 'A command still needs someone to type it. Make the pipeline run it on every pull request, without anyone remembering.', btn: 'Set up the pipeline →' },
  ];
  function renderJob() {
    const j = done ? { h: 'Done: drift can’t sneak in any more', p: 'Pull request #219 was blocked before merging.', btn: null }
      : JOB[step] || { h: 'Watch the pipeline', p: 'Marco just opened a new pull request. Your check runs on it now.', btn: null };
    $('#m3-job-h').textContent = j.h;
    $('#m3-job-p').textContent = j.p;
    const b = $('#m3-go');
    b.hidden = !j.btn; if (j.btn) b.textContent = j.btn;
    b.disabled = busy;
  }

  function render() { renderPipe(); renderResponse(step >= 1); renderSort(); renderFiles(); renderJob(); }

  async function wrong(o, concept) {
    mistakes++; tickets += 9;
    sfx.glitch();
    render();
    await showResult({ title: 'Not quite', tone: 'bad', concept, body: o.why, found: ['Meanwhile, 9 more support tickets came in. Try again.'] });
  }

  // Ask the question until the player picks the right answer.
  async function ask(spec, concept, key) {
    for (;;) {
      const o = await showChoice(spec);
      if (o.correct) { if (!(key in firstTry)) firstTry[key] = true; return o; }
      firstTry[key] = false;
      await wrong(o, concept);
    }
  }

  async function judge(d, v) {
    if (sorted[d.id] || busy || step !== 1) return;
    if (v !== d.answer) {
      mistakes++; tickets += 3; firstTry.sort = false;
      sfx.glitch(); toast(d.wrong); render();
      $('#m3-sort').querySelectorAll('.m3-row')[DRIFTS.indexOf(d)]?.classList.add('shake');
      return;
    }
    sorted[d.id] = true; sfx.clue(); render();
    if (DRIFTS.every(x => sorted[x.id])) {
      if (!('sort' in firstTry)) firstTry.sort = true;
      busy = true; render();
      await showResult({ title: 'Two breaking changes and a privacy leak', concept: 'Reviews before merging', teach: 'review',
        body: 'All four came from Friday’s pull request #212, "Tidy member DTO". A review before merging would have caught them: /code-review flags renamed fields and changed types as breaking, and /security-review flags personal data newly exposed. Marco restores memberSince and tier, removes phone, and the support tickets stop.',
        cmd: '/code-review 212        (review a pull request)\n/security-review        (review the changes on your branch)' });
      step = 2; busy = false; render();
    }
  }

  async function next() {
    if (busy || done) return;
    busy = true; render();
    try {
      if (step === 0) {
        await ask(FIND, 'Passing tests vs the contract', 'find');
        sfx.card();
        $('#m3-claude').textContent = 'Claude: I called GET /members/42 on staging and compared it with openapi.yaml. I found 4 differences. They are highlighted in the response.';
        step = 1;
        render();
        await showResult({ title: 'The contract and the real response disagree', concept: 'Compare, don’t assume',
          body: 'The tests passed because they only check that the API answers. Claude compared what the API promises (openapi.yaml) with what it actually sends. Four lines are different. Next: sort them.' });
      } else if (step === 2) {
        await ask(WHERE, 'Custom slash commands', 'where');
        await ask(ARGS, 'Custom slash commands', 'args');
        step = 3; sfx.clue(); render();
        await showResult({ title: '/contract-check is ready for the whole team', concept: 'Custom slash commands', teach: 'commands',
          body: 'The file .claude/commands/contract-check.md is now a command. Type /contract-check /orders and Claude runs the whole check for /orders. The description line shows up when someone types / in Claude Code.',
          found: ['A skill (.claude/skills/contract-check/SKILL.md) can also be run as /contract-check, and can carry extra files. A single command file is the simplest start.'],
          cmd: '/contract-check /members' });
      } else if (step === 3) {
        await ask(CI, 'Headless mode in CI', 'ci');
        learn('headless');
        await ask(MODEL, 'Choosing a model', 'model');
        step = 4; sfx.clue(); render();
        await showResult({ title: 'The pipeline runs the check on every pull request', concept: 'Choosing a model', teach: 'model',
          body: 'claude -p runs /contract-check with nobody at the keyboard, using the small, fast model. --allowedTools lists what it may do without asking (read files, call curl), because in a pipeline there is nobody to say yes.',
          cmd: 'claude -p "/contract-check /members" --model haiku --allowedTools "Read" "Bash(curl *)"' });
        await finale();
      }
    } finally { busy = false; if (!done) render(); }
  }

  async function finale() {
    const out = $('#m3-ci'); out.textContent = '';
    $('#m3-ci-card').hidden = false;
    $('#m3-ci-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const fast = matchMedia('(prefers-reduced-motion: reduce)').matches;
    for (const line of CI_RUN) {
      const s = document.createElement('span');
      s.className = line.startsWith('✗') || line.includes('FAIL') ? 'ln bad' : line.includes('BREAKING') ? 'ln warn' : 'ln';
      s.textContent = line + '\n';
      out.appendChild(s);
      await wait(fast ? 40 : 260);
    }
    sfx.glitch();
    done = true; render();
    markDone('m3');
    sfx.win();
    await showResult({ title: 'Pull request #219 was blocked before it merged', concept: 'Drift caught automatically',
      body: 'Monday, 2:10 PM. Marco renamed status to state. Your check failed the build, so it never reached the apps. Marco: "Good catch. I’ll keep status and add state next to it."',
      found: ['Next: a quick knowledge check (skipped if you already aced it), then your results.'] });
    const q = await runQuiz('m3', 'post');
    showOutcome(q);
  }

  function showOutcome(q) {
    $('#o3-sub').textContent = mistakes
      ? `You got there with ${mistakes} wrong turn${mistakes > 1 ? 's' : ''}, and ${tickets - 37} extra support tickets piled up while you looked. Each wrong turn showed why the other options fail.`
      : 'No wrong turns: every step right the first time.';
    const stats = $('#o3-stats'); stats.textContent = '';
    const stat = (label, v) => { const d = document.createElement('div'); d.className = 'od-stat'; const l = document.createElement('span'); l.textContent = label; const b = document.createElement('b'); b.textContent = v; d.append(l, b); stats.appendChild(d); };
    stat('Changes found', '4 of 4');
    stat('Right first time', `${Object.values(firstTry).filter(Boolean).length} of ${Object.keys(firstTry).length}`);
    stat('Support tickets', String(tickets));
    if (q && q.aced) stat('Knowledge check', '5/5 earlier');
    if (q && q.score != null) stat('Knowledge check', q.before != null ? `${q.before}/${q.total} → ${q.score}/${q.total}` : `${q.score}/${q.total}`);
    $('#o3-cmd').textContent = COMMAND_FILE;
    $('#o3-yml').textContent = WORKFLOW;
    const ul = $('#o3-learn'); ul.textContent = '';
    for (const id of ['review', 'commands', 'headless', 'model']) {
      const g = api.BY_ID[id]; if (!g) continue;
      learn(id);
      const li = document.createElement('li');
      const b = document.createElement('b'); b.textContent = g.name;
      const p = document.createElement('span'); p.textContent = g.how;
      li.append(b, p); ul.appendChild(li);
    }
    box.hidden = true;
    $('#m3done').hidden = false;
    $('#m3done').scrollTop = 0;
  }

  function reset() {
    step = 0; tickets = 37; mistakes = 0; busy = false; sorted = {}; done = false;
    for (const k of Object.keys(firstTry)) delete firstTry[k];
    $('#m3-claude').textContent = 'Claude: Waiting for your request.';
    $('#m3-ci-card').hidden = true;
    $('#m3done').hidden = true;
    render();
  }

  const copy = async (sel, what) => { try { await navigator.clipboard.writeText($(sel).textContent); toast(`${what} copied`); } catch (e) { toast('Select the text and copy it'); } };
  $('#m3-go').onclick = next;
  $('#m3-back').onclick = () => { box.hidden = true; goHub(); };
  $('#o3-copy-cmd').onclick = () => copy('#o3-cmd', 'Command file');
  $('#o3-copy-yml').onclick = () => copy('#o3-yml', 'Workflow');
  $('#o3-hub').onclick = () => { $('#m3done').hidden = true; goHub(); };
  $('#o3-again').onclick = () => { reset(); box.hidden = false; box.scrollTop = 0; };
  $('#m3-contract').textContent = CONTRACT;
  reset();
  box.hidden = false;
  box.scrollTop = 0;
  $('#m3-go').focus({ preventScroll: true });
}
