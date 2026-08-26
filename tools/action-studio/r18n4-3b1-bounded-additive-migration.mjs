import fs from 'node:fs';

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  if (source.includes(after)) return false;
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${path}: missing migration anchor\n${before}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${path}: anchor is not unique\n${before}`);
  fs.writeFileSync(path, source.slice(0, first) + after + source.slice(first + before.length));
  return true;
}

const preContact = 'tools/action-studio/shield-parry-r281/pre-contact-controller.js';
replaceOnce(
  preContact,
  "import { createVisualOwnershipRuntimeTaps } from './visual-ownership-runtime-taps.js';\n",
  "import { createVisualOwnershipRuntimeTaps } from './visual-ownership-runtime-taps.js';\nimport { createBoundedShieldArmAdditiveRuntime } from '../../../src/combat/predictive-parry-arm-additive.js';\n",
);
replaceOnce(
  preContact,
  "  const visualOwnership = createVisualOwnershipRuntimeTaps({ rig: defender.rig, exchangeState });\n  const {\n",
  "  const visualOwnership = createVisualOwnershipRuntimeTaps({ rig: defender.rig, exchangeState });\n  const shieldArmAdditiveRuntime = createBoundedShieldArmAdditiveRuntime();\n  const {\n",
);
replaceOnce(
  preContact,
  "      visualOwnership.afterStance(residualStanceReach);\n      const activeInterceptArmClosure = activeIntentPlan\n",
  "      visualOwnership.afterStance(residualStanceReach);\n      const shieldArmBoundedAdditive = shieldArmAdditiveRuntime.update({\n        rig: defender.rig,\n        authoredDelta: exchangeState.latestPredictiveReport?.shieldArmAuthoredDelta,\n        sequence: snapshot.sequence,\n        enabled: Boolean(activeIntentPlan),\n      });\n      visualOwnership.afterShieldArmAdditive(shieldArmBoundedAdditive);\n      const activeInterceptArmClosure = activeIntentPlan\n",
);
replaceOnce(
  preContact,
  "        activeInterceptArmClosure,\n        activeInterceptTargetErrorBeforeMeters,\n",
  "        activeInterceptArmClosure,\n        shieldArmBoundedAdditive,\n        activeInterceptTargetErrorBeforeMeters,\n",
);
replaceOnce(
  preContact,
  "    } else {\n      residualBodyReachRuntime.reset();\n",
  "    } else {\n      shieldArmAdditiveRuntime.reset();\n      residualBodyReachRuntime.reset();\n",
);
replaceOnce(
  preContact,
  "  function resetActiveIntercept() { activeInterceptIntent?.reset(); visualOwnership.reset(); }\n",
  "  function resetActiveIntercept() {\n    activeInterceptIntent?.reset();\n    shieldArmAdditiveRuntime.reset();\n    visualOwnership.reset();\n  }\n",
);

const baseline = 'tools/action-studio/shield-parry-r281/visual-ownership-baseline.js';
replaceOnce(
  baseline,
  "  RESIDUAL_STANCE_REACH: 'residual-stance-reach',\n  ACTIVE_INTERCEPT_FINAL_CLOSURE: 'active-intercept-final-arm-closure',\n",
  "  RESIDUAL_STANCE_REACH: 'residual-stance-reach',\n  PREDICTIVE_SHIELD_ARM_ADDITIVE: 'predictive-shield-arm-bounded-additive',\n  ACTIVE_INTERCEPT_FINAL_CLOSURE: 'active-intercept-final-arm-closure',\n",
);
replaceOnce(
  baseline,
  "  R18N_VISUAL_OWNERSHIP_WRITERS.RESIDUAL_STANCE_REACH,\n  R18N_VISUAL_OWNERSHIP_WRITERS.ACTIVE_INTERCEPT_FINAL_CLOSURE,\n",
  "  R18N_VISUAL_OWNERSHIP_WRITERS.RESIDUAL_STANCE_REACH,\n  R18N_VISUAL_OWNERSHIP_WRITERS.PREDICTIVE_SHIELD_ARM_ADDITIVE,\n  R18N_VISUAL_OWNERSHIP_WRITERS.ACTIVE_INTERCEPT_FINAL_CLOSURE,\n",
);

const taps = 'tools/action-studio/shield-parry-r281/visual-ownership-runtime-taps.js';
replaceOnce(
  taps,
  "  function afterFinalClosure(report) {\n",
  "  function afterShieldArmAdditive(report) {\n    return record(R18N_VISUAL_OWNERSHIP_WRITERS.PREDICTIVE_SHIELD_ARM_ADDITIVE, {\n      stage: report?.stage ?? null,\n      active: report?.active ?? null,\n      applied: report?.applied ?? null,\n      appliedBones: report?.appliedBones ?? [],\n      upperarmAppliedDegrees: report?.bones?.['upperarm.l']?.incrementalAngleDegrees ?? null,\n      lowerarmAppliedDegrees: report?.bones?.['lowerarm.l']?.incrementalAngleDegrees ?? null,\n      wristSolverOnly: report?.bones?.['wrist.l']?.solverOnly ?? true,\n      finalPoseOwner: report?.finalPoseOwner ?? null,\n      authority: report?.authority ?? null,\n    });\n  }\n\n  function afterFinalClosure(report) {\n",
);
replaceOnce(
  taps,
  "    afterStance,\n    afterFinalClosure,\n",
  "    afterStance,\n    afterShieldArmAdditive,\n    afterFinalClosure,\n",
);

const ownershipTest = 'tests/shield-parry-r281-visual-ownership-baseline.test.js';
replaceOnce(
  ownershipTest,
  "  taps.afterStance({ activeCandidate: false, authority: 'pre-contact-guidance-only-real-swept-contact-required' });\n  rig.bones['upperarm.l'].quaternion = yaw(8);\n",
  "  taps.afterStance({ activeCandidate: false, authority: 'pre-contact-guidance-only-real-swept-contact-required' });\n  taps.afterShieldArmAdditive({\n    stage: 'R18N.4.3-B.1',\n    active: true,\n    applied: false,\n    appliedBones: [],\n    finalPoseOwner: 'active-intercept-final-arm-closure',\n    authority: 'bounded-authored-increment-before-active-intercept-final-solve-no-contact-authority',\n  });\n  rig.bones['upperarm.l'].quaternion = yaw(8);\n",
);
replaceOnce(
  ownershipTest,
  "  assertBefore(parrySource, 'const residualStanceReach = residualStanceReachRuntime.update({', 'visualOwnership.afterStance(residualStanceReach)', 'residual stance reach');\n  assertBefore(parrySource, 'fineTrackingRuntime.refineWorldTarget(', 'visualOwnership.afterFinalClosure(activeInterceptArmClosure)', 'final arm closure');\n",
  "  assertBefore(parrySource, 'const residualStanceReach = residualStanceReachRuntime.update({', 'visualOwnership.afterStance(residualStanceReach)', 'residual stance reach');\n  assertBefore(parrySource, 'visualOwnership.afterStance(residualStanceReach)', 'shieldArmAdditiveRuntime.update({', 'bounded authored arm additive after stance');\n  assertBefore(parrySource, 'shieldArmAdditiveRuntime.update({', 'visualOwnership.afterShieldArmAdditive(shieldArmBoundedAdditive)', 'bounded authored arm additive tap');\n  assertBefore(parrySource, 'visualOwnership.afterShieldArmAdditive(shieldArmBoundedAdditive)', 'fineTrackingRuntime.refineWorldTarget(', 'final closure remains after bounded additive');\n  assertBefore(parrySource, 'fineTrackingRuntime.refineWorldTarget(', 'visualOwnership.afterFinalClosure(activeInterceptArmClosure)', 'final arm closure');\n",
);

const packagePath = 'package.json';
replaceOnce(
  packagePath,
  'tests/predictive-parry-arm-delta.test.js tests/predictive-intercept-parry.test.js',
  'tests/predictive-parry-arm-delta.test.js tests/predictive-parry-arm-additive.test.js tests/predictive-intercept-parry.test.js',
);

console.log('R18N.4.3-B.1 bounded additive migration applied');
