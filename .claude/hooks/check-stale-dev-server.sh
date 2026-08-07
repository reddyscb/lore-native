#!/usr/bin/env bash
# PreToolUse/Bash hook: warns before running the Maestro E2E suite if more
# than one expo/metro process is running, since a stale expo start/expo
# run:ios process from an unrelated checkout has twice (Phase 7, Phase 9)
# caused an entire Maestro run to silently exercise old or nonexistent code.
set -euo pipefail

input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty')"

if ! printf '%s' "$cmd" | grep -qE "test:e2e|maestro test"; then
  exit 0
fi

procs="$(ps aux | grep -E "expo start|metro|expo run:ios" | grep -v grep || true)"
count=0
if [ -n "$procs" ]; then
  count="$(printf '%s\n' "$procs" | wc -l | tr -d ' ')"
fi

if [ "$count" -gt 1 ]; then
  msg="Warning: $count expo/metro processes are currently running. A stale expo start/expo run:ios process from an unrelated checkout has twice (Phase 7, Phase 9) caused an entire Maestro run to silently exercise old or nonexistent code. Confirm which server is actually serving the app — kill stale processes, start a fresh 'npx expo start' for this checkout, and confirm a real full bundle log (Bundled ...ms ... (N modules) with N in the hundreds/thousands) — before trusting these results."
  jq -n --arg msg "$msg" '{systemMessage: $msg, hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: $msg}}'
fi

exit 0
