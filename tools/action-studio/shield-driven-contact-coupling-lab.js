import { createDefaultCharacter } from '../../src/character/default-character.js';
import { createDebugSword, mountDebugSword } from '../../src/character/debug-sword.js';
import { DEFAULT_KAYKIT_SWORD_MOUNT } from '../../src/character/default-character-mount.js';
import { createProceduralBuckler, mountOffhandBuckler } from '../../src/character/offhand-buckler.js';
import {
  ACCEPTED_OFFHAND_BUCKLER_MOUNT_G423,
  ACCEPTED_OFFHAND_BUCKLER_SHAPE_G423,
} from '../../src/character/offhand-buckler-accepted-calibration.js';
import { loadUal1AnimationLibrary } from '../../src/animation/ual1-animation-library.js';
import { loadUal2AnimationLibrary } from '../../src/animation/ual2-animation-library.js';
import { loadSkyrimConvertedAnimationLibrary } from '../../src/animation/skyrim-converted-animation-library.js';
import { composeSkyrimWeaponMountCalibration } from '../../src/animation/skyrim-weapon-bind-calibration.js';
import { GUARD_EVENTS, GUARD_STATES, createGuardStateMachine } from '../../src/combat/guard-state-machine.js';
import { createGuardPresentationRuntime } from '../../src/combat/guard-presentation-runtime.js';
import { createLongswordDirectionalAttackRuntime, LONGSWORD_ATTACK_PHASES } from '../../src/combat/longsword-directional-attack-runtime.js';
import { probeSweptSwordBucklerContact } from '../../src/combat/swept-sword-buckler-contact.js';
import { createGuardThreatTrackingRuntime, planGuardThreatCorrection } from '../../src/combat/guard-threat-tracking.js';
import {
  analyzePredictiveInterceptParry,
  createPredictiveInterceptParryPresentationRuntime,
} from '../../src/combat/predictive-intercept-parry.js';
import { createTwoActorCombatIntegration } from '../../src/combat/two-actor-combat-integration.js';
import {
  SHIELD_DRIVEN_CONTACT_COUPLING_STAGE,
  createShieldDrivenContactCouplingRuntime,
} from '../../src/combat/shield-driven-contact-coupling.js';

const THREE = window.THREE;
if (!THREE?.WebGLRenderer || !THREE?.GLTFLoader) throw new Error('G4.3B.5R.2 requires Three.js r128 + GLTFLoader');

const BLOCK_INTENT_AGE_MS = 260;
const PARRY_INTENT_AGE_MS = 120;
const PERFECT_INTENT_AGE_MS = 50;
const HUD_INTERVAL_MS = 50;
const REPORT_INTERVAL_MS = 160;

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.outputEncoding = THREE.sRGBEncoding;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090e16);
scene.fog = new THREE.Fog(0x090e16, 8, 18);
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
scene.add(new THREE.HemisphereLight(0xddeaff, 0x202738, 1.25));
const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(4, 7, 3); scene.add(key);
const rim = new THREE.DirectionalLight(0x7fe2cf, 0.55); rim.position.set(-4, 3, -4); scene.add(rim);
scene.add(new THREE.GridHelper(12, 24, 0x33445f, 0x202a3b));

const attacker = createDefaultCharacter(THREE);
const defender = createDefaultCharacter(THREE);
attacker.object3d.position.set(0, 0, -1.15);
defender.object3d.position.set(0, 0, 1.15);
defender.object3d.rotation.y = Math.PI;
scene.add(attacker.object3d, defender.object3d);

const attackerSword = createDebugSword(THREE);
mountDebugSword(attacker, attackerSword, DEFAULT_KAYKIT_SWORD_MOUNT);
let defenderSword = null;
const buckler = createProceduralBuckler(THREE, {
  ...ACCEPTED_OFFHAND_BUCKLER_SHAPE_G423,
  lineMode: true,
  solidVisible: false,
});
mountOffhandBuckler(defender, buckler, ACCEPTED_OFFHAND_BUCKLER_MOUNT_G423);
buckler.setParrySurfaceVisible(true);

