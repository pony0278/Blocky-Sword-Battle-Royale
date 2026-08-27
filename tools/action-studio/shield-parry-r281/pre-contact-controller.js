import { createVisualOwnershipRuntimeTaps } from './visual-ownership-runtime-taps.js';
import { createBoundedShieldArmAdditiveRuntime } from '../../../src/combat/predictive-parry-arm-additive.js';
import {
  analyzeTopDirectionCompatibilityProbe,
  normalizeTopDirectionCompatibilityVariant,
  shouldRetainTopDirectionAdditive,
} from '../../../src/combat/parry-top-direction-compatibility-probe.js';
import { createTopPrepReadabilityHoldRuntime } from '../../../src/combat/parry-top-prep-readability-hold.js';
import { createGuardCoverageLatch } from '../../../src/combat/guard-coverage-latch.js';
import { createGuardCoverageTargetTracker, selectGuardCoverageTarget } from '../../../src/combat/guard-coverage-target.js';
import { GUARD_MODE_STANCE_REACH_PROFILE } from '../../../src/combat/guard-residual-stance-reach.js';

const TOP_DIRECTION_PROBE_ARM_BONES = Object.freeze(['upperarm.l', 'lowerarm.l']);

function captureTopDirectionProbeArmPose(rig) {
  const bones = rig?.bones || {};
  return Object.freeze(Object.fromEntries(
    TOP_DIRECTION_PROBE_ARM_BONES
      .filter((boneId) => bones[boneId]?.quaternion?.clone)
      .map((boneId) => [boneId, bones[boneId].quaternion.clone().normalize()]),
  ));
}

function restoreTopDirectionProbeArmPose(rig, pose) {
  const bones = rig?.bones || {};
  for (const [boneId, saved] of Object.entries(pose || {})) {
    const quaternion = bones[boneId]?.quaternion;
    if (!quaternion?.copy) continue;
    quaternion.copy(saved).normalize();
  }
}

