import { readFile, writeFile } from 'node:fs/promises';

const entryPath = 'tools/action-studio/shield-driven-contact-coupling-lab-r281.js';
const controllerPath = 'tools/action-studio/shield-parry-r281/contact-handoff-controller.js';
const testPath = 'tests/shield-parry-r281-contact-handoff-controller.test.js';
const packagePath = 'package.json';

function countOccurrences(source, needle) {
  let count = 0;
  let index = 0;
  while ((index = source.indexOf(needle, index)) !== -1) {
    count += 1;
    index += needle.length;
  }
  return count;
}

function replaceOnce(source, needle, replacement, label = needle) {
  const count = countOccurrences(source, needle);
  if (count !== 1) throw new Error(`${label}: expected 1 occurrence, found ${count}`);
  return source.replace(needle, replacement);
}

function sliceBetween(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end <= start) throw new Error(`${label}: extraction boundary not found`);
  return source.slice(start, end);
}

let entry = await readFile(entryPath, 'utf8');
const originalEntry = entry;
if (entry.includes("./shield-parry-r281/contact-handoff-controller.js")) {
  throw new Error('R18M.6 contact handoff migration already applied');
}

const resolveSource = sliceBetween(
  entry,
  'function resolveContact(snapshot, currentBlade, deltaSeconds) {',
  '\n\nfunction updateParryCue(',
  'resolveContact',
);
if (!resolveSource.includes('probeSweptSwordBucklerContact')) throw new Error('resolveContact lost real swept contact probe');
if (!resolveSource.includes('parryGate.confirm')) throw new Error('resolveContact lost authoritative Parry confirmation');
if (!resolveSource.includes('combat.resolveContact')) throw new Error('resolveContact lost combat authority');
if (!resolveSource.includes('swordGripConstraint.start')) throw new Error('resolveContact lost live grip start');

const lifecycleSource = sliceBetween(
  entry,
  'function step3AOwnsLiveContact() {',
  '\n\nfunction triggerParryNow(',
  'contact/release lifecycle',
);
for (const marker of [
  'PARRY_ATTACKER_RELEASE_SOURCE_SECONDS',
  'buildLiveParryOldB3Handoff',
  'allowConfirmedParryFallback: true',
  'continuityBridgeMs: handoff.releaseBlendMs',
  'publishPostCouplingRecoilStaggerHandoff',
  'recordVisibleOldB3Sample',
]) {
  if (!lifecycleSource.includes(marker)) throw new Error(`lifecycle missing ${marker}`);
}

