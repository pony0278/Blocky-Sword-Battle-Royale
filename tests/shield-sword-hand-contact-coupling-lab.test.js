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
  assert.match(html, /confirmed real Parry uses the same bridge as a fail-safe and cannot remain frozen/);
  assert.match(html, /TOP\/RIGHT 7\/7/);
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

test('R18E exposes URL-gated low-stance tuning without changing real-contact authority', () => {
  assert.match(html, /id="stanceDebugPanel" hidden/);
  assert.match(html, /id="debugLeadMs" type="range"/);
  assert.match(html, /id="debugMaxCrouchCm" type="range"/);
  assert.match(html, /id="debugCrouchSpeed" type="range"/);
  assert.match(html, /id="debugEdgeCm" type="range"/);
  assert.match(html, /id="debugPlaneCm" type="range"/);
  assert.match(html, /id="debugLowGapCm" type="range"/);
  assert.match(html, /id="debugDownRatio" type="range"/);
  assert.match(html, /id="debugKneeBandCm" type="range"/);
  assert.match(html, /id="debugArmAttemptCm" type="range"/);
  assert.match(html, /APPLY \+ RETRY/);
  assert.match(source, /DEBUG_QUERY\.get\('debug'\) === '1'/);
  assert.match(source, /rawQueryValue == null \|\| rawQueryValue\.trim\(\) === ''/);
  assert.match(source, /\? Number\.NaN/);
  assert.match(source, /query: 'leadMs'/);
  assert.match(source, /query: 'crouchCm'/);
  assert.match(source, /query: 'crouchSpeed'/);
  assert.match(source, /query: 'edgeCm'/);
  assert.match(source, /query: 'planeCm'/);
  assert.match(source, /query: 'lowGapCm'/);
  assert.match(source, /query: 'downRatio'/);
  assert.match(source, /query: 'kneeBandCm'/);
  assert.match(source, /query: 'armAttemptCm'/);
  assert.match(source, /profile: DEBUG_MODE \? debugStanceProfile : null/);
  assert.match(source, /DEBUG pred \$\{predictedDecision\}/);
  assert.match(source, /anticipatedEligibilityReason/);
  assert.match(source, /pflags \$\{predictedFlags\}/);
  assert.match(source, /latestThreatSelection/);
  assert.match(source, /debug-profile-changes-posture-guidance-only-real-swept-contact-remains-success-authority/);
  assert.match(source, /if \(!latestContact\.contact\) return/);
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

test('R18I lets live contact own the final pose while OLD B3 waits at presentation origin', () => {
  const frameStart = source.indexOf('function frame(');
  const frameEnd = source.indexOf('requestAnimationFrame(frame);', frameStart);
  assert.ok(frameStart >= 0 && frameEnd > frameStart);
  const frame = source.slice(frameStart, frameEnd);
  const ownership = frame.indexOf('if (step3AOwnsLiveContact())');
  const bodyRecoil = frame.indexOf('combat.update(deltaSeconds', ownership);
  const channelMask = frame.indexOf('TWO_ACTOR_PARRY_REACTION_CHANNELS.LIVE_CONTACT_HOLD', bodyRecoil);
  const guardUpdate = frame.indexOf('guardRuntime.update(deltaMs, camera)', channelMask);
  const liveUpdate = frame.indexOf('swordGripConstraint.update(deltaSeconds', guardUpdate);
  const release = frame.indexOf('releaseLiveContactToOldB3()', liveUpdate);
  const swordUpdate = frame.indexOf('attackerSword.update(); defenderSword?.update();', liveUpdate);

  assert.ok(ownership >= 0 && bodyRecoil > ownership && channelMask > bodyRecoil);
  assert.ok(guardUpdate > channelMask && liveUpdate > guardUpdate && release > liveUpdate && swordUpdate > release);
  assert.match(frame, /surfaceAtFrame: buckler\.getWorldParrySurface\(\)/);
  assert.match(frame, /reactionIntentAppliedBeforeConstraint: false/);
  assert.match(source, /publishPostCouplingRecoilStaggerHandoff/);
  assert.match(source, /releasedToOldB3/);
  assert.match(source, /b3BodyClockStartedAtImpact: false/);
  assert.match(source, /fullOldB3ReactionIntentActiveAtImpact: false/);
  assert.match(source, /contactConstraintOwnsUntilDeflectImpulse: true/);
  assert.match(source, /boundedProximalArmCorrectionBeforeForearmAndWrist/);
  assert.match(source, /proximalAssistBone/);
  assert.match(source, /weaponArmRemainsContactConstrainedDuringStep3A/);
  assert.match(source, /(?:exchangeState\.)?frozenAttackerContactPose = captureRigPose\(attacker\.rig\)/);
  assert.match(source, /applyRigPose\(attacker\.rig, (?:exchangeState\.)?frozenAttackerContactPose\)/);
  assert.match(source, /(?:exchangeState\.)?canonicalAttackerOldB3Pose = captureRigPose\(attacker\.rig\)/);
  assert.match(source, /sampleCanonicalInterruptionPose\(interruption\)/);
  assert.match(frame, /holdAttackerInterruption: true/);
  assert.match(source, /frozenContactPoseRestoredBeforeEveryBodyOverlay/);
  assert.match(source, /bodyCompletionCannotReleaseContactOwnedPose/);
  assert.match(source, /contactOwnsFinalPoseBeforeVisibleOldB3/);
  assert.match(source, /b3PresentationParkedAtOriginDuringLiveContact/);
});

test('R18I preserves predictive defender time and latches the defender deflect marker', () => {
  const resolve = functionBody('resolveContact', 'showParryCue');
  const release = functionBody('releaseLiveContactToOldB3', 'forceOldTwoActorB3');

  assert.match(resolve, /latestPredictiveHandoff\.defenderPresentationOffsetSeconds/);
  assert.match(resolve, /defenderPresentationOffsetSeconds:/);
  assert.match(source, /function defenderDeflectReleaseGate\(\)/);
  assert.match(source, /function updateDefenderDeflectReleaseGate\(\)/);
  assert.match(source, /latchedDefenderDeflectReleaseGate/);
  assert.match(source, /latched-defender-deflect-marker-gates-attacker-release/);
  assert.match(source, /PARRY_ATTACKER_RELEASE_SOURCE_SECONDS/);
  assert.match(release, /if \(!defenderReleaseGate\.passed\)/);
  assert.match(release, /defender-deflect-marker-not-reached/);
  assert.match(release, /allowConfirmedParryFallback: true/);
  assert.match(source, /defenderParryPresentationNeverRewindsAtContact/);
  assert.match(source, /oldB3WeaponArmReleasedOnlyAfterDefenderDeflectMarker/);
});

test('R18I releases contact through 28ms continuity and starts canonical OLD B3 from zero', () => {
  const frameStart = source.indexOf('function frame(');
  const frameEnd = source.indexOf('requestAnimationFrame(frame);', frameStart);
  const frame = source.slice(frameStart, frameEnd);
  const liveContact = frame.indexOf('if (step3AOwnsLiveContact())');
  const latch = frame.indexOf('TWO_ACTOR_PARRY_REACTION_PHASE_LATCHES.LIVE_CONTACT', liveContact);
  const releaseUpdate = frame.indexOf('combat.update(deltaSeconds, { camera })', latch);
  const consume = frame.indexOf('postCouplingHandoffApplied === true', releaseUpdate);

  assert.ok(liveContact >= 0 && latch > liveContact && releaseUpdate > latch && consume > releaseUpdate);
  assert.match(source, /oldB3ReleaseStartPresentationMs/);
  assert.match(source, /continuityBridgeMs/);
  assert.match(source, /handoffConsumedByOldB3/);
  assert.match(source, /continuationStartedAtPresentationMs/);
  assert.match(source, /bodyRestartedAtRelease: false/);
  assert.match(source, /continuationPlanIdentityPreserved/);
  assert.match(source, /continuationElapsedPreserved/);
  assert.match(source, /attackerReactionDefinitionId/);
  assert.match(source, /oldB3PlanBackwardPitchDegrees/);
  assert.match(source, /oldB3AppliedBodyChainPitchAtReleaseDegrees/);
  assert.match(source, /oldB3InitialElapsedMs/);
  assert.match(source, /parryImpactSelectsExaggeratedOldB3ReactionDefinition/);
  assert.match(source, /deflect-impulse-continuity-bridge-to-canonical-old-b3-from-zero/);
  assert.match(source, /from '\.\.\/\.\.\/src\/combat\/post-coupling-recoil-stagger-handoff\.js';/);
  assert.doesNotMatch(source, /post-coupling-recoil-stagger-handoff\.js\?v=/);
  assert.match(source, /OLD B3 STARTED/);
  assert.match(source, /deflectImpulseStartsOldB3FromZeroWithoutBodyRestart/);
  assert.match(source, /full-rig-live-contact-pose-to-canonical-interruption-pose/);
  assert.match(source, /measureAttackerRecoilWorldSilhouette/);
  assert.match(source, /visibleOldB3Peak\?\.readable === true/);
  assert.doesNotMatch(source, /visibleOldB3Peak\?\.backwardChainPitchDegrees/);
  assert.match(html, /canonical OLD B3.*elapsed 0/);
});

test('Step 3A uses bounded lowerarm plus wrist hierarchy travel instead of a scheduled target angle', () => {
  assert.match(source, /modifiedBone: 'wrist\.r'/);
  assert.match(source, /propagatedBones: Object\.freeze\(\['hand\.r', 'handslot\.r'\]\)/);
  assert.match(source, /assistBone:[^\n]*'lowerarm\.r'/);
  assert.match(source, /blendRecoveryPose/);
  assert.match(source, /noPresetMotionCurve: true/);
  assert.match(source, /actualHandTravelMeters/);
  assert.match(source, /actualGripTravelMeters/);
  assert.match(source, /residualCorrectionPasses/);
  assert.match(source, /appliedResidualForearmDegrees/);
  assert.match(source, /oldB3WeaponArmReleasedAfterInspectionOrConfirmedFallback/);
  assert.match(source, /contactQaCannotPermanentlySuppressConfirmedParryOldB3/);
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
  assert.match(html, /BEST PARRY TIMING · R18I/);
});
test('armed Parry recruits predicted or measured low stance, holds it, and preserves contact authority', () => {
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
  const residualAfterBody = update.indexOf('const residualAfterBodyReach', bodyReach);
  const stanceReach = update.indexOf('residualStanceReachRuntime.update', residualAfterBody);
  const residualAfter = update.indexOf('const residualAfterRefinement', stanceReach);
  assert.ok(primaryDrive >= 0 && primarySurface > primaryDrive && residualBefore > primarySurface);
  assert.ok(residualSelect > residualBefore && refine > residualSelect);
  assert.ok(residualAfterArm > refine && bodyReach > residualAfterArm);
  assert.ok(residualAfterBody > bodyReach && stanceReach > residualAfterBody && residualAfter > stanceReach);
  assert.match(update, /jointBudgetScale: 0\.35/);
  assert.match(update, /maxResidualMeters: 0\.06/);
  assert.match(update, /residualEdgeReductionMeters/);
  assert.match(update, /residualPlaneReductionMeters/);
  assert.match(update, /bodyEdgeReductionMeters/);
  assert.match(update, /bodyPlaneReductionMeters/);
  assert.match(update, /stanceEdgeReductionMeters/);
  assert.match(update, /stancePlaneReductionMeters/);
  assert.match(source, /createGuardResidualBodyReachRuntime/);
  assert.match(source, /createGuardResidualStanceReachRuntime/);
  assert.match(update, /anticipatedClosestApproach: latestPredictiveAnalysis\?\.threat\?\.worldPoint/);
  assert.match(update, /point: latestPredictiveAnalysis\.threat\.worldPoint/);
  assert.match(update, /anticipatedLeadSeconds: latestPredictiveAnalysis\?\.threat\?\.futureSeconds/);  assert.match(source, /persistent-arm-carry-then-predicted-or-measured-low-threat-planted-stance-held-to-real-contact-or-reset-diagnostic/);
  assert.match(source, /residual edge \$\{edgeBefore\}→\$\{edgeAfter\}/);
  assert.match(source, /carry \$\{carryBefore\}→\$\{carryAfter\}/);
  assert.match(source, /refine \$\{refinementStep\} · rdir \$\{refinementDirection\}/);
  assert.match(source, /arm \$\{armReach\} · aedge \$\{edgeBefore\}→\$\{armEdgeAfter\} · wrist \$\{wristDegrees\}/);
  assert.match(source, /torso \$\{torsoDegrees\} · reach \$\{bodyReachBefore\}→\$\{bodyReachAfter\}/);
  assert.match(source, /sampledThreat\?\.kneeLineThreat/);
  assert.match(source, /y blade\/rim\/kneeL\/kneeR/);
  assert.match(source, /earlyLowThreatRecruitment/);
  assert.match(source, /stance src/);
  assert.match(source, /lead ' \+ stanceLead/);
  assert.match(source, /hold ' \+ stanceHold/);
  assert.match(source, /target ' \+ crouchTarget/);  assert.match(source, /stance \$\{stanceState\} · down \$\{downwardRatio\} · crouch/);
  assert.match(source, /feet \$\{footL\}\/\$\{footR\} \$\{planted\}/);
  assert.match(html, /compares the measured sword point with the predicted future sword point/);
  assert.match(html, /defender wrist\.l · chest · spine · hips · upper\/lower legs · foot orientation correction/);
  assert.match(html, /both foot world positions \(no step\)/);
  const block = functionBody('updateBlockPreContact', 'updateParryPreContact');
  assert.doesNotMatch(block, /refineMeasuredContact/);
  assert.doesNotMatch(block, /residualBodyReachRuntime\.update/);
  assert.doesNotMatch(block, /residualStanceReachRuntime\.update/);
});

test('F review batches presentation rebuilds and avoids dynamic debug bounds work', () => {
  const update = functionBody('updateParryPreContact', 'updatePreContact');
  const defenderUpdateCount = update.split('defender.update(0, camera)').length - 1;
  const swordUpdateCount = update.split('defenderSword?.update()').length - 1;
  const stanceSolve = update.indexOf('residualStanceReachRuntime.update');
  const presentationUpdate = update.indexOf('defender.update(0, camera)', stanceSolve);

  assert.equal(defenderUpdateCount, 1);
  assert.equal(swordUpdateCount, 1);
  assert.ok(stanceSolve >= 0 && presentationUpdate > stanceSolve);

  const markerSetter = functionBody('setInspectionLine', 'updateLiveContactMarkers');
  const markerUpdate = functionBody('updateLiveContactMarkers', 'resize');
  assert.ok(!markerSetter.includes('computeBoundingSphere'));
  assert.ok(!markerUpdate.includes('computeBoundingSphere'));
  assert.ok(source.includes('contactTravelLine.frustumCulled = false'));
  assert.ok(source.includes('line.frustumCulled = false'));

  const cue = functionBody('showParryCue', 'updateParryCue');
  assert.ok(cue.includes('state === parryCueState'));
  assert.ok(cue.includes(') return;'));
});

test('R18I keeps Parry review telemetry compact and caps Verification DOM work', () => {
  const compact = functionBody('compactInterceptDriveTelemetry', 'setInspectionLine');
  const traceCompact = functionBody('compactInterceptDriveTraceFrame', 'compactPredictiveThreat');
  assert.match(source, /const MAX_REPORT_DOM_CHARACTERS = 60000/);
  assert.match(source, /const RECENT_COMPACT_TRACE_FRAMES = 8/);
  assert.match(source, /interceptDriveTrace\.push\(compactInterceptDriveTraceFrame\(latestInterceptDriveReport\)\)/);
  assert.match(source, /recentFrames: Object\.freeze\(interceptDriveTrace\.slice\(-RECENT_COMPACT_TRACE_FRAMES\)\)/);
  assert.match(compact, /telemetryDetail: 'compact-scalar-frame'/);
  assert.match(compact, /compactGap\(value\.residualAfterRefinement\)/);
  assert.match(compact, /compactBodyReach\(value\.residualBodyReach\)/);
  assert.match(compact, /compactStanceReach\(value\.residualStanceReach\)/);
  assert.doesNotMatch(traceCompact, /anticipatedPlan|threatSelection|residualRefinement|residualBodyReach/);
  assert.match(source, /liveShieldSwordGripContactConstraint: compactLiveContactConstraint\(latestGripConstraintReport\)/);
  assert.match(source, /predictiveAnalysis: compactPredictiveAnalysis\(latestPredictiveAnalysis\)/);
  assert.match(source, /interceptTarget: compactReachableInterceptTarget\(latestReachableInterceptTarget\)/);
  assert.match(source, /reason: 'verification-report-exceeded-dom-budget'/);
  assert.match(source, /window\.__G43B5R281_PERF__/);
  assert.match(html, /Verification report .* 60,000 characters.*compact scalar frames only/);
});
