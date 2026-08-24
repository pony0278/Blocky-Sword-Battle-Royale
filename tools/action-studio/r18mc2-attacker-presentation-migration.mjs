import fs from 'node:fs';

const entryPath = 'tools/action-studio/shield-driven-contact-coupling-lab-r281.js';
const packagePath = 'package.json';
const legacyTestPath = 'tests/shield-sword-hand-contact-coupling-lab.test.js';
let entry = fs.readFileSync(entryPath, 'utf8');

function replaceExact(text, before, after, label) {
  const first = text.indexOf(before);
  if (first < 0) throw new Error(`${label}: marker not found`);
  if (text.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: marker is not unique`);
  return `${text.slice(0, first)}${after}${text.slice(first + before.length)}`;
}

const inspectionImport = "import { createShieldParryInspectionOverlay } from './shield-parry-r281/inspection-overlay.js';\n";
entry = replaceExact(
  entry,
  inspectionImport,
  `${inspectionImport}import { createAttackerPresentationAdapter } from './shield-parry-r281/attacker-presentation.js';\n`,
  'attacker presentation import',
);

const presentationStart = 'function captureAttackerWorldSilhouette() {\n';
const presentationEnd = 'const combat = createTwoActorCombatIntegration({\n';
const startIndex = entry.indexOf(presentationStart);
const endIndex = entry.indexOf(presentationEnd, startIndex);
if (startIndex < 0 || endIndex < 0) throw new Error('attacker presentation block markers not found');
const adapterBlock = `const attackerPresentation = createAttackerPresentationAdapter({\n  THREE,\n  attacker,\n  camera,\n  exchangeState,\n  services: {\n    captureRigPose,\n    applyRigPose,\n    blendRecoveryPose,\n    sampleLongswordAttackRecovery,\n    sampleLiveParryOldB3ReleaseBlend,\n  },\n});\n\n`;
entry = `${entry.slice(0, startIndex)}${adapterBlock}${entry.slice(endIndex)}`;

entry = replaceExact(
  entry,
  `  sampleFrozenContactPose(interruption) {\n    sampleOriginalContactPose(interruption);\n  },\n`,
  `  sampleFrozenContactPose(interruption) {\n    attackerPresentation.sampleFrozenContactPose(interruption, {\n      ownsLiveContact: step3AOwnsLiveContact(),\n    });\n  },\n`,
  'combat sampleFrozenContactPose adapter',
);

entry = replaceExact(
  entry,
  `    captureCanonicalAttackerOldB3Base: () => captureCanonicalAttackerOldB3Base(attackRuntime.snapshot.interruption),\n    captureAttackerWorldSilhouette,\n`,
  `    captureCanonicalAttackerOldB3Base: () => attackerPresentation.captureCanonicalOldB3Base(attackRuntime.snapshot.interruption),\n    captureAttackerWorldSilhouette: () => attackerPresentation.captureWorldSilhouette(),\n`,
  'contact handoff presentation callbacks',
);

const recoveryStart = 'function beginAttackRecovery(direction) {\n';
const recoveryEnd = 'function resetExchange() {\n';
const recoveryStartIndex = entry.indexOf(recoveryStart);
const recoveryEndIndex = entry.indexOf(recoveryEnd, recoveryStartIndex);
if (recoveryStartIndex < 0 || recoveryEndIndex < 0) throw new Error('attacker recovery block markers not found');
const recoveryReplacement = `function beginAttackRecovery(direction) {\n  attackerRecovery = attackerPresentation.createRecovery(direction);\n  attackerIdleClockSeconds = 0;\n}\nfunction sampleAttackerBase(snapshot, deltaMs) {\n  const presentationState = attackerPresentation.sampleBase({\n    snapshot,\n    deltaMs,\n    recovery: attackerRecovery,\n    idleClockSeconds: attackerIdleClockSeconds,\n    idleDuration: attackerIdleDuration,\n  });\n  attackerRecovery = presentationState.recovery;\n  attackerIdleClockSeconds = presentationState.idleClockSeconds;\n}\n`;
entry = `${entry.slice(0, recoveryStartIndex)}${recoveryReplacement}${entry.slice(recoveryEndIndex)}`;

entry = replaceExact(
  entry,
  '  captureCanonicalAttackerOldB3Base(attackRuntime.snapshot.interruption);\n',
  '  attackerPresentation.captureCanonicalOldB3Base(attackRuntime.snapshot.interruption);\n',
  'direct OLD B3 canonical presentation delegation',
);

for (const forbidden of [
  'function captureAttackerWorldSilhouette()',
  'function sampleCanonicalInterruptionPose(',
  'function captureCanonicalAttackerOldB3Base(',
  'function sampleOriginalContactPose(',
  "attacker.sampleAnimation('UAL1/Sword_Idle', attackerIdleClockSeconds",
  'sampleLongswordAttackRecovery(attackerRecovery.direction',
]) {
  if (entry.includes(forbidden)) throw new Error(`entry still owns C2 presentation token: ${forbidden}`);
}
for (const required of [
  'createAttackerPresentationAdapter({',
  'let attackerRecovery = null',
  'let attackerIdleClockSeconds = 0',
  'function beginAttackRecovery(direction)',
  'function sampleAttackerBase(snapshot, deltaMs)',
  'function frame(timestamp)',
  "function triggerParryNow(source = 'button')",
  'function resetExchange()',
  'contactHandoffController.updateCombatBeforeGuard',
  'guardRuntime.update(deltaMs, camera)',
  'contactHandoffController.updateDefenderDeflectReleaseGate()',
  'contactHandoffController.updateLiveConstraintAfterGuard',
]) {
  if (!entry.includes(required)) throw new Error(`required C2 authority/lifecycle token missing: ${required}`);
}

fs.writeFileSync(entryPath, entry);

let legacyTest = fs.readFileSync(legacyTestPath, 'utf8');
const sceneSourceBlock = `const sceneCompositionSource = readFileSync(\n  new URL('../tools/action-studio/shield-parry-r281/lab-scene.js', import.meta.url),\n  'utf8',\n);\n`;
legacyTest = replaceExact(
  legacyTest,
  sceneSourceBlock,
  `${sceneSourceBlock}const attackerPresentationSource = readFileSync(\n  new URL('../tools/action-studio/shield-parry-r281/attacker-presentation.js', import.meta.url),\n  'utf8',\n);\n`,
  'legacy presentation source binding',
);
legacyTest = replaceExact(
  legacyTest,
  `  assert.ok(source.includes('applyRigPose(attacker.rig, exchangeState.frozenAttackerContactPose)'));\n  assert.ok(source.includes('exchangeState.canonicalAttackerOldB3Pose = captureRigPose(attacker.rig)'));\n  assert.ok(source.includes('sampleCanonicalInterruptionPose(interruption)'));\n`,
  `  assert.ok(attackerPresentationSource.includes('applyRigPose(attacker.rig, exchangeState.frozenAttackerContactPose)'));\n  assert.ok(attackerPresentationSource.includes('exchangeState.canonicalAttackerOldB3Pose = captureRigPose(attacker.rig)'));\n  assert.ok(attackerPresentationSource.includes('sampleCanonicalInterruptionPose(interruption)'));\n`,
  'legacy live-contact presentation ownership assertions',
);
fs.writeFileSync(legacyTestPath, legacyTest);

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const testToken = 'tests/shield-parry-r281-attacker-presentation.test.js';
if (!pkg.scripts.test.includes(testToken)) {
  const anchor = 'tests/shield-parry-r281-composition-scene.test.js';
  if (!pkg.scripts.test.includes(anchor)) throw new Error('C1 test anchor missing');
  pkg.scripts.test = pkg.scripts.test.replace(anchor, `${anchor} ${testToken}`);
}
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`R18M.C2 migration prepared; entry lines=${entry.split('\n').length - 1}`);