const controller = `export function createShieldParryContactHandoffController({
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
  constants,
  services,
  callbacks,
}) {
  const {
    TIMING_AGE_MS,
    PARRY_ATTACKER_RELEASE_SOURCE_SECONDS,
    LONGSWORD_ATTACK_PHASES,
    COMMITTED_PARRY_CONTACT_GATE_STAGE,
    LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,
    TWO_ACTOR_PARRY_REACTION_CHANNELS,
    TWO_ACTOR_PARRY_REACTION_PHASE_LATCHES,
  } = constants;
  const {
    probeSweptSwordBucklerContact,
    captureRigPose,
    buildLiveParryOldB3Handoff,
    sampleLiveParryOldB3ReleaseBlend,
    publishPostCouplingRecoilStaggerHandoff,
    measureAttackerRecoilWorldSilhouette,
  } = services;
  const {
    captureCanonicalAttackerOldB3Base,
    captureAttackerWorldSilhouette,
    publishStatus,
    formatInspectionFailureSummary,
  } = callbacks;

  function ownsLiveContact() {
    return Boolean(
      exchangeState.step3AContactTransfer?.accepted
      && exchangeState.latestParryConfirmation?.accepted
      && exchangeState.step3AContactTransfer.releasedToOldB3 !== true,
    );
  }

  function currentDefenderDeflectReleaseGate() {
    const report = guardRuntime.report;
    const sourceTimeSeconds = Math.max(0, Number(report?.sourceTimeSeconds) || 0);
    const passed = report?.state === 'parry'
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

  function releaseLiveContactToOldB3({ selectedDirection }) {
    if (!ownsLiveContact()) {
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
      oldB3AppliedBodyChainPitchAtReleaseDegrees: appliedBodyChainPitchAtReleaseDegrees,
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

  function resolveContact(snapshot, currentBlade, deltaSeconds, context = {}) {
    const { previousBlade, selectedMode, selectedDirection } = context;
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
    captureCanonicalAttackerOldB3Base();
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
      publishStatus({
        text: exchangeState.step3AContactTransfer.accepted
          ? 'STEP 3A ACTIVE · ParryImpact selected OLD B3 · live shield owns contact until DEFLECT_IMPULSE · then 28ms bridge → canonical OLD B3 from 0ms'
          : `STEP 3A FAIL · ${exchangeState.step3AContactTransfer.reason || 'live grip contact constraint rejected'}`,
        className: exchangeState.step3AContactTransfer.accepted ? 'good' : 'bad',
      });
    } else if (selectedMode === 'parry') {
      publishStatus({
        text: `PARRY FAILED → BLOCK · ${exchangeState.latestParryConfirmation?.reason || 'parry gate was not confirmed'}`,
        className: 'warn',
      });
    }
  }

  function updateCombatBeforeGuard({
    deltaSeconds,
    deltaMs,
    selectedDirection,
    hasAttackerRecovery,
    beginAttackRecovery,
  }) {
    const handledCombat = combat.active;
    let liveConstraintNeedsUpdate = false;
    if (!handledCombat) return Object.freeze({ handledCombat: false, liveConstraintNeedsUpdate: false });

    if (ownsLiveContact()) {
      exchangeState.latestCombatUpdate = combat.update(deltaSeconds, {
        camera,
        attackerRecoilChannels: TWO_ACTOR_PARRY_REACTION_CHANNELS.LIVE_CONTACT_HOLD,
        attackerRecoilPhaseLatch: TWO_ACTOR_PARRY_REACTION_PHASE_LATCHES.LIVE_CONTACT,
        holdAttackerInterruption: true,
      });
      liveConstraintNeedsUpdate = swordGripConstraint.active;
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
          continuationPlanIdentityPreserved: appliedHandoff?.planIdentityPreserved === true,
          continuationElapsedPreserved: appliedHandoff?.presentationElapsedPreserved === true,
          visibleOldB3StartedAtDeflectImpulse: true,
          authority: 'deflect-impulse-continuity-bridge-to-canonical-old-b3-from-zero',
        });
        publishStatus({
          text: `OLD B3 STARTED · ${selectedDirection.toUpperCase()} DEFLECT_IMPULSE released contact · ${exchangeState.step3AReleaseBlend?.durationMs ?? 28}ms continuity bridge · canonical OLD B3 from ${phaseClock?.previousElapsedMs?.toFixed(0) ?? '0'}ms`,
          className: 'good',
        });
      }
      if (exchangeState.step3AReleaseBlend) exchangeState.step3AReleaseBlend.elapsedMs += deltaMs;
      if (exchangeState.latestCombatUpdate?.justCompleted && !hasAttackerRecovery) beginAttackRecovery(selectedDirection);
    }
    return Object.freeze({ handledCombat: true, liveConstraintNeedsUpdate });
  }

  function updateLiveConstraintAfterGuard({ deltaSeconds, selectedDirection, needsUpdate }) {
    if (!needsUpdate) return null;
    const wasHolding = exchangeState.latestGripConstraintReport?.holding === true;
    exchangeState.latestGripConstraintReport = swordGripConstraint.update(deltaSeconds, {
      surfaceAtFrame: buckler.getWorldParrySurface(),
      reactionIntentAppliedBeforeConstraint: false,
    });
    callbacks.updateLiveContactMarkers(exchangeState.latestGripConstraintReport);
    if (!exchangeState.latestGripConstraintReport?.holding) return null;

    const passed = exchangeState.latestGripConstraintReport.inspectionPassed === true;
    const release = ownsLiveContact() ? releaseLiveContactToOldB3({ selectedDirection }) : null;
    if (!wasHolding || release?.accepted) {
      const waitingForDefenderImpulse = release?.reason === 'defender-deflect-marker-not-reached';
      const inspectionFallbackUsed = release?.couplingReport?.inspectionFallbackUsed === true;
      const text = release?.accepted
        ? inspectionFallbackUsed
          ? `PARRY CONFIRMED · ${selectedDirection.toUpperCase()} ${formatInspectionFailureSummary(exchangeState.latestGripConstraintReport)} · DEFLECT_IMPULSE fail-safe release · OLD B3 starts at 0ms`
          : `LIVE CONTACT VERIFIED · 7/7 PASS · ${selectedDirection.toUpperCase()} DEFLECT_IMPULSE · releasing contact through 28ms bridge · OLD B3 starts at 0ms`
        : waitingForDefenderImpulse
          ? `${passed ? 'LIVE CONTACT VERIFIED · 7/7 PASS' : `PARRY CONFIRMED · ${formatInspectionFailureSummary(exchangeState.latestGripConstraintReport)}`} · waiting for defender DEFLECT ${release.defenderReleaseGate.sourceTimeSeconds.toFixed(3)}s / ${release.defenderReleaseGate.requiredSourceTimeSeconds.toFixed(3)}s`
          : passed
            ? `LIVE CONTACT VERIFIED · 7/7 PASS · ${selectedDirection.toUpperCase()} weapon-arm handoff deferred while TOP/RIGHT are calibrated first`
            : `STEP 3A HOLD · ${formatInspectionFailureSummary(exchangeState.latestGripConstraintReport)}`;
      publishStatus({
        text,
        className: release?.accepted || passed ? 'good' : waitingForDefenderImpulse ? 'warn' : 'bad',
      });
    }
    return Object.freeze({ release, passed });
  }

  return Object.freeze({
    ownsLiveContact,
    defenderDeflectReleaseGate,
    updateDefenderDeflectReleaseGate,
    releaseLiveContactToOldB3,
    resolveContact,
    updateCombatBeforeGuard,
    updateLiveConstraintAfterGuard,
    recordVisibleOldB3Sample,
  });
}
`;