const attackRuntime = createLongswordDirectionalAttackRuntime();
const guardMachine = createGuardStateMachine();
const guardRuntime = createGuardPresentationRuntime(THREE, { machine: guardMachine, character: defender });
const trackingRuntime = createGuardThreatTrackingRuntime(THREE, { rig: defender.rig, buckler });
const predictivePresentation = createPredictiveInterceptParryPresentationRuntime(THREE, { character: defender });
const couplingRuntime = createShieldDrivenContactCouplingRuntime(THREE, {
  defenderRig: defender.rig,
  attackerRig: attacker.rig,
  buckler,
});
const combat = createTwoActorCombatIntegration({
  THREE,
  attackerCharacter: attacker,
  attackRuntime,
  guardMachine,
  parrySync: {
    presentationOffsetSeconds: 0.35,
    parryAttackerRecoilDelayMs: 0,
    perfectParryAttackerRecoilDelayMs: 0,
  },
});

const hudAttack = document.getElementById('hudAttack');
const hudContact = document.getElementById('hudContact');
const hudCoupling = document.getElementById('hudCoupling');
const hudShield = document.getElementById('hudShield');
const hudWeapon = document.getElementById('hudWeapon');
const hudRecoil = document.getElementById('hudRecoil');
const status = document.getElementById('status');
const reportNode = document.getElementById('report');
const autoRepeat = document.getElementById('autoRepeat');
const showSurface = document.getElementById('showSurface');

let ready = false;
let selectedDirection = 'right';
let selectedMode = 'parry';
let lastTimestamp = performance.now();
let previousBlade = null;
let firstContact = null;
let latestAnalysis = null;
let latestTrackingPlan = null;
let latestTrackingReport = null;
let latestContact = null;
let latestCombatResult = null;
let latestCombatUpdate = null;
let latestCouplingReport = null;
let latestPredictiveReport = null;
let repeatCooldownMs = 0;
let attackerIdleDuration = 1;
let attackerIdleClockSeconds = 0;
let hudClockMs = HUD_INTERVAL_MS;
let reportClockMs = REPORT_INTERVAL_MS;

function marker(name, color, radius) {
  const node = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 12, 8),
    new THREE.MeshBasicMaterial({ color, depthWrite: false }),
  );
  node.name = name; node.visible = false; scene.add(node); return node;
}
const predictedMarker = marker('G43B5R2_PREDICTED', 0x6df0a7, 0.048);
const contactMarker = marker('G43B5R2_CONTACT', 0xff625f, 0.062);
const driveMarker = marker('G43B5R2_SHIELD_DRIVE', 0x59d9ff, 0.042);

const bladeNodes = [attackerSword.bladeBase, attackerSword.bladeMid, attackerSword.tip];
const bladeScratch = bladeNodes.map(() => new THREE.Vector3());
const bladeBuffers = [0, 1].map(() => bladeNodes.map(() => ({ x: 0, y: 0, z: 0 })));
let bladeBufferIndex = 0;
function captureBladePolyline() {
  attackerSword.object3d.updateMatrixWorld(true);
  const buffer = bladeBuffers[bladeBufferIndex]; bladeBufferIndex = 1 - bladeBufferIndex;
  for (let i = 0; i < bladeNodes.length; i += 1) {
    bladeNodes[i].getWorldPosition(bladeScratch[i]);
    buffer[i].x = bladeScratch[i].x; buffer[i].y = bladeScratch[i].y; buffer[i].z = bladeScratch[i].z;
  }
  return buffer;
}

