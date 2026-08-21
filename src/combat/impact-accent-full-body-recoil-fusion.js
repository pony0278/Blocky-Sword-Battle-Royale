export const IMPACT_ACCENT_FULL_BODY_RECOIL_FUSION_STAGE = 'G4.3B.5R.2.4.2';

export const IMPACT_ACCENT_PHASES = Object.freeze({
  COMPRESSION: 'compression',
  REBOUND: 'rebound',
  SETTLE: 'settle',
  COMPLETE: 'complete',
});

export const IMPACT_ACCENT_FUSION_PROFILES = Object.freeze({
  block: Object.freeze({
    compressionEndMs: 45,
    reboundEndMs: 105,
    settleEndMs: 190,
    reboundOvershoot: -0.14,
    attackerBodyScale: 0.56,
    defenderBodyScale: 1,
  }),
  parry: Object.freeze({
    compressionEndMs: 38,
    reboundEndMs: 92,
    settleEndMs: 168,
    reboundOvershoot: -0.16,
    attackerBodyScale: 0.82,
    defenderBodyScale: 0.88,
  }),
  'perfect-parry': Object.freeze({
    compressionEndMs: 34,
    reboundEndMs: 86,
    settleEndMs: 158,
    reboundOvershoot: -0.18,
    attackerBodyScale: 0.96,
    defenderBodyScale: 0.92,
  }),
});

const BODY_BONE_IDS = Object.freeze([
  'hips', 'spine', 'chest',
  'upperleg.l', 'upperleg.r',
  'lowerleg.l', 'lowerleg.r',
]);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function smoothstep01(value) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function resolveOutcome(value) {
  const key = String(value || 'block').toLowerCase();
  return IMPACT_ACCENT_FUSION_PROFILES[key] ? key : 'block';
}

function lateralSignFor(direction) {
  if (direction === 'left') return 1;
  if (direction === 'right') return -1;
  return 0;
}

function sampleSignedAccentScale(elapsedMs, profile) {
  const elapsed = Math.max(0, finite(elapsedMs));
  const compressionEnd = Math.max(1, finite(profile.compressionEndMs, 40));
  const reboundEnd = Math.max(compressionEnd + 1, finite(profile.reboundEndMs, 95));
  const settleEnd = Math.max(reboundEnd + 1, finite(profile.settleEndMs, 170));
  const overshoot = clamp(finite(profile.reboundOvershoot, -0.15), -0.35, 0);

  if (elapsed >= settleEnd) {
    return Object.freeze({ phase: IMPACT_ACCENT_PHASES.COMPLETE, scale: 0, complete: true });
  }
  if (elapsed <= compressionEnd) {
    return Object.freeze({
      phase: IMPACT_ACCENT_PHASES.COMPRESSION,
      scale: smoothstep01(elapsed / compressionEnd),
      complete: false,
    });
  }
  if (elapsed <= reboundEnd) {
    const t = smoothstep01((elapsed - compressionEnd) / (reboundEnd - compressionEnd));
    return Object.freeze({
      phase: IMPACT_ACCENT_PHASES.REBOUND,
      scale: 1 + (overshoot - 1) * t,
      complete: false,
    });
  }
  const t = smoothstep01((elapsed - reboundEnd) / (settleEnd - reboundEnd));
  return Object.freeze({
    phase: IMPACT_ACCENT_PHASES.SETTLE,
    scale: overshoot * (1 - t),
    complete: false,
  });
}

function bodyPose(scale, bodyScale, side, role) {
  const s = scale * bodyScale;
  const defender = role === 'defender';
  const sign = defender ? -side : side;
  const loadedLeft = side >= 0 ? 1 : 0.48;
  const loadedRight = side <= 0 ? 1 : 0.48;
  const legScale = defender ? 1 : 0.78;

  return Object.freeze({
    pelvisDropMeters: 0.010 * s * (defender ? 1 : 0.72),
    hipsPitchDegrees: 4.0 * s,
    hipsRollDegrees: sign * 2.6 * s,
    spinePitchDegrees: 4.6 * s,
    spineRollDegrees: -sign * 3.0 * s,
    chestYawDegrees: sign * 4.8 * s,
    chestPitchDegrees: 3.2 * s,
    chestRollDegrees: -sign * 2.2 * s,
    leftThighBendDegrees: 4.2 * s * loadedLeft * legScale,
    rightThighBendDegrees: 4.2 * s * loadedRight * legScale,
    leftKneeBendDegrees: 6.2 * s * loadedLeft * legScale,
    rightKneeBendDegrees: 6.2 * s * loadedRight * legScale,
  });
}

