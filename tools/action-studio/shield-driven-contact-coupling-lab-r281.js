import { createDefaultCharacter } from '../../src/character/default-character.js';
import { createFreeInspectionCameraControls } from './free-inspection-camera-controls.js?v=g43b5r281-residual-body-reach-r18';
import { createDebugSword, mountDebugSword } from '../../src/character/debug-sword.js';
import { DEFAULT_KAYKIT_SWORD_MOUNT } from '../../src/character/default-character-mount.js';
import { createProceduralBuckler, mountOffhandBuckler } from '../../src/character/offhand-buckler.js';
import {
  ACCEPTED_OFFHAND_BUCKLER_MOUNT_G423,
  ACCEPTED_OFFHAND_BUCKLER_SHAPE_G423,
} from '../../src/character/offhand-buckler-accepted-calibration.js';
import { loadUal1AnimationLibrary } from '../../src/animation/ual1-animation-library.js';
import { loadUal2AnimationLibrary } from '../../src/animation/ual2-animation-library.js';
import { loadSkyrimConvertedAnimationLibrary } from '../../src/animation/skyrim-converted-animation-library.js';
import { composeSkyrimWeaponMountCalibration } from '../../src/animation/skyrim-weapon-bind-calibration.js';
import { GUARD_EVENTS, GUARD_STATES, createGuardStateMachine } from '../../src/combat/guard-state-machine.js';
import { createGuardPresentationRuntime } from '../../src/combat/guard-presentation-runtime.js';
import { createLongswordDirectionalAttackRuntime, LONGSWORD_ATTACK_PHASES } from '../../src/combat/longsword-directional-attack-runtime.js';
import { captureRigPose, applyRigPose, blendRecoveryPose } from '../../src/combat/guard-recovery-bridge.js';
import { sampleLongswordAttackRecovery } from '../../src/combat/longsword-contact-recovery-presentation.js';
import {
  measureSweptSwordBucklerClosestApproach,
  probeSweptSwordBucklerContact,
} from '../../src/combat/swept-sword-buckler-contact.js?v=g43b5r281-residual-body-reach-r18';
import { buildParryWhiffDiagnostic } from '../../src/combat/parry-whiff-diagnostic.js?v=g43b5r281-residual-body-reach-r18';
import { selectReachableParryInterceptTarget } from '../../src/combat/reachable-parry-intercept-target.js?v=g43b5r281-residual-body-reach-r18';
import { createGuardThreatTrackingRuntime, planGuardThreatCorrection } from '../../src/combat/guard-threat-tracking.js?v=g43b5r281-residual-body-reach-r18';
import { createGuardResidualBodyReachRuntime } from '../../src/combat/guard-residual-body-reach.js?v=g43b5r281-residual-body-reach-r18';
import {
  GUARD_RESIDUAL_STANCE_REACH_PROFILE,
  createGuardResidualStanceReachRuntime,
} from '../../src/combat/guard-residual-stance-reach.js?v=g43b5r281-debug-low-stance-controls-r18e';
import { planFineGuardTracking } from '../../src/combat/directional-guard-bracing.js';
import { createArticulatedImpactBracingRuntime, planArticulatedImpactBracing } from '../../src/combat/articulated-impact-bracing.js';
import {
  analyzePredictiveInterceptParry,
  createPredictiveInterceptParryPresentationRuntime,
} from '../../src/combat/predictive-intercept-parry.js?v=g43b5r281';
import { sampleActiveShieldLeadMotion } from '../../src/combat/active-shield-lead-parry.js?v=g43b5r281';
import { createTwoActorCombatIntegration } from '../../src/combat/two-actor-combat-integration.js?v=g43b5r281';
import {
  LEGACY_TWO_ACTOR_RECOIL_HANDOFF_MODE,
  LEGACY_TWO_ACTOR_RECOIL_PASSTHROUGH_STAGE,
  publishPostCouplingRecoilStaggerHandoff,
} from '../../src/combat/post-coupling-recoil-stagger-handoff.js?v=g43b5r281';
import {
  COMMITTED_PARRY_CONTACT_GATE_STAGE,
  createCommittedParryContactGate,
  evaluateCommittedParryInput,
} from '../../src/combat/committed-parry-contact-gate.js?v=g43b5r281-step2-timing-authority-r5';
import {
  LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
  createLiveShieldSwordGripContactRuntime,
} from '../../src/combat/live-shield-sword-grip-contact-constraint.js?v=g43b5r281-top-right-forearm-r18e4';
import {
  buildLiveParryOldB3Handoff,
  sampleLiveParryOldB3ReleaseBlend,
} from '../../src/combat/live-parry-old-b3-handoff.js?v=g43b5r281-top-right-old-b3-r18e';

const LAB_STAGE = LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE;
const RECOIL_STAGE = LEGACY_TWO_ACTOR_RECOIL_PASSTHROUGH_STAGE;
const THREE = window.THREE;
if (!THREE?.WebGLRenderer || !THREE?.GLTFLoader) throw new Error(`${LAB_STAGE} requires Three.js r128 + GLTFLoader`);

const TIMING_AGE_MS = Object.freeze({ block: 260, parry: 120 });
const HUD_INTERVAL_MS = 50;
const REPORT_INTERVAL_MS = 160;
const PARRY_REVIEW_RATE = 0.12;
const PARRY_PROMPT_HOLD_MS = 1500;
const DEBUG_QUERY = new URLSearchParams(window.location.search);
const DEBUG_MODE = DEBUG_QUERY.get('debug') === '1';

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputEncoding = THREE.sRGBEncoding;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090e16);
scene.fog = new THREE.Fog(0x090e16, 8, 18);
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
camera.position.set(4.8, 2.4, 4.9);
camera.lookAt(0, 1.05, 0);
camera.updateMatrixWorld(true);
const freeCamera = createFreeInspectionCameraControls(THREE, {
  camera,
  domElement: canvas,
  target: { x: 0, y: 1.05, z: 0 },
  minimumRadius: 0.65,
  maximumRadius: 18,
});
scene.add(new THREE.HemisphereLight(0xddeaff, 0x202738, 1.25));
const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(4, 7, 3); scene.add(key);
const rim = new THREE.DirectionalLight(0x7fe2cf, 0.55); rim.position.set(-4, 3, -4); scene.add(rim);
scene.add(new THREE.GridHelper(12, 24, 0x33445f, 0x202a3b));

const attacker = createDefaultCharacter(THREE);
const defender = createDefaultCharacter(THREE);
attacker.object3d.position.set(0, 0, -1.15);
defender.object3d.position.set(0, 0, 1.15);
defender.object3d.rotation.y = Math.PI;
scene.add(attacker.object3d, defender.object3d);

const attackerSword = createDebugSword(THREE);
mountDebugSword(attacker, attackerSword, DEFAULT_KAYKIT_SWORD_MOUNT);
let defenderSword = null;
const buckler = createProceduralBuckler(THREE, {
  ...ACCEPTED_OFFHAND_BUCKLER_SHAPE_G423,
  lineMode: true,
  solidVisible: false,
});
mountOffhandBuckler(defender, buckler, ACCEPTED_OFFHAND_BUCKLER_MOUNT_G423);
buckler.setParrySurfaceVisible(true);

const liveTargetMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.027, 12, 8),
  new THREE.MeshBasicMaterial({ color: 0x54e7f5, depthTest: false }),
);
const actualSwordContactMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.022, 12, 8),
  new THREE.MeshBasicMaterial({ color: 0xffdf59, depthTest: false }),
);
const contactTravelGeometry = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(),
  new THREE.Vector3(),
]);
const contactTravelLine = new THREE.Line(
  contactTravelGeometry,
  new THREE.LineBasicMaterial({ color: 0x54e7f5, depthTest: false }),
);
liveTargetMarker.renderOrder = 20;
actualSwordContactMarker.renderOrder = 20;
contactTravelLine.renderOrder = 19;
liveTargetMarker.visible = false;
actualSwordContactMarker.visible = false;
contactTravelLine.visible = false;
scene.add(liveTargetMarker, actualSwordContactMarker, contactTravelLine);
function createInspectionLine(color) {
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, depthTest: false }));
  line.visible = false;
  line.renderOrder = 21;
  scene.add(line);
  return line;
}
const originalAttackAxisLine = createInspectionLine(0xff5964);
const currentSwordAxisLine = createInspectionLine(0x61f59a);
const currentWristGripLine = createInspectionLine(0xc58cff);

const attackRuntime = createLongswordDirectionalAttackRuntime();
const guardMachine = createGuardStateMachine();
const guardRuntime = createGuardPresentationRuntime(THREE, { machine: guardMachine, character: defender });
const bracingRuntime = createArticulatedImpactBracingRuntime(THREE, { rig: defender.rig, buckler });
const fineTrackingRuntime = createGuardThreatTrackingRuntime(THREE, { rig: defender.rig, buckler });
const residualBodyReachRuntime = createGuardResidualBodyReachRuntime(THREE, { rig: defender.rig, buckler });
const residualStanceReachRuntime = createGuardResidualStanceReachRuntime(THREE, { rig: defender.rig, buckler });
const predictivePresentation = createPredictiveInterceptParryPresentationRuntime(THREE, { character: defender });
const parryGate = createCommittedParryContactGate();
function sampleOriginalContactPose(interruption) {
  attacker.sampleAnimation(interruption.clipId, interruption.sourceTimeSeconds, {
    loop: false,
    inPlace: interruption.inPlace !== false,
    rootRotationPolicy: interruption.rootRotationPolicy,
  });
  attacker.update(0, camera);
  if (step3AReleaseBlend) {
    const releaseSample = sampleLiveParryOldB3ReleaseBlend(
      step3AReleaseBlend.elapsedMs,
      step3AReleaseBlend.durationMs,
    );
    swordGripConstraint.applyHeldPose(releaseSample.contactPoseWeight);
    step3AReleaseBlend.sample = releaseSample;
  }
}

const combat = createTwoActorCombatIntegration({
  THREE,
  attackerCharacter: attacker,
  attackRuntime,
  guardMachine,
  parrySync: {
    presentationOffsetSeconds: 0.205,
    parryAttackerRecoilDelayMs: 0,
  },
  sampleFrozenContactPose(interruption) {
    sampleOriginalContactPose(interruption);
  },
});
const swordGripConstraint = createLiveShieldSwordGripContactRuntime(THREE, {
  attackerRig: attacker.rig,
  attackerSword,
});

const hudAttack = document.getElementById('hudAttack');
const hudInput = document.getElementById('hudInput');
const parryCue = document.getElementById('parryCue');
const parryCueMain = document.getElementById('parryCueMain');
const parryCueDetail = document.getElementById('parryCueDetail');
const hudContact = document.getElementById('hudContact');
const hudCoupling = document.getElementById('hudCoupling');
const hudShield = document.getElementById('hudShield');
const hudWeapon = document.getElementById('hudWeapon');
const hudSeparation = document.getElementById('hudSeparation');
const hudLineClearance = document.getElementById('hudLineClearance');
const hudRecoil = document.getElementById('hudRecoil');
const hudDiagnostic = document.getElementById('hudDiagnostic');
const status = document.getElementById('status');
const reportNode = document.getElementById('report');
const autoRepeat = document.getElementById('autoRepeat');
const slowReview = document.getElementById('slowReview');
const showSurface = document.getElementById('showSurface');
const forceOldB3Button = document.getElementById('forceOldB3');
const parryNowButton = document.getElementById('parryNow');
const retryAttackButton = document.getElementById('retryAttack');
const stanceDebugPanel = document.getElementById('stanceDebugPanel');
const debugProfileSummary = document.getElementById('debugProfileSummary');
const debugApplyRetryButton = document.getElementById('debugApplyRetry');
const debugResetDefaultsButton = document.getElementById('debugResetDefaults');
const DEBUG_STANCE_CONTROLS = Object.freeze([
  Object.freeze({ id: 'debugLeadMs', query: 'leadMs', profileKey: 'anticipatoryLeadMaxSeconds', scale: 0.001, defaultValue: GUARD_RESIDUAL_STANCE_REACH_PROFILE.anticipatoryLeadMaxSeconds * 1000, precision: 0, unit: 'ms' }),
  Object.freeze({ id: 'debugMaxCrouchCm', query: 'crouchCm', profileKey: 'maxCrouchMeters', scale: 0.01, defaultValue: GUARD_RESIDUAL_STANCE_REACH_PROFILE.maxCrouchMeters * 100, precision: 1, unit: 'cm' }),
  Object.freeze({ id: 'debugCrouchSpeed', query: 'crouchSpeed', profileKey: 'crouchSpeedMps', scale: 1, defaultValue: GUARD_RESIDUAL_STANCE_REACH_PROFILE.crouchSpeedMps, precision: 2, unit: 'm/s' }),
  Object.freeze({ id: 'debugEdgeCm', query: 'edgeCm', profileKey: 'edgeActivationMeters', scale: 0.01, defaultValue: GUARD_RESIDUAL_STANCE_REACH_PROFILE.edgeActivationMeters * 100, precision: 1, unit: 'cm' }),
  Object.freeze({ id: 'debugPlaneCm', query: 'planeCm', profileKey: 'kneeThreatPlaneMeters', scale: 0.01, defaultValue: GUARD_RESIDUAL_STANCE_REACH_PROFILE.kneeThreatPlaneMeters * 100, precision: 1, unit: 'cm' }),
  Object.freeze({ id: 'debugLowGapCm', query: 'lowGapCm', profileKey: 'lowGapVerticalActivationMeters', scale: 0.01, defaultValue: GUARD_RESIDUAL_STANCE_REACH_PROFILE.lowGapVerticalActivationMeters * 100, precision: 1, unit: 'cm' }),
  Object.freeze({ id: 'debugDownRatio', query: 'downRatio', profileKey: 'kneeThreatDownRatio', scale: 1, defaultValue: GUARD_RESIDUAL_STANCE_REACH_PROFILE.kneeThreatDownRatio, precision: 2, unit: '' }),
  Object.freeze({ id: 'debugKneeBandCm', query: 'kneeBandCm', profileKey: 'kneeLineBandMeters', scale: 0.01, defaultValue: GUARD_RESIDUAL_STANCE_REACH_PROFILE.kneeLineBandMeters * 100, precision: 0, unit: 'cm' }),
  Object.freeze({ id: 'debugArmAttemptCm', query: 'armAttemptCm', profileKey: 'armAttemptActivationMeters', scale: 0.01, defaultValue: GUARD_RESIDUAL_STANCE_REACH_PROFILE.armAttemptActivationMeters * 100, precision: 1, unit: 'cm' }),
]);
const debugStanceProfile = {};

