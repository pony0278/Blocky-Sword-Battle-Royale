import { createDefaultCharacter } from '../../src/character/default-character.js';
import { createDebugSword, mountDebugSword } from '../../src/character/debug-sword.js';
import { DEFAULT_KAYKIT_SWORD_MOUNT } from '../../src/character/default-character-mount.js';
import { loadSkyrimConvertedAnimationLibrary } from '../../src/animation/skyrim-converted-animation-library.js';
import { composeSkyrimWeaponMountCalibration } from '../../src/animation/skyrim-weapon-bind-calibration.js';
import {
  OFFHAND_BUCKLER_STAGE,
  OFFHAND_SOCKET_ID,
  createProceduralBuckler,
  mountOffhandBuckler,
} from '../../src/character/offhand-buckler.js';
import {
  GUARD_EVENTS,
  GUARD_STATES,
  createGuardStateMachine,
} from '../../src/combat/guard-state-machine.js';
import { createGuardPresentationRuntime } from '../../src/combat/guard-presentation-runtime.js';

const THREE = window.THREE;
if (!THREE?.WebGLRenderer || !THREE?.GLTFLoader) throw new Error('G4.2.2 requires Three.js + GLTFLoader');

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090e16);
scene.fog = new THREE.Fog(0x090e16, 7, 14);
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
scene.add(new THREE.HemisphereLight(0xddeaff, 0x202738, 1.25));
const key = new THREE.DirectionalLight(0xffffff, 1.15);
key.position.set(4, 7, 4);
key.castShadow = true;
scene.add(key);
const rimLight = new THREE.DirectionalLight(0x7fe2cf, 0.45);
rimLight.position.set(-4, 3, -3);
scene.add(rimLight);
scene.add(new THREE.GridHelper(10, 20, 0x33445f, 0x202a3b));

const defender = createDefaultCharacter(THREE);
scene.add(defender.object3d);

const guardMachine = createGuardStateMachine();
const guardRuntime = createGuardPresentationRuntime(THREE, { machine: guardMachine, character: defender });
const buckler = createProceduralBuckler(THREE);
mountOffhandBuckler(defender, buckler);
let defenderSword = null;
let ready = false;
let lastTimestamp = performance.now();
let guardReport = null;

const hudGuard = document.getElementById('hudGuard');
const hudBuckler = document.getElementById('hudBuckler');
const hudSurface = document.getElementById('hudSurface');
const status = document.getElementById('status');
const reportNode = document.getElementById('report');
const showSurface = document.getElementById('showSurface');

