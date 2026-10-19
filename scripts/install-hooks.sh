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
DEST="$REPO_ROOT/.git/hooks/pre-push"

[ -f "$SRC" ] || { echo "missing $SRC" >&2; exit 1; }
chmod +x "$SRC"

if [ -e "$DEST" ] && [ ! -L "$DEST" ]; then
  echo "A non-symlink pre-push hook already exists at:"
  echo "  $DEST"
  echo "Back it up / merge manually, then re-run. Nothing changed." >&2
  exit 1
fi

ln -sf "$SRC" "$DEST"
echo "Installed pre-push gate → $DEST"
echo "Bypass a single push with: git push --no-verify"
