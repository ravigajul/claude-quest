// Before/after knowledge check: the same 5 real-world questions at the start and end of a mission,
// so the player can see what they learned. Before: no feedback. After: feedback and the score change.

export const QUIZ = {
  m1: [
    { q: 'You start a new Claude Code session tomorrow. What does Claude remember from today?',
      options: ['Everything from today\'s session', 'Nothing, unless it is written in CLAUDE.md or other files', 'The last 10 messages', 'Only the errors it hit'],
      a: 1, why: 'Every session starts empty. CLAUDE.md is read at the start of every session, so lasting knowledge belongs there.' },
    { q: 'A test failed and the CI log is 60,000 lines. What should Claude do first?',
      options: ['Read the whole log so nothing is missed', 'Search the log for the failing line', 'Paste the log into the chat', 'Re-run the job and hope it passes'],
      a: 1, why: 'Reading everything floods the context window. Search for the failure, then read only what matters.' },
    { q: 'Claude sends a subagent to explore the codebase. What comes back into your main session?',
      options: ['Everything the subagent read', 'A short summary of what it found', 'Nothing at all', 'A copy of every file it opened'],
      a: 1, why: 'A subagent works in its own context and returns only a summary, which keeps your main session small.' },
    { q: 'Claude asks to run rm -rf on an old build folder. What is the best permission to give?',
      options: ['Allow once, for this command', 'Always allow rm -rf in every session', 'Switch to bypass-permissions mode', 'Deny every delete, forever'],
      a: 0, why: 'Give the smallest permission that works. Destructive commands should never be on an always-allow list.' },
    { q: 'You want the tests to run after every edit, even if Claude forgets. What do you use?',
      options: ['A note in CLAUDE.md', 'A hook in settings.json', 'Plan mode', 'A bigger model'],
      a: 1, why: 'Hooks are run by Claude Code itself on events, so they never depend on anyone remembering.' },
  ],
  m2: [
    { q: 'You want test cases in your team\'s exact format. What works best?',
      options: ['Describe the format in a sentence', 'Paste one example test case in that format', 'Ask for "a good format"', 'Ask twice'],
      a: 1, why: 'One real example beats a paragraph of description. Claude copies structure and level of detail from it.' },
    { q: 'The user story is vague. What is the best first step?',
      options: ['Let Claude assume the details', 'Ask Claude to ask you clarifying questions first', 'Add more adjectives to the prompt', 'Switch to a bigger model'],
      a: 1, why: 'Hidden rules live in people\'s heads. Asking first turns guesses into facts.' },
    { q: 'Claude writes a test for a rule nobody ever stated. How do you prevent that?',
      options: ['Ask it to be more careful', 'Say: only include cases you can trace to a source, and list assumptions as open questions', 'Make the prompt shorter', 'Tell it to try harder'],
      a: 1, why: 'A grounding rule gives unknowns somewhere to go (open questions) instead of being invented.' },
    { q: 'Some rules (field length, disabled buttons) only show on the design. Fastest way to give them to Claude?',
      options: ['Describe the design from memory', 'Paste a screenshot of the design', 'Skip them, they are minor', 'Wait for the developer'],
      a: 1, why: 'Claude reads images. A screenshot carries details nobody remembers to type.' },
    { q: 'You will import the results into your test management tool (Azure DevOps, Jira and so on). What should you ask for?',
      options: ['A short essay', 'Bullet points', 'A CSV with named columns that match the import', 'Markdown headings'],
      a: 2, why: 'Ask for exactly the structure the next tool needs, and the output becomes copy-and-paste ready.' },
  ],
};

import { track } from './stats.js?v=20261127155400';

const $ = s => document.querySelector(s);

function key(m) { return `cq-quiz-${m}-pre`; }
function postKey(m) { return `cq-quiz-${m}-post`; }
export function postScore(m) { try { const v = localStorage.getItem(postKey(m)); return v == null ? null : Number(v); } catch (e) { return null; } }
const autoSkipped = {};   // missions whose checks are skipped this round because the player already aced them
export function preScore(m) { try { const v = localStorage.getItem(key(m)); return v == null ? null : Number(v); } catch (e) { return null; } }

