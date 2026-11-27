# 5:00 PM Forever: plan (start here)

**Resume with:** "Read ~/Downloads/claude-quest/PLAN.md and continue the game." Open only the file you need below.

**Live now (v2.3, 2026-11-27; artifact v40; 54 tests)**
- Artifact: https://claude.ai/artifact/ACLJPaKjgTxhyfcBvZabsZ. GitHub Pages: https://ravigajul.github.io/claude-quest/ (repo ravigajul/claude-quest)
- Mission 1 *Release Day* (3 levels, time loop, the player directs Claude) and Mission 2 *The Vague Story* (prompt builder → test cases for Azure DevOps or Jira) are playable.
- Mission 3 *Contract Drift* (find API drift, sort the changes, save /contract-check, run it headless in CI, choose a model) is playable: `game/mission3.js`, screens `#m3`/`#m3done`, violet theme.
- Missions 4–8 are "coming soon" cards in the hub (`index.html`, `.mission.locked`) with locked Field Guide concepts (`game/guide.js`, `MISSIONS` + `GUIDE`, 45 concepts total).

| File | What's in it | Read it when |
|---|---|---|
| [docs/lessons.md](docs/lessons.md) | Lessons learned (L1…) and Ravi's feedback log (F1…) | Before building or reviewing anything |
| [docs/roadmap.md](docs/roadmap.md) | Missions 4–8, the go-live checklist, open ideas | Starting a new mission |
| [docs/deploy.md](docs/deploy.md) | Artifact and GitHub Pages steps | Shipping |
| [docs/stats.md](docs/stats.md) | GoatCounter setup and the events sent | Working on statistics |
| [docs/changelog.md](docs/changelog.md) | The original plan and every change since | Needing history behind a decision |

**Rules Ravi has set (keep following them)**
- The player is the **developer directing Claude**, never the AI. Explain for people with no AI background (the 1-minute primer exists for that).
- Always show what to do next; make context and its cost visible (the jar); explain *why* (each day = a new Claude session).
- Only real Claude / Claude Code features and commands. Plain words, short sentences.
- 3D/animated, free and open-source only, zero hosting cost, no CDN (Three.js vendored).
- Credit: "Created by Ravi Gajul, built together with Claude". Never put Ravi's email anywhere public.
- Test locally with Playwright before publishing; deploy to **both** the artifact and GitHub Pages.
