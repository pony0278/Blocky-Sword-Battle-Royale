import { createDefaultCharacter } from '../../src/character/default-character.js';
import { createDebugSword, mountDebugSword } from '../../src/character/debug-sword.js';
import { DEFAULT_KAYKIT_SWORD_MOUNT } from '../../src/character/default-character-mount.js';
import { loadSkyrimConvertedAnimationLibrary } from '../../src/animation/skyrim-converted-animation-library.js';
import { composeSkyrimWeaponMountCalibration } from '../../src/animation/skyrim-weapon-bind-calibration.js';
import { applyGuardQuaternionOffsetsWeighted } from '../../src/combat/longsword-guard-correction.js';
import { LONGSWORD_GUARD_AUTHORING_STATE } from '../../src/combat/longsword-guard-metadata.js';

const THREE = window.THREE;
const RIGHT_CHAIN = Object.freeze(['chest', 'upperarm.r', 'lowerarm.r', 'wrist.r', 'hand.r', 'handslot.r']);
const reportNode = document.getElementById('report');

function quatArray(object3d) {
  const q = object3d?.quaternion;
  return q ? [q.x, q.y, q.z, q.w] : null;
}

function worldQuatArray(object3d) {
  object3d.updateWorldMatrix?.(true, false);
  const q = new THREE.Quaternion();
  object3d.getWorldQuaternion(q);
  return [q.x, q.y, q.z, q.w];
}

function angleDegrees(a, b) {
  const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 2 * Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
}

function rigSnapshot(character) {
  return Object.fromEntries(RIGHT_CHAIN.map((id) => [id, quatArray(character.rig.bones[id])]));
}

function rigDiff(a, b) {
  return Object.fromEntries(RIGHT_CHAIN.map((id) => [id, angleDegrees(a[id], b[id])]));
}

function sampleGuard(character, sword, timeSeconds) {
  character.stopAnimation();
  character.sampleAnimation('SKYRIM_GUARD/shd_blockidle', timeSeconds, { loop: true, inPlace: true, resetPose: true });
  applyGuardQuaternionOffsetsWeighted(THREE, character.rig, LONGSWORD_GUARD_AUTHORING_STATE.offsets, 1);
  character.update?.(0);
  character.object3d.updateMatrixWorld(true);
  sword.update?.();
  return {
    timeSeconds,
    rig: rigSnapshot(character),
    swordWorldQuaternion: worldQuatArray(sword.object3d),
  };
}

async function main() {
  if (!THREE?.GLTFLoader) throw new Error('Probe requires Three.js + GLTFLoader');
  const character = createDefaultCharacter(THREE);
  const loader = new THREE.GLTFLoader();
  const skyrim = await loadSkyrimConvertedAnimationLibrary(loader, { THREE, rig: character.rig, fps: 30 });
  character.registerAnimations(skyrim);
  const guardClip = skyrim.clips.get('SKYRIM_GUARD/shd_blockidle');
  if (!guardClip) throw new Error('Missing shd_blockidle');
  const bind = guardClip.userData?.weaponBindCalibration;
  if (!bind?.correctionQuaternion) throw new Error('Missing Skyrim weapon bind calibration');
  const skyrimMount = composeSkyrimWeaponMountCalibration(THREE, DEFAULT_KAYKIT_SWORD_MOUNT, bind);
  const sword = createDebugSword(THREE);
  mountDebugSword(character, sword, skyrimMount);

  const atZero = sampleGuard(character, sword, 0);
  const at180 = sampleGuard(character, sword, 0.18);
  const zeroAgain = sampleGuard(character, sword, 0);
  const result = {
    stage: 'guard-hold-source-time-probe',
    guardDurationSeconds: guardClip.duration,
    zeroTo180: {
      rigDegrees: rigDiff(atZero.rig, at180.rig),
      swordWorldDegrees: angleDegrees(atZero.swordWorldQuaternion, at180.swordWorldQuaternion),
    },
    zeroRepeatability: {
      rigDegrees: rigDiff(atZero.rig, zeroAgain.rig),
      swordWorldDegrees: angleDegrees(atZero.swordWorldQuaternion, zeroAgain.swordWorldQuaternion),
    },
  };
  result.matchesObservedHoldJump = Math.abs(result.zeroTo180.swordWorldDegrees - 79.82277449648774) < 5;
  result.cleanZeroRepeatable = result.zeroRepeatability.swordWorldDegrees < 0.1
    && Math.max(...Object.values(result.zeroRepeatability.rigDegrees)) < 0.1;
  document.documentElement.dataset.guardSourceTimeProbe = 'pass';
  reportNode.textContent = JSON.stringify(result, null, 2);
  window.__GUARD_HOLD_SOURCE_TIME_PROBE__ = result;
}

main().catch((error) => {
  document.documentElement.dataset.guardSourceTimeProbe = 'fail';
  reportNode.textContent = error?.stack || String(error);
});
