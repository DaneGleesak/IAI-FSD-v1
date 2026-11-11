#!/bin/sh
# Run every check:  sh tests/run-all.sh [outDir]
# Needs Node and Playwright with Chromium (npm i -D playwright && npx playwright install chromium).
cd "$(dirname "$0")/.." || exit 1
OUT=${1:-test-out}; mkdir -p "$OUT"
[ -z "$NODE_PATH" ] && NODE_PATH="$(npm root -g 2>/dev/null)" && export NODE_PATH
fail=0
for f in hygiene engine pwa blocked fsd1 files outside layout scan county detail review; do
  node "tests/$f.js" . "$OUT" || fail=1
done
[ "$fail" = 0 ] && echo "ALL SUITES PASSED" || echo "SOMETHING FAILED"
exit $fail