function clampDebugControl(input, value) {
  return Math.max(Number(input.min), Math.min(Number(input.max), Number(value)));
}
function refreshDebugStanceProfile(syncUrl = true) {
  if (!DEBUG_MODE) return;
  const url = new URL(window.location.href);
  for (const spec of DEBUG_STANCE_CONTROLS) {
    const input = document.getElementById(spec.id);
    const value = clampDebugControl(input, input.value);
    input.value = String(value);
    debugStanceProfile[spec.profileKey] = value * spec.scale;
    document.getElementById(`${spec.id}Value`).textContent = `${value.toFixed(spec.precision)}${spec.unit}`;
    if (syncUrl) url.searchParams.set(spec.query, String(value));
  }
  if (syncUrl) window.history.replaceState(null, '', url);
  debugProfileSummary.textContent = `ACTIVE · lead ${Math.round(debugStanceProfile.anticipatoryLeadMaxSeconds * 1000)}ms · crouch ${(debugStanceProfile.maxCrouchMeters * 100).toFixed(1)}cm @ ${debugStanceProfile.crouchSpeedMps.toFixed(2)}m/s · edge ${(debugStanceProfile.edgeActivationMeters * 100).toFixed(1)}cm · plane ${(debugStanceProfile.kneeThreatPlaneMeters * 100).toFixed(1)}cm · lowgap ${(debugStanceProfile.lowGapVerticalActivationMeters * 100).toFixed(1)}cm · down ${debugStanceProfile.kneeThreatDownRatio.toFixed(2)} · knee ±${(debugStanceProfile.kneeLineBandMeters * 100).toFixed(0)}cm · arm gate ${(debugStanceProfile.armAttemptActivationMeters * 100).toFixed(1)}cm`;
}
function initializeDebugStanceControls() {
  stanceDebugPanel.hidden = !DEBUG_MODE;
  document.documentElement.dataset.debugMode = DEBUG_MODE ? 'on' : 'off';
  if (!DEBUG_MODE) return;
  for (const spec of DEBUG_STANCE_CONTROLS) {
    const input = document.getElementById(spec.id);
    const rawQueryValue = DEBUG_QUERY.get(spec.query);
    const queryValue = rawQueryValue == null || rawQueryValue.trim() === ''
      ? Number.NaN
      : Number(rawQueryValue);
    input.value = String(Number.isFinite(queryValue)
      ? clampDebugControl(input, queryValue)
      : spec.defaultValue);
    input.addEventListener('input', () => refreshDebugStanceProfile(true));
  }
  refreshDebugStanceProfile(false);
}
function resetDebugStanceDefaults() {
  for (const spec of DEBUG_STANCE_CONTROLS) {
    document.getElementById(spec.id).value = String(spec.defaultValue);
  }
  refreshDebugStanceProfile(true);
}
initializeDebugStanceControls();

let ready = false;
let selectedDirection = 'right';
let selectedMode = 'parry';
let lastTimestamp = performance.now();
let attackerIdleDuration = 1;
let attackerIdleClockSeconds = 0;
let attackerRecovery = null;
let repeatCooldownMs = 0;
let previousBlade = null;
let previousShieldLeadSurface = null;
let firstContact = null;
let latestContact = null;
let latestCombatResult = null;
let latestCombatUpdate = null;
let latestFinePlan = null;
let latestFineTracking = null;
let latestPredictiveAnalysis = null;
let latestReachableInterceptTarget = null;
let latestInterceptDriveReport = null;
let interceptDriveTrace = [];
let latestPredictiveReport = null;
let latestPredictiveHandoff = null;
let latestShieldLeadMotion = null;
let latestLeadHandoff = null;
let directOldB3Diagnostic = null;
let latestParryInput = null;
let latestParryOpportunity = null;
let latestParryConfirmation = null;
let step3AContactTransfer = null;
let latestGripConstraintReport = null;
let latestLiveSurfaceAtContact = null;
let step3AReleaseBlend = null;
let latestParryWhiff = null;
let whiffProbeFrames = 0;
let closestWhiffApproach = null;
let outsideActiveContact = null;
let latestInputSignal = null;
let parryKeyDownObserved = false;
let parryPromptHold = null;
let parryPromptHoldSequence = null;
let hudClockMs = HUD_INTERVAL_MS;
let reportClockMs = REPORT_INTERVAL_MS;

const bladeNodes = [attackerSword.bladeBase, attackerSword.bladeMid, attackerSword.tip];
const bladeScratch = bladeNodes.map(() => new THREE.Vector3());
const bladeBuffers = [0, 1].map(() => bladeNodes.map(() => ({ x: 0, y: 0, z: 0 })));
let bladeBufferIndex = 0;

function captureBladePolyline() {
  attackerSword.object3d.updateMatrixWorld(true);
  const buffer = bladeBuffers[bladeBufferIndex];
  bladeBufferIndex = 1 - bladeBufferIndex;
  for (let i = 0; i < bladeNodes.length; i += 1) {
    bladeNodes[i].getWorldPosition(bladeScratch[i]);
    buffer[i].x = bladeScratch[i].x;
    buffer[i].y = bladeScratch[i].y;
    buffer[i].z = bladeScratch[i].z;
  }
  return buffer;
}

function cloneSurface(surface = {}) {
  return {
    center: {
      x: Number(surface.center?.x) || 0,
      y: Number(surface.center?.y) || 0,
      z: Number(surface.center?.z) || 0,
    },
    normal: {
      x: Number(surface.normal?.x) || 0,
      y: Number(surface.normal?.y) || 0,
      z: Number(surface.normal?.z) || -1,
    },
    radius: Number(surface.radius) || 0,
    thickness: Number(surface.thickness) || 0,
  };
}

function magnitude(v) {
  return v ? Math.hypot(Number(v.x) || 0, Number(v.y) || 0, Number(v.z) || 0) : 0;
}

function setInspectionLine(line, start, end) {
  const positions = line.geometry.attributes.position;
  positions.setXYZ(0, start.x, start.y, start.z);
  positions.setXYZ(1, end.x, end.y, end.z);
  positions.needsUpdate = true;
  line.geometry.computeBoundingSphere();
}

function updateLiveContactMarkers(report) {
  const target = report?.targetContactPoint;
  const actual = report?.actualContactPoint;
  const origin = report?.plan?.contactPoint;
  const visible = Boolean(target && actual && origin);
  const lineVisible = Boolean(report?.initialSwordBasePoint && report?.initialSwordTipPoint
    && report?.currentSwordBasePoint && report?.currentSwordTipPoint
    && report?.actualWristPoint && report?.actualGripPoint);
  liveTargetMarker.visible = visible;
  actualSwordContactMarker.visible = visible;
  contactTravelLine.visible = visible;
  originalAttackAxisLine.visible = lineVisible;
  currentSwordAxisLine.visible = lineVisible;
  currentWristGripLine.visible = lineVisible;
  if (visible) {
    liveTargetMarker.position.set(target.x, target.y, target.z);
    actualSwordContactMarker.position.set(actual.x, actual.y, actual.z);
    const positions = contactTravelGeometry.attributes.position;
    positions.setXYZ(0, origin.x, origin.y, origin.z);
    positions.setXYZ(1, target.x, target.y, target.z);
    positions.needsUpdate = true;
    contactTravelGeometry.computeBoundingSphere();
  }
  if (!lineVisible) return;
  setInspectionLine(originalAttackAxisLine, report.initialSwordBasePoint, report.initialSwordTipPoint);
  setInspectionLine(currentSwordAxisLine, report.currentSwordBasePoint, report.currentSwordTipPoint);
  setInspectionLine(currentWristGripLine, report.actualWristPoint, report.actualGripPoint);
  currentSwordAxisLine.material.color.setHex(report.attackLineClearance?.pass ? 0x61f59a : 0xffad55);
}

