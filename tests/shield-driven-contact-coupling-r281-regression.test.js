import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../tools/action-studio/shield-driven-contact-coupling-lab-r281.js', import.meta.url),
  'utf8',
);
const html = await readFile(
  new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url),
  'utf8',
);

function sliceBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  const end = text.indexOf(endMarker, start);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return text.slice(start, end);
}

test('R18M.1 baseline targets the actual R18I5 R281 browser entry', () => {
  assert.match(
    html,
    /<script type="module" src="\.\/shield-driven-contact-coupling-lab-r281\.js\?v=g43b5r281-closed-loop-old-b3-r18i5"><\/script>/,
  );
  assert.match(html, /BUILD R18I5 TOP\/RIGHT/);
  assert.match(html, /LEFT release (?:仍)?(?:暫緩|deferred)/);
});

test('R18M.1 locks manual Parry input and authored commitment\/TTC authority', () => {
  assert.match(source, /const parryGate = createCommittedParryContactGate\(\);/);
  assert.match(source, /latestParryInput = parryGate\.arm\(\{/);
  assert.match(source, /manual: true,/);
  assert.match(source, /latestParryConfirmation = selectedMode === 'parry'[\s\S]*parryGate\.confirm\(\{/);
  assert.match(html, /Input authority<\/span><b>manual PARRY NOW<\/b>/);
  assert.match(html, /Attack commitment<\/span><b>authored movementStartSeconds<\/b>/);
  assert.match(html, /Valid TTC<\/span><b>60–180 ms<\/b>/);
  assert.match(html, /Invalid \/ no input<\/span><b>falls back to BLOCK<\/b>/);
});

test('R18M.1 locks predictive\/measured pre-contact guidance without granting success authority', () => {
  assert.match(source, /analyzePredictiveInterceptParry\(\{/);
  assert.match(source, /selectReachableParryInterceptTarget\(\{/);
  assert.match(source, /measureSweptSwordBucklerClosestApproach\(\{/);
  assert.match(source, /residualBodyReachRuntime\.update\(\{/);
  assert.match(source, /residualStanceReachRuntime\.update\(\{/);
  assert.match(html, /unreachable linear target may fall back to measured current sweep/);
  assert.match(html, /guidance · cannot veto input/);
  assert.match(html, /Success authority<\/span><b>real swept Sword × Shield contact<\/b>/);
});

test('R18M.1 locks real swept contact → Parry confirmation → combat resolution → live grip ownership', () => {
  const body = sliceBetween(source, 'function resolveContact(', 'const INSPECTION_GATE_ORDER');

  assert.match(body, /probeSweptSwordBucklerContact\(\{/);
  assert.match(body, /if \(!latestContact\.contact\) return;/);
  assert.match(body, /parryGate\.confirm\(\{ attackSnapshot: snapshot, contact: latestContact \}\)/);
  assert.match(body, /latestCombatResult = combat\.resolveContact\(\{/);
  assert.match(body, /latestGripConstraintReport = swordGripConstraint\.start\(\{/);
  assert.match(body, /reactionIntentActiveAtImpact: false,/);
  assert.match(body, /b3BodyClockStartedAtImpact: false,/);
  assert.match(body, /contactConstraintOwnsUntilDeflectImpulse: true,/);
  assert.match(body, /weaponArmContactConstrained: true,/);
  assert.match(body, /contactBasePoseAuthority: 'authoritative-impact-rig-snapshot'/);

  const probeIndex = body.indexOf('probeSweptSwordBucklerContact({');
  const confirmIndex = body.indexOf('parryGate.confirm({');
  const resolveIndex = body.indexOf('combat.resolveContact({');
  const gripIndex = body.indexOf('swordGripConstraint.start({');
  assert.ok(probeIndex < confirmIndex, 'real contact probe must precede Parry confirmation');
  assert.ok(confirmIndex < resolveIndex, 'Parry confirmation must precede combat resolution');
  assert.ok(resolveIndex < gripIndex, 'combat resolution must precede live Sword\/Grip ownership');
});

test('R18M.1 locks DEFLECT_IMPULSE release, confirmed-Parry fail-safe, continuity bridge, and OLD B3 handoff', () => {
  const body = sliceBetween(source, 'function releaseLiveContactToOldB3()', 'function recordVisibleOldB3Sample(');

  assert.match(body, /const defenderReleaseGate = defenderDeflectReleaseGate\(\);/);
  assert.match(body, /reason: 'defender-deflect-marker-not-reached'/);
  assert.match(source, /marker: 'deflect-impulse'/);
  assert.match(body, /buildLiveParryOldB3Handoff\(\{/);
  assert.match(body, /allowConfirmedParryFallback: true,/);
  assert.match(body, /publishPostCouplingRecoilStaggerHandoff\(attacker\.rig, \{/);
  assert.match(body, /step3AReleaseBlend = \{/);
  assert.match(body, /durationMs: handoff\.releaseBlendMs,/);
  assert.match(body, /targetPose: canonicalAttackerOldB3Pose \|\| frozenAttackerContactPose,/);
  assert.match(body, /visibleOldB3StartsAtDeflectImpulse: true,/);
  assert.match(body, /weaponArmContactConstrained: false,/);

  assert.match(html, /confirmed-Parry fail-safe/);
  assert.match(html, /28ms continuity bridge/);
  assert.match(html, /OLD B3 runs from elapsed 0/);
});

test('R18M.1 locks TOP\/RIGHT calibrated arm assistance while LEFT release remains deferred', () => {
  assert.match(
    source,
    /proximalAssistBone: selectedDirection === 'top' \|\| selectedDirection === 'right' \? 'upperarm\.r' : null,/,
  );
  assert.match(
    source,
    /assistBone: selectedDirection === 'top' \|\| selectedDirection === 'right' \? 'lowerarm\.r' : null,/,
  );
  assert.match(
    source,
    /elbowPropagationActive: selectedDirection === 'top' \|\| selectedDirection === 'right',/,
  );
  assert.match(source, /shoulderPropagationActive: false,/);
  assert.match(html, /TOP\/RIGHT 7\/7/);
  assert.match(html, /LEFT release (?:仍)?(?:暫緩|deferred)/);
});

test('R18M.1 locks current verification budget so extraction cannot silently expand telemetry', () => {
  assert.match(source, /const MAX_REPORT_DOM_CHARACTERS = 60000;/);
  assert.match(source, /const RECENT_COMPACT_TRACE_FRAMES = 8;/);
  assert.match(source, /telemetryDetail: 'compact-scalar-frames-only'/);
  assert.match(html, /Verification report ≤ 60,000 characters/);
});
