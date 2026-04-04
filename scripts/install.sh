#!/usr/bin/env bash
set -euo pipefail

# Install the copilot-local adapter into a Paperclip instance.
#
# Usage:
#   ./scripts/install.sh /path/to/paperclip
#
# What it does:
#   1. Builds this adapter package
#   2. Symlinks it into Paperclip's node_modules
#   3. Patches server/src/adapters/registry.ts to register copilot_local

PAPERCLIP_DIR="${1:-}"
if [ -z "$PAPERCLIP_DIR" ]; then
  echo "Usage: ./scripts/install.sh /path/to/paperclip"
  exit 1
fi

PAPERCLIP_DIR="$(cd "$PAPERCLIP_DIR" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ADAPTER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REGISTRY="$PAPERCLIP_DIR/server/src/adapters/registry.ts"

if [ ! -f "$REGISTRY" ]; then
  echo "Error: $REGISTRY not found. Is this a Paperclip checkout?"
  exit 1
fi

echo "==> Installing copilot-local adapter into $PAPERCLIP_DIR"

# 1. Build
echo "    Building adapter..."
cd "$ADAPTER_DIR" && npm run build --silent

# 2. Symlink
echo "    Linking package..."
mkdir -p "$PAPERCLIP_DIR/server/node_modules/@paperclipai"
mkdir -p "$PAPERCLIP_DIR/node_modules/@paperclipai"
rm -rf "$PAPERCLIP_DIR/server/node_modules/@paperclipai/adapter-copilot-local"
rm -rf "$PAPERCLIP_DIR/node_modules/@paperclipai/adapter-copilot-local"
ln -sf "$ADAPTER_DIR" "$PAPERCLIP_DIR/server/node_modules/@paperclipai/adapter-copilot-local"
ln -sf "$ADAPTER_DIR" "$PAPERCLIP_DIR/node_modules/@paperclipai/adapter-copilot-local"

# 3. Patch registry
if grep -q "copilot_local" "$REGISTRY"; then
  echo "    Registry already patched"
else
  echo "    Patching registry.ts..."
  cd "$PAPERCLIP_DIR"
  git apply "$SCRIPT_DIR/registry.patch"
fi

echo ""
echo "✅ copilot-local adapter installed"
echo "   Restart Paperclip: cd $PAPERCLIP_DIR && pnpm dev"
echo '   Create agents with adapterType: "copilot_local"'
