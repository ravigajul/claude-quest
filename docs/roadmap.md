# Roadmap

**Roadmap: missions to build (in order, unless Ravi says otherwise)**
| # | Mission | Story | Teaches | Game idea (draft) |
|---|---|---|---|---|
| 3 ✅ live | Contract Drift | An API changed silently and the tests still pass | /review, custom slash commands, headless `claude -p` in CI, choosing a model | Diff a contract vs the real response; save the check as a /command; wire it into CI; a model-choice trade-off |
| 4 | Night Shift | Three tasks, one night, several Claudes at once | Resuming sessions, worktrees, custom subagents, plugins | Run parallel sessions on separate worktrees; resume yesterday's; package the setup as a plugin |
| 5 | Flaky Friday | The E2E suite fails one run in five; demo on Monday | Browser testing (Claude in Chrome / Playwright MCP), screenshots and traces, re-run only what failed, fix the cause not the retry | Reproduce a race by looping one test; read the trace; reject "add a wait" |
| 6 | The Legacy Repo | Day one on a 15-year-old codebase with no docs | /init, asking questions about a codebase, the Explore subagent, keeping CLAUDE.md short | Map the repo cheaply; trim a bloated CLAUDE.md to the lines that matter |
| 7 | Red Team | Hidden instructions in a page Claude reads; a secret in .env | /security-review, deny rules for secrets, sandboxing, prompt injection | Spot the injected instruction; write deny rules; choose what to sandbox |
| 8 | The Review Bot | 40 pull requests a day | Claude in GitHub Actions, @claude in PRs, review rules in CLAUDE.md, humans approve | Configure a review bot; catch it about to merge; write reviewer rules |
When a mission goes live: change its card from `.mission.locked` to a button (`go-mN`), set `status: 'live'` in `MISSIONS`, fill in `how`/`tryIt` for its `GUIDE` concepts, add 5 knowledge-check questions in `game/quiz.js` (`QUIZ.mN`), add `cq-done-mN` status in `showHub()`, and write a `game/missionN.js` like `mission2.js`.

**Other open ideas (not started):** live-Claude finale (`sample` capability: a fresh Claude plays with only your notes); give Mission 1's ending the same outcome screen as Mission 2; co-op mode; team speedrun board.
