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

update('src/combat/guard-threat-tracking.js', (source) => {
  let next = replaceOnce(
    source,
    `function setWorldDirectionDelta(THREE, bone, effectorWorld, targetWorld, maxDegrees) {
  const boneWorld = new THREE.Vector3();
  bone.getWorldPosition(boneWorld);
  const currentDirection = effectorWorld.clone().sub(boneWorld);
  const targetDirection = targetWorld.clone().sub(boneWorld);
  if (currentDirection.lengthSq() < 1e-10 || targetDirection.lengthSq() < 1e-10) return 0;
  currentDirection.normalize();
  targetDirection.normalize();
  const desiredWorldDelta = new THREE.Quaternion().setFromUnitVectors(currentDirection, targetDirection);
  const rawAngle = 2 * Math.acos(clamp(Math.abs(desiredWorldDelta.w), -1, 1));
  if (rawAngle < 1e-6) return 0;
  const maxRadians = Math.max(0, finite(maxDegrees)) * Math.PI / 180;
  const appliedAngle = Math.min(rawAngle, maxRadians);
  // Three.js r128 mutates the target Quaternion but does not return \`this\` here.
  // Keep the instance explicitly so callers never multiply by an undefined chain result.
  const limitedWorldDelta = new THREE.Quaternion();
  limitedWorldDelta.slerpQuaternions(
    new THREE.Quaternion(), desiredWorldDelta, appliedAngle / rawAngle,
  );
  const parentWorld = new THREE.Quaternion();
  bone.parent?.getWorldQuaternion(parentWorld);
  const localDelta = parentWorld.clone().invert().multiply(limitedWorldDelta).multiply(parentWorld);
  bone.quaternion.premultiply(localDelta).normalize();
  bone.updateMatrixWorld(true);
  return appliedAngle * 180 / Math.PI;
}`,
    `function setWorldDirectionDelta(THREE, bone, effectorWorld, targetWorld, maxDegrees, diagnostic = null) {
  const boneWorld = new THREE.Vector3();
  bone.getWorldPosition(boneWorld);
  const currentDirection = effectorWorld.clone().sub(boneWorld);
  const targetDirection = targetWorld.clone().sub(boneWorld);
  const currentRadiusMeters = currentDirection.length();
  const targetRadiusMeters = targetDirection.length();
  const targetDelta = targetWorld.clone().sub(effectorWorld);
  const targetDistanceMeters = targetDelta.length();
  if (currentDirection.lengthSq() < 1e-10 || targetDirection.lengthSq() < 1e-10) {
    if (diagnostic) Object.assign(diagnostic, {
      valid: false,
      rawAngleDegrees: 0,
      appliedAngleDegrees: 0,
      budgetRemainingDegrees: Math.max(0, finite(maxDegrees)),
      budgetSaturated: false,
      currentRadiusMeters,
      targetRadiusMeters,
      targetDistanceMeters,
      radialTargetMeters: 0,
      tangentialTargetMeters: targetDistanceMeters,
      radialDemandRatio: 0,
      maxChordDisplacementMeters: 0,
    });
    return 0;
  }
  currentDirection.normalize();
  targetDirection.normalize();
  const radialTargetMeters = targetDelta.dot(currentDirection);
  const tangentialTargetMeters = Math.sqrt(Math.max(0, targetDistanceMeters ** 2 - radialTargetMeters ** 2));
  const desiredWorldDelta = new THREE.Quaternion().setFromUnitVectors(currentDirection, targetDirection);
  const rawAngle = 2 * Math.acos(clamp(Math.abs(desiredWorldDelta.w), -1, 1));
  const maxRadians = Math.max(0, finite(maxDegrees)) * Math.PI / 180;
  const appliedAngle = rawAngle < 1e-6 ? 0 : Math.min(rawAngle, maxRadians);
  if (appliedAngle > 0) {
    // Three.js r128 mutates the target Quaternion but does not return \`this\` here.
    // Keep the instance explicitly so callers never multiply by an undefined chain result.
    const limitedWorldDelta = new THREE.Quaternion();
    limitedWorldDelta.slerpQuaternions(
      new THREE.Quaternion(), desiredWorldDelta, appliedAngle / rawAngle,
    );
    const parentWorld = new THREE.Quaternion();
    bone.parent?.getWorldQuaternion(parentWorld);
    const localDelta = parentWorld.clone().invert().multiply(limitedWorldDelta).multiply(parentWorld);
    bone.quaternion.premultiply(localDelta).normalize();
    bone.updateMatrixWorld(true);
  }
  const rawAngleDegrees = rawAngle * 180 / Math.PI;
  const appliedAngleDegrees = appliedAngle * 180 / Math.PI;
  if (diagnostic) Object.assign(diagnostic, {
    valid: true,
    rawAngleDegrees,
    appliedAngleDegrees,
    budgetRemainingDegrees: Math.max(0, finite(maxDegrees)),
    budgetSaturated: rawAngleDegrees > Math.max(0, finite(maxDegrees)) + 1e-6,
    currentRadiusMeters,
    targetRadiusMeters,
    targetDistanceMeters,
    radialTargetMeters,
    tangentialTargetMeters,
    radialDemandRatio: targetDistanceMeters > 1e-9 ? Math.abs(radialTargetMeters) / targetDistanceMeters : 0,
    maxChordDisplacementMeters: 2 * currentRadiusMeters * Math.sin(appliedAngle / 2),
  });
  return appliedAngleDegrees;
}

function buildReachEfficiencyReport(input = {}) {
  const requested = sub(input.targetCenter, input.baselineCenter);
  const achieved = sub(input.finalCenter, input.baselineCenter);
  const targetRemaining = sub(input.targetCenter, input.finalCenter);
  const targetDistanceBeforeMeters = length(requested);
  const targetDistanceAfterMeters = length(targetRemaining);
  const achievedDistanceMeters = length(achieved);
  const requestedDistanceMeters = Math.max(0, finite(input.requestedDistanceMeters, targetDistanceBeforeMeters));
  const directionDot = targetDistanceBeforeMeters > 1e-9 && achievedDistanceMeters > 1e-9
    ? dot(requested, achieved) / (targetDistanceBeforeMeters * achievedDistanceMeters)
    : null;
  const targetDistanceReductionMeters = targetDistanceBeforeMeters - targetDistanceAfterMeters;
  const budgetDegrees = input.budgetDegrees || {};
  const appliedDegrees = input.appliedDegrees || {};
  const passes = Array.isArray(input.passes) ? input.passes : [];
  return Object.freeze({
    requestedDistanceMeters,
    targetDistanceBeforeMeters,
    targetDistanceAfterMeters,
    targetDistanceReductionMeters,
    achievedDistanceMeters,
    displacementEfficiency: requestedDistanceMeters > 1e-9 ? achievedDistanceMeters / requestedDistanceMeters : null,
    convergenceEfficiency: requestedDistanceMeters > 1e-9 ? targetDistanceReductionMeters / requestedDistanceMeters : null,
    directionDot,
    appliedDegrees: Object.freeze({ ...appliedDegrees }),
    budgetDegrees: Object.freeze({ ...budgetDegrees }),
    budgetUtilization: Object.freeze({
      'upperarm.l': finite(budgetDegrees['upperarm.l']) > 1e-9
        ? finite(appliedDegrees['upperarm.l']) / finite(budgetDegrees['upperarm.l'])
        : null,
      'lowerarm.l': finite(budgetDegrees['lowerarm.l']) > 1e-9
        ? finite(appliedDegrees['lowerarm.l']) / finite(budgetDegrees['lowerarm.l'])
        : null,
    }),
    saturatedPasses: passes.filter((pass) => pass?.budgetSaturated === true).length,
    maxRadialDemandRatio: passes.length ? Math.max(...passes.map((pass) => finite(pass?.radialDemandRatio))) : null,
    passes: Object.freeze(passes.slice()),
    authority: 'read-only-arm-reach-efficiency-diagnosis-no-solver-authority',
  });
}`,
    'instrument world-direction solve geometry',
  );

  next = replaceOnce(
    next,
    `  function update(plan, deltaSeconds = 1 / 60) {`,
    `  function applyJointSolvePass(boneId, maxDegrees, iteration, passes) {
    const beforeSurface = buckler.getWorldParrySurface();
    effector.set(beforeSurface.center.x, beforeSurface.center.y, beforeSurface.center.z);
    const solve = {};
    const appliedDegrees = setWorldDirectionDelta(
      THREE, rig.bones[boneId], effector, targetCenter, maxDegrees, solve,
    );
    rig.root?.updateMatrixWorld?.(true);
    const afterSurface = buckler.getWorldParrySurface();
    const shieldCenterStep = sub(afterSurface.center, beforeSurface.center);
    const targetStep = sub(targetCenter, beforeSurface.center);
    const shieldCenterStepMeters = length(shieldCenterStep);
    const targetDistanceBeforeMeters = length(targetStep);
    const targetDistanceAfterMeters = length(sub(targetCenter, afterSurface.center));
    const shieldStepDirectionDot = targetDistanceBeforeMeters > 1e-9 && shieldCenterStepMeters > 1e-9
      ? dot(targetStep, shieldCenterStep) / (targetDistanceBeforeMeters * shieldCenterStepMeters)
      : null;
    passes.push(Object.freeze({
      iteration,
      boneId,
      ...solve,
      shieldCenterStep: freezeVector(shieldCenterStep),
      shieldCenterStepMeters,
      shieldStepDirectionDot,
      targetDistanceBeforeMeters,
      targetDistanceAfterMeters,
      targetDistanceReductionMeters: targetDistanceBeforeMeters - targetDistanceAfterMeters,
      displacementPerDegreeMeters: appliedDegrees > 1e-9 ? shieldCenterStepMeters / appliedDegrees : null,
    }));
    return appliedDegrees;
  }

  function update(plan, deltaSeconds = 1 / 60) {`,
    'add per-joint solve pass diagnosis',
  );

  next = replaceOnce(
    next,
    `    const appliedDegrees = { 'upperarm.l': 0, 'lowerarm.l': 0 };

    if (combinedOffset.lengthSq() > 1e-10) {`,
    `    const appliedDegrees = { 'upperarm.l': 0, 'lowerarm.l': 0 };
    const solverPasses = [];

    if (combinedOffset.lengthSq() > 1e-10) {`,
    'primary solver pass collection',
  );

  next = replaceOnce(
    next,
    `      for (let iteration = 0; iteration < 2; iteration += 1) {
        const surface = buckler.getWorldParrySurface();
        effector.set(surface.center.x, surface.center.y, surface.center.z);
        const lowerRemaining = Math.max(0, profile.lowerArmMaxDegrees - appliedDegrees['lowerarm.l']);
        appliedDegrees['lowerarm.l'] += setWorldDirectionDelta(
          THREE, rig.bones['lowerarm.l'], effector, targetCenter, lowerRemaining,
        );
        rig.root?.updateMatrixWorld?.(true);
        const surfaceAfterLower = buckler.getWorldParrySurface();
        effector.set(surfaceAfterLower.center.x, surfaceAfterLower.center.y, surfaceAfterLower.center.z);
        const upperRemaining = Math.max(0, profile.upperArmMaxDegrees - appliedDegrees['upperarm.l']);
        appliedDegrees['upperarm.l'] += setWorldDirectionDelta(
          THREE, rig.bones['upperarm.l'], effector, targetCenter, upperRemaining,
        );
        rig.root?.updateMatrixWorld?.(true);
      }`,
    `      for (let iteration = 0; iteration < 2; iteration += 1) {
        const lowerRemaining = Math.max(0, profile.lowerArmMaxDegrees - appliedDegrees['lowerarm.l']);
        appliedDegrees['lowerarm.l'] += applyJointSolvePass(
          'lowerarm.l', lowerRemaining, iteration, solverPasses,
        );
        const upperRemaining = Math.max(0, profile.upperArmMaxDegrees - appliedDegrees['upperarm.l']);
        appliedDegrees['upperarm.l'] += applyJointSolvePass(
          'upperarm.l', upperRemaining, iteration, solverPasses,
        );
      }`,
    'primary joint solver diagnosis integration',
  );

  next = replaceOnce(
    next,
    `    const achieved = new THREE.Vector3(
      finalSurface.center.x - baselineSurface.center.x,
      finalSurface.center.y - baselineSurface.center.y,
      finalSurface.center.z - baselineSurface.center.z,
    );
    return Object.freeze({`,
    `    const achieved = new THREE.Vector3(
      finalSurface.center.x - baselineSurface.center.x,
      finalSurface.center.y - baselineSurface.center.y,
      finalSurface.center.z - baselineSurface.center.z,
    );
    const reachEfficiency = buildReachEfficiencyReport({
      baselineCenter: baselineSurface.center,
      finalCenter: finalSurface.center,
      targetCenter,
      requestedDistanceMeters: combinedOffset.length(),
      appliedDegrees,
      budgetDegrees: {
        'upperarm.l': profile.upperArmMaxDegrees,
        'lowerarm.l': profile.lowerArmMaxDegrees,
      },
      passes: solverPasses,
    });
    return Object.freeze({`,
    'primary reach efficiency report',
  );

  next = replaceOnce(
    next,
    `      achievedDistance: achieved.length(),
      appliedDegrees: Object.freeze({ ...appliedDegrees }),
      surface: finalSurface,`,
    `      achievedDistance: achieved.length(),
      appliedDegrees: Object.freeze({ ...appliedDegrees }),
      reachEfficiency,
      surface: finalSurface,`,
    'publish primary reach efficiency',
  );

  next = replaceOnce(
    next,
    `    const appliedDegrees = { 'upperarm.l': 0, 'lowerarm.l': 0 };

    if (residualDeltaOffset.lengthSq() > 1e-10) {`,
    `    const appliedDegrees = { 'upperarm.l': 0, 'lowerarm.l': 0 };
    const solverPasses = [];

    if (residualDeltaOffset.lengthSq() > 1e-10) {`,
    'residual solver pass collection',
  );

  next = replaceOnce(
    next,
    `      for (let iteration = 0; iteration < iterations; iteration += 1) {
        const surface = buckler.getWorldParrySurface();
        effector.set(surface.center.x, surface.center.y, surface.center.z);
        const lowerBudget = profile.lowerArmMaxDegrees * jointBudgetScale;
        const lowerRemaining = Math.max(0, lowerBudget - appliedDegrees['lowerarm.l']);
        appliedDegrees['lowerarm.l'] += setWorldDirectionDelta(
          THREE, rig.bones['lowerarm.l'], effector, targetCenter, lowerRemaining,
        );
        rig.root?.updateMatrixWorld?.(true);
        const surfaceAfterLower = buckler.getWorldParrySurface();
        effector.set(surfaceAfterLower.center.x, surfaceAfterLower.center.y, surfaceAfterLower.center.z);
        const upperBudget = profile.upperArmMaxDegrees * jointBudgetScale;
        const upperRemaining = Math.max(0, upperBudget - appliedDegrees['upperarm.l']);
        appliedDegrees['upperarm.l'] += setWorldDirectionDelta(
          THREE, rig.bones['upperarm.l'], effector, targetCenter, upperRemaining,
        );
        rig.root?.updateMatrixWorld?.(true);
      }`,
    `      for (let iteration = 0; iteration < iterations; iteration += 1) {
        const lowerBudget = profile.lowerArmMaxDegrees * jointBudgetScale;
        const lowerRemaining = Math.max(0, lowerBudget - appliedDegrees['lowerarm.l']);
        appliedDegrees['lowerarm.l'] += applyJointSolvePass(
          'lowerarm.l', lowerRemaining, iteration, solverPasses,
        );
        const upperBudget = profile.upperArmMaxDegrees * jointBudgetScale;
        const upperRemaining = Math.max(0, upperBudget - appliedDegrees['upperarm.l']);
        appliedDegrees['upperarm.l'] += applyJointSolvePass(
          'upperarm.l', upperRemaining, iteration, solverPasses,
        );
      }`,
    'residual joint solver diagnosis integration',
  );

  next = replaceOnce(
    next,
    `    const directionDot = appliedResidualDistance > 1e-6 && achievedDistance > 1e-6
      ? residualDeltaOffset.dot(achieved) / (appliedResidualDistance * achievedDistance)
      : null;
    return Object.freeze({`,
    `    const directionDot = appliedResidualDistance > 1e-6 && achievedDistance > 1e-6
      ? residualDeltaOffset.dot(achieved) / (appliedResidualDistance * achievedDistance)
      : null;
    const reachEfficiency = buildReachEfficiencyReport({
      baselineCenter: baselineSurface.center,
      finalCenter: finalSurface.center,
      targetCenter,
      requestedDistanceMeters: appliedResidualDistance,
      appliedDegrees,
      budgetDegrees: {
        'upperarm.l': profile.upperArmMaxDegrees * jointBudgetScale,
        'lowerarm.l': profile.lowerArmMaxDegrees * jointBudgetScale,
      },
      passes: solverPasses,
    });
    return Object.freeze({`,
    'residual reach efficiency report',
  );

  next = replaceOnce(
    next,
    `      directionDot,
      appliedDegrees: Object.freeze({ ...appliedDegrees }),
      jointBudgetScale,`,
    `      directionDot,
      appliedDegrees: Object.freeze({ ...appliedDegrees }),
      reachEfficiency,
      jointBudgetScale,`,
    'publish residual reach efficiency',
  );

  return next;
});

