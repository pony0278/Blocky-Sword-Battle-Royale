import {
  buildPostCouplingRecoilStaggerHandoff,
  consumePostCouplingRecoilStaggerHandoff,
} from './post-coupling-recoil-stagger-handoff.js';
import { IMPACT_ACCENT_FULL_BODY_RECOIL_FUSION_STAGE } from './impact-accent-full-body-recoil-fusion.js';

export const ATTACKER_RECOIL_PRESENTATION_STAGE = 'G4.3B.3';
export const CONTACT_RELEASE_SEPARATION_MOTION_STAGE = 'G4.3B.5R.2.4.1';
export const FULL_BODY_RECOIL_FUSION_STAGE = IMPACT_ACCENT_FULL_BODY_RECOIL_FUSION_STAGE;

export const ATTACKER_RECOIL_PRESENTATION_PHASES = Object.freeze({
  CONTACT_HOLD: 'contact-hold',
  SEPARATION: 'separation',
  IMPULSE: 'impulse',
  RECOIL: 'recoil',
  SETTLE: 'settle',
  COMPLETE: 'complete',
});

export const ATTACKER_RECOIL_PRESENTATION_PROFILES = Object.freeze({
  'blocked-weapon-bounce': Object.freeze({
    contactHoldMs: 18,
    impulseEndMs: 82,
    recoilEndMs: 142,
    settleEndMs: 220,
    armDeflectScale: 0.72,
    forearmDeflectScale: 0.42,
    legStrengthScale: 0.42,
    fullBodyRecoilScale: 1,
  }),
  'parry-directional-recoil': Object.freeze({
    contactHoldMs: 28,
    impulseEndMs: 105,
    recoilEndMs: 235,
    settleEndMs: 390,
    armDeflectScale: 0.78,
    forearmDeflectScale: 0.48,
    legStrengthScale: 0.78,
    fullBodyRecoilScale: 1,
  }),
  'perfect-parry-directional-recoil': Object.freeze({
    contactHoldMs: 36,
    impulseEndMs: 120,
    recoilEndMs: 285,
    settleEndMs: 500,
    armDeflectScale: 0.84,
    forearmDeflectScale: 0.54,
    legStrengthScale: 1,
    fullBodyRecoilScale: 1,
  }),
});

const RELEASE_SEPARATION_DISTANCE_METERS = Object.freeze({
  'parry-directional-recoil': 0.065,
  'perfect-parry-directional-recoil': 0.095,
});

const FULL_BODY_RECOIL_SCALE = Object.freeze({
  'parry-directional-recoil': 1.32,
  'perfect-parry-directional-recoil': 1.50,
});

