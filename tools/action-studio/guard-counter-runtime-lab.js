import { createDefaultCharacter } from '../../src/character/default-character.js';
import { createDebugSword, mountDebugSword } from '../../src/character/debug-sword.js';
import { DEFAULT_KAYKIT_SWORD_MOUNT } from '../../src/character/default-character-mount.js';
import { loadKayKitAnimationLibrary } from '../../src/animation/kaykit-animation-library.js';
import { loadSkyrimConvertedAnimationLibrary } from '../../src/animation/skyrim-converted-animation-library.js';
import { composeSkyrimWeaponMountCalibration } from '../../src/animation/skyrim-weapon-bind-calibration.js';
import {
  GUARD_EVENTS,
  GUARD_STATES,
  createGuardStateMachine,
} from '../../src/combat/guard-state-machine.js';
import { createGuardPresentationRuntime } from '../../src/combat/guard-presentation-runtime.js';
import {
  GUARD_COUNTER_PROFILE_IDS,
  GUARD_WEAPON_MOUNT_PROFILE_IDS,
} from '../../src/combat/guard-counter-presentation.js';
import { createGuardWeaponMountRuntime } from '../../src/combat/guard-weapon-mount-runtime.js';

const THREE = window.THREE;
if (!THREE?.WebGLRenderer || !THREE?.GLTFLoader) throw new Error('G3.4 requires Three.js + GLTFLoader');

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1018);
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
scene.add(new THREE.HemisphereLight(0xffffff, 0x27344a, 1.25));
const key = new THREE.DirectionalLight(0xffffff, 0.95);
key.position.set(3, 5, 4);
scene.add(key);
scene.add(new THREE.GridHelper(8, 16, 0x34435d, 0x202a3b));

const character = createDefaultCharacter(THREE);
scene.add(character.object3d);
const machine = createGuardStateMachine();
let runtime = null;
let sword = null;
let mountRuntime = null;
let activeVariant = 'normal';
let activeElapsedMs = 375;
let counterDurationMs = 750;
const mountHistory = [];

const status = document.getElementById('status');
const reportNode = document.getElementById('report');
const hudState = document.getElementById('hudState');
const hudDetail = document.getElementById('hudDetail');
const timeline = document.getElementById('timeline');
const timeLabel = document.getElementById('timeLabel');

function setView(view) {
  if (view === 'front') camera.position.set(0, 1.42, 5.3);
  else if (view === 'side') camera.position.set(5.2, 1.45, 0);
  else if (view === 'back') camera.position.set(0, 1.42, -5.3);
  else camera.position.set(4.0, 1.58, 4.25);
  camera.lookAt(0, 1.0, 0);
  camera.updateMatrixWorld(true);
}

