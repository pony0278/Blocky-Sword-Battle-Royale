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
import { getProductionParryDeflectProfile } from '../../src/animation/parry-contact-deflect-runtime-clip.js?v=g43b5r281-parry-sync-r2';
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
} from '../../src/combat/predictive-intercept-parry.js?v=g43b5r281-parry-sync-r2';
import { sampleActiveShieldLeadMotion } from '../../src/combat/active-shield-lead-parry.js?v=g43b5r281';
import {
  TWO_ACTOR_PARRY_REACTION_CHANNELS,
  TWO_ACTOR_PARRY_REACTION_PHASE_LATCHES,
  createTwoActorCombatIntegration,
} from '../../src/combat/two-actor-combat-integration.js?v=g43b5r281-closed-loop-old-b3-r18i5';
import {
  LEGACY_TWO_ACTOR_RECOIL_HANDOFF_MODE,
  LEGACY_TWO_ACTOR_RECOIL_PASSTHROUGH_STAGE,
  publishPostCouplingRecoilStaggerHandoff,
} from '../../src/combat/post-coupling-recoil-stagger-handoff.js';
import {
  COMMITTED_PARRY_CONTACT_GATE_STAGE,
  createCommittedParryContactGate,
  evaluateCommittedParryInput,
} from '../../src/combat/committed-parry-contact-gate.js?v=g43b5r281-step2-timing-authority-r5';
import {
  LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
  createLiveShieldSwordGripContactRuntime,
} from '../../src/combat/live-shield-sword-grip-contact-constraint.js?v=g43b5r281-closed-loop-old-b3-r18i5';
import {
  buildLiveParryOldB3Handoff,
  sampleLiveParryOldB3ReleaseBlend,
} from '../../src/combat/live-parry-old-b3-handoff.js?v=g43b5r281-closed-loop-old-b3-r18i5';
import {
  measureAttackerRecoilWorldSilhouette,
} from '../../src/combat/attacker-recoil-world-silhouette.js?v=g43b5r281-closed-loop-old-b3-r18i5';

import {
  compactInterceptDriveTelemetry,
  compactInterceptDriveTraceFrame,
  compactPredictiveAnalysis,
  compactParryGateAttempt,
  compactReachableInterceptTarget,
  compactLiveContactConstraint,
  compactThreatSelection,
} from './shield-parry-r281/diagnostic-telemetry.js';
import {
  describeContactGeometry,
  formatAllInspectionGates,
  formatInspectionFailureSummary,
  formatTerminalState,
  formatWhiffDiagnostic,
} from './shield-parry-r281/diagnostic-formatters.js';
import { serializeVerificationReport } from './shield-parry-r281/report-serialization.js';
import { createShieldParryLabDom } from './shield-parry-r281/lab-dom.js';
import { createStanceDebugController } from './shield-parry-r281/stance-debug-controls.js';
import { createShieldParryLabUi, bindShieldParryLabUiEvents } from './shield-parry-r281/lab-ui.js';

const LAB_STAGE = LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE;
const RECOIL_STAGE = LEGACY_TWO_ACTOR_RECOIL_PASSTHROUGH_STAGE;
const THREE = window.THREE;
if (!THREE?.WebGLRenderer || !THREE?.GLTFLoader) throw new Error(`${LAB_STAGE} requires Three.js r128 + GLTFLoader`);

const TIMING_AGE_MS = Object.freeze({ block: 260, parry: 120 });
const HUD_INTERVAL_MS = 50;
const REPORT_INTERVAL_MS = 240;
const MAX_REPORT_DOM_CHARACTERS = 60000;
const RECENT_COMPACT_TRACE_FRAMES = 8;
const PARRY_REVIEW_RATE = 0.12;
const PARRY_PROMPT_HOLD_MS = 1500;
const PARRY_PRESENTATION_MARKERS = getProductionParryDeflectProfile('parry').presentationMarkers;
const PARRY_ATTACKER_RELEASE_SOURCE_SECONDS = PARRY_PRESENTATION_MARKERS.attackerReleaseEligibleSeconds;
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
contactTravelLine.frustumCulled = false;
liveTargetMarker.visible = false;
actualSwordContactMarker.visible = false;
contactTravelLine.visible = false;
scene.add(liveTargetMarker, actualSwordContactMarker, contactTravelLine);
function createInspectionLine(color) {
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, depthTest: false }));
  line.visible = false;
  line.frustumCulled = false;
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
let frozenAttackerContactPose = null;
let canonicalAttackerOldB3Pose = null;
let canonicalAttackerOldB3WorldSilhouette = null;

function captureAttackerWorldSilhouette() {
  attacker.rig.root?.updateMatrixWorld?.(true);
  const read = (boneName) => {
    const position = new THREE.Vector3();
    attacker.rig.bones[boneName]?.getWorldPosition(position);
    return Object.freeze({ x: position.x, y: position.y, z: position.z });
  };
  const leftShoulder = read('upperarm.l');
  const rightShoulder = read('upperarm.r');
  return Object.freeze({
    hips: read('hips'),
    chest: read('chest'),
    head: read('head'),
    shoulders: Object.freeze({
      x: (leftShoulder.x + rightShoulder.x) * 0.5,
      y: (leftShoulder.y + rightShoulder.y) * 0.5,
      z: (leftShoulder.z + rightShoulder.z) * 0.5,
    }),
  });
}