// phase 'pre': no feedback, can be skipped. phase 'post': feedback per question, then before→after.
export function runQuiz(mission, phase) {
  const qs = QUIZ[mission];
  const box = $('#quiz');
  let i = 0, score = 0;
  const last = postScore(mission);
  // Already answered everything right at the end of a previous run: don't ask the same questions again.
  if (phase === 'pre' && last === qs.length) { autoSkipped[mission] = true; return Promise.resolve({ skipped: true, aced: true }); }
  if (phase === 'pre') autoSkipped[mission] = false;
  if (phase === 'post' && autoSkipped[mission]) return Promise.resolve({ skipped: true, aced: true });
  return new Promise(resolve => {
    const finish = () => {
      if (phase === 'pre') {
        try { localStorage.setItem(key(mission), String(score)); } catch (e) {}
        track(`${mission}-quiz-before-${score}of${qs.length}`, `${mission} knowledge check before: ${score}/${qs.length}`);
        box.hidden = true;
        resolve({ score, total: qs.length });
        return;
      }
      try { localStorage.setItem(postKey(mission), String(score)); } catch (e) {}
      track(`${mission}-quiz-after-${score}of${qs.length}`, `${mission} knowledge check after: ${score}/${qs.length}`);
      const before = preScore(mission);
      $('#qz-tag').textContent = 'Knowledge check · results';
      $('#qz-pips').textContent = '';
      $('#qz-q').textContent = before == null ? `You scored ${score} of ${qs.length}` : `Before: ${before}/${qs.length}  →  Now: ${score}/${qs.length}`;
      $('#qz-sub').textContent = before == null ? '' : score > before ? `You answered ${score - before} more correctly than when you started.` : score === qs.length ? 'Perfect, before and after.' : 'Look at the explanations above: those are the ideas to try at work this week.';
      $('#qz-opts').textContent = '';
      $('#qz-fb').hidden = true;
      $('#qz-skip').hidden = true;
      $('#qz-next').hidden = false;
      $('#qz-next').textContent = 'Continue';
      $('#qz-next').onclick = () => { box.hidden = true; resolve({ score, before, total: qs.length }); };
    };
    const show = () => {
      if (i >= qs.length) return finish();
      const q = qs[i];
      $('#qz-tag').textContent = phase === 'pre' ? `Before you start · question ${i + 1} of ${qs.length}` : `Knowledge check · question ${i + 1} of ${qs.length}`;
      const pips = $('#qz-pips'); pips.textContent = '';
      qs.forEach((_, k) => { const p = document.createElement('i'); if (k < i) p.className = 'on'; pips.appendChild(p); });
      $('#qz-q').textContent = q.q;
      $('#qz-sub').textContent = phase === 'pre' && i === 0
        ? (last != null ? `Last time you scored ${last}/${qs.length} at the end. Retake it to see what stuck, or skip it.` : 'Quick check of what you know now. No feedback yet: you will answer the same questions at the end and see what changed.')
        : '';
      $('#qz-fb').hidden = true;
      $('#qz-next').hidden = true;
      $('#qz-skip').hidden = false;
      const opts = $('#qz-opts'); opts.textContent = '';
      q.options.forEach((t, k) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'c-opt';
        const kk = document.createElement('span'); kk.className = 'c-key'; kk.textContent = 'ABCD'[k];
        const tx = document.createElement('span'); tx.textContent = t;
        b.append(kk, tx);
        b.onclick = () => {
          const right = k === q.a;
          if (right) score++;
          if (phase === 'pre') { i++; show(); return; }
          [...opts.children].forEach((c, n) => { c.disabled = true; if (n === q.a) c.classList.add('right'); else if (n === k) c.classList.add('wrong'); });
          const fb = $('#qz-fb');
          fb.textContent = (right ? 'Right. ' : 'Not quite. ') + q.why;
          fb.className = 'qz-fb ' + (right ? 'ok' : 'bad');
          fb.hidden = false;
          $('#qz-next').hidden = false;
          $('#qz-next').textContent = i + 1 < qs.length ? 'Next question' : 'See my score';
          $('#qz-next').onclick = () => { i++; show(); };
          $('#qz-next').focus({ preventScroll: true });
        };
        opts.appendChild(b);
      });
    };
    $('#qz-skip').onclick = () => {
      if (phase === 'pre') { try { localStorage.removeItem(key(mission)); } catch (e) {} }
      track(`${mission}-quiz-${phase === 'pre' ? 'before' : 'after'}-skipped`, `${mission} knowledge check ${phase === 'pre' ? 'before' : 'after'}: skipped`);
      box.hidden = true; resolve({ skipped: true });
    };
    box.hidden = false;
    show();
  });
}