function resize() {
  const width = Math.max(1, canvas.clientWidth); const height = Math.max(1, canvas.clientHeight);
  renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
}
function setView(view) {
  if (view === 'side') camera.position.set(5.8, 1.7, 0.1);
  else if (view === 'contact') camera.position.set(2.25, 1.5, 2.2);
  else camera.position.set(4.8, 2.4, 4.9);
  camera.lookAt(0, 1.05, 0); camera.updateMatrixWorld(true);
}
function enterGuard() {
  guardMachine.send(GUARD_EVENTS.RESET, { stage: SHIELD_DRIVEN_CONTACT_COUPLING_STAGE });
  guardRuntime.sync(camera);
  guardMachine.send(GUARD_EVENTS.GUARD_PRESS, { stage: SHIELD_DRIVEN_CONTACT_COUPLING_STAGE });
  guardRuntime.sync(camera);
  const report = guardRuntime.update(180, camera);
  if (report.snapshot.state !== GUARD_STATES.HOLD) throw new Error(`Expected Guard Hold, got ${report.snapshot.state}`);
}
function sampleAttacker(snapshot, deltaMs) {
  if (snapshot.action) {
    const profile = snapshot.action.runtime;
    attacker.sampleAnimation(profile.clipId, Math.min(profile.durationSeconds, snapshot.elapsedSeconds), {
      loop: false, inPlace: true, rootRotationPolicy: 'lock',
    });
    attacker.update(0, camera); return;
  }
  attackerIdleClockSeconds += deltaMs / 1000;
  attacker.sampleAnimation('UAL1/Sword_Idle', attackerIdleClockSeconds % Math.max(0.001, attackerIdleDuration), {
    loop: true, inPlace: true, rootRotationPolicy: 'lock',
  });
  attacker.update(0, camera);
}
function resetExchange() {
  couplingRuntime.reset(); predictivePresentation.reset(); trackingRuntime.reset();
  firstContact = null; latestContact = null; latestCombatResult = null; latestCombatUpdate = null;
  latestCouplingReport = null; latestPredictiveReport = null; latestAnalysis = null;
  latestTrackingPlan = null; latestTrackingReport = null;
  contactMarker.visible = false; predictedMarker.visible = false; driveMarker.visible = false;
}
function startAttack(direction = selectedDirection) {
  if (!ready || combat.active || attackRuntime.active || couplingRuntime.active) return false;
  if (guardMachine.state !== GUARD_STATES.HOLD) enterGuard();
  selectedDirection = direction; resetExchange(); repeatCooldownMs = 0;
  attackerSword.update(); previousBlade = captureBladePolyline();
  const started = combat.startAttack(direction); if (!started.accepted) return false;
  document.querySelectorAll('[data-attack]').forEach((button) => button.classList.toggle('active', button.dataset.attack === direction));
  return true;
}
function setMode(mode) {
  if (!['block', 'parry', 'perfect'].includes(mode)) return;
  selectedMode = mode;
  document.querySelectorAll('[data-mode]').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
}
function intentAgeMs() {
  if (selectedMode === 'perfect') return PERFECT_INTENT_AGE_MS;
  if (selectedMode === 'parry') return PARRY_INTENT_AGE_MS;
  return BLOCK_INTENT_AGE_MS;
}

