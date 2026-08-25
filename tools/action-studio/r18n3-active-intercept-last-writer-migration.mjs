import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`R18N.3 missing marker: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`R18N.3 marker is not unique: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function update(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`R18N.3 produced no change: ${path}`);
  fs.writeFileSync(path, after);
}

update('tools/action-studio/shield-parry-r281/pre-contact-controller.js', (source) => {
  let next = replaceOnce(
    source,
    `      const trackingSurfaceBefore = cloneSurface(buckler.getWorldParrySurface());
      // Active Intercept owns a persistent shield-arm pose. Re-zero only the runtime
      // carry so update() becomes this-frame bounded travel toward the fixed world target
      // instead of re-applying an absolute offset on top of last frame's moved pose.
      if (activeIntentPlan) fineTrackingRuntime.reset();
      exchangeState.latestFineTracking = fineTrackingRuntime.update(exchangeState.latestFinePlan, deltaSeconds);`,
    `      const trackingSurfaceBefore = cloneSurface(buckler.getWorldParrySurface());
      // R18N.3: Guard/Parry presentation is allowed to rebuild its authored pose every frame.
      // Keep the tracking runtime's bounded carry across frames and apply it after presentation,
      // so currentOffset acts as an absolute additive world-space correction and Active Intercept
      // remains the last writer of the shield-arm pose before real swept contact is evaluated.
      exchangeState.latestFineTracking = fineTrackingRuntime.update(exchangeState.latestFinePlan, deltaSeconds);`,
    'replace persistent-pose reset with last-writer additive carry',
  );

  next = replaceOnce(
    next,
    `      const stancePlaneReductionMeters = residualAfterBodyReach.planeGapMeters
        - residualAfterRefinement.planeGapMeters;
      exchangeState.latestInterceptDriveReport = Object.freeze({`,
    `      const stancePlaneReductionMeters = residualAfterBodyReach.planeGapMeters
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
      exchangeState.latestInterceptDriveReport = Object.freeze({`,
    'add last-writer target error telemetry',
  );

  next = replaceOnce(
    next,
    `        activeInterceptIntent: activeInterceptIntent?.report ?? null,
        fallbackApplied:`,
    `        activeInterceptIntent: activeInterceptIntent?.report ?? null,
        activeInterceptPoseAuthority: activeIntentPlan
          ? 'post-guard-post-predictive-absolute-world-offset-last-writer'
          : null,
        activeInterceptPrimaryCarryMeters: activeIntentPlan
          ? magnitude(exchangeState.latestFineTracking?.requestedOffset)
          : null,
        activeInterceptResidualCarryMeters: activeIntentPlan
          ? (residualRefinement?.carriedResidualDistance ?? 0)
          : null,
        activeInterceptTargetErrorBeforeMeters,
        activeInterceptTargetErrorAfterMeters,
        fallbackApplied:`,
    'publish last-writer telemetry',
  );

  next = replaceOnce(
    next,
    `        authority: 'persistent-arm-carry-then-predicted-or-measured-low-threat-planted-stance-held-to-real-contact-or-reset-diagnostic',`,
    `        authority: activeIntentPlan
          ? 'guard-and-predictive-presentation-then-active-intercept-last-writer-held-to-real-contact'
          : 'persistent-arm-carry-then-predicted-or-measured-low-threat-planted-stance-held-to-real-contact-or-reset-diagnostic',`,
    'last-writer authority label',
  );
  return next;
});

update('tests/shield-parry-r281-active-intercept-runtime.test.js', (source) => {
  let next = replaceOnce(
    source,
    `  const planIndex = preContact.indexOf('const activeIntentPlan = activeInterceptIntent?.plan({');
  const resetIndex = preContact.indexOf('if (activeIntentPlan) fineTrackingRuntime.reset();');
  const updateIndex = preContact.indexOf('exchangeState.latestFineTracking = fineTrackingRuntime.update(exchangeState.latestFinePlan, deltaSeconds);', resetIndex);
  assert.ok(planIndex >= 0 && resetIndex > planIndex && updateIndex > resetIndex, 'active intent must clear absolute runtime carry immediately before its persistent-pose tracking step');
  assert.match(preContact.slice(resetIndex, updateIndex), /if \\(activeIntentPlan\\) fineTrackingRuntime\\.reset\\(\\);/);`,
    `  const planIndex = preContact.indexOf('const activeIntentPlan = activeInterceptIntent?.plan({');
  const updateIndex = preContact.indexOf('exchangeState.latestFineTracking = fineTrackingRuntime.update(exchangeState.latestFinePlan, deltaSeconds);', planIndex);
  assert.ok(planIndex >= 0 && updateIndex > planIndex, 'active intent must remain the primary post-presentation tracking step');
  assert.doesNotMatch(
    preContact.slice(planIndex, updateIndex),
    /if \\(activeIntentPlan\\) fineTrackingRuntime\\.reset\\(\\);/,
    'R18N.3 must preserve bounded tracking carry so the absolute additive correction can be reapplied after authored presentation each frame',
  );
  assert.match(preContact, /activeInterceptPoseAuthority:[\\s\\S]*post-guard-post-predictive-absolute-world-offset-last-writer/);`,
    'update active intercept runtime contract from persistent-pose reset to last-writer carry',
  );
  return next;
});

console.log('R18N.3 Active Intercept last-writer pose authority applied.');
