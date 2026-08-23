import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../tools/action-studio/shield-driven-contact-coupling-lab-r281.js', import.meta.url),
  'utf8',
);
const html = readFileSync(
  new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url),
  'utf8',
);
const cameraSource = readFileSync(
  new URL('../tools/action-studio/free-inspection-camera-controls.js', import.meta.url),
  'utf8',
);

function functionBody(name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must exist`);
  return source.slice(start, end);
}

test('Step 3A exposes an explicit live contact inspection state and markers', () => {
  assert.match(html, /Live Shield → Sword → Wrist-Grip Constraint/);
  assert.match(html, /Cyan = shield target/);
  assert.match(html, /yellow = sword contact/);
  assert.match(html, /LIVE CONTACT VERIFIED/);
  assert.match(html, /all seven inspection gates pass/);
  assert.match(source, /STEP 3A HOLD · LIVE CONTACT VERIFIED/);
  assert.match(source, /formatInspectionFailureSummary/);
  assert.match(source, /failedGateCount/);
  assert.match(source, /formatTerminalState/);
  assert.match(source, /contactGeometryDiagnostic: describeContactGeometry/);
  assert.match(source, /bladePercent/);
  assert.match(source, /shieldRegion/);
});

test('Step 3A provides a free inspection camera without changing combat time', () => {
  assert.match(source, /createFreeInspectionCameraControls/);
  assert.match(source, /freeCamera\.update\(rawDeltaMs \/ 1000\)/);
  assert.match(source, /inspectionCamera: freeCamera\.snapshot\(\)/);
  assert.match(html, /Free inspection camera/);
  assert.match(html, /W A S D · Q down · E up/);
  assert.match(cameraSource, /pointerdown/);
  assert.match(cameraSource, /pointermove/);
  assert.match(cameraSource, /wheel/);
  assert.match(cameraSource, /KeyW/);
});

test('Step 3A renders and reports all three original-attack-line clearance gates', () => {
  assert.match(source, /originalAttackAxisLine/);
  assert.match(source, /currentSwordAxisLine/);
  assert.match(source, /currentWristGripLine/);
  assert.match(source, /LINE CLEAR \$\{lineGate\(lineClearance\.pass\)\}/);
  assert.match(html, /sword axis ≥ 7° · hilt offline ≥ 2\.5cm · wrist→grip ≥ 7°/);
  assert.match(html, /red = original attack axis/);
});
test('Step 3A starts only after the manual gate confirms eligible real contact', () => {
  const resolve = functionBody('resolveContact', 'showParryCue');
  const confirm = resolve.indexOf('parryGate.confirm');
  const resolveCombat = resolve.indexOf('combat.resolveContact');
  const liveConstraint = resolve.indexOf('swordGripConstraint.start');

  assert.match(resolve, /probeSweptSwordBucklerContact/);
  assert.match(resolve, /if \(!latestContact\.contact\) return/);
  assert.ok(confirm >= 0 && resolveCombat > confirm && liveConstraint > resolveCombat);
  assert.doesNotMatch(resolve, /publishPostCouplingRecoilStaggerHandoff/);
});

test('Step 3A freezes OLD B3, then samples live shield after guard update before solving wrist-grip contact', () => {
  const frameStart = source.indexOf('function frame(');
  const frameEnd = source.indexOf('requestAnimationFrame(frame);', frameStart);
  assert.ok(frameStart >= 0 && frameEnd > frameStart);
  const frame = source.slice(frameStart, frameEnd);
  const ownership = frame.indexOf('if (step3AContactTransfer && latestParryConfirmation?.accepted)');
  const freeze = frame.indexOf('combat.update(0, { camera })', ownership);
  const guardUpdate = frame.indexOf('guardRuntime.update(deltaMs, camera)', freeze);
  const liveUpdate = frame.indexOf('swordGripConstraint.update(deltaSeconds', guardUpdate);
  const swordUpdate = frame.indexOf('attackerSword.update(); defenderSword?.update();', liveUpdate);

  assert.ok(ownership >= 0 && freeze > ownership);
  assert.ok(guardUpdate > freeze && liveUpdate > guardUpdate && swordUpdate > liveUpdate);
  assert.match(frame, /surfaceAtFrame: buckler\.getWorldParrySurface\(\)/);
  assert.match(source, /b3ClockFrozenDuringStep3A: Boolean\(step3AContactTransfer && latestParryConfirmation\?\.accepted\)/);
});

test('Step 3A uses wrist.r hierarchy travel instead of a scheduled target angle', () => {
  assert.match(source, /modifiedBone: 'wrist\.r'/);
  assert.match(source, /propagatedBones: Object\.freeze\(\['hand\.r', 'handslot\.r'\]\)/);
  assert.match(source, /noPresetMotionCurve: true/);
  assert.match(source, /actualHandTravelMeters/);
  assert.match(source, /actualGripTravelMeters/);
  assert.doesNotMatch(source, /targetHandDegrees|driveDurationMs|smoothstep/);
});

test('Step 3A does not add the live grip constraint to the original Block pre-contact path', () => {
  const block = functionBody('updateBlockPreContact', 'updateParryPreContact');
  assert.match(block, /planArticulatedImpactBracing/);
  assert.match(block, /planFineGuardTracking/);
  assert.doesNotMatch(block, /swordGripConstraint/);
});

test('Step 1 direct OLD B3 remains independent of Step 3A runtime', () => {
  const directB3 = functionBody('forceOldTwoActorB3', 'startAttack');
  assert.match(directB3, /publishPostCouplingRecoilStaggerHandoff/);
  assert.match(directB3, /combat\.update\(0\.021/);
  assert.doesNotMatch(directB3, /swordGripConstraint\.start/);
});

test('Step 3A classifies a Parry whiff from measured sweep geometry without changing contact authority', () => {
  assert.match(html, /outside shield edge \/ missed shield plane \/ outside active window/);
  assert.match(html, /final plane\/edge gap · persistent arm tracking/);
  assert.match(source, /buildParryWhiffDiagnostic/);
  assert.match(source, /function recordWhiffProbe/);
  assert.match(source, /diagnostics\?\.closestApproach/);
  assert.match(source, /CONTACT_OUTSIDE_ACTIVE_WINDOW: 'CONTACT OUTSIDE ACTIVE WINDOW'/);
  assert.match(source, /OUTSIDE_SHIELD_EDGE: 'OUTSIDE SHIELD EDGE'/);
  assert.match(source, /MISSED_SHIELD_PLANE: 'MISSED SHIELD PLANE'/);
  assert.match(source, /authority: 'presentation-diagnostic-only-no-combat-authority'/);
  assert.match(source, /if \(!latestContact\.contact\) return/);
});
test('Step 3A replaces only an unreachable linear target with reachable measured sweep guidance', () => {
  const updateStart = source.indexOf('function updateParryPreContact(');
  const updateEnd = source.indexOf('function updatePreContact(', updateStart);
  const update = source.slice(updateStart, updateEnd);
  assert.match(source, /selectReachableParryInterceptTarget/);
  assert.match(update, /measureSweptSwordBucklerClosestApproach/);
  assert.match(update, /predictedTrackingPlan: latestPredictiveAnalysis\?\.trackingPlan/);
  assert.match(update, /threat: latestReachableInterceptTarget\.threat/);
  assert.match(source, /measuredSweepFallbackIsGuidanceOnly/);
  assert.match(source, /real contact still required/);
  assert.match(html, /MEASURED SWEEP preserves world direction \+ 1\.2cm inset/);
  assert.match(html, /real contact still required/);
});
test('armed Parry samples a continuous post-tracking shield surface before selecting and driving the next frame', () => {
  const updateStart = source.indexOf('function updateParryPreContact(');
  const updateEnd = source.indexOf('function updatePreContact(', updateStart);
  const update = source.slice(updateStart, updateEnd);
  const presentation = update.indexOf('predictivePresentation.update');
  const continuity = update.indexOf('const continuitySurface = previousShieldLeadSurface');
  const measure = update.indexOf('measureSweptSwordBucklerClosestApproach');
  const select = update.indexOf('selectReachableParryInterceptTarget');
  const plan = update.indexOf('planGuardThreatCorrection');
  const drive = update.indexOf('fineTrackingRuntime.update');
  assert.ok(presentation >= 0 && continuity > presentation && measure > continuity && select > measure && plan > select && drive > plan);
  assert.match(source, /selectorBaseline: 'previous-frame-post-tracking-world-shield-surface'/);
  assert.match(update, /latestReachableInterceptTarget\?\.fallbackApplied[\s\S]*latestReachableInterceptTarget\.trackingPlan/);
  assert.match(source, /drivePlanSource: latestReachableInterceptTarget\?\.fallbackApplied/);
  assert.match(source, /surface-relative-measured-contact-correction/);
  assert.match(source, /correctionDirectionDot/);
  assert.match(source, /measuredRadialContactCorrectionMeters/);
  assert.match(source, /if \(selectedMode !== 'parry' \|\| !parryGate\.armed/);
  assert.match(source, /selector NO ARMED DRIVE FRAME/);
  assert.match(html, /BEST PARRY TIMING · R18A/);
});
test('armed Parry recruits measured wrist/chest/spine reach after the arm residual and before contact authority', () => {
  const updateStart = source.indexOf('function updateParryPreContact(');
  const updateEnd = source.indexOf('function updatePreContact(', updateStart);
  const update = source.slice(updateStart, updateEnd);
  const primaryDrive = update.indexOf('fineTrackingRuntime.update');
  const primarySurface = update.indexOf('const primaryTrackingSurfaceAfter', primaryDrive);
  const residualBefore = update.indexOf('const residualBeforeRefinement', primarySurface);
  const residualSelect = update.indexOf('const residualInterceptTarget', residualBefore);
  const refine = update.indexOf('fineTrackingRuntime.refineMeasuredContact', residualSelect);
  const residualAfterArm = update.indexOf('const residualAfterArmRefinement', refine);
  const bodyReach = update.indexOf('residualBodyReachRuntime.update', residualAfterArm);
  const residualAfter = update.indexOf('const residualAfterRefinement', bodyReach);
  assert.ok(primaryDrive >= 0 && primarySurface > primaryDrive && residualBefore > primarySurface);
  assert.ok(residualSelect > residualBefore && refine > residualSelect);
  assert.ok(residualAfterArm > refine && bodyReach > residualAfterArm && residualAfter > bodyReach);
  assert.match(update, /jointBudgetScale: 0\.35/);
  assert.match(update, /maxResidualMeters: 0\.06/);
  assert.match(update, /residualEdgeReductionMeters/);
  assert.match(update, /residualPlaneReductionMeters/);
  assert.match(update, /bodyEdgeReductionMeters/);
  assert.match(update, /bodyPlaneReductionMeters/);
  assert.match(source, /createGuardResidualBodyReachRuntime/);
  assert.match(source, /persistent-arm-carry-then-live-wrist-chest-spine-reach-to-real-contact-diagnostic/);
  assert.match(source, /residual edge \$\{edgeBefore\}→\$\{edgeAfter\}/);
  assert.match(source, /carry \$\{carryBefore\}→\$\{carryAfter\}/);
  assert.match(source, /refine \$\{refinementStep\} · rdir \$\{refinementDirection\}/);
  assert.match(source, /arm \$\{armReach\} · wrist \$\{wristDegrees\}/);
  assert.match(source, /torso \$\{torsoDegrees\} · reach \$\{bodyReachBefore\}→\$\{bodyReachAfter\}/);
  assert.match(html, /defender wrist\.l · chest · spine only/);
  assert.match(html, /defender hips · legs · feet/);
  const block = functionBody('updateBlockPreContact', 'updateParryPreContact');
  assert.doesNotMatch(block, /refineMeasuredContact/);
  assert.doesNotMatch(block, /residualBodyReachRuntime\.update/);
});