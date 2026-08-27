import { createAttackAdvanceRuntime } from '../../../src/combat/attack-advance.js';
import { createEngagementGround } from '../../../src/combat/engagement-ground.js';
import { createLaneLocomotionRuntime } from '../../../src/combat/lane-locomotion.js';

// R18Z.1 — where the two fighters are standing, and nothing else.
//
// Two rules and one mechanism, kept together because they are one question. attack-advance says how
// far a swing carries the attacker; engagement-ground keeps the ledger of what each fighter has
// gained or given up; this writes the result onto the scene. Splitting them across the entry meant
// three separate calls all having to remember to re-apply, which is exactly the kind of ordering
// the entry should not be carrying.
//
// It owns no authority over whether anything was hit. It is told an outcome and moves people.
export function createShieldParryLaneController({ labScene }) {
  const advance = createAttackAdvanceRuntime();
  const defenderFeet = createLaneLocomotionRuntime();
  const ground = createEngagementGround({
    startSeparationMeters: labScene.engagementStance.separationMeters,
  });

  function apply() {
    labScene.setLanePositions(ground.report);
    return ground.report;
  }

  return Object.freeze({
    startAttack(direction, contactSeconds) {
      return advance.start({ direction, contactSeconds, startSeconds: 0 });
    },
    // Called every frame of a live swing, before anything reads a world position: the guard tracks
    // the attacker and the swept probe measures the blade, so both must see where the step has
    // actually carried him.
    update(elapsedSeconds) {
      ground.setAttackerSwing(advance.update(elapsedSeconds)?.advanceMeters ?? 0);
      return apply();
    },
    // The defender's feet run every frame, attack or no attack, which is the point: standing still
    // is a choice they are making rather than the only thing available to them.
    setDefenderIntent(intent) {
      return defenderFeet.setIntent(intent);
    },
    walkDefender(deltaSeconds) {
      // Measured against the live gap, so the clamp that stops them walking through each other is
      // checked against where they actually are this frame rather than where they started.
      const step = defenderFeet.update({ deltaSeconds, separationMeters: ground.separationMeters });
      if (step.meters !== 0) { ground.moveDefender(step.meters); apply(); }
      return step;
    },
    get defenderIntent() { return defenderFeet.intent; },
    // A landed blow is the only thing that banks ground. The outcome decides which way it moves:
    // blocking costs the defender more than the attacker, a parry costs the attacker far more.
    settle(outcome) {
      const settled = ground.settleImpact(outcome);
      if (settled) apply();
      return settled;
    },
    // The swing is released rather than the lane reset: a step that bought no contact buys no
    // ground, but ground a previous blow moved is not handed back between attacks.
    release() {
      advance.reset();
      // Intent survives a reset -- a held key is still held. Only the swing is given up.
      ground.releaseSwing();
      return apply();
    },
    get report() { return ground.report; },
    get separationMeters() { return ground.separationMeters; },
  });
}