function updatePreContact(snapshot, currentBlade, deltaSeconds) {
  if (!snapshot.action || firstContact) return;
  if (selectedMode === 'block') {
    latestTrackingPlan = previousBlade ? planGuardThreatCorrection({
      mode: 'guard', previousBlade, currentBlade,
      bucklerSurface: buckler.getWorldParrySurface(), deltaSeconds,
    }) : null;
    latestTrackingReport = trackingRuntime.update(latestTrackingPlan, deltaSeconds);
    defender.update(0, camera); defenderSword?.update();
    return;
  }

  latestAnalysis = analyzePredictiveInterceptParry({
    attackSnapshot: snapshot,
    previousBlade,
    currentBlade,
    bucklerSurface: buckler.getWorldParrySurface(),
    deltaSeconds,
    requestedGrade: selectedMode,
  });
  if (latestAnalysis?.threat?.point) {
    predictedMarker.position.set(latestAnalysis.threat.point.x, latestAnalysis.threat.point.y, latestAnalysis.threat.point.z);
    predictedMarker.visible = true;
  }
  if (!predictivePresentation.active && latestAnalysis?.shouldTrigger) {
    predictivePresentation.start({
      sequence: snapshot.sequence,
      requestedGrade: selectedMode,
      triggerTtcSeconds: latestAnalysis.triggerTtcSeconds,
    });
  }
  if (!predictivePresentation.active) return;
  latestPredictiveReport = predictivePresentation.update({
    deltaSeconds,
    timeToContactSeconds: latestAnalysis?.timeToContactSeconds,
    camera,
  });
  const postPresentationSurface = buckler.getWorldParrySurface();
  latestTrackingPlan = latestAnalysis?.threat ? planGuardThreatCorrection({
    mode: 'parry', threat: latestAnalysis.threat, bucklerSurface: postPresentationSurface,
  }) : null;
  latestTrackingReport = trackingRuntime.update(latestTrackingPlan, deltaSeconds);
  defender.update(0, camera); defenderSword?.update();
}

function resolveContact(snapshot, currentBlade, deltaSeconds) {
  if (!previousBlade || !snapshot.action || firstContact) return;
  latestContact = probeSweptSwordBucklerContact({
    previousBlade, currentBlade, bucklerSurface: buckler.getWorldParrySurface(),
    deltaSeconds, active: snapshot.phase === LONGSWORD_ATTACK_PHASES.ACTIVE,
  });
  if (!latestContact.contact) return;

  firstContact = latestContact;
  const surfaceAtContact = buckler.getWorldParrySurface();
  contactMarker.position.set(latestContact.point.x, latestContact.point.y, latestContact.point.z);
  contactMarker.visible = true; predictedMarker.visible = false;
  const handoff = predictivePresentation.active ? predictivePresentation.handoff() : null;
  const guardIntentAgeMs = handoff?.accepted ? handoff.guardIntentAgeMs : intentAgeMs();
  latestCombatResult = combat.resolveContact({ contact: latestContact, guardIntentAgeMs });
  if (!latestCombatResult.accepted) return;

  guardRuntime.sync(camera);
  const outcome = latestCombatResult.resolution.outcome;
  couplingRuntime.start({
    outcome,
    attackDirection: latestCombatResult.resolution.attackDirection,
    contact: latestContact,
    surfaceAtContact,
  });
  // Re-anchor the post-contact Guard pose to the actual contact surface immediately.
  combat.update(0, { camera });
  latestCouplingReport = couplingRuntime.update(0);
  attacker.update(0, camera); defender.update(0, camera);
  attackerSword.update(); defenderSword?.update();
}

function updateCoupling(deltaSeconds) {
  if (!couplingRuntime.active) return false;
  // Critical contract: sample the exact frozen attack pose without advancing B3.
  latestCombatUpdate = combat.update(0, { camera });
  latestCouplingReport = couplingRuntime.update(deltaSeconds);
  attacker.update(0, camera); defender.update(0, camera);
  attackerSword.update(); defenderSword?.update();
  if (latestCouplingReport?.finalSurface?.center) {
    const p = latestCouplingReport.finalSurface.center;
    driveMarker.position.set(p.x, p.y, p.z); driveMarker.visible = true;
  }
  if (latestCouplingReport?.complete) {
    trackingRuntime.reset(); driveMarker.visible = false;
  }
  return true;
}

function registerWhiff(snapshot) {
  if (selectedMode === 'block' || firstContact || !predictivePresentation.active) return;
  if (snapshot.action) return;
  predictivePresentation.reset(); trackingRuntime.reset(); predictedMarker.visible = false;
}

