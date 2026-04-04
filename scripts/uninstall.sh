#!/usr/bin/env bash
set -euo pipefail

# Uninstall the copilot-local adapter from a Paperclip instance.
#
# Usage:
#   ./scripts/uninstall.sh /path/to/paperclip

PAPERCLIP_DIR="${1:-}"
if [ -z "$PAPERCLIP_DIR" ]; then
  echo "Usage: ./scripts/uninstall.sh /path/to/paperclip"
  exit 1
fi

PAPERCLIP_DIR="$(cd "$PAPERCLIP_DIR" && pwd)"
REGISTRY="$PAPERCLIP_DIR/server/src/adapters/registry.ts"

echo "==> Removing copilot-local adapter from $PAPERCLIP_DIR"

# Remove symlinks
rm -rf "$PAPERCLIP_DIR/server/node_modules/@paperclipai/adapter-copilot-local"
rm -rf "$PAPERCLIP_DIR/node_modules/@paperclipai/adapter-copilot-local"

# Revert registry changes
if [ -f "$REGISTRY" ] && grep -q "copilot_local" "$REGISTRY"; then
  cd "$PAPERCLIP_DIR"
  git checkout -- server/src/adapters/registry.ts 2>/dev/null || echo "    Could not git-revert registry.ts — may need manual cleanup"
fi

echo "✅ copilot-local adapter removed"