function sampleCanonicalInterruptionPose(interruption) {
  attacker.sampleAnimation(interruption.clipId, interruption.sourceTimeSeconds, {
    loop: false,
    inPlace: interruption.inPlace !== false,
    rootRotationPolicy: interruption.rootRotationPolicy,
  });
  attacker.update(0, camera);
}

function captureCanonicalAttackerOldB3Base(interruption) {
  if (!interruption) return false;
  const visiblePose = captureRigPose(attacker.rig);
  sampleCanonicalInterruptionPose(interruption);
  canonicalAttackerOldB3Pose = captureRigPose(attacker.rig);
  canonicalAttackerOldB3WorldSilhouette = captureAttackerWorldSilhouette();
  applyRigPose(attacker.rig, visiblePose);
  attacker.update(0, camera);
  return true;
}

function sampleOriginalContactPose(interruption) {
  if (step3AOwnsLiveContact() && frozenAttackerContactPose) {
    applyRigPose(attacker.rig, frozenAttackerContactPose);
  } else if (step3AReleaseBlend?.sourcePose && step3AReleaseBlend?.targetPose) {
    const releaseSample = sampleLiveParryOldB3ReleaseBlend(
      step3AReleaseBlend.elapsedMs,
      step3AReleaseBlend.durationMs,
    );
    applyRigPose(attacker.rig, blendRecoveryPose(
      step3AReleaseBlend.sourcePose,
      step3AReleaseBlend.sourcePose,
      step3AReleaseBlend.targetPose,
      releaseSample.progress,
      { durationMs: step3AReleaseBlend.durationMs, sampleDeltaMs: 0, momentumScale: 0 },
    ));
    step3AReleaseBlend.sample = releaseSample;
  } else if (canonicalAttackerOldB3Pose) {
    applyRigPose(attacker.rig, canonicalAttackerOldB3Pose);
  } else {
    sampleCanonicalInterruptionPose(interruption);
  }
  attacker.update(0, camera);
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

const uiElements = createShieldParryLabDom(document);
const { status, reportNode, autoRepeat, slowReview, showSurface } = uiElements;
const stanceDebug = createStanceDebugController({
  documentRef: document,
  windowRef: window,
  debugMode: DEBUG_MODE,
  debugQuery: DEBUG_QUERY,
  profileDefaults: GUARD_RESIDUAL_STANCE_REACH_PROFILE,
  elements: uiElements,
});
const debugStanceProfile = stanceDebug.profile;
const refreshDebugStanceProfile = (syncUrl = true) => stanceDebug.refresh(syncUrl);
const resetDebugStanceDefaults = () => stanceDebug.resetDefaults();
stanceDebug.initialize();
const labUi = createShieldParryLabUi(uiElements);

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
let visibleOldB3Peak = null;
let latchedDefenderDeflectReleaseGate = null;
let latestParryWhiff = null;
let whiffProbeFrames = 0;
let closestWhiffApproach = null;
let outsideActiveContact = null;
let latestInputSignal = null;
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
  frozenAttackerContactPose = null;
  canonicalAttackerOldB3Pose = null;
  canonicalAttackerOldB3WorldSilhouette = null;
  step3AContactTransfer = null;
  latestGripConstraintReport = null;
  latestLiveSurfaceAtContact = null;
  step3AReleaseBlend = null;
  visibleOldB3Peak = null;
  latchedDefenderDeflectReleaseGate = null;
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

function currentDefenderDeflectReleaseGate() {
  const report = guardRuntime.report;
  const sourceTimeSeconds = Math.max(0, Number(report?.sourceTimeSeconds) || 0);
  const passed = report?.state === GUARD_STATES.PARRY
    && sourceTimeSeconds + 1e-4 >= PARRY_ATTACKER_RELEASE_SOURCE_SECONDS;
  return Object.freeze({
    passed,
    state: report?.state || null,
    sourceTimeSeconds,
    requiredSourceTimeSeconds: PARRY_ATTACKER_RELEASE_SOURCE_SECONDS,
    marker: 'deflect-impulse',
    latched: false,
    authority: 'defender-reaction-marker-gates-attacker-release',
  });
}

function updateDefenderDeflectReleaseGate() {
  if (latchedDefenderDeflectReleaseGate) return latchedDefenderDeflectReleaseGate;
  const current = currentDefenderDeflectReleaseGate();
  if (!current.passed) return current;
  latchedDefenderDeflectReleaseGate = Object.freeze({
    ...current,
    latched: true,
    authority: 'latched-defender-deflect-marker-gates-attacker-release',
  });
  return latchedDefenderDeflectReleaseGate;
}

function defenderDeflectReleaseGate() {
  return latchedDefenderDeflectReleaseGate || currentDefenderDeflectReleaseGate();
}

function releaseLiveContactToOldB3() {
  if (!step3AOwnsLiveContact()) {
    return Object.freeze({ accepted: false, reason: 'live-contact-no-longer-owns-presentation' });
  }
  const defenderReleaseGate = defenderDeflectReleaseGate();
  if (!defenderReleaseGate.passed) {
    return Object.freeze({
      accepted: false,
      reason: 'defender-deflect-marker-not-reached',
      defenderReleaseGate,
    });
  }
  const handoff = buildLiveParryOldB3Handoff({
    attackDirection: selectedDirection,
    contactReport: latestGripConstraintReport,
    surfaceAtContact: latestLiveSurfaceAtContact,
    confirmedParry: latestParryConfirmation?.accepted === true
      && firstContact?.eligible === true,
    allowConfirmedParryFallback: true,
  });
  if (!handoff.accepted) return handoff;
  const visibleReleasePose = captureRigPose(attacker.rig);
  const recoilPoseAtRelease = combat.snapshot.attackerRecoil?.sample?.pose || null;
  const appliedBodyChainPitchAtReleaseDegrees = recoilPoseAtRelease
    ? (Number(recoilPoseAtRelease.chestPitchDegrees) || 0)
      + (Number(recoilPoseAtRelease.spinePitchDegrees) || 0)
      + (Number(recoilPoseAtRelease.hipsPitchDegrees) || 0)
    : null;

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
    sourcePose: visibleReleasePose,
    targetPose: canonicalAttackerOldB3Pose || frozenAttackerContactPose,
    authority: 'full-rig-live-contact-pose-to-canonical-interruption-pose',
  };
  step3AContactTransfer = Object.freeze({
    ...step3AContactTransfer,
    releasedToOldB3: true,
    releaseHandoff: handoff,
    defenderReleaseGate,
    handoffPublished: true,
    handoffConsumedByOldB3: false,
    b3BodyClockStartedAtImpact: false,
    oldB3ReleaseStartPresentationMs:
      combat.snapshot.attackerRecoil?.phaseClock?.latchPointMs ?? null,
    continuityBridgeMs: handoff.releaseBlendMs,
    visibleOldB3StartsAtDeflectImpulse: true,
    oldB3AppliedBodyChainPitchAtReleaseDegrees:
      appliedBodyChainPitchAtReleaseDegrees,
    continuationStartedAtPresentationMs: null,
    continuationStartedAtImpactClockMs: null,
    bodyRestartedAtRelease: false,
    continuationPlanIdentityPreserved: null,
    continuationElapsedPreserved: null,
    weaponArmContactConstrained: false,
  });
  return Object.freeze({ ...handoff, handoffPublished: true });
}