function resize() {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
function setView(view) {
  const position = view === 'side'
    ? { x: 5.8, y: 1.7, z: 0.1 }
    : view === 'contact'
      ? { x: 2.25, y: 1.5, z: 2.2 }
      : { x: 4.8, y: 2.4, z: 4.9 };
  freeCamera.setPose(position, { x: 0, y: 1.05, z: 0 });
}
function enterGuard() {
  guardMachine.send(GUARD_EVENTS.RESET, { stage: LAB_STAGE }); guardRuntime.sync(camera);
  guardMachine.send(GUARD_EVENTS.GUARD_PRESS, { stage: LAB_STAGE }); guardRuntime.sync(camera);
  const report = guardRuntime.update(180, camera);
  if (report.snapshot.state !== GUARD_STATES.HOLD) throw new Error(`Expected Guard Hold, got ${report.snapshot.state}`);
}
function beginAttackRecovery(direction) {
  const sourcePose = captureRigPose(attacker.rig);
  attacker.sampleAnimation('UAL1/Sword_Idle', 0, { loop: true, inPlace: true, rootRotationPolicy: 'lock' });
  attacker.update(0, camera);
  const targetPose = captureRigPose(attacker.rig);
  applyRigPose(attacker.rig, sourcePose);
  attacker.update(0, camera);
  attackerRecovery = { direction, elapsedMs: 0, sourcePose, targetPose };
  attackerIdleClockSeconds = 0;
}
function sampleAttackerBase(snapshot, deltaMs) {
  if (snapshot.action) {
    const profile = snapshot.action.runtime;
    attacker.sampleAnimation(profile.clipId, Math.min(profile.durationSeconds, snapshot.elapsedSeconds), { loop: false, inPlace: true, rootRotationPolicy: 'lock' });
    attacker.update(0, camera);
    return;
  }
  if (attackerRecovery) {
    attackerRecovery.elapsedMs += deltaMs;
    const recovery = sampleLongswordAttackRecovery(attackerRecovery.direction, attackerRecovery.elapsedMs);
    applyRigPose(attacker.rig, blendRecoveryPose(
      attackerRecovery.sourcePose,
      attackerRecovery.sourcePose,
      attackerRecovery.targetPose,
      recovery.progress,
      { durationMs: recovery.profile.attackRecoveryDurationMs, sampleDeltaMs: 0, momentumScale: 0 },
    ));
    attacker.update(0, camera);
    if (recovery.complete) attackerRecovery = null;
    return;
  }
  attackerIdleClockSeconds += deltaMs / 1000;
  attacker.sampleAnimation('UAL1/Sword_Idle', attackerIdleClockSeconds % Math.max(0.001, attackerIdleDuration), { loop: true, inPlace: true, rootRotationPolicy: 'lock' });
  attacker.update(0, camera);
}
function resetExchange() {
  parryGate.reset();
  swordGripConstraint.reset();
  bracingRuntime.resetImpact();
  fineTrackingRuntime.reset();
  residualBodyReachRuntime.reset();
  residualStanceReachRuntime.reset();
  predictivePresentation.reset();
  firstContact = null;
  latestContact = null;
  latestCombatResult = null;
  latestCombatUpdate = null;
  latestFinePlan = null;
  latestFineTracking = null;
  latestPredictiveAnalysis = null;
  latestReachableInterceptTarget = null;
  latestInterceptDriveReport = null;
  interceptDriveTrace = [];
  latestPredictiveReport = null;
  latestPredictiveHandoff = null;
  latestShieldLeadMotion = null;
  latestLeadHandoff = null;
  directOldB3Diagnostic = null;
  latestParryInput = null;
  latestParryOpportunity = null;
  latestParryConfirmation = null;
  step3AContactTransfer = null;
  latestGripConstraintReport = null;
  latestLiveSurfaceAtContact = null;
  step3AReleaseBlend = null;
  updateLiveContactMarkers(null);
  latestParryWhiff = null;
  whiffProbeFrames = 0;
  closestWhiffApproach = null;
  outsideActiveContact = null;
  latestInputSignal = null;
  parryPromptHold = null;
  parryPromptHoldSequence = null;
  previousShieldLeadSurface = cloneSurface(buckler.getWorldParrySurface());
}

function diagnosticIncomingVelocity(direction) {
  if (direction === 'left') return Object.freeze({ x: -4.8, y: -0.4, z: 2.0 });
  if (direction === 'top') return Object.freeze({ x: 0.2, y: -6.4, z: 0.6 });
  return Object.freeze({ x: 4.8, y: -0.4, z: 2.0 });
}

function diagnosticCouplingReport(direction) {
  const lateral = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  return Object.freeze({
    outcome: 'parry',
    elapsedMs: 96,
    complete: true,
    releaseAttackerRecoil: true,
    recoilHandoffMode: LEGACY_TWO_ACTOR_RECOIL_HANDOFF_MODE,
    shieldOffset: Object.freeze({ x: lateral * 0.105, y: direction === 'top' ? 0.105 : 0.028, z: 0.012 }),
    attackerWeaponOffset: Object.freeze({ x: lateral * 0.092, y: direction === 'top' ? 0.092 : 0.025, z: 0.011 }),
    profile: Object.freeze({ durationMs: 96, recoilHandoffMode: LEGACY_TWO_ACTOR_RECOIL_HANDOFF_MODE }),
    authority: 'step1-direct-old-b3-diagnostic-no-coupling-runtime',
  });
}

function step3AOwnsLiveContact() {
  return Boolean(
    step3AContactTransfer?.accepted
    && latestParryConfirmation?.accepted
    && step3AContactTransfer.releasedToOldB3 !== true,
  );
}

function releaseLiveContactToOldB3() {
  if (!step3AOwnsLiveContact()) {
    return Object.freeze({ accepted: false, reason: 'live-contact-no-longer-owns-presentation' });
  }
  const handoff = buildLiveParryOldB3Handoff({
    attackDirection: selectedDirection,
    contactReport: latestGripConstraintReport,
    surfaceAtContact: latestLiveSurfaceAtContact,
  });
  if (!handoff.accepted) return handoff;

  const handoffPublished = publishPostCouplingRecoilStaggerHandoff(attacker.rig, {
    couplingReport: handoff.couplingReport,
    surfaceAtContact: handoff.surfaceAtContact,
  });
  if (!handoffPublished) {
    return Object.freeze({ ...handoff, accepted: false, reason: 'old-b3-handoff-publish-failed' });
  }

  step3AReleaseBlend = {
    elapsedMs: 0,
    durationMs: handoff.releaseBlendMs,
    sample: sampleLiveParryOldB3ReleaseBlend(0, handoff.releaseBlendMs),
  };
  step3AContactTransfer = Object.freeze({
    ...step3AContactTransfer,
    releasedToOldB3: true,
    releaseHandoff: handoff,
    handoffPublished: true,
    b3ClockFrozen: false,
  });
  return Object.freeze({ ...handoff, handoffPublished: true });
}


function triggerParryNow(source = 'button') {
  if (!ready) {
    latestParryInput = Object.freeze({ accepted: false, reason: 'lab-not-ready', source });
    status.textContent = 'PARRY INPUT REJECTED · lab-not-ready';
    status.className = 'bad';
    return latestParryInput;
  }
  if (selectedMode !== 'parry') {
    latestParryInput = Object.freeze({ accepted: false, reason: 'select-parry-mode-first', source });
    status.textContent = 'PARRY INPUT REJECTED · select-parry-mode-first';
    status.className = 'bad';
    return latestParryInput;
  }

  const snapshot = attackRuntime.snapshot;
  latestParryInput = parryGate.arm({
    attackSnapshot: snapshot,
    predictiveAnalysis: latestPredictiveAnalysis,
    manual: true,
    source,
  });

  if (latestParryInput.accepted) {
    whiffProbeFrames = 0;
    closestWhiffApproach = null;
    outsideActiveContact = null;
    latestReachableInterceptTarget = null;
    latestInterceptDriveReport = null;
    interceptDriveTrace = [];
    predictivePresentation.start({
      sequence: snapshot.sequence,
      requestedGrade: 'parry',
      triggerTtcSeconds: latestParryInput.timeToContactSeconds,
    });
    const trackingDistance = latestParryInput.requiredShieldTravelMeters == null
      ? 'path pending'
      : `${(latestParryInput.requiredShieldTravelMeters * 100).toFixed(1)}cm${latestParryInput.gates.trackingClamped ? ' → CLAMP 18cm' : ''}`;
    status.textContent = `PARRY ARMED · TTC ${(latestParryInput.timeToContactSeconds * 1000).toFixed(0)}ms · tracking ${trackingDistance} · waiting for real Sword × Shield contact`;
    status.className = 'good';
  } else {
    status.textContent = `PARRY REJECTED · ${latestParryInput.reason}`;
    status.className = 'bad';
  }
  buildReport();
  return latestParryInput;
}

function dispatchParryInput(source, event = null) {
  latestInputSignal = Object.freeze({
    source,
    code: event?.code || null,
    key: event?.key || null,
    sequence: attackRuntime.snapshot.sequence,
    elapsedSeconds: attackRuntime.snapshot.elapsedSeconds,
  });
  parryNowButton.classList.add('input-flash');
  setTimeout(() => parryNowButton.classList.remove('input-flash'), 180);
  const result = triggerParryNow(source);
  parryPromptHold = null;
  hudInput.textContent = `INPUT RECEIVED: ${source.toUpperCase()} · ${result.accepted ? 'ARMED' : `REJECTED · ${result.reason}`}`;
  updateParryCue(attackRuntime.snapshot);
  return result;
}

function isParryKey(event) {
  return event?.code === 'KeyF'
    || String(event?.key || '').toLowerCase() === 'f'
    || event?.keyCode === 70;
}

function handleParryKeyDown(event) {
  if (!isParryKey(event) || event.repeat) return;
  parryKeyDownObserved = true;
  event.preventDefault();
  event.stopPropagation();
  dispatchParryInput('keyboard-f', event);
}

function handleParryKeyUp(event) {
  if (!isParryKey(event)) return;
  event.preventDefault();
  event.stopPropagation();
  if (!parryKeyDownObserved) dispatchParryInput('keyboard-f-keyup-fallback', event);
  parryKeyDownObserved = false;
}
function forceOldTwoActorB3(direction = selectedDirection) {
  if (!ready) return Object.freeze({ accepted: false, reason: 'lab-not-ready' });
  autoRepeat.checked = false;
  combat.reset();
  attackerRecovery = null;
  enterGuard();
  selectedDirection = direction;
  resetExchange();

  const started = combat.startAttack(direction);
  if (!started.accepted) return Object.freeze({ accepted: false, reason: started.reason || 'diagnostic-attack-start-rejected' });
  const attackProfile = attackRuntime.snapshot.action?.runtime;
  attackRuntime.update((attackProfile?.activeStartSeconds || 0) * 1000 + 1);
  const activeSnapshot = attackRuntime.snapshot;
  sampleAttackerBase(activeSnapshot, 0);
  attackerSword.update();

  const contactPoint = new THREE.Vector3();
  attackerSword.bladeMid.getWorldPosition(contactPoint);
  latestContact = Object.freeze({
    contact: true,
    geometricContact: true,
    eligible: true,
    point: Object.freeze({ x: contactPoint.x, y: contactPoint.y, z: contactPoint.z }),
    incomingVelocity: diagnosticIncomingVelocity(direction),
    radialDistance: 0.08,
    bladeFraction: 0.5,
    sweepAlpha: 0.5,
    authority: 'step1-synthetic-authoritative-contact-for-old-b3-only',
  });
  firstContact = latestContact;
  latestCombatResult = combat.resolveContact({ contact: latestContact, guardIntentAgeMs: TIMING_AGE_MS.parry });
  if (!latestCombatResult.accepted) {
    directOldB3Diagnostic = Object.freeze({ accepted: false, reason: latestCombatResult.reason || 'diagnostic-contact-rejected' });
    return directOldB3Diagnostic;
  }
  guardRuntime.sync(camera);

  const handoffPublished = publishPostCouplingRecoilStaggerHandoff(attacker.rig, {
    couplingReport: diagnosticCouplingReport(direction),
    surfaceAtContact: buckler.getWorldParrySurface(),
  });
  latestCombatUpdate = combat.update(0.021, { camera });
  const handoff = combat.snapshot.attackerRecoil?.postCouplingHandoff || null;
  directOldB3Diagnostic = Object.freeze({
    accepted: handoffPublished && handoff?.accepted === true,
    direction,
    parryTimingBypassed: true,
    predictiveShieldLeadBypassed: true,
    shieldContactBypassed: true,
    couplingRuntimeBypassed: true,
    releaseBridgeBypassed: true,
    handoffPublished,
    handoffStage: handoff?.stage || null,
    handoffAccepted: handoff?.accepted === true,
    authority: 'direct-existing-old-two-actor-b3-diagnostic',
  });
  status.textContent = directOldB3Diagnostic.accepted
    ? 'STEP 1 ACTIVE · OLD Two-Actor B3 direct · all Parry/collision stages bypassed'
    : `STEP 1 FAIL · ${handoff?.reason || 'legacy handoff was not accepted'}`;
  status.className = directOldB3Diagnostic.accepted ? 'good' : 'bad';
  attacker.update(0, camera);
  attackerSword.update();
  buildReport();
  return directOldB3Diagnostic;
}

function startAttack(direction = selectedDirection) {
  if (!ready || combat.active || attackRuntime.active || attackerRecovery) return false;
  if (guardMachine.state !== GUARD_STATES.HOLD) enterGuard();
  selectedDirection = direction;
  resetExchange();
  previousBlade = captureBladePolyline();
  repeatCooldownMs = 0;
  const started = combat.startAttack(direction);
  if (!started.accepted) return false;
  status.textContent = `ATTACK ${direction.toUpperCase()} · wait for committed YES, then press PARRY NOW or F`;
  status.className = 'warn';
  document.querySelectorAll('[data-attack]').forEach((button) => button.classList.toggle('active', button.dataset.attack === direction));
  return true;
}
function restartAttack(direction = selectedDirection) {
  if (!ready) {
    status.textContent = 'RETRY REJECTED · lab-not-ready';
    status.className = 'bad';
    return false;
  }
  combat.reset();
  attackerRecovery = null;
  enterGuard();
  const started = startAttack(direction);
  if (started) {
    hudInput.textContent = 'NEW ATTACK · input available · wait for PARRY NOW prompt';
    updateParryCue(attackRuntime.snapshot);
  }
  return started;
}
function setMode(mode) {
  if (!['block', 'parry'].includes(mode)) return;
  selectedMode = mode;
  if (mode !== 'parry') {
    parryPromptHold = null;
    residualBodyReachRuntime.reset();
    residualStanceReachRuntime.reset();
  }
  document.querySelectorAll('[data-mode]').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
}
function requestedOutcome() { return selectedMode; }
function zeroBracePlan() { return planArticulatedImpactBracing({ mode: 'off' }); }
function isParryPreContactReviewActive(snapshot = attackRuntime.snapshot) {
  const contactSeconds = snapshot?.action?.runtime?.contactSeconds;
  return selectedMode === 'parry'
    && slowReview.checked
    && !firstContact
    && Number.isFinite(contactSeconds)
    && snapshot.elapsedSeconds < contactSeconds;
}

function updateBlockPreContact(snapshot, currentBlade, deltaSeconds) {
  const baselineSurface = buckler.getWorldParrySurface();
  const bracePlan = previousBlade && snapshot.phase !== LONGSWORD_ATTACK_PHASES.INTERRUPTED
    ? planArticulatedImpactBracing({
        mode: 'brace-fine', attackDirection: snapshot.direction,
        previousBlade, currentBlade, bucklerSurface: baselineSurface, deltaSeconds,
      })
    : zeroBracePlan();
  bracingRuntime.update(bracePlan, deltaSeconds);
  const postBraceSurface = buckler.getWorldParrySurface();
  latestFinePlan = planFineGuardTracking({
    threat: bracePlan?.analysis?.threat || null,
    bucklerSurface: postBraceSurface,
    maxCorrectionMeters: bracePlan?.fineTrackMaxMeters || 0,
  });
  latestFineTracking = fineTrackingRuntime.update(latestFinePlan, deltaSeconds);
  defender.update(0, camera); defenderSword?.update();
  previousShieldLeadSurface = cloneSurface(buckler.getWorldParrySurface());
}

function updateParryPreContact(snapshot, currentBlade, deltaSeconds) {
  if (parryPromptHold?.sequence === snapshot.sequence && !parryGate.attempt) {
    latestPredictiveAnalysis = parryPromptHold.predictiveAnalysis;
    latestParryOpportunity = parryPromptHold.opportunity;
    previousShieldLeadSurface = cloneSurface(buckler.getWorldParrySurface());
    return;
  }
  const beforeSurface = cloneSurface(buckler.getWorldParrySurface());
  latestPredictiveAnalysis = analyzePredictiveInterceptParry({
    attackSnapshot: snapshot,
    previousBlade,
    currentBlade,
    bucklerSurface: beforeSurface,
    deltaSeconds,
    requestedGrade: selectedMode,
  });
  latestParryOpportunity = evaluateCommittedParryInput({
    attackSnapshot: snapshot,
    predictiveAnalysis: latestPredictiveAnalysis,
    manual: false,
    profile: parryGate.profile,
  });
  if (slowReview.checked
    && latestParryOpportunity.accepted
    && parryPromptHoldSequence !== snapshot.sequence) {
    parryPromptHoldSequence = snapshot.sequence;
    parryPromptHold = {
      sequence: snapshot.sequence,
      remainingRealMs: PARRY_PROMPT_HOLD_MS,
      opportunity: latestParryOpportunity,
      predictiveAnalysis: latestPredictiveAnalysis,
    };
  }

  if (predictivePresentation.active) {
    latestPredictiveReport = predictivePresentation.update({
      deltaSeconds,
      timeToContactSeconds: latestPredictiveAnalysis?.timeToContactSeconds,
      camera,
    });
    const predictiveSurface = cloneSurface(buckler.getWorldParrySurface());
    const continuitySurface = previousShieldLeadSurface
      ? cloneSurface(previousShieldLeadSurface)
      : predictiveSurface;
    const measuredClosestApproach = measureSweptSwordBucklerClosestApproach({
      previousBlade,
      currentBlade,
      bucklerSurface: continuitySurface,
    });
    latestReachableInterceptTarget = selectReachableParryInterceptTarget({
      predictedThreat: latestPredictiveAnalysis?.threat,
      predictedTrackingPlan: latestPredictiveAnalysis?.trackingPlan,
      closestApproach: measuredClosestApproach,
      bucklerSurface: continuitySurface,
    });
    latestFinePlan = latestReachableInterceptTarget?.fallbackApplied
      ? latestReachableInterceptTarget.trackingPlan
      : latestReachableInterceptTarget?.threat
        ? planGuardThreatCorrection({
            mode: 'parry',
            threat: latestReachableInterceptTarget.threat,
            bucklerSurface: predictiveSurface,
          })
        : null;
    const trackingSurfaceBefore = cloneSurface(buckler.getWorldParrySurface());
    latestFineTracking = fineTrackingRuntime.update(latestFinePlan, deltaSeconds);
    const residualCarryBeforeMeters = magnitude(latestFineTracking?.carriedResidualOffset);
    defender.update(0, camera); defenderSword?.update();
    const primaryTrackingSurfaceAfter = cloneSurface(buckler.getWorldParrySurface());
    const residualBeforeRefinement = measureSweptSwordBucklerClosestApproach({
      previousBlade,
      currentBlade,
      bucklerSurface: primaryTrackingSurfaceAfter,
    });
    const residualNeedsRefinement = residualBeforeRefinement.radialGapMeters > 1e-5
      || residualBeforeRefinement.planeGapMeters > 1e-5;
    const residualInterceptTarget = residualNeedsRefinement
      ? selectReachableParryInterceptTarget({
          predictedThreat: null,
          predictedTrackingPlan: null,
          closestApproach: residualBeforeRefinement,
          bucklerSurface: primaryTrackingSurfaceAfter,
        })
      : null;
    const residualTrackingPlan = residualInterceptTarget?.fallbackApplied
      ? residualInterceptTarget.trackingPlan
      : null;
    const residualRefinement = residualTrackingPlan?.appliedDistance > 1e-6
      ? fineTrackingRuntime.refineMeasuredContact(residualTrackingPlan, deltaSeconds, {
          speedScale: 1,
          jointBudgetScale: 0.35,
          maxResidualMeters: 0.06,
          iterations: 2,
        })
      : null;
    if (residualRefinement) {
      defender.update(0, camera); defenderSword?.update();
    }
    const residualAfterArmRefinement = measureSweptSwordBucklerClosestApproach({
      previousBlade,
      currentBlade,
      bucklerSurface: cloneSurface(buckler.getWorldParrySurface()),
    });
    const residualBodyReach = residualBodyReachRuntime.update({
      mode: 'parry',
      closestApproach: residualAfterArmRefinement,
    }, deltaSeconds);
    if (residualBodyReach.active) {
      defender.update(0, camera); defenderSword?.update();
    }
    const residualAfterBodyReach = measureSweptSwordBucklerClosestApproach({
      previousBlade,
      currentBlade,
      bucklerSurface: cloneSurface(buckler.getWorldParrySurface()),
    });
    const residualStanceReach = residualStanceReachRuntime.update({
      mode: 'parry',
      profile: DEBUG_MODE ? debugStanceProfile : null,
      closestApproach: residualAfterBodyReach,
      anticipatedClosestApproach: latestPredictiveAnalysis?.threat?.worldPoint
        ? { point: latestPredictiveAnalysis.threat.worldPoint }
        : null,
      anticipatedLeadSeconds: latestPredictiveAnalysis?.threat?.futureSeconds ?? null,
      armEvidence: {
        extensionRatio: residualBodyReach.armExtensionRatio ?? 0,
        correctionAttemptedMeters: residualTrackingPlan?.appliedDistance ?? 0,
        correctionAchievedMeters: residualRefinement?.achievedDistance ?? 0,
        edgeGapBeforeMeters: residualBeforeRefinement.radialGapMeters,
        edgeGapAfterMeters: residualAfterArmRefinement.radialGapMeters,
      },
    }, deltaSeconds);
    if (residualStanceReach.active) {
      defender.update(0, camera); defenderSword?.update();
    }
    const trackingSurfaceAfter = cloneSurface(buckler.getWorldParrySurface());
    const residualAfterRefinement = measureSweptSwordBucklerClosestApproach({
      previousBlade,
      currentBlade,
      bucklerSurface: trackingSurfaceAfter,
    });
    const shieldStepVector = Object.freeze({
      x: trackingSurfaceAfter.center.x - trackingSurfaceBefore.center.x,
      y: trackingSurfaceAfter.center.y - trackingSurfaceBefore.center.y,
      z: trackingSurfaceAfter.center.z - trackingSurfaceBefore.center.z,
    });
    const shieldStepTranslationMeters = magnitude(shieldStepVector);
    const plannedCorrectionVector = latestFinePlan?.correction || null;
    const plannedCorrectionMeters = magnitude(plannedCorrectionVector);
    const correctionDirectionDot = plannedCorrectionMeters > 1e-6 && shieldStepTranslationMeters > 1e-6
      ? (plannedCorrectionVector.x * shieldStepVector.x
        + plannedCorrectionVector.y * shieldStepVector.y
        + plannedCorrectionVector.z * shieldStepVector.z)
        / (plannedCorrectionMeters * shieldStepTranslationMeters)
      : null;
    const residualEdgeReductionMeters = residualBeforeRefinement.radialGapMeters
      - residualAfterRefinement.radialGapMeters;
    const residualPlaneReductionMeters = residualBeforeRefinement.planeGapMeters
      - residualAfterRefinement.planeGapMeters;
    const bodyEdgeReductionMeters = residualAfterArmRefinement.radialGapMeters
      - residualAfterBodyReach.radialGapMeters;
    const bodyPlaneReductionMeters = residualAfterArmRefinement.planeGapMeters
      - residualAfterBodyReach.planeGapMeters;
    const stanceEdgeReductionMeters = residualAfterBodyReach.radialGapMeters
      - residualAfterRefinement.radialGapMeters;
    const stancePlaneReductionMeters = residualAfterBodyReach.planeGapMeters
      - residualAfterRefinement.planeGapMeters;
    latestInterceptDriveReport = Object.freeze({
      attackPhase: snapshot.phase,
      elapsedSeconds: snapshot.elapsedSeconds,
      timeToContactSeconds: latestPredictiveAnalysis?.timeToContactSeconds ?? null,
      presentationActive: true,
      selectorBaseline: 'previous-frame-post-tracking-world-shield-surface',
      selectionSource: latestReachableInterceptTarget?.source ?? 'none',
      drivePlanSource: latestReachableInterceptTarget?.fallbackApplied
        ? 'surface-relative-measured-contact-correction'
        : 'current-presentation-linear-contact-correction',
      fallbackApplied: latestReachableInterceptTarget?.fallbackApplied === true,
      predictedReachable: latestReachableInterceptTarget?.predictedReachable ?? null,
      measuredReachable: latestReachableInterceptTarget?.measuredReachable ?? null,
      measuredInsideAcquisitionBand: latestReachableInterceptTarget?.measuredInsideAcquisitionBand ?? null,
      predictedRequiredDistanceMeters: latestReachableInterceptTarget?.predictedRequiredDistanceMeters ?? null,
      measuredRequiredDistanceMeters: latestReachableInterceptTarget?.measuredRequiredDistanceMeters ?? null,
      measuredRadialContactCorrectionMeters: latestReachableInterceptTarget?.measuredRadialContactCorrectionMeters ?? null,
      measuredContactCorrectionMeters: latestReachableInterceptTarget?.measuredContactCorrectionMeters ?? null,
      measuredClosestApproach,
      planRequiredDistanceMeters: latestFinePlan?.requiredDistance ?? null,
      planAppliedDistanceMeters: latestFinePlan?.appliedDistance ?? null,
      planReachable: latestFinePlan?.reachable ?? null,
      trackingAchievedDistanceMeters: latestFineTracking?.achievedDistance ?? null,
      residualBeforeRefinement,
      residualInterceptTarget,
      residualTrackingPlan,
      residualRefinement,
      residualCarryBeforeMeters,
      residualCarryAfterMeters: residualRefinement?.carriedResidualDistance ?? residualCarryBeforeMeters,
      residualAfterArmRefinement,
      residualBodyReach,
      residualAfterBodyReach,
      residualStanceReach,
      residualAfterRefinement,
      residualEdgeReductionMeters,
      residualPlaneReductionMeters,
      bodyEdgeReductionMeters,
      bodyPlaneReductionMeters,
      stanceEdgeReductionMeters,
      stancePlaneReductionMeters,
      plannedCorrectionVector,
      plannedCorrectionMeters,
      shieldStepVector,
      shieldStepTranslationMeters,
      correctionDirectionDot,
      authority: 'persistent-arm-carry-then-predicted-or-measured-low-threat-planted-stance-held-to-real-contact-or-reset-diagnostic',
    });
    interceptDriveTrace.push(latestInterceptDriveReport);
    if (interceptDriveTrace.length > 96) interceptDriveTrace.shift();
  } else {
    residualBodyReachRuntime.reset();
    residualStanceReachRuntime.reset();
    latestReachableInterceptTarget = null;
    latestFinePlan = null;
    latestFineTracking = null;
    latestInterceptDriveReport = null;
  }

  const afterSurface = cloneSurface(buckler.getWorldParrySurface());
  latestShieldLeadMotion = sampleActiveShieldLeadMotion({
    previousSurface: previousShieldLeadSurface || beforeSurface,
    currentSurface: afterSurface,
    deltaSeconds,
  });
  previousShieldLeadSurface = afterSurface;
}
function updatePreContact(snapshot, currentBlade, deltaSeconds) {
  if (!snapshot.action || firstContact) return;
  if (selectedMode === 'block') updateBlockPreContact(snapshot, currentBlade, deltaSeconds);
  else updateParryPreContact(snapshot, currentBlade, deltaSeconds);
}

function recordWhiffProbe(snapshot, probe) {
  if (selectedMode !== 'parry' || !parryGate.armed || !snapshot?.action || !probe) return;
  whiffProbeFrames += 1;
  const approach = probe.diagnostics?.closestApproach || null;
  if (!approach) return;
  const contactSeconds = Number(snapshot.action.runtime?.contactSeconds);
  const elapsedSeconds = Number(snapshot.elapsedSeconds);
  const timeToContactSeconds = Number.isFinite(contactSeconds) && Number.isFinite(elapsedSeconds)
    ? contactSeconds - elapsedSeconds
    : null;
  const record = Object.freeze({
    ...approach,
    attackPhase: snapshot.phase,
    attackDirection: snapshot.direction,
    elapsedSeconds: Number.isFinite(elapsedSeconds) ? elapsedSeconds : null,
    timeToContactSeconds,
    probeReason: probe.reason,
    geometricContact: probe.geometricContact === true,
    eligible: probe.eligible === true,
    shieldRadiusMeters: probe.surface?.radius ?? null,
    shieldThicknessMeters: probe.surface?.thickness ?? null,
    predictedGeometryReason: latestPredictiveAnalysis?.geometryReason ?? latestPredictiveAnalysis?.reason ?? null,
    trackingRequiredDistanceMeters: latestFinePlan?.requiredDistance ?? latestParryInput?.requiredShieldTravelMeters ?? null,
    trackingAppliedDistanceMeters: latestFinePlan?.appliedDistance ?? null,
    trackingAchievedDistanceMeters: latestFineTracking?.achievedDistance ?? null,
    trackingReachable: latestFinePlan?.reachable ?? null,
    interceptTargetSource: latestReachableInterceptTarget?.source ?? null,
    interceptFallbackApplied: latestReachableInterceptTarget?.fallbackApplied === true,
    predictedRequiredDistanceMeters: latestReachableInterceptTarget?.predictedRequiredDistanceMeters ?? null,
    measuredRequiredDistanceMeters: latestReachableInterceptTarget?.measuredRequiredDistanceMeters ?? null,
    interceptDriveReport: latestInterceptDriveReport,
  });
  if (!closestWhiffApproach
    || record.combinedGapMeters < closestWhiffApproach.combinedGapMeters
    || (record.combinedGapMeters === closestWhiffApproach.combinedGapMeters
      && Math.abs(record.timeToContactSeconds ?? Infinity) < Math.abs(closestWhiffApproach.timeToContactSeconds ?? Infinity))) {
    closestWhiffApproach = record;
  }
  if (probe.geometricContact === true && probe.contact !== true
    && (!outsideActiveContact
      || Math.abs(record.timeToContactSeconds ?? Infinity) < Math.abs(outsideActiveContact.timeToContactSeconds ?? Infinity))) {
    outsideActiveContact = record;
  }
}

function resolveContact(snapshot, currentBlade, deltaSeconds) {
  if (!previousBlade || !snapshot.action || firstContact) return;
  latestContact = probeSweptSwordBucklerContact({
    previousBlade,
    currentBlade,
    bucklerSurface: buckler.getWorldParrySurface(),
    deltaSeconds,
    active: snapshot.phase === LONGSWORD_ATTACK_PHASES.ACTIVE,
  });
  recordWhiffProbe(snapshot, latestContact);
  if (!latestContact.contact) return;

  firstContact = latestContact;
  const surfaceAtContact = buckler.getWorldParrySurface();
  latestLiveSurfaceAtContact = surfaceAtContact;
  latestPredictiveHandoff = predictivePresentation.active ? predictivePresentation.handoff() : null;
  latestParryConfirmation = selectedMode === 'parry'
    ? parryGate.confirm({ attackSnapshot: snapshot, contact: latestContact })
    : null;
  const parryConfirmed = latestParryConfirmation?.accepted === true;
  const guardIntentAgeMs = parryConfirmed ? TIMING_AGE_MS.parry : TIMING_AGE_MS.block;

  latestCombatResult = combat.resolveContact({
    contact: latestContact,
    guardIntentAgeMs,
  });
  if (!latestCombatResult.accepted) return;
  guardRuntime.sync(camera);
  const outcome = latestCombatResult.resolution.outcome;

  if (outcome === 'parry' && parryConfirmed) {
    latestCombatUpdate = combat.update(0, { camera });
    attackerSword.update();
    latestGripConstraintReport = swordGripConstraint.start({
      contact: latestContact,
      surfaceAtContact,
      shieldLeadMotion: latestShieldLeadMotion,
      attackDirection: selectedDirection,
    });
    latestLeadHandoff = Object.freeze({
      stage: COMMITTED_PARRY_CONTACT_GATE_STAGE,
      accepted: latestGripConstraintReport.accepted === true,
      shieldMovingAtContact: latestShieldLeadMotion?.moving === true,
      postContactHoldMs: 0,
      realSweptContact: true,
      shieldSwordGripStage: LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
      modifiedBone: 'wrist.r',
      assistBone: selectedDirection === 'top' || selectedDirection === 'right' ? 'lowerarm.r' : null,
      propagatedBones: Object.freeze(['hand.r', 'handslot.r']),
      elbowPropagationActive: selectedDirection === 'top' || selectedDirection === 'right',
      shoulderPropagationActive: false,
      b3ClockFrozen: true,
      noPresetMotionCurve: true,
      authority: 'confirmed-real-contact-to-live-shield-sword-wrist-grip-constraint',
    });
    step3AContactTransfer = Object.freeze({
      accepted: latestGripConstraintReport.accepted === true,
      reason: latestGripConstraintReport.reason || null,
      stage: latestGripConstraintReport.stage || LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
      tangentAuthority: latestGripConstraintReport.plan?.tangentAuthority || null,
      initialDeflectionDirection: latestGripConstraintReport.plan?.initialDeflectionDirection || null,
      modifiedBone: latestGripConstraintReport.modifiedBone || null,
      propagatedBones: latestGripConstraintReport.propagatedBones || null,
      noPresetMotionCurve: true,
      authority: latestLeadHandoff.authority,
    });
    fineTrackingRuntime.reset();
    residualBodyReachRuntime.reset();
    residualStanceReachRuntime.reset();
    status.textContent = step3AContactTransfer.accepted
      ? `STEP 3A ACTIVE · live shield surface is constraining sword contact through ${selectedDirection === 'left' ? 'wrist.r' : 'lowerarm.r → wrist.r'} → hand.r → grip · shoulder OFF · OLD B3 frozen until 7/7`
      : `STEP 3A FAIL · ${step3AContactTransfer.reason || 'live grip contact constraint rejected'}`;
    status.className = step3AContactTransfer.accepted ? 'good' : 'bad';
  } else if (selectedMode === 'parry') {
    status.textContent = `PARRY FAILED → BLOCK · ${latestParryConfirmation?.reason || 'parry gate was not confirmed'}`;
    status.className = 'warn';
  }
}

const INSPECTION_GATE_ORDER = Object.freeze([
  'shieldOfflineTravel',
  'handTravel',
  'gripTravel',
  'swordAxisClearance',
  'hiltOfflineTravel',
  'wristGripClearance',
  'directionAgreement',
]);
const INSPECTION_GATE_LABELS = Object.freeze({
  shieldOfflineTravel: '盾面離線',
  handTravel: '手部位移',
  gripTravel: '劍柄總位移',
  swordAxisClearance: '劍軸偏轉',
  hiltOfflineTravel: '劍柄離線',
  wristGripClearance: '手腕→劍柄線',
  directionAgreement: '撥動方向一致度',
});

function formatInspectionGate(gate) {
  if (!gate) return '—';
  const label = INSPECTION_GATE_LABELS[gate.key] || gate.label || gate.key;
  const operator = gate.operator === '>' ? '>' : '≥';
  if (gate.unit === 'meters') {
    const actual = gate.actual == null ? '—' : (gate.actual * 100).toFixed(1);
    return `${label} ${actual}cm ${operator} ${(gate.minimum * 100).toFixed(1)}cm`;
  }
  if (gate.unit === 'degrees') {
    const actual = gate.actual == null ? '—' : gate.actual.toFixed(1);
    return `${label} ${actual}° ${operator} ${gate.minimum.toFixed(1)}°`;
  }
  const actual = gate.actual == null ? '—' : gate.actual.toFixed(2);
  return `${label} ${actual} ${operator} ${gate.minimum.toFixed(2)}`;
}

function formatTerminalState(reason) {
  if (reason === 'shield-surface-separated-after-live-deflection-peak') return '正常分離（撥動峰值後）';
  if (reason === 'shield-surface-settled-after-live-deflection-peak') return '正常穩定（撥動峰值後）';
  if (reason === 'live-contact-safety-limit-after-sufficient-deflection') return '已達充分撥動（安全時間上限停格）';
  if (reason === 'insufficient-live-shield-offline-travel') return '盾面離線量不足';
  return reason || '尚未停格';
}

function formatInspectionFailureSummary(report) {
  const assessment = report?.inspectionAssessment;
  if (!assessment) return '驗收量測尚未建立';
  const failed = assessment.failedGateKeys
    .map((key) => assessment.gates[key])
    .filter(Boolean)
    .map(formatInspectionGate);
  const failureText = failed.length ? failed.join(' · ') : '沒有失敗門檻';
  return `FAIL ${assessment.failedGateCount}/${INSPECTION_GATE_ORDER.length} · ${failureText} · 接觸終止：${formatTerminalState(assessment.terminalReason)}`;
}

function formatAllInspectionGates(report) {
  const assessment = report?.inspectionAssessment;
  if (!assessment) return 'STEP 3A diagnostic: waiting for inspection measurements';
  const values = INSPECTION_GATE_ORDER.map((key) => {
    const gate = assessment.gates[key];
    return `${gate?.pass ? 'PASS' : 'FAIL'} ${formatInspectionGate(gate)}`;
  });
  return `INSPECTION ${assessment.pass ? 'PASS' : 'FAIL'} · ${values.join(' · ')}`;
}

function describeContactGeometry(contact = firstContact) {
  if (!contact?.geometricContact) return null;
  const bladeFraction = Math.max(0, Math.min(1, Number(contact.bladeFraction) || 0));
  const radialDistanceMeters = Math.max(0, Number(contact.radialDistance) || 0);
  const shieldRadiusMeters = Math.max(0, Number(contact.surface?.radius) || 0);
  const shieldRadiusRatio = shieldRadiusMeters > 0 ? radialDistanceMeters / shieldRadiusMeters : null;
  const bladeRegion = bladeFraction < 0.25 ? 'BASE' : bladeFraction > 0.75 ? 'TIP' : 'MID';
  const shieldRegion = shieldRadiusRatio == null
    ? 'UNKNOWN'
    : shieldRadiusRatio < 0.55
      ? 'FACE CENTER'
      : shieldRadiusRatio < 0.85
        ? 'FACE OUTER'
        : 'RIM / EDGE';
  return Object.freeze({
    bladeFraction,
    bladePercent: bladeFraction * 100,
    bladeRegion,
    radialDistanceMeters,
    shieldRadiusMeters,
    shieldRadiusRatio,
    shieldRegion,
    text: `blade ${(bladeFraction * 100).toFixed(0)}% ${bladeRegion} · shield ${(radialDistanceMeters * 100).toFixed(1)}/${(shieldRadiusMeters * 100).toFixed(1)}cm ${shieldRegion}`,
    authority: 'real-swept-contact-location-diagnostic',
  });
}

const PARRY_WHIFF_CATEGORY_LABELS = Object.freeze({
  CONTACT_OUTSIDE_ACTIVE_WINDOW: 'CONTACT OUTSIDE ACTIVE WINDOW',
  OUTSIDE_SHIELD_EDGE: 'OUTSIDE SHIELD EDGE',
  MISSED_SHIELD_PLANE: 'MISSED SHIELD PLANE',
  MISSED_PLANE_AND_DISC: 'PLANE + EDGE MISS',
  NO_EXACT_SWEPT_CONTACT: 'NO EXACT CONTACT',
  NO_PROBE_DATA: 'NO PROBE DATA',
});

function formatWhiffDiagnostic(whiff) {
  if (!whiff) return null;
  const sample = whiff.outsideActiveContact || whiff.closestApproachRecord;
  const baseLabel = PARRY_WHIFF_CATEGORY_LABELS[whiff.category] || whiff.category || 'UNKNOWN WHIFF';
  const sampledThreat = sample?.interceptDriveReport?.residualStanceReach?.threat;
  const label = sampledThreat?.kneeLineThreat
    ? baseLabel + ' · KNEE-LINE THREAT'
    : sampledThreat?.lowGuardGapThreat ? baseLabel + ' · LOW GUARD GAP' : baseLabel;
  if (!sample) return Object.freeze({ label, detail: `reason ${whiff.reason} · no sweep sample recorded` });
  const phase = String(sample.attackPhase || 'unknown').toUpperCase();
  const ttcMs = sample.timeToContactSeconds == null ? null : sample.timeToContactSeconds * 1000;
  const lead = whiff.category === 'CONTACT_OUTSIDE_ACTIVE_WINDOW'
    ? `geometric touch at ${phase}`
    : `closest ${phase}`;
  const parts = [lead];
  if (ttcMs != null) parts.push(`TTC ${ttcMs >= 0 ? '+' : ''}${ttcMs.toFixed(0)}ms`);
  if (sample.bladeFraction != null) parts.push(`blade ${(sample.bladeFraction * 100).toFixed(0)}%`);
  if (sample.planeGapMeters != null) parts.push(`plane gap ${(sample.planeGapMeters * 100).toFixed(1)}cm`);
  if (sample.radialGapMeters != null) parts.push(`edge gap ${(sample.radialGapMeters * 100).toFixed(1)}cm`);
  if (sample.radialDistanceMeters != null && sample.shieldRadiusMeters != null) {
    parts.push(`shield ${(sample.radialDistanceMeters * 100).toFixed(1)}/${(sample.shieldRadiusMeters * 100).toFixed(1)}cm`);
  }
  const required = whiff.tracking?.requiredDistanceMeters;
  const applied = whiff.tracking?.appliedDistanceMeters;
  if (required != null) {
    parts.push(`tracking ${(required * 100).toFixed(1)}→${((applied ?? whiff.tracking.limitMeters) * 100).toFixed(1)}cm${whiff.tracking.clamped ? ' CLAMP' : ''}`);
  }
  const drive = sample.interceptDriveReport;
  if (drive) {
    const driveSource = drive.selectionSource === 'measured-current-sweep-closest-approach' ? 'MEASURED' : drive.selectionSource === 'linear-predicted-threat' ? 'LINEAR' : 'NONE';
    const edgeCorrection = drive.measuredRadialContactCorrectionMeters == null ? '—' : `${(drive.measuredRadialContactCorrectionMeters * 100).toFixed(1)}cm`;
    const shieldStep = drive.shieldStepTranslationMeters == null ? '—' : `${(drive.shieldStepTranslationMeters * 100).toFixed(1)}cm`;
    const driveFrame = drive.drivePlanSource === 'surface-relative-measured-contact-correction' ? 'RELATIVE' : 'CURRENT';
    const directionDot = drive.correctionDirectionDot == null ? '—' : drive.correctionDirectionDot.toFixed(2);
    const formatGap = (value) => value == null ? '—' : `${(value * 100).toFixed(1)}cm`;
    const edgeBefore = formatGap(drive.residualBeforeRefinement?.radialGapMeters);
    const edgeAfter = formatGap(drive.residualAfterRefinement?.radialGapMeters);
    const planeBefore = formatGap(drive.residualBeforeRefinement?.planeGapMeters);
    const planeAfter = formatGap(drive.residualAfterRefinement?.planeGapMeters);
    const refinementStep = formatGap(drive.residualRefinement?.achievedDistance);
    const carryBefore = formatGap(drive.residualCarryBeforeMeters);
    const carryAfter = formatGap(drive.residualCarryAfterMeters);
    const bodyReach = drive.residualBodyReach;
    const armReach = bodyReach?.armExtensionRatio == null
      ? '—'
      : `${(bodyReach.armExtensionRatio * 100).toFixed(0)}%`;
    const wristDegrees = bodyReach?.wristAppliedDegrees == null
      ? '—'
      : `${bodyReach.wristAppliedDegrees.toFixed(1)}°`;
    const wristPlaneBefore = formatGap(bodyReach?.planeGapBeforeMeters);
    const wristPlaneAfter = formatGap(bodyReach?.planeGapAfterWristMeters);
    const torsoDegrees = bodyReach?.appliedDegrees
      ? `${(bodyReach.appliedDegrees.chest + bodyReach.appliedDegrees.spine).toFixed(1)}°`
      : '—';
    const bodyReachBefore = formatGap(magnitude(bodyReach?.bodyReachOffsetBefore));
    const bodyReachAfter = formatGap(bodyReach?.bodyReachDistance);
    const bodyDirection = bodyReach?.bodyDirectionDot == null
      ? '—'
      : bodyReach.bodyDirectionDot.toFixed(2);
    const armEdgeAfter = formatGap(drive.residualAfterArmRefinement?.radialGapMeters);
    const stance = drive.residualStanceReach;
    const threat = stance?.threat;
    const stanceState = stance?.stanceHeld
      ? 'HOLD'
      : stance?.stanceConfirmed
        ? stance?.earlyLowThreatRecruitment ? 'EARLY ACTIVE' : 'ACTIVE'
        : stance?.armStalled ? 'STALL WAIT' : 'OFF';
    const threatZone = threat?.zone || '—';
    const formatHeight = (value) => value == null ? '—' : (value * 100).toFixed(1) + 'cm';
    const threatHeights = [
      threat?.pointY,
      threat?.shieldBottomY,
      threat?.kneeLeftY,
      threat?.kneeRightY,
    ].map(formatHeight).join('/');
    const lowGap = formatGap(threat?.verticalGapBelowShieldMeters);
    const kneeDistance = formatGap(threat?.kneeLineDistanceMeters);
    const earlyStance = stance?.earlyLowThreatRecruitment ? 'YES' : 'NO';
    const stanceThreatSource = stance?.activationSource === 'predicted-future-sword-point'
      ? 'PREDICTED'
      : stance?.activationSource === 'measured-residual-sword-point' ? 'MEASURED' : 'NONE';
    const stanceLead = stance?.anticipatedLeadSeconds == null
      ? '—'
      : `${Math.round(stance.anticipatedLeadSeconds * 1000)}ms`;
    const stanceHold = stance?.stanceHeld ? 'YES' : 'NO';
    const crouchTarget = formatGap(stance?.engagedTargetCrouchMeters);
    const stanceSelection = stance?.threatSelection;
    const anticipatedPlan = stance?.anticipatedPlan;
    const rawPredictedLead = stanceSelection?.anticipatedLeadSeconds;
    const predictedDecision = String(
      stanceSelection?.anticipatedEligibilityReason || 'no-predicted-selection',
    ).toUpperCase().replaceAll('-', '_');
    const predictedLead = rawPredictedLead == null ? '—' : `${Math.round(rawPredictedLead * 1000)}ms`;
    const predictedZone = anticipatedPlan?.threat?.zone || '—';
    const predictedEdge = formatGap(anticipatedPlan?.metrics?.radialGapMeters);
    const predictedPlane = formatGap(anticipatedPlan?.metrics?.planeGapMeters);
    const predictedArm = anticipatedPlan?.arm?.saturated
      ? 'SATURATED'
      : anticipatedPlan?.arm?.stalled ? 'STALLED' : anticipatedPlan?.arm?.attempted ? 'ATTEMPT' : 'NO_ATTEMPT';
    const predictedThreat = anticipatedPlan?.threat;
    const predictedFlags = predictedThreat
      ? `plane ${predictedThreat.planeNear ? 'Y' : 'N'} / down ${predictedThreat.stronglyDownward ? 'Y' : 'N'} / below ${predictedThreat.belowShield ? 'Y' : 'N'} / feet ${predictedThreat.aboveFeet ? 'Y' : 'N'}`
      : '—';
    const downwardRatio = stance?.downwardRatio == null ? '—' : stance.downwardRatio.toFixed(2);
    const crouchBefore = formatGap(stance?.crouchBeforeMeters);
    const crouchAfter = formatGap(stance?.crouchMeters);
    const hipsDegrees = stance?.hipsAppliedDegrees == null ? '—' : `${stance.hipsAppliedDegrees.toFixed(1)}°`;
    const footL = stance?.footPlant?.l?.driftMeters == null ? '—' : `${(stance.footPlant.l.driftMeters * 1000).toFixed(1)}mm`;
    const footR = stance?.footPlant?.r?.driftMeters == null ? '—' : `${(stance.footPlant.r.driftMeters * 1000).toFixed(1)}mm`;
    const planted = stance?.feetPlanted == null ? '—' : stance.feetPlanted ? 'PASS' : 'FAIL';
    parts.push([
      'zone ' + threatZone,
      'y blade/rim/kneeL/kneeR ' + threatHeights,
      'lowgap ' + lowGap,
      'kdist ' + kneeDistance,
      'early ' + earlyStance,
      'stance src ' + stanceThreatSource,
      'lead ' + stanceLead,
      'hold ' + stanceHold,
      'target ' + crouchTarget,
    ].join(' · '));
    if (DEBUG_MODE) {
      parts.push(`DEBUG pred ${predictedDecision} · plead ${predictedLead} · pzone ${predictedZone} · pedge ${predictedEdge} · pplane ${predictedPlane} · parm ${predictedArm} · pflags ${predictedFlags}`);
    }
    const refinementDirection = drive.residualRefinement?.directionDot == null
      ? '—'
      : drive.residualRefinement.directionDot.toFixed(2);
    parts.push(`selector ${driveSource} · drive ${driveFrame} · edge correction ${edgeCorrection} · acquire ${drive.measuredInsideAcquisitionBand ? 'PASS' : 'FAIL'} · shield step ${shieldStep} · dir ${directionDot} · residual edge ${edgeBefore}→${edgeAfter} · plane ${planeBefore}→${planeAfter} · carry ${carryBefore}→${carryAfter} · refine ${refinementStep} · rdir ${refinementDirection} · arm ${armReach} · aedge ${edgeBefore}→${armEdgeAfter} · wrist ${wristDegrees} · wplane ${wristPlaneBefore}→${wristPlaneAfter} · torso ${torsoDegrees} · reach ${bodyReachBefore}→${bodyReachAfter} · bdir ${bodyDirection} · stance ${stanceState} · down ${downwardRatio} · crouch ${crouchBefore}→${crouchAfter} · hips ${hipsDegrees} · feet ${footL}/${footR} ${planted}`);
  } else {
    parts.push('selector NO ARMED DRIVE FRAME');
  }
  return Object.freeze({ label, detail: parts.join(' · ') });
}

function showParryCue(state, main, detail) {
  parryCue.className = `parry-cue ${state}`;
  parryCueMain.textContent = main;
  parryCueDetail.textContent = detail;
  retryAttackButton.classList.toggle('retry-attention', state === 'used');
}

function updateParryCue(snapshot = attackRuntime.snapshot) {
  if (!ready) {
    showParryCue('wait', 'LOADING…', '等待 Lab 與動作資料完成');
    return;
  }
  if (selectedMode !== 'parry') {
    showParryCue('idle', 'BLOCK MODE', '切換到 PARRY 才會顯示按鍵窗口');
    return;
  }
  if (step3AContactTransfer && !step3AContactTransfer.accepted) {
    showParryCue('used', 'STEP 3A TRANSFER FAILED', `接觸幀已鎖住；原因：${step3AContactTransfer.reason}`);
    return;
  }
  if (step3AContactTransfer?.accepted) {
    if (latestGripConstraintReport?.holding) {
      if (latestGripConstraintReport.inspectionPassed) {
        showParryCue(
          'confirmed',
          'STEP 3A HOLD · LIVE CONTACT VERIFIED',
          `7/7 gates PASS · 接觸終止：${formatTerminalState(latestGripConstraintReport.terminalReason)}`,
        );
      } else {
        const assessment = latestGripConstraintReport.inspectionAssessment;
        showParryCue(
          'used',
          `STEP 3A HOLD · ${assessment?.failedGateCount ?? '?'} GATES FAILED`,
          formatInspectionFailureSummary(latestGripConstraintReport),
        );
      }
    } else {
      showParryCue(
        'confirmed',
        'LIVE SHIELD × SWORD CONSTRAINT',
        selectedDirection === 'left'
          ? '每幀由盾面接觸錨點解算 wrist.r；LEFT 手臂交棒仍待校準'
          : '每幀由盾面接觸錨點解算 lowerarm.r → wrist.r；7/7 後交棒 OLD B3',
      );
    }
    return;
  }
  if (latestParryConfirmation?.accepted) {
    showParryCue('confirmed', 'PARRY CONFIRMED', '真實 Sword × Shield 接觸已成立，正在建立 live wrist-grip 接觸約束');
    return;
  }
  if (latestParryWhiff) {
    const whiff = formatWhiffDiagnostic(latestParryWhiff);
    showParryCue('late', `PARRY WHIFF · ${whiff.label}`, whiff.detail);
    return;
  }

  const attempt = parryGate.attempt;
  if (attempt) {
    if (attempt.accepted) {
      showParryCue('armed', 'ARMED · WAIT FOR CONTACT', 'F 已收到；現在只等待真實 Sword × Shield swept contact');
      return;
    }
    const timing = attempt.reason === 'attack-not-committed' || attempt.reason === 'parry-input-too-early'
      ? 'TOO EARLY'
      : attempt.reason === 'parry-input-too-late'
        ? 'TOO LATE'
        : 'INPUT REJECTED';
    showParryCue('used', `${timing} · ATTEMPT USED`, `原因：${attempt.reason} · 這一刀不再接受 F，按 RETRY ATTACK`);
    return;
  }

  if (!snapshot?.action) {
    showParryCue('idle', 'START AN ATTACK', '選一個攻擊方向，或按 RETRY ATTACK');
    return;
  }
  if (firstContact) {
    showParryCue('late', 'CONTACT PASSED', '這一刀沒有在有效窗口武裝 Parry');
    return;
  }

  const opportunity = latestParryOpportunity;
  if (!opportunity) {
    showParryCue('wait', 'WAIT · READING ATTACK', '正在取得即時攻擊路徑與盾牌可達資訊');
    return;
  }
  if (opportunity.accepted) {
    const ttcMs = Math.max(0, opportunity.timeToContactSeconds * 1000).toFixed(0);
    const reachCm = opportunity.requiredShieldTravelMeters == null
      ? '—'
      : (opportunity.requiredShieldTravelMeters * 100).toFixed(1);
    const tracking = opportunity.gates.trackingClamped ? `tracking ${reachCm}cm → clamp 18cm` : `shield travel ${reachCm}cm`;
    showParryCue('ready', 'PARRY NOW! · PRESS F', `commitment + TTC gate 已開 · ${tracking} · review hold 最多 1.5s`);
    return;
  }

  if (opportunity.reason === 'attack-not-committed' || opportunity.reason === 'parry-input-too-early') {
    const attack = opportunity.attack;
    const untilCommitMs = attack?.movementStartSeconds == null || attack?.elapsedSeconds == null
      ? null
      : Math.max(0, (attack.movementStartSeconds - attack.elapsedSeconds) * 1000);
    const reviewMs = untilCommitMs == null
      ? null
      : untilCommitMs / (isParryPreContactReviewActive(snapshot) ? PARRY_REVIEW_RATE : 1);
    showParryCue(
      'wait',
      untilCommitMs == null ? 'WAIT · ATTACK NOT COMMITTED' : `WAIT · WINDOW IN ${untilCommitMs.toFixed(0)}ms`,
      reviewMs == null ? '不要按 F；等待 PARRY NOW' : `game-time · 約 ${reviewMs.toFixed(0)}ms review-time · 不要先按 F`,
    );
    return;
  }
  if (opportunity.reason === 'parry-input-too-late') {
    showParryCue('late', 'TOO LATE', '等待下一刀，或按 RETRY ATTACK');
    return;
  }

  showParryCue('geometry', 'WAIT · GATE CLOSED', `即時原因：${opportunity.reason} · 尚未接受 F`);
}
function updateHud(snapshot, combatSnapshot) {
  const outcome = latestCombatResult?.resolution?.outcome || '—';
  const recoil = combatSnapshot.attackerRecoil?.sample;
  const attackProfile = snapshot.action?.runtime || null;
  const ttcSeconds = attackProfile ? attackProfile.contactSeconds - snapshot.elapsedSeconds : null;
  const committed = Boolean(attackProfile)
    && snapshot.elapsedSeconds >= attackProfile.movementStartSeconds
    && snapshot.elapsedSeconds < attackProfile.contactSeconds;
  const inputStatus = latestParryWhiff
    ? `WHIFF · ${latestParryWhiff.category}`
    : latestParryConfirmation?.accepted
    ? 'CONFIRMED'
    : latestParryInput?.accepted
      ? 'ARMED · awaiting real contact'
      : latestParryInput
        ? `REJECTED · ${latestParryInput.reason}`
        : selectedMode === 'parry'
          ? 'not pressed'
          : 'Block mode';

  const reviewRate = isParryPreContactReviewActive(snapshot) ? PARRY_REVIEW_RATE : 1;
  hudAttack.textContent = `Requested: ${requestedOutcome().toUpperCase()} · Actual: ${String(outcome).toUpperCase()} · ${snapshot.phase} · committed ${committed ? 'YES' : 'NO'} · TTC ${ttcSeconds == null ? '—' : `${Math.max(0, ttcSeconds) * 1000 | 0}ms`} · review ${reviewRate.toFixed(2)}×${parryPromptHold ? ' · VALID WINDOW HELD' : ''}`;
  const contactGeometry = describeContactGeometry(firstContact);
  const whiffGeometry = formatWhiffDiagnostic(latestParryWhiff);
  hudContact.textContent = contactGeometry
    ? `REAL Sword × Shield: YES · swept ${firstContact.mode || 'contact'} · ${contactGeometry.text}`
    : whiffGeometry
      ? `REAL Sword × Shield: NO · ${whiffGeometry.detail}`
      : 'REAL Sword × Shield: waiting';
  hudCoupling.textContent = `Parry gate: ${inputStatus}`;
  const interceptRequired = latestFinePlan?.requiredDistance;
  const interceptApplied = latestFinePlan?.appliedDistance;
  const originalPrediction = latestReachableInterceptTarget?.predictedRequiredDistanceMeters;
  hudShield.textContent = latestParryInput
    ? latestReachableInterceptTarget?.fallbackApplied && interceptRequired != null
      ? `Shield intercept: MEASURED SWEEP ${(interceptRequired * 100).toFixed(1)}→${(interceptApplied * 100).toFixed(1)}cm · bad linear prediction ${originalPrediction == null ? '—' : `${(originalPrediction * 100).toFixed(1)}cm`} rejected · real contact still required`
      : `Shield tracking: ${latestParryInput.requiredShieldTravelMeters == null ? 'path pending' : `${(latestParryInput.requiredShieldTravelMeters * 100).toFixed(1)}cm → ${latestParryInput.gates.trackingClamped ? 'CLAMP 18cm' : 'within 18cm'}`} · geometry cannot veto input · plane ${latestParryInput.predictedPlaneDistanceMeters == null ? '—' : `${(latestParryInput.predictedPlaneDistanceMeters * 100).toFixed(1)}cm`}`
    : 'Shield tracking: geometry guides a clamped 18cm response; it cannot veto valid timing input';
  const centimeters = (value) => value == null ? '—' : (value * 100).toFixed(1);
  const agreement = latestGripConstraintReport?.directionAgreement == null
    ? '—'
    : latestGripConstraintReport.directionAgreement.toFixed(2);
  const inspection = latestGripConstraintReport?.holding
    ? latestGripConstraintReport.inspectionPassed ? 'PASS' : 'FAIL'
    : 'LIVE';
  hudWeapon.textContent = step3AContactTransfer?.accepted
    ? `LIVE Shield → Sword → Arm: forearm ${latestGripConstraintReport?.appliedForearmDegrees?.toFixed(1) ?? '0.0'}° · wrist ${latestGripConstraintReport?.appliedWristDegrees?.toFixed(1) ?? '0.0'}° · offline target ${centimeters(latestGripConstraintReport?.peakOfflineTravelMeters)}cm · sword ${centimeters(latestGripConstraintReport?.actualContactTravelMeters)}cm · hand ${centimeters(latestGripConstraintReport?.actualHandTravelMeters)}cm · hilt ${centimeters(latestGripConstraintReport?.actualGripTravelMeters)}cm`
    : 'LIVE Shield → Sword → Grip: locked until valid manual timing and real contact pass';
  hudSeparation.textContent = step3AContactTransfer?.accepted
    ? `Step 3A: ${inspection} · contact error ${centimeters(latestGripConstraintReport?.liveContactErrorMeters)}cm · direction ${agreement} · hold ${formatTerminalState(latestGripConstraintReport?.terminalReason)} · ${latestGripConstraintReport?.elbowPropagationActive ? 'lowerarm.r assist → ' : ''}wrist.r → hand.r + handslot.r · shoulder OFF`
    : 'Step 3A: waiting · TOP/RIGHT lowerarm assist + wrist/grip; LEFT remains wrist-only';
  const lineClearance = latestGripConstraintReport?.attackLineClearance || null;
  const lineGate = (passed) => passed ? 'PASS' : 'FAIL';
  hudLineClearance.textContent = lineClearance
    ? `LINE CLEAR ${lineGate(lineClearance.pass)} · sword axis ${lineGate(lineClearance.swordAxisPassed)} ${lineClearance.swordAxisClearanceDegrees.toFixed(1)}° / ${lineClearance.minimumSwordAxisClearanceDegrees.toFixed(1)}° · hilt ${lineGate(lineClearance.hiltOfflinePassed)} ${(lineClearance.hiltOfflineTravelMeters * 100).toFixed(1)}cm / ${(lineClearance.minimumHiltOfflineTravelMeters * 100).toFixed(1)}cm · wrist→grip ${lineGate(lineClearance.wristGripLinePassed)} ${lineClearance.wristGripClearanceDegrees.toFixed(1)}° / ${lineClearance.minimumWristGripClearanceDegrees.toFixed(1)}°`
    : 'LINE CLEAR: waiting for live contact · red original axis / green current axis / purple wrist→grip';
  hudRecoil.textContent = step3AOwnsLiveContact()
    ? 'OLD B3 recoil: FROZEN AT CONTACT · Step 3A owns the sword/hand inspection pose'
    : recoil
      ? `OLD B3 recoil: ${recoil.phase} · arm ${recoil.weights?.armWeight?.toFixed(2) ?? '—'} · torso ${recoil.weights?.torsoWeight?.toFixed(2) ?? '—'} · legs ${recoil.weights?.legWeight?.toFixed(2) ?? '—'}`
      : 'OLD B3 recoil: —';
  const inspectionAssessment = latestGripConstraintReport?.inspectionAssessment;
  hudDiagnostic.textContent = directOldB3Diagnostic
    ? `STEP 1 DIRECT B3: ${directOldB3Diagnostic.accepted ? 'ACTIVE' : 'FAIL'} · all later gates bypassed`
    : inspectionAssessment?.holding
      ? formatAllInspectionGates(latestGripConstraintReport)
      : whiffGeometry
        ? `WHIFF DIAGNOSTIC · ${whiffGeometry.label} · ${whiffGeometry.detail}`
        : `STEP 3A: ${inputStatus} · shield → sword → hand only · Perfect removed`;
  hudDiagnostic.className = latestParryWhiff
    ? 'bad'
    : inspectionAssessment?.holding
      ? inspectionAssessment.pass ? 'good' : 'bad'
      : '';
}

function buildReport(combatSnapshot = combat.snapshot) {
  const handoff = combatSnapshot.attackerRecoil?.postCouplingHandoff || null;
  const report = {
    stage: LAB_STAGE,
    recoilStage: RECOIL_STAGE,
    pass: ready,
    selectedDirection,
    selectedMode,
    outcome: latestCombatResult?.resolution?.outcome || null,
    parryGate: {
      profile: parryGate.profile,
      opportunity: latestParryOpportunity,
      input: latestParryInput,
      confirmation: latestParryConfirmation,
      manualInputRequired: true,
      commitmentSource: 'attack.action.runtime.movementStartSeconds',
      successAuthority: 'eligible real swept Sword × Shield contact during attack_active',
    },
    contact: firstContact,
    contactGeometryDiagnostic: describeContactGeometry(firstContact),
    predictiveAnalysis: latestPredictiveAnalysis,
    predictiveShieldLead: {
      active: Boolean(latestPredictiveReport?.active),
      progress: latestPredictiveReport?.progress ?? null,
      motion: latestShieldLeadMotion,
      interceptTarget: latestReachableInterceptTarget,
      interceptDrive: latestInterceptDriveReport,
      interceptDriveTrace: Object.freeze({
        frameCount: interceptDriveTrace.length,
        fallbackFrames: interceptDriveTrace.filter((frame) => frame.fallbackApplied).length,
        measuredReachableFrames: interceptDriveTrace.filter((frame) => frame.measuredReachable).length,
        acquisitionFrames: interceptDriveTrace.filter((frame) => frame.measuredInsideAcquisitionBand).length,
        recentFrames: Object.freeze(interceptDriveTrace.slice(-16)),
      }),
    },
    step3AContactTransfer,
    inspectionCamera: freeCamera.snapshot(),
    liveShieldSwordGripContactConstraint: latestGripConstraintReport,
    latestInputSignal,
    parryWhiff: latestParryWhiff,
    whiffTelemetry: Object.freeze({
      probeFrames: whiffProbeFrames,
      closestApproachRecord: closestWhiffApproach,
      outsideActiveContact,
      authority: 'presentation-diagnostic-only-no-combat-authority',
    }),
    postCouplingStage: handoff?.stage || null,
    postCouplingReason: handoff?.reason || null,
    recoil: combatSnapshot.attackerRecoil?.sample || null,
    directOldB3Diagnostic,
    debugLowStance: Object.freeze({
      enabled: DEBUG_MODE,
      profile: DEBUG_MODE ? Object.freeze({ ...debugStanceProfile }) : null,
      latestThreatSelection: latestInterceptDriveReport?.residualStanceReach?.threatSelection ?? null,
      authority: 'debug-profile-changes-posture-guidance-only-real-swept-contact-remains-success-authority',
    }),
    invariants: {
      singleParryOnlyInThisLab: true,
      noAutomaticTimingTrigger: true,
      authoredCommitmentMarkerRequired: latestParryInput?.gates?.attackCommitted ?? null,
      ttcWindowRequired: latestParryInput?.gates?.timingInsideWindow ?? null,
      shieldTrackingClampedTo18cm: latestParryInput?.gates?.trackingClamped ?? null,
      geometryGuidesButCannotVetoInput: latestParryInput?.gates?.geometryGuidanceCanVetoInput === false,
      measuredSweepFallbackIsGuidanceOnly: latestReachableInterceptTarget?.authority === 'guidance-only-real-swept-contact-remains-success-authority' || !latestReachableInterceptTarget,
      realSweptContactRequired: latestParryConfirmation?.gates?.realSweptContact ?? null,
      step3AOnlyAfterConfirmedRealContact: step3AContactTransfer
        ? latestParryConfirmation?.accepted === true && firstContact?.geometricContact === true
        : true,
      initialMeasuredShieldMotionIsDiagnosticOnly: latestGripConstraintReport?.plan?.tangentAuthority != null,
      liveShieldSurfaceSampledAfterGuardUpdate: latestGripConstraintReport?.mappedSurfaceTarget?.authority === 'current-world-shield-surface',
      noPresetMotionCurve: step3AContactTransfer?.noPresetMotionCurve ?? true,
      swordRemainsRigidlyMountedToHand: latestGripConstraintReport?.rigidSwordGrip ?? null,
      boundedForearmThenWristForTopRight: ['top', 'right'].includes(selectedDirection)
        ? latestGripConstraintReport?.assistBone === 'lowerarm.r'
        : true,
      handAndSocketFollowWristHierarchy: latestGripConstraintReport?.propagatedBones?.join(',') === 'hand.r,handslot.r',
      elbowPropagationMatchesDirectionPolicy: latestGripConstraintReport?.elbowPropagationActive === ['top', 'right'].includes(selectedDirection) || !step3AContactTransfer,
      shoulderPropagationDeferred: latestGripConstraintReport?.shoulderPropagationActive === false || !step3AContactTransfer,
      liveContactInspectionPassed: latestGripConstraintReport?.holding
        ? latestGripConstraintReport.inspectionPassed === true
        : null,
      attackLineClearanceRequired: true,
      attackLineClearancePassed: latestGripConstraintReport?.attackLineClearance?.pass ?? null,
      freeInspectionCameraDoesNotMutateCombat: true,
      b3ClockFrozenDuringStep3A: step3AOwnsLiveContact(),
      oldB3ReleasedOnlyAfterSevenOfSeven: step3AContactTransfer?.releasedToOldB3
        ? latestGripConstraintReport?.inspectionPassed === true
        : true,
      oldB3CoreModulesUnchanged: true,
      blockPathPreserved: true,
      noRootTranslation: true,
    },
  };
  reportNode.textContent = JSON.stringify(report, null, 2);
  document.documentElement.dataset.g43b5r281 = report.pass ? 'pass' : 'fail';
  window.__G43B5R281_RESULT__ = report;
  return report;
}
async function main() {
  status.textContent = `Loading UAL attacks + Skyrim Guard + ${LAB_STAGE}…`;
  const [ual1, ual2, skyrim] = await Promise.all([
    loadUal1AnimationLibrary(new THREE.GLTFLoader(), { THREE, rig: attacker.rig, fps: 30 }),
    loadUal2AnimationLibrary(new THREE.GLTFLoader(), { THREE, rig: attacker.rig, fps: 30 }),
    loadSkyrimConvertedAnimationLibrary(new THREE.GLTFLoader(), { THREE, rig: defender.rig, fps: 30 }),
  ]);
  attacker.registerAnimations(ual1); attacker.registerAnimations(ual2); defender.registerAnimations(skyrim);
  attackerIdleDuration = attacker.getAnimationDuration('UAL1/Sword_Idle') || 1;
  const idle = skyrim.clips.get('SKYRIM_GUARD/shd_blockidle');
  const bind = idle?.userData?.weaponBindCalibration;
  if (!bind?.correctionQuaternion) throw new Error(`${LAB_STAGE} requires Skyrim Guard weapon bind calibration`);
  defenderSword = createDebugSword(THREE);
  mountDebugSword(defender, defenderSword, composeSkyrimWeaponMountCalibration(THREE, DEFAULT_KAYKIT_SWORD_MOUNT, bind));
  enterGuard();
  previousShieldLeadSurface = cloneSurface(buckler.getWorldParrySurface());
  ready = true;
  status.textContent = `${LAB_STAGE} READY · start an attack, then press PARRY NOW after commitment and before contact`;
  status.className = 'good';
  buildReport();
  startAttack('right');
}

document.querySelectorAll('[data-attack]').forEach((button) => button.addEventListener('click', () => startAttack(button.dataset.attack)));
document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
forceOldB3Button.addEventListener('click', () => forceOldTwoActorB3(selectedDirection));
parryNowButton.addEventListener('click', () => dispatchParryInput('button'));
retryAttackButton.addEventListener('click', () => restartAttack(selectedDirection));
debugApplyRetryButton.addEventListener('click', () => restartAttack(selectedDirection));
debugResetDefaultsButton.addEventListener('click', resetDebugStanceDefaults);
document.addEventListener('keydown', handleParryKeyDown, true);
document.addEventListener('keyup', handleParryKeyUp, true);
addEventListener('blur', () => { parryKeyDownObserved = false; });
canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
showSurface.addEventListener('change', () => buckler.setParrySurfaceVisible(showSurface.checked));
setView('three'); resize(); addEventListener('resize', resize);

function frame(timestamp) {
  const rawDeltaMs = Math.min(50, Math.max(0, timestamp - lastTimestamp));
  const preUpdateSnapshot = attackRuntime.snapshot;
  const parryReviewActive = isParryPreContactReviewActive(preUpdateSnapshot);
  const holdingParryPrompt = parryReviewActive
    && parryPromptHold?.sequence === preUpdateSnapshot.sequence
    && !parryGate.attempt;
  if (holdingParryPrompt) {
    parryPromptHold.remainingRealMs -= rawDeltaMs;
    if (parryPromptHold.remainingRealMs <= 0) parryPromptHold = null;
  }
  const reviewRate = parryReviewActive ? PARRY_REVIEW_RATE : 1;
  const deltaMs = holdingParryPrompt ? 0 : rawDeltaMs * reviewRate;
  const deltaSeconds = Math.max(1e-5, deltaMs / 1000);
  lastTimestamp = timestamp;
  freeCamera.update(rawDeltaMs / 1000);
  if (ready) {
    const snapshot = attackRuntime.update(deltaMs);

    if (parryGate.armed && !snapshot.action && !firstContact && !latestParryWhiff) {
      latestParryWhiff = buildParryWhiffDiagnostic({
        sequence: parryGate.attempt?.sequence ?? null,
        direction: selectedDirection,
        probeFrames: whiffProbeFrames,
        closestApproachRecord: closestWhiffApproach,
        outsideActiveContact,
        predictiveAnalysis: latestPredictiveAnalysis,
        finePlan: latestFinePlan,
        fineTracking: latestFineTracking,
        shieldLeadMotion: latestShieldLeadMotion,
        parryInput: latestParryInput,
      });
      const whiff = formatWhiffDiagnostic(latestParryWhiff);
      status.textContent = `PARRY WHIFF · ${whiff.label} · ${whiff.detail}`;
      status.className = 'bad';
    }

    let step3ALiveConstraintNeedsUpdate = false;
    if (combat.active) {
      if (step3AOwnsLiveContact()) {
        latestCombatUpdate = combat.update(0, { camera });
        step3ALiveConstraintNeedsUpdate = swordGripConstraint.active;
      } else {
        latestCombatUpdate = combat.update(deltaSeconds, { camera });
        if (step3AReleaseBlend) step3AReleaseBlend.elapsedMs += deltaMs;
        if (latestCombatUpdate?.justCompleted && !attackerRecovery) beginAttackRecovery(selectedDirection);
      }
    } else {
      sampleAttackerBase(snapshot, deltaMs);
    }

    guardRuntime.update(deltaMs, camera);
    if (step3ALiveConstraintNeedsUpdate) {
      const wasHolding = latestGripConstraintReport?.holding === true;
      latestGripConstraintReport = swordGripConstraint.update(deltaSeconds, {
        surfaceAtFrame: buckler.getWorldParrySurface(),
      });
      updateLiveContactMarkers(latestGripConstraintReport);
      if (!wasHolding && latestGripConstraintReport?.holding) {
        const passed = latestGripConstraintReport.inspectionPassed === true;
        const release = passed ? releaseLiveContactToOldB3() : null;
        status.textContent = release?.accepted
          ? `LIVE CONTACT VERIFIED · 7/7 PASS · ${selectedDirection.toUpperCase()} lowerarm/wrist push complete → OLD B3 released`
          : passed
            ? `LIVE CONTACT VERIFIED · 7/7 PASS · ${selectedDirection.toUpperCase()} OLD B3 handoff deferred while TOP/RIGHT are calibrated first`
            : `STEP 3A HOLD · ${formatInspectionFailureSummary(latestGripConstraintReport)}`;
        status.className = release?.accepted || passed ? 'good' : 'bad';
      }
    }
    attackerSword.update(); defenderSword?.update();

    if (!firstContact) {
      const currentBlade = captureBladePolyline();
      updatePreContact(snapshot, currentBlade, deltaSeconds);
      resolveContact(snapshot, currentBlade, deltaSeconds);
      previousBlade = currentBlade;
    }
    updateParryCue(snapshot);

    const combatSnapshot = combat.snapshot;
    hudClockMs += deltaMs; reportClockMs += deltaMs;
    if (hudClockMs >= HUD_INTERVAL_MS) { hudClockMs %= HUD_INTERVAL_MS; updateHud(snapshot, combatSnapshot); }
    if (reportClockMs >= REPORT_INTERVAL_MS) { reportClockMs %= REPORT_INTERVAL_MS; buildReport(combatSnapshot); }

    if (!combat.active && !attackRuntime.active && !attackerRecovery && guardMachine.state === GUARD_STATES.HOLD && autoRepeat.checked) {
      repeatCooldownMs += deltaMs;
      if (repeatCooldownMs >= 700) startAttack(selectedDirection);
    }
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
main().catch((error) => {
  document.documentElement.dataset.g43b5r281 = 'fail';
  status.textContent = `${LAB_STAGE} FAIL · ${error?.message || error}`;
  status.className = 'bad';
  reportNode.textContent = error?.stack || String(error);
  window.__G43B5R281_RESULT__ = { stage: LAB_STAGE, pass: false, error: error?.stack || String(error) };
});

window.__G43B5R281_LAB__ = {
  startAttack,
  restartAttack,
  setMode,
  combat,
  attackRuntime,
  guardMachine,
  predictivePresentation,
  parryGate,
  freeCamera,
  residualBodyReachRuntime,
  residualStanceReachRuntime,
  debugMode: DEBUG_MODE,
  get debugStanceProfile() { return Object.freeze({ ...debugStanceProfile }); },
  refreshDebugStanceProfile,
  resetDebugStanceDefaults,
  swordGripConstraint,
  triggerParryNow,
  dispatchParryInput,
  forceOldTwoActorB3,
  get directOldB3Diagnostic() { return directOldB3Diagnostic; },
  get latestPredictiveReport() { return latestPredictiveReport; },
  get latestShieldLeadMotion() { return latestShieldLeadMotion; },
  get latestLeadHandoff() { return latestLeadHandoff; },
  get latestCombatResult() { return latestCombatResult; },
  get latestParryInput() { return latestParryInput; },
  get latestParryOpportunity() { return latestParryOpportunity; },
  get latestParryConfirmation() { return latestParryConfirmation; },
  get step3AContactTransfer() { return step3AContactTransfer; },
  get latestGripConstraintReport() { return latestGripConstraintReport; },
  get latestParryWhiff() { return latestParryWhiff; },
  get latestInterceptDriveReport() { return latestInterceptDriveReport; },
  get latestInputSignal() { return latestInputSignal; },
};
