# Deploy

**Deploy**
(README.md and PLAN.md: edit the copies in ~/Downloads/claude-quest; build_pages.py copies both into the repo.)
1. Artifact: Artifact tool publish, `file_path` = index.html, `files` = the changed `game/*.js` (capabilities carry forward).
2. Pages: clone ravigajul/claude-quest, run `python3 ~/Downloads/claude-quest/build_pages.py <checkout>` (wraps the page, cache-busts imports, copies PLAN.md as a backup; if this Mac copy is lost, get PLAN.md back from the repo), commit, push, and watch the Pages run (`gh run watch`).

Run the tests first: `cd tests && npm test`. The commit hook and the CI `test` job enforce this.