function recordVisibleOldB3Sample(combatUpdate) {
  if (step3AContactTransfer?.releasedToOldB3 !== true) return;
  const recoilUpdate = combatUpdate?.recoilUpdate || null;
  const sample = recoilUpdate?.sample
    || recoilUpdate?.snapshot?.sample
    || combatUpdate?.attackerRecoil?.sample
    || null;
  if (!sample?.pose || sample.phase === 'contact-hold') return;
  const requestedLocalChainPitchDegrees = (Number(sample.pose.chestPitchDegrees) || 0)
    + (Number(sample.pose.spinePitchDegrees) || 0)
    + (Number(sample.pose.hipsPitchDegrees) || 0);
  const measurement = measureAttackerRecoilWorldSilhouette({
    baseline: canonicalAttackerOldB3WorldSilhouette,
    current: captureAttackerWorldSilhouette(),
    backwardDirection: latestCombatResult?.attackerReaction?.plan?.body?.direction,
    requestedLocalChainPitchDegrees,
  });
  if (!measurement.accepted) return;
  const readabilityScore = measurement.worldBackwardLeanDegrees
    + Math.max(0, measurement.headBackwardMeters) * 100
    + Math.max(0, measurement.shouldersBackwardMeters) * 100;
  if (
    visibleOldB3Peak
    && visibleOldB3Peak.readabilityScore >= readabilityScore
  ) return;
  const phaseClock = recoilUpdate?.phaseClock || recoilUpdate?.snapshot?.phaseClock || null;
  visibleOldB3Peak = Object.freeze({
    ...measurement,
    phase: sample.phase,
    presentationElapsedMs: phaseClock?.elapsedMs ?? null,
    readabilityScore,
    armWeight: sample.weights?.armWeight ?? null,
    torsoWeight: sample.weights?.torsoWeight ?? null,
    legWeight: sample.weights?.legWeight ?? null,
  });
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
  labUi.flashParryInput();
  const result = triggerParryNow(source);
  parryPromptHold = null;
  labUi.setInputReceipt(source, result);
  updateParryCue(attackRuntime.snapshot);
  return result;
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
  frozenAttackerContactPose = captureRigPose(attacker.rig);
  latestCombatResult = combat.resolveContact({ contact: latestContact, guardIntentAgeMs: TIMING_AGE_MS.parry });
  if (!latestCombatResult.accepted) {
    frozenAttackerContactPose = null;
    directOldB3Diagnostic = Object.freeze({ accepted: false, reason: latestCombatResult.reason || 'diagnostic-contact-rejected' });
    return directOldB3Diagnostic;
  }
  captureCanonicalAttackerOldB3Base(attackRuntime.snapshot.interruption);
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
    reactionDefinitionId: latestCombatResult.attackerReaction?.id || null,
    reactionPlanBackwardPitchDegrees:
      latestCombatResult.attackerReaction?.silhouette?.backwardPitchDegrees ?? null,
    reactionInitialElapsedMs: latestCombatResult.attackerReaction?.initialElapsedMs ?? null,
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
    const residualAfterArmRefinement = measureSweptSwordBucklerClosestApproach({
      previousBlade,
      currentBlade,
      bucklerSurface: cloneSurface(buckler.getWorldParrySurface()),
    });
    const residualBodyReach = residualBodyReachRuntime.update({
      mode: 'parry',
      closestApproach: residualAfterArmRefinement,
    }, deltaSeconds);
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
    // Rebuild dynamic line geometry once after all pose solvers have finished.
    defender.update(0, camera);
    defenderSword?.update();
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
    interceptDriveTrace.push(compactInterceptDriveTraceFrame(latestInterceptDriveReport));
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
    interceptDriveReport: compactInterceptDriveTelemetry(latestInterceptDriveReport),
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

  frozenAttackerContactPose = captureRigPose(attacker.rig);
  latestCombatResult = combat.resolveContact({
    contact: latestContact,
    guardIntentAgeMs,
    defenderPresentationOffsetSeconds: latestPredictiveHandoff?.accepted
      ? latestPredictiveHandoff.defenderPresentationOffsetSeconds
      : undefined,
  });
  if (!latestCombatResult.accepted) {
    frozenAttackerContactPose = null;
    return;
  }
  captureCanonicalAttackerOldB3Base(attackRuntime.snapshot.interruption);
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
      reactionIntentActiveAtImpact: false,
    });
    latestLeadHandoff = Object.freeze({
      stage: COMMITTED_PARRY_CONTACT_GATE_STAGE,
      accepted: latestGripConstraintReport.accepted === true,
      shieldMovingAtContact: latestShieldLeadMotion?.moving === true,
      postContactHoldMs: 0,
      realSweptContact: true,
      shieldSwordGripStage: LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
      modifiedBone: 'wrist.r',
      proximalAssistBone: selectedDirection === 'top' || selectedDirection === 'right' ? 'upperarm.r' : null,
      assistBone: selectedDirection === 'top' || selectedDirection === 'right' ? 'lowerarm.r' : null,
      propagatedBones: Object.freeze(['hand.r', 'handslot.r']),
      elbowPropagationActive: selectedDirection === 'top' || selectedDirection === 'right',
      shoulderPropagationActive: false,
      b3BodyClockStartedAtImpact: false,
      oldB3ReleaseStartPresentationMs: null,
      attackerReactionDefinitionId: latestCombatResult.attackerReaction?.id || null,
      oldB3PlanBackwardPitchDegrees:
        latestCombatResult.attackerReaction?.silhouette?.backwardPitchDegrees ?? null,
      oldB3ImpulsePeakMs: latestCombatResult.attackerReaction?.timeline?.impulsePeakMs ?? null,
      oldB3InitialElapsedMs: latestCombatResult.attackerReaction?.initialElapsedMs ?? null,
      reactionDefinitionSelectedAtImpact: true,
      fullOldB3ReactionIntentActiveAtImpact: false,
      contactConstraintOwnsUntilDeflectImpulse: true,
      handoffConsumedByOldB3: false,
      continuationStartedAtPresentationMs: null,
      continuationStartedAtImpactClockMs: null,
      bodyRestartedAtRelease: false,
      continuationPlanIdentityPreserved: null,
      continuationElapsedPreserved: null,
      weaponArmContactConstrained: true,
      contactBasePoseAuthority: 'authoritative-impact-rig-snapshot',
      noPresetMotionCurve: true,
      authority: 'confirmed-impact-selects-old-b3-contact-holds-until-deflect-impulse',
    });
    step3AContactTransfer = Object.freeze({
      accepted: latestGripConstraintReport.accepted === true,
      reason: latestGripConstraintReport.reason || null,
      stage: latestGripConstraintReport.stage || LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
      tangentAuthority: latestGripConstraintReport.plan?.tangentAuthority || null,
      initialDeflectionDirection: latestGripConstraintReport.plan?.initialDeflectionDirection || null,
      modifiedBone: latestGripConstraintReport.modifiedBone || null,
      proximalAssistBone: latestGripConstraintReport.proximalAssistBone || null,
      propagatedBones: latestGripConstraintReport.propagatedBones || null,
      b3BodyClockStartedAtImpact: false,
      attackerReactionDefinitionId: latestCombatResult.attackerReaction?.id || null,
      oldB3PlanBackwardPitchDegrees:
        latestCombatResult.attackerReaction?.silhouette?.backwardPitchDegrees ?? null,
      oldB3ImpulsePeakMs: latestCombatResult.attackerReaction?.timeline?.impulsePeakMs ?? null,
      oldB3InitialElapsedMs: latestCombatResult.attackerReaction?.initialElapsedMs ?? null,
      reactionDefinitionSelectedAtImpact: true,
      fullOldB3ReactionIntentActiveAtImpact: false,
      contactConstraintOwnsUntilDeflectImpulse: true,
      weaponArmContactConstrained: true,
      contactBasePoseAuthority: 'authoritative-impact-rig-snapshot',
      noPresetMotionCurve: true,
      authority: latestLeadHandoff.authority,
    });
    fineTrackingRuntime.reset();
    residualBodyReachRuntime.reset();
    residualStanceReachRuntime.reset();
    status.textContent = step3AContactTransfer.accepted
      ? `STEP 3A ACTIVE · ParryImpact selected OLD B3 · live shield owns contact until DEFLECT_IMPULSE · then 28ms bridge → canonical OLD B3 from 0ms`
      : `STEP 3A FAIL · ${step3AContactTransfer.reason || 'live grip contact constraint rejected'}`;
    status.className = step3AContactTransfer.accepted ? 'good' : 'bad';
  } else if (selectedMode === 'parry') {
    status.textContent = `PARRY FAILED → BLOCK · ${latestParryConfirmation?.reason || 'parry gate was not confirmed'}`;
    status.className = 'warn';
  }
}

