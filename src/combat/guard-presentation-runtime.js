import {
  GUARD_EVENTS,
  GUARD_STATES,
} from './guard-state-machine.js';
import {
  sampleGuardPresentationWeights,
  sampleGuardTransitionProfile,
} from './guard-transition-presentation.js';
import { sampleGuardReactionProfile } from './guard-reaction-presentation.js';
import { LONGSWORD_GUARD_AUTHORING_STATE } from './longsword-guard-metadata.js';
import { applyGuardQuaternionOffsetsWeighted } from './longsword-guard-correction.js';

function positiveDuration(character, clipId, fallback = 1) {
  const value = Number(character?.getAnimationDuration?.(clipId));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function wrappedTime(elapsedMs, durationSeconds) {
  const duration = Math.max(1e-6, Number(durationSeconds) || 1);
  const elapsed = Math.max(0, Number(elapsedMs) || 0) / 1000;
  return elapsed % duration;
}

function reactionPayload(snapshot) {
  return snapshot?.lastTransition?.payload || {};
}

function completionPayload(sample) {
  return Object.freeze({
    source: 'guard-presentation-runtime',
    reactionProfileId: sample?.profile?.id || null,
    reactionVariant: sample?.profile?.variant || null,
    sourceTimeSeconds: Number(sample?.sourceTimeSeconds) || 0,
    counterWindowOpen: Boolean(sample?.counterWindowOpen),
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
    counterWindowOpen: false,
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
  const autoComplete = options.autoComplete !== false;
  let lastAutoCompletionSequence = -1;
  let lastStoppedSequence = -1;
  let lastReport = defaultReport(machine.snapshot);

  function sampleStableGuard(snapshot, camera) {
    const presentation = snapshot.presentation;
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
      managed: true,
      state: snapshot.state,
      clipId: presentation.clipId,
      sourceTimeSeconds,
      correctionWeight: weights.correctionWeight,
      reactionOverlayWeight: weights.reactionOverlayWeight,
      reactionProfileId: null,
      reactionVariant: null,
      counterWindowOpen: false,
      complete: false,
      completionEvent: null,
    });
  }

  function sampleTransition(snapshot, camera) {
    const presentation = snapshot.presentation;
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
      managed: true,
      state: snapshot.state,
      clipId: presentation.clipId,
      sourceTimeSeconds,
      correctionWeight: transition.weights.correctionWeight,
      reactionOverlayWeight: transition.weights.reactionOverlayWeight,
      reactionProfileId: null,
      reactionVariant: null,
      counterWindowOpen: false,
      complete: transition.complete,
      completionEvent: transition.completionEvent,
    });
  }

  function sampleReaction(snapshot, camera) {
    const payload = reactionPayload(snapshot);
    const reaction = sampleGuardReactionProfile(snapshot.state, snapshot.elapsedMs, payload);
    if (!reaction) return defaultReport(snapshot);
    const presentation = snapshot.presentation;
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
    return Object.freeze({
      managed: true,
      state: snapshot.state,
      clipId: presentation.clipId,
      sourceTimeSeconds: reaction.sourceTimeSeconds,
      correctionWeight: reaction.profile.correctionWeight,
      reactionOverlayWeight: 1,
      reactionProfileId: reaction.profile.id,
      reactionVariant: reaction.profile.variant,
      counterWindowOpen: reaction.counterWindowOpen,
      complete: reaction.complete,
      completionEvent: reaction.completionEvent,
    });
  }

  function sampleSnapshot(snapshot = machine.snapshot, camera) {
    if (snapshot.state === GUARD_STATES.BLOCK_HIT || snapshot.state === GUARD_STATES.PARRY) {
      lastReport = sampleReaction(snapshot, camera);
      return lastReport;
    }
    if (snapshot.state === GUARD_STATES.ENTER
      || snapshot.state === GUARD_STATES.RECOVER
      || snapshot.state === GUARD_STATES.EXIT) {
      lastReport = sampleTransition(snapshot, camera);
      return lastReport;
    }
    if (snapshot.state === GUARD_STATES.HOLD) {
      lastReport = sampleStableGuard(snapshot, camera);
      return lastReport;
    }
    if ((snapshot.state === GUARD_STATES.NEUTRAL || snapshot.state === GUARD_STATES.COUNTER)
      && lastStoppedSequence !== snapshot.sequence) {
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
    const payload = report.reactionProfileId ? completionPayload({
      profile: {
        id: report.reactionProfileId,
        variant: report.reactionVariant,
      },
      sourceTimeSeconds: report.sourceTimeSeconds,
      counterWindowOpen: report.counterWindowOpen,
    }) : Object.freeze({ source: 'guard-presentation-runtime' });
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
