import { createDefaultCharacter } from '../../src/character/default-character.js';
import { createDebugSword, mountDebugSword } from '../../src/character/debug-sword.js';
import { DEFAULT_KAYKIT_SWORD_MOUNT } from '../../src/character/default-character-mount.js';
import { loadUal1AnimationLibrary } from '../../src/animation/ual1-animation-library.js';
import { loadUal2AnimationLibrary } from '../../src/animation/ual2-animation-library.js';
import { loadSkyrimConvertedAnimationLibrary } from '../../src/animation/skyrim-converted-animation-library.js';
import { composeSkyrimWeaponMountCalibration } from '../../src/animation/skyrim-weapon-bind-calibration.js';
import {
  GUARD_EVENTS,
  GUARD_STATES,
  createGuardStateMachine,
} from '../../src/combat/guard-state-machine.js';
import { createGuardPresentationRuntime } from '../../src/combat/guard-presentation-runtime.js';
import {
  LONGSWORD_ATTACK_RUNTIME_STAGE,
  LONGSWORD_ATTACK_PHASES,
  LONGSWORD_DIRECTIONAL_ATTACK_DEFINITIONS,
  createLongswordDirectionalAttackRuntime,
} from '../../src/combat/longsword-directional-attack-runtime.js';

const THREE = window.THREE;
if (!THREE?.WebGLRenderer || !THREE?.GLTFLoader) throw new Error('G4.2 requires Three.js + GLTFLoader');

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090e16);
scene.fog = new THREE.Fog(0x090e16, 8, 18);
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
scene.add(new THREE.HemisphereLight(0xddeaff, 0x202738, 1.25));
const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(4, 7, 3);
key.castShadow = true;
scene.add(key);
const rim = new THREE.DirectionalLight(0x7fe2cf, 0.55);
rim.position.set(-4, 3, -4);
scene.add(rim);
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

const guardMachine = createGuardStateMachine();
const guardRuntime = createGuardPresentationRuntime(THREE, { machine: guardMachine, character: defender });
const attackRuntime = createLongswordDirectionalAttackRuntime();

const hudAttack = document.getElementById('hudAttack');
const hudGuard = document.getElementById('hudGuard');
const hudContact = document.getElementById('hudContact');
const status = document.getElementById('status');
const reportNode = document.getElementById('report');
const autoRepeat = document.getElementById('autoRepeat');

let ready = false;
let selectedDirection = 'top';
let responseMode = 'hold';
let contactTriggered = false;
let contactPulse = 0;
let repeatCooldownMs = 0;
let lastTimestamp = performance.now();
let attackerIdleDuration = 1;
let lastGuardReport = null;

const contactMarker = new THREE.Mesh(
  new THREE.SphereGeometry(0.055, 12, 8),
  new THREE.MeshBasicMaterial({ color: 0xffdc78, transparent: true, opacity: 0 }),
);
contactMarker.visible = false;
scene.add(contactMarker);
const markerA = new THREE.Vector3();
const markerB = new THREE.Vector3();

