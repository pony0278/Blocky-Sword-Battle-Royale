import { readFile, writeFile } from 'node:fs/promises';

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`R18N.4.3-B.1.3 migration missing anchor: ${label}`);
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`R18N.4.3-B.1.3 migration ambiguous anchor: ${label}`);
  }
  return source.slice(0, index) + after + source.slice(index + before.length);
}

const preContactPath = 'tools/action-studio/shield-parry-r281/pre-contact-controller.js';
let preContact = await readFile(preContactPath, 'utf8');
preContact = replaceOnce(
  preContact,
  "} from '../../../src/combat/parry-top-direction-compatibility-probe.js';\n",
  "} from '../../../src/combat/parry-top-direction-compatibility-probe.js';\nimport { createTopPrepReadabilityHoldRuntime } from '../../../src/combat/parry-top-prep-readability-hold.js';\n",
  'pre-contact readability import',
);
preContact = replaceOnce(
  preContact,
  '  const shieldArmAdditiveRuntime = createBoundedShieldArmAdditiveRuntime();\n',
  '  const shieldArmAdditiveRuntime = createBoundedShieldArmAdditiveRuntime();\n  const topPrepReadabilityHoldRuntime = createTopPrepReadabilityHoldRuntime();\n',
  'pre-contact readability runtime',
);
preContact = replaceOnce(
  preContact,
  `      visualOwnership.afterShieldArmAdditive(shieldArmBoundedAdditive);\n      const activeInterceptArmClosure = activeIntentPlan\n        ? fineTrackingRuntime.refineWorldTarget(activeInterceptIntent?.report?.targetCenter, {\n            jointBudgetScale: 0.35,\n            iterations: 2,\n          })\n        : null;`,
  `      visualOwnership.afterShieldArmAdditive(shieldArmBoundedAdditive);\n      const topPrepReadabilityHold = topPrepReadabilityHoldRuntime.update({\n        rig: defender.rig,\n        sequence: snapshot.sequence,\n        direction: snapshot.direction,\n        enabled: Boolean(activeIntentPlan) && !topDirectionProbeActive,\n        presentationElapsedMs: exchangeState.latestPredictiveReport?.presentationElapsedMs,\n        timeToContactSeconds: exchangeState.latestPredictiveAnalysis?.timeToContactSeconds,\n      });\n      visualOwnership.afterTopPrepReadabilityHold(topPrepReadabilityHold);\n      const activeInterceptArmClosure = activeIntentPlan\n        ? fineTrackingRuntime.refineWorldTarget(activeInterceptIntent?.report?.targetCenter, {\n            jointBudgetScale: 0.35,\n            iterations: 2,\n          })\n        : null;`,
  'readability writer before actual-target final closure',
);
preContact = replaceOnce(
  preContact,
  '        shieldArmBoundedAdditive,\n        topDirectionCompatibilityProbe,\n',
  '        shieldArmBoundedAdditive,\n        topDirectionCompatibilityProbe,\n        topPrepReadabilityHold,\n',
  'readability telemetry report',
);
preContact = replaceOnce(
  preContact,
  '    } else {\n      shieldArmAdditiveRuntime.reset();\n      residualBodyReachRuntime.reset();',
  '    } else {\n      shieldArmAdditiveRuntime.reset();\n      topPrepReadabilityHoldRuntime.reset();\n      residualBodyReachRuntime.reset();',
  'inactive presentation readability reset',
);
preContact = replaceOnce(
  preContact,
  `  function armActiveIntercept(snapshot) {\n    return activeInterceptIntent?.arm({\n      sequence: snapshot?.sequence,\n      direction: snapshot?.direction,\n      bucklerSurface: cloneSurface(buckler.getWorldParrySurface()),\n      predictiveAnalysis: exchangeState.latestPredictiveAnalysis,\n    }) || Object.freeze({ accepted: false, reason: 'active-intercept-intent-unavailable' });\n  }`,
  `  function armActiveIntercept(snapshot) {\n    const report = activeInterceptIntent?.arm({\n      sequence: snapshot?.sequence,\n      direction: snapshot?.direction,\n      bucklerSurface: cloneSurface(buckler.getWorldParrySurface()),\n      predictiveAnalysis: exchangeState.latestPredictiveAnalysis,\n    }) || Object.freeze({ accepted: false, reason: 'active-intercept-intent-unavailable' });\n    if (report.accepted === true) {\n      topPrepReadabilityHoldRuntime.arm({\n        rig: defender.rig,\n        sequence: snapshot?.sequence,\n        direction: snapshot?.direction,\n      });\n    } else {\n      topPrepReadabilityHoldRuntime.reset();\n    }\n    return report;\n  }`,
  'capture TOP entry pose on accepted F',
);
preContact = replaceOnce(
  preContact,
  '  function resetActiveIntercept() {\n    activeInterceptIntent?.reset();\n    shieldArmAdditiveRuntime.reset();\n    visualOwnership.reset();\n  }',
  '  function resetActiveIntercept() {\n    activeInterceptIntent?.reset();\n    shieldArmAdditiveRuntime.reset();\n    topPrepReadabilityHoldRuntime.reset();\n    visualOwnership.reset();\n  }',
  'active intercept readability reset',
);
await writeFile(preContactPath, preContact);

