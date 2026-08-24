import { readFile, writeFile } from 'node:fs/promises';

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

function replaceTestBlockSource(source, title, nextTitle, replacementName) {
  const startMarker = `test('${title}', () => {`;
  const endMarker = `test('${nextTitle}', () => {`;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end <= start) throw new Error(`test block boundary missing: ${title}`);
  const block = source.slice(start, end);
  if (!block.includes('source,')) throw new Error(`test block has no source fixture: ${title}`);
  return source.slice(0, start) + block.replaceAll('source,', `${replacementName},`) + source.slice(end);
}

function replaceTestBlock(source, title, nextTitle, replacement) {
  const startMarker = `test('${title}', () => {`;
  const endMarker = `test('${nextTitle}', () => {`;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end <= start) throw new Error(`test block boundary missing: ${title}`);
  return source.slice(0, start) + replacement + '\n\n' + source.slice(end);
}

const regressionPath = 'tests/shield-driven-contact-coupling-r281-regression.test.js';
let regression = await readFile(regressionPath, 'utf8');
regression = replaceOnce(
  regression,
  ");\nconst html = await readFile(\n  new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url),",
  ");\nconst contactHandoffSource = await readFile(\n  new URL('../tools/action-studio/shield-parry-r281/contact-handoff-controller.js', import.meta.url),\n  'utf8',\n);\nconst html = await readFile(\n  new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url),",
  'R18M.1 contact handoff fixture',
);
regression = replaceOnce(
  regression,
  "assert.match(source, /(?:exchangeState\\.)?latestParryConfirmation = selectedMode === 'parry'[\\s\\S]*parryGate\\.confirm\\(\\{/);",
  "assert.match(contactHandoffSource, /exchangeState\\.latestParryConfirmation = selectedMode === 'parry'[\\s\\S]*parryGate\\.confirm\\(\\{/);",
  'R18M.1 Parry confirmation ownership',
);
regression = replaceOnce(
  regression,
  "const body = sliceFunction(source, 'function resolveContact(');",
  "const body = sliceBetween(contactHandoffSource, 'function resolveContact(', 'function updateCombatBeforeGuard(');",
  'R18M.1 resolveContact ownership',
);
regression = replaceOnce(
  regression,
  "const body = sliceBetween(source, 'function releaseLiveContactToOldB3()', 'function recordVisibleOldB3Sample(');",
  "const body = sliceBetween(contactHandoffSource, 'function releaseLiveContactToOldB3({ selectedDirection })', 'function recordVisibleOldB3Sample(');",
  'R18M.1 release ownership',
);
regression = replaceOnce(
  regression,
  "assert.match(source, /marker: 'deflect-impulse'/);",
  "assert.match(contactHandoffSource, /marker: 'deflect-impulse'/);",
  'R18M.1 deflect marker ownership',
);
regression = replaceTestBlockSource(
  regression,
  'R18M.1 locks TOP\\/RIGHT calibrated arm assistance while LEFT release remains deferred',
  'R18M.1 locks current verification budget so extraction cannot silently expand telemetry',
  'contactHandoffSource',
);
await writeFile(regressionPath, regression, 'utf8');

const exchangePath = 'tests/shield-parry-r281-exchange-state.test.js';
let exchange = await readFile(exchangePath, 'utf8');
exchange = replaceOnce(
  exchange,
  "const preContactController = await readFile(new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url), 'utf8');\nconst exchangeOwnershipSources = `${entry}\\n${preContactController}`;",
  "const preContactController = await readFile(new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url), 'utf8');\nconst contactHandoffController = await readFile(new URL('../tools/action-studio/shield-parry-r281/contact-handoff-controller.js', import.meta.url), 'utf8');\nconst exchangeOwnershipSources = `${entry}\\n${preContactController}\\n${contactHandoffController}`;",
  'R18M.4 contact ownership fixture',
);
await writeFile(exchangePath, exchange, 'utf8');