entry = replaceOnce(
  entry,
  "import { createShieldParryPreContactController } from './shield-parry-r281/pre-contact-controller.js';\n",
  "import { createShieldParryPreContactController } from './shield-parry-r281/pre-contact-controller.js';\nimport { createShieldParryContactHandoffController } from './shield-parry-r281/contact-handoff-controller.js';\n",
  'R18M.6 controller import',
);

entry = entry.replace(lifecycleSource, `function step3AOwnsLiveContact() {\n  return contactHandoffController.ownsLiveContact();\n}\n\nfunction updateDefenderDeflectReleaseGate() {\n  return contactHandoffController.updateDefenderDeflectReleaseGate();\n}\n\nfunction defenderDeflectReleaseGate() {\n  return contactHandoffController.defenderDeflectReleaseGate();\n}\n\nfunction releaseLiveContactToOldB3() {\n  return contactHandoffController.releaseLiveContactToOldB3({ selectedDirection });\n}\n\nfunction recordVisibleOldB3Sample(combatUpdate) {\n  return contactHandoffController.recordVisibleOldB3Sample(combatUpdate);\n}`);

entry = entry.replace(resolveSource, `function resolveContact(snapshot, currentBlade, deltaSeconds) {\n  return contactHandoffController.resolveContact(snapshot, currentBlade, deltaSeconds, {\n    previousBlade,\n    selectedMode,\n    selectedDirection,\n  });\n}`);