const baselinePath = 'tools/action-studio/shield-parry-r281/visual-ownership-baseline.js';
let baseline = await readFile(baselinePath, 'utf8');
baseline = replaceOnce(
  baseline,
  "  PREDICTIVE_SHIELD_ARM_ADDITIVE: 'predictive-shield-arm-bounded-additive',\n  ACTIVE_INTERCEPT_FINAL_CLOSURE: 'active-intercept-final-arm-closure',",
  "  PREDICTIVE_SHIELD_ARM_ADDITIVE: 'predictive-shield-arm-bounded-additive',\n  TOP_PREP_READABILITY_HOLD: 'top-prep-readability-hold',\n  ACTIVE_INTERCEPT_FINAL_CLOSURE: 'active-intercept-final-arm-closure',",
  'visual ownership readability writer id',
);
baseline = replaceOnce(
  baseline,
  '  R18N_VISUAL_OWNERSHIP_WRITERS.PREDICTIVE_SHIELD_ARM_ADDITIVE,\n  R18N_VISUAL_OWNERSHIP_WRITERS.ACTIVE_INTERCEPT_FINAL_CLOSURE,',
  '  R18N_VISUAL_OWNERSHIP_WRITERS.PREDICTIVE_SHIELD_ARM_ADDITIVE,\n  R18N_VISUAL_OWNERSHIP_WRITERS.TOP_PREP_READABILITY_HOLD,\n  R18N_VISUAL_OWNERSHIP_WRITERS.ACTIVE_INTERCEPT_FINAL_CLOSURE,',
  'visual ownership readability writer order',
);
await writeFile(baselinePath, baseline);

const tapsPath = 'tools/action-studio/shield-parry-r281/visual-ownership-runtime-taps.js';
let taps = await readFile(tapsPath, 'utf8');
taps = replaceOnce(
  taps,
  `  function afterFinalClosure(report) {\n    return record(R18N_VISUAL_OWNERSHIP_WRITERS.ACTIVE_INTERCEPT_FINAL_CLOSURE, {`,
  `  function afterTopPrepReadabilityHold(report) {\n    return record(R18N_VISUAL_OWNERSHIP_WRITERS.TOP_PREP_READABILITY_HOLD, {\n      stage: report?.stage ?? null,\n      active: report?.active ?? null,\n      applied: report?.applied ?? null,\n      envelopeWeight: report?.envelopeWeight ?? null,\n      appliedBones: report?.appliedBones ?? [],\n      upperarmRetainDegrees: report?.bones?.['upperarm.l']?.targetAngleDegrees ?? null,\n      lowerarmRetainDegrees: report?.bones?.['lowerarm.l']?.targetAngleDegrees ?? null,\n      wristSolverOnly: report?.bones?.['wrist.l']?.solverOnly ?? true,\n      finalPoseOwner: report?.finalPoseOwner ?? null,\n      authority: report?.authority ?? null,\n    });\n  }\n\n  function afterFinalClosure(report) {\n    return record(R18N_VISUAL_OWNERSHIP_WRITERS.ACTIVE_INTERCEPT_FINAL_CLOSURE, {`,
  'readability ownership tap',
);
taps = replaceOnce(
  taps,
  '    afterShieldArmAdditive,\n    afterFinalClosure,',
  '    afterShieldArmAdditive,\n    afterTopPrepReadabilityHold,\n    afterFinalClosure,',
  'readability ownership tap export',
);
await writeFile(tapsPath, taps);

