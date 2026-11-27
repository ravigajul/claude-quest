# 5:00 PM Forever (claude-quest)

A 3D time-loop game that teaches developers and testers to work with Claude. Created by Ravi Gajul, built together with Claude.

**Read only what the task needs** (these are links, not imports, so they cost nothing until opened):
- [PLAN.md](PLAN.md): what's live now, and the index of everything below.
- [docs/lessons.md](docs/lessons.md): lessons learned (L1…) and Ravi's feedback (F1…). **Read before building or reviewing.** Add new ones after each round.
- [docs/roadmap.md](docs/roadmap.md): next missions and the go-live checklist.
- [docs/deploy.md](docs/deploy.md): how to ship to the artifact and GitHub Pages.
- [docs/stats.md](docs/stats.md): player statistics (GoatCounter).
- [docs/changelog.md](docs/changelog.md): the original plan and every change. Append a dated entry when you ship.

**Rules**
- This folder is the source. `build_pages.py <repo checkout>` copies it into github.com/ravigajul/claude-quest. Edit docs, README.md and LICENSE here, never in the checkout.
- **Tests gate every commit and push.** Run `cd tests && npm test` (Playwright). The hook `tests/commit-gate.sh` blocks a failing `git commit`/`git push`, and GitHub Actions runs the tests before every deploy.
- Never weaken, skip or delete a test to get green. Every confirmed bug, lesson and feedback item gets a test (`tests/lessons.spec.js` for L#/F#).
- To review before shipping, use the `game-review` skill (.claude/skills/game-review).