const preContactCreationEnd = `  },\n});\n\nconst bladeNodes = [attackerSword.bladeBase, attackerSword.bladeMid, attackerSword.tip];`;
const contactCreation = `  },\n});\n\nconst contactHandoffController = createShieldParryContactHandoffController({\n  exchangeState,\n  buckler,\n  attacker,\n  attackerSword,\n  camera,\n  combat,\n  swordGripConstraint,\n  guardRuntime,\n  predictivePresentation,\n  parryGate,\n  preContactController,\n  fineTrackingRuntime,\n  residualBodyReachRuntime,\n  residualStanceReachRuntime,\n  constants: {\n    TIMING_AGE_MS,\n    PARRY_ATTACKER_RELEASE_SOURCE_SECONDS,\n    LONGSWORD_ATTACK_PHASES,\n    COMMITTED_PARRY_CONTACT_GATE_STAGE,\n    LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,\n    TWO_ACTOR_PARRY_REACTION_CHANNELS,\n    TWO_ACTOR_PARRY_REACTION_PHASE_LATCHES,\n  },\n  services: {\n    probeSweptSwordBucklerContact,\n    captureRigPose,\n    buildLiveParryOldB3Handoff,\n    sampleLiveParryOldB3ReleaseBlend,\n    publishPostCouplingRecoilStaggerHandoff,\n    measureAttackerRecoilWorldSilhouette,\n  },\n  callbacks: {\n    captureCanonicalAttackerOldB3Base: () => captureCanonicalAttackerOldB3Base(attackRuntime.snapshot.interruption),\n    captureAttackerWorldSilhouette,\n    updateLiveContactMarkers,\n    formatInspectionFailureSummary,\n    publishStatus({ text, className }) {\n      status.textContent = text;\n      status.className = className;\n    },\n  },\n});\n\nconst bladeNodes = [attackerSword.bladeBase, attackerSword.bladeMid, attackerSword.tip];`;
entry = replaceOnce(entry, preContactCreationEnd, contactCreation, 'R18M.6 controller construction');

const frameStartMarker = '    let step3ALiveConstraintNeedsUpdate = false;';
const frameEndMarker = '    recordVisibleOldB3Sample(exchangeState.latestCombatUpdate);';
const frameStart = entry.indexOf(frameStartMarker);
const frameEnd = entry.indexOf(frameEndMarker, frameStart);
if (frameStart < 0 || frameEnd <= frameStart) throw new Error('R18M.6 frame ownership block not found');
const frameOriginal = entry.slice(frameStart, frameEnd + frameEndMarker.length);
for (const marker of [
  'TWO_ACTOR_PARRY_REACTION_CHANNELS.LIVE_CONTACT_HOLD',
  'guardRuntime.update',
  'swordGripConstraint.update',
  'releaseLiveContactToOldB3()',
  'postCouplingHandoffApplied === true',
]) {
  if (!frameOriginal.includes(marker)) throw new Error(`R18M.6 frame ownership block missing ${marker}`);
}
const frameReplacement = `    const contactFrame = contactHandoffController.updateCombatBeforeGuard({\n      deltaSeconds,\n      deltaMs,\n      selectedDirection,\n      hasAttackerRecovery: Boolean(attackerRecovery),\n      beginAttackRecovery,\n    });\n    if (!contactFrame.handledCombat) sampleAttackerBase(snapshot, deltaMs);\n\n    guardRuntime.update(deltaMs, camera);\n    contactHandoffController.updateDefenderDeflectReleaseGate();\n    contactHandoffController.updateLiveConstraintAfterGuard({\n      deltaSeconds,\n      selectedDirection,\n      needsUpdate: contactFrame.liveConstraintNeedsUpdate,\n    });\n    attackerSword.update(); defenderSword?.update();\n    contactHandoffController.recordVisibleOldB3Sample(exchangeState.latestCombatUpdate);`;
entry = entry.slice(0, frameStart) + frameReplacement + entry.slice(frameEnd + frameEndMarker.length);

