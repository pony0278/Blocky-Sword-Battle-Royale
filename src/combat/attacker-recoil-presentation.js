export const ATTACKER_RECOIL_PRESENTATION_STAGE = 'G4.3B.3';

export const ATTACKER_RECOIL_PRESENTATION_PHASES = Object.freeze({
  CONTACT_HOLD: 'contact-hold',
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
  }),
  'parry-directional-recoil': Object.freeze({
    contactHoldMs: 28,
    impulseEndMs: 105,
    recoilEndMs: 235,
    settleEndMs: 390,
    armDeflectScale: 0.78,
    forearmDeflectScale: 0.48,
    legStrengthScale: 0.78,
  }),
  'perfect-parry-directional-recoil': Object.freeze({
    contactHoldMs: 36,
    impulseEndMs: 120,
    recoilEndMs: 285,
    settleEndMs: 500,
    armDeflectScale: 0.84,
    forearmDeflectScale: 0.54,
    legStrengthScale: 1,
  }),
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
  return Object.freeze({
    ...base,
    ...overrides,
    contactHoldMs: clamp(overrides.contactHoldMs ?? base.contactHoldMs, 0, 120),
    impulseEndMs: clamp(
      overrides.impulseEndMs ?? base.impulseEndMs,
      (overrides.contactHoldMs ?? base.contactHoldMs) + 1,
      260,
    ),
    recoilEndMs: clamp(
      overrides.recoilEndMs ?? base.recoilEndMs,
      (overrides.impulseEndMs ?? base.impulseEndMs) + 1,
      420,
    ),
    settleEndMs: clamp(
      overrides.settleEndMs ?? base.settleEndMs,
      (overrides.recoilEndMs ?? base.recoilEndMs) + 1,
      800,
    ),
    armDeflectScale: clamp(overrides.armDeflectScale ?? base.armDeflectScale, 0, 1.5),
    forearmDeflectScale: clamp(overrides.forearmDeflectScale ?? base.forearmDeflectScale, 0, 1.5),
    legStrengthScale: clamp(overrides.legStrengthScale ?? base.legStrengthScale, 0, 1.5),
  });
}

function sampleWeights(profile, elapsedMs) {
  const elapsed = Math.max(0, finite(elapsedMs));
  if (elapsed >= profile.settleEndMs) {
    return Object.freeze({
      phase: ATTACKER_RECOIL_PRESENTATION_PHASES.COMPLETE,
      armWeight: 0,
      torsoWeight: 0,
      legWeight: 0,
      complete: true,
    });
  }

  if (elapsed <= profile.contactHoldMs) {
    return Object.freeze({
      phase: ATTACKER_RECOIL_PRESENTATION_PHASES.CONTACT_HOLD,
      armWeight: 0,
      torsoWeight: 0,
      legWeight: 0,
      complete: false,
    });
  }

  if (elapsed <= profile.impulseEndMs) {
    const t = clamp01((elapsed - profile.contactHoldMs) / (profile.impulseEndMs - profile.contactHoldMs));
    return Object.freeze({
      phase: ATTACKER_RECOIL_PRESENTATION_PHASES.IMPULSE,
      armWeight: smoothstep01(t),
      torsoWeight: smoothstep01((t - 0.12) / 0.88),
      legWeight: smoothstep01((t - 0.28) / 0.72),
      complete: false,
    });
  }

  if (elapsed <= profile.recoilEndMs) {
    const t = smoothstep01((elapsed - profile.impulseEndMs) / (profile.recoilEndMs - profile.impulseEndMs));
    return Object.freeze({
      phase: ATTACKER_RECOIL_PRESENTATION_PHASES.RECOIL,
      armWeight: 1 - 0.22 * t,
      torsoWeight: 1 - 0.12 * t,
      legWeight: 1 - 0.07 * t,
      complete: false,
    });
  }

  const t = smoothstep01((elapsed - profile.recoilEndMs) / (profile.settleEndMs - profile.recoilEndMs));
  return Object.freeze({
    phase: ATTACKER_RECOIL_PRESENTATION_PHASES.SETTLE,
    armWeight: 0.78 * (1 - t),
    torsoWeight: 0.88 * (1 - t),
    legWeight: 0.93 * (1 - t),
    complete: false,
  });
}

