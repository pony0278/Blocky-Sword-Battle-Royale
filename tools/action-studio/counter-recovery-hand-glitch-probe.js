import { createDefaultCharacter } from '../../src/character/default-character.js';
import { createDebugSword, mountDebugSword } from '../../src/character/debug-sword.js';
import { DEFAULT_KAYKIT_SWORD_MOUNT } from '../../src/character/default-character-mount.js';
import { applyMountCalibration } from '../../src/character/character-sockets.js';
import { loadKayKitAnimationLibrary } from '../../src/animation/kaykit-animation-library.js';
import { loadSkyrimConvertedAnimationLibrary } from '../../src/animation/skyrim-converted-animation-library.js';
import { composeSkyrimWeaponMountCalibration } from '../../src/animation/skyrim-weapon-bind-calibration.js';
import { applyGuardQuaternionOffsetsWeighted } from '../../src/combat/longsword-guard-correction.js';
import { LONGSWORD_GUARD_AUTHORING_STATE } from '../../src/combat/longsword-guard-metadata.js';
import {
  GUARD_RECOVERY_PROFILES,
  applyObjectTransform,
  applyRigPose,
  blendRecoveryPose,
  blendRecoveryTransform,
  captureObjectTransform,
  captureRigPose,
} from '../../src/combat/guard-recovery-bridge.js';

const THREE = window.THREE;
if (!THREE?.GLTFLoader) throw new Error('Counter recovery hand probe requires Three.js + GLTFLoader');

const RIGHT_CHAIN = Object.freeze(['upperarm.r', 'lowerarm.r', 'wrist.r', 'hand.r', 'handslot.r']);
const character = createDefaultCharacter(THREE);

function quatDot(a, b) {
  return Math.abs((a?.x || 0) * (b?.x || 0)
    + (a?.y || 0) * (b?.y || 0)
    + (a?.z || 0) * (b?.z || 0)
    + (a?.w ?? 1) * (b?.w ?? 1));
}

function angleDegrees(a, b) {
  const dot = Math.max(-1, Math.min(1, quatDot(a, b)));
  return (2 * Math.acos(dot)) * 180 / Math.PI;
}

function chainMetrics(previousPose, sourcePose, targetPose, recovery10, recovery25) {
  return Object.fromEntries(RIGHT_CHAIN.map((boneId) => {
    const previous = previousPose[boneId];
    const source = sourcePose[boneId];
    const target = targetPose[boneId];
    const r10 = recovery10[boneId];
    const r25 = recovery25[boneId];
    const terminalDeltaDeg = angleDegrees(previous.quaternion, source.quaternion);
    const finalToGuardDeg = angleDegrees(source.quaternion, target.quaternion);
    const recovery10ToGuardDeg = angleDegrees(r10.quaternion, target.quaternion);
    const recovery25ToGuardDeg = angleDegrees(r25.quaternion, target.quaternion);
    return [boneId, {
      terminalDeltaDeg,
      terminalAngularSpeedDegPerSec: terminalDeltaDeg / (1 / 60),
      finalToGuardDeg,
      recovery10ToGuardDeg,
      recovery25ToGuardDeg,
      movesAwayAt10pct: recovery10ToGuardDeg > finalToGuardDeg + 0.05,
      movesAwayAt25pct: recovery25ToGuardDeg > finalToGuardDeg + 0.05,
    }];
  }));
}

function captureWorldState(swordObject) {
  character.rig.root.updateMatrixWorld(true);
  swordObject.updateMatrixWorld(true);
  const swordPosition = new THREE.Vector3();
  const swordQuaternion = new THREE.Quaternion();
  const handPosition = new THREE.Vector3();
  swordObject.getWorldPosition(swordPosition);
  swordObject.getWorldQuaternion(swordQuaternion);
  character.sockets.HAND_R.getWorldPosition(handPosition);
  return {
    swordPosition: { x: swordPosition.x, y: swordPosition.y, z: swordPosition.z },
    swordQuaternion: { x: swordQuaternion.x, y: swordQuaternion.y, z: swordQuaternion.z, w: swordQuaternion.w },
    handPosition: { x: handPosition.x, y: handPosition.y, z: handPosition.z },
  };
}

function vecDistance(a, b) {
  return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0), (a.z || 0) - (b.z || 0));
}

function trajectoryReport(samples, target) {
  let previousOrientation = Infinity;
  let previousSwordDistance = Infinity;
  let previousHandDistance = Infinity;
  let orientationNonMonotonic = false;
  let swordPositionNonMonotonic = false;
  let handPositionNonMonotonic = false;
  const rows = samples.map(({ progress, state }) => {
    const orientationToGuardDeg = angleDegrees(state.swordQuaternion, target.swordQuaternion);
    const swordDistanceToGuard = vecDistance(state.swordPosition, target.swordPosition);
    const handDistanceToGuard = vecDistance(state.handPosition, target.handPosition);
    if (orientationToGuardDeg > previousOrientation + 0.05) orientationNonMonotonic = true;
    if (swordDistanceToGuard > previousSwordDistance + 0.0005) swordPositionNonMonotonic = true;
    if (handDistanceToGuard > previousHandDistance + 0.0005) handPositionNonMonotonic = true;
    previousOrientation = orientationToGuardDeg;
    previousSwordDistance = swordDistanceToGuard;
    previousHandDistance = handDistanceToGuard;
    return { progress, orientationToGuardDeg, swordDistanceToGuard, handDistanceToGuard };
  });
  return { rows, orientationNonMonotonic, swordPositionNonMonotonic, handPositionNonMonotonic };
}