function finite(value, fallback = 0) {
  if (value == null || value === '') return fallback;
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

function vec(input = {}) {
  return Object.freeze({
    x: finite(input?.x, 0),
    y: finite(input?.y, 0),
    z: finite(input?.z, 0),
  });
}

function length(value) {
  return Math.hypot(value.x, value.y, value.z);
}

function normalize(value) {
  const magnitude = length(value);
  if (magnitude <= 1e-8) return Object.freeze({ x: 0, y: 0, z: 0 });
  return Object.freeze({
    x: value.x / magnitude,
    y: value.y / magnitude,
    z: value.z / magnitude,
  });
}

function resolveProfile(plan, overrides = {}) {
  const responseClass = String(plan?.responseClass || '');
  const base = ATTACKER_RECOIL_PRESENTATION_PROFILES[responseClass];
  if (!base) return null;
  const contactHoldMs = clamp(overrides.contactHoldMs ?? base.contactHoldMs, 0, 120);
  const releaseSeparationWindowMs = clamp(overrides.releaseSeparationWindowMs ?? 0, 0, 120);
  const releaseSeparationDistanceMeters = clamp(overrides.releaseSeparationDistanceMeters ?? 0, 0, 0.16);
  const inferredFullBodyScale = releaseSeparationWindowMs > 0
    ? finite(FULL_BODY_RECOIL_SCALE[responseClass], 1)
    : finite(base.fullBodyRecoilScale, 1);
  const fullBodyRecoilScale = clamp(overrides.fullBodyRecoilScale ?? inferredFullBodyScale, 0.5, 2);
  const impulseEndMs = clamp(
    overrides.impulseEndMs ?? base.impulseEndMs,
    contactHoldMs + releaseSeparationWindowMs + 1,
    260,
  );
  const recoilEndMs = clamp(
    overrides.recoilEndMs ?? base.recoilEndMs,
    impulseEndMs + 1,
    420,
  );
  const settleEndMs = clamp(
    overrides.settleEndMs ?? base.settleEndMs,
    recoilEndMs + 1,
    800,
  );
  return Object.freeze({
    ...base,
    ...overrides,
    contactHoldMs,
    releaseSeparationWindowMs,
    releaseSeparationDistanceMeters,
    fullBodyRecoilScale,
    impulseEndMs,
    recoilEndMs,
    settleEndMs,
    armDeflectScale: clamp(overrides.armDeflectScale ?? base.armDeflectScale, 0, 1.5),
    forearmDeflectScale: clamp(overrides.forearmDeflectScale ?? base.forearmDeflectScale, 0, 1.5),
    legStrengthScale: clamp(overrides.legStrengthScale ?? base.legStrengthScale, 0, 1.5),
  });
}

function bodyWeights(phase, armWeight, chestWeight, spineWeight, hipsWeight, legWeight, separationWeight = 0, complete = false) {
  return Object.freeze({
    phase,
    armWeight,
    torsoWeight: chestWeight,
    chestWeight,
    spineWeight,
    hipsWeight,
    legWeight,
    separationWeight,
    complete,
  });
}

function sampleWeights(profile, elapsedMs) {
  const elapsed = Math.max(0, finite(elapsedMs));
  if (elapsed >= profile.settleEndMs) {
    return bodyWeights(ATTACKER_RECOIL_PRESENTATION_PHASES.COMPLETE, 0, 0, 0, 0, 0, 0, true);
  }

  if (elapsed <= profile.contactHoldMs) {
    return bodyWeights(ATTACKER_RECOIL_PRESENTATION_PHASES.CONTACT_HOLD, 0, 0, 0, 0, 0, 0, false);
  }

  const separationWindowMs = Math.max(0, finite(profile.releaseSeparationWindowMs));
  const separationEndMs = profile.contactHoldMs + separationWindowMs;
  if (separationWindowMs > 0 && elapsed <= separationEndMs) {
    const t = clamp01((elapsed - profile.contactHoldMs) / separationWindowMs);
    const separationWeight = smoothstep01(t);
    const chestWeight = 0.32 * smoothstep01((t - 0.12) / 0.88);
    const spineWeight = 0.24 * smoothstep01((t - 0.26) / 0.74);
    const hipsWeight = 0.12 * smoothstep01((t - 0.48) / 0.52);
    const legWeight = 0.06 * smoothstep01((t - 0.68) / 0.32);
    return bodyWeights(
      ATTACKER_RECOIL_PRESENTATION_PHASES.SEPARATION,
      0.72 * separationWeight,
      chestWeight,
      spineWeight,
      hipsWeight,
      legWeight,
      separationWeight,
      false,
    );
  }

  if (elapsed <= profile.impulseEndMs) {
    if (separationWindowMs > 0) {
      const impulseSpan = Math.max(1, profile.impulseEndMs - separationEndMs);
      const t = clamp01((elapsed - separationEndMs) / impulseSpan);
      const eased = smoothstep01(t);
      const chestWeight = 0.32 + 0.68 * eased;
      const spineWeight = 0.24 + 0.76 * smoothstep01((t - 0.05) / 0.95);
      const hipsWeight = 0.12 + 0.88 * smoothstep01((t - 0.18) / 0.82);
      const legWeight = 0.06 + 0.94 * smoothstep01((t - 0.35) / 0.65);
      return bodyWeights(
        ATTACKER_RECOIL_PRESENTATION_PHASES.IMPULSE,
        0.72 + 0.28 * eased,
        chestWeight,
        spineWeight,
        hipsWeight,
        legWeight,
        1 - eased,
        false,
      );
    }
    const t = clamp01((elapsed - profile.contactHoldMs) / (profile.impulseEndMs - profile.contactHoldMs));
    const armWeight = smoothstep01(t);
    const chestWeight = smoothstep01((t - 0.12) / 0.88);
    const spineWeight = smoothstep01((t - 0.16) / 0.84);
    const hipsWeight = smoothstep01((t - 0.22) / 0.78);
    const legWeight = smoothstep01((t - 0.28) / 0.72);
    return bodyWeights(
      ATTACKER_RECOIL_PRESENTATION_PHASES.IMPULSE,
      armWeight,
      chestWeight,
      spineWeight,
      hipsWeight,
      legWeight,
      0,
      false,
    );
  }

  if (elapsed <= profile.recoilEndMs) {
    const t = smoothstep01((elapsed - profile.impulseEndMs) / (profile.recoilEndMs - profile.impulseEndMs));
    const armWeight = 1 - 0.22 * t;
    const chestWeight = 1 - 0.12 * t;
    const spineWeight = 1 - 0.13 * t;
    const hipsWeight = 1 - 0.10 * t;
    const legWeight = 1 - 0.07 * t;
    return bodyWeights(
      ATTACKER_RECOIL_PRESENTATION_PHASES.RECOIL,
      armWeight,
      chestWeight,
      spineWeight,
      hipsWeight,
      legWeight,
      0,
      false,
    );
  }

  const t = smoothstep01((elapsed - profile.recoilEndMs) / (profile.settleEndMs - profile.recoilEndMs));
  return bodyWeights(
    ATTACKER_RECOIL_PRESENTATION_PHASES.SETTLE,
    0.78 * (1 - t),
    0.88 * (1 - t),
    0.86 * (1 - t),
    0.90 * (1 - t),
    0.93 * (1 - t),
    0,
    false,
  );
}

function zeroPose() {
  return Object.freeze({
    weaponAimOffsetMeters: Object.freeze({ x: 0, y: 0, z: 0 }),
    releaseSeparationOffsetMeters: Object.freeze({ x: 0, y: 0, z: 0 }),
    releaseSeparationDistanceMeters: 0,
    upperArmAimDegrees: 0,
    lowerArmAimDegrees: 0,
    chestYawDegrees: 0,
    chestPitchDegrees: 0,
    chestRollDegrees: 0,
    spineYawDegrees: 0,
    spinePitchDegrees: 0,
    spineRollDegrees: 0,
    hipsYawDegrees: 0,
    hipsPitchDegrees: 0,
    hipsRollDegrees: 0,
    leftThighBendDegrees: 0,
    rightThighBendDegrees: 0,
    leftKneeBendDegrees: 0,
    rightKneeBendDegrees: 0,
  });
}

export function sampleAttackerRecoilPresentation(plan, elapsedMs = 0, overrides = {}) {
  if (!plan?.planned) return null;
  const profile = resolveProfile(plan, overrides.profile || overrides);
  if (!profile) return null;

  const weights = sampleWeights(profile, elapsedMs);
  const weaponDirection = normalize(vec(plan.weapon?.direction));
  const bodyStrength = clamp(finite(plan.body?.strength), 0, 2);
  const weaponStrength = clamp(finite(plan.weapon?.strength), 0, 2);
  const deflectDegrees = clamp(finite(plan.weapon?.deflectDegrees), 0, 90);
  const lateralSign = Math.sign(finite(plan.weapon?.lateralSign));
  const attackDirection = String(plan.attackDirection || '');
  const fusionActive = profile.releaseSeparationWindowMs > 0 && profile.fullBodyRecoilScale > 1;

  if (weights.complete) {
    return Object.freeze({
      stage: ATTACKER_RECOIL_PRESENTATION_STAGE,
      motionStage: profile.releaseSeparationWindowMs > 0 ? CONTACT_RELEASE_SEPARATION_MOTION_STAGE : null,
      fusionStage: fusionActive ? FULL_BODY_RECOIL_FUSION_STAGE : null,
      sequence: plan.sequence ?? null,
      responseClass: plan.responseClass || null,
      attackDirection,
      elapsedMs: Math.max(0, finite(elapsedMs)),
      phase: weights.phase,
      weights,
      pose: zeroPose(),
      complete: true,
      readyForAttackHandoff: true,
      authority: fusionActive ? 'impact-accent-full-body-recoil-fusion' : 'attacker-recoil-presentation-only',
    });
  }

  const baseAimDistance = (0.055 + 0.13 * weaponStrength) * weights.armWeight;
  const separationDistance = profile.releaseSeparationDistanceMeters * (weights.separationWeight || 0);
  const aimDistance = Math.max(baseAimDistance, separationDistance);
  const aimOffset = aimDistance <= 1e-9
    ? Object.freeze({ x: 0, y: 0, z: 0 })
    : Object.freeze({
        x: weaponDirection.x * aimDistance,
        y: weaponDirection.y * aimDistance,
        z: weaponDirection.z * aimDistance,
      });
  const releaseSeparationOffset = separationDistance <= 1e-9
    ? Object.freeze({ x: 0, y: 0, z: 0 })
    : Object.freeze({
        x: weaponDirection.x * separationDistance,
        y: weaponDirection.y * separationDistance,
        z: weaponDirection.z * separationDistance,
      });

  const topSymmetric = attackDirection === 'top';
  const loadedLeft = topSymmetric ? 0.75 : lateralSign >= 0 ? 1 : 0.48;
  const loadedRight = topSymmetric ? 0.75 : lateralSign <= 0 ? 1 : 0.48;
  const bodyScale = profile.fullBodyRecoilScale;
  const legBase = 9.5 * bodyStrength * profile.legStrengthScale * weights.legWeight * bodyScale;
  const kneeBase = 14.5 * bodyStrength * profile.legStrengthScale * weights.legWeight * bodyScale;

  const pose = Object.freeze({
    weaponAimOffsetMeters: aimOffset,
    releaseSeparationOffsetMeters: releaseSeparationOffset,
    releaseSeparationDistanceMeters: separationDistance,
    upperArmAimDegrees: deflectDegrees * profile.armDeflectScale * weights.armWeight,
    lowerArmAimDegrees: deflectDegrees * profile.forearmDeflectScale * weights.armWeight,
    chestYawDegrees: finite(plan.body?.yawDegrees) * weights.chestWeight * 0.72 * bodyScale,
    chestPitchDegrees: finite(plan.body?.pitchDegrees) * weights.chestWeight * 0.62 * bodyScale,
    chestRollDegrees: finite(plan.body?.rollDegrees) * weights.chestWeight * 0.86 * bodyScale,
    spineYawDegrees: finite(plan.body?.yawDegrees) * weights.spineWeight * 0.50 * bodyScale,
    spinePitchDegrees: finite(plan.body?.pitchDegrees) * weights.spineWeight * 0.44 * bodyScale,
    spineRollDegrees: finite(plan.body?.rollDegrees) * weights.spineWeight * 0.58 * bodyScale,
    hipsYawDegrees: finite(plan.body?.yawDegrees) * weights.hipsWeight * 0.30 * bodyScale,
    hipsPitchDegrees: finite(plan.body?.pitchDegrees) * weights.hipsWeight * 0.26 * bodyScale,
    hipsRollDegrees: finite(plan.body?.rollDegrees) * weights.hipsWeight * 0.34 * bodyScale,
    leftThighBendDegrees: legBase * loadedLeft,
    rightThighBendDegrees: legBase * loadedRight,
    leftKneeBendDegrees: kneeBase * loadedLeft,
    rightKneeBendDegrees: kneeBase * loadedRight,
  });

  return Object.freeze({
    stage: ATTACKER_RECOIL_PRESENTATION_STAGE,
    motionStage: profile.releaseSeparationWindowMs > 0 ? CONTACT_RELEASE_SEPARATION_MOTION_STAGE : null,
    fusionStage: fusionActive ? FULL_BODY_RECOIL_FUSION_STAGE : null,
    sequence: plan.sequence ?? null,
    responseClass: plan.responseClass || null,
    attackDirection,
    elapsedMs: Math.max(0, finite(elapsedMs)),
    phase: weights.phase,
    weights,
    pose,
    complete: false,
    readyForAttackHandoff: false,
    profile,
    forceChain: fusionActive
      ? Object.freeze(['weapon', 'right-arm', 'chest', 'spine', 'hips', 'legs'])
      : Object.freeze(['weapon', 'right-arm', 'torso', 'legs']),
    basePoseRequirement: 'sample-frozen-contact-pose-before-each-additive-update',
    authority: fusionActive
      ? 'impact-accent-full-body-recoil-fusion'
      : profile.releaseSeparationWindowMs > 0
        ? 'contact-release-separation-motion-then-attacker-recoil'
        : 'attacker-recoil-presentation-only',
  });
}

function applyLocalAxisAngle(THREE, bone, axis, degrees) {
  if (!bone || Math.abs(degrees) < 1e-5) return;
  const delta = new THREE.Quaternion();
  delta.setFromAxisAngle(axis, degrees * Math.PI / 180);
  bone.quaternion.multiply(delta).normalize();
}

function aimEffectorWithBone(THREE, bone, effectorWorld, targetWorld, maxDegrees) {
  if (!bone || maxDegrees <= 0) return 0;
  const boneWorld = new THREE.Vector3();
  bone.getWorldPosition(boneWorld);
  const currentDirection = effectorWorld.clone().sub(boneWorld);
  const targetDirection = targetWorld.clone().sub(boneWorld);
  if (currentDirection.lengthSq() < 1e-10 || targetDirection.lengthSq() < 1e-10) return 0;
  currentDirection.normalize();
  targetDirection.normalize();

  const desiredWorldDelta = new THREE.Quaternion().setFromUnitVectors(currentDirection, targetDirection);
  const rawAngle = 2 * Math.acos(clamp(Math.abs(desiredWorldDelta.w), -1, 1));
  if (rawAngle < 1e-6) return 0;
  const appliedAngle = Math.min(rawAngle, maxDegrees * Math.PI / 180);
  const limitedWorldDelta = new THREE.Quaternion();
  limitedWorldDelta.slerpQuaternions(
    new THREE.Quaternion(),
    desiredWorldDelta,
    appliedAngle / rawAngle,
  );

  const parentWorld = new THREE.Quaternion();
  bone.parent?.getWorldQuaternion(parentWorld);
  const localDelta = parentWorld.clone().invert().multiply(limitedWorldDelta).multiply(parentWorld);
  bone.quaternion.premultiply(localDelta).normalize();
  return appliedAngle * 180 / Math.PI;
}

export function createAttackerRecoilPresentationRuntime(THREE, options = {}) {
  if (!THREE?.Vector3 || !THREE?.Quaternion) {
    throw new Error('G4.3B.3 requires THREE.Vector3 + Quaternion');
  }

  const rig = options.rig;
  const required = [
    'hips', 'spine', 'chest',
    'upperarm.r', 'lowerarm.r', 'hand.r',
    'upperleg.l', 'upperleg.r',
    'lowerleg.l', 'lowerleg.r',
  ];
  const missing = required.filter((id) => !rig?.bones?.[id]);
  if (missing.length) {
    throw new Error(`G4.3B.3 missing attacker recoil bones: ${missing.join(', ')}`);
  }

  const axisX = new THREE.Vector3(1, 0, 0);
  const axisY = new THREE.Vector3(0, 1, 0);
  const axisZ = new THREE.Vector3(0, 0, 1);
  const handWorld = new THREE.Vector3();
  const targetWorld = new THREE.Vector3();
  const aimOffset = new THREE.Vector3();

  let activePlan = null;
  let activeProfile = { ...(options.profile || {}) };
  let elapsedMs = 0;
  let lastCompleted = null;
  let postCouplingHandoff = null;

  function snapshot() {
    const sample = activePlan
      ? sampleAttackerRecoilPresentation(activePlan, elapsedMs, activeProfile)
      : null;
    return Object.freeze({
      stage: ATTACKER_RECOIL_PRESENTATION_STAGE,
      motionStage: sample?.motionStage || null,
      fusionStage: sample?.fusionStage || null,
      active: Boolean(activePlan),
      elapsedMs,
      plan: activePlan,
      sample,
      postCouplingHandoff,
      lastCompleted,
    });
  }

  function start(plan) {
    if (activePlan) {
      return Object.freeze({ accepted: false, reason: 'attacker-recoil-already-active', snapshot: snapshot() });
    }
    if (!plan?.planned) {
      return Object.freeze({ accepted: false, reason: 'invalid-recoil-plan', snapshot: snapshot() });
    }
    if (!ATTACKER_RECOIL_PRESENTATION_PROFILES[plan.responseClass]) {
      return Object.freeze({ accepted: false, reason: 'unsupported-response-class', snapshot: snapshot() });
    }
    consumePostCouplingRecoilStaggerHandoff(rig);
    activePlan = plan;
    activeProfile = { ...(options.profile || {}) };
    elapsedMs = 0;
    postCouplingHandoff = null;
    return Object.freeze({ accepted: true, snapshot: snapshot() });
  }

  function applyPendingPostCouplingHandoff() {
    if (!activePlan || postCouplingHandoff) return null;
    const pending = consumePostCouplingRecoilStaggerHandoff(rig);
    if (!pending) return null;
    const baseProfile = resolveProfile(activePlan, activeProfile);
    const handoff = buildPostCouplingRecoilStaggerHandoff({
      plan: activePlan,
      couplingReport: pending.couplingReport,
      surfaceAtContact: pending.surfaceAtContact,
      baseProfile,
    });
    postCouplingHandoff = handoff;
    if (!handoff.accepted) return handoff;
    activePlan = handoff.plan;
    const releaseSeparationWindowMs = Math.max(0, finite(handoff.separation?.releaseWindowMs));
    const releaseSeparationDistanceMeters = releaseSeparationWindowMs > 0
      ? finite(RELEASE_SEPARATION_DISTANCE_METERS[activePlan.responseClass], 0)
      : 0;
    const fullBodyRecoilScale = releaseSeparationWindowMs > 0
      ? finite(FULL_BODY_RECOIL_SCALE[activePlan.responseClass], 1)
      : 1;
    activeProfile = {
      ...activeProfile,
      ...handoff.profileOverrides,
      releaseSeparationWindowMs,
      releaseSeparationDistanceMeters,
      fullBodyRecoilScale,
    };
    elapsedMs = Math.max(elapsedMs, handoff.initialElapsedMs);
    return handoff;
  }

  function applyPose(sample) {
    if (!sample || sample.complete) return Object.freeze({ upperArmAimDegrees: 0, lowerArmAimDegrees: 0 });
    const pose = sample.pose;

    applyLocalAxisAngle(THREE, rig.bones.hips, axisY, pose.hipsYawDegrees);
    applyLocalAxisAngle(THREE, rig.bones.hips, axisX, pose.hipsPitchDegrees);
    applyLocalAxisAngle(THREE, rig.bones.hips, axisZ, pose.hipsRollDegrees);

    applyLocalAxisAngle(THREE, rig.bones.spine, axisY, pose.spineYawDegrees);
    applyLocalAxisAngle(THREE, rig.bones.spine, axisX, pose.spinePitchDegrees);
    applyLocalAxisAngle(THREE, rig.bones.spine, axisZ, pose.spineRollDegrees);

    applyLocalAxisAngle(THREE, rig.bones.chest, axisY, pose.chestYawDegrees);
    applyLocalAxisAngle(THREE, rig.bones.chest, axisX, pose.chestPitchDegrees);
    applyLocalAxisAngle(THREE, rig.bones.chest, axisZ, pose.chestRollDegrees);

    applyLocalAxisAngle(THREE, rig.bones['upperleg.l'], axisX, pose.leftThighBendDegrees);
    applyLocalAxisAngle(THREE, rig.bones['upperleg.r'], axisX, pose.rightThighBendDegrees);
    applyLocalAxisAngle(THREE, rig.bones['lowerleg.l'], axisX, -pose.leftKneeBendDegrees);
    applyLocalAxisAngle(THREE, rig.bones['lowerleg.r'], axisX, -pose.rightKneeBendDegrees);

    rig.root?.updateMatrixWorld?.(true);
    rig.bones['hand.r'].getWorldPosition(handWorld);
    aimOffset.set(
      pose.weaponAimOffsetMeters.x,
      pose.weaponAimOffsetMeters.y,
      pose.weaponAimOffsetMeters.z,
    );
    targetWorld.copy(handWorld).add(aimOffset);

    const upperArmAimDegrees = aimEffectorWithBone(
      THREE,
      rig.bones['upperarm.r'],
      handWorld,
      targetWorld,
      pose.upperArmAimDegrees,
    );
    rig.root?.updateMatrixWorld?.(true);
    rig.bones['hand.r'].getWorldPosition(handWorld);
    const lowerArmAimDegrees = aimEffectorWithBone(
      THREE,
      rig.bones['lowerarm.r'],
      handWorld,
      targetWorld,
      pose.lowerArmAimDegrees,
    );
    rig.root?.updateMatrixWorld?.(true);

    return Object.freeze({ upperArmAimDegrees, lowerArmAimDegrees });
  }

  function update(deltaSeconds = 1 / 60) {
    if (!activePlan) return snapshot();
    const handoff = applyPendingPostCouplingHandoff();
    elapsedMs += Math.max(0, finite(deltaSeconds, 1 / 60)) * 1000;
    const sample = sampleAttackerRecoilPresentation(activePlan, elapsedMs, activeProfile);
    const appliedAim = applyPose(sample);

    if (sample?.complete) {
      lastCompleted = Object.freeze({
        stage: ATTACKER_RECOIL_PRESENTATION_STAGE,
        motionStage: sample.motionStage || null,
        fusionStage: sample.fusionStage || null,
        sequence: activePlan.sequence ?? null,
        responseClass: activePlan.responseClass,
        attackDirection: activePlan.attackDirection,
        durationMs: sample.profile?.settleEndMs
          ?? ATTACKER_RECOIL_PRESENTATION_PROFILES[activePlan.responseClass].settleEndMs,
        postCouplingStage: postCouplingHandoff?.stage || null,
        couplingMomentum: postCouplingHandoff?.couplingMomentum || null,
        readyForAttackHandoff: true,
      });
      activePlan = null;
      activeProfile = { ...(options.profile || {}) };
      elapsedMs = 0;
      postCouplingHandoff = null;
      return Object.freeze({
        ...snapshot(),
        justCompleted: true,
        completed: lastCompleted,
        appliedAim,
        postCouplingHandoffApplied: handoff?.accepted === true,
      });
    }

    return Object.freeze({
      ...snapshot(),
      sample,
      appliedAim,
      justCompleted: false,
      postCouplingHandoffApplied: handoff?.accepted === true,
    });
  }

  function reset() {
    activePlan = null;
    activeProfile = { ...(options.profile || {}) };
    elapsedMs = 0;
    postCouplingHandoff = null;
    consumePostCouplingRecoilStaggerHandoff(rig);
    return snapshot();
  }

  return Object.freeze({
    get snapshot() { return snapshot(); },
    get active() { return Boolean(activePlan); },
    start,
    update,
    reset,
  });
}
