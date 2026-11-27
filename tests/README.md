# Play tests

Automated checks for 5:00 PM Forever, using Playwright. They run before every commit and push (Claude Code hook `commit-gate.sh`) and on GitHub Actions before every deploy.

```bash
npm install && npx playwright install chromium   # first time
npm test
```

| Test | What it guards |
|---|---|
| Mission 1 can be played start to finish | A bot plays every day with the right answers and reaches "Morning, finally." with no errors |
| A1: day 1 cannot be won | No diagnosing on day 1; "Skip to 5:00" appears after 3 clues; Level 2 always follows |
| A2: asking questions on the last session | Mission 2 never leaves the player with greyed-out Send buttons |
| A4: the tour describes Messages truthfully | The tour only promises what the panel shows |
| A6: the prompt is locked while Claude is thinking | No double sends, no changing the prompt mid-run |
| Keyboard | Tab stays inside the open pop-up; Escape continues |
| Top bar / Missions button / callout | Level and Day side by side; leaving a mission asks first; How to play is pointed out |
| phone.spec.js | On a phone: jar, board and side panels visible, card explanations shown, full-width text |
| files.spec.js | Plain MIT LICENSE, link preview and picture, README credit and privacy, no private email |

Add a test for every confirmed bug, named after it (e.g. `A7: ...`). Fix the game, never the test, unless the test itself is wrong.
