#!/usr/bin/env bash
# Build standalone uitop binaries with `bun build --compile`.
#
# Usage:
#   scripts/build.sh                 build for this machine -> dist/uitop
#   scripts/build.sh all             build every target     -> dist/uitop-<os>-<arch>
#   scripts/build.sh darwin-arm64    build one target (darwin|linux)-(arm64|x64)
#
# Note: @opentui/core ships a native library per platform. Cross-compiling needs
# that platform's package installed (e.g. @opentui/core-linux-x64), so for now
# build on the platform you are targeting.
set -euo pipefail
cd "$(dirname "$0")/.."

BUN="${BUN:-$(command -v bun || echo ./node_modules/.bin/bun)}"
VERSION="$(node -p "require('./package.json').version" 2>/dev/null || "$BUN" -e "console.log(require('./package.json').version)")"
TARGETS=(darwin-arm64 darwin-x64 linux-x64 linux-arm64)

build() { # $1 = target or "native", $2 = outfile
  local target="$1" out="$2" args=()
  [[ "$target" != native ]] && args+=(--target="bun-$target")
  echo "-> $out (${target}, v$VERSION)"
  "$BUN" build --compile --minify ${args[@]+"${args[@]}"} \
    --define "process.env.UITOP_VERSION=\"$VERSION\"" \
    src/index.ts --outfile "$out"
}

mkdir -p dist
case "${1:-native}" in
  native) build native dist/uitop ;;
  all)    for t in "${TARGETS[@]}"; do build "$t" "dist/uitop-$t"; done ;;
  *)      build "$1" "dist/uitop-$1" ;;
esac
echo "done:"; ls -lh dist
