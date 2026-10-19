#!/usr/bin/env bash
#
# pr-self-review-gate.sh — PreToolUse(Bash) gate.
#
# Blocks `gh pr create` unless a FRESH PASS from the pr-self-review skill exists
# for the exact current diff. A shell hook can't run a Claude-driven review, so
# it checks the proof-of-review file the skill writes (.git/pr-self-review.json)
# and recomputes diffHash with the SAME recipe the skill uses.
#
# Wired in .claude/settings.json as a PreToolUse hook on the Bash tool.
# Exit 0 = allow the command; exit 2 = block it (stderr shown to Claude/user).
set -euo pipefail

INPUT="$(cat)"

# The Bash command Claude is about to run (from the hook payload).
CMD="$(printf '%s' "$INPUT" | python3 -c \
  'import sys,json; d=json.load(sys.stdin); print((d.get("tool_input") or {}).get("command","") or "")' \
  2>/dev/null || true)"

# Only gate `gh pr create`; everything else passes untouched.
case "$CMD" in
  *"gh pr create"*) ;;
  *) exit 0 ;;
esac

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$REPO_ROOT" ] || exit 0   # not in a git repo → nothing to gate
VERDICT="$REPO_ROOT/.git/pr-self-review.json"

block() {
  echo "pr-self-review: $1" >&2
  echo "Run /pr-self-review and resolve any CRITICAL findings before opening the PR." >&2
  exit 2
}

[ -f "$VERDICT" ] || block "no self-review on record for this branch."

# verdict, base, diffHash — space-separated (all single tokens).
read -r VERDICT_VALUE BASE RECORDED_HASH < <(
  python3 - "$VERDICT" <<'PY' 2>/dev/null || true
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    print("", "main", ""); sys.exit(0)
print(d.get("verdict", ""), d.get("base", "main") or "main", d.get("diffHash", ""))
PY
)

[ "${VERDICT_VALUE:-}" = "PASS" ] || block "last self-review verdict was ${VERDICT_VALUE:-missing}."

# Recompute the diff hash exactly as the skill does (Step 5 recipe).
CURRENT_HASH="$(
  { git -C "$REPO_ROOT" diff --merge-base "$BASE" HEAD; git -C "$REPO_ROOT" diff HEAD; } 2>/dev/null \
    | shasum -a 256 | awk '{print $1}'
)"

[ -n "$CURRENT_HASH" ] && [ "$CURRENT_HASH" = "$RECORDED_HASH" ] \
  || block "changes moved since the last PASS (stale review)."

exit 0