function updateParryCue(snapshot = attackRuntime.snapshot) {
  return labUi.updateParryCue({
    snapshot,
    ready,
    selectedMode,
    step3AContactTransfer,
    latestGripConstraintReport,
    selectedDirection,
    latestParryConfirmation,
    latestParryWhiff,
    parryAttempt: parryGate.attempt,
    firstContact,
    latestParryOpportunity,
    parryReviewActive: isParryPreContactReviewActive(snapshot),
    parryReviewRate: PARRY_REVIEW_RATE,
    debugMode: DEBUG_MODE,
  });
}

function updateHud(snapshot, combatSnapshot) {
  return labUi.updateHud({
    snapshot,
    combatSnapshot,
    latestCombatResult,
    latestParryWhiff,
    latestParryConfirmation,
    latestParryInput,
    selectedMode,
    requestedOutcome: requestedOutcome(),
    parryReviewActive: isParryPreContactReviewActive(snapshot),
    parryReviewRate: PARRY_REVIEW_RATE,
    parryPromptHeld: Boolean(parryPromptHold),
    firstContact,
    latestFinePlan,
    latestReachableInterceptTarget,
    latestGripConstraintReport,
    step3AContactTransfer,
    defenderReleaseGate: defenderDeflectReleaseGate(),
    step3AOwnsLiveContact: step3AOwnsLiveContact(),
    directOldB3Diagnostic,
    debugMode: DEBUG_MODE,
  });
}

