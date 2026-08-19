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
  --window-size=1440,1000 --virtual-time-budget=20000 --dump-dom \
  "${BASE}?pagesGuardGate=1" >"$DOM_FILE"

fail() {
  echo "Action Studio Guard Runtime browser gate failed: $1" >&2
  echo '--- Guard Runtime DOM excerpt ---' >&2
  grep -n -A30 -B5 'guardRuntimePanel' "$DOM_FILE" >&2 || true
  echo '--- Root runtime attributes ---' >&2
  grep -o 'data-action-studio-[^ >]*\|data-pages-guard-[^ >]*' "$DOM_FILE" >&2 || true
  echo '--- HTTP log ---' >&2
  cat "$HTTP_LOG" >&2 || true
  exit 1
}

grep -q 'id="guardRuntimePanel"' "$DOM_FILE" || fail 'static #guardRuntimePanel is missing'
grep -q 'data-guard-runtime-static="true"' "$DOM_FILE" || fail 'panel is not authored as static HTML'
grep -q 'data-controller-bound="true"' "$DOM_FILE" || fail 'Guard Runtime controller did not bind after browser boot'
grep -q 'data-guard-runtime-button-count="5"' "$DOM_FILE" || fail 'controller did not validate all five Guard actions'
grep -q 'data-stage="G3.5.1P-T3"' "$DOM_FILE" || fail 'main Guard Runtime surface is not labeled G3.5.1P-T3'
grep -q 'data-parry-presentation="contact-deflect"' "$DOM_FILE" || fail 'main Guard Runtime surface does not declare contact-deflect Parry presentation'
grep -q 'Contact → Deflect → Parry Advantage' "$DOM_FILE" || fail 'main Guard Runtime surface still describes the old Block-Hit-only Parry presentation'
grep -q 'data-action-studio-entry="bundle-http"' "$DOM_FILE" || fail 'HTTP Action Studio is not exercising the versioned standalone bundle path'
grep -q 'data-action-studio-boot="pass"' "$DOM_FILE" || fail 'HTTP Action Studio bundle did not boot successfully'
grep -q 'data-pages-guard-gate="pass"' "$DOM_FILE" || fail 'normal Action Studio did not reach production Parry deflect during the deterministic browser probe'
grep -q 'data-pages-guard-state="guard_parry"' "$DOM_FILE" || fail 'normal Action Studio deterministic probe did not remain in guard_parry'
grep -q 'data-pages-guard-clip="SKYRIM_GUARD/parry_contact_deflect_t3"' "$DOM_FILE" || fail 'normal Action Studio Parry is not using the T3 production virtual clip'

SOURCE_MS="$(grep -o 'data-pages-guard-source-ms="[0-9]*"' "$DOM_FILE" | head -1 | grep -o '[0-9]*' || true)"
[[ -n "$SOURCE_MS" ]] || fail 'normal Action Studio did not report a deterministic T3 source sample'
(( SOURCE_MS >= 350 && SOURCE_MS <= 370 )) || fail "normal Action Studio sampled T3 Parry outside the expected 360ms deflect checkpoint: ${SOURCE_MS}ms"

for mode in hold block parry perfect counter; do
  grep -q "data-guard-runtime=\"${mode}\"" "$DOM_FILE" || fail "missing ${mode} Guard Runtime button"
done

BUTTON_COUNT="$(grep -o 'data-guard-runtime="[^"]*"' "$DOM_FILE" | wc -l | tr -d ' ')"
[[ "$BUTTON_COUNT" == '5' ]] || fail "expected exactly 5 Guard Runtime buttons, found ${BUTTON_COUNT}"

if grep -Eq 'data-template="(guard|parry|counter)"' "$DOM_FILE"; then
  fail 'legacy Phase A Guard/Parry/Counter template buttons are still rendered'
fi

echo "Action Studio Guard Runtime browser gate passed · bundle-http · deterministic T3 Parry ${SOURCE_MS}ms · 5 static buttons · controller bound."