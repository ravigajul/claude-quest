# Player statistics

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
