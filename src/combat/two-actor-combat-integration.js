import { createLongswordDirectionalAttackRuntime } from './longsword-directional-attack-runtime.js';
import { createGuardStateMachine, GUARD_EVENTS, GUARD_STATES } from './guard-state-machine.js';
import { createGuardOutcomeResolutionGate } from './guard-outcome-resolution.js';
import { createDirectionalRecoilPlanner } from './directional-recoil-planner.js';
import { createAttackerRecoilPresentationRuntime } from './attacker-recoil-presentation.js';

export const TWO_ACTOR_COMBAT_INTEGRATION_STAGE = 'G4.3B.4';

export const TWO_ACTOR_COMBAT_PHASES = Object.freeze({
  IDLE: 'idle',
  ATTACKING: 'attacking',
  RECOIL: 'attacker-recoil',
});

function freeze(value) {
  return Object.freeze(value);
}

function integrationFailure(reason, snapshot, extra = {}) {
  return freeze({
    stage: TWO_ACTOR_COMBAT_INTEGRATION_STAGE,
    accepted: false,
    reason,
    ...extra,
    snapshot,
  });
}

export function createTwoActorCombatIntegration(options = {}) {
  const attackRuntime = options.attackRuntime || createLongswordDirectionalAttackRuntime(options.attackOptions);
  const guardMachine = options.guardMachine || createGuardStateMachine(options.guardOptions);
  const outcomeGate = options.outcomeGate || createGuardOutcomeResolutionGate(options.outcomeOptions);
  const recoilPlanner = options.recoilPlanner || createDirectionalRecoilPlanner(options.recoilOptions);
  const attackerCharacter = options.attackerCharacter || null;
  const sampleFrozenContactPose = typeof options.sampleFrozenContactPose === 'function'
    ? options.sampleFrozenContactPose
    : null;
  const attackerRecoil = options.attackerRecoil || (
    options.THREE && attackerCharacter?.rig
      ? createAttackerRecoilPresentationRuntime(options.THREE, {
          rig: attackerCharacter.rig,
          profile: options.attackerRecoilProfile,
        })
      : null
  );

  if (!attackRuntime?.start || !attackRuntime?.interrupt || !attackRuntime?.releaseInterruption) {
    throw new Error('G4.3B.4 requires the G4.3B.1 attack interruption runtime');
  }
  if (!guardMachine?.send || !guardMachine?.can) {
    throw new Error('G4.3B.4 requires a guard state machine');
  }
  if (!outcomeGate?.resolve || !outcomeGate?.reset) {
    throw new Error('G4.3B.4 requires the G4.3A.4 outcome resolution gate');
  }
  if (!recoilPlanner?.plan) {
    throw new Error('G4.3B.4 requires the G4.3B.2 directional recoil planner');
  }
  if (!attackerRecoil?.start || !attackerRecoil?.update || !attackerRecoil?.reset) {
    throw new Error('G4.3B.4 requires the G4.3B.3 attacker recoil presentation runtime');
  }
  if (!sampleFrozenContactPose && !attackerCharacter?.sampleAnimation) {
    throw new Error('G4.3B.4 requires a frozen-contact-pose sampler');
  }

  let activeExchange = null;
  let lastExchange = null;
  let lastFailure = null;

  function phase() {
    if (activeExchange) return TWO_ACTOR_COMBAT_PHASES.RECOIL;
    if (attackRuntime.active || attackRuntime.interrupted) return TWO_ACTOR_COMBAT_PHASES.ATTACKING;
    return TWO_ACTOR_COMBAT_PHASES.IDLE;
  }

  function snapshot(extra = {}) {
    return freeze({
      stage: TWO_ACTOR_COMBAT_INTEGRATION_STAGE,
      phase: phase(),
      attack: attackRuntime.snapshot,
      defenderGuard: guardMachine.snapshot,
      attackerRecoil: attackerRecoil.snapshot || null,
      activeExchange,
      lastExchange,
      lastFailure,
      authority: 'two-actor-combat-orchestration',
      ...extra,
    });
  }

  function rememberFailure(reason, details = {}) {
    lastFailure = freeze({
      stage: TWO_ACTOR_COMBAT_INTEGRATION_STAGE,
      reason,
      ...details,
    });
    return lastFailure;
  }

  function rollbackResolvedSequence(sequence) {
    attackerRecoil.reset();
    if (attackRuntime.interrupted) attackRuntime.releaseInterruption();
    outcomeGate.reset(sequence);
  }

  function startAttack(direction, startOptions = {}) {
    if (activeExchange || attackerRecoil.active || attackRuntime.interrupted) {
      return integrationFailure('combat-exchange-still-active', snapshot());
    }
    const started = attackRuntime.start(direction, startOptions);
    if (!started.accepted) {
      rememberFailure(started.reason || 'attack-start-rejected');
      return integrationFailure(started.reason || 'attack-start-rejected', snapshot(), { attackStart: started });
    }
    lastFailure = null;
    return freeze({
      stage: TWO_ACTOR_COMBAT_INTEGRATION_STAGE,
      accepted: true,
      reason: 'attack-started',
      attackStart: started,
      snapshot: snapshot(),
    });
  }

  function canDispatchDefenderEvent(event) {
    if (guardMachine.can(event)) return true;
    return guardMachine.state === GUARD_STATES.ENTER
      && guardMachine.guardHeld === true
      && guardMachine.can(GUARD_EVENTS.ENTER_COMPLETE)
      && (event === GUARD_EVENTS.BLOCK_CONFIRMED || event === GUARD_EVENTS.PARRY_CONFIRMED);
  }

  function bridgeGuardEnterForCombatOutcome(resolution) {
    if (guardMachine.state !== GUARD_STATES.ENTER) return null;
    const bridged = guardMachine.send(GUARD_EVENTS.ENTER_COMPLETE, {
      stage: TWO_ACTOR_COMBAT_INTEGRATION_STAGE,
      source: 'authoritative-combat-outcome-bridge',
      attackSequence: resolution.attackSequence,
      outcome: resolution.outcome,
    });
    return bridged;
  }

  function resolveContact(input = {}) {
    if (activeExchange) {
      const duplicate = outcomeGate.resolve({
        attackSequence: activeExchange.sequence,
        attackDirection: activeExchange.attackDirection,
        attackPhase: 'attack_active',
        contact: input.contact || input,
        guardSnapshot: guardMachine.snapshot,
        guardIntentAgeMs: input.guardIntentAgeMs,
      });
      return freeze({
        stage: TWO_ACTOR_COMBAT_INTEGRATION_STAGE,
        accepted: false,
        reason: duplicate.duplicate ? 'attack-sequence-already-resolved' : 'combat-exchange-already-active',
        resolution: duplicate,
        snapshot: snapshot(),
      });
    }

    const attackSnapshot = attackRuntime.snapshot;
    const contact = input.contact || input;
    const resolution = outcomeGate.resolve({
      attackSequence: attackSnapshot.sequence,
      attackDirection: attackSnapshot.direction,
      attackPhase: attackSnapshot.phase,
      contact,
      guardSnapshot: input.guardSnapshot || guardMachine.snapshot,
      guardIntentAgeMs: input.guardIntentAgeMs,
    });

    if (!resolution.resolved) {
      return integrationFailure(resolution.reason || 'guard-outcome-not-resolved', snapshot(), { resolution });
    }
    if (resolution.duplicate || !resolution.emitGuardEvent) {
      return integrationFailure('attack-sequence-already-resolved', snapshot(), { resolution });
    }
    if (!canDispatchDefenderEvent(resolution.defender.event)) {
      outcomeGate.reset(resolution.attackSequence);
      rememberFailure('defender-event-not-dispatchable', {
        attackSequence: resolution.attackSequence,
        event: resolution.defender.event,
      });
      return integrationFailure('defender-event-not-dispatchable', snapshot(), { resolution });
    }

    const interrupted = attackRuntime.interrupt({ resolution });
    if (!interrupted.accepted) {
      outcomeGate.reset(resolution.attackSequence);
      rememberFailure(interrupted.reason || 'attack-interrupt-rejected', {
        attackSequence: resolution.attackSequence,
      });
      return integrationFailure(interrupted.reason || 'attack-interrupt-rejected', snapshot(), {
        resolution,
        interrupted,
      });
    }

    const recoilPlan = recoilPlanner.plan(interrupted.snapshot);
    if (!recoilPlan.planned) {
      rollbackResolvedSequence(resolution.attackSequence);
      rememberFailure(recoilPlan.reason || 'recoil-plan-rejected', {
        attackSequence: resolution.attackSequence,
      });
      return integrationFailure(recoilPlan.reason || 'recoil-plan-rejected', snapshot(), {
        resolution,
        interrupted,
        recoilPlan,
      });
    }

    const recoilStart = attackerRecoil.start(recoilPlan);
    if (!recoilStart.accepted) {
      rollbackResolvedSequence(resolution.attackSequence);
      rememberFailure(recoilStart.reason || 'attacker-recoil-start-rejected', {
        attackSequence: resolution.attackSequence,
      });
      return integrationFailure(recoilStart.reason || 'attacker-recoil-start-rejected', snapshot(), {
        resolution,
        interrupted,
        recoilPlan,
        recoilStart,
      });
    }

    const enterBridge = bridgeGuardEnterForCombatOutcome(resolution);
    const defenderDispatch = guardMachine.send(resolution.defender.event, resolution.defender.payload);
    if (!defenderDispatch.accepted) {
      rollbackResolvedSequence(resolution.attackSequence);
      rememberFailure('defender-event-dispatch-failed', {
        attackSequence: resolution.attackSequence,
        event: resolution.defender.event,
      });
      return integrationFailure('defender-event-dispatch-failed', snapshot(), {
        resolution,
        interrupted,
        recoilPlan,
        recoilStart,
        enterBridge,
        defenderDispatch,
      });
    }

    activeExchange = freeze({
      stage: TWO_ACTOR_COMBAT_INTEGRATION_STAGE,
      sequence: resolution.attackSequence,
      attackDirection: resolution.attackDirection,
      outcome: resolution.outcome,
      responseClass: resolution.attacker.responseClass,
      resolution,
      interruption: interrupted.snapshot.interruption,
      recoilPlan,
      defenderEvent: resolution.defender.event,
      defenderReactionVariant: resolution.defender.reactionVariant,
      enterBridgeApplied: Boolean(enterBridge?.accepted),
    });
    lastFailure = null;

    return freeze({
      stage: TWO_ACTOR_COMBAT_INTEGRATION_STAGE,
      accepted: true,
      reason: 'two-actor-combat-exchange-resolved',
      resolution,
      interrupted,
      recoilPlan,
      recoilStart,
      enterBridge,
      defenderDispatch,
      snapshot: snapshot(),
    });
  }

  function sampleFrozenPose(context = {}) {
    const interruption = attackRuntime.snapshot.interruption;
    if (!interruption) return false;

    if (sampleFrozenContactPose) {
      sampleFrozenContactPose(interruption, activeExchange, context);
      return true;
    }

    attackerCharacter.sampleAnimation(interruption.clipId, interruption.sourceTimeSeconds, {
      loop: false,
      inPlace: interruption.inPlace !== false,
      rootRotationPolicy: interruption.rootRotationPolicy,
    });
    attackerCharacter.update?.(0, context.camera || options.camera);
    return true;
  }

  function update(deltaSeconds = 1 / 60, context = {}) {
    if (!activeExchange) return snapshot({ updated: false });

    const sampledFrozenPose = sampleFrozenPose(context);
    const recoilUpdate = attackerRecoil.update(deltaSeconds);
    const completed = recoilUpdate?.justCompleted === true
      || recoilUpdate?.completed?.readyForAttackHandoff === true;

    if (!completed) {
      return snapshot({
        updated: true,
        sampledFrozenPose,
        recoilUpdate,
      });
    }

    const completedExchange = activeExchange;
    const released = attackRuntime.releaseInterruption();
    lastExchange = freeze({
      ...completedExchange,
      completed: released.accepted === true,
      attackerHandoffReleased: released.accepted === true,
      defenderStateAtAttackerHandoff: guardMachine.state,
    });
    activeExchange = null;

    if (!released.accepted) {
      rememberFailure(released.reason || 'attack-interruption-release-failed', {
        attackSequence: completedExchange.sequence,
      });
    }

    return snapshot({
      updated: true,
      sampledFrozenPose,
      recoilUpdate,
      justCompleted: true,
      released,
    });
  }

  function reset({ resetGuard = false } = {}) {
    attackerRecoil.reset();
    attackRuntime.reset();
    outcomeGate.reset();
    activeExchange = null;
    lastExchange = null;
    lastFailure = null;
    if (resetGuard) guardMachine.send(GUARD_EVENTS.RESET, { stage: TWO_ACTOR_COMBAT_INTEGRATION_STAGE });
    return snapshot();
  }

  return freeze({
    get snapshot() { return snapshot(); },
    get active() { return Boolean(activeExchange); },
    get attackRuntime() { return attackRuntime; },
    get guardMachine() { return guardMachine; },
    get recoilPlanner() { return recoilPlanner; },
    get attackerRecoil() { return attackerRecoil; },
    startAttack,
    resolveContact,
    update,
    reset,
  });
}