export function createShieldParryPreContactController({
  exchangeState,
  buckler,
  defender,
  camera,
  bracingRuntime,
  fineTrackingRuntime,
  residualBodyReachRuntime,
  residualStanceReachRuntime,
  predictivePresentation,
  activeInterceptIntent,
  parryGate,
  longswordAttackPhases,
  promptHoldMs,
  debugMode,
  readContext,
  services,
}) {
  const LONGSWORD_ATTACK_PHASES = longswordAttackPhases;
  const PARRY_PROMPT_HOLD_MS = promptHoldMs;
  const visualOwnership = createVisualOwnershipRuntimeTaps({ rig: defender.rig, exchangeState });
  const shieldArmAdditiveRuntime = createBoundedShieldArmAdditiveRuntime();
  const topPrepReadabilityHoldRuntime = createTopPrepReadabilityHoldRuntime();
  const guardCoverageLatch = createGuardCoverageLatch();
  const guardCoverageTargetTracker = createGuardCoverageTargetTracker();
  const topDirectionProbeQuery = typeof globalThis.location?.search === 'string'
    ? new URLSearchParams(globalThis.location.search).get('topProbe')
    : null;
  const topDirectionProbeVariant = normalizeTopDirectionCompatibilityVariant(topDirectionProbeQuery);
  const {
    cloneSurface,
    magnitude,
    planArticulatedImpactBracing,
    planFineGuardTracking,
    predictGuardThreat,
    getGuardThreatTrackingProfile,
    analyzePredictiveInterceptParry,
    evaluateCommittedParryInput,
    measureSweptSwordBucklerClosestApproach,
    selectReachableParryInterceptTarget,
    planGuardThreatCorrection,
    sampleActiveShieldLeadMotion,
    compactInterceptDriveTraceFrame,
    compactInterceptDriveTelemetry,
  } = services;

  function zeroBracePlan() { return planArticulatedImpactBracing({ mode: 'off' }); }

  function updateBlockPreContact(snapshot, currentBlade, deltaSeconds, context) {
    const { previousBlade, defenderSword } = context;
    const baselineSurface = buckler.getWorldParrySurface();
    const bracePlan = previousBlade && snapshot.phase !== LONGSWORD_ATTACK_PHASES.INTERRUPTED
      ? planArticulatedImpactBracing({
          mode: 'brace-fine', attackDirection: snapshot.direction,
          previousBlade, currentBlade, bucklerSurface: baselineSurface, deltaSeconds,
        })
      : zeroBracePlan();
    bracingRuntime.update(bracePlan, deltaSeconds);
    const postBraceSurface = buckler.getWorldParrySurface();
    // R18R.1: Guard reads the threat itself instead of accepting the brace's 7cm cosmetic nudge.
    // planGuardThreatCorrection in 'guard' mode picks the blade point genuinely closest to the
    // shield disc and asks for the full tracking budget, so a low LEFT sweep is a real target
    // rather than a hilt end that happens to graze the shield plane a metre off centre.
    const guardTracking = previousBlade && snapshot.phase !== LONGSWORD_ATTACK_PHASES.INTERRUPTED;
    const guardApproach = guardTracking
      ? measureSweptSwordBucklerClosestApproach({
          previousBlade, currentBlade, bucklerSurface: cloneSurface(postBraceSurface),
        })
      : null;
    const guardTarget = guardTracking
      ? guardCoverageTargetTracker.select({
          sequence: snapshot.sequence,
          deltaSeconds,
          direction: snapshot.direction,
          predictedThreat: predictGuardThreat({
            previousBlade,
            currentBlade,
            bucklerSurface: postBraceSurface,
            deltaSeconds,
            horizonSeconds: getGuardThreatTrackingProfile('guard').horizonSeconds,
            selection: getGuardThreatTrackingProfile('guard').threatSelection,
            extrapolation: getGuardThreatTrackingProfile('guard').threatExtrapolation,
          }),
          approach: guardApproach,
          bucklerSurface: postBraceSurface,
        })
      : null;
    const guardPlan = guardTarget?.threat
      ? planGuardThreatCorrection({
          mode: 'guard',
          threat: guardTarget.threat,
          bucklerSurface: postBraceSurface,
        })
      : planFineGuardTracking({
          threat: null,
          bucklerSurface: postBraceSurface,
          maxCorrectionMeters: 0,
        });
    exchangeState.latestFinePlan = guardCoverageLatch.update({
      plan: guardPlan,
      sequence: snapshot.sequence,
      committed: snapshot.phase !== LONGSWORD_ATTACK_PHASES.INTERRUPTED,
      deltaMs: deltaSeconds * 1000,
      currentOffset: fineTrackingRuntime.offset,
      approach: guardApproach,
      engaged: Boolean(guardTarget?.engaged),
    });
    exchangeState.latestFineTracking = fineTrackingRuntime.update(exchangeState.latestFinePlan, deltaSeconds);
    // R18R.6: The primary plan is authored against the neutral surface. Once the shield has moved,
    // which blade point is nearest has changed too, so the last centimetres are closed against the
    // surface as it now stands - the same residual pass Parry runs, at Guard's budget.
    const guardResidualSurface = guardTracking ? cloneSurface(buckler.getWorldParrySurface()) : null;
    const guardResidualApproach = guardResidualSurface
      ? measureSweptSwordBucklerClosestApproach({
          previousBlade, currentBlade, bucklerSurface: guardResidualSurface,
        })
      : null;
    const guardResidualTarget = guardResidualApproach && guardResidualApproach.combinedGapMeters > 1e-4
      ? selectGuardCoverageTarget({
          direction: snapshot.direction,
          predictedThreat: null,
          approach: guardResidualApproach,
          bucklerSurface: guardResidualSurface,
        })
      : null;
    const guardResidualPlan = guardResidualTarget?.engaged
      ? planGuardThreatCorrection({
          mode: 'guard',
          threat: guardResidualTarget.threat,
          bucklerSurface: guardResidualSurface,
        })
      : null;
    exchangeState.latestGuardResidual = guardResidualPlan?.appliedDistance > 1e-6
      ? fineTrackingRuntime.refineMeasuredContact(guardResidualPlan, deltaSeconds, {
          speedScale: 1,
          jointBudgetScale: 0.35,
          maxResidualMeters: 0.08,
          iterations: 2,
        })
      : null;
    // R18R.10: Guard's shield arm runs out of envelope with the blade still a few centimetres off
    // the disc, so it recruits the same planted crouch Parry uses, at Parry's crouch budget, with
    // the plane cues relaxed to what Guard's arm can actually deliver. The stance decides for
    // itself whether the threat is low enough to be worth dropping for.
    const guardStanceApproach = guardTracking
      ? measureSweptSwordBucklerClosestApproach({
          previousBlade, currentBlade, bucklerSurface: cloneSurface(buckler.getWorldParrySurface()),
        })
      : null;
    exchangeState.latestGuardStanceReach = residualStanceReachRuntime.update({
      mode: guardTracking ? 'guard' : 'off',
      profile: GUARD_MODE_STANCE_REACH_PROFILE,
      closestApproach: guardStanceApproach,
      // Crouching at 1.05m/s cannot be started in the two frames where the blade is measurable, so
      // the stance is offered the same coverage target the shield arm is already aiming at. Early
      // in the swing that is the directional anchor, which is exactly the read a defender makes
      // when they drop into a low guard before the sword is anywhere near them.
      anticipatedClosestApproach: guardTarget?.threat?.worldPoint
        ? { point: guardTarget.threat.worldPoint }
        : null,
      anticipatedLeadSeconds: guardTarget?.threat?.futureSeconds ?? null,
      // What the shield arm is attempting and achieving this frame, so the stance can tell the
      // difference between "the arm is still closing this" and "the arm has done all it can".
      armEvidence: {
        extensionRatio: 0,
        correctionAttemptedMeters: exchangeState.latestFinePlan?.appliedDistance ?? 0,
        correctionAchievedMeters: exchangeState.latestFineTracking?.achievedDistance ?? 0,
        edgeGapBeforeMeters: guardApproach?.radialGapMeters ?? 0,
        edgeGapAfterMeters: guardStanceApproach?.radialGapMeters ?? 0,
      },
    }, deltaSeconds);
    const guardTracked = guardTracking
      ? measureSweptSwordBucklerClosestApproach({
          previousBlade, currentBlade, bucklerSurface: cloneSurface(buckler.getWorldParrySurface()),
        })
      : null;
    exchangeState.latestGuardCoverage = Object.freeze({
      ...guardCoverageLatch.report,
      // The gap the latch reports is measured against the neutral surface, before this frame's
      // tracking moved the shield. This one is measured after, so it says whether the guard
      // actually closed the line rather than whether it wanted to.
      trackedGapMeters: guardTracked?.combinedGapMeters ?? null,
      trackedPlaneGapMeters: guardTracked?.planeGapMeters ?? null,
      trackedRadialGapMeters: guardTracked?.radialGapMeters ?? null,
    });
    defender.update(0, camera); defenderSword?.update();
    exchangeState.previousShieldLeadSurface = cloneSurface(buckler.getWorldParrySurface());
  }

  function updateParryPreContact(snapshot, currentBlade, deltaSeconds, context) {
    const {
      selectedMode,
      slowReviewChecked,
      previousBlade,
      defenderSword,
      debugStanceProfile,
    } = context;
    if (exchangeState.parryPromptHold?.sequence === snapshot.sequence && !parryGate.attempt) {
      exchangeState.latestPredictiveAnalysis = exchangeState.parryPromptHold.predictiveAnalysis;
      exchangeState.latestParryOpportunity = exchangeState.parryPromptHold.opportunity;
      exchangeState.previousShieldLeadSurface = cloneSurface(buckler.getWorldParrySurface());
      return;
    }
    const beforeSurface = cloneSurface(buckler.getWorldParrySurface());
    exchangeState.latestPredictiveAnalysis = analyzePredictiveInterceptParry({
      attackSnapshot: snapshot,
      previousBlade,
      currentBlade,
      bucklerSurface: beforeSurface,
      deltaSeconds,
      requestedGrade: selectedMode,
    });
    exchangeState.latestParryOpportunity = evaluateCommittedParryInput({
      attackSnapshot: snapshot,
      predictiveAnalysis: exchangeState.latestPredictiveAnalysis,
      manual: false,
      profile: parryGate.profile,
    });
    if (slowReviewChecked
      && exchangeState.latestParryOpportunity.accepted
      && exchangeState.parryPromptHoldSequence !== snapshot.sequence) {
      exchangeState.parryPromptHoldSequence = snapshot.sequence;
      exchangeState.parryPromptHold = {
        sequence: snapshot.sequence,
        remainingRealMs: PARRY_PROMPT_HOLD_MS,
        opportunity: exchangeState.latestParryOpportunity,
        predictiveAnalysis: exchangeState.latestPredictiveAnalysis,
      };
    }

    if (predictivePresentation.active) {
      exchangeState.latestPredictiveReport = predictivePresentation.update({
        deltaSeconds,
        timeToContactSeconds: exchangeState.latestPredictiveAnalysis?.timeToContactSeconds,
        preserveShieldArm: Boolean(activeInterceptIntent?.active),
        camera,
      });
      visualOwnership.afterPredictive(exchangeState.latestPredictiveReport);
      const predictiveSurface = cloneSurface(buckler.getWorldParrySurface());
      const continuitySurface = exchangeState.previousShieldLeadSurface
        ? cloneSurface(exchangeState.previousShieldLeadSurface)
        : predictiveSurface;
      const measuredClosestApproach = measureSweptSwordBucklerClosestApproach({
        previousBlade,
        currentBlade,
        bucklerSurface: continuitySurface,
      });
      const activeIntentPlan = activeInterceptIntent?.plan({
        sequence: snapshot.sequence,
        bucklerSurface: predictiveSurface,
      }) || null;
      exchangeState.latestReachableInterceptTarget = selectReachableParryInterceptTarget({
        predictedThreat: exchangeState.latestPredictiveAnalysis?.threat,
        predictedTrackingPlan: exchangeState.latestPredictiveAnalysis?.trackingPlan,
        closestApproach: measuredClosestApproach,
        bucklerSurface: continuitySurface,
      });
      exchangeState.latestFinePlan = activeIntentPlan || (exchangeState.latestReachableInterceptTarget?.fallbackApplied
        ? exchangeState.latestReachableInterceptTarget.trackingPlan
        : exchangeState.latestReachableInterceptTarget?.threat
          ? planGuardThreatCorrection({
              mode: 'parry',
              threat: exchangeState.latestReachableInterceptTarget.threat,
              bucklerSurface: predictiveSurface,
            })
          : null);
      const trackingSurfaceBefore = cloneSurface(buckler.getWorldParrySurface());
      // R18N.3: Guard/Parry presentation is allowed to rebuild its authored pose every frame.
      // Keep the tracking runtime's bounded carry across frames and apply it after presentation,
      // so currentOffset acts as an absolute additive world-space correction and Active Intercept
      // remains the last writer of the shield-arm pose before real swept contact is evaluated.
      exchangeState.latestFineTracking = fineTrackingRuntime.update(exchangeState.latestFinePlan, deltaSeconds);
      visualOwnership.afterPrimaryArm(exchangeState.latestFineTracking);
      const residualCarryBeforeMeters = magnitude(exchangeState.latestFineTracking?.carriedResidualOffset);
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
      visualOwnership.afterResidualArm(residualRefinement);
      const residualAfterArmRefinement = measureSweptSwordBucklerClosestApproach({
        previousBlade,
        currentBlade,
        bucklerSurface: cloneSurface(buckler.getWorldParrySurface()),
      });
      const residualBodyReach = activeIntentPlan
        ? residualBodyReachRuntime.trackWorldTarget({
            targetCenter: activeInterceptIntent?.report?.targetCenter,
          }, deltaSeconds)
        : residualBodyReachRuntime.update({
            mode: 'parry',
            closestApproach: residualAfterArmRefinement,
          }, deltaSeconds);
      visualOwnership.afterBody(residualBodyReach);
      const residualAfterBodyReach = measureSweptSwordBucklerClosestApproach({
        previousBlade,
        currentBlade,
        bucklerSurface: cloneSurface(buckler.getWorldParrySurface()),
      });
      const residualStanceReach = residualStanceReachRuntime.update({
        mode: 'parry',
        profile: debugMode ? debugStanceProfile : null,
        closestApproach: residualAfterBodyReach,
        anticipatedClosestApproach: exchangeState.latestPredictiveAnalysis?.threat?.worldPoint
          ? { point: exchangeState.latestPredictiveAnalysis.threat.worldPoint }
          : null,
        anticipatedLeadSeconds: exchangeState.latestPredictiveAnalysis?.threat?.futureSeconds ?? null,
        armEvidence: {
          extensionRatio: residualBodyReach.armExtensionRatio ?? 0,
          correctionAttemptedMeters: residualTrackingPlan?.appliedDistance ?? 0,
          correctionAchievedMeters: residualRefinement?.achievedDistance ?? 0,
          edgeGapBeforeMeters: residualBeforeRefinement.radialGapMeters,
          edgeGapAfterMeters: residualAfterArmRefinement.radialGapMeters,
        },
      }, deltaSeconds);
      visualOwnership.afterStance(residualStanceReach);
      const topDirectionProbeActive = Boolean(topDirectionProbeVariant)
        && snapshot.direction === 'top'
        && Boolean(activeIntentPlan);
      const topDirectionProbeBeforeSurface = topDirectionProbeActive
        ? cloneSurface(buckler.getWorldParrySurface())
        : null;
      const topDirectionProbeArmPose = topDirectionProbeActive && topDirectionProbeVariant === 'C'
        ? captureTopDirectionProbeArmPose(defender.rig)
        : null;
      const shieldArmBoundedAdditive = shieldArmAdditiveRuntime.update({
        rig: defender.rig,
        authoredDelta: exchangeState.latestPredictiveReport?.shieldArmAuthoredDelta,
        sequence: snapshot.sequence,
        enabled: Boolean(activeIntentPlan)
          && !(topDirectionProbeActive && topDirectionProbeVariant === 'A'),
      });
      let topDirectionCompatibilityProbe = null;
      if (topDirectionProbeActive) {
        // getWorldParrySurface() updates the parry anchor and its parents, so the probe can
        // measure the authored arm displacement without an extra full defender presentation rebuild.
        const probeAfterAdditiveSurface = cloneSurface(buckler.getWorldParrySurface());
        const baseProbe = analyzeTopDirectionCompatibilityProbe({
          direction: snapshot.direction,
          variant: topDirectionProbeVariant,
          beforeCenter: topDirectionProbeBeforeSurface.center,
          afterCenter: probeAfterAdditiveSurface.center,
          targetCenter: activeInterceptIntent?.report?.targetCenter || null,
          additiveApplied: shieldArmBoundedAdditive?.applied === true,
        });
        let retained = true;
        let appliedBehavior = topDirectionProbeVariant === 'A'
          ? 'solver-only-baseline'
          : 'generic-bounded-additive';
        if (topDirectionProbeVariant === 'C' && !shouldRetainTopDirectionAdditive(baseProbe)) {
          restoreTopDirectionProbeArmPose(defender.rig, topDirectionProbeArmPose);
          retained = false;
          appliedBehavior = 'direction-incompatible-additive-rejected';
        } else if (topDirectionProbeVariant === 'C') {
          appliedBehavior = 'direction-compatible-additive-retained';
        }
        topDirectionCompatibilityProbe = Object.freeze({
          ...baseProbe,
          retained,
          appliedBehavior,
          finalProbeCenter: Object.freeze(cloneSurface(buckler.getWorldParrySurface()).center),
        });
      }
      visualOwnership.afterShieldArmAdditive(shieldArmBoundedAdditive);
      const topPrepReadabilityHold = topPrepReadabilityHoldRuntime.update({
        rig: defender.rig,
        sequence: snapshot.sequence,
        direction: snapshot.direction,
        enabled: Boolean(activeIntentPlan) && !topDirectionProbeActive,
        presentationElapsedMs: exchangeState.latestPredictiveReport?.presentationElapsedMs,
        timeToContactSeconds: exchangeState.latestPredictiveAnalysis?.timeToContactSeconds,
      });
      visualOwnership.afterTopPrepReadabilityHold(topPrepReadabilityHold);
      const activeInterceptArmClosure = activeIntentPlan
        ? fineTrackingRuntime.refineWorldTarget(activeInterceptIntent?.report?.targetCenter, {
            jointBudgetScale: 0.6,
            iterations: 2,
          })
        : null;
      if (activeIntentPlan
        && snapshot.direction === 'top'
        && !topDirectionProbeActive
        && !topPrepReadabilityHoldRuntime.armed) {
        topPrepReadabilityHoldRuntime.arm({
          rig: defender.rig,
          sequence: snapshot.sequence,
          direction: snapshot.direction,
        });
      }
      visualOwnership.afterFinalClosure(activeInterceptArmClosure);
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
      const plannedCorrectionVector = exchangeState.latestFinePlan?.correction || null;
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
      const activeInterceptTargetCenter = activeIntentPlan ? activeInterceptIntent?.report?.targetCenter : null;
      const activeInterceptTargetErrorBeforeMeters = activeInterceptTargetCenter
        ? Math.hypot(
            activeInterceptTargetCenter.x - trackingSurfaceBefore.center.x,
            activeInterceptTargetCenter.y - trackingSurfaceBefore.center.y,
            activeInterceptTargetCenter.z - trackingSurfaceBefore.center.z,
          )
        : null;
      const activeInterceptTargetErrorAfterMeters = activeInterceptTargetCenter
        ? Math.hypot(
            activeInterceptTargetCenter.x - trackingSurfaceAfter.center.x,
            activeInterceptTargetCenter.y - trackingSurfaceAfter.center.y,
            activeInterceptTargetCenter.z - trackingSurfaceAfter.center.z,
          )
        : null;
      exchangeState.latestInterceptDriveReport = Object.freeze({
        attackPhase: snapshot.phase,
        elapsedSeconds: snapshot.elapsedSeconds,
        timeToContactSeconds: exchangeState.latestPredictiveAnalysis?.timeToContactSeconds ?? null,
        presentationActive: true,
        selectorBaseline: 'previous-frame-post-tracking-world-shield-surface',
        selectionSource: exchangeState.latestReachableInterceptTarget?.source ?? 'none',
        drivePlanSource: activeIntentPlan
          ? 'latched-f-active-intercept-intent'
          : exchangeState.latestReachableInterceptTarget?.fallbackApplied
            ? 'surface-relative-measured-contact-correction'
            : 'current-presentation-linear-contact-correction',
        activeInterceptIntent: activeInterceptIntent?.report ?? null,
        activeInterceptPoseAuthority: activeIntentPlan
          ? 'post-guard-post-predictive-absolute-world-offset-last-writer'
          : null,
        activeInterceptPrimaryCarryMeters: activeIntentPlan
          ? magnitude(exchangeState.latestFineTracking?.requestedOffset)
          : null,
        activeInterceptResidualCarryMeters: activeIntentPlan
          ? (residualRefinement?.carriedResidualDistance ?? 0)
          : null,
        activeInterceptSupportAuthority: activeIntentPlan
          ? residualBodyReach?.authority ?? null
          : null,
        activeInterceptArmClosure,
        shieldArmBoundedAdditive,
        topDirectionCompatibilityProbe,
        topPrepReadabilityHold,
        activeInterceptTargetErrorBeforeMeters,
        activeInterceptTargetErrorAfterMeters,
        fallbackApplied: exchangeState.latestReachableInterceptTarget?.fallbackApplied === true,
        predictedReachable: exchangeState.latestReachableInterceptTarget?.predictedReachable ?? null,
        measuredReachable: exchangeState.latestReachableInterceptTarget?.measuredReachable ?? null,
        measuredInsideAcquisitionBand: exchangeState.latestReachableInterceptTarget?.measuredInsideAcquisitionBand ?? null,
        predictedRequiredDistanceMeters: exchangeState.latestReachableInterceptTarget?.predictedRequiredDistanceMeters ?? null,
        measuredRequiredDistanceMeters: exchangeState.latestReachableInterceptTarget?.measuredRequiredDistanceMeters ?? null,
        measuredRadialContactCorrectionMeters: exchangeState.latestReachableInterceptTarget?.measuredRadialContactCorrectionMeters ?? null,
        measuredContactCorrectionMeters: exchangeState.latestReachableInterceptTarget?.measuredContactCorrectionMeters ?? null,
        measuredClosestApproach,
        planRequiredDistanceMeters: exchangeState.latestFinePlan?.requiredDistance ?? null,
        planAppliedDistanceMeters: exchangeState.latestFinePlan?.appliedDistance ?? null,
        planReachable: exchangeState.latestFinePlan?.reachable ?? null,
        trackingAchievedDistanceMeters: exchangeState.latestFineTracking?.achievedDistance ?? null,
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
        authority: activeIntentPlan
          ? 'guard-and-predictive-presentation-then-active-intercept-arm-plus-fixed-target-support-last-writer-held-to-real-contact'
          : 'persistent-arm-carry-then-predicted-or-measured-low-threat-planted-stance-held-to-real-contact-or-reset-diagnostic',
      });
      exchangeState.interceptDriveTrace.push(compactInterceptDriveTraceFrame(exchangeState.latestInterceptDriveReport));
      if (exchangeState.interceptDriveTrace.length > 96) exchangeState.interceptDriveTrace.shift();
    } else {
      shieldArmAdditiveRuntime.reset();
      topPrepReadabilityHoldRuntime.reset();
      residualBodyReachRuntime.reset();
      residualStanceReachRuntime.reset();
      exchangeState.latestReachableInterceptTarget = null;
      exchangeState.latestFinePlan = null;
      exchangeState.latestFineTracking = null;
      exchangeState.latestInterceptDriveReport = null;
    }

    const afterSurface = cloneSurface(buckler.getWorldParrySurface());
    exchangeState.latestShieldLeadMotion = sampleActiveShieldLeadMotion({
      previousSurface: exchangeState.previousShieldLeadSurface || beforeSurface,
      currentSurface: afterSurface,
      deltaSeconds,
    });
    exchangeState.previousShieldLeadSurface = afterSurface;
  }
  function armActiveIntercept(snapshot) {
    topPrepReadabilityHoldRuntime.reset();
    return activeInterceptIntent?.arm({
      sequence: snapshot?.sequence,
      direction: snapshot?.direction,
      bucklerSurface: cloneSurface(buckler.getWorldParrySurface()),
      predictiveAnalysis: exchangeState.latestPredictiveAnalysis,
    }) || Object.freeze({ accepted: false, reason: 'active-intercept-intent-unavailable' });
  }

  function resetActiveIntercept() {
    activeInterceptIntent?.reset();
    shieldArmAdditiveRuntime.reset();
    topPrepReadabilityHoldRuntime.reset();
    guardCoverageLatch.reset();
    guardCoverageTargetTracker.reset();
    visualOwnership.reset();
  }

  function updatePreContact(snapshot, currentBlade, deltaSeconds) {
    const context = readContext();
    if (!snapshot.action || exchangeState.firstContact) return;
    const observeVisualOwnership = context.selectedMode === 'parry';
    if (observeVisualOwnership) visualOwnership.beginFrame(snapshot);
    try {
      if (context.selectedMode === 'block') updateBlockPreContact(snapshot, currentBlade, deltaSeconds, context);
      else updateParryPreContact(snapshot, currentBlade, deltaSeconds, context);
    } finally {
      if (observeVisualOwnership) visualOwnership.finishFrame();
    }
  }

  function recordWhiffProbe(snapshot, probe) {
    const { selectedMode } = readContext();
    if (selectedMode !== 'parry' || !parryGate.armed || !snapshot?.action || !probe) return;
    exchangeState.whiffProbeFrames += 1;
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
      probeDeltaSeconds: Number.isFinite(Number(probe.diagnostics?.deltaSeconds))
        ? Number(probe.diagnostics.deltaSeconds)
        : null,
      geometricContact: probe.geometricContact === true,
      eligible: probe.eligible === true,
      shieldRadiusMeters: probe.surface?.radius ?? null,
      shieldThicknessMeters: probe.surface?.thickness ?? null,
      predictedGeometryReason: exchangeState.latestPredictiveAnalysis?.geometryReason ?? exchangeState.latestPredictiveAnalysis?.reason ?? null,
      trackingRequiredDistanceMeters: exchangeState.latestFinePlan?.requiredDistance ?? exchangeState.latestParryInput?.requiredShieldTravelMeters ?? null,
      trackingAppliedDistanceMeters: exchangeState.latestFinePlan?.appliedDistance ?? null,
      trackingAchievedDistanceMeters: exchangeState.latestFineTracking?.achievedDistance ?? null,
      trackingReachable: exchangeState.latestFinePlan?.reachable ?? null,
      interceptTargetSource: exchangeState.latestReachableInterceptTarget?.source ?? null,
      interceptFallbackApplied: exchangeState.latestReachableInterceptTarget?.fallbackApplied === true,
      predictedRequiredDistanceMeters: exchangeState.latestReachableInterceptTarget?.predictedRequiredDistanceMeters ?? null,
      measuredRequiredDistanceMeters: exchangeState.latestReachableInterceptTarget?.measuredRequiredDistanceMeters ?? null,
      interceptDriveReport: compactInterceptDriveTelemetry(exchangeState.latestInterceptDriveReport),
    });
    if (!exchangeState.closestWhiffApproach
      || record.combinedGapMeters < exchangeState.closestWhiffApproach.combinedGapMeters
      || (record.combinedGapMeters === exchangeState.closestWhiffApproach.combinedGapMeters
        && Math.abs(record.timeToContactSeconds ?? Infinity) < Math.abs(exchangeState.closestWhiffApproach.timeToContactSeconds ?? Infinity))) {
      exchangeState.closestWhiffApproach = record;
    }
    if (probe.geometricContact === true && probe.contact !== true
      && (!exchangeState.outsideActiveContact
        || Math.abs(record.timeToContactSeconds ?? Infinity) < Math.abs(exchangeState.outsideActiveContact.timeToContactSeconds ?? Infinity))) {
      exchangeState.outsideActiveContact = record;
    }
  }

  return Object.freeze({
    update: updatePreContact,
    recordWhiffProbe,
    armActiveIntercept,
    resetActiveIntercept,
    get activeInterceptIntentReport() { return activeInterceptIntent?.report ?? null; },
  });
}
