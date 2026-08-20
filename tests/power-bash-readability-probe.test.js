import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  POWER_BASH_READABILITY_CANDIDATE_IDS,
  POWER_BASH_READABILITY_CANDIDATES,
  POWER_BASH_READABILITY_STAGE,
  POWER_BASH_RECOVERY_PROBE_STAGE,
  buildPowerBashReadabilityProbeReport,
  resolvePowerBashReadabilityCandidate,
  samplePowerBashReadabilityCandidate,
  samplePowerBashReadabilityCandidateProgress,
} from '../src/animation/power-bash-readability-probe.js';
import {
  PRODUCTION_PARRY_DEFLECT_VARIANTS,
  getProductionParryDeflectProfile,
} from '../src/animation/parry-contact-deflect-runtime-clip.js';

test('G3.6.2 exposes A/B/C/D Power Bash review candidates without changing production', () => {
  assert.equal(POWER_BASH_READABILITY_STAGE, 'G3.6.1');
  assert.equal(POWER_BASH_RECOVERY_PROBE_STAGE, 'G3.6.2');
  assert.deepEqual(POWER_BASH_READABILITY_CANDIDATES.map((entry) => entry.id), [
    POWER_BASH_READABILITY_CANDIDATE_IDS.FULL_SOURCE,
    POWER_BASH_READABILITY_CANDIDATE_IDS.CURRENT_G36,
    POWER_BASH_READABILITY_CANDIDATE_IDS.EXTENDED,
    POWER_BASH_READABILITY_CANDIDATE_IDS.EXTENDED_FULL_RECOVERY,
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

test('G3.6.1 still quantifies why the current Power Bash second beat is hard to read at 30fps', () => {
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

test('G3.6.2 D preserves C Power exactly then continues through the full authored recovery tail', () => {
  const clipDuration = 0.7;
  const c = resolvePowerBashReadabilityCandidate(POWER_BASH_READABILITY_CANDIDATE_IDS.EXTENDED, clipDuration);
  const d = resolvePowerBashReadabilityCandidate(POWER_BASH_READABILITY_CANDIDATE_IDS.EXTENDED_FULL_RECOVERY, clipDuration);
  assert.equal(d.segments.length, 2);
  const [power, recovery] = d.segments;

  assert.equal(power.role, 'power');
  assert.equal(power.sourceStartSeconds, c.sourceStartSeconds);
  assert.equal(power.sourceEndSeconds, c.sourceEndSeconds);
  assert.equal(power.playbackRate, c.playbackRate);
  assert.equal(power.sourceStartSeconds, 0.08);
  assert.equal(power.sourceEndSeconds, 0.55);
  assert.equal(power.playbackRate, 0.95);

  assert.equal(recovery.role, 'recovery');
  assert.equal(recovery.sourceStartSeconds, 0.55);
  assert.equal(recovery.sourceEndSeconds, clipDuration);
  assert.equal(recovery.playbackRate, 1.0);

  const expectedDuration = (0.55 - 0.08) / 0.95 + (0.7 - 0.55);
  assert.ok(Math.abs(d.visualDurationSeconds - expectedDuration) < 1e-9);
  assert.ok(d.approximateFrames30 > 19);
  assert.equal(samplePowerBashReadabilityCandidate(d, power.visualDurationSeconds, clipDuration), 0.55);
  assert.ok(samplePowerBashReadabilityCandidate(d, power.visualDurationSeconds + 0.05, clipDuration) > 0.55);
  assert.equal(samplePowerBashReadabilityCandidateProgress(d, 1, clipDuration), clipDuration);

  const report = buildPowerBashReadabilityProbeReport(clipDuration);
  assert.equal(report.productionUnchanged, true);
  assert.equal(report.diagnostics.recoveryEndsAtClipEnd, true);
  assert.ok(report.diagnostics.recoveryTailMilliseconds >= 149.9);
});

test('G3.6.1.1 Orbit Camera remains available while G3.6.2 adds the D recovery candidate', async () => {
  const html = await readFile(new URL('../tools/action-studio/power-bash-readability-lab.html', import.meta.url), 'utf8');
  const app = await readFile(new URL('../tools/action-studio/power-bash-readability-lab.js', import.meta.url), 'utf8');
  assert.match(html, /OrbitControls\.js/);
  assert.match(html, /data-view="side"/);
  assert.match(html, /data-view="back"/);
  assert.match(html, /id="resetCamera"/);
  assert.match(html, /Left drag orbit/);
  assert.match(html, /Full Power Bash Readability A\/B\/C\/D/);
  assert.match(html, /data-candidate="extended-full-recovery"/);
  assert.match(html, /D — Extended \+ Full Recovery/);
  assert.match(app, /new THREE\.OrbitControls\(camera, canvas\)/);
  assert.match(app, /__G3611_ORBIT_CAMERA__/);
  assert.match(app, /POWER_BASH_RECOVERY_PROBE_STAGE/);
  assert.match(app, /__G362_D_RECOVERY_RESULT__/);
  assert.match(app, /dataset\.g362Recovery/);
  assert.match(app, /dPowerMatchesC/);
  assert.match(app, /dRecoveryEndsAtClipEnd/);
});
