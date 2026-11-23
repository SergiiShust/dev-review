#!/usr/bin/env bash
#
# pr-self-review-lib.sh — the ONE implementation of the proof-of-review
# primitives shared by the pr-self-review skill, the PreToolUse gate
# (pr-self-review-gate.sh) and the optional pre-push hook. Keeping the recipe in
# one place is what guarantees the skill and the gates compute identical hashes.
#
# Source it (functions below), or run it as a CLI:
#   pr-self-review-lib.sh dir           # → absolute dir for the proof files
#   pr-self-review-lib.sh hash <base> [commit]  # → diffHash vs <base> (working tree, or <commit>)
#
# Every function returns non-zero on failure instead of guessing, so callers can
# fail CLOSED (a gate that silently hashes empty input would wave anything through).

# Directory for pr-self-review.json / .md. Uses the per-worktree git dir, which
# is a real directory even in a linked worktree (where `<toplevel>/.git` is a file).
prsr_dir() {
  git rev-parse --absolute-git-dir 2>/dev/null
}

# Resolve a base branch name to a ref that exists here: the local branch if
# present, else its origin/ remote-tracking ref. Fails when neither exists.
prsr_base_ref() {
  local base="${1:-}"
  [ -n "$base" ] || return 1
  if git rev-parse --verify -q "${base}^{commit}" >/dev/null; then
    printf '%s\n' "$base"
  elif git rev-parse --verify -q "origin/${base}^{commit}" >/dev/null; then
    printf '%s\n' "origin/$base"
  else
    return 1
  fi
}

# The repo's default branch (what `gh pr create` targets without --base).
prsr_default_base() {
  local head
  head="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null || true)"
  printf '%s\n' "${head#origin/}" | sed 's/^$/main/'
}

prsr_sha256() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print $1}'
  else
    return 1
  fi
}

# diffHash = sha256 of the working tree (committed + staged + unstaged) vs the
# merge-base with <base>. ONE content-only diff, so committing already-reviewed
# changes keeps the hash (and the PASS) valid; any content change invalidates it.
# With <commit>, hash that commit's tree instead of the working tree (pre-push:
# gate exactly what is being pushed). For a clean checkout at <commit> the two agree.
prsr_diff_hash() {
  local ref diff
  ref="$(prsr_base_ref "${1:-}")" || return 1
  if [ -n "${2:-}" ]; then
    diff="$(git diff --merge-base "$ref" "$2")" || return 1
  else
    diff="$(git diff --merge-base "$ref")" || return 1
  fi
  printf '%s' "$diff" | prsr_sha256
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  set -euo pipefail
  case "${1:-}" in
    dir) prsr_dir ;;
    hash) prsr_diff_hash "${2:-}" "${3:-}" ;;
    *) echo "usage: $0 dir | hash <base> [commit]" >&2; exit 64 ;;
  esac
fi
