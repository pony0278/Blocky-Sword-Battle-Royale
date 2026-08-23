export const LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE = 'G4.3B.5R.3.1R';

export const LIVE_SHIELD_SWORD_GRIP_CONTACT_PHASES = Object.freeze({
  LIVE_CONTACT: 'live-shield-sword-contact',
  INSPECTION_HOLD: 'inspection-hold',
});

export const LIVE_SHIELD_SWORD_GRIP_CONTACT_PROFILE = Object.freeze({
  minimumShieldTangentSpeedMps: 0.02,
  minimumInspectionOfflineTravelMeters: 0.075,
  minimumInspectionHandTravelMeters: 0.01,
  minimumInspectionGripTravelMeters: 0.02,
  minimumSwordAxisClearanceDegrees: 7,
  minimumHiltOfflineTravelMeters: 0.025,
  minimumWristGripClearanceDegrees: 7,
  maximumContactTargetTravelMeters: 0.24,
  maximumWristDegrees: 38,
  releaseHysteresisMeters: 0.012,
  settledTargetSpeedMps: 0.025,
  settledFrameCount: 3,
  reverseFrameCount: 2,
  maximumLiveConstraintMs: 520,
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, finite(value, minimum)));
}

function vec(value = {}) {
  return {
    x: finite(value.x),
    y: finite(value.y),
    z: finite(value.z),
  };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(value, scalar) {
  return { x: value.x * scalar, y: value.y * scalar, z: value.z * scalar };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function length(value) {
  return Math.hypot(value.x, value.y, value.z);
}

function normalize(value, fallback = { x: 0, y: 0, z: 0 }) {
  const magnitude = length(value);
  return magnitude > 1e-8 ? scale(value, 1 / magnitude) : { ...fallback };
}

function projectOnPlane(value, normal) {
  return subtract(value, scale(normal, dot(value, normal)));
}

function rotateAroundAxis(value, axis, radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return add(
    add(scale(value, cosine), scale(cross(axis, value), sine)),
    scale(axis, dot(axis, value) * (1 - cosine)),
  );
}

function freezeVector(value) {
  return Object.freeze({ x: value.x, y: value.y, z: value.z });
}

function resolveProfile(overrides = {}) {
  const base = LIVE_SHIELD_SWORD_GRIP_CONTACT_PROFILE;
  return Object.freeze({
    ...base,
    ...overrides,
    minimumShieldTangentSpeedMps: clamp(
      overrides.minimumShieldTangentSpeedMps ?? base.minimumShieldTangentSpeedMps,
      0,
      2,
    ),
    minimumInspectionOfflineTravelMeters: clamp(
      overrides.minimumInspectionOfflineTravelMeters ?? base.minimumInspectionOfflineTravelMeters,
      0.02,
      0.2,
    ),
    minimumInspectionHandTravelMeters: clamp(
      overrides.minimumInspectionHandTravelMeters ?? base.minimumInspectionHandTravelMeters,
      0,
      0.1,
    ),
    minimumInspectionGripTravelMeters: clamp(
      overrides.minimumInspectionGripTravelMeters ?? base.minimumInspectionGripTravelMeters,
      0,
      0.15,
    ),
    minimumSwordAxisClearanceDegrees: clamp(
      overrides.minimumSwordAxisClearanceDegrees ?? base.minimumSwordAxisClearanceDegrees,
      1,
      25,
    ),
    minimumHiltOfflineTravelMeters: clamp(
      overrides.minimumHiltOfflineTravelMeters ?? base.minimumHiltOfflineTravelMeters,
      0.005,
      0.12,
    ),
    minimumWristGripClearanceDegrees: clamp(
      overrides.minimumWristGripClearanceDegrees ?? base.minimumWristGripClearanceDegrees,
      1,
      25,
    ),
    maximumContactTargetTravelMeters: clamp(
      overrides.maximumContactTargetTravelMeters ?? base.maximumContactTargetTravelMeters,
      overrides.minimumInspectionOfflineTravelMeters ?? base.minimumInspectionOfflineTravelMeters,
      0.5,
    ),
    maximumWristDegrees: clamp(overrides.maximumWristDegrees ?? base.maximumWristDegrees, 5, 60),
    releaseHysteresisMeters: clamp(
      overrides.releaseHysteresisMeters ?? base.releaseHysteresisMeters,
      0.002,
      0.08,
    ),
    settledTargetSpeedMps: clamp(
      overrides.settledTargetSpeedMps ?? base.settledTargetSpeedMps,
      0.001,
      0.2,
    ),
    settledFrameCount: Math.round(clamp(overrides.settledFrameCount ?? base.settledFrameCount, 1, 12)),
    reverseFrameCount: Math.round(clamp(overrides.reverseFrameCount ?? base.reverseFrameCount, 1, 12)),
    maximumLiveConstraintMs: clamp(
      overrides.maximumLiveConstraintMs ?? base.maximumLiveConstraintMs,
      150,
      1200,
    ),
  });
}

function eligibleRealContact(contact) {
  return contact?.contact === true
    && contact?.geometricContact === true
    && contact?.eligible === true;
}

function rotationBetweenNormals(fromNormal, toNormal) {
  const from = normalize(fromNormal, { x: 0, y: 0, z: -1 });
  const to = normalize(toNormal, from);
  const cosine = clamp(dot(from, to), -1, 1);
  const radians = Math.acos(cosine);
  let axis = cross(from, to);
  if (length(axis) <= 1e-8 && cosine < 0) {
    axis = Math.abs(from.y) < 0.9
      ? cross(from, { x: 0, y: 1, z: 0 })
      : cross(from, { x: 1, y: 0, z: 0 });
  }
  return Object.freeze({ axis: freezeVector(normalize(axis)), radians });
}

export function buildLiveShieldSwordGripContactPlan(input = {}) {
  const contact = input.contact || {};
  if (!eligibleRealContact(contact)) {
    return Object.freeze({
      accepted: false,
      stage: LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
      reason: 'eligible-real-swept-contact-required',
    });
  }

  const surface = input.surfaceAtContact || contact.surface || {};
  const profile = resolveProfile(input.profile);
  const surfaceCenter = vec(surface.center);
  const surfaceNormal = normalize(vec(surface.normal), { x: 0, y: 0, z: -1 });
  const contactPoint = vec(contact.point);
  const wristPoint = vec(input.wristWorldPoint);
  const handPoint = vec(input.handWorldPoint);
  const wristToContact = subtract(contactPoint, wristPoint);
  const wristToContactLengthMeters = length(wristToContact);
  if (wristToContactLengthMeters <= 0.08) {
    return Object.freeze({
      accepted: false,
      stage: LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
      reason: 'contact-lever-too-short-for-wrist-constraint',
    });
  }

  const incomingSwordVelocity = vec(contact.incomingVelocity);
  const motion = input.shieldLeadMotion || {};
  const motionDeltaSeconds = Math.max(1e-5, finite(motion.deltaSeconds, 1 / 60));
  const shieldLinearVelocity = scale(vec(motion.translation), 1 / motionDeltaSeconds);
  const shieldAngularVelocity = vec(motion.angularVelocity);
  const shieldContactRadius = subtract(contactPoint, surfaceCenter);
  const shieldAngularContactVelocity = cross(shieldAngularVelocity, shieldContactRadius);
  const shieldContactVelocity = add(shieldLinearVelocity, shieldAngularContactVelocity);
  const relativeSwordVelocity = subtract(incomingSwordVelocity, shieldContactVelocity);
  const separatingNormal = dot(relativeSwordVelocity, surfaceNormal) <= 0
    ? surfaceNormal
    : scale(surfaceNormal, -1);
  const measuredShieldTangent = projectOnPlane(shieldContactVelocity, separatingNormal);
  const measuredShieldTangentSpeedMps = length(measuredShieldTangent);
  const relativeTangent = projectOnPlane(scale(relativeSwordVelocity, -1), separatingNormal);
  const tangentAuthority = measuredShieldTangentSpeedMps >= profile.minimumShieldTangentSpeedMps
    ? 'measured-shield-contact-velocity'
    : 'relative-contact-tangent-fallback';
  const tangent = tangentAuthority === 'measured-shield-contact-velocity'
    ? measuredShieldTangent
    : relativeTangent;
  const initialDeflectionDirection = normalize(tangent, separatingNormal);

  return Object.freeze({
    accepted: true,
    stage: LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
    phase: LIVE_SHIELD_SWORD_GRIP_CONTACT_PHASES.LIVE_CONTACT,
    contactPoint: freezeVector(contactPoint),
    wristWorldPoint: freezeVector(wristPoint),
    handWorldPoint: freezeVector(handPoint),
    initialSurfaceCenter: freezeVector(surfaceCenter),
    initialSurfaceNormal: freezeVector(surfaceNormal),
    shieldContactRadius: freezeVector(shieldContactRadius),
    incomingSwordVelocity: freezeVector(incomingSwordVelocity),
    shieldLinearVelocity: freezeVector(shieldLinearVelocity),
    shieldAngularVelocity: freezeVector(shieldAngularVelocity),
    shieldContactVelocity: freezeVector(shieldContactVelocity),
    measuredShieldTangent: freezeVector(measuredShieldTangent),
    measuredShieldTangentSpeedMps,
    tangentAuthority,
    separatingNormal: freezeVector(separatingNormal),
    initialDeflectionDirection: freezeVector(initialDeflectionDirection),
    wristToContact: freezeVector(wristToContact),
    wristToContactDirection: freezeVector(scale(wristToContact, 1 / wristToContactLengthMeters)),
    wristToContactLengthMeters,
    gripChainOnly: true,
    modifiedBone: 'wrist.r',
    propagatedBones: Object.freeze(['hand.r', 'handslot.r']),
    elbowPropagationActive: false,
    shoulderPropagationActive: false,
    b3ClockFrozen: true,
    profile,
    authority: 'live-shield-surface-contact-anchor-constrains-sword-through-wrist-grip',
  });
}

export function mapLiveShieldContactTarget(plan, surfaceAtFrame = {}) {
  if (!plan?.accepted) {
    return Object.freeze({
      accepted: false,
      stage: LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
      reason: plan?.reason || 'accepted-live-contact-plan-required',
    });
  }

  const center = vec(surfaceAtFrame.center);
  const normal = normalize(vec(surfaceAtFrame.normal), plan.initialSurfaceNormal);
  const normalRotation = rotationBetweenNormals(plan.initialSurfaceNormal, normal);
  const mappedRadius = normalRotation.radians > 1e-8
    ? rotateAroundAxis(plan.shieldContactRadius, normalRotation.axis, normalRotation.radians)
    : vec(plan.shieldContactRadius);
  const unclampedTarget = add(center, mappedRadius);
  const unclampedDisplacement = subtract(unclampedTarget, plan.contactPoint);
  const unclampedTravel = length(unclampedDisplacement);
  const travel = Math.min(unclampedTravel, plan.profile.maximumContactTargetTravelMeters);
  const displacement = unclampedTravel > 1e-8
    ? scale(unclampedDisplacement, travel / unclampedTravel)
    : { x: 0, y: 0, z: 0 };
  const targetContactPoint = add(plan.contactPoint, displacement);
  const offlineDisplacement = projectOnPlane(displacement, plan.wristToContactDirection);
  const offlineTravelMeters = length(offlineDisplacement);
  const deflectionDirection = normalize(offlineDisplacement, plan.initialDeflectionDirection);

  return Object.freeze({
    accepted: true,
    stage: LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
    targetContactPoint: freezeVector(targetContactPoint),
    displacement: freezeVector(displacement),
    travelMeters: travel,
    offlineDisplacement: freezeVector(offlineDisplacement),
    offlineTravelMeters,
    deflectionDirection: freezeVector(deflectionDirection),
    surfaceCenter: freezeVector(center),
    surfaceNormal: freezeVector(normal),
    normalRotationAxis: normalRotation.axis,
    normalRotationRadians: normalRotation.radians,
    clamped: unclampedTravel > travel + 1e-8,
    authority: 'current-world-shield-surface',
  });
}

export function solveLiveSwordContactConstraint(input = {}) {
  const pivot = vec(input.pivotWorldPoint);
  const contact = vec(input.currentContactPoint);
  const target = vec(input.targetContactPoint);
  const currentLever = subtract(contact, pivot);
  const targetLever = subtract(target, pivot);
  const currentLength = length(currentLever);
  const targetLength = length(targetLever);
  if (currentLength <= 1e-6 || targetLength <= 1e-6) {
    return Object.freeze({
      accepted: false,
      stage: LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
      reason: 'live-contact-constraint-lever-degenerate',
    });
  }

  const currentDirection = scale(currentLever, 1 / currentLength);
  const targetDirection = scale(targetLever, 1 / targetLength);
  const rawAxis = cross(currentDirection, targetDirection);
  const rawRadians = Math.acos(clamp(dot(currentDirection, targetDirection), -1, 1));
  const maximumRadians = clamp(finite(input.maximumDegrees, 38), 0, 90) * Math.PI / 180;
  const appliedRadians = Math.min(rawRadians, maximumRadians);
  const axis = normalize(rawAxis);
  const expectedLever = length(axis) > 0 && appliedRadians > 1e-8
    ? rotateAroundAxis(currentLever, axis, appliedRadians)
    : currentLever;
  const expectedContactPoint = add(pivot, expectedLever);
  const constraintError = subtract(target, expectedContactPoint);

  return Object.freeze({
    accepted: true,
    stage: LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
    axis: freezeVector(axis),
    rawRadians,
    rawDegrees: rawRadians * 180 / Math.PI,
    appliedRadians,
    appliedDegrees: appliedRadians * 180 / Math.PI,
    rotationClamped: rawRadians > appliedRadians + 1e-8,
    expectedContactPoint: freezeVector(expectedContactPoint),
    constraintError: freezeVector(constraintError),
    constraintErrorMeters: length(constraintError),
    authority: 'position-based-live-contact-direction-constraint',
  });
}

export function evaluateAttackLineClearance(input = {}) {
  const profile = resolveProfile(input.profile);
  const initialSwordBase = vec(input.initialSwordBasePoint);
  const initialSwordTip = vec(input.initialSwordTipPoint);
  const currentSwordBase = vec(input.currentSwordBasePoint);
  const currentSwordTip = vec(input.currentSwordTipPoint);
  const initialWrist = vec(input.initialWristPoint);
  const initialGrip = vec(input.initialGripPoint);
  const currentWrist = vec(input.currentWristPoint);
  const currentGrip = vec(input.currentGripPoint);
  const initialSwordAxis = normalize(subtract(initialSwordTip, initialSwordBase));
  const currentSwordAxis = normalize(subtract(currentSwordTip, currentSwordBase));
  const initialWristGripLine = normalize(subtract(initialGrip, initialWrist));
  const currentWristGripLine = normalize(subtract(currentGrip, currentWrist));
  const swordAxisClearanceDegrees = Math.acos(clamp(dot(initialSwordAxis, currentSwordAxis), -1, 1)) * 180 / Math.PI;
  const wristGripClearanceDegrees = Math.acos(clamp(dot(initialWristGripLine, currentWristGripLine), -1, 1)) * 180 / Math.PI;
  const hiltOffset = subtract(currentGrip, initialGrip);
  const hiltOfflineOffset = projectOnPlane(hiltOffset, initialSwordAxis);
  const hiltOfflineTravelMeters = length(hiltOfflineOffset);
  const swordAxisPassed = swordAxisClearanceDegrees >= profile.minimumSwordAxisClearanceDegrees;
  const hiltOfflinePassed = hiltOfflineTravelMeters >= profile.minimumHiltOfflineTravelMeters;
  const wristGripLinePassed = wristGripClearanceDegrees >= profile.minimumWristGripClearanceDegrees;

  return Object.freeze({
    pass: swordAxisPassed && hiltOfflinePassed && wristGripLinePassed,
    swordAxisPassed,
    hiltOfflinePassed,
    wristGripLinePassed,
    swordAxisClearanceDegrees,
    hiltOfflineTravelMeters,
    wristGripClearanceDegrees,
    minimumSwordAxisClearanceDegrees: profile.minimumSwordAxisClearanceDegrees,
    minimumHiltOfflineTravelMeters: profile.minimumHiltOfflineTravelMeters,
    minimumWristGripClearanceDegrees: profile.minimumWristGripClearanceDegrees,
    initialSwordAxis: freezeVector(initialSwordAxis),
    currentSwordAxis: freezeVector(currentSwordAxis),
    hiltOfflineOffset: freezeVector(hiltOfflineOffset),
    authority: 'measured-current-lines-versus-frozen-contact-attack-line',
  });
}

const LIVE_CONTACT_DIRECTION_AGREEMENT_MINIMUM = 0.5;
const EXPECTED_HOLD_TERMINAL_REASONS = Object.freeze(new Set([
  'shield-surface-separated-after-live-deflection-peak',
  'shield-surface-settled-after-live-deflection-peak',
  'live-contact-safety-limit-after-sufficient-deflection',
]));

function inspectionGate(key, label, actualValue, minimumValue, unit, operator = '>=') {
  const actual = actualValue == null ? null : Number.isFinite(Number(actualValue)) ? Number(actualValue) : null;
  const minimum = finite(minimumValue);
  const pass = actual != null && (operator === '>' ? actual > minimum : actual >= minimum);
  return Object.freeze({ key, label, pass, actual, minimum, operator, unit });
}

export function evaluateLiveContactInspection(input = {}) {
  const profile = resolveProfile(input.profile);
  const clearance = input.attackLineClearance || {};
  const gates = Object.freeze({
    shieldOfflineTravel: inspectionGate(
      'shieldOfflineTravel',
      'shield offline travel',
      input.peakOfflineTravelMeters,
      profile.minimumInspectionOfflineTravelMeters,
      'meters',
    ),
    handTravel: inspectionGate(
      'handTravel',
      'hand travel',
      input.actualHandTravelMeters,
      profile.minimumInspectionHandTravelMeters,
      'meters',
    ),
    gripTravel: inspectionGate(
      'gripTravel',
      'grip travel',
      input.actualGripTravelMeters,
      profile.minimumInspectionGripTravelMeters,
      'meters',
    ),
    swordAxisClearance: inspectionGate(
      'swordAxisClearance',
      'sword axis clearance',
      clearance.swordAxisClearanceDegrees,
      profile.minimumSwordAxisClearanceDegrees,
      'degrees',
    ),
    hiltOfflineTravel: inspectionGate(
      'hiltOfflineTravel',
      'hilt offline travel',
      clearance.hiltOfflineTravelMeters,
      profile.minimumHiltOfflineTravelMeters,
      'meters',
    ),
    wristGripClearance: inspectionGate(
      'wristGripClearance',
      'wrist to grip clearance',
      clearance.wristGripClearanceDegrees,
      profile.minimumWristGripClearanceDegrees,
      'degrees',
    ),
    directionAgreement: inspectionGate(
      'directionAgreement',
      'deflection direction agreement',
      input.directionAgreement,
      LIVE_CONTACT_DIRECTION_AGREEMENT_MINIMUM,
      'ratio',
      '>',
    ),
  });
  const failedGateKeys = Object.freeze(
    Object.values(gates).filter((gate) => !gate.pass).map((gate) => gate.key),
  );
  const terminalReason = input.terminalReason || null;
  const terminalIsExpectedHold = EXPECTED_HOLD_TERMINAL_REASONS.has(terminalReason);
  const holding = input.holding === true;

  return Object.freeze({
    pass: holding && failedGateKeys.length === 0,
    holding,
    gates,
    failedGateKeys,
    failedGateCount: failedGateKeys.length,
    terminalReason,
    terminalIsExpectedHold,
    authority: 'measured-live-contact-inspection-gates',
  });
}
function applyWorldAxisRotation(THREE, bone, axis, radians) {
  if (!bone || Math.abs(radians) <= 1e-8) return 0;
  const worldAxis = new THREE.Vector3(axis.x, axis.y, axis.z);
  if (worldAxis.lengthSq() <= 1e-10) return 0;
  worldAxis.normalize();
  const worldDelta = new THREE.Quaternion().setFromAxisAngle(worldAxis, radians);
  const parentWorld = new THREE.Quaternion();
  bone.parent?.getWorldQuaternion(parentWorld);
  const localDelta = parentWorld.clone().invert().multiply(worldDelta).multiply(parentWorld);
  bone.quaternion.premultiply(localDelta).normalize();
  return radians * 180 / Math.PI;
}

export function createLiveShieldSwordGripContactRuntime(THREE, options = {}) {
  if (!THREE?.Vector3 || !THREE?.Quaternion) {
    throw new Error(`${LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE} requires THREE.Vector3 + Quaternion`);
  }
  const attackerRig = options.attackerRig;
  const attackerSword = options.attackerSword;
  const wristBone = attackerRig?.bones?.['wrist.r'];
  const handBone = attackerRig?.bones?.['hand.r'];
  if (!wristBone || !handBone) {
    throw new Error(`${LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE} requires attacker wrist.r + hand.r`);
  }
  if (!attackerSword?.object3d?.worldToLocal || !attackerSword?.object3d?.localToWorld
    || !attackerSword?.bladeBase?.getWorldPosition || !attackerSword?.tip?.getWorldPosition) {
    throw new Error(`${LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE} requires an attached attacker sword with blade axis nodes`);
  }

  let active = null;
  let lastReport = null;

  function reset() {
    if (active?.baseWristQuaternion) wristBone.quaternion.copy(active.baseWristQuaternion);
    attackerRig.root?.updateMatrixWorld?.(true);
    active = null;
    lastReport = null;
    return null;
  }

  function start(input = {}) {
    if (active) {
      return Object.freeze({
        accepted: false,
        stage: LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
        reason: 'live-shield-sword-grip-contact-already-active',
      });
    }
    attackerRig.root?.updateMatrixWorld?.(true);
    attackerSword.update?.();
    attackerSword.object3d.updateMatrixWorld(true);

    const wristWorld = new THREE.Vector3();
    const handWorld = new THREE.Vector3();
    const gripWorld = new THREE.Vector3();
    const swordBaseWorld = new THREE.Vector3();
    const swordTipWorld = new THREE.Vector3();
    wristBone.getWorldPosition(wristWorld);
    handBone.getWorldPosition(handWorld);
    attackerSword.object3d.getWorldPosition(gripWorld);
    attackerSword.bladeBase.getWorldPosition(swordBaseWorld);
    attackerSword.tip.getWorldPosition(swordTipWorld);
    const plan = buildLiveShieldSwordGripContactPlan({
      ...input,
      wristWorldPoint: wristWorld,
      handWorldPoint: handWorld,
      initialSwordBasePoint: swordBaseWorld,
      initialSwordTipPoint: swordTipWorld,
      initialGripPoint: gripWorld,
    });
    if (!plan.accepted) {
      lastReport = plan;
      return plan;
    }

    const contactLocal = new THREE.Vector3(plan.contactPoint.x, plan.contactPoint.y, plan.contactPoint.z);
    attackerSword.object3d.worldToLocal(contactLocal);
    const initialTarget = new THREE.Vector3(plan.contactPoint.x, plan.contactPoint.y, plan.contactPoint.z);
    active = {
      plan,
      elapsedMs: 0,
      holding: false,
      terminalReason: null,
      baseWristQuaternion: wristBone.quaternion.clone(),
      contactLocal,
      initialContactWorld: initialTarget.clone(),
      initialHandWorld: handWorld.clone(),
      initialGripWorld: gripWorld.clone(),
      initialSwordBaseWorld: swordBaseWorld.clone(),
      initialSwordTipWorld: swordTipWorld.clone(),
      previousRawTarget: initialTarget.clone(),
      peakTarget: initialTarget.clone(),
      peakOfflineTravelMeters: 0,
      peakTargetTravelMeters: 0,
      settledFrames: 0,
      reverseFrames: 0,
      lastMappedSurfaceTarget: null,
    };
    lastReport = Object.freeze({
      accepted: true,
      active: true,
      holding: false,
      complete: false,
      phase: LIVE_SHIELD_SWORD_GRIP_CONTACT_PHASES.LIVE_CONTACT,
      stage: LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
      plan,
      modifiedBone: 'wrist.r',
      propagatedBones: plan.propagatedBones,
      rigidSwordGrip: true,
      actualContactTravelMeters: 0,
      actualHandTravelMeters: 0,
      actualGripTravelMeters: 0,
      b3ClockFrozen: true,
    });
    return lastReport;
  }

  function update(deltaSeconds = 1 / 60, input = {}) {
    if (!active) {
      return Object.freeze({
        accepted: false,
        active: false,
        stage: LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
        reason: 'live-shield-sword-grip-contact-not-active',
        report: lastReport,
      });
    }

    const dt = Math.max(1e-5, finite(deltaSeconds, 1 / 60));
    active.elapsedMs += dt * 1000;
    let mapped = null;
    let rawTargetSpeedMps = 0;
    if (!active.holding) {
      mapped = mapLiveShieldContactTarget(active.plan, input.surfaceAtFrame || {});
      if (!mapped.accepted) return mapped;
      active.lastMappedSurfaceTarget = mapped;
      const rawTarget = new THREE.Vector3(
        mapped.targetContactPoint.x,
        mapped.targetContactPoint.y,
        mapped.targetContactPoint.z,
      );
      rawTargetSpeedMps = rawTarget.distanceTo(active.previousRawTarget) / dt;
      active.previousRawTarget.copy(rawTarget);

      if (mapped.offlineTravelMeters > active.peakOfflineTravelMeters + 1e-5) {
        active.peakOfflineTravelMeters = mapped.offlineTravelMeters;
        active.peakTargetTravelMeters = mapped.travelMeters;
        active.peakTarget.copy(rawTarget);
        active.settledFrames = 0;
        active.reverseFrames = 0;
      } else {
        active.settledFrames = rawTargetSpeedMps <= active.plan.profile.settledTargetSpeedMps
          ? active.settledFrames + 1
          : 0;
        active.reverseFrames = active.peakOfflineTravelMeters - mapped.offlineTravelMeters
          >= active.plan.profile.releaseHysteresisMeters
          ? active.reverseFrames + 1
          : 0;
      }

      const inspectionTravelReached = active.peakOfflineTravelMeters
        >= active.plan.profile.minimumInspectionOfflineTravelMeters;
      const surfaceSeparatedAfterPeak = active.reverseFrames >= active.plan.profile.reverseFrameCount;
      const surfaceSettledAfterPeak = active.settledFrames >= active.plan.profile.settledFrameCount;
      const safetyLimitReached = active.elapsedMs >= active.plan.profile.maximumLiveConstraintMs;
      if ((inspectionTravelReached && (surfaceSeparatedAfterPeak || surfaceSettledAfterPeak))
        || safetyLimitReached) {
        active.holding = true;
        active.terminalReason = inspectionTravelReached
          ? surfaceSeparatedAfterPeak
            ? 'shield-surface-separated-after-live-deflection-peak'
            : surfaceSettledAfterPeak
              ? 'shield-surface-settled-after-live-deflection-peak'
              : 'live-contact-safety-limit-after-sufficient-deflection'
          : 'insufficient-live-shield-offline-travel';
      }
    }

    wristBone.quaternion.copy(active.baseWristQuaternion);
    attackerRig.root?.updateMatrixWorld?.(true);
    attackerSword.update?.();
    attackerSword.object3d.updateMatrixWorld(true);

    const pivotWorld = new THREE.Vector3();
    const baseContactWorld = active.contactLocal.clone();
    wristBone.getWorldPosition(pivotWorld);
    attackerSword.object3d.localToWorld(baseContactWorld);
    const targetWorld = active.peakTarget;
    const constraint = solveLiveSwordContactConstraint({
      pivotWorldPoint: pivotWorld,
      currentContactPoint: baseContactWorld,
      targetContactPoint: targetWorld,
      maximumDegrees: active.plan.profile.maximumWristDegrees,
    });
    if (!constraint.accepted) return constraint;
    const appliedWristDegrees = applyWorldAxisRotation(
      THREE,
      wristBone,
      constraint.axis,
      constraint.appliedRadians,
    );
    attackerRig.root?.updateMatrixWorld?.(true);
    attackerSword.update?.();
    attackerSword.object3d.updateMatrixWorld(true);

    const actualContactWorld = active.contactLocal.clone();
    const actualHandWorld = new THREE.Vector3();
    const actualGripWorld = new THREE.Vector3();
    const actualWristWorld = new THREE.Vector3();
    const currentSwordBaseWorld = new THREE.Vector3();
    const currentSwordTipWorld = new THREE.Vector3();
    attackerSword.object3d.localToWorld(actualContactWorld);
    handBone.getWorldPosition(actualHandWorld);
    attackerSword.object3d.getWorldPosition(actualGripWorld);
    wristBone.getWorldPosition(actualWristWorld);
    attackerSword.bladeBase.getWorldPosition(currentSwordBaseWorld);
    attackerSword.tip.getWorldPosition(currentSwordTipWorld);
    const actualContactOffset = actualContactWorld.clone().sub(active.initialContactWorld);
    const actualHandOffset = actualHandWorld.clone().sub(active.initialHandWorld);
    const actualGripOffset = actualGripWorld.clone().sub(active.initialGripWorld);
    const peakTargetOffset = active.peakTarget.clone().sub(active.initialContactWorld);
    const directionAgreement = actualContactOffset.lengthSq() > 1e-10 && peakTargetOffset.lengthSq() > 1e-10
      ? actualContactOffset.clone().normalize().dot(peakTargetOffset.clone().normalize())
      : null;
    const liveContactErrorMeters = actualContactWorld.distanceTo(active.peakTarget);
    const actualContactTravelMeters = actualContactOffset.length();
    const actualHandTravelMeters = actualHandOffset.length();
    const actualGripTravelMeters = actualGripOffset.length();
    const attackLineClearance = evaluateAttackLineClearance({
      profile: active.plan.profile,
      initialSwordBasePoint: active.initialSwordBaseWorld,
      initialSwordTipPoint: active.initialSwordTipWorld,
      currentSwordBasePoint: currentSwordBaseWorld,
      currentSwordTipPoint: currentSwordTipWorld,
      initialWristPoint: active.plan.wristWorldPoint,
      initialGripPoint: active.initialGripWorld,
      currentWristPoint: actualWristWorld,
      currentGripPoint: actualGripWorld,
    });
    const inspectionAssessment = evaluateLiveContactInspection({
      profile: active.plan.profile,
      holding: active.holding,
      terminalReason: active.terminalReason,
      peakOfflineTravelMeters: active.peakOfflineTravelMeters,
      actualHandTravelMeters,
      actualGripTravelMeters,
      attackLineClearance,
      directionAgreement,
    });
    const inspectionPassed = inspectionAssessment.pass;

    lastReport = Object.freeze({
      accepted: true,
      active: true,
      holding: active.holding,
      complete: active.holding,
      inspectionPassed,
      phase: active.holding
        ? LIVE_SHIELD_SWORD_GRIP_CONTACT_PHASES.INSPECTION_HOLD
        : LIVE_SHIELD_SWORD_GRIP_CONTACT_PHASES.LIVE_CONTACT,
      stage: LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
      elapsedMs: active.elapsedMs,
      terminalReason: active.terminalReason,
      plan: active.plan,
      mappedSurfaceTarget: active.lastMappedSurfaceTarget,
      targetContactPoint: freezeVector(active.peakTarget),
      peakTargetTravelMeters: active.peakTargetTravelMeters,
      peakOfflineTravelMeters: active.peakOfflineTravelMeters,
      rawTargetSpeedMps,
      constraint,
      appliedWristDegrees,
      actualContactPoint: freezeVector(actualContactWorld),
      actualContactOffset: freezeVector(actualContactOffset),
      actualContactTravelMeters,
      actualHandOffset: freezeVector(actualHandOffset),
      actualHandTravelMeters,
      actualGripOffset: freezeVector(actualGripOffset),
      actualGripTravelMeters,
      actualGripPoint: freezeVector(actualGripWorld),
      actualWristPoint: freezeVector(actualWristWorld),
      initialSwordBasePoint: freezeVector(active.initialSwordBaseWorld),
      initialSwordTipPoint: freezeVector(active.initialSwordTipWorld),
      currentSwordBasePoint: freezeVector(currentSwordBaseWorld),
      currentSwordTipPoint: freezeVector(currentSwordTipWorld),
      attackLineClearance,
      inspectionAssessment,
      liveContactErrorMeters,
      directionAgreement,
      modifiedBone: 'wrist.r',
      propagatedBones: active.plan.propagatedBones,
      gripChainOnly: true,
      rigidSwordGrip: true,
      elbowPropagationActive: false,
      shoulderPropagationActive: false,
      b3ClockFrozen: true,
      authority: active.plan.authority,
    });
    return lastReport;
  }

  return Object.freeze({
    start,
    update,
    reset,
    get active() { return Boolean(active); },
    get holding() { return lastReport?.holding === true; },
    get plan() { return active?.plan || null; },
    get report() { return lastReport; },
  });
}
