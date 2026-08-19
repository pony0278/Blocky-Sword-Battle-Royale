import { createDefaultCharacter } from '../../src/character/default-character.js';
import { loadSkyrimConvertedAnimationLibrary } from '../../src/animation/skyrim-converted-animation-library.js';
import {
  PARRY_ROTATION_CONTINUITY_STAGE,
} from '../../src/animation/parry-rotation-continuity.js';
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
if (!THREE?.GLTFLoader || !THREE?.Quaternion) throw new Error(`${PARRY_ROTATION_CONTINUITY_STAGE} requires Three.js + GLTFLoader`);

const character = createDefaultCharacter(THREE);
const machine = createGuardStateMachine();
const runtime = createGuardPresentationRuntime(THREE, { machine, character });
const status = document.getElementById('status');
const reportNode = document.getElementById('report');
const STEP_MS = 1000 / 60;
const END_MS = 599;
const WATCH_BONES = Object.freeze(['root', 'hips', 'spine', 'chest']);

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
  machine.send(GUARD_EVENTS.RESET, { verification: 'g351pt32-reset' });
  runtime.sync();
  machine.send(GUARD_EVENTS.GUARD_PRESS, { verification: 'g351pt32-guard-press' });
  runtime.sync();
  const enter = runtime.update(180);
  if (enter.snapshot.state !== GUARD_STATES.HOLD) {
    throw new Error(`${PARRY_ROTATION_CONTINUITY_STAGE} failed to settle Guard Hold: ${enter.snapshot.state}`);
  }
}

function beginParry(perfect) {
  resetToHold();
  const result = machine.send(GUARD_EVENTS.PARRY_CONFIRMED, {
    verification: perfect ? 'g351pt32-perfect' : 'g351pt32-parry',
    perfect,
  });
  if (!result.accepted) throw new Error(`${PARRY_ROTATION_CONTINUITY_STAGE} Parry event rejected`);
  const synced = runtime.sync();
  if (synced.snapshot.state !== GUARD_STATES.PARRY) {
    throw new Error(`${PARRY_ROTATION_CONTINUITY_STAGE} expected guard_parry, got ${synced.snapshot.state}`);
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
      throw new Error(`${PARRY_ROTATION_CONTINUITY_STAGE} left guard_parry early at ${elapsedMs.toFixed(2)}ms`);
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

  const rootPass = metrics.root.maxStepDegrees <= 1 && metrics.root.cumulativeTravelDegrees <= 5;
  const hipsPass = metrics.hips.maxStepDegrees <= 20 && metrics.hips.cumulativeTravelDegrees <= 90;
  return {
    variant,
    metrics,
    rootPass,
    hipsPass,
    pass: rootPass && hipsPass,
  };
}

async function main() {
  status.textContent = `${PARRY_ROTATION_CONTINUITY_STAGE} loading production Skyrim Guard clips…`;
  const library = await loadSkyrimConvertedAnimationLibrary(new THREE.GLTFLoader(), {
    THREE,
    rig: character.rig,
    fps: 30,
  });
  character.registerAnimations(library);

  const parryClip = library.clips.get(PRODUCTION_PARRY_DEFLECT_CLIP_IDS.PARRY);
  const perfectClip = library.clips.get(PRODUCTION_PARRY_DEFLECT_CLIP_IDS.PERFECT_PARRY);
  const parryPolicy = parryClip?.userData?.productionParryDeflect?.rotationContinuity || null;
  const perfectPolicy = perfectClip?.userData?.productionParryDeflect?.rotationContinuity || null;
  const policyPass = [parryPolicy, perfectPolicy].every((policy) => (
    policy?.stage === PARRY_ROTATION_CONTINUITY_STAGE
    && policy?.policy === 'contact-lock-lower-body-after-contact'
    && policy?.stabilizedTrackCount > 0
    && policy?.contactLockedTargets?.includes('hips')
  ));

  const parry = measureVariant(false);
  const perfect = measureVariant(true);
  const pass = policyPass && parry.pass && perfect.pass;
  const report = {
    stage: PARRY_ROTATION_CONTINUITY_STAGE,
    pass,
    policyPass,
    policies: { parry: parryPolicy, perfect: perfectPolicy },
    parry,
    perfect,
    thresholds: {
      root: { maxStepDegrees: 1, cumulativeTravelDegrees: 5 },
      hips: { maxStepDegrees: 20, cumulativeTravelDegrees: 90 },
    },
  };

  document.documentElement.dataset.g351pt32 = pass ? 'pass' : 'fail';
  document.documentElement.dataset.g351pt32Policy = policyPass ? 'pass' : 'fail';
  document.documentElement.dataset.g351pt32Parry = parry.pass ? 'pass' : 'fail';
  document.documentElement.dataset.g351pt32Perfect = perfect.pass ? 'pass' : 'fail';
  document.documentElement.dataset.g351pt32Root = parry.rootPass && perfect.rootPass ? 'pass' : 'fail';
  document.documentElement.dataset.g351pt32Hips = parry.hipsPass && perfect.hipsPass ? 'pass' : 'fail';
  reportNode.textContent = JSON.stringify(report, null, 2);
  status.textContent = `${PARRY_ROTATION_CONTINUITY_STAGE} ${pass ? 'PASS' : 'FAIL'} · 0–599ms @ 60fps root/hips continuity`;
  status.className = pass ? 'good' : 'bad';
  window.__G351PT32_RESULT__ = report;
}

main().catch((error) => {
  document.documentElement.dataset.g351pt32 = 'fail';
  status.textContent = `${PARRY_ROTATION_CONTINUITY_STAGE} FAIL · ${error?.message || error}`;
  status.className = 'bad';
  reportNode.textContent = error?.stack || String(error);
  window.__G351PT32_RESULT__ = { stage: PARRY_ROTATION_CONTINUITY_STAGE, pass: false, error: error?.stack || String(error) };
});
