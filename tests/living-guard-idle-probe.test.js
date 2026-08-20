import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LIVING_GUARD_IDLE_BONE_WEIGHTS,
  LIVING_GUARD_IDLE_CANONICAL_SAMPLE,
  LIVING_GUARD_IDLE_CANDIDATE_IDS,
  LIVING_GUARD_IDLE_CANDIDATES,
  LIVING_GUARD_IDLE_STAGE,
  buildLivingGuardIdleProbeReport,
  getLivingGuardIdleBoneWeight,
  livingGuardCanonicalSourceTime,
  sampleLivingGuardIdleCandidate,
} from '../src/combat/living-guard-idle-probe.js';

test('G3.6.4 exposes Stable, Skyrim Live, and Living Triangle candidates without changing production', () => {
  assert.equal(LIVING_GUARD_IDLE_STAGE, 'G3.6.4');
  assert.deepEqual(LIVING_GUARD_IDLE_CANDIDATES.map((candidate) => candidate.id), [
    LIVING_GUARD_IDLE_CANDIDATE_IDS.STABLE_G363,
    LIVING_GUARD_IDLE_CANDIDATE_IDS.SKYRIM_LIVE,
    LIVING_GUARD_IDLE_CANDIDATE_IDS.LIVING_TRIANGLE,
  ]);
  const report = buildLivingGuardIdleProbeReport(1.2);
  assert.equal(report.productionUnchanged, true);
  assert.equal(report.productionStage, 'G3.6.3');
  assert.equal(report.canonicalSample, 0.5);
});

test('Stable G3.6.3 always samples the canonical 50 percent Guard pose', () => {
  assert.equal(LIVING_GUARD_IDLE_CANONICAL_SAMPLE, 0.5);
  assert.equal(livingGuardCanonicalSourceTime(0.8), 0.4);
  for (const elapsed of [0, 0.1, 0.9, 4.2]) {
    const sample = sampleLivingGuardIdleCandidate(LIVING_GUARD_IDLE_CANDIDATE_IDS.STABLE_G363, elapsed, 0.8);
    assert.equal(sample.sourceTimeSeconds, 0.4);
    assert.equal(sample.live, false);
    assert.equal(sample.productionReference, true);
  }
});

test('Skyrim Live loops the corrected source at full strength from the canonical phase', () => {
  const start = sampleLivingGuardIdleCandidate(LIVING_GUARD_IDLE_CANDIDATE_IDS.SKYRIM_LIVE, 0, 0.8);
  const later = sampleLivingGuardIdleCandidate(LIVING_GUARD_IDLE_CANDIDATE_IDS.SKYRIM_LIVE, 0.6, 0.8);
  assert.equal(start.sourceTimeSeconds, 0.4);
  assert.ok(Math.abs(later.sourceTimeSeconds - 0.2) < 1e-9);
  assert.equal(later.sourceRate, 1);
  assert.equal(getLivingGuardIdleBoneWeight(LIVING_GUARD_IDLE_CANDIDATE_IDS.SKYRIM_LIVE, 'hips'), 1);
});

test('Living Triangle keeps root and hips frozen while blending restrained upper-body motion', () => {
  const sample = sampleLivingGuardIdleCandidate(LIVING_GUARD_IDLE_CANDIDATE_IDS.LIVING_TRIANGLE, 1, 0.8);
  assert.equal(sample.sourceRate, 1);
  assert.equal(getLivingGuardIdleBoneWeight(LIVING_GUARD_IDLE_CANDIDATE_IDS.LIVING_TRIANGLE, 'root'), 0);
  assert.equal(getLivingGuardIdleBoneWeight(LIVING_GUARD_IDLE_CANDIDATE_IDS.LIVING_TRIANGLE, 'hips'), 0);
  assert.equal(getLivingGuardIdleBoneWeight(LIVING_GUARD_IDLE_CANDIDATE_IDS.LIVING_TRIANGLE, 'chest'), LIVING_GUARD_IDLE_BONE_WEIGHTS.chest);
  assert.ok(getLivingGuardIdleBoneWeight(LIVING_GUARD_IDLE_CANDIDATE_IDS.LIVING_TRIANGLE, 'chest') > 0.25);
  assert.ok(getLivingGuardIdleBoneWeight(LIVING_GUARD_IDLE_CANDIDATE_IDS.LIVING_TRIANGLE, 'chest') < 0.4);
  assert.ok(getLivingGuardIdleBoneWeight(LIVING_GUARD_IDLE_CANDIDATE_IDS.LIVING_TRIANGLE, 'wrist.r') < 0.35);
  assert.equal(sample.live, true);
});
