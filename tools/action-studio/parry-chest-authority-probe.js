import { createDefaultCharacter } from '../../src/character/default-character.js';
import { loadSkyrimConvertedAnimationLibrary } from '../../src/animation/skyrim-converted-animation-library.js';
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
import { applyGuardQuaternionOffsetsWeighted } from '../../src/combat/longsword-guard-correction.js';
import { LONGSWORD_GUARD_AUTHORING_STATE } from '../../src/combat/longsword-guard-metadata.js';

const THREE = window.THREE;
const reportNode = document.getElementById('report');
const TIMES_MS = [0, 150, 160, 200, 233.33, 245, 250, 266.67, 280, 315, 330, 360, 400, 450, 550, 599];

function angleDegrees(a, b) {
  const dot = Math.max(-1, Math.min(1, Math.abs(a.dot(b))));
  return THREE.MathUtils.radToDeg(2 * Math.acos(dot));
}

function arrayQuaternion(value) {
  return new THREE.Quaternion(value[0], value[1], value[2], value[3]).normalize();
}

function localQuaternion(character, boneId) {
  return character.rig.bones[boneId].quaternion.clone().normalize();
}

function worldQuaternion(character, boneId) {
  character.object3d.updateMatrixWorld(true);
  return character.rig.bones[boneId].getWorldQuaternion(new THREE.Quaternion()).normalize();
}

function trackFor(clip, boneId) {
  return clip.tracks.find((track) => track.name === `${boneId}.quaternion`) || null;
}

function trackSampler(track) {
  const interpolant = track.createInterpolant();
  return (timeSeconds) => arrayQuaternion(interpolant.evaluate(timeSeconds));
}

function qSummary(q) {
  return [q.x, q.y, q.z, q.w].map((value) => Number(value.toFixed(5)));
}

async function measureVariant(library, perfect) {
  const character = createDefaultCharacter(THREE);
  const machine = createGuardStateMachine();
  let rawBeforeCorrection = null;
  const runtime = createGuardPresentationRuntime(THREE, {
    machine,
    character,
    applyCorrection(weight) {
      rawBeforeCorrection = {
        spine: localQuaternion(character, 'spine'),
        chest: localQuaternion(character, 'chest'),
      };
      return applyGuardQuaternionOffsetsWeighted(
        THREE,
        character.rig,
        LONGSWORD_GUARD_AUTHORING_STATE.offsets,
        weight,
      );
    },
  });
  character.registerAnimations(library);

  machine.send(GUARD_EVENTS.RESET, { probe: true });
  runtime.sync();
  machine.send(GUARD_EVENTS.GUARD_PRESS, { probe: true });
  runtime.sync();
  const hold = runtime.update(180);
  if (hold.snapshot.state !== GUARD_STATES.HOLD) throw new Error(`hold failed: ${hold.snapshot.state}`);
  const sent = machine.send(GUARD_EVENTS.PARRY_CONFIRMED, { probe: true, perfect });
  if (!sent.accepted) throw new Error('parry rejected');
  runtime.sync();

  const variant = perfect
    ? PRODUCTION_PARRY_DEFLECT_VARIANTS.PERFECT_PARRY
    : PRODUCTION_PARRY_DEFLECT_VARIANTS.PARRY;
  const clipId = perfect
    ? PRODUCTION_PARRY_DEFLECT_CLIP_IDS.PERFECT_PARRY
    : PRODUCTION_PARRY_DEFLECT_CLIP_IDS.PARRY;
  const clip = library.clips.get(clipId);
  const directSpine = trackSampler(trackFor(clip, 'spine'));
  const directChest = trackSampler(trackFor(clip, 'chest'));

  const rows = [];
  let elapsed = 0;
  let previous = null;
  const maxima = {
    directSpineStep: 0,
    directChestStep: 0,
    rawSpineStep: 0,
    rawChestStep: 0,
    correctedLocalChestStep: 0,
    worldChestStep: 0,
  };

  for (const targetMs of TIMES_MS) {
    if (targetMs > elapsed) runtime.update(targetMs - elapsed);
    elapsed = targetMs;
    const direct = {
      spine: directSpine(targetMs / 1000),
      chest: directChest(targetMs / 1000),
    };
    const raw = {
      spine: rawBeforeCorrection.spine.clone(),
      chest: rawBeforeCorrection.chest.clone(),
    };
    const corrected = {
      spine: localQuaternion(character, 'spine'),
      chest: localQuaternion(character, 'chest'),
      worldChest: worldQuaternion(character, 'chest'),
    };
    const steps = previous ? {
      directSpine: angleDegrees(previous.direct.spine, direct.spine),
      directChest: angleDegrees(previous.direct.chest, direct.chest),
      rawSpine: angleDegrees(previous.raw.spine, raw.spine),
      rawChest: angleDegrees(previous.raw.chest, raw.chest),
      correctedLocalChest: angleDegrees(previous.corrected.chest, corrected.chest),
      worldChest: angleDegrees(previous.corrected.worldChest, corrected.worldChest),
    } : {
      directSpine: 0,
      directChest: 0,
      rawSpine: 0,
      rawChest: 0,
      correctedLocalChest: 0,
      worldChest: 0,
    };
    maxima.directSpineStep = Math.max(maxima.directSpineStep, steps.directSpine);
    maxima.directChestStep = Math.max(maxima.directChestStep, steps.directChest);
    maxima.rawSpineStep = Math.max(maxima.rawSpineStep, steps.rawSpine);
    maxima.rawChestStep = Math.max(maxima.rawChestStep, steps.rawChest);
    maxima.correctedLocalChestStep = Math.max(maxima.correctedLocalChestStep, steps.correctedLocalChest);
    maxima.worldChestStep = Math.max(maxima.worldChestStep, steps.worldChest);

    rows.push({
      ms: targetMs,
      phase: sampleProductionParryDeflectTimeline(variant, targetMs / 1000).phase,
      directRawDifferenceDegrees: {
        spine: Number(angleDegrees(direct.spine, raw.spine).toFixed(4)),
        chest: Number(angleDegrees(direct.chest, raw.chest).toFixed(4)),
      },
      stepsDegrees: Object.fromEntries(Object.entries(steps).map(([key, value]) => [key, Number(value.toFixed(4))])),
      directChest: qSummary(direct.chest),
      rawChest: qSummary(raw.chest),
      correctedChest: qSummary(corrected.chest),
    });
    previous = { direct, raw, corrected };
  }

  return {
    variant,
    clipId,
    upperPolicy: clip.userData?.productionParryDeflect?.upperBodyContinuity || null,
    maxima: Object.fromEntries(Object.entries(maxima).map(([key, value]) => [key, Number(value.toFixed(4))])),
    rows,
  };
}

async function main() {
  const seed = createDefaultCharacter(THREE);
  const library = await loadSkyrimConvertedAnimationLibrary(new THREE.GLTFLoader(), {
    THREE,
    rig: seed.rig,
    fps: 30,
  });
  const report = {
    normal: await measureVariant(library, false),
    perfect: await measureVariant(library, true),
  };
  reportNode.textContent = JSON.stringify(report, null, 2);
  document.documentElement.dataset.chestAuthorityProbe = 'pass';
  window.__CHEST_AUTHORITY_PROBE__ = report;
}

main().catch((error) => {
  reportNode.textContent = error?.stack || String(error);
  document.documentElement.dataset.chestAuthorityProbe = 'fail';
});