if (!entry.includes('guardRuntime.update(deltaMs, camera);\n    contactHandoffController.updateDefenderDeflectReleaseGate();')) {
  throw new Error('R18M.6 frame ordering lost guard-before-deflect-latch');
}
if (!entry.includes('contactHandoffController.updateDefenderDeflectReleaseGate();\n    contactHandoffController.updateLiveConstraintAfterGuard')) {
  throw new Error('R18M.6 frame ordering lost deflect-latch-before-live-constraint');
}
if (entry.includes('exchangeState.latestContact = probeSweptSwordBucklerContact({')) {
  throw new Error('authoritative swept contact implementation still inline in entry');
}
if (entry.includes('exchangeState.latestGripConstraintReport = swordGripConstraint.start({')) {
  throw new Error('live grip start implementation still inline in entry');
}

const tests = `import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createShieldParryContactHandoffController } from '../tools/action-studio/shield-parry-r281/contact-handoff-controller.js';

const entry = await readFile(new URL('../tools/action-studio/shield-driven-contact-coupling-lab-r281.js', import.meta.url), 'utf8');
const controller = await readFile(new URL('../tools/action-studio/shield-parry-r281/contact-handoff-controller.js', import.meta.url), 'utf8');

function indexOrder(source, markers) {
  let cursor = -1;
  for (const marker of markers) {
    const next = source.indexOf(marker, cursor + 1);
    assert.ok(next > cursor, `expected ${marker} after previous authority marker`);
    cursor = next;
  }
}

test('R18M.6 entry delegates contact/release ownership while preserving frame order', () => {
  assert.equal(typeof createShieldParryContactHandoffController, 'function');
  assert.match(entry, /shield-parry-r281\\/contact-handoff-controller\\.js/);
  assert.match(entry, /contactHandoffController\\.updateCombatBeforeGuard\\(/);
  assert.match(entry, /guardRuntime\\.update\\(deltaMs, camera\\);/);
  assert.match(entry, /contactHandoffController\\.updateDefenderDeflectReleaseGate\\(\\);/);
  assert.match(entry, /contactHandoffController\\.updateLiveConstraintAfterGuard\\(/);
  indexOrder(entry, [
    'contactHandoffController.updateCombatBeforeGuard({',
    'guardRuntime.update(deltaMs, camera);',
    'contactHandoffController.updateDefenderDeflectReleaseGate();',
    'contactHandoffController.updateLiveConstraintAfterGuard({',
  ]);
});

test('R18M.6 real swept Sword × Shield contact remains the only Parry success authority', () => {
  indexOrder(controller, [
    'exchangeState.latestContact = probeSweptSwordBucklerContact({',
    'if (!exchangeState.latestContact.contact) return;',
    'parryGate.confirm({ attackSnapshot: snapshot, contact: exchangeState.latestContact })',
    'exchangeState.latestCombatResult = combat.resolveContact({',
    'exchangeState.latestGripConstraintReport = swordGripConstraint.start({',
  ]);
  assert.match(controller, /active: snapshot\\.phase === LONGSWORD_ATTACK_PHASES\\.ACTIVE/);
  assert.match(controller, /realSweptContact: true/);
});

test('R18M.6 live Sword→Grip ownership holds attacker contact before defender release', () => {
  assert.match(controller, /attackerRecoilChannels: TWO_ACTOR_PARRY_REACTION_CHANNELS\\.LIVE_CONTACT_HOLD/);
  assert.match(controller, /attackerRecoilPhaseLatch: TWO_ACTOR_PARRY_REACTION_PHASE_LATCHES\\.LIVE_CONTACT/);
  assert.match(controller, /holdAttackerInterruption: true/);
  assert.match(controller, /swordGripConstraint\\.update\\(deltaSeconds/);
  assert.match(controller, /contactConstraintOwnsUntilDeflectImpulse: true/);
  assert.match(controller, /weaponArmContactConstrained: true/);
});

test('R18M.6 DEFLECT_IMPULSE latch gates release and confirmed Parry fail-safe stays intact', () => {
  assert.match(controller, /sourceTimeSeconds \+ 1e-4 >= PARRY_ATTACKER_RELEASE_SOURCE_SECONDS/);
  assert.match(controller, /marker: 'deflect-impulse'/);
  assert.match(controller, /latched-defender-deflect-marker-gates-attacker-release/);
  assert.match(controller, /reason: 'defender-deflect-marker-not-reached'/);
  assert.match(controller, /allowConfirmedParryFallback: true/);
  assert.match(controller, /confirmedParry: exchangeState\\.latestParryConfirmation\\?\\.accepted === true/);
});

test('R18M.6 release preserves 28ms bridge and canonical OLD B3 continuation from zero', () => {
  assert.match(controller, /durationMs: handoff\\.releaseBlendMs/);
  assert.match(controller, /continuityBridgeMs: handoff\\.releaseBlendMs/);
  assert.match(controller, /targetPose: exchangeState\\.canonicalAttackerOldB3Pose \|\| exchangeState\\.frozenAttackerContactPose/);
  assert.match(controller, /handoffConsumedByOldB3: true/);
  assert.match(controller, /bodyRestartedAtRelease: false/);
  assert.match(controller, /continuationPlanIdentityPreserved: appliedHandoff\\?\\.planIdentityPreserved === true/);
  assert.match(controller, /continuationElapsedPreserved: appliedHandoff\\?\\.presentationElapsedPreserved === true/);
  assert.match(controller, /deflect-impulse-continuity-bridge-to-canonical-old-b3-from-zero/);
});

test('R18M.6 TOP/RIGHT policy remains data-driven and LEFT release stays delegated to handoff authority', () => {
  assert.match(controller, /selectedDirection === 'top' \|\| selectedDirection === 'right'/);
  assert.match(controller, /buildLiveParryOldB3Handoff\\(\\{/);
  assert.match(controller, /attackDirection: selectedDirection/);
  assert.doesNotMatch(controller, /selectedDirection === 'left'.*releasedToOldB3/s);
  assert.doesNotMatch(controller, /attackDirection: 'left'/);
});

test('R18M.6 contact controller excludes manual input and predictive pre-contact authority', () => {
  assert.doesNotMatch(controller, /parryGate\\.arm\\(/);
  assert.doesNotMatch(controller, /analyzePredictiveInterceptParry\\(/);
  assert.doesNotMatch(controller, /selectReachableParryInterceptTarget\\(/);
  assert.doesNotMatch(controller, /residualStanceReachRuntime\\.update\\(/);
});
`;

let pkg = await readFile(packagePath, 'utf8');
pkg = replaceOnce(
  pkg,
  'tests/shield-parry-r281-pre-contact-controller.test.js tests/shield-sword-hand-contact-coupling.test.js',
  'tests/shield-parry-r281-pre-contact-controller.test.js tests/shield-parry-r281-contact-handoff-controller.test.js tests/shield-sword-hand-contact-coupling.test.js',
  'R18M.6 npm test registration',
);

await writeFile(controllerPath, controller, 'utf8');
await writeFile(testPath, tests, 'utf8');
await writeFile(entryPath, entry, 'utf8');
await writeFile(packagePath, pkg, 'utf8');

console.log('R18M.6 migration prepared:');
console.log('- authoritative swept contact + Parry confirmation + combat resolution extracted');
console.log('- live Sword/Grip start/update ownership extracted');
console.log('- DEFLECT_IMPULSE latch/fail-safe + 28ms OLD B3 handoff extracted');
console.log('- frame keeps combat-before-guard → guard → deflect latch → live constraint ordering');
console.log(`- entry bytes ${originalEntry.length} -> ${entry.length}`);
