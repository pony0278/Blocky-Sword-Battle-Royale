import { readFile, writeFile } from 'node:fs/promises';

const controllerPath = new URL('./shield-parry-r281/pre-contact-controller.js', import.meta.url);
const packagePath = new URL('../../package.json', import.meta.url);

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`R18N.4.3-B.1.1 migration missing ${label}`);
  return source.replace(before, after);
}

let controller = await readFile(controllerPath, 'utf8');

controller = replaceRequired(
  controller,
  "import { createBoundedShieldArmAdditiveRuntime } from '../../../src/combat/predictive-parry-arm-additive.js';\n",
  "import { createBoundedShieldArmAdditiveRuntime } from '../../../src/combat/predictive-parry-arm-additive.js';\nimport {\n  analyzeTopDirectionCompatibilityProbe,\n  normalizeTopDirectionCompatibilityVariant,\n  shouldRetainTopDirectionAdditive,\n} from '../../../src/combat/parry-top-direction-compatibility-probe.js';\n",
  'TOP compatibility probe import',
);

controller = replaceRequired(
  controller,
  "\nexport function createShieldParryPreContactController({\n",
  `\nconst TOP_DIRECTION_PROBE_ARM_BONES = Object.freeze(['upperarm.l', 'lowerarm.l']);\n\nfunction captureTopDirectionProbeArmPose(rig) {\n  const bones = rig?.bones || {};\n  return Object.freeze(Object.fromEntries(\n    TOP_DIRECTION_PROBE_ARM_BONES\n      .filter((boneId) => bones[boneId]?.quaternion?.clone)\n      .map((boneId) => [boneId, bones[boneId].quaternion.clone().normalize()]),\n  ));\n}\n\nfunction restoreTopDirectionProbeArmPose(rig, pose) {\n  const bones = rig?.bones || {};\n  for (const [boneId, saved] of Object.entries(pose || {})) {\n    const quaternion = bones[boneId]?.quaternion;\n    if (!quaternion?.copy) continue;\n    quaternion.copy(saved).normalize();\n  }\n}\n\nexport function createShieldParryPreContactController({\n`,
  'TOP compatibility arm pose helpers',
);

controller = replaceRequired(
  controller,
  "  const visualOwnership = createVisualOwnershipRuntimeTaps({ rig: defender.rig, exchangeState });\n  const shieldArmAdditiveRuntime = createBoundedShieldArmAdditiveRuntime();\n",
  `  const visualOwnership = createVisualOwnershipRuntimeTaps({ rig: defender.rig, exchangeState });\n  const shieldArmAdditiveRuntime = createBoundedShieldArmAdditiveRuntime();\n  const topDirectionProbeQuery = typeof globalThis.location?.search === 'string'\n    ? new URLSearchParams(globalThis.location.search).get('topProbe')\n    : null;\n  const topDirectionProbeVariant = normalizeTopDirectionCompatibilityVariant(topDirectionProbeQuery);\n`,
  'TOP compatibility query configuration',
);

const additiveBefore = `      visualOwnership.afterStance(residualStanceReach);\n      const shieldArmBoundedAdditive = shieldArmAdditiveRuntime.update({\n        rig: defender.rig,\n        authoredDelta: exchangeState.latestPredictiveReport?.shieldArmAuthoredDelta,\n        sequence: snapshot.sequence,\n        enabled: Boolean(activeIntentPlan),\n      });\n      visualOwnership.afterShieldArmAdditive(shieldArmBoundedAdditive);\n      const activeInterceptArmClosure = activeIntentPlan\n`;

const additiveAfter = `      visualOwnership.afterStance(residualStanceReach);\n      const topDirectionProbeActive = Boolean(topDirectionProbeVariant)\n        && snapshot.direction === 'top'\n        && Boolean(activeIntentPlan);\n      const topDirectionProbeBeforeSurface = topDirectionProbeActive\n        ? cloneSurface(buckler.getWorldParrySurface())\n        : null;\n      const topDirectionProbeArmPose = topDirectionProbeActive && topDirectionProbeVariant === 'C'\n        ? captureTopDirectionProbeArmPose(defender.rig)\n        : null;\n      const shieldArmBoundedAdditive = shieldArmAdditiveRuntime.update({\n        rig: defender.rig,\n        authoredDelta: exchangeState.latestPredictiveReport?.shieldArmAuthoredDelta,\n        sequence: snapshot.sequence,\n        enabled: Boolean(activeIntentPlan)\n          && !(topDirectionProbeActive && topDirectionProbeVariant === 'A'),\n      });\n      let topDirectionCompatibilityProbe = null;\n      if (topDirectionProbeActive) {\n        // Probe-only world sync: measure the shield displacement caused by the authored additive\n        // before Active Intercept final closure reasserts contact geometry authority.\n        defender.update(0, camera);\n        defenderSword?.update();\n        const probeAfterAdditiveSurface = cloneSurface(buckler.getWorldParrySurface());\n        const baseProbe = analyzeTopDirectionCompatibilityProbe({\n          direction: snapshot.direction,\n          variant: topDirectionProbeVariant,\n          beforeCenter: topDirectionProbeBeforeSurface.center,\n          afterCenter: probeAfterAdditiveSurface.center,\n          targetCenter: activeInterceptIntent?.report?.targetCenter || null,\n          additiveApplied: shieldArmBoundedAdditive?.applied === true,\n        });\n        let retained = true;\n        let appliedBehavior = topDirectionProbeVariant === 'A'\n          ? 'solver-only-baseline'\n          : 'generic-bounded-additive';\n        if (topDirectionProbeVariant === 'C' && !shouldRetainTopDirectionAdditive(baseProbe)) {\n          restoreTopDirectionProbeArmPose(defender.rig, topDirectionProbeArmPose);\n          defender.update(0, camera);\n          defenderSword?.update();\n          retained = false;\n          appliedBehavior = 'direction-incompatible-additive-rejected';\n        } else if (topDirectionProbeVariant === 'C') {\n          appliedBehavior = 'direction-compatible-additive-retained';\n        }\n        topDirectionCompatibilityProbe = Object.freeze({\n          ...baseProbe,\n          retained,\n          appliedBehavior,\n          finalProbeCenter: Object.freeze(cloneSurface(buckler.getWorldParrySurface()).center),\n        });\n      }\n      visualOwnership.afterShieldArmAdditive(shieldArmBoundedAdditive);\n      const activeInterceptArmClosure = activeIntentPlan\n`;

controller = replaceRequired(controller, additiveBefore, additiveAfter, 'TOP compatibility additive probe block');

controller = replaceRequired(
  controller,
  "        activeInterceptArmClosure,\n        shieldArmBoundedAdditive,\n        activeInterceptTargetErrorBeforeMeters,\n",
  "        activeInterceptArmClosure,\n        shieldArmBoundedAdditive,\n        topDirectionCompatibilityProbe,\n        activeInterceptTargetErrorBeforeMeters,\n",
  'TOP compatibility report field',
);

await writeFile(controllerPath, controller);

let packageJson = await readFile(packagePath, 'utf8');
packageJson = replaceRequired(
  packageJson,
  'tests/predictive-parry-arm-additive.test.js tests/predictive-intercept-parry.test.js',
  'tests/predictive-parry-arm-additive.test.js tests/parry-top-direction-compatibility-probe.test.js tests/predictive-intercept-parry.test.js',
  'package TOP compatibility test registration',
);
await writeFile(packagePath, packageJson);

console.log('R18N.4.3-B.1.1 TOP direction compatibility probe migration applied.');