async function main() {
  const loader = new THREE.GLTFLoader();
  const [skyrim, kaykit] = await Promise.all([
    loadSkyrimConvertedAnimationLibrary(loader, { THREE, rig: character.rig, fps: 30 }),
    loadKayKitAnimationLibrary(loader, { packIds: ['melee'] }),
  ]);
  character.registerAnimations(skyrim);
  character.registerAnimations(kaykit);

  const counterClip = kaykit.clips.get('Melee_Block_Attack');
  if (!counterClip) throw new Error('Melee_Block_Attack missing');
  const duration = Number(counterClip.duration);
  const sampleDelta = 1 / 60;

  const bind = skyrim.clips.get('SKYRIM_GUARD/shd_blockidle')?.userData?.weaponBindCalibration;
  if (!bind?.correctionQuaternion) throw new Error('Skyrim Guard weapon bind calibration missing');
  const skyrimMount = composeSkyrimWeaponMountCalibration(THREE, DEFAULT_KAYKIT_SWORD_MOUNT, bind);
  const sword = createDebugSword(THREE);
  mountDebugSword(character, sword, DEFAULT_KAYKIT_SWORD_MOUNT);
  const sourceMount = captureObjectTransform(sword.object3d);

  character.sampleAnimation('Melee_Block_Attack', Math.max(0, duration - sampleDelta), { loop: false, inPlace: true });
  character.update(0);
  const previousPose = captureRigPose(character.rig);

  character.sampleAnimation('Melee_Block_Attack', duration, { loop: false, inPlace: true });
  character.update(0);
  const sourcePose = captureRigPose(character.rig);
  applyObjectTransform(sword.object3d, sourceMount);
  const sourceWorld = captureWorldState(sword.object3d);

  character.sampleAnimation('SKYRIM_GUARD/shd_blockidle', 0, { loop: true, inPlace: true });
  applyGuardQuaternionOffsetsWeighted(THREE, character.rig, LONGSWORD_GUARD_AUTHORING_STATE.offsets, 1);
  character.update(0);
  const targetPose = captureRigPose(character.rig);
  applyMountCalibration(sword.object3d, skyrimMount);
  const targetMount = captureObjectTransform(sword.object3d);
  const targetWorld = captureWorldState(sword.object3d);

  const profile = GUARD_RECOVERY_PROFILES.counter;
  const options = {
    durationMs: profile.durationMs,
    sampleDeltaMs: sampleDelta * 1000,
    momentumScale: profile.momentumScale,
  };
  const recovery10 = blendRecoveryPose(previousPose, sourcePose, targetPose, 0.10, options);
  const recovery25 = blendRecoveryPose(previousPose, sourcePose, targetPose, 0.25, options);
  const bones = chainMetrics(previousPose, sourcePose, targetPose, recovery10, recovery25);
  const movingAway = Object.entries(bones)
    .filter(([, value]) => value.movesAwayAt10pct || value.movesAwayAt25pct)
    .map(([boneId]) => boneId);

  const progresses = [0, 0.05, 0.10, 0.25, 0.50, 0.75, 1];
  const worldSamples = progresses.map((progress) => {
    const pose = blendRecoveryPose(previousPose, sourcePose, targetPose, progress, options);
    const mount = blendRecoveryTransform(sourceMount, sourceMount, targetMount, progress, {
      durationMs: profile.durationMs,
      sampleDeltaMs: 0,
      momentumScale: 0,
    });
    applyRigPose(character.rig, pose);
    applyObjectTransform(sword.object3d, mount);
    return { progress, state: captureWorldState(sword.object3d) };
  });
  const worldTrajectory = trajectoryReport(worldSamples, targetWorld);

  const report = {
    stage: 'G3.4.1-counter-hand-glitch-probe',
    pass: true,
    counterDurationSeconds: duration,
    sampleDeltaMs: sampleDelta * 1000,
    recoveryProfile: profile,
    rightChain: bones,
    movingAwayBones: movingAway,
    suspectedLocalInertialOvershoot: movingAway.length > 0,
    sourceWorld,
    targetWorld,
    worldTrajectory,
    suspectedWorldTrajectoryArtifact: worldTrajectory.orientationNonMonotonic
      || worldTrajectory.swordPositionNonMonotonic
      || worldTrajectory.handPositionNonMonotonic,
    note: 'Local bones and the composed HAND_R + sword mount trajectory are checked separately. A world-space non-monotonic result can appear even when every local bone approaches Guard monotonically.',
  };
  document.documentElement.dataset.counterHandProbe = 'pass';
  document.documentElement.dataset.counterHandOvershoot = report.suspectedLocalInertialOvershoot ? 'true' : 'false';
  document.documentElement.dataset.counterWorldArtifact = report.suspectedWorldTrajectoryArtifact ? 'true' : 'false';
  document.getElementById('report').textContent = JSON.stringify(report, null, 2);
  window.__COUNTER_HAND_GLITCH_PROBE__ = report;
}

main().catch((error) => {
  document.documentElement.dataset.counterHandProbe = 'fail';
  document.getElementById('report').textContent = error?.stack || String(error);
  window.__COUNTER_HAND_GLITCH_PROBE__ = { pass: false, error: error?.stack || String(error) };
});