update('tools/action-studio/shield-parry-r281/pre-contact-controller.js', (source) => {
  let next = replaceOnce(
    source,
    `        trackingAchievedDistanceMeters: exchangeState.latestFineTracking?.achievedDistance ?? null,`,
    `        trackingAchievedDistanceMeters: exchangeState.latestFineTracking?.achievedDistance ?? null,
        primaryArmReachEfficiency: exchangeState.latestFineTracking?.reachEfficiency ?? null,`,
    'primary arm efficiency telemetry handoff',
  );
  next = replaceOnce(
    next,
    `        residualRefinement,
        residualCarryBeforeMeters,`,
    `        residualRefinement,
        residualArmReachEfficiency: residualRefinement?.reachEfficiency ?? null,
        residualCarryBeforeMeters,`,
    'residual arm efficiency telemetry handoff',
  );
  return next;
});

update('tools/action-studio/r18n1-active-intercept-browser-probe.mjs', (source) => {
  let next = replaceOnce(
    source,
    `        shieldStepTranslationMeters: drive.shieldStepTranslationMeters ?? null,
        residualEdgeReductionMeters: drive.residualEdgeReductionMeters ?? null,`,
    `        shieldStepTranslationMeters: drive.shieldStepTranslationMeters ?? null,
        primaryArmReachEfficiency: drive.primaryArmReachEfficiency ?? null,
        residualArmReachEfficiency: drive.residualArmReachEfficiency ?? null,
        residualEdgeReductionMeters: drive.residualEdgeReductionMeters ?? null,`,
    'probe arm reach efficiency samples',
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
  const primaryEfficiency = row.samples.map((sample) => sample.primaryArmReachEfficiency).filter(Boolean);
  const primaryPasses = primaryEfficiency.flatMap((value) => value.passes || []);
  const residualEfficiency = row.samples.map((sample) => sample.residualArmReachEfficiency).filter(Boolean);
  const finiteMetric = (rows, key) => rows.map((value) => Number(value?.[key])).filter(Number.isFinite);
  const primaryRequested = finiteMetric(primaryEfficiency, 'requestedDistanceMeters');
  const primaryAchieved = finiteMetric(primaryEfficiency, 'achievedDistanceMeters');
  const primaryReduction = finiteMetric(primaryEfficiency, 'targetDistanceReductionMeters');
  const primaryDisplacementEfficiency = finiteMetric(primaryEfficiency, 'displacementEfficiency');
  const primaryConvergenceEfficiency = finiteMetric(primaryEfficiency, 'convergenceEfficiency');
  const radialDemand = primaryPasses.map((pass) => Number(pass?.radialDemandRatio)).filter(Number.isFinite);
  const tangentialDemand = primaryPasses.map((pass) => Number(pass?.tangentialTargetMeters)).filter(Number.isFinite);
  return {`,
    'probe efficiency summary setup',
  );
  next = replaceOnce(
    next,
    `    maxAchievedCm: achieved.length ? Math.max(...achieved) * 100 : null,
    minCorrectionDirectionDot: dots.length ? Math.min(...dots) : null,`,
    `    maxAchievedCm: achieved.length ? Math.max(...achieved) * 100 : null,
    primaryRequestedStepCm: primaryRequested.length ? Math.max(...primaryRequested) * 100 : null,
    primaryAchievedStepCm: primaryAchieved.length ? Math.max(...primaryAchieved) * 100 : null,
    primaryTargetReductionCm: primaryReduction.length ? Math.max(...primaryReduction) * 100 : null,
    minPrimaryDisplacementEfficiency: primaryDisplacementEfficiency.length ? Math.min(...primaryDisplacementEfficiency) : null,
    maxPrimaryDisplacementEfficiency: primaryDisplacementEfficiency.length ? Math.max(...primaryDisplacementEfficiency) : null,
    minPrimaryConvergenceEfficiency: primaryConvergenceEfficiency.length ? Math.min(...primaryConvergenceEfficiency) : null,
    maxPrimaryConvergenceEfficiency: primaryConvergenceEfficiency.length ? Math.max(...primaryConvergenceEfficiency) : null,
    primarySolverPasses: primaryPasses.length,
    primarySaturatedPasses: primaryPasses.filter((pass) => pass?.budgetSaturated === true).length,
    maxPrimaryRadialDemandRatio: radialDemand.length ? Math.max(...radialDemand) : null,
    maxPrimaryTangentialDemandCm: tangentialDemand.length ? Math.max(...tangentialDemand) * 100 : null,
    residualEfficiencyFrames: residualEfficiency.length,
    minCorrectionDirectionDot: dots.length ? Math.min(...dots) : null,`,
    'probe efficiency summary fields',
  );
  return next;
});

console.log('R18N.2 arm reach efficiency diagnosis overlay applied.');