function resize() {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function applyMountProfile(profileId, snapshot) {
  const result = mountRuntime?.apply(profileId);
  if (result?.applied) {
    mountHistory.push({ profileId, state:snapshot?.state || null, sequence:snapshot?.sequence ?? null });
    sword?.update();
  }
}

function resetToHold() {
  machine.send(GUARD_EVENTS.RESET, { verification: 'g34-reset' });
  runtime.sync(camera);
  machine.send(GUARD_EVENTS.GUARD_PRESS, { verification: 'g34-guard-press' });
  runtime.sync(camera);
  const enter = runtime.update(180, camera);
  if (enter.snapshot.state !== GUARD_STATES.HOLD) {
    throw new Error(`G3.4 failed to auto-complete Guard Enter: ${enter.snapshot.state}`);
  }
  return enter;
}

function beginCounter(variant = 'normal') {
  resetToHold();
  const perfect = variant === 'perfect';
  const parry = machine.send(GUARD_EVENTS.PARRY_CONFIRMED, {
    verification: `g34-${variant}-parry`,
    perfect,
  });
  if (!parry.accepted) throw new Error(`G3.4 ${variant} PARRY_CONFIRMED rejected`);
  runtime.sync(camera);
  const reaction = runtime.update(perfect ? 120 : 100, camera);
  if (!reaction.report.counterWindowOpen || reaction.snapshot.state !== GUARD_STATES.PARRY) {
    throw new Error(`G3.4 ${variant} did not expose a presentation-only Counter window`);
  }
  const confirmed = machine.send(GUARD_EVENTS.COUNTER_CONFIRMED, {
    verification: `g34-${variant}-counter`,
    authorityTick: perfect ? 3402 : 3401,
  });
  if (!confirmed.accepted || confirmed.snapshot.state !== GUARD_STATES.COUNTER) {
    throw new Error(`G3.4 ${variant} authoritative Counter rejected`);
  }
  const synced = runtime.sync(camera);
  return { perfect, reaction, confirmed, synced };
}

function displayCounter(variant, elapsedMs) {
  beginCounter(variant);
  const clamped = Math.max(0, Math.min(Number(elapsedMs) || 0, counterDurationMs));
  const result = runtime.update(clamped, camera);
  activeVariant = variant;
  activeElapsedMs = clamped;
  timeline.max = String(Math.ceil(counterDurationMs));
  timeline.value = String(Math.min(Number(timeline.max), clamped));
  timeLabel.textContent = `${Math.round(clamped)} ms`;
  hudState.textContent = `${variant.toUpperCase()} · ${result.snapshot.state}`;
  hudDetail.textContent = `${result.report.clipId || '—'} · source ${result.report.sourceTimeSeconds.toFixed(3)}s · mount ${result.report.weaponMountProfileId || '—'}`;
  character.object3d.updateMatrixWorld(true);
  sword?.update();
  return result;
}

function verifyCounterScenario(variant) {
  const historyStart = mountHistory.length;
  const opened = resetToHold();
  const perfect = variant === 'perfect';
  machine.send(GUARD_EVENTS.PARRY_CONFIRMED, { perfect, verification:`g34-${variant}-window` });
  runtime.sync(camera);
  const window = runtime.update(perfect ? 120 : 100, camera);
  const noAutoCounter = window.snapshot.state === GUARD_STATES.PARRY
    && window.report.counterWindowOpen
    && window.snapshot.lastOutcome === 'parry';

  const confirmed = machine.send(GUARD_EVENTS.COUNTER_CONFIRMED, {
    authorityTick: perfect ? 4402 : 4401,
    verification:`g34-${variant}-confirmed`,
  });
  const counterStart = runtime.sync(camera);
  const beforeEnd = runtime.update(Math.max(0, counterDurationMs - 1), camera);
  const ended = runtime.update(1, camera);
  const completion = ended.snapshot.lastTransition;
  const history = mountHistory.slice(historyStart);
  const sawKayKitMount = history.some((entry) => entry.profileId === GUARD_WEAPON_MOUNT_PROFILE_IDS.KAYKIT_DEFAULT);
  const sawSkyrimRecoverMount = history.some((entry) => (
    entry.profileId === GUARD_WEAPON_MOUNT_PROFILE_IDS.SKYRIM_GUARD
    && entry.state === GUARD_STATES.RECOVER
  ));
  return {
    variant,
    startState:opened.snapshot.state,
    counterWindowOpen:window.report.counterWindowOpen,
    noAutoCounter,
    confirmAuthority:confirmed.snapshot.lastTransition?.authority || null,
    counterClip:counterStart.report.clipId,
    counterProfileId:counterStart.report.counterProfileId,
    counterMount:counterStart.report.weaponMountProfileId,
    counterCorrectionWeight:counterStart.report.correctionWeight,
    beforeEndState:beforeEnd.snapshot.state,
    completionEvent:completion?.event || null,
    completionAuthority:completion?.authority || null,
    completionProfileId:completion?.payload?.counterProfileId || null,
    completionSourceTimeSeconds:completion?.payload?.sourceTimeSeconds || 0,
    afterCounterState:ended.snapshot.state,
    afterCounterMount:ended.report.weaponMountProfileId,
    sawKayKitMount,
    sawSkyrimRecoverMount,
    pass:noAutoCounter
      && confirmed.snapshot.lastTransition?.authority === 'authoritative-combat'
      && counterStart.report.clipId === 'Melee_Block_Attack'
      && counterStart.report.counterProfileId === GUARD_COUNTER_PROFILE_IDS.LONGSWORD
      && counterStart.report.weaponMountProfileId === GUARD_WEAPON_MOUNT_PROFILE_IDS.KAYKIT_DEFAULT
      && counterStart.report.correctionWeight === 0
      && beforeEnd.snapshot.state === GUARD_STATES.COUNTER
      && completion?.event === GUARD_EVENTS.COUNTER_COMPLETE
      && completion?.authority === 'presentation'
      && completion?.payload?.counterProfileId === GUARD_COUNTER_PROFILE_IDS.LONGSWORD
      && ended.snapshot.state === GUARD_STATES.RECOVER
      && ended.report.weaponMountProfileId === GUARD_WEAPON_MOUNT_PROFILE_IDS.SKYRIM_GUARD
      && sawKayKitMount
      && sawSkyrimRecoverMount,
  };
}

function runVerification(kaykitLibrary, skyrimLibrary) {
  const counterClip = kaykitLibrary.clips.get('Melee_Block_Attack');
  counterDurationMs = Math.max(1, Number(counterClip?.duration) || 0) * 1000;
  const diagnostics = character.animation.getPreparedClipDiagnostics('Melee_Block_Attack', true);
  const normal = verifyCounterScenario('normal');
  const perfect = verifyCounterScenario('perfect');
  const gates = {
    skyrimGuardFamilyLoaded:skyrimLibrary.clips.size === 4,
    kaykitCounterPresent:Boolean(counterClip),
    counterDurationPositive:counterDurationMs > 1,
    inPlaceRootPositionRemoved:diagnostics.preparedRootPositionTracks === 0,
    normalCounterRuntime:normal.pass,
    perfectCounterRuntime:perfect.pass,
  };
  const failures = Object.entries(gates).filter(([, pass]) => !pass).map(([name]) => name);
  const report = {
    stage:'G3.4',
    pass:failures.length === 0,
    counterClip:{
      name:counterClip?.name || null,
      durationSeconds:Number(counterClip?.duration || 0),
      diagnostics,
    },
    scenarios:{ normal, perfect },
    mountHistory:[...mountHistory],
    gates,
    failures,
  };
  document.documentElement.dataset.g34 = report.pass ? 'pass' : 'fail';
  document.documentElement.dataset.g34Normal = normal.pass ? 'pass' : 'fail';
  document.documentElement.dataset.g34Perfect = perfect.pass ? 'pass' : 'fail';
  document.documentElement.dataset.g34CounterClip = counterClip ? 'pass' : 'fail';
  reportNode.textContent = JSON.stringify(report, null, 2);
  window.__G34_RESULT__ = report;
  status.textContent = `G3.4 ${report.pass ? 'PASS' : 'FAIL'} · authoritative Counter + mount handoff`;
  status.className = report.pass ? 'good' : 'bad';
  return report;
}

async function main() {
  status.textContent = 'Loading Skyrim Guard + KayKit melee…';
  const loader = new THREE.GLTFLoader();
  const [skyrimLibrary, kaykitLibrary] = await Promise.all([
    loadSkyrimConvertedAnimationLibrary(loader, { THREE, rig:character.rig, fps:30 }),
    loadKayKitAnimationLibrary(loader, { packIds:['melee'] }),
  ]);
  character.registerAnimations(skyrimLibrary);
  character.registerAnimations(kaykitLibrary);

  const idle = skyrimLibrary.clips.get('SKYRIM_GUARD/shd_blockidle');
  const bind = idle?.userData?.weaponBindCalibration;
  if (!bind?.correctionQuaternion) throw new Error('G3.4 requires accepted G2.4.5 Skyrim weapon bind calibration');
  const skyrimMount = composeSkyrimWeaponMountCalibration(THREE, DEFAULT_KAYKIT_SWORD_MOUNT, bind);

  sword = createDebugSword(THREE);
  mountDebugSword(character, sword, skyrimMount);
  mountRuntime = createGuardWeaponMountRuntime({
    weapon:sword,
    profiles:{
      [GUARD_WEAPON_MOUNT_PROFILE_IDS.SKYRIM_GUARD]:skyrimMount,
      [GUARD_WEAPON_MOUNT_PROFILE_IDS.KAYKIT_DEFAULT]:DEFAULT_KAYKIT_SWORD_MOUNT,
    },
  });
  runtime = createGuardPresentationRuntime(THREE, {
    machine,
    character,
    applyWeaponMountProfile:applyMountProfile,
  });

  runVerification(kaykitLibrary, skyrimLibrary);
  const params = new URLSearchParams(location.search);
  const requested = params.get('variant') === 'perfect' ? 'perfect' : 'normal';
  const requestedElapsed = Number(params.get('elapsed'));
  displayCounter(requested, Number.isFinite(requestedElapsed) ? requestedElapsed : counterDurationMs * 0.5);
}

document.querySelectorAll('[data-variant]').forEach((button) => button.addEventListener('click', () => {
  const variant = button.dataset.variant === 'perfect' ? 'perfect' : 'normal';
  displayCounter(variant, counterDurationMs * 0.5);
}));
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
timeline.addEventListener('input', () => displayCounter(activeVariant, Number(timeline.value)));

setView(new URLSearchParams(location.search).get('view') || 'three');
resize();
addEventListener('resize', resize);
(function frame(){ if(sword)sword.update(); renderer.render(scene,camera); requestAnimationFrame(frame); })();

main().catch((error) => {
  document.documentElement.dataset.g34 = 'fail';
  status.textContent = `G3.4 FAIL · ${error?.message || error}`;
  status.className = 'bad';
  reportNode.textContent = error?.stack || String(error);
  window.__G34_RESULT__ = { stage:'G3.4', pass:false, error:error?.stack || String(error) };
});

window.__G34_LAB__ = { displayCounter, runVerification };
