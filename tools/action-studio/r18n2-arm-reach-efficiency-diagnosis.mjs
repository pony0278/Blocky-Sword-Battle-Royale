import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`R18N.2 missing marker: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`R18N.2 marker is not unique: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function update(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`R18N.2 produced no change: ${path}`);
  fs.writeFileSync(path, after);
}

update('tools/action-studio/shield-parry-r281/pre-contact-controller.js', (source) => {
  let next = replaceOnce(
    source,
    `    const beforeSurface = cloneSurface(buckler.getWorldParrySurface());
    exchangeState.latestPredictiveAnalysis = analyzePredictiveInterceptParry({`,
    `    const beforeSurface = cloneSurface(buckler.getWorldParrySurface());
    // R18N.2 diagnosis is deliberately read-only. Compare the last surface published by
    // pre-contact with the surface we inherit at the beginning of the next frame. Any
    // difference here happened outside this controller and is therefore pose-retention
    // loss, not arm-solver reach inefficiency.
    const previousPostTrackingSurface = exchangeState.previousShieldLeadSurface
      ? cloneSurface(exchangeState.previousShieldLeadSurface)
      : null;
    const frameEntryResetVector = previousPostTrackingSurface
      ? Object.freeze({
          x: beforeSurface.center.x - previousPostTrackingSurface.center.x,
          y: beforeSurface.center.y - previousPostTrackingSurface.center.y,
          z: beforeSurface.center.z - previousPostTrackingSurface.center.z,
        })
      : null;
    const frameEntryResetMeters = magnitude(frameEntryResetVector);
    exchangeState.latestPredictiveAnalysis = analyzePredictiveInterceptParry({`,
    'capture frame-entry retention loss',
  );

  next = replaceOnce(
    next,
    `      const predictiveSurface = cloneSurface(buckler.getWorldParrySurface());
      const continuitySurface = exchangeState.previousShieldLeadSurface`,
    `      const predictiveSurface = cloneSurface(buckler.getWorldParrySurface());
      const presentationStepVector = Object.freeze({
        x: predictiveSurface.center.x - beforeSurface.center.x,
        y: predictiveSurface.center.y - beforeSurface.center.y,
        z: predictiveSurface.center.z - beforeSurface.center.z,
      });
      const presentationStepMeters = magnitude(presentationStepVector);
      const continuitySurface = exchangeState.previousShieldLeadSurface`,
    'capture presentation-only surface step',
  );

  next = replaceOnce(
    next,
    `      const primaryTrackingSurfaceAfter = cloneSurface(buckler.getWorldParrySurface());
      const residualBeforeRefinement = measureSweptSwordBucklerClosestApproach({`,
    `      const primaryTrackingSurfaceAfter = cloneSurface(buckler.getWorldParrySurface());
      const primaryTrackingStepVector = Object.freeze({
        x: primaryTrackingSurfaceAfter.center.x - trackingSurfaceBefore.center.x,
        y: primaryTrackingSurfaceAfter.center.y - trackingSurfaceBefore.center.y,
        z: primaryTrackingSurfaceAfter.center.z - trackingSurfaceBefore.center.z,
      });
      const primaryTrackingStepMeters = magnitude(primaryTrackingStepVector);
      const residualBeforeRefinement = measureSweptSwordBucklerClosestApproach({`,
    'capture primary arm solve step',
  );

  next = replaceOnce(
    next,
    `      const trackingSurfaceAfter = cloneSurface(buckler.getWorldParrySurface());
      const residualAfterRefinement = measureSweptSwordBucklerClosestApproach({`,
    `      const trackingSurfaceAfter = cloneSurface(buckler.getWorldParrySurface());
      const activeTargetCenter = activeInterceptIntent?.report?.targetCenter || null;
      const distanceToActiveTarget = (surface) => surface && activeTargetCenter
        ? Math.hypot(
            surface.center.x - activeTargetCenter.x,
            surface.center.y - activeTargetCenter.y,
            surface.center.z - activeTargetCenter.z,
          )
        : null;
      const previousPostTargetDistanceMeters = distanceToActiveTarget(previousPostTrackingSurface);
      const frameEntryTargetDistanceMeters = distanceToActiveTarget(beforeSurface);
      const postPresentationTargetDistanceMeters = distanceToActiveTarget(predictiveSurface);
      const postPrimaryTargetDistanceMeters = distanceToActiveTarget(primaryTrackingSurfaceAfter);
      const finalTargetDistanceMeters = distanceToActiveTarget(trackingSurfaceAfter);
      const entryLostConvergenceMeters = Number.isFinite(previousPostTargetDistanceMeters)
        && Number.isFinite(frameEntryTargetDistanceMeters)
        ? frameEntryTargetDistanceMeters - previousPostTargetDistanceMeters
        : null;
      const presentationTargetDeltaMeters = Number.isFinite(frameEntryTargetDistanceMeters)
        && Number.isFinite(postPresentationTargetDistanceMeters)
        ? postPresentationTargetDistanceMeters - frameEntryTargetDistanceMeters
        : null;
      const primaryTargetReductionMeters = Number.isFinite(postPresentationTargetDistanceMeters)
        && Number.isFinite(postPrimaryTargetDistanceMeters)
        ? postPresentationTargetDistanceMeters - postPrimaryTargetDistanceMeters
        : null;
      const postPrimaryTargetDeltaMeters = Number.isFinite(postPrimaryTargetDistanceMeters)
        && Number.isFinite(finalTargetDistanceMeters)
        ? finalTargetDistanceMeters - postPrimaryTargetDistanceMeters
        : null;
      const primaryRequestedMeters = exchangeState.latestFinePlan?.appliedDistance ?? null;
      const primaryAchievedMeters = exchangeState.latestFineTracking?.achievedDistance ?? null;
      const primaryDisplacementEfficiency = Number.isFinite(primaryRequestedMeters)
        && primaryRequestedMeters > 1e-9 && Number.isFinite(primaryAchievedMeters)
        ? primaryAchievedMeters / primaryRequestedMeters
        : null;
      const primaryConvergenceEfficiency = Number.isFinite(primaryRequestedMeters)
        && primaryRequestedMeters > 1e-9 && Number.isFinite(primaryTargetReductionMeters)
        ? primaryTargetReductionMeters / primaryRequestedMeters
        : null;
      const crossFrameRetention = Object.freeze({
        previousPostTrackingSurface,
        frameEntrySurface: beforeSurface,
        postPresentationSurface: predictiveSurface,
        postPrimarySurface: primaryTrackingSurfaceAfter,
        finalSurface: trackingSurfaceAfter,
        frameEntryResetVector,
        frameEntryResetMeters,
        presentationStepVector,
        presentationStepMeters,
        primaryTrackingStepVector,
        primaryTrackingStepMeters,
        previousPostTargetDistanceMeters,
        frameEntryTargetDistanceMeters,
        postPresentationTargetDistanceMeters,
        postPrimaryTargetDistanceMeters,
        finalTargetDistanceMeters,
        entryLostConvergenceMeters,
        presentationTargetDeltaMeters,
        primaryTargetReductionMeters,
        postPrimaryTargetDeltaMeters,
        primaryRequestedMeters,
        primaryAchievedMeters,
        primaryDisplacementEfficiency,
        primaryConvergenceEfficiency,
        appliedDegrees: exchangeState.latestFineTracking?.appliedDegrees ?? null,
        authority: 'read-only-cross-frame-pose-retention-diagnosis',
      });
      const residualAfterRefinement = measureSweptSwordBucklerClosestApproach({`,
    'build cross-frame retention report',
  );

  next = replaceOnce(
    next,
    `        trackingAchievedDistanceMeters: exchangeState.latestFineTracking?.achievedDistance ?? null,
        residualBeforeRefinement,`,
    `        trackingAchievedDistanceMeters: exchangeState.latestFineTracking?.achievedDistance ?? null,
        crossFrameRetention,
        residualBeforeRefinement,`,
    'publish cross-frame retention telemetry',
  );

  return next;
});

