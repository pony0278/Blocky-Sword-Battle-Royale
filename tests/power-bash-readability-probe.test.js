import test from 'node:test';
import assert from 'node:assert/strict';

import {
  POWER_BASH_READABILITY_CANDIDATE_IDS,
  POWER_BASH_READABILITY_CANDIDATES,
  POWER_BASH_READABILITY_STAGE,
  buildPowerBashReadabilityProbeReport,
  resolvePowerBashReadabilityCandidate,
  samplePowerBashReadabilityCandidateProgress,
} from '../src/animation/power-bash-readability-probe.js';
import {
  PRODUCTION_PARRY_DEFLECT_VARIANTS,
  getProductionParryDeflectProfile,
} from '../src/animation/parry-contact-deflect-runtime-clip.js';

test('G3.6.1 exposes Full / Current / Extended Power Bash readability candidates without changing production', () => {
  assert.equal(POWER_BASH_READABILITY_STAGE, 'G3.6.1');
  assert.deepEqual(POWER_BASH_READABILITY_CANDIDATES.map((entry) => entry.id), [
    POWER_BASH_READABILITY_CANDIDATE_IDS.FULL_SOURCE,
    POWER_BASH_READABILITY_CANDIDATE_IDS.CURRENT_G36,
    POWER_BASH_READABILITY_CANDIDATE_IDS.EXTENDED,
  ]);

  const production = getProductionParryDeflectProfile(PRODUCTION_PARRY_DEFLECT_VARIANTS.PARRY);
  const current = resolvePowerBashReadabilityCandidate(POWER_BASH_READABILITY_CANDIDATE_IDS.CURRENT_G36, 2);
  assert.equal(current.sourceStartSeconds, production.deflectStartSeconds);
  assert.equal(current.sourceEndSeconds, production.deflectEndSeconds);
  assert.equal(current.playbackRate, production.deflectRate);
  assert.equal(current.productionReference, true);

  // Freeze the production values that were visually reported as too short.
  assert.equal(production.deflectStartSeconds, 0.12);
  assert.equal(production.deflectEndSeconds, 0.28);
  assert.equal(production.deflectRate, 1.1);
});

test('G3.6.1 quantifies why the current Power Bash second beat is hard to read at 30fps', () => {
  const report = buildPowerBashReadabilityProbeReport(2);
  const current = report.candidates.find((entry) => entry.id === POWER_BASH_READABILITY_CANDIDATE_IDS.CURRENT_G36);
  const extended = report.candidates.find((entry) => entry.id === POWER_BASH_READABILITY_CANDIDATE_IDS.EXTENDED);

  assert.ok(Math.abs(current.visualDurationSeconds - (0.16 / 1.1)) < 1e-9);
  assert.ok(current.approximateFrames30 < 5);
  assert.ok(extended.visualDurationSeconds > 0.45);
  assert.ok(extended.approximateFrames30 > 14);
  assert.ok(report.diagnostics.extendedToCurrentDurationRatio > 3);
  assert.equal(report.productionUnchanged, true);
});

test('G3.6.1 Full Source resolves dynamically to the entire clip and samples by normalized progress', () => {
  const full = resolvePowerBashReadabilityCandidate(POWER_BASH_READABILITY_CANDIDATE_IDS.FULL_SOURCE, 1.8);
  assert.equal(full.sourceStartSeconds, 0);
  assert.equal(full.sourceEndSeconds, 1.8);
  assert.equal(full.playbackRate, 0.5);
  assert.equal(full.visualDurationSeconds, 3.6);
  assert.equal(samplePowerBashReadabilityCandidateProgress(full, 0.5, 1.8), 0.9);
});
