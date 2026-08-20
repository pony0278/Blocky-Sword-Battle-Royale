import { createDefaultCharacter } from '../../src/character/default-character.js';
import { loadSkyrimConvertedAnimationLibrary } from '../../src/animation/skyrim-converted-animation-library.js';
import {
  PARRY_ROTATION_CONTINUITY_STAGE,
} from '../../src/animation/parry-rotation-continuity.js';
import {
  PARRY_UPPER_BODY_CONTINUITY_STAGE,
} from '../../src/animation/parry-upper-body-continuity.js';
import {
  PRODUCTION_PARRY_DEFLECT_CLIP_IDS,
  PRODUCTION_PARRY_DEFLECT_VARIANTS,
  sampleProductionParryDeflectTimeline,
} from '../../src/animation/parry-contact-deflect-runtime-clip.js';
import {
  GUARD_EVENTS,
  GUARD_STATES,
  createGuardStateMachine,
} from '../../src/combat/guard-state-machine.js';
import { createGuardPresentationRuntime } from '../../src/combat/guard-presentation-runtime.js';

const THREE = window.THREE;
if (!THREE?.GLTFLoader || !THREE?.Quaternion) throw new Error(`${PARRY_UPPER_BODY_CONTINUITY_STAGE} requires Three.js + GLTFLoader`);

const character = createDefaultCharacter(THREE);
const machine = createGuardStateMachine();
const runtime = createGuardPresentationRuntime(THREE, { machine, character });
const status = document.getElementById('status');
const reportNode = document.getElementById('report');
const STEP_MS = 1000 / 60;
const END_MS = 599;
const WATCH_BONES = Object.freeze(['root', 'hips', 'spine', 'chest']);

// G3.6 distinguishes continuity safety from style. Power Bash is allowed to
// travel much farther than T3.3; the hard gate focuses on per-frame snaps,
// root/hips stability and only broad excursion/travel sanity envelopes.
const THRESHOLDS = Object.freeze({
  root: Object.freeze({ maxStepDegrees: 1, cumulativeTravelDegrees: 5 }),
  hips: Object.freeze({ maxStepDegrees: 20, cumulativeTravelDegrees: 90 }),
  spine: Object.freeze({ maxStepDegrees: 20, maxExcursionDegrees: 70, cumulativeTravelDegrees: 220 }),
  chest: Object.freeze({ maxStepDegrees: 20, maxExcursionDegrees: 85, cumulativeTravelDegrees: 280 }),
});

function quaternionAngleDegrees(a, b) {
  const dot = Math.min(1, Math.max(-1, Math.abs(a.dot(b))));
  return THREE.MathUtils.radToDeg(2 * Math.acos(dot));
}

function snapshotBoneQuaternion(id) {
  const bone = character.rig?.bones?.[id];
  if (!bone?.getWorldQuaternion) throw new Error(`Missing continuity probe bone: ${id}`);
  character.object3d.updateMatrixWorld(true);
  return bone.getWorldQuaternion(new THREE.Quaternion());
}

function resetToHold() {
  machine.send(GUARD_EVENTS.RESET, { verification: 'g36-reset' });
  runtime.sync();
  machine.send(GUARD_EVENTS.GUARD_PRESS, { verification: 'g36-guard-press' });
  runtime.sync();
  const enter = runtime.update(180);
  if (enter.snapshot.state !== GUARD_STATES.HOLD) {
    throw new Error(`${PARRY_UPPER_BODY_CONTINUITY_STAGE} failed to settle Guard Hold: ${enter.snapshot.state}`);
  }
}

function beginParry(perfect) {
  resetToHold();
  const result = machine.send(GUARD_EVENTS.PARRY_CONFIRMED, {
    verification: perfect ? 'g36-perfect' : 'g36-parry',
    perfect,
  });
  if (!result.accepted) throw new Error(`${PARRY_UPPER_BODY_CONTINUITY_STAGE} Parry event rejected`);
  const synced = runtime.sync();
  if (synced.snapshot.state !== GUARD_STATES.PARRY) {
    throw new Error(`${PARRY_UPPER_BODY_CONTINUITY_STAGE} expected guard_parry, got ${synced.snapshot.state}`);
  }
}

function emptyBoneMetric() {
  return {
    maxStepDegrees: 0,
    maxStepAtMs: 0,
    maxStepPhase: 'contact',
    maxExcursionDegrees: 0,
    cumulativeTravelDegrees: 0,
  };
}

