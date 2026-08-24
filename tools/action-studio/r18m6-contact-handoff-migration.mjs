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
let pkg = await readFile(packagePath, 'utf8');
const controller = await readFile(controllerPath, 'utf8');
const tests = await readFile(testPath, 'utf8');
const originalEntryLength = entry.length;

if (entry.includes("./shield-parry-r281/contact-handoff-controller.js")) {
  throw new Error('R18M.6 contact handoff migration already applied');
}
for (const marker of [
  'probeSweptSwordBucklerContact',
  'parryGate.confirm',
  'combat.resolveContact',
  'swordGripConstraint.start',
  'swordGripConstraint.update',
  'PARRY_ATTACKER_RELEASE_SOURCE_SECONDS',
  'allowConfirmedParryFallback: true',
  'continuityBridgeMs: handoff.releaseBlendMs',
  'deflect-impulse-continuity-bridge-to-canonical-old-b3-from-zero',
]) {
  if (!controller.includes(marker)) throw new Error(`candidate controller missing ${marker}`);
}
if (!tests.includes('R18M.6 real swept Sword × Shield contact remains the only Parry success authority')) {
  throw new Error('R18M.6 regression candidate missing real-contact contract');
}

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
  if (!lifecycleSource.includes(marker)) throw new Error(`source lifecycle missing ${marker}`);
}

const resolveSource = sliceBetween(
  entry,
  'function resolveContact(snapshot, currentBlade, deltaSeconds) {',
  '\n\nfunction updateParryCue(',
  'resolveContact',
);
for (const marker of [
  'probeSweptSwordBucklerContact',
  'if (!exchangeState.latestContact.contact) return;',
  'parryGate.confirm',
  'combat.resolveContact',
  'swordGripConstraint.start',
]) {
  if (!resolveSource.includes(marker)) throw new Error(`source resolveContact missing ${marker}`);
}

entry = replaceOnce(
  entry,
  "import { createShieldParryPreContactController } from './shield-parry-r281/pre-contact-controller.js';\n",
  "import { createShieldParryPreContactController } from './shield-parry-r281/pre-contact-controller.js';\nimport { createShieldParryContactHandoffController } from './shield-parry-r281/contact-handoff-controller.js';\n",
  'controller import',
);

entry = entry.replace(
  lifecycleSource,
  "function step3AOwnsLiveContact() {\n  return contactHandoffController.ownsLiveContact();\n}\n\nfunction updateDefenderDeflectReleaseGate() {\n  return contactHandoffController.updateDefenderDeflectReleaseGate();\n}\n\nfunction defenderDeflectReleaseGate() {\n  return contactHandoffController.defenderDeflectReleaseGate();\n}\n\nfunction releaseLiveContactToOldB3() {\n  return contactHandoffController.releaseLiveContactToOldB3({ selectedDirection });\n}\n\nfunction recordVisibleOldB3Sample(combatUpdate) {\n  return contactHandoffController.recordVisibleOldB3Sample(combatUpdate);\n}",
);
entry = entry.replace(
  resolveSource,
  "function resolveContact(snapshot, currentBlade, deltaSeconds) {\n  return contactHandoffController.resolveContact(snapshot, currentBlade, deltaSeconds, {\n    previousBlade,\n    selectedMode,\n    selectedDirection,\n  });\n}",
);

const preContactCreationEnd = "  },\n});\n\nconst bladeNodes = [attackerSword.bladeBase, attackerSword.bladeMid, attackerSword.tip];";
const contactCreation = "  },\n});\n\nconst contactHandoffController = createShieldParryContactHandoffController({\n  exchangeState,\n  buckler,\n  attacker,\n  attackerSword,\n  camera,\n  combat,\n  swordGripConstraint,\n  guardRuntime,\n  predictivePresentation,\n  parryGate,\n  preContactController,\n  fineTrackingRuntime,\n  residualBodyReachRuntime,\n  residualStanceReachRuntime,\n  constants: {\n    TIMING_AGE_MS,\n    PARRY_ATTACKER_RELEASE_SOURCE_SECONDS,\n    LONGSWORD_ATTACK_PHASES,\n    GUARD_STATES,\n    COMMITTED_PARRY_CONTACT_GATE_STAGE,\n    LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE,\n    TWO_ACTOR_PARRY_REACTION_CHANNELS,\n    TWO_ACTOR_PARRY_REACTION_PHASE_LATCHES,\n  },\n  services: {\n    probeSweptSwordBucklerContact,\n    captureRigPose,\n    buildLiveParryOldB3Handoff,\n    sampleLiveParryOldB3ReleaseBlend,\n    publishPostCouplingRecoilStaggerHandoff,\n    measureAttackerRecoilWorldSilhouette,\n  },\n  callbacks: {\n    captureCanonicalAttackerOldB3Base: () => captureCanonicalAttackerOldB3Base(attackRuntime.snapshot.interruption),\n    captureAttackerWorldSilhouette,\n    updateLiveContactMarkers,\n    formatInspectionFailureSummary,\n    publishStatus({ text, className }) {\n      status.textContent = text;\n      status.className = className;\n    },\n  },\n});\n\nconst bladeNodes = [attackerSword.bladeBase, attackerSword.bladeMid, attackerSword.tip];";
entry = replaceOnce(entry, preContactCreationEnd, contactCreation, 'controller construction');

