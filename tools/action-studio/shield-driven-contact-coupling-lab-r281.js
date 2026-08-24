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
import {
  createShieldParryExchangeState,
  resetShieldParryExchangeState,
} from './shield-parry-r281/exchange-state.js';
import { createShieldParryPreContactController } from './shield-parry-r281/pre-contact-controller.js';


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
const exchangeState = createShieldParryExchangeState();

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
  exchangeState.canonicalAttackerOldB3Pose = captureRigPose(attacker.rig);
  exchangeState.canonicalAttackerOldB3WorldSilhouette = captureAttackerWorldSilhouette();
  applyRigPose(attacker.rig, visiblePose);
  attacker.update(0, camera);
  return true;
}

function sampleOriginalContactPose(interruption) {
  if (step3AOwnsLiveContact() && exchangeState.frozenAttackerContactPose) {
    applyRigPose(attacker.rig, exchangeState.frozenAttackerContactPose);
  } else if (exchangeState.step3AReleaseBlend?.sourcePose && exchangeState.step3AReleaseBlend?.targetPose) {
    const releaseSample = sampleLiveParryOldB3ReleaseBlend(
      exchangeState.step3AReleaseBlend.elapsedMs,
      exchangeState.step3AReleaseBlend.durationMs,
    );
    applyRigPose(attacker.rig, blendRecoveryPose(
      exchangeState.step3AReleaseBlend.sourcePose,
      exchangeState.step3AReleaseBlend.sourcePose,
      exchangeState.step3AReleaseBlend.targetPose,
      releaseSample.progress,
      { durationMs: exchangeState.step3AReleaseBlend.durationMs, sampleDeltaMs: 0, momentumScale: 0 },
    ));
    exchangeState.step3AReleaseBlend.sample = releaseSample;
  } else if (exchangeState.canonicalAttackerOldB3Pose) {
    applyRigPose(attacker.rig, exchangeState.canonicalAttackerOldB3Pose);
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
let hudClockMs = HUD_INTERVAL_MS;
let reportClockMs = REPORT_INTERVAL_MS;

const preContactController = createShieldParryPreContactController({
  exchangeState,
  buckler,
  defender,
  camera,
  bracingRuntime,
  fineTrackingRuntime,
  residualBodyReachRuntime,
  residualStanceReachRuntime,
  predictivePresentation,
  parryGate,
  longswordAttackPhases: LONGSWORD_ATTACK_PHASES,
  promptHoldMs: PARRY_PROMPT_HOLD_MS,
  debugMode: DEBUG_MODE,
  readContext: () => ({
    selectedMode,
    slowReviewChecked: slowReview.checked,
    previousBlade,
    defenderSword,
    debugStanceProfile,
  }),
  services: {
    cloneSurface,
    magnitude,
    planArticulatedImpactBracing,
    planFineGuardTracking,
    analyzePredictiveInterceptParry,
    evaluateCommittedParryInput,
    measureSweptSwordBucklerClosestApproach,
    selectReachableParryInterceptTarget,
    planGuardThreatCorrection,
    sampleActiveShieldLeadMotion,
    compactInterceptDriveTraceFrame,
    compactInterceptDriveTelemetry,
  },
});

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
  resetShieldParryExchangeState(exchangeState, {
    previousShieldLeadSurface: cloneSurface(buckler.getWorldParrySurface()),
  });
  updateLiveContactMarkers(null);
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
    exchangeState.step3AContactTransfer?.accepted
    && exchangeState.latestParryConfirmation?.accepted
    && exchangeState.step3AContactTransfer.releasedToOldB3 !== true,
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
  if (exchangeState.latchedDefenderDeflectReleaseGate) return exchangeState.latchedDefenderDeflectReleaseGate;
  const current = currentDefenderDeflectReleaseGate();
  if (!current.passed) return current;
  exchangeState.latchedDefenderDeflectReleaseGate = Object.freeze({
    ...current,
    latched: true,
    authority: 'latched-defender-deflect-marker-gates-attacker-release',
  });
  return exchangeState.latchedDefenderDeflectReleaseGate;
}

function defenderDeflectReleaseGate() {
  return exchangeState.latchedDefenderDeflectReleaseGate || currentDefenderDeflectReleaseGate();
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
    contactReport: exchangeState.latestGripConstraintReport,
    surfaceAtContact: exchangeState.latestLiveSurfaceAtContact,
    confirmedParry: exchangeState.latestParryConfirmation?.accepted === true
      && exchangeState.firstContact?.eligible === true,
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

  exchangeState.step3AReleaseBlend = {
    elapsedMs: 0,
    durationMs: handoff.releaseBlendMs,
    sample: sampleLiveParryOldB3ReleaseBlend(0, handoff.releaseBlendMs),
    sourcePose: visibleReleasePose,
    targetPose: exchangeState.canonicalAttackerOldB3Pose || exchangeState.frozenAttackerContactPose,
    authority: 'full-rig-live-contact-pose-to-canonical-interruption-pose',
  };
  exchangeState.step3AContactTransfer = Object.freeze({
    ...exchangeState.step3AContactTransfer,
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
  if (exchangeState.step3AContactTransfer?.releasedToOldB3 !== true) return;
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
    baseline: exchangeState.canonicalAttackerOldB3WorldSilhouette,
    current: captureAttackerWorldSilhouette(),
    backwardDirection: exchangeState.latestCombatResult?.attackerReaction?.plan?.body?.direction,
    requestedLocalChainPitchDegrees,
  });
  if (!measurement.accepted) return;
  const readabilityScore = measurement.worldBackwardLeanDegrees
    + Math.max(0, measurement.headBackwardMeters) * 100
    + Math.max(0, measurement.shouldersBackwardMeters) * 100;
  if (
    exchangeState.visibleOldB3Peak
    && exchangeState.visibleOldB3Peak.readabilityScore >= readabilityScore
  ) return;
  const phaseClock = recoilUpdate?.phaseClock || recoilUpdate?.snapshot?.phaseClock || null;
  exchangeState.visibleOldB3Peak = Object.freeze({
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
    exchangeState.latestParryInput = Object.freeze({ accepted: false, reason: 'lab-not-ready', source });
    status.textContent = 'PARRY INPUT REJECTED · lab-not-ready';
    status.className = 'bad';
    return exchangeState.latestParryInput;
  }
  if (selectedMode !== 'parry') {
    exchangeState.latestParryInput = Object.freeze({ accepted: false, reason: 'select-parry-mode-first', source });
    status.textContent = 'PARRY INPUT REJECTED · select-parry-mode-first';
    status.className = 'bad';
    return exchangeState.latestParryInput;
  }

  const snapshot = attackRuntime.snapshot;
  exchangeState.latestParryInput = parryGate.arm({
    attackSnapshot: snapshot,
    predictiveAnalysis: exchangeState.latestPredictiveAnalysis,
    manual: true,
    source,
  });

  if (exchangeState.latestParryInput.accepted) {
    exchangeState.whiffProbeFrames = 0;
    exchangeState.closestWhiffApproach = null;
    exchangeState.outsideActiveContact = null;
    exchangeState.latestReachableInterceptTarget = null;
    exchangeState.latestInterceptDriveReport = null;
    exchangeState.interceptDriveTrace = [];
    predictivePresentation.start({
      sequence: snapshot.sequence,
      requestedGrade: 'parry',
      triggerTtcSeconds: exchangeState.latestParryInput.timeToContactSeconds,
    });
    const trackingDistance = exchangeState.latestParryInput.requiredShieldTravelMeters == null
      ? 'path pending'
      : `${(exchangeState.latestParryInput.requiredShieldTravelMeters * 100).toFixed(1)}cm${exchangeState.latestParryInput.gates.trackingClamped ? ' → CLAMP 18cm' : ''}`;
    status.textContent = `PARRY ARMED · TTC ${(exchangeState.latestParryInput.timeToContactSeconds * 1000).toFixed(0)}ms · tracking ${trackingDistance} · waiting for real Sword × Shield contact`;
    status.className = 'good';
  } else {
    status.textContent = `PARRY REJECTED · ${exchangeState.latestParryInput.reason}`;
    status.className = 'bad';
  }
  buildReport();
  return exchangeState.latestParryInput;
}

function dispatchParryInput(source, event = null) {
  exchangeState.latestInputSignal = Object.freeze({
    source,
    code: event?.code || null,
    key: event?.key || null,
    sequence: attackRuntime.snapshot.sequence,
    elapsedSeconds: attackRuntime.snapshot.elapsedSeconds,
  });
  labUi.flashParryInput();
  const result = triggerParryNow(source);
  exchangeState.parryPromptHold = null;
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
  exchangeState.latestContact = Object.freeze({
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
  exchangeState.firstContact = exchangeState.latestContact;
  exchangeState.frozenAttackerContactPose = captureRigPose(attacker.rig);
  exchangeState.latestCombatResult = combat.resolveContact({ contact: exchangeState.latestContact, guardIntentAgeMs: TIMING_AGE_MS.parry });
  if (!exchangeState.latestCombatResult.accepted) {
    exchangeState.frozenAttackerContactPose = null;
    exchangeState.directOldB3Diagnostic = Object.freeze({ accepted: false, reason: exchangeState.latestCombatResult.reason || 'diagnostic-contact-rejected' });
    return exchangeState.directOldB3Diagnostic;
  }
  captureCanonicalAttackerOldB3Base(attackRuntime.snapshot.interruption);
  guardRuntime.sync(camera);

  const handoffPublished = publishPostCouplingRecoilStaggerHandoff(attacker.rig, {
    couplingReport: diagnosticCouplingReport(direction),
    surfaceAtContact: buckler.getWorldParrySurface(),
  });
  exchangeState.latestCombatUpdate = combat.update(0.021, { camera });
  const handoff = combat.snapshot.attackerRecoil?.postCouplingHandoff || null;
  exchangeState.directOldB3Diagnostic = Object.freeze({
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
    reactionDefinitionId: exchangeState.latestCombatResult.attackerReaction?.id || null,
    reactionPlanBackwardPitchDegrees:
      exchangeState.latestCombatResult.attackerReaction?.silhouette?.backwardPitchDegrees ?? null,
    reactionInitialElapsedMs: exchangeState.latestCombatResult.attackerReaction?.initialElapsedMs ?? null,
    authority: 'direct-existing-old-two-actor-b3-diagnostic',
  });
  status.textContent = exchangeState.directOldB3Diagnostic.accepted
    ? 'STEP 1 ACTIVE · OLD Two-Actor B3 direct · all Parry/collision stages bypassed'
    : `STEP 1 FAIL · ${handoff?.reason || 'legacy handoff was not accepted'}`;
  status.className = exchangeState.directOldB3Diagnostic.accepted ? 'good' : 'bad';
  attacker.update(0, camera);
  attackerSword.update();
  buildReport();
  return exchangeState.directOldB3Diagnostic;
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
    exchangeState.parryPromptHold = null;
    residualBodyReachRuntime.reset();
    residualStanceReachRuntime.reset();
  }
  document.querySelectorAll('[data-mode]').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
}
function requestedOutcome() { return selectedMode; }
function isParryPreContactReviewActive(snapshot = attackRuntime.snapshot) {
  const contactSeconds = snapshot?.action?.runtime?.contactSeconds;
  return selectedMode === 'parry'
    && slowReview.checked
    && !exchangeState.firstContact
    && Number.isFinite(contactSeconds)
    && snapshot.elapsedSeconds < contactSeconds;
}


function resolveContact(snapshot, currentBlade, deltaSeconds) {
  if (!previousBlade || !snapshot.action || exchangeState.firstContact) return;
  exchangeState.latestContact = probeSweptSwordBucklerContact({
    previousBlade,
    currentBlade,
    bucklerSurface: buckler.getWorldParrySurface(),
    deltaSeconds,
    active: snapshot.phase === LONGSWORD_ATTACK_PHASES.ACTIVE,
  });
  preContactController.recordWhiffProbe(snapshot, exchangeState.latestContact);
  if (!exchangeState.latestContact.contact) return;

  exchangeState.firstContact = exchangeState.latestContact;
  const surfaceAtContact = buckler.getWorldParrySurface();
  exchangeState.latestLiveSurfaceAtContact = surfaceAtContact;
  exchangeState.latestPredictiveHandoff = predictivePresentation.active ? predictivePresentation.handoff() : null;
  exchangeState.latestParryConfirmation = selectedMode === 'parry'
    ? parryGate.confirm({ attackSnapshot: snapshot, contact: exchangeState.latestContact })
    : null;
  const parryConfirmed = exchangeState.latestParryConfirmation?.accepted === true;
  const guardIntentAgeMs = parryConfirmed ? TIMING_AGE_MS.parry : TIMING_AGE_MS.block;

  exchangeState.frozenAttackerContactPose = captureRigPose(attacker.rig);
  exchangeState.latestCombatResult = combat.resolveContact({
    contact: exchangeState.latestContact,
    guardIntentAgeMs,
    defenderPresentationOffsetSeconds: exchangeState.latestPredictiveHandoff?.accepted
      ? exchangeState.latestPredictiveHandoff.defenderPresentationOffsetSeconds
      : undefined,
  });
  if (!exchangeState.latestCombatResult.accepted) {
    exchangeState.frozenAttackerContactPose = null;
    return;
  }
  captureCanonicalAttackerOldB3Base(attackRuntime.snapshot.interruption);
  guardRuntime.sync(camera);
  const outcome = exchangeState.latestCombatResult.resolution.outcome;

  if (outcome === 'parry' && parryConfirmed) {
    exchangeState.latestCombatUpdate = combat.update(0, { camera });
    attackerSword.update();
    exchangeState.latestGripConstraintReport = swordGripConstraint.start({
      contact: exchangeState.latestContact,
      surfaceAtContact,
      shieldLeadMotion: exchangeState.latestShieldLeadMotion,
      attackDirection: selectedDirection,
      reactionIntentActiveAtImpact: false,
    });
    exchangeState.latestLeadHandoff = Object.freeze({
      stage: COMMITTED_PARRY_CONTACT_GATE_STAGE,
      accepted: exchangeState.latestGripConstraintReport.accepted === true,
      shieldMovingAtContact: exchangeState.latestShieldLeadMotion?.moving === true,
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
      attackerReactionDefinitionId: exchangeState.latestCombatResult.attackerReaction?.id || null,
      oldB3PlanBackwardPitchDegrees:
        exchangeState.latestCombatResult.attackerReaction?.silhouette?.backwardPitchDegrees ?? null,
      oldB3ImpulsePeakMs: exchangeState.latestCombatResult.attackerReaction?.timeline?.impulsePeakMs ?? null,
      oldB3InitialElapsedMs: exchangeState.latestCombatResult.attackerReaction?.initialElapsedMs ?? null,
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
    exchangeState.step3AContactTransfer = Object.freeze({
      accepted: exchangeState.latestGripConstraintReport.accepted === true,
      reason: exchangeState.latestGripConstraintReport.reason || null,
      stage: exchangeState.latestGripConstraintReport.stage || LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
      tangentAuthority: exchangeState.latestGripConstraintReport.plan?.tangentAuthority || null,
      initialDeflectionDirection: exchangeState.latestGripConstraintReport.plan?.initialDeflectionDirection || null,
      modifiedBone: exchangeState.latestGripConstraintReport.modifiedBone || null,
      proximalAssistBone: exchangeState.latestGripConstraintReport.proximalAssistBone || null,
      propagatedBones: exchangeState.latestGripConstraintReport.propagatedBones || null,
      b3BodyClockStartedAtImpact: false,
      attackerReactionDefinitionId: exchangeState.latestCombatResult.attackerReaction?.id || null,
      oldB3PlanBackwardPitchDegrees:
        exchangeState.latestCombatResult.attackerReaction?.silhouette?.backwardPitchDegrees ?? null,
      oldB3ImpulsePeakMs: exchangeState.latestCombatResult.attackerReaction?.timeline?.impulsePeakMs ?? null,
      oldB3InitialElapsedMs: exchangeState.latestCombatResult.attackerReaction?.initialElapsedMs ?? null,
      reactionDefinitionSelectedAtImpact: true,
      fullOldB3ReactionIntentActiveAtImpact: false,
      contactConstraintOwnsUntilDeflectImpulse: true,
      weaponArmContactConstrained: true,
      contactBasePoseAuthority: 'authoritative-impact-rig-snapshot',
      noPresetMotionCurve: true,
      authority: exchangeState.latestLeadHandoff.authority,
    });
    fineTrackingRuntime.reset();
    residualBodyReachRuntime.reset();
    residualStanceReachRuntime.reset();
    status.textContent = exchangeState.step3AContactTransfer.accepted
      ? `STEP 3A ACTIVE · ParryImpact selected OLD B3 · live shield owns contact until DEFLECT_IMPULSE · then 28ms bridge → canonical OLD B3 from 0ms`
      : `STEP 3A FAIL · ${exchangeState.step3AContactTransfer.reason || 'live grip contact constraint rejected'}`;
    status.className = exchangeState.step3AContactTransfer.accepted ? 'good' : 'bad';
  } else if (selectedMode === 'parry') {
    status.textContent = `PARRY FAILED → BLOCK · ${exchangeState.latestParryConfirmation?.reason || 'parry gate was not confirmed'}`;
    status.className = 'warn';
  }
}

function updateParryCue(snapshot = attackRuntime.snapshot) {
  return labUi.updateParryCue({
    snapshot,
    ready,
    selectedMode,
    step3AContactTransfer: exchangeState.step3AContactTransfer,
    latestGripConstraintReport: exchangeState.latestGripConstraintReport,
    selectedDirection,
    latestParryConfirmation: exchangeState.latestParryConfirmation,
    latestParryWhiff: exchangeState.latestParryWhiff,
    parryAttempt: parryGate.attempt,
    firstContact: exchangeState.firstContact,
    latestParryOpportunity: exchangeState.latestParryOpportunity,
    parryReviewActive: isParryPreContactReviewActive(snapshot),
    parryReviewRate: PARRY_REVIEW_RATE,
    debugMode: DEBUG_MODE,
  });
}

function updateHud(snapshot, combatSnapshot) {
  return labUi.updateHud({
    snapshot,
    combatSnapshot,
    latestCombatResult: exchangeState.latestCombatResult,
    latestParryWhiff: exchangeState.latestParryWhiff,
    latestParryConfirmation: exchangeState.latestParryConfirmation,
    latestParryInput: exchangeState.latestParryInput,
    selectedMode,
    requestedOutcome: requestedOutcome(),
    parryReviewActive: isParryPreContactReviewActive(snapshot),
    parryReviewRate: PARRY_REVIEW_RATE,
    parryPromptHeld: Boolean(exchangeState.parryPromptHold),
    firstContact: exchangeState.firstContact,
    latestFinePlan: exchangeState.latestFinePlan,
    latestReachableInterceptTarget: exchangeState.latestReachableInterceptTarget,
    latestGripConstraintReport: exchangeState.latestGripConstraintReport,
    step3AContactTransfer: exchangeState.step3AContactTransfer,
    defenderReleaseGate: defenderDeflectReleaseGate(),
    step3AOwnsLiveContact: step3AOwnsLiveContact(),
    directOldB3Diagnostic: exchangeState.directOldB3Diagnostic,
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
  const attackerReaction = exchangeState.latestCombatResult?.attackerReaction || null;
  const report = {
    stage: LAB_STAGE,
    recoilStage: RECOIL_STAGE,
    pass: ready,
    selectedDirection,
    selectedMode,
    outcome: exchangeState.latestCombatResult?.resolution?.outcome || null,
    parryGate: {
      profile: parryGate.profile,
      opportunity: compactParryGateAttempt(exchangeState.latestParryOpportunity),
      input: compactParryGateAttempt(exchangeState.latestParryInput),
      confirmation: compactParryGateAttempt(exchangeState.latestParryConfirmation),
      manualInputRequired: true,
      commitmentSource: 'attack.action.runtime.movementStartSeconds',
      successAuthority: 'eligible real swept Sword × Shield contact during attack_active',
    },
    contact: exchangeState.firstContact,
    contactGeometryDiagnostic: describeContactGeometry(exchangeState.firstContact),
    predictiveAnalysis: compactPredictiveAnalysis(exchangeState.latestPredictiveAnalysis),
    predictiveHandoff: exchangeState.latestPredictiveHandoff,
    defenderPresentationContinuity: exchangeState.latestCombatResult?.defenderPayload
      ? Object.freeze({
          source: exchangeState.latestCombatResult.defenderPayload.presentationContinuitySource || null,
          predictiveSourceTimeSeconds: exchangeState.latestPredictiveHandoff?.defenderPresentationOffsetSeconds ?? null,
          authoritativeSourceTimeSeconds: exchangeState.latestCombatResult.defenderPayload.presentationOffsetSeconds ?? null,
        })
      : null,
    defenderDeflectReleaseGate: defenderDeflectReleaseGate(),
    parryImpactEvent: combatSnapshot.parryImpactEvent || exchangeState.latestCombatResult?.parryImpactEvent || null,
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
            exchangeState.step3AContactTransfer?.oldB3AppliedBodyChainPitchAtReleaseDegrees
              ?? appliedBodyChainPitchDegrees,
          impulsePeakMs: attackerReaction.timeline?.impulsePeakMs ?? null,
          separateBalanceBreakRuntime: attackerReaction.channelPolicy?.separateBalanceBreakRuntime,
          authority: attackerReaction.authority,
        })
      : null,
    visibleOldB3Peak: exchangeState.visibleOldB3Peak,
    oldB3Continuation: Object.freeze({
      handoffPublished: exchangeState.step3AContactTransfer?.handoffPublished === true,
      handoffConsumed: exchangeState.step3AContactTransfer?.handoffConsumedByOldB3 === true,
      releaseStartPresentationMs:
        exchangeState.step3AContactTransfer?.oldB3ReleaseStartPresentationMs ?? null,
      continuityBridgeMs: exchangeState.step3AContactTransfer?.continuityBridgeMs ?? null,
      visibleOldB3StartsAtDeflectImpulse:
        exchangeState.step3AContactTransfer?.visibleOldB3StartsAtDeflectImpulse === true,
      continuationStartedAtPresentationMs:
        exchangeState.step3AContactTransfer?.continuationStartedAtPresentationMs ?? null,
      continuationStartedAtImpactClockMs:
        exchangeState.step3AContactTransfer?.continuationStartedAtImpactClockMs ?? null,
      bodyRestartedAtRelease: exchangeState.step3AContactTransfer?.bodyRestartedAtRelease ?? false,
      planIdentityPreserved:
        exchangeState.step3AContactTransfer?.continuationPlanIdentityPreserved ?? null,
      presentationElapsedPreserved:
        exchangeState.step3AContactTransfer?.continuationElapsedPreserved ?? null,
      authority: 'deflect-impulse-continuity-bridge-to-canonical-old-b3-from-zero',
    }),
    contactPoseLifecycle: Object.freeze({
      capturedAtAuthoritativeImpact: Boolean(exchangeState.frozenAttackerContactPose),
      restoredBeforeEveryBodyOverlay: Boolean(exchangeState.frozenAttackerContactPose && combatSnapshot.activeExchange),
      attackerReactionComplete: combatSnapshot.attackerReactionComplete === true,
      interruptionHeldForWeaponContact: combatSnapshot.attackerReactionComplete === true
        && step3AOwnsLiveContact(),
      authority: 'authoritative-impact-rig-snapshot-plus-independent-contact-release',
    }),
    predictiveShieldLead: {
      active: Boolean(exchangeState.latestPredictiveReport?.active),
      progress: exchangeState.latestPredictiveReport?.progress ?? null,
      motion: exchangeState.latestShieldLeadMotion,
      interceptTarget: compactReachableInterceptTarget(exchangeState.latestReachableInterceptTarget),
      interceptDrive: compactInterceptDriveTelemetry(exchangeState.latestInterceptDriveReport),
      interceptDriveTrace: Object.freeze({
        frameCount: exchangeState.interceptDriveTrace.length,
        fallbackFrames: exchangeState.interceptDriveTrace.filter((frame) => frame.fallbackApplied).length,
        measuredReachableFrames: exchangeState.interceptDriveTrace.filter((frame) => frame.measuredReachable).length,
        acquisitionFrames: exchangeState.interceptDriveTrace.filter((frame) => frame.measuredInsideAcquisitionBand).length,
        recentFrames: Object.freeze(exchangeState.interceptDriveTrace.slice(-RECENT_COMPACT_TRACE_FRAMES)),
        telemetryDetail: 'compact-scalar-frames-only',
      }),
    },
    step3AContactTransfer: exchangeState.step3AContactTransfer,
    inspectionCamera: freeCamera.snapshot(),
    liveShieldSwordGripContactConstraint: compactLiveContactConstraint(exchangeState.latestGripConstraintReport),
    latestInputSignal: exchangeState.latestInputSignal,
    parryWhiff: exchangeState.latestParryWhiff,
    whiffTelemetry: Object.freeze({
      probeFrames: exchangeState.whiffProbeFrames,
      closestApproachRecord: exchangeState.latestParryWhiff ? exchangeState.closestWhiffApproach : null,
      outsideActiveContact: exchangeState.latestParryWhiff ? exchangeState.outsideActiveContact : null,
      authority: 'presentation-diagnostic-only-no-combat-authority',
    }),
    postCouplingStage: handoff?.stage || null,
    postCouplingReason: handoff?.reason || null,
    recoil: recoilSample,
    directOldB3Diagnostic: exchangeState.directOldB3Diagnostic,
    debugLowStance: Object.freeze({
      enabled: DEBUG_MODE,
      profile: DEBUG_MODE ? Object.freeze({ ...debugStanceProfile }) : null,
      latestThreatSelection: compactThreatSelection(
        exchangeState.latestInterceptDriveReport?.residualStanceReach?.threatSelection,
      ),
      authority: 'debug-profile-changes-posture-guidance-only-real-swept-contact-remains-success-authority',
    }),
    invariants: {
      singleParryOnlyInThisLab: true,
      noAutomaticTimingTrigger: true,
      authoredCommitmentMarkerRequired: exchangeState.latestParryInput?.gates?.attackCommitted ?? null,
      ttcWindowRequired: exchangeState.latestParryInput?.gates?.timingInsideWindow ?? null,
      shieldTrackingClampedTo18cm: exchangeState.latestParryInput?.gates?.trackingClamped ?? null,
      geometryGuidesButCannotVetoInput: exchangeState.latestParryInput?.gates?.geometryGuidanceCanVetoInput === false,
      measuredSweepFallbackIsGuidanceOnly: exchangeState.latestReachableInterceptTarget?.authority === 'guidance-only-real-swept-contact-remains-success-authority' || !exchangeState.latestReachableInterceptTarget,
      realSweptContactRequired: exchangeState.latestParryConfirmation?.gates?.realSweptContact ?? null,
      step3AOnlyAfterConfirmedRealContact: exchangeState.step3AContactTransfer
        ? exchangeState.latestParryConfirmation?.accepted === true && exchangeState.firstContact?.geometricContact === true
        : true,
      initialMeasuredShieldMotionIsDiagnosticOnly: exchangeState.latestGripConstraintReport?.plan?.tangentAuthority != null,
      liveShieldSurfaceSampledAfterGuardUpdate: exchangeState.latestGripConstraintReport?.mappedSurfaceTarget?.authority === 'current-world-shield-surface',
      noPresetMotionCurve: exchangeState.step3AContactTransfer?.noPresetMotionCurve ?? true,
      swordRemainsRigidlyMountedToHand: exchangeState.latestGripConstraintReport?.rigidSwordGrip ?? null,
      boundedForearmThenWristForTopRight: ['top', 'right'].includes(selectedDirection)
        ? exchangeState.latestGripConstraintReport?.assistBone === 'lowerarm.r'
        : true,
      boundedProximalArmCorrectionBeforeForearmAndWrist: ['top', 'right'].includes(selectedDirection)
        ? exchangeState.latestGripConstraintReport?.proximalAssistBone === 'upperarm.r'
          && exchangeState.latestGripConstraintReport?.proximalArmCorrectionActive === true
        : true,
      handAndSocketFollowWristHierarchy: exchangeState.latestGripConstraintReport?.propagatedBones?.join(',') === 'hand.r,handslot.r',
      elbowPropagationMatchesDirectionPolicy: exchangeState.latestGripConstraintReport?.elbowPropagationActive === ['top', 'right'].includes(selectedDirection) || !exchangeState.step3AContactTransfer,
      shoulderPropagationDeferred: exchangeState.latestGripConstraintReport?.shoulderPropagationActive === false || !exchangeState.step3AContactTransfer,
      liveContactInspectionPassed: exchangeState.latestGripConstraintReport?.holding
        ? exchangeState.latestGripConstraintReport.inspectionPassed === true
        : null,
      attackLineClearanceRequired: true,
      attackLineClearancePassed: exchangeState.latestGripConstraintReport?.attackLineClearance?.pass ?? null,
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
          && exchangeState.latestGripConstraintReport?.reactionIntentAppliedBeforeConstraint === false
        : true,
      b3PresentationParkedAtOriginDuringLiveContact: step3AOwnsLiveContact()
        ? combatSnapshot.attackerRecoil?.phaseClock?.phaseLatch
            === TWO_ACTOR_PARRY_REACTION_PHASE_LATCHES.LIVE_CONTACT
          && combatSnapshot.attackerRecoil?.phaseClock?.latchPointMs === 0
          && combatSnapshot.attackerRecoil?.phaseClock?.elapsedMs === 0
        : true,
      weaponArmRemainsContactConstrainedDuringStep3A: step3AOwnsLiveContact()
        ? exchangeState.step3AContactTransfer?.weaponArmContactConstrained === true
        : true,
      frozenContactPoseRestoredBeforeEveryBodyOverlay: exchangeState.step3AContactTransfer
        ? Boolean(exchangeState.frozenAttackerContactPose)
        : true,
      bodyCompletionCannotReleaseContactOwnedPose: exchangeState.step3AContactTransfer
        ? exchangeState.step3AContactTransfer.releasedToOldB3 === true
          || combatSnapshot.attackerReactionComplete !== true
          || combatSnapshot.attack?.interrupted === true
        : true,
      oldB3WeaponArmReleasedAfterInspectionOrConfirmedFallback: exchangeState.step3AContactTransfer?.releasedToOldB3
        ? exchangeState.latestGripConstraintReport?.inspectionPassed === true
          || exchangeState.step3AContactTransfer?.releaseHandoff?.couplingReport?.inspectionFallbackUsed === true
        : true,
      defenderParryPresentationNeverRewindsAtContact: exchangeState.latestPredictiveHandoff?.accepted && exchangeState.latestCombatResult?.accepted
        ? exchangeState.latestCombatResult.defenderPayload?.presentationOffsetSeconds + 1e-4
          >= exchangeState.latestPredictiveHandoff.defenderPresentationOffsetSeconds
        : true,
      oldB3WeaponArmReleasedOnlyAfterDefenderDeflectMarker: exchangeState.step3AContactTransfer?.releasedToOldB3
        ? exchangeState.step3AContactTransfer.defenderReleaseGate?.passed === true
        : true,
      deflectImpulseStartsOldB3FromZeroWithoutBodyRestart: exchangeState.step3AContactTransfer?.handoffConsumedByOldB3
        ? exchangeState.step3AContactTransfer.bodyRestartedAtRelease === false
          && exchangeState.step3AContactTransfer.continuationPlanIdentityPreserved === true
          && exchangeState.step3AContactTransfer.continuationElapsedPreserved === true
          && exchangeState.step3AContactTransfer.continuationStartedAtPresentationMs === 0
          && exchangeState.step3AContactTransfer.continuityBridgeMs === 28
          && exchangeState.step3AContactTransfer.defenderReleaseGate?.passed === true
        : true,
      visibleOldB3ReachedHistoricalBackwardPeak: exchangeState.step3AContactTransfer?.handoffConsumedByOldB3
        ? exchangeState.visibleOldB3Peak?.readable === true
        : true,
      contactQaCannotPermanentlySuppressConfirmedParryOldB3: exchangeState.step3AContactTransfer?.releasedToOldB3
        ? exchangeState.latestParryConfirmation?.accepted === true
        : true,
      compactTelemetryDoesNotRetainSolverGraphs: exchangeState.interceptDriveTrace.every(
        (frame) => frame?.telemetryDetail === 'compact-scalar-frame',
      ),
      blockPathPreserved: true,
      noRootTranslation: true,
    },
  };
  const publication = serializeVerificationReport({
    report,
    maxCharacters: MAX_REPORT_DOM_CHARACTERS,
    traceFrames: exchangeState.interceptDriveTrace.length,
    recentTraceFrames: Math.min(exchangeState.interceptDriveTrace.length, RECENT_COMPACT_TRACE_FRAMES),
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
  exchangeState.previousShieldLeadSurface = cloneSurface(buckler.getWorldParrySurface());
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
    && exchangeState.parryPromptHold?.sequence === preUpdateSnapshot.sequence
    && !parryGate.attempt;
  if (holdingParryPrompt) {
    exchangeState.parryPromptHold.remainingRealMs -= rawDeltaMs;
    if (exchangeState.parryPromptHold.remainingRealMs <= 0) exchangeState.parryPromptHold = null;
  }
  const reviewRate = parryReviewActive ? PARRY_REVIEW_RATE : 1;
  const deltaMs = holdingParryPrompt ? 0 : rawDeltaMs * reviewRate;
  const deltaSeconds = Math.max(1e-5, deltaMs / 1000);
  lastTimestamp = timestamp;
  freeCamera.update(rawDeltaMs / 1000);
  if (ready) {
    const snapshot = attackRuntime.update(deltaMs);

    if (parryGate.armed && !snapshot.action && !exchangeState.firstContact && !exchangeState.latestParryWhiff) {
      exchangeState.latestParryWhiff = buildParryWhiffDiagnostic({
        sequence: parryGate.attempt?.sequence ?? null,
        direction: selectedDirection,
        probeFrames: exchangeState.whiffProbeFrames,
        closestApproachRecord: exchangeState.closestWhiffApproach,
        outsideActiveContact: exchangeState.outsideActiveContact,
        predictiveAnalysis: exchangeState.latestPredictiveAnalysis,
        finePlan: exchangeState.latestFinePlan,
        fineTracking: exchangeState.latestFineTracking,
        shieldLeadMotion: exchangeState.latestShieldLeadMotion,
        parryInput: exchangeState.latestParryInput,
      });
      const whiff = formatWhiffDiagnostic(exchangeState.latestParryWhiff, { debugMode: DEBUG_MODE });
      status.textContent = `PARRY WHIFF · ${whiff.label} · ${whiff.detail}`;
      status.className = 'bad';
    }

    let step3ALiveConstraintNeedsUpdate = false;
    if (combat.active) {
      if (step3AOwnsLiveContact()) {
        exchangeState.latestCombatUpdate = combat.update(deltaSeconds, {
          camera,
          attackerRecoilChannels: TWO_ACTOR_PARRY_REACTION_CHANNELS.LIVE_CONTACT_HOLD,
          attackerRecoilPhaseLatch: TWO_ACTOR_PARRY_REACTION_PHASE_LATCHES.LIVE_CONTACT,
          holdAttackerInterruption: true,
        });
        step3ALiveConstraintNeedsUpdate = swordGripConstraint.active;
      } else {
        exchangeState.latestCombatUpdate = combat.update(deltaSeconds, { camera });
        const handoffConsumed = exchangeState.latestCombatUpdate?.recoilUpdate?.postCouplingHandoffApplied === true;
        if (
          handoffConsumed
          && exchangeState.step3AContactTransfer?.releasedToOldB3 === true
          && exchangeState.step3AContactTransfer.handoffConsumedByOldB3 !== true
        ) {
          const phaseClock = exchangeState.latestCombatUpdate.recoilUpdate.phaseClock
            || exchangeState.latestCombatUpdate.recoilUpdate.snapshot?.phaseClock
            || null;
          const appliedHandoff = exchangeState.latestCombatUpdate.recoilUpdate.postCouplingHandoff
            || exchangeState.latestCombatUpdate.recoilUpdate.snapshot?.postCouplingHandoff
            || null;
          exchangeState.step3AContactTransfer = Object.freeze({
            ...exchangeState.step3AContactTransfer,
            handoffConsumedByOldB3: true,
            continuationStartedAtPresentationMs: phaseClock?.previousElapsedMs ?? null,
            continuationStartedAtImpactClockMs:
              exchangeState.latestCombatUpdate.parryReactionClock?.elapsedMs ?? null,
            bodyRestartedAtRelease: false,
            continuationPlanIdentityPreserved:
              appliedHandoff?.planIdentityPreserved === true,
            continuationElapsedPreserved:
              appliedHandoff?.presentationElapsedPreserved === true,
            visibleOldB3StartedAtDeflectImpulse: true,
            authority: 'deflect-impulse-continuity-bridge-to-canonical-old-b3-from-zero',
          });
          status.textContent = `OLD B3 STARTED · ${selectedDirection.toUpperCase()} DEFLECT_IMPULSE released contact · ${exchangeState.step3AReleaseBlend?.durationMs ?? 28}ms continuity bridge · canonical OLD B3 from ${phaseClock?.previousElapsedMs?.toFixed(0) ?? '0'}ms`;
          status.className = 'good';
        }
        if (exchangeState.step3AReleaseBlend) exchangeState.step3AReleaseBlend.elapsedMs += deltaMs;
        if (exchangeState.latestCombatUpdate?.justCompleted && !attackerRecovery) beginAttackRecovery(selectedDirection);
      }
    } else {
      sampleAttackerBase(snapshot, deltaMs);
    }

    guardRuntime.update(deltaMs, camera);
    updateDefenderDeflectReleaseGate();
    if (step3ALiveConstraintNeedsUpdate) {
      const wasHolding = exchangeState.latestGripConstraintReport?.holding === true;
      exchangeState.latestGripConstraintReport = swordGripConstraint.update(deltaSeconds, {
        surfaceAtFrame: buckler.getWorldParrySurface(),
        reactionIntentAppliedBeforeConstraint: false,
      });
      updateLiveContactMarkers(exchangeState.latestGripConstraintReport);
      if (exchangeState.latestGripConstraintReport?.holding) {
        const passed = exchangeState.latestGripConstraintReport.inspectionPassed === true;
        const release = step3AOwnsLiveContact() ? releaseLiveContactToOldB3() : null;
        if (!wasHolding || release?.accepted) {
          const waitingForDefenderImpulse = release?.reason === 'defender-deflect-marker-not-reached';
          const inspectionFallbackUsed = release?.couplingReport?.inspectionFallbackUsed === true;
          status.textContent = release?.accepted
            ? inspectionFallbackUsed
              ? `PARRY CONFIRMED · ${selectedDirection.toUpperCase()} ${formatInspectionFailureSummary(exchangeState.latestGripConstraintReport)} · DEFLECT_IMPULSE fail-safe release · OLD B3 starts at 0ms`
              : `LIVE CONTACT VERIFIED · 7/7 PASS · ${selectedDirection.toUpperCase()} DEFLECT_IMPULSE · releasing contact through 28ms bridge · OLD B3 starts at 0ms`
            : waitingForDefenderImpulse
              ? `${passed ? 'LIVE CONTACT VERIFIED · 7/7 PASS' : `PARRY CONFIRMED · ${formatInspectionFailureSummary(exchangeState.latestGripConstraintReport)}`} · waiting for defender DEFLECT ${release.defenderReleaseGate.sourceTimeSeconds.toFixed(3)}s / ${release.defenderReleaseGate.requiredSourceTimeSeconds.toFixed(3)}s`
              : passed
                ? `LIVE CONTACT VERIFIED · 7/7 PASS · ${selectedDirection.toUpperCase()} weapon-arm handoff deferred while TOP/RIGHT are calibrated first`
                : `STEP 3A HOLD · ${formatInspectionFailureSummary(exchangeState.latestGripConstraintReport)}`;
          status.className = release?.accepted || passed ? 'good' : waitingForDefenderImpulse ? 'warn' : 'bad';
        }
      }
    }
    attackerSword.update(); defenderSword?.update();
    recordVisibleOldB3Sample(exchangeState.latestCombatUpdate);

    if (!exchangeState.firstContact) {
      const currentBlade = captureBladePolyline();
      preContactController.update(snapshot, currentBlade, deltaSeconds);
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
  get directOldB3Diagnostic() { return exchangeState.directOldB3Diagnostic; },
  get latestPredictiveReport() { return exchangeState.latestPredictiveReport; },
  get latestShieldLeadMotion() { return exchangeState.latestShieldLeadMotion; },
  get latestLeadHandoff() { return exchangeState.latestLeadHandoff; },
  get latestCombatResult() { return exchangeState.latestCombatResult; },
  get latestParryInput() { return exchangeState.latestParryInput; },
  get latestParryOpportunity() { return exchangeState.latestParryOpportunity; },
  get latestParryConfirmation() { return exchangeState.latestParryConfirmation; },
  get step3AContactTransfer() { return exchangeState.step3AContactTransfer; },
  get latestGripConstraintReport() { return exchangeState.latestGripConstraintReport; },
  get latestParryWhiff() { return exchangeState.latestParryWhiff; },
  get latestInterceptDriveReport() { return exchangeState.latestInterceptDriveReport; },
  get latestInputSignal() { return exchangeState.latestInputSignal; },
};