function resize() {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function setView(view) {
  if (view === 'side') camera.position.set(5.7, 1.7, 0.2);
  else if (view === 'attacker') camera.position.set(0, 2.05, -5.5);
  else if (view === 'defender') camera.position.set(0, 2.05, 5.5);
  else camera.position.set(4.7, 2.4, 4.9);
  camera.lookAt(0, 1.05, 0);
  camera.updateMatrixWorld(true);
}

function resetDefenderToHold() {
  guardMachine.send(GUARD_EVENTS.RESET, { stage: 'G4.2', reason: 'new-scripted-attack' });
  guardRuntime.sync(camera);
  guardMachine.send(GUARD_EVENTS.GUARD_PRESS, { stage: 'G4.2' });
  guardRuntime.sync(camera);
  lastGuardReport = guardRuntime.update(180, camera);
  if (lastGuardReport.snapshot.state !== GUARD_STATES.HOLD) {
    throw new Error(`G4.2 failed to enter Guard Hold: ${lastGuardReport.snapshot.state}`);
  }
}

function triggerContactReaction() {
  if (contactTriggered) return;
  contactTriggered = true;
  contactPulse = 0.22;
  attackerSword.trailTip.getWorldPosition(markerA);
  defenderSword?.trailTip?.getWorldPosition(markerB);
  if (defenderSword) contactMarker.position.copy(markerA).lerp(markerB, 0.5);
  else contactMarker.position.copy(markerA);
  contactMarker.visible = true;
  contactMarker.material.opacity = 1;

  if (responseMode === 'block') {
    guardMachine.send(GUARD_EVENTS.BLOCK_CONFIRMED, { stage: 'G4.2', scriptedContact: true });
  } else if (responseMode === 'parry' || responseMode === 'perfect') {
    guardMachine.send(GUARD_EVENTS.PARRY_CONFIRMED, {
      stage: 'G4.2',
      scriptedContact: true,
      perfect: responseMode === 'perfect',
    });
  }
  guardRuntime.sync(camera);
  hudContact.textContent = `Contact: ${selectedDirection.toUpperCase()} @ ${LONGSWORD_DIRECTIONAL_ATTACK_DEFINITIONS[selectedDirection].runtime.contactSeconds.toFixed(2)}s · ${responseMode}`;
}

function startAttack(direction = selectedDirection) {
  if (!ready || attackRuntime.active) return false;
  selectedDirection = direction;
  resetDefenderToHold();
  contactTriggered = false;
  contactPulse = 0;
  contactMarker.visible = false;
  const result = attackRuntime.start(direction);
  if (!result.accepted) return false;
  repeatCooldownMs = 0;
  document.querySelectorAll('[data-attack]').forEach((button) => button.classList.toggle('active', button.dataset.attack === direction));
  return true;
}

function updateContactMarker(deltaSeconds) {
  if (contactPulse <= 0) {
    contactMarker.visible = false;
    return;
  }
  contactPulse = Math.max(0, contactPulse - deltaSeconds);
  const t = contactPulse / 0.22;
  contactMarker.scale.setScalar(1 + (1 - t) * 2.2);
  contactMarker.material.opacity = t * t;
}

function sampleAttacker(snapshot, nowSeconds) {
  if (snapshot.action) {
    const profile = snapshot.action.runtime;
    const sourceTime = Math.min(profile.durationSeconds, snapshot.elapsedSeconds);
    attacker.sampleAnimation(profile.clipId, sourceTime, {
      loop: false,
      inPlace: true,
      rootRotationPolicy: 'lock',
    });
    if (!contactTriggered && snapshot.contactReached) triggerContactReaction();
    hudAttack.textContent = `Attack: ${profile.direction.toUpperCase()} · ${snapshot.phase} · ${sourceTime.toFixed(3)}s / ${profile.durationSeconds.toFixed(3)}s`;
  } else {
    const sourceTime = nowSeconds % Math.max(0.001, attackerIdleDuration);
    attacker.sampleAnimation('UAL1/Sword_Idle', sourceTime, {
      loop: true,
      inPlace: true,
      rootRotationPolicy: 'lock',
    });
    hudAttack.textContent = `Attack: IDLE · selected ${selectedDirection.toUpperCase()}`;
  }
  attacker.update(0, camera);
}

function verifyLab(ual1, ual2, skyrim) {
  const directional = Object.fromEntries(Object.entries(LONGSWORD_DIRECTIONAL_ATTACK_DEFINITIONS).map(([direction, action]) => [direction, {
    direction: action.direction,
    clipId: action.clipId,
    source: action.animationBinding.source,
    durationSeconds: action.runtime.durationSeconds,
    contactSeconds: action.runtime.contactSeconds,
    activeWindowFrames: action.windows.active[0],
  }]));
  const gates = {
    g41Stage: Object.values(LONGSWORD_DIRECTIONAL_ATTACK_DEFINITIONS).every((action) => action.runtime.stage === LONGSWORD_ATTACK_RUNTIME_STAGE),
    directions: JSON.stringify(Object.keys(directional).sort()) === JSON.stringify(['left', 'right', 'top']),
    attackerTop: attacker.hasAnimation('UAL1/Sword_Attack'),
    attackerIdle: attacker.hasAnimation('UAL1/Sword_Idle'),
    attackerRight: attacker.hasAnimation('UAL2/Sword_Regular_A'),
    attackerLeft: attacker.hasAnimation('UAL2/Sword_Regular_B'),
    defenderHold: defender.hasAnimation('SKYRIM_GUARD/shd_blockidle'),
    defenderBlock: defender.hasAnimation('SKYRIM_GUARD/shd_blockhit'),
    defenderPowerParry: defender.hasAnimation('SKYRIM_GUARD/shd_blockbashpower'),
    sourceLibraries: ual1.clips.size === 2 && ual2.clips.size === 8 && skyrim.clips.size >= 4,
  };
  const failures = Object.entries(gates).filter(([, pass]) => !pass).map(([name]) => name);
  const report = {
    stage: 'G4.1 + G4.2',
    pass: failures.length === 0,
    authority: 'presentation-only scripted contact; G4.3 owns spatial combat resolution',
    spacingMeters: 2.3,
    directional,
    gates,
    failures,
  };
  document.documentElement.dataset.g41 = gates.g41Stage && gates.directions ? 'pass' : 'fail';
  document.documentElement.dataset.g42 = report.pass ? 'pass' : 'fail';
  reportNode.textContent = JSON.stringify(report, null, 2);
  status.textContent = report.pass
    ? 'G4.1 + G4.2 PASS · three directional attacks and production Guard family loaded'
    : `G4.1 + G4.2 FAIL · ${failures.join(', ')}`;
  status.className = report.pass ? 'good' : 'bad';
  window.__G42_RESULT__ = report;
  return report;
}

async function main() {
  status.textContent = 'Loading UAL1 / UAL2 attacker + Skyrim Guard defender…';
  const attackerLoader = new THREE.GLTFLoader();
  const defenderLoader = new THREE.GLTFLoader();
  const [ual1, ual2, skyrim] = await Promise.all([
    loadUal1AnimationLibrary(attackerLoader, { THREE, rig: attacker.rig, fps: 30 }),
    loadUal2AnimationLibrary(new THREE.GLTFLoader(), { THREE, rig: attacker.rig, fps: 30 }),
    loadSkyrimConvertedAnimationLibrary(defenderLoader, { THREE, rig: defender.rig, fps: 30 }),
  ]);
  attacker.registerAnimations(ual1);
  attacker.registerAnimations(ual2);
  defender.registerAnimations(skyrim);

  attackerIdleDuration = attacker.getAnimationDuration('UAL1/Sword_Idle') || 1;
  const idle = skyrim.clips.get('SKYRIM_GUARD/shd_blockidle');
  const bind = idle?.userData?.weaponBindCalibration;
  if (!bind?.correctionQuaternion) throw new Error('G4.2 requires accepted Skyrim Guard weapon bind calibration');
  defenderSword = createDebugSword(THREE);
  mountDebugSword(defender, defenderSword, composeSkyrimWeaponMountCalibration(THREE, DEFAULT_KAYKIT_SWORD_MOUNT, bind));

  resetDefenderToHold();
  verifyLab(ual1, ual2, skyrim);
  ready = true;
  startAttack('top');
}

document.querySelectorAll('[data-attack]').forEach((button) => button.addEventListener('click', () => startAttack(button.dataset.attack)));
document.querySelectorAll('[data-response]').forEach((button) => button.addEventListener('click', () => {
  responseMode = button.dataset.response;
  document.querySelectorAll('[data-response]').forEach((entry) => entry.classList.toggle('active', entry.dataset.response === responseMode));
}));
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));

