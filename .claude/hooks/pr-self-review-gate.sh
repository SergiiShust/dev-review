#!/usr/bin/env bash
#
# pr-self-review-gate.sh — PreToolUse(Bash) gate.
#
# Blocks opening a PR (`gh pr create` / `gh pr new` / a `gh api` POST to /pulls)
# unless a FRESH PASS from the pr-self-review skill exists for the exact current
# diff against the base the PR targets. A shell hook can't run a Claude-driven
# review, so it checks the proof-of-review file the skill writes and recomputes
# diffHash via the shared recipe in pr-self-review-lib.sh.
#
# Wired in .claude/settings.json as a PreToolUse hook on the Bash tool.
# Exit 0 = allow; exit 2 = block (stderr shown to Claude/user). Claude Code treats
# any OTHER non-zero exit as a non-blocking error — so this script fails CLOSED:
# every unexpected error is trapped and turned into exit 2.
set -Eeuo pipefail

block() {
  echo "pr-self-review: $1" >&2
  echo "Run /pr-self-review and resolve any CRITICAL findings before opening the PR." >&2
  exit 2
}
trap 'block "gate error on line $LINENO (failing closed)."' ERR

INPUT="$(cat)"

# The Bash command Claude is about to run (from the hook payload). Without
# python3, match against the raw JSON payload instead — over-matching (gating)
# is safe, silently skipping the gate is not.
if command -v python3 >/dev/null 2>&1; then
  CMD="$(printf '%s' "$INPUT" | python3 -c \
    'import sys,json; d=json.load(sys.stdin); print((d.get("tool_input") or {}).get("command","") or "")' \
    2>/dev/null || printf '%s' "$INPUT")"
else
  CMD="$INPUT"
fi

# Match every way of opening a PR — `gh pr create`, its `gh pr new` alias, and a
# raw `gh api` POST to the pulls endpoint — but only with `gh` in COMMAND
# position (line start, or after ; & | ( or $( ), checked line by line. A bare
# substring match also fires on text that merely mentions the command, e.g. a
# commit message or heredoc body, and blocks unrelated commands.
GH_AT_CMD='(^|[;&|(]|\$\()[[:space:]]*(command[[:space:]]+|\\)?gh[[:space:]]+'
# Pure-bash line matcher (no grep: a missing external tool must not make the
# matcher return "no match" and let the PR through).
has() {
  local line
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ $1 ]] && return 0
  done <<< "$CMD"
  return 1
}
OPENS_PR=0
has "${GH_AT_CMD}pr[[:space:]]+(create|new)([[:space:]]|$)" && OPENS_PR=1
has "${GH_AT_CMD}api[[:space:]].*/pulls([[:space:]\"'?]|$)" && has "(-X|--method)[[:space:]=]*POST" && OPENS_PR=1
[ "$OPENS_PR" = 1 ] || exit 0
NORM=" $(printf '%s' "$CMD" | tr -s '[:space:]' ' ') "   # single-line view for --base parsing

git rev-parse --show-toplevel >/dev/null 2>&1 || exit 0   # not in a git repo → nothing to gate
LIB="$(git rev-parse --show-toplevel)/.claude/hooks/pr-self-review-lib.sh"
[ -f "$LIB" ] || block "missing $LIB."
# shellcheck source=pr-self-review-lib.sh
. "$LIB"

DIR="$(prsr_dir)" || block "cannot locate the git dir."
VERDICT="$DIR/pr-self-review.json"
[ -f "$VERDICT" ] || block "no self-review on record for this branch."

command -v python3 >/dev/null 2>&1 || block "python3 is required to read $VERDICT."
# verdict, base, diffHash — space-separated (all single tokens).
read -r VERDICT_VALUE BASE RECORDED_HASH < <(
  python3 - "$VERDICT" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    d = {}
print(d.get("verdict") or "-", d.get("base") or "-", d.get("diffHash") or "-")
PY
)

[ "$VERDICT_VALUE" = "PASS" ] || block "last self-review verdict was ${VERDICT_VALUE/#-/missing}."

# The reviewed base must be the base this PR targets: `--base X` / `-B X` on the
# command, else the repo default branch — otherwise commits between the two bases
# would ship unreviewed.
TARGET=""
if [[ "$NORM" =~ [[:space:]](--base|-B)[[:space:]=]+([^[:space:]\"\']+) ]]; then
  TARGET="${BASH_REMATCH[2]}"
fi
TARGET="${TARGET:-$(prsr_default_base)}"
[ "${BASE#origin/}" = "${TARGET#origin/}" ] \
  || block "review covered base '$BASE' but the PR targets '$TARGET' — re-run with base=$TARGET."

CURRENT_HASH="$(prsr_diff_hash "$BASE")" \
  || block "cannot compute the diff against base '$BASE' (missing ref or hashing tool)."

[ -n "$CURRENT_HASH" ] && [ "$CURRENT_HASH" = "$RECORDED_HASH" ] \
  || block "changes moved since the last PASS (stale review)."

exit 0