function magnitude(v) { return v ? Math.hypot(v.x || 0, v.y || 0, v.z || 0) : 0; }
function updateHud(snapshot, combatSnapshot) {
  hudAttack.textContent = `Attack: ${snapshot.direction?.toUpperCase() || selectedDirection.toUpperCase()} · ${snapshot.phase} · defense ${selectedMode.toUpperCase()}`;
  hudContact.textContent = firstContact
    ? `Contact: YES · radial ${firstContact.radialDistance.toFixed(3)}m · blade ${firstContact.bladeFraction.toFixed(2)}`
    : 'Contact: —';
  hudCoupling.textContent = latestCouplingReport
    ? `Coupling: ${latestCouplingReport.phase} · ${latestCouplingReport.elapsedMs.toFixed(0)}ms · ${latestCouplingReport.complete ? 'RELEASED' : 'B3 HELD'}`
    : 'Coupling: —';
  hudShield.textContent = latestCouplingReport?.shieldOffset
    ? `Shield drive: ${(magnitude(latestCouplingReport.shieldOffset) * 100).toFixed(1)}cm`
    : 'Shield drive: —';
  hudWeapon.textContent = latestCouplingReport?.attackerWeaponOffset
    ? `Weapon follow: ${(magnitude(latestCouplingReport.attackerWeaponOffset) * 100).toFixed(1)}cm · source=shield`
    : 'Weapon follow: —';
  const recoil = combatSnapshot.attackerRecoil?.sample;
  hudRecoil.textContent = couplingRuntime.active
    ? 'B3 recoil: LOCKED · coupling owns weapon motion'
    : recoil
      ? `B3 recoil: ${recoil.phase} · arm ${recoil.weights?.armWeight?.toFixed(2) ?? '—'} · torso ${recoil.weights?.torsoWeight?.toFixed(2) ?? '—'}`
      : 'B3 recoil: —';
}
function buildReport(combatSnapshot = combat.snapshot) {
  const exchange = combatSnapshot.activeExchange || combatSnapshot.lastExchange;
  const report = {
    stage: SHIELD_DRIVEN_CONTACT_COUPLING_STAGE,
    pass: ready,
    selectedDirection,
    selectedMode,
    contact: firstContact ? {
      point: firstContact.point,
      bladeFraction: firstContact.bladeFraction,
      incomingVelocity: firstContact.incomingVelocity,
    } : null,
    coupling: latestCouplingReport ? {
      outcome: latestCouplingReport.outcome,
      phase: latestCouplingReport.phase,
      elapsedMs: latestCouplingReport.elapsedMs,
      shieldDriveMeters: magnitude(latestCouplingReport.shieldOffset),
      attackerWeaponFollowMeters: magnitude(latestCouplingReport.attackerWeaponOffset),
      complete: latestCouplingReport.complete,
      releaseAttackerRecoil: latestCouplingReport.releaseAttackerRecoil,
    } : null,
    exchange: exchange ? {
      outcome: exchange.outcome,
      responseClass: exchange.responseClass,
      attackerRecoilDelayMs: exchange.attackerRecoilDelayMs,
    } : null,
    invariants: {
      swordShieldSweptContactAuthority: true,
      frozenAttackerPoseDuringCoupling: true,
      combatUpdateDeltaDuringCoupling: 0,
      defenderShieldMovesBeforeB3: true,
      attackerWeaponMotionDerivedFromShield: true,
      trackingResetAfterCouplingRelease: true,
      rootMotion: false,
    },
  };
  reportNode.textContent = JSON.stringify(report, null, 2);
  document.documentElement.dataset.g43b5r2 = report.pass ? 'pass' : 'fail';
  window.__G43B5R2_RESULT__ = report;
  return report;
}