function zeroPose() {
  return Object.freeze({
    weaponAimOffsetMeters: Object.freeze({ x: 0, y: 0, z: 0 }),
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

  if (weights.complete) {
    return Object.freeze({
      stage: ATTACKER_RECOIL_PRESENTATION_STAGE,
      sequence: plan.sequence ?? null,
      responseClass: plan.responseClass || null,
      attackDirection,
      elapsedMs: Math.max(0, finite(elapsedMs)),
      phase: weights.phase,
      weights,
      pose: zeroPose(),
      complete: true,
      readyForAttackHandoff: true,
      authority: 'attacker-recoil-presentation-only',
    });
  }

  const aimDistance = (0.055 + 0.13 * weaponStrength) * weights.armWeight;
  const aimOffset = aimDistance <= 1e-9
    ? Object.freeze({ x: 0, y: 0, z: 0 })
    : Object.freeze({
        x: weaponDirection.x * aimDistance,
        y: weaponDirection.y * aimDistance,
        z: weaponDirection.z * aimDistance,
      });

  const topSymmetric = attackDirection === 'top';
  const loadedLeft = topSymmetric ? 0.75 : lateralSign >= 0 ? 1 : 0.48;
  const loadedRight = topSymmetric ? 0.75 : lateralSign <= 0 ? 1 : 0.48;
  const legBase = 7.5 * bodyStrength * profile.legStrengthScale * weights.legWeight;
  const kneeBase = 11 * bodyStrength * profile.legStrengthScale * weights.legWeight;

  const pose = Object.freeze({
    weaponAimOffsetMeters: aimOffset,
    upperArmAimDegrees: deflectDegrees * profile.armDeflectScale * weights.armWeight,
    lowerArmAimDegrees: deflectDegrees * profile.forearmDeflectScale * weights.armWeight,
    chestYawDegrees: finite(plan.body?.yawDegrees) * weights.torsoWeight * 0.58,
    chestPitchDegrees: finite(plan.body?.pitchDegrees) * weights.torsoWeight * 0.46,
    chestRollDegrees: finite(plan.body?.rollDegrees) * weights.torsoWeight * 0.72,
    spineYawDegrees: finite(plan.body?.yawDegrees) * weights.torsoWeight * 0.36,
    spinePitchDegrees: finite(plan.body?.pitchDegrees) * weights.torsoWeight * 0.34,
    spineRollDegrees: finite(plan.body?.rollDegrees) * weights.torsoWeight * 0.44,
    hipsYawDegrees: finite(plan.body?.yawDegrees) * weights.torsoWeight * 0.20,
    hipsPitchDegrees: finite(plan.body?.pitchDegrees) * weights.torsoWeight * 0.18,
    hipsRollDegrees: finite(plan.body?.rollDegrees) * weights.torsoWeight * 0.26,
    leftThighBendDegrees: legBase * loadedLeft,
    rightThighBendDegrees: legBase * loadedRight,
    leftKneeBendDegrees: kneeBase * loadedLeft,
    rightKneeBendDegrees: kneeBase * loadedRight,
  });

  return Object.freeze({
    stage: ATTACKER_RECOIL_PRESENTATION_STAGE,
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
    basePoseRequirement: 'sample-frozen-contact-pose-before-each-additive-update',
    authority: 'attacker-recoil-presentation-only',
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
  let elapsedMs = 0;
  let lastCompleted = null;

  function snapshot() {
    const sample = activePlan
      ? sampleAttackerRecoilPresentation(activePlan, elapsedMs, options.profile)
      : null;
    return Object.freeze({
      stage: ATTACKER_RECOIL_PRESENTATION_STAGE,
      active: Boolean(activePlan),
      elapsedMs,
      plan: activePlan,
      sample,
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
    activePlan = plan;
    elapsedMs = 0;
    return Object.freeze({ accepted: true, snapshot: snapshot() });
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
    elapsedMs += Math.max(0, finite(deltaSeconds, 1 / 60)) * 1000;
    const sample = sampleAttackerRecoilPresentation(activePlan, elapsedMs, options.profile);
    const appliedAim = applyPose(sample);

    if (sample?.complete) {
      lastCompleted = Object.freeze({
        stage: ATTACKER_RECOIL_PRESENTATION_STAGE,
        sequence: activePlan.sequence ?? null,
        responseClass: activePlan.responseClass,
        attackDirection: activePlan.attackDirection,
        durationMs: sample.profile?.settleEndMs
          ?? ATTACKER_RECOIL_PRESENTATION_PROFILES[activePlan.responseClass].settleEndMs,
        readyForAttackHandoff: true,
      });
      activePlan = null;
      elapsedMs = 0;
      return Object.freeze({
        ...snapshot(),
        justCompleted: true,
        completed: lastCompleted,
        appliedAim,
      });
    }

    return Object.freeze({
      ...snapshot(),
      sample,
      appliedAim,
      justCompleted: false,
    });
  }

  function reset() {
    activePlan = null;
    elapsedMs = 0;
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