function measureVariant(perfect) {
  const variant = perfect
    ? PRODUCTION_PARRY_DEFLECT_VARIANTS.PERFECT_PARRY
    : PRODUCTION_PARRY_DEFLECT_VARIANTS.PARRY;
  beginParry(perfect);
  const start = Object.fromEntries(WATCH_BONES.map((id) => [id, snapshotBoneQuaternion(id)]));
  const previous = Object.fromEntries(WATCH_BONES.map((id) => [id, start[id].clone()]));
  const metrics = Object.fromEntries(WATCH_BONES.map((id) => [id, emptyBoneMetric()]));
  let elapsedMs = 0;

  while (elapsedMs < END_MS) {
    const nextMs = Math.min(END_MS, elapsedMs + STEP_MS);
    const result = runtime.update(nextMs - elapsedMs);
    elapsedMs = nextMs;
    if (result.snapshot.state !== GUARD_STATES.PARRY) {
      throw new Error(`${PARRY_UPPER_BODY_CONTINUITY_STAGE} left guard_parry early at ${elapsedMs.toFixed(2)}ms`);
    }
    const phase = sampleProductionParryDeflectTimeline(variant, elapsedMs / 1000).phase;
    for (const id of WATCH_BONES) {
      const current = snapshotBoneQuaternion(id);
      const stepDegrees = quaternionAngleDegrees(previous[id], current);
      const excursionDegrees = quaternionAngleDegrees(start[id], current);
      const metric = metrics[id];
      metric.cumulativeTravelDegrees += stepDegrees;
      metric.maxExcursionDegrees = Math.max(metric.maxExcursionDegrees, excursionDegrees);
      if (stepDegrees > metric.maxStepDegrees) {
        metric.maxStepDegrees = stepDegrees;
        metric.maxStepAtMs = elapsedMs;
        metric.maxStepPhase = phase;
      }
      previous[id].copy(current);
    }
  }

  for (const metric of Object.values(metrics)) {
    metric.maxStepDegrees = Number(metric.maxStepDegrees.toFixed(4));
    metric.maxStepAtMs = Number(metric.maxStepAtMs.toFixed(2));
    metric.maxExcursionDegrees = Number(metric.maxExcursionDegrees.toFixed(4));
    metric.cumulativeTravelDegrees = Number(metric.cumulativeTravelDegrees.toFixed(4));
  }

  const rootPass = metrics.root.maxStepDegrees <= THRESHOLDS.root.maxStepDegrees
    && metrics.root.cumulativeTravelDegrees <= THRESHOLDS.root.cumulativeTravelDegrees;
  const hipsPass = metrics.hips.maxStepDegrees <= THRESHOLDS.hips.maxStepDegrees
    && metrics.hips.cumulativeTravelDegrees <= THRESHOLDS.hips.cumulativeTravelDegrees;
  const spinePass = metrics.spine.maxStepDegrees <= THRESHOLDS.spine.maxStepDegrees
    && metrics.spine.maxExcursionDegrees <= THRESHOLDS.spine.maxExcursionDegrees
    && metrics.spine.cumulativeTravelDegrees <= THRESHOLDS.spine.cumulativeTravelDegrees;
  const chestPass = metrics.chest.maxStepDegrees <= THRESHOLDS.chest.maxStepDegrees
    && metrics.chest.maxExcursionDegrees <= THRESHOLDS.chest.maxExcursionDegrees
    && metrics.chest.cumulativeTravelDegrees <= THRESHOLDS.chest.cumulativeTravelDegrees;
  return {
    variant,
    metrics,
    rootPass,
    hipsPass,
    spinePass,
    chestPass,
    pass: rootPass && hipsPass && spinePass && chestPass,
  };
}

