#!/usr/bin/env bash
set -euo pipefail

BROWSER="${BROWSER:-$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)}"
if [[ -z "$BROWSER" ]]; then
  echo 'Guard Runtime browser gate requires Chrome/Chromium.' >&2
  exit 1
fi

PORT="${ACTION_STUDIO_GATE_PORT:-4173}"
DOM_FILE="${ACTION_STUDIO_GATE_DOM:-/tmp/action-studio-guard-runtime-dom.html}"
HTTP_LOG="${ACTION_STUDIO_GATE_HTTP_LOG:-/tmp/action-studio-guard-runtime-http.log}"
BASE="http://127.0.0.1:${PORT}/tools/action-studio/"

python3 -m http.server "$PORT" >"$HTTP_LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' EXIT
sleep 2

"$BROWSER" --headless --no-sandbox --disable-gpu --enable-unsafe-swiftshader --hide-scrollbars \
  --window-size=1440,1000 --virtual-time-budget=12000 --dump-dom \
  "${BASE}?pagesGuardGate=1" >"$DOM_FILE"

fail() {
  echo "Action Studio Guard Runtime browser gate failed: $1" >&2
  echo '--- Guard Runtime DOM excerpt ---' >&2
  grep -n -A30 -B5 'guardRuntimePanel' "$DOM_FILE" >&2 || true
  echo '--- HTTP log ---' >&2
  cat "$HTTP_LOG" >&2 || true
  exit 1
}

grep -q 'id="guardRuntimePanel"' "$DOM_FILE" || fail 'static #guardRuntimePanel is missing'
grep -q 'data-guard-runtime-static="true"' "$DOM_FILE" || fail 'panel is not authored as static HTML'
grep -q 'data-controller-bound="true"' "$DOM_FILE" || fail 'Guard Runtime controller did not bind after browser boot'
grep -q 'data-guard-runtime-button-count="5"' "$DOM_FILE" || fail 'controller did not validate all five Guard actions'

for mode in hold block parry perfect counter; do
  grep -q "data-guard-runtime=\"${mode}\"" "$DOM_FILE" || fail "missing ${mode} Guard Runtime button"
done

BUTTON_COUNT="$(grep -o 'data-guard-runtime="[^"]*"' "$DOM_FILE" | wc -l | tr -d ' ')"
[[ "$BUTTON_COUNT" == '5' ]] || fail "expected exactly 5 Guard Runtime buttons, found ${BUTTON_COUNT}"

if grep -Eq 'data-template="(guard|parry|counter)"' "$DOM_FILE"; then
  fail 'legacy Phase A Guard/Parry/Counter template buttons are still rendered'
fi

echo "Action Studio Guard Runtime browser gate passed · 5 static buttons · controller bound."
