import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const trackingSource = await readFile(new URL('../src/combat/guard-threat-tracking.js', import.meta.url), 'utf8');
const preContactSource = await readFile(new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url), 'utf8');
const probeSource = await readFile(new URL('../tools/action-studio/r18n1-active-intercept-browser-probe.mjs', import.meta.url), 'utf8');

test('R18N.2 leaves the arm solver byte-semantics untouched', () => {
  assert.match(trackingSource, /function setWorldDirectionDelta\(THREE, bone, effectorWorld, targetWorld, maxDegrees\)/);
  assert.doesNotMatch(trackingSource, /reachEfficiency|radialDemandRatio|applyJointSolvePass|R18N\.2/);
  assert.match(trackingSource, /upperArmMaxDegrees: 14/);
  assert.match(trackingSource, /lowerArmMaxDegrees: 18/);
  assert.match(trackingSource, /maxTrackingSpeedMps: 1\.6/);
});

test('R18N.2 measures cross-frame retention around the existing solver', () => {
  assert.match(preContactSource, /previousPostTrackingSurface/);
  assert.match(preContactSource, /frameEntryResetMeters/);
  assert.match(preContactSource, /presentationStepMeters/);
  assert.match(preContactSource, /primaryTrackingStepMeters/);
  assert.match(preContactSource, /entryLostConvergenceMeters/);
  assert.match(preContactSource, /primaryTargetReductionMeters/);
  assert.match(preContactSource, /postPrimaryTargetDeltaMeters/);
  assert.match(preContactSource, /primaryDisplacementEfficiency/);
  assert.match(preContactSource, /primaryConvergenceEfficiency/);
  assert.match(preContactSource, /appliedDegrees: exchangeState\.latestFineTracking\?\.appliedDegrees \?\? null/);
  assert.match(preContactSource, /read-only-cross-frame-pose-retention-diagnosis/);
});

test('R18N.2 browser probe carries retention evidence and contact result checks', () => {
  assert.match(probeSource, /crossFrameRetention: drive\.crossFrameRetention \?\? null/);
  assert.match(probeSource, /maxFrameEntryResetCm/);
  assert.match(probeSource, /sumEntryLostConvergenceCm/);
  assert.match(probeSource, /sumPrimaryTargetReductionCm/);
  assert.match(probeSource, /maxUpperArmDegrees/);
  assert.match(probeSource, /maxLowerArmDegrees/);
  assert.match(probeSource, /confirmation: row\.final\?\.confirmation\?\.accepted === true/);
  assert.match(probeSource, /whiff: Boolean\(row\.final\?\.whiff\)/);
});

test('R18N.2 remains diagnosis-only and introduces no contact authority', () => {
  const reportStart = preContactSource.indexOf('const crossFrameRetention = Object.freeze({');
  const reportEnd = preContactSource.indexOf('const residualAfterRefinement', reportStart);
  assert.ok(reportStart >= 0 && reportEnd > reportStart);
  const diagnosisBlock = preContactSource.slice(reportStart, reportEnd);
  assert.doesNotMatch(diagnosisBlock, /confirm|contactGate|parryGate\.arm|DEFLECT|oldB3/i);
  assert.doesNotMatch(diagnosisBlock, /\.quaternion|updateMatrixWorld|fineTrackingRuntime\.update|residualBodyReachRuntime\.update/);
});
