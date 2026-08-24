import { createDebugSword, mountDebugSword } from '../../src/character/debug-sword.js';
import { DEFAULT_KAYKIT_SWORD_MOUNT } from '../../src/character/default-character-mount.js';
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
import { createShieldParryContactHandoffController } from './shield-parry-r281/contact-handoff-controller.js';
import { createShieldParryLabScene } from './shield-parry-r281/lab-scene.js';
import { createShieldParryInspectionOverlay } from './shield-parry-r281/inspection-overlay.js';


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

const labScene = createShieldParryLabScene({ THREE, documentRef: document, windowRef: window });
const {
  canvas, renderer, scene, camera, freeCamera, attacker, defender, attackerSword, buckler, resize, setView,
} = labScene;
const inspectionOverlay = createShieldParryInspectionOverlay({ THREE, scene });
let defenderSword = null;

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

const contactHandoffController = createShieldParryContactHandoffController({
  exchangeState,
  buckler,
  attacker,
  attackerSword,
  camera,
  combat,
  swordGripConstraint,
  guardRuntime,
  predictivePresentation,
  parryGate,
  preContactController,
  fineTrackingRuntime,
  residualBodyReachRuntime,
  residualStanceReachRuntime,
  constants: {
    TIMING_AGE_MS,
    PARRY_ATTACKER_RELEASE_SOURCE_SECONDS,
    LONGSWORD_ATTACK_PHASES,
    GUARD_STATES,
    COMMITTED_PARRY_CONTACT_GATE_STAGE,
    LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
    TWO_ACTOR_PARRY_REACTION_CHANNELS,
    TWO_ACTOR_PARRY_REACTION_PHASE_LATCHES,
  },
  services: {
    probeSweptSwordBucklerContact,
    captureRigPose,
    buildLiveParryOldB3Handoff,
    sampleLiveParryOldB3ReleaseBlend,
    publishPostCouplingRecoilStaggerHandoff,
    measureAttackerRecoilWorldSilhouette,
  },
  callbacks: {
    captureCanonicalAttackerOldB3Base: () => captureCanonicalAttackerOldB3Base(attackRuntime.snapshot.interruption),
    captureAttackerWorldSilhouette,
    updateLiveContactMarkers: (report) => inspectionOverlay.update(report),
    formatInspectionFailureSummary,
    publishStatus({ text, className }) {
      status.textContent = text;
      status.className = className;
    },
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
  inspectionOverlay.clear();
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
  return contactHandoffController.ownsLiveContact();
}

function updateDefenderDeflectReleaseGate() {
  return contactHandoffController.updateDefenderDeflectReleaseGate();
}

function defenderDeflectReleaseGate() {
  return contactHandoffController.defenderDeflectReleaseGate();
}

function releaseLiveContactToOldB3() {
  return contactHandoffController.releaseLiveContactToOldB3({ selectedDirection });
}

function recordVisibleOldB3Sample(combatUpdate) {
  return contactHandoffController.recordVisibleOldB3Sample(combatUpdate);
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
  return contactHandoffController.resolveContact(snapshot, currentBlade, deltaSeconds, {
    previousBlade,
    selectedMode,
    selectedDirection,
  });
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

    const contactFrame = contactHandoffController.updateCombatBeforeGuard({
      deltaSeconds,
      deltaMs,
      selectedDirection,
      hasAttackerRecovery: Boolean(attackerRecovery),
      beginAttackRecovery,
    });
    if (!contactFrame.handledCombat) sampleAttackerBase(snapshot, deltaMs);

    guardRuntime.update(deltaMs, camera);
    contactHandoffController.updateDefenderDeflectReleaseGate();
    contactHandoffController.updateLiveConstraintAfterGuard({
      deltaSeconds,
      selectedDirection,
      needsUpdate: contactFrame.liveConstraintNeedsUpdate,
    });
    attackerSword.update(); defenderSword?.update();
    contactHandoffController.recordVisibleOldB3Sample(exchangeState.latestCombatUpdate);

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