export function sampleImpactAccentFusion(input = {}) {
  const outcome = resolveOutcome(input.outcome);
  const profile = Object.freeze({ ...IMPACT_ACCENT_FUSION_PROFILES[outcome], ...(input.profile || {}) });
  const elapsedMs = Math.max(0, finite(input.elapsedMs));
  const attackDirection = String(input.attackDirection || '').toLowerCase();
  const side = lateralSignFor(attackDirection);
  const curve = sampleSignedAccentScale(elapsedMs, profile);

  return Object.freeze({
    stage: IMPACT_ACCENT_FULL_BODY_RECOIL_FUSION_STAGE,
    outcome,
    attackDirection,
    phase: curve.phase,
    elapsedMs,
    scale: curve.scale,
    complete: curve.complete,
    attacker: bodyPose(curve.scale, profile.attackerBodyScale, side, 'attacker'),
    defender: bodyPose(curve.scale, profile.defenderBodyScale, side, 'defender'),
    profile,
    authority: 'contact-impact-body-accent-only; shield-coupling-keeps-arm-and-weapon-authority',
  });
}

function snapshotBone(bone) {
  if (!bone) return null;
  return Object.freeze({
    position: Object.freeze({ x: bone.position.x, y: bone.position.y, z: bone.position.z }),
    quaternion: Object.freeze({ x: bone.quaternion.x, y: bone.quaternion.y, z: bone.quaternion.z, w: bone.quaternion.w }),
  });
}

export function captureImpactAccentBasePose(rig) {
  const bones = {};
  for (const id of BODY_BONE_IDS) {
    const snapshot = snapshotBone(rig?.bones?.[id]);
    if (snapshot) bones[id] = snapshot;
  }
  return Object.freeze({ stage: IMPACT_ACCENT_FULL_BODY_RECOIL_FUSION_STAGE, bones: Object.freeze(bones) });
}

function restoreBone(bone, snapshot) {
  if (!bone || !snapshot) return;
  bone.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
  bone.quaternion.set(snapshot.quaternion.x, snapshot.quaternion.y, snapshot.quaternion.z, snapshot.quaternion.w).normalize();
}

function applyAxisAngle(THREE, bone, axis, degrees) {
  if (!bone || Math.abs(degrees) < 1e-6) return;
  const delta = new THREE.Quaternion().setFromAxisAngle(axis, degrees * Math.PI / 180);
  bone.quaternion.multiply(delta).normalize();
}

export function applyImpactAccentBodyPose(THREE, rig, basePose, pose) {
  if (!THREE?.Vector3 || !THREE?.Quaternion || !rig || !basePose?.bones || !pose) return false;
  for (const id of BODY_BONE_IDS) restoreBone(rig.bones?.[id], basePose.bones[id]);

  const axisX = new THREE.Vector3(1, 0, 0);
  const axisY = new THREE.Vector3(0, 1, 0);
  const axisZ = new THREE.Vector3(0, 0, 1);
  const hips = rig.bones?.hips;
  const hipsBase = basePose.bones.hips;
  if (hips && hipsBase) hips.position.y = hipsBase.position.y - finite(pose.pelvisDropMeters);

  applyAxisAngle(THREE, hips, axisX, pose.hipsPitchDegrees);
  applyAxisAngle(THREE, hips, axisZ, pose.hipsRollDegrees);
  applyAxisAngle(THREE, rig.bones?.spine, axisX, pose.spinePitchDegrees);
  applyAxisAngle(THREE, rig.bones?.spine, axisZ, pose.spineRollDegrees);
  applyAxisAngle(THREE, rig.bones?.chest, axisY, pose.chestYawDegrees);
  applyAxisAngle(THREE, rig.bones?.chest, axisX, pose.chestPitchDegrees);
  applyAxisAngle(THREE, rig.bones?.chest, axisZ, pose.chestRollDegrees);
  applyAxisAngle(THREE, rig.bones?.['upperleg.l'], axisX, pose.leftThighBendDegrees);
  applyAxisAngle(THREE, rig.bones?.['upperleg.r'], axisX, pose.rightThighBendDegrees);
  applyAxisAngle(THREE, rig.bones?.['lowerleg.l'], axisX, -pose.leftKneeBendDegrees);
  applyAxisAngle(THREE, rig.bones?.['lowerleg.r'], axisX, -pose.rightKneeBendDegrees);
  rig.root?.updateMatrixWorld?.(true);
  return true;
}
