#!/bin/bash
# Claude Code PreToolUse hook (Bash): before a `git commit` or `git push` of the claude-quest repo,
# run the game's play tests. If they fail, block the command and show why.
# Registered in ~/.claude/settings.json. Other commands pass straight through.

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')
cwd=$(printf '%s' "$input" | jq -r '.cwd // ""')

# Only git commit / git push ...
printf '%s' "$cmd" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+(-C[[:space:]]+[^[:space:]]+[[:space:]]+)?(commit|push)([[:space:]]|$)' || exit 0
# ... that touch the claude-quest repo (by its checkout path, its name, or the current folder).
printf '%s\n%s' "$cmd" "$cwd" | grep -Eq 'claude-quest|cq-repo' || exit 0

tests="$HOME/Downloads/claude-quest/tests"
if [ ! -d "$tests/node_modules" ]; then
  echo "claude-quest play tests are not installed. Run: cd $tests && npm install && npx playwright install chromium" >&2
  exit 2
fi

log=$(mktemp -t cq-tests)
# The built repo copy differs from the source (build_pages.py rewrites the page header), and that copy is
# what GitHub Actions tests. So also run the quick file and lessons checks on it (lesson L11).
built=$(printf '%s' "$cmd" | grep -oE '[^ ;&|"]*cq-repo' | head -1)
[ -z "$built" ] && printf '%s' "$cwd" | grep -q 'cq-repo' && built="$cwd"
check_built() {
  [ -n "$built" ] && [ -d "$built/tests" ] || return 0
  ln -sfn "$tests/node_modules" "$built/tests/node_modules"
  (cd "$built/tests" && npx playwright test files.spec.js lessons.spec.js --reporter=line); s=$?
  rm -f "$built/tests/node_modules"
  return $s
}
if (cd "$tests" && npx playwright test --reporter=line) >"$log" 2>&1 && check_built >>"$log" 2>&1; then
  echo '{"systemMessage": "claude-quest play tests passed, so the commit/push can go ahead."}'
  rm -f "$log"
  exit 0
fi

{
  echo "Blocked: the claude-quest play tests failed, so this commit/push was stopped. Fix the game (not the tests) and try again."
  echo "Failures:"
  grep -E '✘|[0-9]+\) |Error:|expect\(' "$log" | head -40
  echo "Full log: $log"
} >&2
exit 2
