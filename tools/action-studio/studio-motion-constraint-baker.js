import { createAnimationClip } from '../../src/animation/animation-clip.js';
import { normalizeMotionGuide } from '../../src/animation/motion-guide-schema.js';
import { normalizePose } from '../../src/animation/pose-utils.js';

export const SECONDARY_GRIP_POSE_KEYS = Object.freeze([
  ['aL_sx', -180, 80, 24],
  ['aL_sy', -140, 140, 24],
  ['aL_sz', -110, 110, 20],
  ['aL_ex', -15, 165, 22],
  ['aL_wx', -120, 120, 18],
  ['aL_wy', -120, 120, 18],
  ['aL_wz', -120, 120, 18],
  ['aL_stretch', 0.72, 1.55, 0.12],
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function evaluateGripDistance(character, sword, pose, leftPoint, gripPoint) {
  character.applyPose(pose);
  character.object3d.updateMatrixWorld(true);
  sword.object3d.updateMatrixWorld(true);
  character.rig.bones['handslot.l'].getWorldPosition(leftPoint);
  sword.secondaryGrip.getWorldPosition(gripPoint);
  return leftPoint.distanceTo(gripPoint);
}

function refineGripPose(character, sword, seedPose, points) {
  const candidate = { ...seedPose };
  let bestError = evaluateGripDistance(character, sword, candidate, points.left, points.grip);
  let stepScale = 1;

  for (let pass = 0; pass < 8; pass += 1) {
    for (const [key, min, max, baseStep] of SECONDARY_GRIP_POSE_KEYS) {
      const startValue = candidate[key];
      let axisValue = startValue;
      let axisError = bestError;
      for (const direction of [-1, 1]) {
        candidate[key] = clamp(startValue + direction * baseStep * stepScale, min, max);
        const error = evaluateGripDistance(character, sword, candidate, points.left, points.grip);
        if (error < axisError) {
          axisError = error;
          axisValue = candidate[key];
        }
      }
      candidate[key] = axisValue;
      bestError = axisError;
    }
    stepScale *= 0.56;
  }
  return { pose: candidate, error: bestError };
}

function gripSeeds(original) {
  const mirrored = {
    ...original,
    aL_sx: original.aR_sx,
    aL_sy: original.aR_sy + 42,
    aL_sz: -original.aR_sz,
    aL_ex: original.aR_ex + 22,
    aL_wx: original.aR_wx,
    aL_wy: -original.aR_wy,
    aL_wz: -original.aR_wz,
    aL_stretch: 1.08,
  };
  return [
    original,
    mirrored,
    { ...mirrored, aL_sx: mirrored.aL_sx - 48, aL_sy: mirrored.aL_sy + 54, aL_ex: 92 },
  ];
}

function optimizePose(character, sword, sourcePose, weight, points) {
  const original = normalizePose(sourcePose);
  const beforeError = evaluateGripDistance(character, sword, original, points.left, points.grip);
  const fitted = gripSeeds(original)
    .map((seed) => refineGripPose(character, sword, seed, points))
    .reduce((best, result) => (result.error < best.error ? result : best));

  const constrained = { ...original };
  SECONDARY_GRIP_POSE_KEYS.forEach(([key]) => {
    constrained[key] = original[key] + (fitted.pose[key] - original[key]) * weight;
  });
  const afterError = evaluateGripDistance(character, sword, constrained, points.left, points.grip);
  return { pose: normalizePose(constrained), beforeError, afterError };
}

export function bakeStudioMotionConstraints(projectInput, { character, sword, guide: guideInput } = {}) {
  const project = JSON.parse(JSON.stringify(projectInput));
  const guide = normalizeMotionGuide(guideInput || project.clip?.metadata?.motionGuide);
  if (!guide.twoHandGrip || guide.secondaryGripWeight <= 0 || !character?.rig || !sword?.secondaryGrip) {
    return {
      project,
      report: { twoHandGrip: false, optimizedPoseCount: 0, beforeError: 0, afterError: 0 },
    };
  }

  const Vector3 = character.object3d.position.constructor;
  const points = { left: new Vector3(), grip: new Vector3() };
  const errors = [];
  for (const key of project.clip.timeline) {
    const result = optimizePose(
      character,
      sword,
      project.clip.poses[key.name],
      guide.secondaryGripWeight,
      points,
    );
    project.clip.poses[key.name] = result.pose;
    errors.push({ name: key.name, beforeError: result.beforeError, afterError: result.afterError });
  }

  const average = (key) => errors.reduce((total, entry) => total + entry[key], 0) / Math.max(1, errors.length);
  const report = {
    twoHandGrip: true,
    optimizedPoseCount: errors.length,
    beforeError: average('beforeError'),
    afterError: average('afterError'),
    maxError: Math.max(...errors.map((entry) => entry.afterError)),
    poseErrors: errors,
  };
  project.clip.metadata = { ...project.clip.metadata, motionGuide: guide, motionGuideBake: report };
  project.clip = createAnimationClip(project.clip);
  return { project, report };
}