setView('three');
resize();
addEventListener('resize', resize);

function frame(timestamp) {
  const deltaMs = Math.min(50, Math.max(0, timestamp - lastTimestamp));
  lastTimestamp = timestamp;
  const deltaSeconds = deltaMs / 1000;
  if (ready) {
    const attackSnapshot = attackRuntime.update(deltaMs);
    sampleAttacker(attackSnapshot, timestamp / 1000);
    lastGuardReport = guardRuntime.update(deltaMs, camera);
    defender.update(0, camera);
    attackerSword.update();
    defenderSword?.update();
    updateContactMarker(deltaSeconds);
    hudGuard.textContent = `Defender: ${lastGuardReport.snapshot.state} · ${lastGuardReport.report.clipId || '—'} · response ${responseMode}`;

    if (!attackRuntime.active && !attackSnapshot.action && autoRepeat.checked) {
      repeatCooldownMs += deltaMs;
      if (repeatCooldownMs >= 700) startAttack(selectedDirection);
    }
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

main().catch((error) => {
  document.documentElement.dataset.g41 = 'fail';
  document.documentElement.dataset.g42 = 'fail';
  status.textContent = `G4.1 + G4.2 FAIL · ${error?.message || error}`;
  status.className = 'bad';
  reportNode.textContent = error?.stack || String(error);
  window.__G42_RESULT__ = { stage: 'G4.1 + G4.2', pass: false, error: error?.stack || String(error) };
});

window.__G42_LAB__ = { startAttack, attackRuntime, guardMachine };