async function main() {
  status.textContent = `${PARRY_UPPER_BODY_CONTINUITY_STAGE} loading production Skyrim Power Parry clips…`;
  const library = await loadSkyrimConvertedAnimationLibrary(new THREE.GLTFLoader(), {
    THREE,
    rig: character.rig,
    fps: 30,
  });
  character.registerAnimations(library);

  const parryClip = library.clips.get(PRODUCTION_PARRY_DEFLECT_CLIP_IDS.PARRY);
  const perfectClip = library.clips.get(PRODUCTION_PARRY_DEFLECT_CLIP_IDS.PERFECT_PARRY);
  const parryMetadata = parryClip?.userData?.productionParryDeflect || null;
  const perfectMetadata = perfectClip?.userData?.productionParryDeflect || null;
  const parryPolicy = parryMetadata?.rotationContinuity || null;
  const perfectPolicy = perfectMetadata?.rotationContinuity || null;
  const parryUpperPolicy = parryMetadata?.upperBodyContinuity || null;
  const perfectUpperPolicy = perfectMetadata?.upperBodyContinuity || null;
  const policyPass = [parryPolicy, perfectPolicy].every((policy) => (
    policy?.stage === PARRY_ROTATION_CONTINUITY_STAGE
    && policy?.policy === 'contact-lock-lower-body-after-contact'
    && policy?.stabilizedTrackCount > 0
    && policy?.contactLockedTargets?.includes('hips')
  ));
  const upperPolicyPass = [parryUpperPolicy, perfectUpperPolicy].every((policy) => (
    policy?.stage === 'G3.6'
    && policy?.policy === 'contact-relative-wide-torso-safety-cap'
    && policy?.limitsDegrees?.spine === 42
    && policy?.limitsDegrees?.chest === 60
    && policy?.stabilizedTracks?.some((track) => track.startsWith('spine.'))
    && policy?.stabilizedTracks?.some((track) => track.startsWith('chest.'))
  ));
  const powerSourcePass = [parryMetadata, perfectMetadata].every((metadata) => (
    metadata?.stage === 'G3.6'
    && metadata?.deflectClipId === 'SKYRIM_GUARD/shd_blockbashpower'
    && metadata?.sharedMotionFamily === 'g36-blockhit-powerbash'
    && metadata?.sharedMotionContract === true
  ));

  const parry = measureVariant(false);
  const perfect = measureVariant(true);
  const pass = policyPass && upperPolicyPass && powerSourcePass && parry.pass && perfect.pass;
  const report = {
    stage: 'G3.6',
    lowerBodyStage: PARRY_ROTATION_CONTINUITY_STAGE,
    pass,
    policyPass,
    upperPolicyPass,
    powerSourcePass,
    policies: {
      parry: { lower: parryPolicy, upper: parryUpperPolicy },
      perfect: { lower: perfectPolicy, upper: perfectUpperPolicy },
    },
    parry,
    perfect,
    thresholds: THRESHOLDS,
  };

  document.documentElement.dataset.g36 = pass ? 'pass' : 'fail';
  document.documentElement.dataset.g36Policy = policyPass && upperPolicyPass && powerSourcePass ? 'pass' : 'fail';
  document.documentElement.dataset.g36Power = powerSourcePass ? 'pass' : 'fail';
  document.documentElement.dataset.g36Root = parry.rootPass && perfect.rootPass ? 'pass' : 'fail';
  document.documentElement.dataset.g36Hips = parry.hipsPass && perfect.hipsPass ? 'pass' : 'fail';
  document.documentElement.dataset.g36Spine = parry.spinePass && perfect.spinePass ? 'pass' : 'fail';
  document.documentElement.dataset.g36Chest = parry.chestPass && perfect.chestPass ? 'pass' : 'fail';
  // Preserve legacy attributes for older consumers that only need safety status.
  document.documentElement.dataset.g351pt32 = pass ? 'pass' : 'fail';
  document.documentElement.dataset.g351pt32Root = parry.rootPass && perfect.rootPass ? 'pass' : 'fail';
  document.documentElement.dataset.g351pt32Hips = parry.hipsPass && perfect.hipsPass ? 'pass' : 'fail';
  document.documentElement.dataset.g351pt33 = pass ? 'pass' : 'fail';
  document.documentElement.dataset.g351pt33Policy = upperPolicyPass ? 'pass' : 'fail';
  document.documentElement.dataset.g351pt33Spine = parry.spinePass && perfect.spinePass ? 'pass' : 'fail';
  document.documentElement.dataset.g351pt33Chest = parry.chestPass && perfect.chestPass ? 'pass' : 'fail';
  reportNode.textContent = JSON.stringify(report, null, 2);
  status.textContent = `G3.6 ${pass ? 'PASS' : 'FAIL'} · Power Parry 0–599ms @60fps continuity without compact-motion clamp`;
  status.className = pass ? 'good' : 'bad';
  window.__G36_POWER_PARRY_CONTINUITY_RESULT__ = report;
}

main().catch((error) => {
  document.documentElement.dataset.g36 = 'fail';
  document.documentElement.dataset.g351pt32 = 'fail';
  document.documentElement.dataset.g351pt33 = 'fail';
  status.textContent = `G3.6 FAIL · ${error?.message || error}`;
  status.className = 'bad';
  reportNode.textContent = error?.stack || String(error);
  window.__G36_POWER_PARRY_CONTINUITY_RESULT__ = { stage: 'G3.6', pass: false, error: error?.stack || String(error) };
});
