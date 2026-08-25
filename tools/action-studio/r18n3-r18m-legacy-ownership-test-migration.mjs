import { readFileSync, writeFileSync } from 'node:fs';

const path = 'tests/shield-sword-hand-contact-coupling-lab.test.js';

function replaceExact(source, oldSource, newSource, label) {
  if (!source.includes(oldSource)) {
    throw new Error(`R18N.3 v6.4 legacy ownership migration could not locate ${label}`);
  }
  if (source.indexOf(oldSource) !== source.lastIndexOf(oldSource)) {
    throw new Error(`R18N.3 v6.4 legacy ownership migration expected one ${label}`);
  }
  if (source.includes(newSource)) {
    throw new Error(`R18N.3 v6.4 legacy ownership migration found ${label} already migrated`);
  }
  return source.replace(oldSource, newSource);
}

let source = readFileSync(path, 'utf8');

const oldOwnershipImports = `const inspectionOverlaySource = readFileSync(\n  new URL('../tools/action-studio/shield-parry-r281/inspection-overlay.js', import.meta.url),\n  'utf8',\n);\nconst postContactOwnershipSource = \`${'${source}'}\\n${'${contactHandoffSource}'}\`;`;
const newOwnershipImports = `const inspectionOverlaySource = readFileSync(\n  new URL('../tools/action-studio/shield-parry-r281/inspection-overlay.js', import.meta.url),\n  'utf8',\n);\nconst liveContactConstraintSource = readFileSync(\n  new URL('../src/combat/live-shield-sword-grip-contact-constraint.js', import.meta.url),\n  'utf8',\n);\nconst postContactOwnershipSource = \`${'${source}'}\\n${'${contactHandoffSource}'}\`;`;

source = replaceExact(
  source,
  oldOwnershipImports,
  newOwnershipImports,
  'live contact constraint ownership source',
);

const oldArmHierarchy = `test('Step 3A uses bounded lowerarm plus wrist hierarchy travel instead of a scheduled target angle', () => {\n  assert.match(source, /modifiedBone: 'wrist\\.r'/);\n  assert.match(source, /propagatedBones: Object\\.freeze\\(\\['hand\\.r', 'handslot\\.r'\\]\\)/);\n  assert.match(source, /assistBone:[^\\n]*'lowerarm\\.r'/);\n  assert.match(source, /blendRecoveryPose/);\n  assert.match(source, /noPresetMotionCurve: true/);\n  assert.match(source, /actualHandTravelMeters/);\n  assert.match(source, /actualGripTravelMeters/);\n  assert.match(source, /residualCorrectionPasses/);\n  assert.match(source, /appliedResidualForearmDegrees/);\n  assert.match(source, /oldB3WeaponArmReleasedAfterInspectionOrConfirmedFallback/);\n  assert.match(source, /contactQaCannotPermanentlySuppressConfirmedParryOldB3/);\n  assert.doesNotMatch(source, /targetHandDegrees|driveDurationMs|smoothstep/);\n});`;
const newArmHierarchy = `test('Step 3A uses bounded lowerarm plus wrist hierarchy travel instead of a scheduled target angle', () => {\n  assert.match(liveContactConstraintSource, /modifiedBone: 'wrist\\.r'/);\n  assert.match(liveContactConstraintSource, /propagatedBones: active\\.plan\\.propagatedBones/);\n  assert.match(liveContactConstraintSource, /assistBone: forearmAssist\\.accepted \\? 'lowerarm\\.r' : null/);\n  assert.match(source, /blendRecoveryPose/);\n  assert.match(contactHandoffSource, /noPresetMotionCurve: true/);\n  assert.match(liveContactConstraintSource, /actualHandTravelMeters/);\n  assert.match(liveContactConstraintSource, /actualGripTravelMeters/);\n  assert.match(liveContactConstraintSource, /residualCorrectionPasses/);\n  assert.match(liveContactConstraintSource, /appliedResidualForearmDegrees/);\n  assert.match(verificationReportSource, /oldB3WeaponArmReleasedAfterInspectionOrConfirmedFallback/);\n  assert.match(verificationReportSource, /contactQaCannotPermanentlySuppressConfirmedParryOldB3/);\n  const armOwnershipSource = [source, liveContactConstraintSource, contactHandoffSource].join('\\n');\n  assert.doesNotMatch(armOwnershipSource, /targetHandDegrees|driveDurationMs|smoothstep/);\n});`;

source = replaceExact(
  source,
  oldArmHierarchy,
  newArmHierarchy,
  'Step 3A bounded arm hierarchy ownership contract',
);

writeFileSync(path, source);
console.log('R18N.3 v6.4 legacy R18M ownership contracts migrated.');
