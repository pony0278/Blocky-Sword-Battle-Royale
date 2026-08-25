import fs from 'node:fs';

const entryPath = 'tools/action-studio/shield-driven-contact-coupling-lab-r281.js';
const modulePath = 'tools/action-studio/shield-parry-r281/direct-old-b3-diagnostic.js';
const packagePath = 'package.json';
const legacyDiagnosticTestPath = 'tests/old-two-actor-b3-direct-diagnostic.test.js';
const shieldLabTestPath = 'tests/shield-sword-hand-contact-coupling-lab.test.js';

function requireExactlyOnce(text, token, label) {
  const count = text.split(token).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one occurrence, got ${count}`);
}

let entry = fs.readFileSync(entryPath, 'utf8');
if (fs.existsSync(modulePath)) throw new Error(`${modulePath} already exists`);

const presentationImport = "import { createAttackerPresentationAdapter } from './shield-parry-r281/attacker-presentation.js';";
const diagnosticImport = "import { createDirectOldB3DiagnosticController } from './shield-parry-r281/direct-old-b3-diagnostic.js';";
const helperStart = 'function diagnosticIncomingVelocity(direction) {';
const helperEnd = 'function step3AOwnsLiveContact() {';
const forceStart = 'function forceOldTwoActorB3(direction = selectedDirection) {';
const forceEnd = '\nfunction startAttack(direction = selectedDirection) {';
const controllerAnchor = 'const bladeNodes = [attackerSword.bladeBase, attackerSword.bladeMid, attackerSword.tip];';
const legacyModeImportLine = '  LEGACY_TWO_ACTOR_RECOIL_HANDOFF_MODE,\n';

for (const [token, label] of [
  [presentationImport, 'attacker presentation import'],
  [helperStart, 'diagnostic helper start'],
  [helperEnd, 'step3 owner marker'],
  [forceStart, 'forceOldTwoActorB3 marker'],
  [forceEnd, 'startAttack marker'],
  [controllerAnchor, 'controller anchor'],
  [legacyModeImportLine, 'legacy handoff mode import'],
]) requireExactlyOnce(entry, token, label);

entry = entry.replace(presentationImport, `${presentationImport}\n${diagnosticImport}`);
entry = entry.replace(legacyModeImportLine, '');

const helperStartIndex = entry.indexOf(helperStart);
const helperEndIndex = entry.indexOf(helperEnd, helperStartIndex);
if (!(helperStartIndex >= 0 && helperEndIndex > helperStartIndex)) throw new Error('diagnostic helper boundaries invalid');
entry = entry.slice(0, helperStartIndex) + entry.slice(helperEndIndex);

const forceStartIndex = entry.indexOf(forceStart);
const forceEndIndex = entry.indexOf(forceEnd, forceStartIndex);
if (!(forceStartIndex >= 0 && forceEndIndex > forceStartIndex)) throw new Error('direct OLD B3 function boundaries invalid');
const wrapper = `function forceOldTwoActorB3(direction = selectedDirection) {\n  return directOldB3DiagnosticController.run(direction);\n}\n`;
entry = entry.slice(0, forceStartIndex) + wrapper + entry.slice(forceEndIndex + 1);

const controllerSource = `const directOldB3DiagnosticController = createDirectOldB3DiagnosticController({\n  THREE,\n  exchangeState,\n  attacker,\n  attackerSword,\n  attackRuntime,\n  combat,\n  guardRuntime,\n  camera,\n  buckler,\n  timingAgeMs: TIMING_AGE_MS.parry,\n  services: {\n    captureRigPose,\n    publishPostCouplingRecoilStaggerHandoff,\n  },\n  readContext: () => ({ ready, selectedDirection }),\n  callbacks: {\n    disableAutoRepeat: () => { autoRepeat.checked = false; },\n    clearAttackerRecovery: () => { attackerRecovery = null; },\n    enterGuard,\n    setSelectedDirection: (direction) => { selectedDirection = direction; },\n    resetExchange,\n    sampleAttackerBase,\n    captureCanonicalOldB3Base: (interruption) => attackerPresentation.captureCanonicalOldB3Base(interruption),\n    publishStatus({ text, className }) {\n      status.textContent = text;\n      status.className = className;\n    },\n    buildReport,\n  },\n});\n\n`;
entry = entry.replace(controllerAnchor, `${controllerSource}${controllerAnchor}`);

if (entry.includes("authority: 'step1-synthetic-authoritative-contact-for-old-b3-only'")) {
  throw new Error('synthetic contact authority leaked in entry after C4 extraction');
}
if (entry.includes("authority: 'direct-existing-old-two-actor-b3-diagnostic'")) {
  throw new Error('direct diagnostic authority leaked in entry after C4 extraction');
}
requireExactlyOnce(entry, 'directOldB3DiagnosticController.run(direction)', 'diagnostic wrapper delegation');

const moduleSource = `// R18M.C4 — Step 1 direct OLD B3 diagnostic-only orchestration.\n// Synthetic contact here exists only to exercise the historical OLD B3 handoff.\n// Production Parry success remains owned by real swept Sword × Shield contact outside this module.\n\nimport { LEGACY_TWO_ACTOR_RECOIL_HANDOFF_MODE } from '../../../src/combat/post-coupling-recoil-stagger-handoff.js';\n\nexport function diagnosticIncomingVelocity(direction) {\n  if (direction === 'left') return Object.freeze({ x: -4.8, y: -0.4, z: 2.0 });\n  if (direction === 'top') return Object.freeze({ x: 0.2, y: -6.4, z: 0.6 });\n  return Object.freeze({ x: 4.8, y: -0.4, z: 2.0 });\n}\n\nexport function diagnosticCouplingReport(direction) {\n  const lateral = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;\n  return Object.freeze({\n    outcome: 'parry',\n    elapsedMs: 96,\n    complete: true,\n    releaseAttackerRecoil: true,\n    recoilHandoffMode: LEGACY_TWO_ACTOR_RECOIL_HANDOFF_MODE,\n    shieldOffset: Object.freeze({ x: lateral * 0.105, y: direction === 'top' ? 0.105 : 0.028, z: 0.012 }),\n    attackerWeaponOffset: Object.freeze({ x: lateral * 0.092, y: direction === 'top' ? 0.092 : 0.025, z: 0.011 }),\n    profile: Object.freeze({ durationMs: 96, recoilHandoffMode: LEGACY_TWO_ACTOR_RECOIL_HANDOFF_MODE }),\n    authority: 'step1-direct-old-b3-diagnostic-no-coupling-runtime',\n  });\n}\n\nexport function createDirectOldB3DiagnosticController({\n  THREE,\n  exchangeState,\n  attacker,\n  attackerSword,\n  attackRuntime,\n  combat,\n  guardRuntime,\n  camera,\n  buckler,\n  timingAgeMs,\n  services,\n  readContext,\n  callbacks,\n}) {\n  const { captureRigPose, publishPostCouplingRecoilStaggerHandoff } = services;\n  const {\n    disableAutoRepeat,\n    clearAttackerRecovery,\n    enterGuard,\n    setSelectedDirection,\n    resetExchange,\n    sampleAttackerBase,\n    captureCanonicalOldB3Base,\n    publishStatus,\n    buildReport,\n  } = callbacks;\n\n  function run(direction) {\n    const context = readContext();\n    if (!context.ready) return Object.freeze({ accepted: false, reason: 'lab-not-ready' });\n\n    disableAutoRepeat();\n    combat.reset();\n    clearAttackerRecovery();\n    enterGuard();\n    setSelectedDirection(direction);\n    resetExchange();\n\n    const started = combat.startAttack(direction);\n    if (!started.accepted) {\n      return Object.freeze({ accepted: false, reason: started.reason || 'diagnostic-attack-start-rejected' });\n    }\n    const attackProfile = attackRuntime.snapshot.action?.runtime;\n    attackRuntime.update((attackProfile?.activeStartSeconds || 0) * 1000 + 1);\n    const activeSnapshot = attackRuntime.snapshot;\n    sampleAttackerBase(activeSnapshot, 0);\n    attackerSword.update();\n\n    const contactPoint = new THREE.Vector3();\n    attackerSword.bladeMid.getWorldPosition(contactPoint);\n    exchangeState.latestContact = Object.freeze({\n      contact: true,\n      geometricContact: true,\n      eligible: true,\n      point: Object.freeze({ x: contactPoint.x, y: contactPoint.y, z: contactPoint.z }),\n      incomingVelocity: diagnosticIncomingVelocity(direction),\n      radialDistance: 0.08,\n      bladeFraction: 0.5,\n      sweepAlpha: 0.5,\n      authority: 'step1-synthetic-authoritative-contact-for-old-b3-only',\n    });\n    exchangeState.firstContact = exchangeState.latestContact;\n    exchangeState.frozenAttackerContactPose = captureRigPose(attacker.rig);\n    exchangeState.latestCombatResult = combat.resolveContact({\n      contact: exchangeState.latestContact,\n      guardIntentAgeMs: timingAgeMs,\n    });\n    if (!exchangeState.latestCombatResult.accepted) {\n      exchangeState.frozenAttackerContactPose = null;\n      exchangeState.directOldB3Diagnostic = Object.freeze({\n        accepted: false,\n        reason: exchangeState.latestCombatResult.reason || 'diagnostic-contact-rejected',\n      });\n      return exchangeState.directOldB3Diagnostic;\n    }\n\n    captureCanonicalOldB3Base(attackRuntime.snapshot.interruption);\n    guardRuntime.sync(camera);\n\n    const handoffPublished = publishPostCouplingRecoilStaggerHandoff(attacker.rig, {\n      couplingReport: diagnosticCouplingReport(direction),\n      surfaceAtContact: buckler.getWorldParrySurface(),\n    });\n    exchangeState.latestCombatUpdate = combat.update(0.021, { camera });\n    const handoff = combat.snapshot.attackerRecoil?.postCouplingHandoff || null;\n    exchangeState.directOldB3Diagnostic = Object.freeze({\n      accepted: handoffPublished && handoff?.accepted === true,\n      direction,\n      parryTimingBypassed: true,\n      predictiveShieldLeadBypassed: true,\n      shieldContactBypassed: true,\n      couplingRuntimeBypassed: true,\n      releaseBridgeBypassed: true,\n      handoffPublished,\n      handoffStage: handoff?.stage || null,\n      handoffAccepted: handoff?.accepted === true,\n      reactionDefinitionId: exchangeState.latestCombatResult.attackerReaction?.id || null,\n      reactionPlanBackwardPitchDegrees:\n        exchangeState.latestCombatResult.attackerReaction?.silhouette?.backwardPitchDegrees ?? null,\n      reactionInitialElapsedMs: exchangeState.latestCombatResult.attackerReaction?.initialElapsedMs ?? null,\n      authority: 'direct-existing-old-two-actor-b3-diagnostic',\n    });\n    publishStatus({\n      text: exchangeState.directOldB3Diagnostic.accepted\n        ? 'STEP 1 ACTIVE · OLD Two-Actor B3 direct · all Parry/collision stages bypassed'\n        : \`STEP 1 FAIL · \${handoff?.reason || 'legacy handoff was not accepted'}\`,\n      className: exchangeState.directOldB3Diagnostic.accepted ? 'good' : 'bad',\n    });\n    attacker.update(0, camera);\n    attackerSword.update();\n    buildReport();\n    return exchangeState.directOldB3Diagnostic;\n  }\n\n  return Object.freeze({ run });\n}\n`;
fs.writeFileSync(modulePath, moduleSource.replace(/[ \t]+$/gm, ''));
fs.writeFileSync(entryPath, entry.replace(/[ \t]+$/gm, ''));

let legacyTest = fs.readFileSync(legacyDiagnosticTestPath, 'utf8');
const preContactRead = "const preContactSource = readFileSync(new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url), 'utf8');";
requireExactlyOnce(legacyTest, preContactRead, 'legacy diagnostic pre-contact read');
legacyTest = legacyTest.replace(
  preContactRead,
  `${preContactRead}\nconst diagnosticSource = readFileSync(new URL('../tools/action-studio/shield-parry-r281/direct-old-b3-diagnostic.js', import.meta.url), 'utf8');`,
);
legacyTest = legacyTest.replace(
  "  assert.match(source, /direct-existing-old-two-actor-b3-diagnostic/);",
  "  assert.match(diagnosticSource, /direct-existing-old-two-actor-b3-diagnostic/);",
);
const oldLegacyBody = `test('Step 1 publishes the unchanged legacy B3 handoff and bypasses the Parry middle chain', () => {\n  const body = functionBody('forceOldTwoActorB3');\n  assert.match(body, /combat\\.resolveContact/);\n  assert.match(body, /publishPostCouplingRecoilStaggerHandoff/);\n  assert.match(body, /combat\\.update\\(0\\.021/);\n  assert.doesNotMatch(body, /analyzePredictiveInterceptParry/);\n  assert.doesNotMatch(body, /probeSweptSwordBucklerContact/);\n  assert.doesNotMatch(body, /couplingRuntime\\.start/);\n  assert.doesNotMatch(body, /prepareLegacyReleaseBridge/);\n});`;
const newLegacyBody = `test('Step 1 publishes the unchanged legacy B3 handoff and bypasses the Parry middle chain', () => {\n  const wrapper = functionBody('forceOldTwoActorB3');\n  assert.match(wrapper, /directOldB3DiagnosticController\\.run/);\n  assert.match(diagnosticSource, /combat\\.resolveContact/);\n  assert.match(diagnosticSource, /publishPostCouplingRecoilStaggerHandoff/);\n  assert.match(diagnosticSource, /combat\\.update\\(0\\.021/);\n  assert.doesNotMatch(diagnosticSource, /analyzePredictiveInterceptParry/);\n  assert.doesNotMatch(diagnosticSource, /probeSweptSwordBucklerContact/);\n  assert.doesNotMatch(diagnosticSource, /couplingRuntime\\.start/);\n  assert.doesNotMatch(diagnosticSource, /prepareLegacyReleaseBridge/);\n});`;
requireExactlyOnce(legacyTest, oldLegacyBody, 'legacy Step 1 body');
legacyTest = legacyTest.replace(oldLegacyBody, newLegacyBody);
fs.writeFileSync(legacyDiagnosticTestPath, legacyTest.replace(/[ \t]+$/gm, ''));

let shieldLabTest = fs.readFileSync(shieldLabTestPath, 'utf8');
const verificationRead = `const verificationReportSource = readFileSync(\n  new URL('../tools/action-studio/shield-parry-r281/verification-report.js', import.meta.url),\n  'utf8',\n);`;
requireExactlyOnce(shieldLabTest, verificationRead, 'shield lab verification report read');
shieldLabTest = shieldLabTest.replace(
  verificationRead,
  `${verificationRead}\nconst directOldB3DiagnosticSource = readFileSync(\n  new URL('../tools/action-studio/shield-parry-r281/direct-old-b3-diagnostic.js', import.meta.url),\n  'utf8',\n);`,
);
const oldShieldStep1 = `test('Step 1 direct OLD B3 remains independent of Step 3A runtime', () => {\n  const directB3 = functionBody('forceOldTwoActorB3', 'startAttack');\n  assert.match(directB3, /publishPostCouplingRecoilStaggerHandoff/);\n  assert.match(directB3, /combat\\.update\\(0\\.021/);\n  assert.doesNotMatch(directB3, /swordGripConstraint\\.start/);\n});`;
const newShieldStep1 = `test('Step 1 direct OLD B3 remains independent of Step 3A runtime', () => {\n  const directB3 = functionBody('forceOldTwoActorB3', 'startAttack');\n  assert.match(directB3, /directOldB3DiagnosticController\\.run/);\n  assert.match(directOldB3DiagnosticSource, /publishPostCouplingRecoilStaggerHandoff/);\n  assert.match(directOldB3DiagnosticSource, /combat\\.update\\(0\\.021/);\n  assert.doesNotMatch(directOldB3DiagnosticSource, /swordGripConstraint\\.start/);\n});`;
requireExactlyOnce(shieldLabTest, oldShieldStep1, 'shield lab Step 1 body');
shieldLabTest = shieldLabTest.replace(oldShieldStep1, newShieldStep1);
fs.writeFileSync(shieldLabTestPath, shieldLabTest.replace(/[ \t]+$/gm, ''));

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const testToken = 'tests/shield-parry-r281-direct-old-b3-diagnostic.test.js';
const anchor = 'tests/shield-parry-r281-verification-report.test.js';
if (!pkg.scripts?.test?.includes(testToken)) {
  requireExactlyOnce(pkg.scripts.test, anchor, 'package test anchor');
  pkg.scripts.test = pkg.scripts.test.replace(anchor, `${anchor} ${testToken}`);
}
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log('R18M.C4 direct OLD B3 diagnostic migration applied.');
