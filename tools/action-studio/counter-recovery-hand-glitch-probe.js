import { createDefaultCharacter } from '../../src/character/default-character.js';
import { createDebugSword, mountDebugSword } from '../../src/character/debug-sword.js';
import { DEFAULT_KAYKIT_SWORD_MOUNT } from '../../src/character/default-character-mount.js';
import { loadKayKitAnimationLibrary } from '../../src/animation/kaykit-animation-library.js';
import { loadSkyrimConvertedAnimationLibrary } from '../../src/animation/skyrim-converted-animation-library.js';
import { applyGuardQuaternionOffsetsWeighted } from '../../src/combat/longsword-guard-correction.js';
import { LONGSWORD_GUARD_AUTHORING_STATE } from '../../src/combat/longsword-guard-metadata.js';
import {
  GUARD_RECOVERY_PROFILES,
  blendRecoveryPose,
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

  const sword = createDebugSword(THREE);
  mountDebugSword(character, sword, DEFAULT_KAYKIT_SWORD_MOUNT);

  character.sampleAnimation('Melee_Block_Attack', Math.max(0, duration - sampleDelta), { loop: false, inPlace: true });
  character.update(0);
  const previousPose = captureRigPose(character.rig);

  character.sampleAnimation('Melee_Block_Attack', duration, { loop: false, inPlace: true });
  character.update(0);
  const sourcePose = captureRigPose(character.rig);

  character.sampleAnimation('SKYRIM_GUARD/shd_blockidle', 0, { loop: true, inPlace: true });
  applyGuardQuaternionOffsetsWeighted(THREE, character.rig, LONGSWORD_GUARD_AUTHORING_STATE.offsets, 1);
  character.update(0);
  const targetPose = captureRigPose(character.rig);

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

  const report = {
    stage: 'G3.4.1-counter-hand-glitch-probe',
    pass: true,
    counterDurationSeconds: duration,
    sampleDeltaMs: sampleDelta * 1000,
    recoveryProfile: profile,
    rightChain: bones,
    movingAwayBones: movingAway,
    suspectedInertialOvershoot: movingAway.length > 0,
    note: 'Flagged bones become farther from Guard Hold during early Recover than they were at Counter end.',
  };
  document.documentElement.dataset.counterHandProbe = 'pass';
  document.documentElement.dataset.counterHandOvershoot = report.suspectedInertialOvershoot ? 'true' : 'false';
  document.getElementById('report').textContent = JSON.stringify(report, null, 2);
  window.__COUNTER_HAND_GLITCH_PROBE__ = report;
}

main().catch((error) => {
  document.documentElement.dataset.counterHandProbe = 'fail';
  document.getElementById('report').textContent = error?.stack || String(error);
  window.__COUNTER_HAND_GLITCH_PROBE__ = { pass: false, error: error?.stack || String(error) };
});