const visualTestPath = 'tests/shield-parry-r281-visual-ownership-baseline.test.js';
let visualTest = await readFile(visualTestPath, 'utf8');
visualTest = replaceOnce(
  visualTest,
  `  taps.afterShieldArmAdditive({\n    stage: 'R18N.4.3-B.1',\n    active: true,\n    applied: false,\n    appliedBones: [],\n    finalPoseOwner: 'active-intercept-final-arm-closure',\n    authority: 'bounded-authored-increment-before-active-intercept-final-solve-no-contact-authority',\n  });\n  rig.bones['upperarm.l'].quaternion = yaw(8);`,
  `  taps.afterShieldArmAdditive({\n    stage: 'R18N.4.3-B.1',\n    active: true,\n    applied: false,\n    appliedBones: [],\n    finalPoseOwner: 'active-intercept-final-arm-closure',\n    authority: 'bounded-authored-increment-before-active-intercept-final-solve-no-contact-authority',\n  });\n  taps.afterTopPrepReadabilityHold({\n    stage: 'R18N.4.3-B.1.3',\n    active: true,\n    applied: false,\n    envelopeWeight: 1,\n    appliedBones: [],\n    finalPoseOwner: 'active-intercept-final-arm-closure',\n    authority: 'presentation-readability-local-pose-before-final-closure-no-contact-authority',\n  });\n  rig.bones['upperarm.l'].quaternion = yaw(8);`,
  'visual ownership runtime test readability tap',
);
visualTest = replaceOnce(
  visualTest,
  `  assertBefore(parrySource, 'shieldArmAdditiveRuntime.update({', 'visualOwnership.afterShieldArmAdditive(shieldArmBoundedAdditive)', 'bounded authored arm additive tap');\n  assertBefore(parrySource, 'visualOwnership.afterShieldArmAdditive(shieldArmBoundedAdditive)', 'fineTrackingRuntime.refineWorldTarget(', 'final closure remains after bounded additive');\n  assertBefore(parrySource, 'fineTrackingRuntime.refineWorldTarget(', 'visualOwnership.afterFinalClosure(activeInterceptArmClosure)', 'final arm closure');`,
  `  assertBefore(parrySource, 'shieldArmAdditiveRuntime.update({', 'visualOwnership.afterShieldArmAdditive(shieldArmBoundedAdditive)', 'bounded authored arm additive tap');\n  assertBefore(parrySource, 'visualOwnership.afterShieldArmAdditive(shieldArmBoundedAdditive)', 'topPrepReadabilityHoldRuntime.update({', 'TOP readability hold after bounded additive');\n  assertBefore(parrySource, 'topPrepReadabilityHoldRuntime.update({', 'visualOwnership.afterTopPrepReadabilityHold(topPrepReadabilityHold)', 'TOP readability hold telemetry');\n  assertBefore(parrySource, 'visualOwnership.afterTopPrepReadabilityHold(topPrepReadabilityHold)', 'fineTrackingRuntime.refineWorldTarget(', 'actual-target final closure remains after readability hold');\n  assertBefore(parrySource, 'fineTrackingRuntime.refineWorldTarget(', 'visualOwnership.afterFinalClosure(activeInterceptArmClosure)', 'final arm closure');`,
  'visual ownership source contract readability order',
);
await writeFile(visualTestPath, visualTest);

const packagePath = 'package.json';
let packageJson = await readFile(packagePath, 'utf8');
packageJson = replaceOnce(
  packageJson,
  'tests/parry-top-direction-compatibility-probe.test.js tests/predictive-intercept-parry.test.js',
  'tests/parry-top-direction-compatibility-probe.test.js tests/parry-top-prep-readability-hold.test.js tests/predictive-intercept-parry.test.js',
  'npm test readability registration',
);
await writeFile(packagePath, packageJson);

console.log('R18N.4.3-B.1.3 TOP prep readability hold migration materialized.');
