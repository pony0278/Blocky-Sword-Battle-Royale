import { attachEquipment } from './character-sockets.js';
import {
  createProceduralKayKitRig,
  restoreProceduralKayKitRestPose,
} from './procedural-kaykit-rig.js';
import { applyPoseToProceduralKayKitRig } from '../animation/kaykit-pose-adapter.js';
import {
  createKayKitAnimationController,
  validateKayKitClipBindings,
} from '../animation/kaykit-animation-library.js';

export function createProceduralKayKitCharacter(THREE, options = {}) {
  const rig = createProceduralKayKitRig(THREE, options);
  const animation = createKayKitAnimationController(THREE, rig.root);
  let mode = 'pose';

  function resetForAnimation() {
    restoreProceduralKayKitRestPose(rig);
    rig.motionRoot.position.set(0, 0, 0);
    rig.motionRoot.rotation.set(0, 0, 0);
    rig.motionRoot.scale.set(1, 1, 1);
    rig.root.updateMatrixWorld(true);
    rig.updateAppearance();
  }

  return {
    object3d: rig.root,
    rig,
    sockets: rig.sockets,
    animation,
    get mode() { return mode; },
    applyPose(pose) {
      if (mode !== 'pose') animation.stop();
      mode = 'pose';
      const result = applyPoseToProceduralKayKitRig(rig, pose);
      rig.updateAppearance();
      return result;
    },
    setRigNodesVisible(value) { rig.lineAppearance?.setNodesVisible(value); },
    setRigGlowVisible(value) { rig.lineAppearance?.setGlowVisible(value); },
    attach(socketId, object3d, calibration) {
      return attachEquipment(rig.sockets, socketId, object3d, calibration);
    },
    registerAnimations(source, registerOptions = {}) {
      const clips = source?.clips || source;
      const report = validateKayKitClipBindings(clips, Object.keys(rig.bones));
      if (registerOptions.strict !== false && !report.valid) {
        const summary = [...report.missing.entries()]
          .map(([clipName, targets]) => `${clipName}: ${targets.join(', ')}`)
          .join('; ');
        throw new Error(`KayKit animation targets do not match procedural rig: ${summary}`);
      }
      animation.register(clips);
      return report;
    },
    playAnimation(name, playOptions = {}) {
      if (mode !== 'kaykit') resetForAnimation();
      mode = 'kaykit';
      return animation.play(name, playOptions);
    },
    stopAnimation() {
      animation.stop();
      resetForAnimation();
      mode = 'pose';
    },
    update(deltaSeconds, camera) {
      if (mode === 'kaykit') animation.update(deltaSeconds);
      rig.updateAppearance(camera);
    },
  };
}
