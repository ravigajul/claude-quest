# Plan: "5:00 PM FOREVER", a time-loop game where your save file is a real Claude setup

## START HERE (new session): current state, roadmap, rules
**Resume with:** "Read ~/Downloads/claude-quest/PLAN.md and continue the game." The newest changes are at the bottom of this file (change log v1.5 → latest).

**Live now (v1.9.7, 2026-11-27)**
- Artifact: https://claude.ai/artifact/ACLJPaKjgTxhyfcBvZabsZ. GitHub Pages: https://ravigajul.github.io/claude-quest/ (repo ravigajul/claude-quest)
- Mission 1 *Release Day* (3 levels, time loop, the player directs Claude) and Mission 2 *The Vague Story* (prompt builder → test cases for Azure DevOps or Jira) are playable.
- Missions 3–8 are "coming soon" cards in the hub (`index.html`, `.mission.locked`) with locked Field Guide concepts (`game/guide.js`, `MISSIONS` + `GUIDE`, 45 concepts total).

**Roadmap: missions to build (in order, unless Ravi says otherwise)**
| # | Mission | Story | Teaches | Game idea (draft) |
|---|---|---|---|---|
| 3 | Contract Drift | An API changed silently and the tests still pass | /review, custom slash commands, headless `claude -p` in CI, choosing a model | Diff a contract vs the real response; save the check as a /command; wire it into CI; a model-choice trade-off |
| 4 | Night Shift | Three tasks, one night, several Claudes at once | Resuming sessions, worktrees, custom subagents, plugins | Run parallel sessions on separate worktrees; resume yesterday's; package the setup as a plugin |
| 5 | Flaky Friday | The E2E suite fails one run in five; demo on Monday | Browser testing (Claude in Chrome / Playwright MCP), screenshots and traces, re-run only what failed, fix the cause not the retry | Reproduce a race by looping one test; read the trace; reject "add a wait" |
| 6 | The Legacy Repo | Day one on a 15-year-old codebase with no docs | /init, asking questions about a codebase, the Explore subagent, keeping CLAUDE.md short | Map the repo cheaply; trim a bloated CLAUDE.md to the lines that matter |
| 7 | Red Team | Hidden instructions in a page Claude reads; a secret in .env | /security-review, deny rules for secrets, sandboxing, prompt injection | Spot the injected instruction; write deny rules; choose what to sandbox |
| 8 | The Review Bot | 40 pull requests a day | Claude in GitHub Actions, @claude in PRs, review rules in CLAUDE.md, humans approve | Configure a review bot; catch it about to merge; write reviewer rules |
When a mission goes live: change its card from `.mission.locked` to a button (`go-mN`), set `status: 'live'` in `MISSIONS`, fill in `how`/`tryIt` for its `GUIDE` concepts, add 5 knowledge-check questions in `game/quiz.js` (`QUIZ.mN`), add `cq-done-mN` status in `showHub()`, and write a `game/missionN.js` like `mission2.js`.

**Player statistics: LIVE since 2026-11-27.** Dashboard: https://ravigajul-claudequest.goatcounter.com (Ravi's account; code `ravigajul-claudequest`, already set in build_pages.py). To switch on: set `GOATCOUNTER_CODE = '<code>'` in `build_pages.py` and deploy to Pages. Code: `game/stats.js` (`track(name, title)`; does nothing where no counter script is loaded, i.e. the artifact and localhost). The counter script is saved in `vendor/goatcounter/count.js` (ISC license) and loaded with `no_onload`, so stats.js counts the page view itself, skipping the reload from "← Missions". Events sent: `m1-start`, `m1-day-2/3`, `m1-left-day-N`, `m1-done`, `m2-start`, `m2-done`, `mN-quiz-before|after-XofY` or `-skipped`, `mN-like-yes|no`. 👍/👎 show only when stats are on; the "Tell Ravi what you think" link (GitHub Issues) always shows. Stats are stored on GoatCounter's servers, so deploys never wipe them. Tested 2026-11-27 with a dummy code on a non-localhost address: every event was sent.
Background (original note): the game counts nothing today. The claude.ai artifact shows no stats to us, and its security settings probably block outside scripts (not tested). GitHub Pages has no visitor stats; repo Insights → Traffic only counts people viewing the code.
- Plan: **GoatCounter** (free for non-commercial use, open-source, no cookies, no personal data, so no cookie banner), on the GitHub Pages build only. Promote the Pages link, since only plays there are counted.
- **Blocked on Ravi:** sign up at goatcounter.com and send the site code (for example `claude-quest`). Never sign up for him or use his email.
- Once we have the code, track:
  - visits, countries and where visitors came from
  - events: `m1-start`, `m1-day-N`, `m1-done`, `m2-start`, `m2-done`
  - knowledge-check scores before and after
  - a 👍 Liked it / 👎 Not for me button on the end screens
