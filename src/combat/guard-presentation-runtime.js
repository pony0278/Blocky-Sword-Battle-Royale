import {
  GUARD_EVENTS,
  GUARD_STATES,
} from './guard-state-machine.js';
import {
  sampleGuardPresentationWeights,
  sampleGuardTransitionProfile,
} from './guard-transition-presentation.js';
import { sampleGuardReactionProfile } from './guard-reaction-presentation.js';
import { sampleGuardCounterProfile } from './guard-counter-presentation.js';
import { LONGSWORD_GUARD_AUTHORING_STATE } from './longsword-guard-metadata.js';
import { applyGuardQuaternionOffsetsWeighted } from './longsword-guard-correction.js';
import {
  applyObjectTransform,
  applyRigPose,
  blendRecoveryTransform,
  captureObjectTransform,
  captureRigPose,
  resolveGuardRecoveryProfile,
  samplePoseMatchedRecovery,
} from './guard-recovery-bridge.js';

function positiveDuration(character, clipId, fallback = 1) {
  const value = Number(character?.getAnimationDuration?.(clipId));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function requiredDuration(character, clipId, role) {
  const value = Number(character?.getAnimationDuration?.(clipId));
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${role} requires registered animation ${clipId}`);
  }
  return value;
}

function wrappedTime(elapsedMs, durationSeconds) {
  const duration = Math.max(1e-6, Number(durationSeconds) || 1);
  const elapsed = Math.max(0, Number(elapsedMs) || 0) / 1000;
  return elapsed % duration;
}

function reactionPayload(snapshot) {
  return snapshot?.lastTransition?.payload || {};
}

function reactionCompletionPayload(report) {
  return Object.freeze({
    source: 'guard-presentation-runtime',
    reactionProfileId: report?.reactionProfileId || null,
    reactionVariant: report?.reactionVariant || null,
    sourceTimeSeconds: Number(report?.sourceTimeSeconds) || 0,
    counterWindowOpen: Boolean(report?.counterWindowOpen),
  });
}

function counterCompletionPayload(report) {
  return Object.freeze({
    source: 'guard-presentation-runtime',
    counterProfileId: report?.counterProfileId || null,
    clipId: report?.clipId || null,
    sourceTimeSeconds: Number(report?.sourceTimeSeconds) || 0,
  });
}

function defaultReport(snapshot) {
  return Object.freeze({
    managed: false,
    state: snapshot?.state || GUARD_STATES.NEUTRAL,
    clipId: snapshot?.presentation?.clipId || null,
    sourceTimeSeconds: 0,
    correctionWeight: 0,
    reactionOverlayWeight: 0,
    reactionProfileId: null,
    reactionVariant: null,
    counterProfileId: null,
    counterWindowOpen: false,
    weaponMountProfileId: snapshot?.presentation?.weaponMountProfileId || null,
    recoveryProfileId: null,
    recoveryProgress: 0,
    recoveryDurationMs: 0,
    recoveryMomentumActive: false,
    recoverySourceState: null,
    complete: false,
    completionEvent: null,
  });
}

export function createGuardPresentationRuntime(THREE, options = {}) {
  const machine = options.machine;
  const character = options.character;
  if (!machine?.update || !machine?.send) throw new Error('Guard presentation runtime requires a guard state machine');
  if (!character?.sampleAnimation || !character?.getAnimationDuration) {
    throw new Error('Guard presentation runtime requires an animation-capable character');
  }

  const guardOffsets = options.guardOffsets || LONGSWORD_GUARD_AUTHORING_STATE.offsets;
  const applyCorrection = options.applyCorrection || ((weight) => (
    applyGuardQuaternionOffsetsWeighted(THREE, character.rig, guardOffsets, weight)
  ));
  const applyWeaponMountProfile = typeof options.applyWeaponMountProfile === 'function'
    ? options.applyWeaponMountProfile
    : () => {};
  const weaponObject3d = options.weaponObject3d || null;
  const autoComplete = options.autoComplete !== false;
  const poseRecoveryEnabled = options.poseRecovery !== false
    && Object.keys(character.rig?.bones || {}).length > 0;
  let lastAutoCompletionSequence = -1;
  let lastStoppedSequence = -1;
  let lastReport = defaultReport(machine.snapshot);
  let previousPoseSample = null;
  let sourcePoseSample = null;
  let recoveryBridge = null;

  function preparePresentation(snapshot) {
    const presentation = snapshot?.presentation || {};
    applyWeaponMountProfile(presentation.weaponMountProfileId || null, snapshot);
    return presentation;
  }

  function rememberSourcePose(snapshot) {
    if (!poseRecoveryEnabled) return;
    const sample = Object.freeze({
      sequence: snapshot.sequence,
      state: snapshot.state,
      elapsedMs: snapshot.elapsedMs,
      pose: captureRigPose(character.rig),
    });
    if (sourcePoseSample?.sequence === snapshot.sequence) previousPoseSample = sourcePoseSample;
    else previousPoseSample = null;
    sourcePoseSample = sample;
  }

  function clearRecoveryBridge() {
    recoveryBridge = null;
  }

  function sampleStableGuard(snapshot, camera) {
    clearRecoveryBridge();
    const presentation = preparePresentation(snapshot);
    const weights = sampleGuardPresentationWeights(snapshot.state, snapshot.elapsedMs);
    const duration = positiveDuration(character, presentation.clipId, 1);
    const sourceTimeSeconds = wrappedTime(snapshot.elapsedMs, duration);
    character.sampleAnimation(presentation.clipId, sourceTimeSeconds, {
      loop: presentation.loop !== false,
      inPlace: presentation.inPlace !== false,
    });
    applyCorrection(weights.correctionWeight);
    character.update?.(0, camera);
    return Object.freeze({
      ...defaultReport(snapshot),
      managed: true,
      state: snapshot.state,
      clipId: presentation.clipId,
      sourceTimeSeconds,
      correctionWeight: weights.correctionWeight,
      reactionOverlayWeight: weights.reactionOverlayWeight,
      weaponMountProfileId: presentation.weaponMountProfileId || null,
    });
  }

  function sampleGenericTransition(snapshot, camera) {
    clearRecoveryBridge();
    const presentation = preparePresentation(snapshot);
    const transition = sampleGuardTransitionProfile(snapshot.state, snapshot.elapsedMs);
    if (!transition) return sampleStableGuard(snapshot, camera);
    const duration = positiveDuration(character, presentation.clipId, 1);
    const sourceTimeSeconds = wrappedTime(snapshot.elapsedMs, duration);
    character.sampleAnimation(presentation.clipId, sourceTimeSeconds, {
      loop: true,
      inPlace: true,
    });
    applyCorrection(transition.weights.correctionWeight);
    character.update?.(0, camera);
    return Object.freeze({
      ...defaultReport(snapshot),
      managed: true,
      state: snapshot.state,
      clipId: presentation.clipId,
      sourceTimeSeconds,
      correctionWeight: transition.weights.correctionWeight,
      reactionOverlayWeight: transition.weights.reactionOverlayWeight,
      weaponMountProfileId: presentation.weaponMountProfileId || null,
      complete: transition.complete,
      completionEvent: transition.completionEvent,
    });
  }

  function beginRecoveryBridge(snapshot, camera) {
    const sourceMount = captureObjectTransform(weaponObject3d);
    const presentation = preparePresentation(snapshot);
    const duration = positiveDuration(character, presentation.clipId, 1);
    character.sampleAnimation(presentation.clipId, 0, { loop: true, inPlace: true });
    applyCorrection(1);
    character.update?.(0, camera);
    recoveryBridge = Object.freeze({
      sequence: snapshot.sequence,
      presentation,
      sourceSample: sourcePoseSample,
      previousSample: previousPoseSample,
      sourceState: sourcePoseSample?.state || null,
      targetPose: captureRigPose(character.rig),
      sourceMount,
      targetMount: captureObjectTransform(weaponObject3d),
      profile: resolveGuardRecoveryProfile(snapshot),
      targetClipDuration: duration,
    });
    return recoveryBridge;
  }

  function samplePoseMatchedRecover(snapshot, camera) {
    if (!poseRecoveryEnabled || !sourcePoseSample?.pose) return sampleGenericTransition(snapshot, camera);
    const bridge = recoveryBridge?.sequence === snapshot.sequence
      ? recoveryBridge
      : beginRecoveryBridge(snapshot, camera);
    const presentation = preparePresentation(snapshot);

    // Sample the exact Guard Hold target pose every frame, then overwrite it with the
    // inertial bridge. This keeps the target deterministic while preserving the source
    // pose at t=0 and landing exactly on Hold at t=1.
    character.sampleAnimation(presentation.clipId, 0, { loop: true, inPlace: true });
    applyCorrection(1);

    const recovery = samplePoseMatchedRecovery(
      snapshot,
      bridge.sourceSample,
      bridge.previousSample,
      bridge.targetPose,
      snapshot.elapsedMs,
      { profile: bridge.profile },
    );
    applyRigPose(character.rig, recovery.pose);

    if (weaponObject3d && bridge.sourceMount && bridge.targetMount) {
      const mount = blendRecoveryTransform(
        bridge.sourceMount,
        bridge.sourceMount,
        bridge.targetMount,
        recovery.progress,
        { durationMs: recovery.durationMs, sampleDeltaMs: 0, momentumScale: 0 },
      );
      applyObjectTransform(weaponObject3d, mount);
    }
    character.update?.(0, camera);

    return Object.freeze({
      ...defaultReport(snapshot),
      managed: true,
      state: snapshot.state,
      clipId: presentation.clipId,
      sourceTimeSeconds: 0,
      correctionWeight: 1,
      reactionOverlayWeight: 1 - recovery.eased,
      weaponMountProfileId: presentation.weaponMountProfileId || null,
      recoveryProfileId: recovery.profile.id,
      recoveryProgress: recovery.progress,
      recoveryDurationMs: recovery.durationMs,
      recoveryMomentumActive: recovery.momentumActive,
      recoverySourceState: bridge.sourceState,
      complete: recovery.complete,
      completionEvent: GUARD_EVENTS.RECOVER_COMPLETE,
    });
  }

  function sampleReaction(snapshot, camera) {
    clearRecoveryBridge();
    const payload = reactionPayload(snapshot);
    const reaction = sampleGuardReactionProfile(snapshot.state, snapshot.elapsedMs, payload);
    if (!reaction) return defaultReport(snapshot);
    const presentation = preparePresentation(snapshot);
    const clipId = reaction.profile.clipId;
    const registeredDuration = positiveDuration(character, clipId, reaction.profile.sourceDurationSeconds);
    if (registeredDuration + 1e-4 < reaction.profile.sourceWindow.endSeconds) {
      throw new Error(`Guard reaction ${clipId} is shorter than its G3.3.2 source window`);
    }
    character.sampleAnimation(clipId, Math.min(reaction.sourceTimeSeconds, registeredDuration), {
      loop: false,
      inPlace: true,
    });
    applyCorrection(reaction.profile.correctionWeight);
    character.update?.(0, camera);
    rememberSourcePose(snapshot);
    return Object.freeze({
      ...defaultReport(snapshot),
      managed: true,
      state: snapshot.state,
      clipId: presentation.clipId,
      sourceTimeSeconds: reaction.sourceTimeSeconds,
      correctionWeight: reaction.profile.correctionWeight,
      reactionOverlayWeight: 1,
      reactionProfileId: reaction.profile.id,
      reactionVariant: reaction.profile.variant,
      counterWindowOpen: reaction.counterWindowOpen,
      weaponMountProfileId: presentation.weaponMountProfileId || null,
      complete: reaction.complete,
      completionEvent: reaction.completionEvent,
    });
  }

  function sampleCounter(snapshot, camera) {
    clearRecoveryBridge();
    const presentation = preparePresentation(snapshot);
    const clipId = presentation.clipId;
    const registeredDuration = requiredDuration(character, clipId, 'G3.4 Guard Counter');
    const counter = sampleGuardCounterProfile(snapshot.elapsedMs, registeredDuration);
    if (!counter) throw new Error(`G3.4 Guard Counter cannot sample ${clipId}`);
    character.sampleAnimation(clipId, counter.sourceTimeSeconds, {
      loop: false,
      inPlace: true,
    });
    applyCorrection(counter.profile.correctionWeight);
    character.update?.(0, camera);
    rememberSourcePose(snapshot);
    return Object.freeze({
      ...defaultReport(snapshot),
      managed: true,
      state: snapshot.state,
      clipId,
      sourceTimeSeconds: counter.sourceTimeSeconds,
      correctionWeight: counter.profile.correctionWeight,
      counterProfileId: counter.profile.id,
      weaponMountProfileId: presentation.weaponMountProfileId || null,
      complete: counter.complete,
      completionEvent: counter.completionEvent,
    });
  }

  function sampleSnapshot(snapshot = machine.snapshot, camera) {
    if (snapshot.state === GUARD_STATES.BLOCK_HIT || snapshot.state === GUARD_STATES.PARRY) {
      lastReport = sampleReaction(snapshot, camera);
      return lastReport;
    }
    if (snapshot.state === GUARD_STATES.COUNTER) {
      lastReport = sampleCounter(snapshot, camera);
      return lastReport;
    }
    if (snapshot.state === GUARD_STATES.RECOVER) {
      lastReport = samplePoseMatchedRecover(snapshot, camera);
      return lastReport;
    }
    if (snapshot.state === GUARD_STATES.ENTER || snapshot.state === GUARD_STATES.EXIT) {
      lastReport = sampleGenericTransition(snapshot, camera);
      return lastReport;
    }
    if (snapshot.state === GUARD_STATES.HOLD) {
      lastReport = sampleStableGuard(snapshot, camera);
      return lastReport;
    }
    if (snapshot.state === GUARD_STATES.NEUTRAL && lastStoppedSequence !== snapshot.sequence) {
      clearRecoveryBridge();
      sourcePoseSample = null;
      previousPoseSample = null;
      character.stopAnimation?.();
      lastStoppedSequence = snapshot.sequence;
    }
    lastReport = defaultReport(snapshot);
    return lastReport;
  }

  function autoCompleteCurrent(snapshot, report, camera) {
    if (!autoComplete || !report.complete || !report.completionEvent) return { snapshot, report };
    if (lastAutoCompletionSequence === snapshot.sequence) return { snapshot, report };
    lastAutoCompletionSequence = snapshot.sequence;
    let payload = Object.freeze({ source: 'guard-presentation-runtime' });
    if (report.reactionProfileId) payload = reactionCompletionPayload(report);
    else if (report.counterProfileId) payload = counterCompletionPayload(report);
    else if (report.recoveryProfileId) {
      payload = Object.freeze({
        source: 'guard-presentation-runtime',
        recoveryProfileId: report.recoveryProfileId,
        recoverySourceState: report.recoverySourceState,
      });
    }
    const result = machine.send(report.completionEvent, payload);
    if (!result.accepted) return { snapshot, report };
    const nextSnapshot = result.snapshot;
    const nextReport = sampleSnapshot(nextSnapshot, camera);
    return { snapshot: nextSnapshot, report: nextReport };
  }

  function update(deltaMs, camera) {
    let snapshot = machine.update(Math.max(0, Number(deltaMs) || 0));
    let report = sampleSnapshot(snapshot, camera);
    ({ snapshot, report } = autoCompleteCurrent(snapshot, report, camera));
    return Object.freeze({ snapshot, report });
  }

  function sync(camera) {
    const snapshot = machine.snapshot;
    const report = sampleSnapshot(snapshot, camera);
    return Object.freeze({ snapshot, report });
  }

  return Object.freeze({
    update,
    sync,
    get report() { return lastReport; },
    get counterWindowOpen() { return Boolean(lastReport.counterWindowOpen); },
  });
}
