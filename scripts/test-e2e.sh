#!/bin/bash
# Runs the Maestro regression suite one flow at a time against the booted
# iOS Simulator. Flows are run sequentially rather than via
# `maestro test maestro/` because running the whole folder at once showed
# scheduling flakiness (elements intermittently reported not-found while
# clearly rendered on screen) — one flow at a time is reliable.
#
# Requires: Maestro CLI installed (https://maestro.mobile.dev), a booted
# iOS Simulator with the app already built and installed, and a signed-in
# session in that simulator (auth can't be scripted — see maestro/*.yaml
# for details on each flow's assumptions).

set -e
cd "$(dirname "$0")/.."

status=0
for flow in maestro/*.yaml; do
  echo "=== $flow ==="
  if ! maestro test "$flow"; then
    status=1
  fi
  echo
done

exit $status