function buildReport(combatSnapshot = combat.snapshot) {
  const handoff = combatSnapshot.attackerRecoil?.postCouplingHandoff || null;
  const recoilSample = combatSnapshot.attackerRecoil?.sample || null;
  const recoilPose = recoilSample?.pose || null;
  const appliedBodyChainPitchDegrees = recoilPose
    ? (Number(recoilPose.chestPitchDegrees) || 0)
      + (Number(recoilPose.spinePitchDegrees) || 0)
      + (Number(recoilPose.hipsPitchDegrees) || 0)
    : null;
  const attackerReaction = latestCombatResult?.attackerReaction || null;
  const report = {
    stage: LAB_STAGE,
    recoilStage: RECOIL_STAGE,
    pass: ready,
    selectedDirection,
    selectedMode,
    outcome: latestCombatResult?.resolution?.outcome || null,
    parryGate: {
      profile: parryGate.profile,
      opportunity: compactParryGateAttempt(latestParryOpportunity),
      input: compactParryGateAttempt(latestParryInput),
      confirmation: compactParryGateAttempt(latestParryConfirmation),
      manualInputRequired: true,
      commitmentSource: 'attack.action.runtime.movementStartSeconds',
      successAuthority: 'eligible real swept Sword × Shield contact during attack_active',
    },
    contact: firstContact,
    contactGeometryDiagnostic: describeContactGeometry(firstContact),
    predictiveAnalysis: compactPredictiveAnalysis(latestPredictiveAnalysis),
    predictiveHandoff: latestPredictiveHandoff,
    defenderPresentationContinuity: latestCombatResult?.defenderPayload
      ? Object.freeze({
          source: latestCombatResult.defenderPayload.presentationContinuitySource || null,
          predictiveSourceTimeSeconds: latestPredictiveHandoff?.defenderPresentationOffsetSeconds ?? null,
          authoritativeSourceTimeSeconds: latestCombatResult.defenderPayload.presentationOffsetSeconds ?? null,
        })
      : null,
    defenderDeflectReleaseGate: defenderDeflectReleaseGate(),
    parryImpactEvent: combatSnapshot.parryImpactEvent || latestCombatResult?.parryImpactEvent || null,
    parryReactionClock: combatSnapshot.parryReactionClock || null,
    recoilPhaseClock: combatSnapshot.attackerRecoil?.phaseClock || null,
    attackerParriedReactionDefinition: attackerReaction
      ? Object.freeze({
          stage: attackerReaction.stage,
          id: attackerReaction.id,
          activation: attackerReaction.sourceBurst?.activation || null,
          initialElapsedMs: attackerReaction.initialElapsedMs,
          planBackwardPitchDegrees: attackerReaction.silhouette?.backwardPitchDegrees ?? null,
          appliedBodyChainPitchDegrees:
            step3AContactTransfer?.oldB3AppliedBodyChainPitchAtReleaseDegrees
              ?? appliedBodyChainPitchDegrees,
          impulsePeakMs: attackerReaction.timeline?.impulsePeakMs ?? null,
          separateBalanceBreakRuntime: attackerReaction.channelPolicy?.separateBalanceBreakRuntime,
          authority: attackerReaction.authority,
        })
      : null,
    visibleOldB3Peak,
    oldB3Continuation: Object.freeze({
      handoffPublished: step3AContactTransfer?.handoffPublished === true,
      handoffConsumed: step3AContactTransfer?.handoffConsumedByOldB3 === true,
      releaseStartPresentationMs:
        step3AContactTransfer?.oldB3ReleaseStartPresentationMs ?? null,
      continuityBridgeMs: step3AContactTransfer?.continuityBridgeMs ?? null,
      visibleOldB3StartsAtDeflectImpulse:
        step3AContactTransfer?.visibleOldB3StartsAtDeflectImpulse === true,
      continuationStartedAtPresentationMs:
        step3AContactTransfer?.continuationStartedAtPresentationMs ?? null,
      continuationStartedAtImpactClockMs:
        step3AContactTransfer?.continuationStartedAtImpactClockMs ?? null,
      bodyRestartedAtRelease: step3AContactTransfer?.bodyRestartedAtRelease ?? false,
      planIdentityPreserved:
        step3AContactTransfer?.continuationPlanIdentityPreserved ?? null,
      presentationElapsedPreserved:
        step3AContactTransfer?.continuationElapsedPreserved ?? null,
      authority: 'deflect-impulse-continuity-bridge-to-canonical-old-b3-from-zero',
    }),
    contactPoseLifecycle: Object.freeze({
      capturedAtAuthoritativeImpact: Boolean(frozenAttackerContactPose),
      restoredBeforeEveryBodyOverlay: Boolean(frozenAttackerContactPose && combatSnapshot.activeExchange),
      attackerReactionComplete: combatSnapshot.attackerReactionComplete === true,
      interruptionHeldForWeaponContact: combatSnapshot.attackerReactionComplete === true
        && step3AOwnsLiveContact(),
      authority: 'authoritative-impact-rig-snapshot-plus-independent-contact-release',
    }),
    predictiveShieldLead: {
      active: Boolean(latestPredictiveReport?.active),
      progress: latestPredictiveReport?.progress ?? null,
      motion: latestShieldLeadMotion,
      interceptTarget: compactReachableInterceptTarget(latestReachableInterceptTarget),
      interceptDrive: compactInterceptDriveTelemetry(latestInterceptDriveReport),
      interceptDriveTrace: Object.freeze({
        frameCount: interceptDriveTrace.length,
        fallbackFrames: interceptDriveTrace.filter((frame) => frame.fallbackApplied).length,
        measuredReachableFrames: interceptDriveTrace.filter((frame) => frame.measuredReachable).length,
        acquisitionFrames: interceptDriveTrace.filter((frame) => frame.measuredInsideAcquisitionBand).length,
        recentFrames: Object.freeze(interceptDriveTrace.slice(-RECENT_COMPACT_TRACE_FRAMES)),
        telemetryDetail: 'compact-scalar-frames-only',
      }),
    },
    step3AContactTransfer,
    inspectionCamera: freeCamera.snapshot(),
    liveShieldSwordGripContactConstraint: compactLiveContactConstraint(latestGripConstraintReport),
    latestInputSignal,
    parryWhiff: latestParryWhiff,
    whiffTelemetry: Object.freeze({
      probeFrames: whiffProbeFrames,
      closestApproachRecord: latestParryWhiff ? closestWhiffApproach : null,
      outsideActiveContact: latestParryWhiff ? outsideActiveContact : null,
      authority: 'presentation-diagnostic-only-no-combat-authority',
    }),
    postCouplingStage: handoff?.stage || null,
    postCouplingReason: handoff?.reason || null,
    recoil: recoilSample,
    directOldB3Diagnostic,
    debugLowStance: Object.freeze({
      enabled: DEBUG_MODE,
      profile: DEBUG_MODE ? Object.freeze({ ...debugStanceProfile }) : null,
      latestThreatSelection: compactThreatSelection(
        latestInterceptDriveReport?.residualStanceReach?.threatSelection,
      ),
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
      boundedProximalArmCorrectionBeforeForearmAndWrist: ['top', 'right'].includes(selectedDirection)
        ? latestGripConstraintReport?.proximalAssistBone === 'upperarm.r'
          && latestGripConstraintReport?.proximalArmCorrectionActive === true
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
      parryImpactSelectsReactionWhileDefenderClockRuns: combatSnapshot.parryReactionClock
        ? combatSnapshot.parryReactionClock.defenderReactionStarted === true
          && combatSnapshot.parryReactionClock.attackerReactionDefinitionSelected === true
        : true,
      parryImpactSelectsExaggeratedOldB3ReactionDefinition: attackerReaction
        ? attackerReaction.initialElapsedMs === 0
          && attackerReaction.sourceBurst?.activation === 'deflect-impulse'
          && attackerReaction.sourceBurst?.powerFrame?.startsAtDeflectImpulse === true
          && attackerReaction.silhouette?.backwardPitchDegrees >= 25
          && attackerReaction.channelPolicy?.contactConstraintRunsBeforeVisibleReaction === true
          && attackerReaction.channelPolicy?.separateBalanceBreakRuntime === false
        : true,
      contactOwnsFinalPoseBeforeVisibleOldB3: step3AOwnsLiveContact()
        ? combatSnapshot.attackerRecoil?.appliedChannels?.torso === false
          && combatSnapshot.attackerRecoil?.appliedChannels?.weaponArm === false
          && latestGripConstraintReport?.reactionIntentAppliedBeforeConstraint === false
        : true,
      b3PresentationParkedAtOriginDuringLiveContact: step3AOwnsLiveContact()
        ? combatSnapshot.attackerRecoil?.phaseClock?.phaseLatch
            === TWO_ACTOR_PARRY_REACTION_PHASE_LATCHES.LIVE_CONTACT
          && combatSnapshot.attackerRecoil?.phaseClock?.latchPointMs === 0
          && combatSnapshot.attackerRecoil?.phaseClock?.elapsedMs === 0
        : true,
      weaponArmRemainsContactConstrainedDuringStep3A: step3AOwnsLiveContact()
        ? step3AContactTransfer?.weaponArmContactConstrained === true
        : true,
      frozenContactPoseRestoredBeforeEveryBodyOverlay: step3AContactTransfer
        ? Boolean(frozenAttackerContactPose)
        : true,
      bodyCompletionCannotReleaseContactOwnedPose: step3AContactTransfer
        ? step3AContactTransfer.releasedToOldB3 === true
          || combatSnapshot.attackerReactionComplete !== true
          || combatSnapshot.attack?.interrupted === true
        : true,
      oldB3WeaponArmReleasedAfterInspectionOrConfirmedFallback: step3AContactTransfer?.releasedToOldB3
        ? latestGripConstraintReport?.inspectionPassed === true
          || step3AContactTransfer?.releaseHandoff?.couplingReport?.inspectionFallbackUsed === true
        : true,
      defenderParryPresentationNeverRewindsAtContact: latestPredictiveHandoff?.accepted && latestCombatResult?.accepted
        ? latestCombatResult.defenderPayload?.presentationOffsetSeconds + 1e-4
          >= latestPredictiveHandoff.defenderPresentationOffsetSeconds
        : true,
      oldB3WeaponArmReleasedOnlyAfterDefenderDeflectMarker: step3AContactTransfer?.releasedToOldB3
        ? step3AContactTransfer.defenderReleaseGate?.passed === true
        : true,
      deflectImpulseStartsOldB3FromZeroWithoutBodyRestart: step3AContactTransfer?.handoffConsumedByOldB3
        ? step3AContactTransfer.bodyRestartedAtRelease === false
          && step3AContactTransfer.continuationPlanIdentityPreserved === true
          && step3AContactTransfer.continuationElapsedPreserved === true
          && step3AContactTransfer.continuationStartedAtPresentationMs === 0
          && step3AContactTransfer.continuityBridgeMs === 28
          && step3AContactTransfer.defenderReleaseGate?.passed === true
        : true,
      visibleOldB3ReachedHistoricalBackwardPeak: step3AContactTransfer?.handoffConsumedByOldB3
        ? visibleOldB3Peak?.readable === true
        : true,
      contactQaCannotPermanentlySuppressConfirmedParryOldB3: step3AContactTransfer?.releasedToOldB3
        ? latestParryConfirmation?.accepted === true
        : true,
      compactTelemetryDoesNotRetainSolverGraphs: interceptDriveTrace.every(
        (frame) => frame?.telemetryDetail === 'compact-scalar-frame',
      ),
      blockPathPreserved: true,
      noRootTranslation: true,
    },
  };
  const publication = serializeVerificationReport({
    report,
    maxCharacters: MAX_REPORT_DOM_CHARACTERS,
    traceFrames: interceptDriveTrace.length,
    recentTraceFrames: Math.min(interceptDriveTrace.length, RECENT_COMPACT_TRACE_FRAMES),
  });
  reportNode.textContent = publication.displayText;
  document.documentElement.dataset.g43b5r281 = report.pass ? 'pass' : 'fail';
  window.__G43B5R281_RESULT__ = report;
  window.__G43B5R281_PERF__ = publication.perf;
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

bindShieldParryLabUiEvents({
  documentRef: document,
  windowRef: window,
  canvas,
  elements: uiElements,
  handlers: {
    onAttack: (direction) => startAttack(direction),
    onMode: (mode) => setMode(mode),
    onView: (view) => setView(view),
    onForceOldB3: () => forceOldTwoActorB3(selectedDirection),
    onParryInput: (inputSource, event) => dispatchParryInput(inputSource, event),
    onRetryAttack: () => restartAttack(selectedDirection),
    onDebugApplyRetry: () => restartAttack(selectedDirection),
    onDebugResetDefaults: resetDebugStanceDefaults,
    onShowSurface: (checked) => buckler.setParrySurfaceVisible(checked),
    onResize: resize,
  },
});

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
      const whiff = formatWhiffDiagnostic(latestParryWhiff, { debugMode: DEBUG_MODE });
      status.textContent = `PARRY WHIFF · ${whiff.label} · ${whiff.detail}`;
      status.className = 'bad';
    }

    let step3ALiveConstraintNeedsUpdate = false;
    if (combat.active) {
      if (step3AOwnsLiveContact()) {
        latestCombatUpdate = combat.update(deltaSeconds, {
          camera,
          attackerRecoilChannels: TWO_ACTOR_PARRY_REACTION_CHANNELS.LIVE_CONTACT_HOLD,
          attackerRecoilPhaseLatch: TWO_ACTOR_PARRY_REACTION_PHASE_LATCHES.LIVE_CONTACT,
          holdAttackerInterruption: true,
        });
        step3ALiveConstraintNeedsUpdate = swordGripConstraint.active;
      } else {
        latestCombatUpdate = combat.update(deltaSeconds, { camera });
        const handoffConsumed = latestCombatUpdate?.recoilUpdate?.postCouplingHandoffApplied === true;
        if (
          handoffConsumed
          && step3AContactTransfer?.releasedToOldB3 === true
          && step3AContactTransfer.handoffConsumedByOldB3 !== true
        ) {
          const phaseClock = latestCombatUpdate.recoilUpdate.phaseClock
            || latestCombatUpdate.recoilUpdate.snapshot?.phaseClock
            || null;
          const appliedHandoff = latestCombatUpdate.recoilUpdate.postCouplingHandoff
            || latestCombatUpdate.recoilUpdate.snapshot?.postCouplingHandoff
            || null;
          step3AContactTransfer = Object.freeze({
            ...step3AContactTransfer,
            handoffConsumedByOldB3: true,
            continuationStartedAtPresentationMs: phaseClock?.previousElapsedMs ?? null,
            continuationStartedAtImpactClockMs:
              latestCombatUpdate.parryReactionClock?.elapsedMs ?? null,
            bodyRestartedAtRelease: false,
            continuationPlanIdentityPreserved:
              appliedHandoff?.planIdentityPreserved === true,
            continuationElapsedPreserved:
              appliedHandoff?.presentationElapsedPreserved === true,
            visibleOldB3StartedAtDeflectImpulse: true,
            authority: 'deflect-impulse-continuity-bridge-to-canonical-old-b3-from-zero',
          });
          status.textContent = `OLD B3 STARTED · ${selectedDirection.toUpperCase()} DEFLECT_IMPULSE released contact · ${step3AReleaseBlend?.durationMs ?? 28}ms continuity bridge · canonical OLD B3 from ${phaseClock?.previousElapsedMs?.toFixed(0) ?? '0'}ms`;
          status.className = 'good';
        }
        if (step3AReleaseBlend) step3AReleaseBlend.elapsedMs += deltaMs;
        if (latestCombatUpdate?.justCompleted && !attackerRecovery) beginAttackRecovery(selectedDirection);
      }
    } else {
      sampleAttackerBase(snapshot, deltaMs);
    }

    guardRuntime.update(deltaMs, camera);
    updateDefenderDeflectReleaseGate();
    if (step3ALiveConstraintNeedsUpdate) {
      const wasHolding = latestGripConstraintReport?.holding === true;
      latestGripConstraintReport = swordGripConstraint.update(deltaSeconds, {
        surfaceAtFrame: buckler.getWorldParrySurface(),
        reactionIntentAppliedBeforeConstraint: false,
      });
      updateLiveContactMarkers(latestGripConstraintReport);
      if (latestGripConstraintReport?.holding) {
        const passed = latestGripConstraintReport.inspectionPassed === true;
        const release = step3AOwnsLiveContact() ? releaseLiveContactToOldB3() : null;
        if (!wasHolding || release?.accepted) {
          const waitingForDefenderImpulse = release?.reason === 'defender-deflect-marker-not-reached';
          const inspectionFallbackUsed = release?.couplingReport?.inspectionFallbackUsed === true;
          status.textContent = release?.accepted
            ? inspectionFallbackUsed
              ? `PARRY CONFIRMED · ${selectedDirection.toUpperCase()} ${formatInspectionFailureSummary(latestGripConstraintReport)} · DEFLECT_IMPULSE fail-safe release · OLD B3 starts at 0ms`
              : `LIVE CONTACT VERIFIED · 7/7 PASS · ${selectedDirection.toUpperCase()} DEFLECT_IMPULSE · releasing contact through 28ms bridge · OLD B3 starts at 0ms`
            : waitingForDefenderImpulse
              ? `${passed ? 'LIVE CONTACT VERIFIED · 7/7 PASS' : `PARRY CONFIRMED · ${formatInspectionFailureSummary(latestGripConstraintReport)}`} · waiting for defender DEFLECT ${release.defenderReleaseGate.sourceTimeSeconds.toFixed(3)}s / ${release.defenderReleaseGate.requiredSourceTimeSeconds.toFixed(3)}s`
              : passed
                ? `LIVE CONTACT VERIFIED · 7/7 PASS · ${selectedDirection.toUpperCase()} weapon-arm handoff deferred while TOP/RIGHT are calibrated first`
                : `STEP 3A HOLD · ${formatInspectionFailureSummary(latestGripConstraintReport)}`;
          status.className = release?.accepted || passed ? 'good' : waitingForDefenderImpulse ? 'warn' : 'bad';
        }
      }
    }
    attackerSword.update(); defenderSword?.update();
    recordVisibleOldB3Sample(latestCombatUpdate);

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