const preContactPath = 'tests/shield-parry-r281-pre-contact-controller.test.js';
let preContact = await readFile(preContactPath, 'utf8');
preContact = replaceOnce(
  preContact,
  "const controller = await readFile(new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url), 'utf8');\n",
  "const controller = await readFile(new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url), 'utf8');\nconst contactHandoffController = await readFile(new URL('../tools/action-studio/shield-parry-r281/contact-handoff-controller.js', import.meta.url), 'utf8');\n",
  'R18M.5 contact handoff fixture',
);
preContact = replaceOnce(
  preContact,
  "  assert.match(entry, /preContactController\\.recordWhiffProbe\\(snapshot, exchangeState\\.latestContact\\);/);",
  "  assert.match(contactHandoffController, /preContactController\\.recordWhiffProbe\\(snapshot, exchangeState\\.latestContact\\);/);",
  'R18M.5 whiff recorder ownership',
);
preContact = replaceOnce(
  preContact,
  "test('R18M.5 whiff probing remains diagnostic and real swept contact stays authoritative in entry', () => {",
  "test('R18M.5 whiff probing remains diagnostic and real swept contact stays authoritative outside pre-contact', () => {",
  'R18M.5 test title',
);
preContact = replaceOnce(
  preContact,
  "  const probeIndex = entry.indexOf('exchangeState.latestContact = probeSweptSwordBucklerContact({');\n  const whiffIndex = entry.indexOf('preContactController.recordWhiffProbe(snapshot, exchangeState.latestContact);', probeIndex);\n  const confirmIndex = entry.indexOf('parryGate.confirm({ attackSnapshot: snapshot, contact: exchangeState.latestContact })', probeIndex);\n  const resolveIndex = entry.indexOf('exchangeState.latestCombatResult = combat.resolveContact({', probeIndex);",
  "  const probeIndex = contactHandoffController.indexOf('exchangeState.latestContact = probeSweptSwordBucklerContact({');\n  const whiffIndex = contactHandoffController.indexOf('preContactController.recordWhiffProbe(snapshot, exchangeState.latestContact);', probeIndex);\n  const confirmIndex = contactHandoffController.indexOf('parryGate.confirm({ attackSnapshot: snapshot, contact: exchangeState.latestContact })', probeIndex);\n  const resolveIndex = contactHandoffController.indexOf('exchangeState.latestCombatResult = combat.resolveContact({', probeIndex);",
  'R18M.5 authoritative contact ownership',
);
preContact = replaceOnce(
  preContact,
  "  assert.match(entry, /swordGripConstraint\\.start\\(\\{/);\n  assert.match(entry, /buildLiveParryOldB3Handoff\\(\\{/);\n  assert.match(entry, /continuityBridgeMs: handoff\\.releaseBlendMs/);",
  "  assert.match(contactHandoffController, /swordGripConstraint\\.start\\(\\{/);\n  assert.match(contactHandoffController, /buildLiveParryOldB3Handoff\\(\\{/);\n  assert.match(contactHandoffController, /continuityBridgeMs: handoff\\.releaseBlendMs/);",
  'R18M.5 post-contact ownership',
);
await writeFile(preContactPath, preContact, 'utf8');

const gatePath = 'tests/committed-parry-contact-gate-lab.test.js';
let gate = await readFile(gatePath, 'utf8');
gate = replaceOnce(
  gate,
  "const preContactSource = readFileSync(new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url), 'utf8');\n",
  "const preContactSource = readFileSync(new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url), 'utf8');\nconst contactHandoffSource = readFileSync(new URL('../tools/action-studio/shield-parry-r281/contact-handoff-controller.js', import.meta.url), 'utf8');\n",
  'committed gate contact fixture',
);
gate = replaceOnce(
  gate,
  "function preContactFunctionBody(name, nextName) {",
  "function contactHandoffFunctionBody(name, nextName) {\n  const start = contactHandoffSource.indexOf(`function ${name}(`);\n  const end = contactHandoffSource.indexOf(`function ${nextName}(`, start + 1);\n  assert.notEqual(start, -1, `${name} must exist in contact handoff controller`);\n  assert.notEqual(end, -1, `${nextName} must exist in contact handoff controller`);\n  return contactHandoffSource.slice(start, end);\n}\n\nfunction preContactFunctionBody(name, nextName) {",
  'committed gate contact helper',
);
gate = replaceOnce(
  gate,
  "const resolve = functionBody('resolveContact', 'updateHud');",
  "const resolve = contactHandoffFunctionBody('resolveContact', 'updateCombatBeforeGuard');",
  'Step3A gate resolve ownership',
);
gate = replaceOnce(
  gate,
  "const resolve = functionBody('resolveContact', 'updateHud');",
  "const resolve = contactHandoffFunctionBody('resolveContact', 'updateCombatBeforeGuard');",
  'Step2 block fallback resolve ownership',
);
await writeFile(gatePath, gate, 'utf8');

