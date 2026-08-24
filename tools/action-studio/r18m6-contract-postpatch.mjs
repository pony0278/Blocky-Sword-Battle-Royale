import { readFile, writeFile } from 'node:fs/promises';

const path = 'tests/shield-sword-hand-contact-coupling-lab.test.js';
let source = await readFile(path, 'utf8');

function replaceTestBlock(text, title, nextTitle, replacement) {
  const startMarker = `test('${title}', () => {`;
  const endMarker = `test('${nextTitle}', () => {`;
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end <= start) throw new Error(`postpatch boundary missing: ${title}`);
  return text.slice(0, start) + replacement + '\n\n' + text.slice(end);
}

source = replaceTestBlock(
  source,
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
  for (const marker of [
    'if (ownsLiveContact())',
    'TWO_ACTOR_PARRY_REACTION_CHANNELS.LIVE_CONTACT_HOLD',
    'TWO_ACTOR_PARRY_REACTION_PHASE_LATCHES.LIVE_CONTACT',
    'holdAttackerInterruption: true',
  ]) assert.ok(beforeGuard.includes(marker), marker);
  for (const marker of [
    'swordGripConstraint.update(deltaSeconds',
    'surfaceAtFrame: buckler.getWorldParrySurface()',
    'reactionIntentAppliedBeforeConstraint: false',
    'releaseLiveContactToOldB3({ selectedDirection })',
  ]) assert.ok(afterGuard.includes(marker), marker);

  for (const marker of [
    'publishPostCouplingRecoilStaggerHandoff',
    'releasedToOldB3',
    'b3BodyClockStartedAtImpact: false',
    'fullOldB3ReactionIntentActiveAtImpact: false',
    'contactConstraintOwnsUntilDeflectImpulse: true',
    'boundedProximalArmCorrectionBeforeForearmAndWrist',
    'proximalAssistBone',
  ]) assert.ok(postContactOwnershipSource.includes(marker), marker);
  assert.ok(source.includes('weaponArmRemainsContactConstrainedDuringStep3A'));
  assert.ok(contactHandoffSource.includes('exchangeState.frozenAttackerContactPose = captureRigPose(attacker.rig)'));
  assert.ok(source.includes('applyRigPose(attacker.rig, exchangeState.frozenAttackerContactPose)'));
  assert.ok(source.includes('exchangeState.canonicalAttackerOldB3Pose = captureRigPose(attacker.rig)'));
  assert.ok(source.includes('sampleCanonicalInterruptionPose(interruption)'));
  assert.ok(source.includes('frozenContactPoseRestoredBeforeEveryBodyOverlay'));
  assert.ok(source.includes('bodyCompletionCannotReleaseContactOwnedPose'));
  assert.ok(source.includes('contactOwnsFinalPoseBeforeVisibleOldB3'));
  assert.ok(source.includes('b3PresentationParkedAtOriginDuringLiveContact'));
});`,
);

source = replaceTestBlock(
  source,
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
  assert.ok(beforeGuard.includes('postCouplingHandoffApplied === true'));
  assert.ok(beforeGuard.includes('handoffConsumedByOldB3: true'));
  for (const marker of [
    'oldB3ReleaseStartPresentationMs',
    'continuityBridgeMs',
    'continuationStartedAtPresentationMs',
    'bodyRestartedAtRelease: false',
    'continuationPlanIdentityPreserved',
    'continuationElapsedPreserved',
    'attackerReactionDefinitionId',
    'oldB3PlanBackwardPitchDegrees',
    'oldB3AppliedBodyChainPitchAtReleaseDegrees',
    'oldB3InitialElapsedMs',
    'OLD B3 STARTED',
    'full-rig-live-contact-pose-to-canonical-interruption-pose',
  ]) assert.ok(contactHandoffSource.includes(marker), marker);
  assert.ok(source.includes('parryImpactSelectsExaggeratedOldB3ReactionDefinition'));
  assert.ok(postContactOwnershipSource.includes('deflect-impulse-continuity-bridge-to-canonical-old-b3-from-zero'));
  assert.ok(source.includes("from '../../src/combat/post-coupling-recoil-stagger-handoff.js';"));
  assert.ok(!source.includes('post-coupling-recoil-stagger-handoff.js?v='));
  assert.ok(source.includes('deflectImpulseStartsOldB3FromZeroWithoutBodyRestart'));
  assert.ok(postContactOwnershipSource.includes('measureAttackerRecoilWorldSilhouette'));
  assert.ok(source.includes('visibleOldB3Peak?.readable === true'));
  assert.ok(!source.includes('visibleOldB3Peak?.backwardChainPitchDegrees'));
  assert.match(html, /canonical OLD B3.*elapsed 0/);
});`,
);

await writeFile(path, source, 'utf8');
console.log('R18M.6 lifecycle contract postpatch applied with explicit includes/index ordering checks.');