- Written feedback: a "Tell Ravi what you think" link to a free Google Form or the repo's GitHub Issues.
- **Exclude Ravi's own plays:**
  - Ravi opens `https://ravigajul.github.io/claude-quest/#toggle-goatcounter` once on each device he uses.
  - localhost isn't counted, so local Playwright testing never shows up.
  - Add the script tag in `build_pages.py`, so the artifact build stays free of outside scripts.

**Other open ideas (not started):** live-Claude finale (`sample` capability: a fresh Claude plays with only your notes); give Mission 1's ending the same outcome screen as Mission 2; co-op mode; team speedrun board.

**Rules Ravi has set (keep following them)**
- The player is the **developer directing Claude**, never the AI. Explain for people with no AI background (the 1-minute primer exists for that).
- Always show what to do next; make context and its cost visible (the jar); explain *why* (each day = a new Claude session).
- Only real Claude / Claude Code features and commands. Plain words, short sentences.
- 3D/animated, free and open-source only, zero hosting cost, no CDN (Three.js vendored).
- Credit: "Created by Ravi Gajul, built together with Claude". Never put Ravi's email anywhere public.
- Test locally with Playwright before publishing; deploy to **both** the artifact and GitHub Pages.

**Deploy**
(README.md and PLAN.md: edit the copies in ~/Downloads/claude-quest; build_pages.py copies both into the repo.)
1. Artifact: Artifact tool publish, `file_path` = index.html, `files` = the changed `game/*.js` (capabilities carry forward).
2. Pages: clone ravigajul/claude-quest, run `python3 ~/Downloads/claude-quest/build_pages.py <checkout>` (wraps the page, cache-busts imports, copies PLAN.md as a backup; if this Mac copy is lost, get PLAN.md back from the repo), commit, push, and watch the Pages run (`gh run watch`).

## Original plan (2026-11-26, kept for history)

## Context
Ravi wants a standout game, not training content, that teaches developers and testers the Claude concepts they use at work. It should be prototyped small first, have 3D and animation, be published as a Claude artifact, and use only free, open-source tools with zero hosting or maintenance cost. `~/Downloads/claude-quest` is empty, so we start from scratch. The brief: surprise me, and make something that doesn't exist yet.

## The idea in one line
**You are an AI agent stuck in a time loop on release day. Every loop you wake up with amnesia. The only things that survive are what you wrote down.**

That isn't a metaphor laid on top of Claude. It *is* how Claude works:
| In the game | In real Claude |
|---|---|
| Each loop starts with total amnesia | Each new session starts with an empty context |
| Glowing notes your past self left behind | `CLAUDE.md` / memory |
| A ritual you can carve once and replay instantly | A **skill** |
| A trap you set: "whenever X happens, do Y" automatically | A **hook** |
| A portal to knowledge outside the city | An **MCP** connector |
| A clone you send out; only its summary comes back | A **subagent** |
| Your mind's capacity: a tank that floods as you read | The **context window** / tokens |
| Mid-loop blackout where memories shatter | **Compaction** |
| Guessing a plausible answer that turns out false | **Hallucination** (verify first) |
| A force field before destructive commands | **Permissions** |
| Freezing time to draw the route before moving | **Plan mode** |

Nobody learns this as a list of terms. You *discover* each one because you need it to break the loop, the way knowledge unlocks progress in Outer Wilds or Returnal. Every death teaches something.