const couplingPath = 'tests/shield-sword-hand-contact-coupling-lab.test.js';
let coupling = await readFile(couplingPath, 'utf8');
coupling = replaceOnce(
  coupling,
  "const preContactSource = readFileSync(\n  new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url),\n  'utf8',\n);\n",
  "const preContactSource = readFileSync(\n  new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url),\n  'utf8',\n);\nconst contactHandoffSource = readFileSync(\n  new URL('../tools/action-studio/shield-parry-r281/contact-handoff-controller.js', import.meta.url),\n  'utf8',\n);\nconst postContactOwnershipSource = `${source}\\n${contactHandoffSource}`;\n",
  'coupling contact fixture',
);
coupling = replaceTestBlock(
  coupling,
  'R18I lets live contact own the final pose while OLD B3 waits at presentation origin',
  'R18I preserves predictive defender time and latches the defender deflect marker',
  `test('R18I lets live contact own the final pose while OLD B3 waits at presentation origin', () => {
  const frameStart = source.indexOf('function frame(');
  const frameEnd = source.indexOf('requestAnimationFrame(frame);', frameStart);
  assert.ok(frameStart >= 0 && frameEnd > frameStart);
  const frame = source.slice(frameStart, frameEnd);
  const combatDelegate = frame.indexOf('contactHandoffController.updateCombatBeforeGuard({');
  const guardUpdate = frame.indexOf('guardRuntime.update(deltaMs, camera)', combatDelegate);
  const deflectLatch = frame.indexOf('contactHandoffController.updateDefenderDeflectReleaseGate()', guardUpdate);
  const liveDelegate = frame.indexOf('contactHandoffController.updateLiveConstraintAfterGuard({', deflectLatch);
  const swordUpdate = frame.indexOf('attackerSword.update(); defenderSword?.update();', liveDelegate);
  assert.ok(combatDelegate >= 0 && guardUpdate > combatDelegate && deflectLatch > guardUpdate);
  assert.ok(liveDelegate > deflectLatch && swordUpdate > liveDelegate);

  const beforeGuardStart = contactHandoffSource.indexOf('function updateCombatBeforeGuard(');
  const beforeGuardEnd = contactHandoffSource.indexOf('function updateLiveConstraintAfterGuard(', beforeGuardStart);
  const beforeGuard = contactHandoffSource.slice(beforeGuardStart, beforeGuardEnd);
  const afterGuard = contactHandoffSource.slice(beforeGuardEnd);
  assert.match(beforeGuard, /if \(ownsLiveContact\(\)\)/);
  assert.match(beforeGuard, /TWO_ACTOR_PARRY_REACTION_CHANNELS\.LIVE_CONTACT_HOLD/);
  assert.match(beforeGuard, /TWO_ACTOR_PARRY_REACTION_PHASE_LATCHES\.LIVE_CONTACT/);
  assert.match(beforeGuard, /holdAttackerInterruption: true/);
  assert.match(afterGuard, /swordGripConstraint\.update\(deltaSeconds/);
  assert.match(afterGuard, /surfaceAtFrame: buckler\.getWorldParrySurface\(\)/);
  assert.match(afterGuard, /reactionIntentAppliedBeforeConstraint: false/);
  assert.match(afterGuard, /releaseLiveContactToOldB3\(\{ selectedDirection \}\)/);

  assert.match(postContactOwnershipSource, /publishPostCouplingRecoilStaggerHandoff/);
  assert.match(postContactOwnershipSource, /releasedToOldB3/);
  assert.match(postContactOwnershipSource, /b3BodyClockStartedAtImpact: false/);
  assert.match(postContactOwnershipSource, /fullOldB3ReactionIntentActiveAtImpact: false/);
  assert.match(postContactOwnershipSource, /contactConstraintOwnsUntilDeflectImpulse: true/);
  assert.match(postContactOwnershipSource, /boundedProximalArmCorrectionBeforeForearmAndWrist/);
  assert.match(postContactOwnershipSource, /proximalAssistBone/);
  assert.match(source, /weaponArmRemainsContactConstrainedDuringStep3A/);
  assert.match(contactHandoffSource, /exchangeState\.frozenAttackerContactPose = captureRigPose\(attacker\.rig\)/);
  assert.match(source, /applyRigPose\(attacker\.rig, exchangeState\.frozenAttackerContactPose\)/);
  assert.match(source, /exchangeState\.canonicalAttackerOldB3Pose = captureRigPose\(attacker\.rig\)/);
  assert.match(source, /sampleCanonicalInterruptionPose\(interruption\)/);
  assert.match(source, /frozenContactPoseRestoredBeforeEveryBodyOverlay/);
  assert.match(source, /bodyCompletionCannotReleaseContactOwnedPose/);
  assert.match(source, /contactOwnsFinalPoseBeforeVisibleOldB3/);
  assert.match(source, /b3PresentationParkedAtOriginDuringLiveContact/);
});`,
);
coupling = replaceTestBlock(
  coupling,
  'R18I releases contact through 28ms continuity and starts canonical OLD B3 from zero',
  'Step 3A uses bounded lowerarm plus wrist hierarchy travel instead of a scheduled target angle',
  `test('R18I releases contact through 28ms continuity and starts canonical OLD B3 from zero', () => {
  const frameStart = source.indexOf('function frame(');
  const frameEnd = source.indexOf('requestAnimationFrame(frame);', frameStart);
  const frame = source.slice(frameStart, frameEnd);
  const combatDelegate = frame.indexOf('contactHandoffController.updateCombatBeforeGuard({');
  const guardUpdate = frame.indexOf('guardRuntime.update(deltaMs, camera)', combatDelegate);
  const deflectLatch = frame.indexOf('contactHandoffController.updateDefenderDeflectReleaseGate()', guardUpdate);
  const liveDelegate = frame.indexOf('contactHandoffController.updateLiveConstraintAfterGuard({', deflectLatch);
  assert.ok(combatDelegate >= 0 && guardUpdate > combatDelegate && deflectLatch > guardUpdate && liveDelegate > deflectLatch);

  const beforeGuardStart = contactHandoffSource.indexOf('function updateCombatBeforeGuard(');
  const beforeGuardEnd = contactHandoffSource.indexOf('function updateLiveConstraintAfterGuard(', beforeGuardStart);
  const beforeGuard = contactHandoffSource.slice(beforeGuardStart, beforeGuardEnd);
  assert.match(beforeGuard, /postCouplingHandoffApplied === true/);
  assert.match(beforeGuard, /handoffConsumedByOldB3: true/);
  assert.match(contactHandoffSource, /oldB3ReleaseStartPresentationMs/);
  assert.match(contactHandoffSource, /continuityBridgeMs/);
  assert.match(contactHandoffSource, /continuationStartedAtPresentationMs/);
  assert.match(contactHandoffSource, /bodyRestartedAtRelease: false/);
  assert.match(contactHandoffSource, /continuationPlanIdentityPreserved/);
  assert.match(contactHandoffSource, /continuationElapsedPreserved/);
  assert.match(contactHandoffSource, /attackerReactionDefinitionId/);
  assert.match(contactHandoffSource, /oldB3PlanBackwardPitchDegrees/);
  assert.match(contactHandoffSource, /oldB3AppliedBodyChainPitchAtReleaseDegrees/);
  assert.match(contactHandoffSource, /oldB3InitialElapsedMs/);
  assert.match(source, /parryImpactSelectsExaggeratedOldB3ReactionDefinition/);
  assert.match(postContactOwnershipSource, /deflect-impulse-continuity-bridge-to-canonical-old-b3-from-zero/);
  assert.match(source, /from '\.\.\/\.\.\/src\/combat\/post-coupling-recoil-stagger-handoff\.js';/);
  assert.doesNotMatch(source, /post-coupling-recoil-stagger-handoff\.js\?v=/);
  assert.match(contactHandoffSource, /OLD B3 STARTED/);
  assert.match(source, /deflectImpulseStartsOldB3FromZeroWithoutBodyRestart/);
  assert.match(contactHandoffSource, /full-rig-live-contact-pose-to-canonical-interruption-pose/);
  assert.match(postContactOwnershipSource, /measureAttackerRecoilWorldSilhouette/);
  assert.match(source, /visibleOldB3Peak\?\.readable === true/);
  assert.doesNotMatch(source, /visibleOldB3Peak\?\.backwardChainPitchDegrees/);
  assert.match(html, /canonical OLD B3.*elapsed 0/);
});`,
);
await writeFile(couplingPath, coupling, 'utf8');

console.log('R18M.6 contract patch prepared:');
console.log('- R18M.1 authority chain follows contact-handoff controller without weakening ordering assertions');
console.log('- R18M.4 exchange ownership covers entry + pre-contact + contact-handoff modules');
console.log('- R18M.5 preserves the pre-contact boundary while post-contact authority moves to R18M.6');
console.log('- four newly exposed legacy inline-contact contracts now assert entry ordering plus controller authority');