async function main() {
  status.textContent = 'Loading UAL attacks + Skyrim Guard + shield coupling…';
  const [ual1, ual2, skyrim] = await Promise.all([
    loadUal1AnimationLibrary(new THREE.GLTFLoader(), { THREE, rig: attacker.rig, fps: 30 }),
    loadUal2AnimationLibrary(new THREE.GLTFLoader(), { THREE, rig: attacker.rig, fps: 30 }),
    loadSkyrimConvertedAnimationLibrary(new THREE.GLTFLoader(), { THREE, rig: defender.rig, fps: 30 }),
  ]);
  attacker.registerAnimations(ual1); attacker.registerAnimations(ual2); defender.registerAnimations(skyrim);
  attackerIdleDuration = attacker.getAnimationDuration('UAL1/Sword_Idle') || 1;
  const idle = skyrim.clips.get('SKYRIM_GUARD/shd_blockidle');
  const bind = idle?.userData?.weaponBindCalibration;
  if (!bind?.correctionQuaternion) throw new Error('G4.3B.5R.2 requires Skyrim Guard weapon bind calibration');
  defenderSword = createDebugSword(THREE);
  mountDebugSword(defender, defenderSword, composeSkyrimWeaponMountCalibration(THREE, DEFAULT_KAYKIT_SWORD_MOUNT, bind));
  enterGuard(); ready = true;
  status.textContent = 'G4.3B.5R.2 READY · contact → coupled shield drive → weapon follows shield → B3 release';
  status.className = 'good'; buildReport(); startAttack('right');
}

document.querySelectorAll('[data-attack]').forEach((button) => button.addEventListener('click', () => startAttack(button.dataset.attack)));
document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
showSurface.addEventListener('change', () => buckler.setParrySurfaceVisible(showSurface.checked));
setView('three'); resize(); addEventListener('resize', resize);

function frame(timestamp) {
  const deltaMs = Math.min(50, Math.max(0, timestamp - lastTimestamp));
  const deltaSeconds = Math.max(1e-5, deltaMs / 1000); lastTimestamp = timestamp;
  if (ready) {
    const snapshot = attackRuntime.update(deltaMs);
    const couplingOwned = couplingRuntime.active;
    if (combat.active) {
      if (!couplingOwned) {
        latestCombatUpdate = combat.update(deltaSeconds, { camera });
      }
    } else {
      sampleAttacker(snapshot, deltaMs);
    }

    if (!predictivePresentation.active) guardRuntime.update(deltaMs, camera);
    attackerSword.update(); defenderSword?.update();

    if (couplingOwned) {
      updateCoupling(deltaSeconds);
    } else {
      const currentBlade = captureBladePolyline();
      updatePreContact(snapshot, currentBlade, deltaSeconds);
      resolveContact(snapshot, currentBlade, deltaSeconds);
      previousBlade = currentBlade;
    }

    registerWhiff(snapshot);
    const combatSnapshot = combat.snapshot;
    hudClockMs += deltaMs; reportClockMs += deltaMs;
    if (hudClockMs >= HUD_INTERVAL_MS) { hudClockMs %= HUD_INTERVAL_MS; updateHud(snapshot, combatSnapshot); }
    if (reportClockMs >= REPORT_INTERVAL_MS) { reportClockMs %= REPORT_INTERVAL_MS; buildReport(combatSnapshot); }

    if (!combat.active && !attackRuntime.active && !couplingRuntime.active && guardMachine.state === GUARD_STATES.HOLD && autoRepeat.checked) {
      repeatCooldownMs += deltaMs; if (repeatCooldownMs >= 700) startAttack(selectedDirection);
    }
  }
  renderer.render(scene, camera); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
main().catch((error) => {
  document.documentElement.dataset.g43b5r2 = 'fail';
  status.textContent = `G4.3B.5R.2 FAIL · ${error?.message || error}`; status.className = 'bad';
  reportNode.textContent = error?.stack || String(error);
  window.__G43B5R2_RESULT__ = { stage: SHIELD_DRIVEN_CONTACT_COUPLING_STAGE, pass: false, error: error?.stack || String(error) };
});

window.__G43B5R2_LAB__ = {
  startAttack, setMode, combat, attackRuntime, guardMachine, couplingRuntime, trackingRuntime, buckler,
  get latestContact() { return latestContact; },
  get latestCouplingReport() { return latestCouplingReport; },
  get latestCombatResult() { return latestCombatResult; },
};