const frameStartMarker = '    let step3ALiveConstraintNeedsUpdate = false;';
const frameEndMarker = '    recordVisibleOldB3Sample(exchangeState.latestCombatUpdate);';
const frameStart = entry.indexOf(frameStartMarker);
const frameEnd = entry.indexOf(frameEndMarker, frameStart);
if (frameStart < 0 || frameEnd <= frameStart) throw new Error('frame contact ownership block not found');
const frameOriginal = entry.slice(frameStart, frameEnd + frameEndMarker.length);
for (const marker of [
  'TWO_ACTOR_PARRY_REACTION_CHANNELS.LIVE_CONTACT_HOLD',
  'guardRuntime.update',
  'swordGripConstraint.update',
  'releaseLiveContactToOldB3()',
  'postCouplingHandoffApplied === true',
]) {
  if (!frameOriginal.includes(marker)) throw new Error(`frame ownership block missing ${marker}`);
}
const frameReplacement = "    const contactFrame = contactHandoffController.updateCombatBeforeGuard({\n      deltaSeconds,\n      deltaMs,\n      selectedDirection,\n      hasAttackerRecovery: Boolean(attackerRecovery),\n      beginAttackRecovery,\n    });\n    if (!contactFrame.handledCombat) sampleAttackerBase(snapshot, deltaMs);\n\n    guardRuntime.update(deltaMs, camera);\n    contactHandoffController.updateDefenderDeflectReleaseGate();\n    contactHandoffController.updateLiveConstraintAfterGuard({\n      deltaSeconds,\n      selectedDirection,\n      needsUpdate: contactFrame.liveConstraintNeedsUpdate,\n    });\n    attackerSword.update(); defenderSword?.update();\n    contactHandoffController.recordVisibleOldB3Sample(exchangeState.latestCombatUpdate);";
entry = entry.slice(0, frameStart) + frameReplacement + entry.slice(frameEnd + frameEndMarker.length);

if (!entry.includes('contactHandoffController.updateCombatBeforeGuard({')) throw new Error('entry missing combat-before-guard delegation');
if (!entry.includes('guardRuntime.update(deltaMs, camera);\n    contactHandoffController.updateDefenderDeflectReleaseGate();')) {
  throw new Error('guard-before-deflect-latch ordering lost');
}
if (!entry.includes('contactHandoffController.updateDefenderDeflectReleaseGate();\n    contactHandoffController.updateLiveConstraintAfterGuard({')) {
  throw new Error('deflect-latch-before-live-constraint ordering lost');
}
if (entry.includes('exchangeState.latestContact = probeSweptSwordBucklerContact({')) {
  throw new Error('authoritative swept contact implementation still inline');
}
if (entry.includes('exchangeState.latestGripConstraintReport = swordGripConstraint.start({')) {
  throw new Error('live grip start implementation still inline');
}

pkg = replaceOnce(
  pkg,
  'tests/shield-parry-r281-pre-contact-controller.test.js tests/shield-sword-hand-contact-coupling.test.js',
  'tests/shield-parry-r281-pre-contact-controller.test.js tests/shield-parry-r281-contact-handoff-controller.test.js tests/shield-sword-hand-contact-coupling.test.js',
  'npm test registration',
);

await writeFile(entryPath, entry, 'utf8');
await writeFile(packagePath, pkg, 'utf8');

console.log('R18M.6 migration prepared:');
console.log('- inert contact controller wired into R281 entry');
console.log('- authoritative contact and OLD B3 lifecycle replaced by delegation wrappers');
console.log('- frame order remains combat-before-guard → guard → DEFLECT latch → live constraint');
console.log('- R18M.6 test registered only after baseline capture');
console.log(`- entry bytes ${originalEntryLength} -> ${entry.length}`);