update('tools/action-studio/r18n1-active-intercept-browser-probe.mjs', (source) => {
  let next = replaceOnce(
    source,
    `        shieldStepTranslationMeters: drive.shieldStepTranslationMeters ?? null,
        residualEdgeReductionMeters: drive.residualEdgeReductionMeters ?? null,`,
    `        shieldStepTranslationMeters: drive.shieldStepTranslationMeters ?? null,
        crossFrameRetention: drive.crossFrameRetention ?? null,
        residualEdgeReductionMeters: drive.residualEdgeReductionMeters ?? null,`,
    'carry cross-frame retention samples',
  );

  next = replaceOnce(
    next,
    `  const targetDrift = targets.length
    ? Math.max(...targets.map((target) => distance(target, targets[0])))
    : null;
  return {`,
    `  const targetDrift = targets.length
    ? Math.max(...targets.map((target) => distance(target, targets[0])))
    : null;
  const retention = row.samples.map((sample) => sample.crossFrameRetention).filter(Boolean);
  const finiteRetention = (key) => retention.map((value) => Number(value?.[key])).filter(Number.isFinite);
  const entryReset = finiteRetention('frameEntryResetMeters');
  const entryLoss = finiteRetention('entryLostConvergenceMeters');
  const presentationDelta = finiteRetention('presentationTargetDeltaMeters');
  const primaryReduction = finiteRetention('primaryTargetReductionMeters');
  const postPrimaryDelta = finiteRetention('postPrimaryTargetDeltaMeters');
  const requested = finiteRetention('primaryRequestedMeters');
  const primaryAchieved = finiteRetention('primaryAchievedMeters');
  const displacementEfficiency = finiteRetention('primaryDisplacementEfficiency');
  const convergenceEfficiency = finiteRetention('primaryConvergenceEfficiency');
  const upperDegrees = retention.map((value) => Number(value?.appliedDegrees?.['upperarm.l'])).filter(Number.isFinite);
  const lowerDegrees = retention.map((value) => Number(value?.appliedDegrees?.['lowerarm.l'])).filter(Number.isFinite);
  return {`,
    'prepare retention metrics',
  );

  next = replaceOnce(
    next,
    `    maxAchievedCm: achieved.length ? Math.max(...achieved) * 100 : null,
    minCorrectionDirectionDot: dots.length ? Math.min(...dots) : null,`,
    `    maxAchievedCm: achieved.length ? Math.max(...achieved) * 100 : null,
    maxFrameEntryResetCm: entryReset.length ? Math.max(...entryReset) * 100 : null,
    sumEntryLostConvergenceCm: sum(entryLoss) * 100,
    sumPresentationTargetDeltaCm: sum(presentationDelta) * 100,
    sumPrimaryTargetReductionCm: sum(primaryReduction) * 100,
    sumPostPrimaryTargetDeltaCm: sum(postPrimaryDelta) * 100,
    maxPrimaryRequestedCm: requested.length ? Math.max(...requested) * 100 : null,
    maxPrimaryAchievedCm: primaryAchieved.length ? Math.max(...primaryAchieved) * 100 : null,
    minPrimaryDisplacementEfficiency: displacementEfficiency.length ? Math.min(...displacementEfficiency) : null,
    maxPrimaryDisplacementEfficiency: displacementEfficiency.length ? Math.max(...displacementEfficiency) : null,
    minPrimaryConvergenceEfficiency: convergenceEfficiency.length ? Math.min(...convergenceEfficiency) : null,
    maxPrimaryConvergenceEfficiency: convergenceEfficiency.length ? Math.max(...convergenceEfficiency) : null,
    maxUpperArmDegrees: upperDegrees.length ? Math.max(...upperDegrees) : null,
    maxLowerArmDegrees: lowerDegrees.length ? Math.max(...lowerDegrees) : null,
    retentionFrames: retention.length,
    minCorrectionDirectionDot: dots.length ? Math.min(...dots) : null,`,
    'publish retention metric summary',
  );

  return next;
});

console.log('R18N.2 read-only cross-frame arm reach diagnosis overlay applied.');