function resize() {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function setView(view) {
  if (view === 'front') camera.position.set(0, 1.75, 4.3);
  else if (view === 'side') camera.position.set(4.5, 1.7, 0.05);
  else if (view === 'back') camera.position.set(0, 1.75, -4.3);
  else camera.position.set(3.5, 2.2, 4.15);
  camera.lookAt(0, 1.0, 0);
  camera.updateMatrixWorld(true);
}

function enterProductionGuard() {
  guardMachine.send(GUARD_EVENTS.RESET, { stage: OFFHAND_BUCKLER_STAGE, reason: 'buckler-lab-init' });
  guardRuntime.sync(camera);
  guardMachine.send(GUARD_EVENTS.GUARD_PRESS, { stage: OFFHAND_BUCKLER_STAGE });
  guardRuntime.sync(camera);
  guardReport = guardRuntime.update(180, camera);
  if (guardReport.snapshot.state !== GUARD_STATES.HOLD) {
    throw new Error(`G4.2.2 expected Guard Hold, received ${guardReport.snapshot.state}`);
  }
}

function verifyLab(skyrim) {
  const parrySurface = buckler.getWorldParrySurface();
  const gates = {
    stage: buckler.stage === OFFHAND_BUCKLER_STAGE,
    handLeftSocketExists: Boolean(defender.sockets?.[OFFHAND_SOCKET_ID]),
    mountedToHandLeft: buckler.object3d.userData.attachedSocket === OFFHAND_SOCKET_ID
      && buckler.object3d.parent === defender.sockets?.[OFFHAND_SOCKET_ID],
    productionGuardHold: defender.hasAnimation('SKYRIM_GUARD/shd_blockidle'),
    productionParrySource: defender.hasAnimation('SKYRIM_GUARD/shd_blockbashpower'),
    swordMounted: Boolean(defenderSword?.object3d),
    surfaceShape: parrySurface.shape === 'oriented-disc',
    surfaceRadius: Math.abs(parrySurface.radius - 0.26) < 1e-6,
    surfaceNormal: Number.isFinite(parrySurface.normal.x)
      && Number.isFinite(parrySurface.normal.y)
      && Number.isFinite(parrySurface.normal.z),
    skyrimLibrary: skyrim.clips.size >= 4,
  };
  const failures = Object.entries(gates).filter(([, pass]) => !pass).map(([name]) => name);
  const report = {
    stage: OFFHAND_BUCKLER_STAGE,
    pass: failures.length === 0,
    equipment: {
      id: buckler.id,
      socketId: OFFHAND_SOCKET_ID,
      radius: buckler.definition.radius,
      thickness: buckler.definition.thickness,
      parrySurface: buckler.definition.parrySurface,
    },
    guardState: guardReport?.snapshot?.state || null,
    gates,
    failures,
    next: 'G4.3A consumes buckler.getWorldParrySurface() for swept sword contact',
  };
  document.documentElement.dataset.g422 = report.pass ? 'pass' : 'fail';
  status.textContent = report.pass
    ? 'G4.2.2 PASS · HAND_L Buckler mounted in production Guard'
    : `G4.2.2 FAIL · ${failures.join(', ')}`;
  status.className = report.pass ? 'good' : 'bad';
  reportNode.textContent = JSON.stringify(report, null, 2);
  window.__G422_RESULT__ = report;
  return report;
}

async function main() {
  status.textContent = 'Loading production Skyrim Guard…';
  const skyrim = await loadSkyrimConvertedAnimationLibrary(
    new THREE.GLTFLoader(),
    { THREE, rig: defender.rig, fps: 30 },
  );
  defender.registerAnimations(skyrim);

  const idle = skyrim.clips.get('SKYRIM_GUARD/shd_blockidle');
  const bind = idle?.userData?.weaponBindCalibration;
  if (!bind?.correctionQuaternion) throw new Error('G4.2.2 requires accepted Skyrim Guard weapon bind calibration');
  defenderSword = createDebugSword(THREE);
  mountDebugSword(
    defender,
    defenderSword,
    composeSkyrimWeaponMountCalibration(THREE, DEFAULT_KAYKIT_SWORD_MOUNT, bind),
  );

  enterProductionGuard();
  ready = true;
  verifyLab(skyrim);
}

showSurface.addEventListener('change', () => buckler.setParrySurfaceVisible(showSurface.checked));
document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => setView(button.dataset.view));
});

setView('three');
resize();
addEventListener('resize', resize);

function frame(timestamp) {
  const deltaMs = Math.min(50, Math.max(0, timestamp - lastTimestamp));
  lastTimestamp = timestamp;
  if (ready) {
    guardReport = guardRuntime.update(deltaMs, camera);
    defender.update(0, camera);
    defenderSword?.update();
    const surface = buckler.getWorldParrySurface();
    hudGuard.textContent = `Guard: ${guardReport.snapshot.state} · ${guardReport.report.clipId || '—'}`;
    hudBuckler.textContent = `Buckler: ${buckler.id} · ${OFFHAND_SOCKET_ID} · r=${buckler.definition.radius.toFixed(2)}m`;
    hudSurface.textContent = `Parry surface: r=${surface.radius.toFixed(2)}m · N(${surface.normal.x.toFixed(2)}, ${surface.normal.y.toFixed(2)}, ${surface.normal.z.toFixed(2)})`;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

main().catch((error) => {
  document.documentElement.dataset.g422 = 'fail';
  status.textContent = `G4.2.2 FAIL · ${error?.message || error}`;
  status.className = 'bad';
  reportNode.textContent = error?.stack || String(error);
  window.__G422_RESULT__ = { stage: OFFHAND_BUCKLER_STAGE, pass: false, error: error?.stack || String(error) };
});

window.__G422_LAB__ = { defender, guardMachine, guardRuntime, buckler };