## Three twists that make it new
1. **Your save file is real.** Your notes, carved skill and hook are written in real format the whole time. At the end you download a working `CLAUDE.md`, a `SKILL.md` and a `settings.json` hook that you can drop into Claude Code at work the next day. The game's progress *is* the work setup.
2. **The final boss is a real AI.** To break the loop, you hand your setup to a *fresh agent that isn't you*: actual Claude, through the artifact's built-in "ask Claude" capability, so there's no API key or cost. It gets only what you wrote down and plays the final loop live while you watch. If your notes are vague, real Claude fails in real, specific ways. If they're good, the clock passes 5:00 PM for the first time and the world shatters into morning. (If the capability isn't available, a scripted fallback agent plays instead.)
3. **Role reversal built in.** You spend the loops as the agent suffering vague instructions and floods of context. So when you finally write the briefing for someone else, you write the briefing you wish you'd had. That's the empathy that makes people good at using Claude.

## BUILD NOW: mini prototype v0.1 (~5 min of play), then feedback, then iterate
A thin vertical slice to test whether the core loop is fun: **amnesia → die → write notes → wake smarter → win.**
- **Loop 1:** no notes. Cards: Read CI log / Grep / Read file / Guess fix. The tank floods, the blackout hits, the clock wins. Etch 3 notes (choose from note cards plus one free-text line).
- **Loop 2:** your tablets glow on the floor. You unlock **Send Clone** (subagent) and the **MCP portal**. The fake "add retry" fix triggers a hallucination glitch. Verifying and fixing makes the clock pass 5:00 and the sky turns to sunrise.
- **End screen:** a mini Mirror (your run as a Claude Code transcript) and a **download of the real `CLAUDE.md`** built from your notes.
- **3D in v0.1:** the city with its sky clock, the token tank with particles and blackout, the clone flight, the portal, the rewind effect, the sunrise, and bloom. The 2D fallback is basic.
- **Deferred to the next iterations, based on feedback:** Loop 3 (plan mode, permissions, skill, hook), the live-Claude finale, the full scoring set, audio polish, and mobile tuning.
- After publishing, I give the link and a handful of quick feedback questions (fun? clear? which concept landed? what felt like "training"?). Each iteration republishes to the same artifact link.

## Full prototype target (after iterations): 3 loops + finale (~12–15 min)
**Mission:** 4:55 PM release day. Dana (a dev NPC): *"checkout tests are broken, fix it pls."* Hidden truth: a timezone bug in a test fixture fails `test_checkout_discount` only after 17:00 UTC.

- **Loop 1, amnesia (built to fail):** no notes. You read the 60k CI log, the tank floods, a blackout hits, and the clock wins. At death, you may etch **3 notes** onto memory tablets for next time. *Teaches context, tokens and compaction.*
- **Loop 2, the clone and the portal:** your notes help. You unlock **Send Clone** (a subagent explores the file-tower city and returns a small summary orb) and the **MCP portal** (the ADO ticket floats through with the key clue). A tempting "just add retry" fix lights up. Taking it is a hallucination, and the screen glitches. *Teaches subagents, MCP and verify-before-claim.*
- **Loop 3, ritual and trap:** you reach the fix with time left, but the `rm -rf test-results` force field appears (*permissions*). You use **Freeze Time** (*plan mode*). Then you **carve a ritual** (*skill*: "triage a flaky test") and **set a trap** (*hook*: run tests after every edit).
- **Finale, the handoff:** a fresh Claude plays with only your notes, skill and hook. You get a win or fail, plus the **Mirror**: a replay showing your loops as a real Claude Code transcript and your downloadable save file.

Scores: **Truth** (the right fix), **Trust** (Dana's faith; hallucinations and unsafe acts drain it), **Tokens** (efficiency), and **Loops** (fewer is better). These are not quiz percentages.

## Look & feel: real-time 3D, animated throughout
- **World:** a nighttime codebase city of glowing file towers under a huge clock in the sky, frozen at 4:55. Each loop rewinds with a reverse-time effect: particles fly backward and towers rebuild.
- **The Context Tank:** a glass cylinder of instanced glowing token particles floating beside you. Reading floods it. A blackout is a vortex that crushes it, and memory cards shatter.
- **Memory tablets:** carved stone tablets that glow on the city floor at the start of each loop. Your own words from the last loop, materializing.
- **Clone:** a translucent copy of you splits off, flies through the towers and returns with a summary orb.
- **MCP portal:** a ring tears open in the sky.
- **Force field:** a hex-shield wall drops in front of the dangerous card.
- **Freeze Time:** the world desaturates, and a glowing route draws itself across the city.
- **Loop break:** the clock hand finally moves past 5:00 and the night sky cracks into sunrise.
- Effects: bloom, a chromatic glitch on hallucination, camera shake, and synthesized WebAudio (a ticking clock that speeds up near 5:00), with a mute toggle.
- Accessibility: an animated 2D fallback when WebGL is missing, `prefers-reduced-motion` support, and phone and desktop layouts.

## Tech stack (open source, zero cost to build, host and maintain)
| Need | Choice | Cost |
|---|---|---|
| 3D | **Three.js** + its `UnrealBloomPass` addon | MIT, free |
| Animation | Our own small tween/easing module | No dependency |
| Sound | WebAudio API, synthesized (no audio files) | Built in |
| Hosting | **Claude artifact** | Free, no server |
| Live final boss | The artifact's "ask Claude" capability, which runs on the player's own Claude account | No key, no backend |
| Save-file download | The artifact's file-download capability, or a Blob download | Built in |

- **No CDN at runtime.** Three.js is fetched once with `npm pack three` into a separate folder, its version and license are checked, and it's copied into `vendor/`, then published inside the artifact. It's fully self-contained.
- No build step, no servers, no accounts, nothing to maintain.

## Files: `~/Downloads/claude-quest/`
- `index.html`: shell, HUD (clock, scores, dialogue), 2D fallback
- `game/engine.js`: loop state machine, memory persistence between loops, scoring, Mirror transcript and save-file generator (CLAUDE.md / SKILL.md / hook JSON)
- `game/mission-release-day.js`: mission **data** (cards, token costs, clues, outcomes). New missions are new data files.
- `game/scene3d.js`: city, tank, clone, portal, force field, rewind and sunrise
- `game/fx.js`: tweens, audio, glitch, shake
- `game/finale.js`: live-Claude handoff (with a strict judging prompt) plus the scripted fallback
- `vendor/three/`: vendored Three.js and its postprocessing addons

Before writing: load the `artifact-design` and `artifact-capabilities` skills (for ask-Claude and download). Publish as a **private** artifact with every file in the `files` map, and give Ravi the link.

## Verification
1. In Chrome, play three routes: the best path, the flood/blackout path, and the hallucination path. Check scores, memory carry-over and the Mirror.
2. Finale: one good set of notes (live Claude should win) and one vague set (it should fail for clear reasons). Check that the fallback runs when the capability is off.
3. Open the downloaded `CLAUDE.md`, `SKILL.md` and hook JSON and check they're valid, real Claude Code formats.
4. Check for no console errors, about 60 fps on a laptop, that the WebGL-off fallback works, and that phone width, mute and reduced motion all work.
5. Publish and give Ravi the link plus a one-line "try this first".

## Later (not in the prototype)
More time-loop missions (API contract drift, a flaky E2E suite, a security review), co-op mode (one player is the agent, the other writes the briefing live), and team "speedrun" boards for fewest loops.

---

## Build status (keep updated each session)
**v0.1 (2026-11-26), built:** Loops 1–2, the 3D city, sky clock, context tank (pour and blackout), clone flight, MCP portal, rewind, sunrise, bloom, hallucination glitch, memory etching (3 tablets + a free line), the Mirror transcript, concepts, and a CLAUDE.md copy/download.

**How to resume in a new session:** "Read ~/Downloads/claude-quest/PLAN.md and continue the game."

**Files**
- `index.html`: shell, CSS, HUD, intro/etch/mirror screens
- `game/mission.js`: mission data (clues, lessons, cards, concepts). Balance: each loop is 12 minutes (4:48→5:00). Loop 1 is unwinnable by design.
- `game/engine.js`: state machine, cards, blackout/compaction, hallucination, etch, win, Mirror, CLAUDE.md builder
- `game/scene3d.js`: Three.js world and animation API (setClock, setLevel, blackout, sendClone, openPortal, rewind, sunrise, resetDay)
- `game/fx.js`: tweens and synthesized WebAudio
- `vendor/three/`: three@0.160.1 (MIT) + postprocessing addons, with imports rewritten to relative paths (no CDN)

**Run locally:** `cd ~/Downloads/claude-quest && python3 -m http.server 8765`, then open http://localhost:8765. ES modules don't load over file://.
**Publish:** Artifact tool, `file_path` index.html, `files` map = every file under game/ and vendor/, `capabilities: {downloads: true}`.

**Next iterations (pending feedback):** Loop 3 (plan mode, permissions force field, skill, hook), live-Claude finale (`sample` capability), SKILL.md + hook JSON in the save file, audio polish, mobile tuning.

**v0.2 (2026-11-26), clarity pass, after feedback: "confusing what I'm doing and what prompts are displayed"**
- A "How to play" briefing before Loop 1 ("You are Claude. Dana is your user. Cards are your tools.")
- Dana's prompt pinned on screen with the label "The prompt you are working on"
- The goal list shows 3 questions (What is failing? What does the code assume? Why only now?), then Edit fix, then Run tests
- A result panel after every card: plain title, concept tag, what you found, "At work" lesson, and the real Claude Code action
- Terminal speakers relabeled: narrator / Dana · your user / you · Claude / tool call / your notes · CLAUDE.md

**v0.3 (2026-11-26), after feedback: "still not clear what as a player I'm supposed to be doing"**
- A "Your job right now · Step N of 5" bar above the cards, always showing the next objective and a hint (`objective()` in engine.js)
- The recommended card glows and gets a "Try this" tag
- Briefing cut to one goal sentence ("Fix Dana's broken tests before 5:00 PM") plus 3 steps
- The etch screen says plainly that loop 1 failing is expected, and explains the notes
- Open question for the next session: does the guidance make it too easy? Consider showing hints only in loop 1.

**v0.4 (2026-11-26), feedback: "give the clues if the user is taking a long time"**
- Hints escalate on idle: the step text is always shown, the hint text fades in after 12s, and the TRY THIS card glow appears after 25s. Timers reset after each card. Tune `HINT_TEXT_MS` / `HINT_CARD_MS` in engine.js.
- The Mirror says how many card hints were used.

**v0.5 (2026-11-26), feedback: "objective text invisible over bright light; clues too easy, not making the user think"**
- Gameplay reworked into an investigation. Cards reveal RAW evidence (log lines, code, Dana's reply, ticket), never conclusions. 5 evidence items: fail, fixture, morning, active (checkout.py), utc.
- New cards: Ask Dana (clarifying question), Read checkout.py, Diagnose (needs at least 2 evidence), and Edit, which opens a fix choice.
- Diagnose: 4 options of equal length, shuffled. Wrong answer = trust -10, +1 min, explained against the evidence. Fix: 4 options; weakening or skipping the test = trust -25/-15 (teaches "agents game tests"); "ask infra" = -3 min.
- Hints nudge thinking ("Morning green, evening red. What clock is CI using?"), not answers. The choice screens show a nudge after 15s.
- Etch can keep evidence, the root cause (skips diagnosis next loop) or lessons.
- Objective bar is now solid; the tank is moved up and the glow toned down.
- Verified locally: loop 1 fails → etch → loop 2 wins, with a wrong diagnosis and a bad fix along the way.

**v0.6 (2026-11-26), feedback: "font too small for some users"**
- Base text is now 112.5% (all sizes are in rem). The "Aa" button in the top bar cycles normal / large (125%) / extra large (140%) and is saved in localStorage (`cq-textsize`).
- Layout: the objective bar sits in the left column ("obj rail" grid area) so it never covers the case file or terminal; rail panels scroll internally.

**v0.7 (2026-11-26), feedback: "bad UI", "lots of empty space", "text over the clock is glaring", "didn't know the cards scroll"**
- Layout: a 3-column grid uses the full screen. Left = 3D context tank. Centre = **Evidence board** with 5 slots ("? Not found yet" until found). Right = Dana's request, Progress steps, Messages. Below = a full-width job bar, then cards stretched across one row (no horizontal scrolling; spent cards hidden, locked cards merged into one tile, descriptions on hover).
- Removed the floating prompt banner. Messages no longer repeat tool calls (the result pop-ups show them).
- Readability: solid top bar and panels; bloom lowered 0.7→0.45; clock ring dimmer.

**v0.8 (2026-11-26), feedback: "lost the page when font adjusted, tiles don't fit"**
- The text-size button no longer scales the root font. It sets `--rs` (reading text: 1 / 1.18 / 1.36) and `--cs` (cards: 1 / 1.06 / 1.12); reading elements use `calc(<base> * var(--rs))`.
- Safety: `#hud` scrolls vertically (pointer-events on) and the main row is at least 15rem, so content is never clipped.
- Verified at 1366×700 at XL: 7 cards in one row, no horizontal overflow.

**v0.9 (2026-11-26), feedback: "tiles not hiding behind the scroll", "load in maximized window"**
- The Evidence board heading is sticky; tiles scroll under it.
- Full screen: the Wake up click calls requestFullscreen (rejection ignored). A top-bar "Full screen / Exit full screen" toggle is hidden if the API is missing. A page can't maximize the browser window itself.

**v1.0 (2026-11-26), Loop 3 "Make it stick"**
- Twist: the first green run (normally Loop 2) triggers a false dawn (`scene.falseDawn()`): the clock stops at 5:00 and rewinds. "The loop breaks only when the fix sticks." Sets `S.greenOnce`.
- Phase "stick" cards (shown only after greenOnce): **Plan mode** (0 min, time frozen; choose 1 of 4 plans; the good plan gives -1 min on every action this loop and reveals the full disk), **Clean up** `rm -rf test-results/` (a permission force field: allow once ✓ / always allow −15 / bypass −20 / deny −1 min), **Carve a skill** (4 SKILL.md contents; the concrete steps one is correct), **Set a hook** (PostToolUse Edit|Write ✓ / every Bash / cron / fake "tests passed" −20).
- Verify in stick phase: first fails with "No space left on device" unless cleaned. Win = verified + skill + hook. Skill and hook persist across later loops (they're files, like notes).
- Once diagnosed, investigation cards hide (less clutter).
- Mirror shows 3 real files with Copy/Download: CLAUDE.md, SKILL.md (.claude/skills/triage-failing-test/), settings.json hooks.
- Overlays (mirror/etch/brief) hide the HUD (`body:has(...)`), so text never sits on text.
- Verified locally: full 3-loop playthrough (L1 fail → L2 green → false dawn → L3 plan/fix/permission/test/skill/hook → mirror with 3 files).
- Balance: Loop 3 without plan mode is exactly 12 minutes with no mistakes, so plan mode is effectively required.

**v1.1 (2026-11-26): Field Guide, levels, per-level colour themes** (feedback: "not sure what concepts I learned", "not clear if same level or moved up", "change colour scheme per level, very evident")
- `game/guide.js`: 28 concepts across 4 missions (m1 Release Day = 15 live; m2 The Vague Story, m3 Contract Drift, m4 Night Shift = 13 listed as coming soon). Each has what / how in Claude Code / try it at work. `CARD_TEACHES` maps card→concept.
- The first time a concept is met, the result modal shows a "★ New in your Field Guide" box (replaces the "At work" line). Learned set persists in localStorage `cq-learned`.
- Field Guide button in the top bar (`N/28`) opens a modal listing all concepts by mission.
- Levels: 1 Amnesia (loop 1), 2 The Clone and the Portal (until first green), 3 Make It Stick. Top bar shows `Level 2/3 · day N` + level name. A banner at each day start says "Level up" or "Same level · try again" with what's new and concepts added (memory and rewind at Level 2).
- Colour themes: body[data-level] repaints panels, cards, board, objective, top bar and a glowing screen frame (L1 navy/amber, L2 magenta/pink, L3 emerald/mint); `scene.setTheme(bg, fog)` changes the 3D sky.
- Mirror's concept list is now the Field Guide (learned first, with how + try-it), plus the coming-soon concepts.
- Next: build Mission 2 "The Vague Story" (prompting concepts) as a new mission data file and a mission picker.

**Public hosting (2026-11-26):** GitHub Pages at https://ravigajul.github.io/claude-quest/ (repo github.com/ravigajul/claude-quest, public, MIT). Replaced the repo's previous game in commit 5281f0e (old game is still in git history). The repo's index.html is the artifact page wrapped in a full <!doctype html> document with charset and OG meta. `.github/workflows/pages.yml` copies index.html, game/ and vendor/ to Pages on every push to main. To update: copy game/ and vendor/ over, re-wrap index.html (same head-split: everything up to </style> goes into <head>), commit and push. Credit: "Created by Ravi Gajul, built together with Claude" on the intro and end screens and in the README; commits are co-authored by Claude. Off claude.ai, downloads fall back to a normal Blob download.

**v1.2 (2026-11-27): Mission 2, mission select, knowledge checks** (feedback: "after 3 levels I didn't feel I learned something new", "expand the game")
- After Wake up: mission select (#hub). M1 Release Day, M2 The Vague Story (live), M3 Contract Drift and M4 Night Shift (coming soon). Completion is stored in localStorage `cq-done-m1/m2`.
- `game/quiz.js`: 5 real-world questions per mission. Before: no feedback, can be skipped; the score is stored in `cq-quiz-<m>-pre`. After: feedback per question, then "Before X/5 → Now Y/5". The M1 result appears in the mirror verdict, the M2 result on its final card.
- `game/mission2.js`: the prompt builder. Parts: role, task (vague/specific), ticket via MCP, design screenshot, Priya's answers (unlocked by a clarify run, which costs a session), clarify, example, format (free/table/ADO CSV), guardrail. Shows the live prompt text. Each run gives Claude's output (scripted: pytest code if no role; vague steps if no example; at most 3 cases if the task is vague; invented rules if no guardrail) plus a QA lead review (coverage /10, invented, usable, importable) with symptom notes. Each part's first effect shows a "What changed because of your prompt" modal that unlocks its concept. Win = 10/10, 0 invented, usable, importable within 6 sessions. The final screen gives the prompt as a copyable template.
- guide.js: 29 concepts (M2 has 6 incl. new 'grounding').
- Ideas not done yet: real Claude via `sample` to run the player's prompt (artifact only); the M1 rework from "told" to "figure out" (non-obvious rules: subagent sees no chat, skill fires by description, CLAUDE.md re-read after compaction); M3/M4.

**v1.3 (2026-11-27):** M2 outcome screen #m2done (feedback: "not clear on the outcome"): headline, stats first→final (coverage, invented, sessions, quiz), first vs final prompt, learned concepts with how-to, copy/back/again. Multi-change runs show one summary modal. Win skips change modals (the outcome screen covers them).
**v1.3.1:** M2 groups labelled "pick one" (yellow tag, stacked rows with radio dots, role=radiogroup) vs "add any" (blue tag, check-box chips).
**v1.3.2:** M2 review rebuilt as "What your prompt got you · Priya needs all 4", moved above the output. 4 checks (coverage, made-up rules, usable, importable), each explaining the cause by naming the selection (highlighted), plus a "Since your last run" diff (added/removed parts, coverage and made-up before→after).
**v1.3.3:** clarify pop-up now says nothing to do, answers auto-ticked under Context, next = Send revised prompt; the "Priya's answers" chip pulses with a NEW tag until the next run.
**v1.4:** M2 teaches HOW, not just that: ticking the ticket opens a choice (claude mcp add azure-devops -- npx -y @azure-devops/mcp <org> + /mcp ✓; password in prompt / URL / copy-paste ✗); ticking the design opens a choice (Ctrl+V even on Mac / drag / path ✓). A wrong answer leaves it unticked. Guide how-text for mcp and images now carries the real commands. showChoice hides the empty evidence column.
**v1.4.1 (deploy):** GitHub Pages builds now go through `python3 build_pages.py <repo-checkout>`, which copies game/ and vendor/, wraps index.html, and adds ?v=<timestamp> to every game module import and the entry script so browsers never run stale cached JS (Pages caches .js for 10 min). Then git commit + push. If deploy-pages fails with "No artifacts named github-pages", that is a GitHub flake: `gh run rerun <id>`.
**v1.5:** M2 tracker picker (Azure DevOps | Jira, stored in cq-tracker, locked after the first run). mission2.js text uses {TOOL} {ID} {ITEM} {CMD} {SERVERWHY} {COLS} placeholders filled from TRACKERS via fill()/F() (wrapped showResult/showChoice). Jira: PROMO-482, `claude mcp add --transport http atlassian https://mcp.atlassian.com/v2/mcp` (Atlassian official docs), CSV Summary/Test Step/Expected Result/Source. Page spans use data-t. Quiz Q5 and guide entries are tracker-neutral.
**Pages workflow fix:** split into build (upload-pages-artifact) and deploy (needs: build) jobs; the single-job version failed the first attempt with "No artifacts named github-pages".
**v1.5.1:** quiz stores the end score (cq-quiz-<m>-post). If it was 5/5, both checks are auto-skipped for that mission (toast; results show "5/5 earlier"; hub card says so). A retake shows "Last time you scored X/5". The end check has a Skip button.
**v1.5.2:** M2 results: Copy prompt button in the final-prompt card header; "first prompt" is recorded on the first send even if it was the clarify run; learned cards top-aligned.
**v1.6:** M1 clarity: brief rewritten as the 3-day arc; Progress panel → "Level N goal" with a lead sentence (day 1 checklist: first clue, 3 clues, choose 3 notes); objective bar gets a "Pick a card below" cue and a minutes/context/trust key; cards say "+Nk context"; 5-step first-time tour (cq-tour-m1) after the level-1 banner.
**v1.7:** M1 context window panel (.ctxp, grid-area tank) replaces the 3D-only tank label: big used number, stacked bar per item with 70k/100k dashed lines, "What is in it" list (S.ctxItems, set at loop start, appended in addContext(tok,label), reset to a compacted summary on blackout), free-space line, /context tip, +Nk bump animation. Tour step 3 points to it. Shown on small screens too.
**v1.8:** context panel is now a CSS jar (lid, glass, gloss, wave, bubbles, colored pour per card, 70k/100k dashed lines + key), list "What is in the jar" below; 3D tank hidden (tank.visible=false). Brief has a "Why do you forget? Because Claude does." box (day = session, 5:00 = session ends, notes = CLAUDE.md, jar = context window). Narrator, level-1 goal, tour and 5:00 screen all say "each day is one Claude session".
**v1.9:** Role flip: player is the developer, Claude is the AI pair (intro, hub, brief, goals, narrator, tour, cards "ask Claude to", jar/blackout/board say Claude's, etch "Write what Claude keeps"). New 5-slide animated primer #primer "How Claude works" (tool calls, context/tokens, no memory + CLAUDE.md, hallucination, game mapping), shown once before M1 (cq-primer) and from the hub button.
**v1.9.1:** falseDawn popup reworded: "Tests green. Level 2 done!" (green .result.good style); explains the fix is saved but the know-how is not, so level 3 = make it stick (skill + hook).
**v1.9.2:** "How to play" button in the HUD top bar replays the tour (runTour(true)); auto tour still once per browser.
**v1.9.3:** tour step 6 (last) = Messages panel.
- v1.9.5: on each launch, after the tour (or straight away if already seen), the How to play button pulses for ~4s with a 'Lost? Replay the tour here any time' callout.
- v1.9.6: callout says "Take the 1-minute tour" unless the whole tour was completed (cq-tour-m1 = done|skipped); only then "Replay".
- v1.9.7: '← Missions' button in Mission 1 top bar with in-page confirm (reload with sessionStorage cq-open-hub → opens hub); 4 more coming-soon missions (5 Flaky Friday, 6 The Legacy Repo, 7 Red Team, 8 The Review Bot) with 16 locked Field Guide concepts (total 45).

- 2026-11-27: Added a 'Player statistics' plan to START HERE (GoatCounter on the GitHub Pages build only, events, like button, a feedback link, excluding Ravi's own plays). Waiting for Ravi's GoatCounter site code.
- 2026-11-27: PLAN.md is backed up to the GitHub repo (public). build_pages.py copies it on every deploy.
- 2026-11-27 (v1.9.8): play statistics built (game/stats.js, vendor/goatcounter, 👍/👎 row + feedback link on both end screens), off until GOATCOUNTER_CODE is set. README updated (developer framing, How to play, Coming soon table, Privacy and statistics); the README is now kept in this folder and copied to the repo on deploy. The ← Missions reload waits 400 ms so the exit event is sent first.
- 2026-11-27: GoatCounter is switched on (code ravigajul-claudequest) on the GitHub Pages build.
- 2026-11-27: .top has position: relative; z-index: 5, so the How to play callout is no longer hidden behind the evidence board (each .panel's backdrop-filter gives it its own stacking layer).
- 2026-11-27: top bar: .meters { flex: 1 1 22rem; justify-content: flex-end } (left-aligned on phones), so its buttons wrap inside the group and the clock stays beside the level. Before this, adding '← Missions' pushed the whole group onto a second line at ~1366px wide, and the clock was flung to the right corner.
- 2026-11-27 (v1.9.11) layout fixes:
  - Top bar is a grid with two labelled columns side by side, "LEVEL / 1/3 / name" and "DAY N / clock / min left" (#loop-sub now sits in #clock-wrap and reads "Day N"); meters and buttons go on the right. Ravi wants this alignment kept.
  - Phones (≤820px): the HUD rows are max-content (top, jar, board, job, cards, side). With "auto" rows, the fixed-height screen squeezed the board and side column to 0 and pushed the jar to the bottom.
  - Small phones (≤560px): cards and evidence tiles go 2 per row.
  - "Your job" panel: the cue and key text span the full width. Below 1180px the cue is in the flow, so it no longer covers the title.
  - Jar panel: overflow-y auto (it used to spill under "Your job"). From 821 to 1180px the dashed-line notes are hidden.
- 2026-11-27 (v2.0) review fixes + tests + gates:
  - Game fixes:
    - A1: day 1 can't be diagnosed. After 3 clues the player can "Skip to 5:00 and write notes" (#obj-end).
    - A2: Claude's question round in Mission 2 doesn't use up a session.
    - A3: an action card cancelled by a blackout isn't used up.
    - A4: the tour's Messages text is truthful.
    - A5: a note kept on an earlier day stays visible and removable.
    - A6: Mission 2 locks the prompt and Send while Claude is thinking.
    - stickIntroDone is reset by fresh().
  - Keyboard: Tab is trapped in the open pop-up, and Escape continues the result pop-up.
  - Phones: card explanations are shown on touch screens.
  - Layout: the jar's dashed-line notes are hidden up to 1300px; job titles leave room for the "Ask Claude" cue.
  - Repo: plain MIT LICENSE (third-party note moved to the README); pages_head.html holds the link-preview tags plus og:image social.png (1200×630); the README has a screenshot, "How it was built" and a Google Fonts privacy note.
  - Tests: tests/ uses Playwright (game, phone, files specs; see tests/README.md). Run with `cd tests && npm test`, about 2.5 minutes.
  - Gates:
    - Claude Code PreToolUse hook tests/commit-gate.sh, registered in ~/.claude/settings.json, blocks git commit/push of this repo when the tests fail.
    - GitHub Actions has a `test` job that the `build` and `deploy` jobs need.
  - Skill: .claude/skills/game-review/SKILL.md (the full review procedure). CLAUDE.md is added in this folder.
