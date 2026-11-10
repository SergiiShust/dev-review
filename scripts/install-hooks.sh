#!/usr/bin/env bash
#
# install-hooks.sh — opt-in: install the native git pre-push gate for the
# terminal path (pushes made outside Claude). The Claude path is already gated
# by the PreToolUse hook in .claude/settings.json and needs no install.
#
# Safe to re-run. Removes nothing it didn't create.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
SRC="$REPO_ROOT/.claude/hooks/pre-push.sample"
# Ask git for the hooks dir: in a linked worktree `<toplevel>/.git` is a file,
# and core.hooksPath may relocate it entirely.
HOOKS_DIR="$(git rev-parse --path-format=absolute --git-path hooks)"
DEST="$HOOKS_DIR/pre-push"

[ -f "$SRC" ] || { echo "missing $SRC" >&2; exit 1; }
chmod +x "$SRC" "$REPO_ROOT/.claude/hooks/pr-self-review-lib.sh"
mkdir -p "$HOOKS_DIR"

if [ -e "$DEST" ] && [ ! -L "$DEST" ]; then
  echo "A non-symlink pre-push hook already exists at:"
  echo "  $DEST"
  echo "Back it up / merge manually, then re-run. Nothing changed." >&2
  exit 1
fi

ln -sf "$SRC" "$DEST"
echo "Installed pre-push gate → $DEST"
echo "Bypass a single push with: git push --no-verify"
