---
name: game-review
description: Review and test the "5:00 PM Forever" game (claude-quest) before it ships. Use before committing or pushing a change to the game, when asked to "review the game", "test the game", "check before deploy", or after any change to index.html, game/*.js, README.md or the build. Runs the automated play tests, then a playthrough, accessibility, plain-language, code and GitHub-page review, and reports findings for approval.
---

# Game review: 5:00 PM Forever

The game lives in `~/Downloads/claude-quest` (the source; not a git repo). `build_pages.py` copies it into a checkout of github.com/ravigajul/claude-quest, which deploys to https://ravigajul.github.io/claude-quest/. PLAN.md ("START HERE") has the current state and Ravi's design rules; read it first.

## 1. Automated play tests (always, before any commit or push)

```bash
cd ~/Downloads/claude-quest/tests
npm install            # first time only
npx playwright install chromium   # first time only
npm test
```

- `game.spec.js`: laptop size. Mission 1 played to the end by a bot, day 1 can't be won (A1), the tour is truthful (A4), the top-bar layout, the Missions button, keyboard (Tab stays in pop-ups, Escape continues), Mission 2 never strands the player (A2) and locks the prompt while Claude thinks (A6).
- `phone.spec.js`: Pixel 7. Jar, board and side panels visible, card explanations shown, full-width "Your job" text, Level and Day side by side.
- `files.spec.js`: LICENSE is plain MIT, link preview tags and `social.png`, README credit and privacy note, and no private email in any shipped file.

All must pass. A failing test blocks the commit (Claude Code hook) and the deploy (GitHub Actions `test` job). Never skip, weaken or delete a test to make it pass; fix the game, or ask Ravi if the test is wrong.

**Every confirmed bug gets a test.** When a review finds a real bug, add a test named after it (e.g. `A7: ...`) in the matching spec file, then fix the bug so it passes.

## 2. Review passes (when asked for a review, or after a big change)

Do them in this order and keep notes for the report.

1. **Playthrough.** The tests' bot covers the happy path. Also play the odd paths by hand with Playwright: wrong answers, a blackout (Read the entire repo), leaving with "← Missions", Mission 2 with every chip, and reloading mid-mission. Watch for console errors and text that contradicts what happened.
2. **Accessibility (WCAG 2.1 AA).** Load the `design:accessibility-review` skill if available. Check:
   - contrast of all visible text (script: blend each element's colour over its stacked backgrounds; hidden or opacity-0 text is not a failure);
   - keyboard: Tab order, focus visible, Tab trapped in the open pop-up, Escape;
   - touch targets on phone;
   - text size XL (the Aa button) at 1366×768 and 390×844;
   - reduced motion.
3. **Plain language.** Load `zizi-skills:plain-language` if available. Players may have no AI background: every AI term needs a one-line explanation where it first appears (primer, tour, card blurb or Field Guide). Card blurbs must be visible on touch screens.
4. **Code.** Run `/code-review medium` on the repo checkout or on `~/Downloads/claude-quest/game`. Check each finding in the code before reporting it as confirmed; mark the rest "reported, not reproduced".
5. **GitHub page.** Load `github-portfolio-builder` if available. Check the README (screenshot, credit "Created by Ravi Gajul, built together with Claude"), licence detection (`gh repo view ravigajul/claude-quest --json licenseInfo`), topics, the link preview (`pages_head.html`, `social.png` 1200×630), and the privacy notes (GoatCounter, Google Fonts).

Test at 1366×768, 900×760 and 390×844 at least. A local `python3 -m http.server` serves HTML without a charset, so "Â·" in local screenshots is not a bug; for screenshots that will be published, serve with `charset=utf-8`.

## 3. Report, then fix only what Ravi approves

Report in the terminal, grouped as: A. bugs (confirmed vs reported), B. accessibility, C. plain language, D. GitHub page, then a suggested fix order. Plain words, short sentences, a table where it helps. Ask before fixing.

After fixing: add or update tests, run `npm test` until green, then deploy both:
1. Artifact: publish `index.html` with the changed `game/*.js` (Artifact tool, same file path).
2. Pages: `python3 ~/Downloads/claude-quest/build_pages.py <repo checkout>`, commit, push, and watch the run. The `test` job must pass before `deploy` runs.

Add a dated line to the end of PLAN.md for what changed.
