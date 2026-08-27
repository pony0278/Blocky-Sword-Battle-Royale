import { PARRY_ROOT_DISPLACEMENT_PROFILES, BLOCK_ROOT_DISPLACEMENT_PROFILES } from './parry-root-displacement.js';

export const ENGAGEMENT_GROUND_STAGE = 'R18Z.1';

// R18Z.1: who is standing where, after everything that has happened to them.
//
// Both fighters already moved, and neither of them kept any of it. The attacker's step into a
// swing was applied straight onto the scene stance and wiped by the next exchange reset; the
// impact recoil re-derived from a position captured at contact and returned to it exactly, so a
// blow that visibly shoved someone half a pace back left them standing precisely where they were.
// Ground was borrowed for the length of an animation and always handed back.
//
// This owns it instead. One lane, one offset per fighter, and every source of movement writes into
// the same ledger so that separation is the arithmetic of what both of them did rather than a
// constant somebody has to keep correcting.
//
// The lane runs along +z. The attacker starts on the negative side facing the defender, so a
// positive attacker offset is ground gained and a positive defender offset is ground given up.
//
// On the recoil peaks being kept in full rather than a fraction of them: the peak is where the
// blow actually put them, and the settle that follows is a fighter recovering their posture, not
// recovering their ground. Splitting that into a retention ratio would mean inventing a number
// nothing has measured. The animation still overshoots and gathers back - it just gathers back to
// the new ground instead of the old.
export const ENGAGEMENT_GROUND_TRANSFERS = Object.freeze({
  block: Object.freeze({
    outcome: 'block',
    attackerMeters: -BLOCK_ROOT_DISPLACEMENT_PROFILES.attacker.peakMeters,
    defenderMeters: BLOCK_ROOT_DISPLACEMENT_PROFILES.defender.peakMeters,
    authority: 'a-held-shield-gives-ground-and-rebounds-the-blade',
  }),
  parry: Object.freeze({
    outcome: 'parry',
    attackerMeters: -PARRY_ROOT_DISPLACEMENT_PROFILES.attacker.peakMeters,
    defenderMeters: PARRY_ROOT_DISPLACEMENT_PROFILES.defender.peakMeters,
    authority: 'a-parry-throws-the-attacker-and-costs-the-defender-little',
  }),
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function resolveGroundTransfer(outcome) {
  const key = String(outcome || '').toLowerCase();
  if (key === 'perfect-parry') return ENGAGEMENT_GROUND_TRANSFERS.parry;
  return ENGAGEMENT_GROUND_TRANSFERS[key] || null;
}

// Holds the ledger for one exchange lane. Offsets are metres along +z from whatever stance the
// scene put the fighters at, so the stance stays the base and this only ever says how far the
// fight has carried them off it.
export function createEngagementGround(options = {}) {
  const startSeparationMeters = Math.max(0, finite(options.startSeparationMeters, 0));
  let attackerGroundMeters = 0;
  let defenderGroundMeters = 0;
  // The attacker's step is separate from their ground because it is still being spent: it grows
  // through the swing and is only banked once the exchange resolves. Keeping it apart is what lets
  // a whiffed attack be undone without unwinding the ground a previous blow moved.
  let attackerSwingMeters = 0;

  function report() {
    const attackerMeters = attackerGroundMeters + attackerSwingMeters;
    return Object.freeze({
      stage: ENGAGEMENT_GROUND_STAGE,
      attackerMeters,
      defenderMeters: defenderGroundMeters,
      attackerGroundMeters,
      attackerSwingMeters,
      // Positive is still apart. The defender retreating opens the gap, the attacker advancing
      // closes it, and this is the number every coverage band is a fact about.
      separationMeters: startSeparationMeters + defenderGroundMeters - attackerMeters,
      startSeparationMeters,
      authority: 'lane-position-ledger-no-contact-authority',
    });
  }

  // R19A.1: the defender's own feet. Incremental rather than absolute, because unlike a swing this
  // has no timeline to re-derive from - it is just distance covered since the last frame, and it is
  // banked immediately: ground taken by walking is not contingent on anything landing.
  function moveDefender(meters) {
    defenderGroundMeters += finite(meters);
    return report();
  }

  // Absolute for the swing in progress, so a repeated frame cannot walk the attacker forward.
  function setAttackerSwing(meters) {
    attackerSwingMeters = finite(meters);
    return report();
  }

  // Banks the step that has been spent and applies what the blow did to both fighters. Called once
  // per resolved contact; a whiff never reaches it, so an attack that hits nothing keeps no ground.
  function settleImpact(outcome) {
    const transfer = resolveGroundTransfer(outcome);
    if (!transfer) return null;
    attackerGroundMeters += attackerSwingMeters + transfer.attackerMeters;
    defenderGroundMeters += transfer.defenderMeters;
    attackerSwingMeters = 0;
    return Object.freeze({ ...report(), transfer });
  }

  // The swing is given up without banking it. This is what an exchange reset does, and it is why
  // resetting between attacks no longer quietly returns both fighters to their starting marks.
  function releaseSwing() {
    attackerSwingMeters = 0;
    return report();
  }

  function reset() {
    attackerGroundMeters = 0;
    defenderGroundMeters = 0;
    attackerSwingMeters = 0;
    return report();
  }

  return Object.freeze({
    moveDefender,
    setAttackerSwing,
    settleImpact,
    releaseSwing,
    reset,
    get report() { return report(); },
    get attackerMeters() { return attackerGroundMeters + attackerSwingMeters; },
    get defenderMeters() { return defenderGroundMeters; },
    get separationMeters() { return report().separationMeters; },
  });
}
