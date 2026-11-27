# Lessons learned and Ravi's feedback

Read this before building a mission or running a review. After every round, add new lessons and feedback here (game-review skill, step 4). Each numbered item needs a test named after it in tests/lessons.spec.js; a guard test fails the suite if one is missing.

**Lessons learned**
Each lesson is something that went wrong or nearly did, and the habit that now prevents it.
1. **Every mission gets a full playthrough test before it ships.** On 2026-11-27, Mission 3's test caught a crash on its last step (a lookup past the end of the step list) before any player saw it. Guard every lookup indexed by step or level.
2. **Make local runs match production.** The artifact and Pages wrappers add a CSS reset that the local file lacked, so local layouts differed. The reset is now inside index.html. The phone test checks that no screen is wider than the phone.
3. **Tests must not depend on timing.** CI machines are slower. Wait for the pop-up before closing it (the `ok()` helper), and check "while thinking" in the same instant as the click (A6). Make flaky tests deterministic; never loosen them.
4. **Check a Claude feature for real before teaching it.** For example, `claude -p "/ping members"` was run to confirm that custom commands and `$ARGUMENTS` work headless. Check `claude --help` for flags.
5. **Serve UTF-8 for screenshots that will be published.** The local server sends no charset, which shows "Â·".
6. **Look at the screenshots yourself, on laptop and phone.** Tests catch broken behaviour; screenshots catch empty columns, content below the fold and cut-off edges.
7. **When a test fails in CI, first decide: is the game wrong or the test?** Fix the right one and say which in the commit.

8. **A button must not look ready before it works.** On a cold load, "Wake up" was clickable before the 3D library had loaded and before its click was wired up, so the first click did nothing. The tests hit it as random stalls, and so would a player on a slow connection. Now the button says "Loading…" and stays disabled until ready.
9. **Nothing optional may block the start.** The 3D scene download sometimes never finished, leaving the game stuck on "Loading…". The 3D now has 10 seconds to load; after that the game starts in 2D mode.
10. **Test with a server you can trust.** Python's `http.server` now and then never answered a request, so pages hung at random during the tests. The tests now use tests/serve.js, a 25-line Node server that also sends UTF-8. They wait for the page to be usable, not for every download.

**Ravi's feedback log (what he asked for, so it is never undone)**
F1. Point out How to play on first launch; never say "replay" before the tour was taken.
F2. Always offer a way out of a mission (← Missions, with a confirm).
F3. Top bar: "LEVEL / 1/3 / name" beside "DAY 1 / time / min left", tops aligned, on web and mobile. "min left" stays muted.
F4. Callouts must never hide behind panels. Phones must show every panel, with card explanations visible.
F5. Exclude his own plays from stats. Data must survive deploys.
F6. Test before every commit and push. Turn reviews, mistakes and lessons into tests, the skill and hooks, and get better each iteration.
F7. Keep CLAUDE.md short and split the plan into separate files linked from it, so sessions don't burn tokens.
