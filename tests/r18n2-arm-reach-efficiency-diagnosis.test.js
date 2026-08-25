import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const trackingSource = await readFile(new URL('../src/combat/guard-threat-tracking.js', import.meta.url), 'utf8');
const preContactSource = await readFile(new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url), 'utf8');
const probeSource = await readFile(new URL('../tools/action-studio/r18n1-active-intercept-browser-probe.mjs', import.meta.url), 'utf8');

test('R18N.2 records per-joint geometry without changing arm budgets', () => {
  assert.match(trackingSource, /function setWorldDirectionDelta\(THREE, bone, effectorWorld, targetWorld, maxDegrees, diagnostic = null\)/);
  assert.match(trackingSource, /radialTargetMeters/);
  assert.match(trackingSource, /tangentialTargetMeters/);
  assert.match(trackingSource, /radialDemandRatio/);
  assert.match(trackingSource, /maxChordDisplacementMeters/);
  assert.match(trackingSource, /budgetSaturated/);
  assert.match(trackingSource, /function applyJointSolvePass\(/);
  assert.match(trackingSource, /shieldCenterStepMeters/);
  assert.match(trackingSource, /targetDistanceReductionMeters/);
  assert.match(trackingSource, /displacementPerDegreeMeters/);
  assert.match(trackingSource, /upperArmMaxDegrees: 14/);
  assert.match(trackingSource, /lowerArmMaxDegrees: 18/);
  assert.match(trackingSource, /maxTrackingSpeedMps: 1\.6/);
});

test('R18N.2 publishes read-only primary and residual reach efficiency reports', () => {
  assert.match(trackingSource, /function buildReachEfficiencyReport\(/);
  assert.match(trackingSource, /displacementEfficiency/);
  assert.match(trackingSource, /convergenceEfficiency/);
  assert.match(trackingSource, /budgetUtilization/);
  assert.match(trackingSource, /saturatedPasses/);
  assert.match(trackingSource, /read-only-arm-reach-efficiency-diagnosis-no-solver-authority/);
  assert.match(preContactSource, /primaryArmReachEfficiency: exchangeState\.latestFineTracking\?\.reachEfficiency \?\? null/);
  assert.match(preContactSource, /residualArmReachEfficiency: residualRefinement\?\.reachEfficiency \?\? null/);
});

test('R18N.2 browser probe carries efficiency evidence while preserving contact result checks', () => {
  assert.match(probeSource, /primaryArmReachEfficiency: drive\.primaryArmReachEfficiency \?\? null/);
  assert.match(probeSource, /primarySaturatedPasses/);
  assert.match(probeSource, /maxPrimaryRadialDemandRatio/);
  assert.match(probeSource, /primaryTargetReductionCm/);
  assert.match(probeSource, /confirmation: row\.final\?\.confirmation\?\.accepted === true/);
  assert.match(probeSource, /whiff: Boolean\(row\.final\?\.whiff\)/);
});

test('R18N.2 remains diagnosis-only and does not introduce contact authority', () => {
  const reachReportStart = trackingSource.indexOf('function buildReachEfficiencyReport(');
  const runtimeStart = trackingSource.indexOf('export function createGuardThreatTrackingRuntime', reachReportStart);
  assert.ok(reachReportStart >= 0 && runtimeStart > reachReportStart);
  const diagnosisHelper = trackingSource.slice(reachReportStart, runtimeStart);
  assert.doesNotMatch(diagnosisHelper, /confirm|contactGate|parryGate|DEFLECT|oldB3/i);
  assert.doesNotMatch(preContactSource, /primaryArmReachEfficiency[\s\S]{0,160}(confirm|accepted\s*=|parryGate\.arm)/i);
});
