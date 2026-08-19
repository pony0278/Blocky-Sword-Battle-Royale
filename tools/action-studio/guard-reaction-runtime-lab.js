import { createDefaultCharacter } from '../../src/character/default-character.js';
import { createDebugSword, mountDebugSword } from '../../src/character/debug-sword.js';
import { DEFAULT_KAYKIT_SWORD_MOUNT } from '../../src/character/default-character-mount.js';
import {
  SKYRIM_GUARD_CONVERTED_FILES,
  loadSkyrimConvertedAnimationLibrary,
} from '../../src/animation/skyrim-converted-animation-library.js';
import { composeSkyrimWeaponMountCalibration } from '../../src/animation/skyrim-weapon-bind-calibration.js';
import {
  GUARD_EVENTS,
  GUARD_STATES,
  createGuardStateMachine,
} from '../../src/combat/guard-state-machine.js';
import { createGuardPresentationRuntime } from '../../src/combat/guard-presentation-runtime.js';
import {
  GUARD_REACTION_VARIANTS,
  LONGSWORD_GUARD_REACTION_PROFILES,
} from '../../src/combat/guard-reaction-presentation.js';

const THREE = window.THREE;
if (!THREE?.WebGLRenderer || !THREE?.GLTFLoader) throw new Error('G3.3.2 requires Three.js + GLTFLoader');

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
const runtime = createGuardPresentationRuntime(THREE, { machine, character });
let sword = null;
let library = null;
let activeReaction = 'block';
let activeElapsedMs = 300;

const status = document.getElementById('status');
const reportNode = document.getElementById('report');
const hudState = document.getElementById('hudState');
const hudDetail = document.getElementById('hudDetail');
const timeline = document.getElementById('timeline');
const timeLabel = document.getElementById('timeLabel');

const REACTION_CONFIG = Object.freeze({
  block: Object.freeze({
    event: GUARD_EVENTS.BLOCK_CONFIRMED,
    payload: Object.freeze({ verification: 'g332-block' }),
    variant: GUARD_REACTION_VARIANTS.BLOCK_HIT,
  }),
  parry: Object.freeze({
    event: GUARD_EVENTS.PARRY_CONFIRMED,
    payload: Object.freeze({ verification: 'g332-parry' }),
    variant: GUARD_REACTION_VARIANTS.PARRY,
  }),
  perfect: Object.freeze({
    event: GUARD_EVENTS.PARRY_CONFIRMED,
    payload: Object.freeze({ verification: 'g332-perfect', perfect: true }),
    variant: GUARD_REACTION_VARIANTS.PERFECT_PARRY,
  }),
});

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

function resetToHold() {
  machine.send(GUARD_EVENTS.RESET, { verification: 'g332-reset' });
  runtime.sync(camera);
  machine.send(GUARD_EVENTS.GUARD_PRESS, { verification: 'g332-guard-press' });
  runtime.sync(camera);
  const enter = runtime.update(180, camera);
  if (enter.snapshot.state !== GUARD_STATES.HOLD) {
    throw new Error(`G3.3.2 failed to auto-complete Guard Enter: ${enter.snapshot.state}`);
  }
  return enter;
}

function beginReaction(kind) {
  const config = REACTION_CONFIG[kind];
  if (!config) throw new Error(`Unknown G3.3.2 reaction: ${kind}`);
  resetToHold();
  const result = machine.send(config.event, config.payload);
  if (!result.accepted) throw new Error(`G3.3.2 ${kind} event was rejected by the Guard FSM`);
  runtime.sync(camera);
  return config;
}

function reactionProfile(kind) {
  return LONGSWORD_GUARD_REACTION_PROFILES[REACTION_CONFIG[kind].variant];
}

function displayReaction(kind, elapsedMs) {
  const config = beginReaction(kind);
  const profile = LONGSWORD_GUARD_REACTION_PROFILES[config.variant];
  const clamped = Math.max(0, Math.min(Number(elapsedMs) || 0, profile.durationMs));
  const result = runtime.update(clamped, camera);
  activeReaction = kind;
  activeElapsedMs = clamped;
  timeline.max = String(Math.ceil(profile.durationMs));
  timeline.value = String(Math.min(Number(timeline.max), clamped));
  timeLabel.textContent = `${Math.round(clamped)} ms`;
  hudState.textContent = `${kind.toUpperCase()} · ${result.snapshot.state}`;
  hudDetail.textContent = `${result.report.clipId || '—'} · source ${result.report.sourceTimeSeconds.toFixed(3)}s · counter ${result.report.counterWindowOpen ? 'OPEN' : 'closed'}`;
  character.object3d.updateMatrixWorld(true);
  sword?.update();
  return result;
}

function clipDiagnostics(clipId) {
  const clip = library.clips.get(clipId);
  if (!clip) return { present:false, clipId };
  const arm = clip.userData?.armChainMetrics || {};
  const translation = clip.userData?.translationSafety || {};
  return {
    present:true,
    clipId,
    duration:Number((clip.duration || 0).toFixed(6)),
    translationScale:Number((clip.userData?.translationScale || 0).toFixed(8)),
    translationSafe:translation.safe === true,
    translationExcursionRatio:Number((translation.excursionRatio || 0).toFixed(8)),
    armMaxErrorDegrees:Number((arm.maxDirectionErrorDegrees || 0).toFixed(8)),
    helperCoverage:arm.helperCoverage || {},
    convertedSource:clip.userData?.convertedSource || null,
  };
}

function verifyScenario(kind) {
  const profile = reactionProfile(kind);
  const config = beginReaction(kind);
  const beforeMs = Math.max(0, profile.durationMs - 1);
  const before = runtime.update(beforeMs, camera);
  const beforeState = before.snapshot.state;
  const beforeClip = before.report.clipId;
  const counterWindowOpen = before.report.counterWindowOpen;
  const end = runtime.update(1, camera);
  const recoverState = end.snapshot.state;
  const completion = end.snapshot.lastTransition;
  const recoveryDurationMs = Number(end.report.recoveryDurationMs) || 140;
  const recoveryProfileId = end.report.recoveryProfileId || null;
  const recover = runtime.update(recoveryDurationMs, camera);
  return {
    kind,
    variant:config.variant,
    durationMs:profile.durationMs,
    sourceEndSeconds:profile.sourceWindow.endSeconds,
    beforeState,
    beforeClip,
    counterWindowOpen,
    recoverState,
    recoveryDurationMs,
    recoveryProfileId,
    completionEvent:completion?.event || null,
    completionAuthority:completion?.authority || null,
    completionVariant:completion?.payload?.reactionVariant || null,
    afterRecoverState:recover.snapshot.state,
    pass:beforeState === profile.state
      && beforeClip === profile.clipId
      && recoverState === GUARD_STATES.RECOVER
      && Boolean(recoveryProfileId)
      && completion?.event === GUARD_EVENTS.REACTION_COMPLETE
      && completion?.authority === 'presentation'
      && completion?.payload?.reactionVariant === profile.variant
      && recover.snapshot.state === GUARD_STATES.HOLD,
  };
}

function runVerification() {
  const expectedIds = [
    'SKYRIM_GUARD/shd_blockidle',
    'SKYRIM_GUARD/shd_blockhit',
    'SKYRIM_GUARD/shd_blockbash',
    'SKYRIM_GUARD/shd_blockbashpower',
  ];
  const clips = Object.fromEntries(expectedIds.map((clipId) => [clipId, clipDiagnostics(clipId)]));
  const scenarios = {
    block:verifyScenario('block'),
    parry:verifyScenario('parry'),
    perfect:verifyScenario('perfect'),
  };
  const reactionClips = expectedIds.slice(1).map((clipId) => clips[clipId]);
  const gates = {
    convertedFamilyCount:SKYRIM_GUARD_CONVERTED_FILES.length === 4 && library.clips.size === 4,
    allClipsPresent:expectedIds.every((clipId) => clips[clipId].present),
    productionTranslationSafe:reactionClips.every((entry) => entry.translationSafe),
    productionArmChainSafe:reactionClips.every((entry) => entry.armMaxErrorDegrees <= 0.1),
    productionScaleSafe:reactionClips.every((entry) => entry.translationScale > 0 && entry.translationScale < 0.1),
    blockRuntime:scenarios.block.pass,
    parryRuntime:scenarios.parry.pass,
    perfectRuntime:scenarios.perfect.pass,
    poseMatchedRecovery:[scenarios.block, scenarios.parry, scenarios.perfect].every((scenario) => Boolean(scenario.recoveryProfileId)),
    rejectedIntroAbsent:!library.clips.has('SKYRIM_GUARD/shd_blockbashintro'),
  };
  const failures = Object.entries(gates).filter(([, pass]) => !pass).map(([name]) => name);
  const report = {
    stage:'G3.4.1',
    pass:failures.length === 0,
    files:SKYRIM_GUARD_CONVERTED_FILES.map(({ id, file, clipId, role, visualDecision }) => ({ id, file, clipId, role, visualDecision:visualDecision || 'ADOPT' })),
    clips,
    scenarios,
    gates,
    failures,
  };
  document.documentElement.dataset.g332 = report.pass ? 'pass' : 'fail';
  document.documentElement.dataset.g332Count = String(library.clips.size);
  document.documentElement.dataset.g332Block = scenarios.block.pass ? 'pass' : 'fail';
  document.documentElement.dataset.g332Parry = scenarios.parry.pass ? 'pass' : 'fail';
  document.documentElement.dataset.g332Perfect = scenarios.perfect.pass ? 'pass' : 'fail';
  document.documentElement.dataset.g341Recovery = gates.poseMatchedRecovery ? 'pass' : 'fail';
  reportNode.textContent = JSON.stringify(report, null, 2);
  window.__G332_RESULT__ = report;
  status.textContent = `G3.4.1 ${report.pass ? 'PASS' : 'FAIL'} · full reactions + pose-matched recovery`;
  status.className = report.pass ? 'good' : 'bad';
  return report;
}

async function main() {
  status.textContent = 'Loading product Skyrim Guard Hold + reactions…';
  library = await loadSkyrimConvertedAnimationLibrary(new THREE.GLTFLoader(), {
    THREE,
    rig:character.rig,
    fps:30,
  });
  if (library.clips.size !== 4) throw new Error(`Expected 4 product Skyrim Guard clips, got ${library.clips.size}`);
  character.registerAnimations(library);
  const idle = library.clips.get('SKYRIM_GUARD/shd_blockidle');
  const bind = idle?.userData?.weaponBindCalibration;
  if (!bind?.correctionQuaternion) throw new Error('G3.3.2 requires accepted G2.4.5 weapon bind calibration');
  sword = createDebugSword(THREE);
  mountDebugSword(character, sword, composeSkyrimWeaponMountCalibration(THREE, DEFAULT_KAYKIT_SWORD_MOUNT, bind));

  runVerification();
  const params = new URLSearchParams(location.search);
  const requested = REACTION_CONFIG[params.get('reaction')] ? params.get('reaction') : 'block';
  const requestedElapsed = Number(params.get('elapsed'));
  const profile = reactionProfile(requested);
  displayReaction(requested, Number.isFinite(requestedElapsed) ? requestedElapsed : profile.durationMs * 0.5);
}

document.querySelectorAll('[data-reaction]').forEach((button) => button.addEventListener('click', () => {
  const kind = button.dataset.reaction;
  displayReaction(kind, reactionProfile(kind).durationMs * 0.5);
}));
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
timeline.addEventListener('input', () => displayReaction(activeReaction, Number(timeline.value)));

setView(new URLSearchParams(location.search).get('view') || 'three');
resize();
addEventListener('resize', resize);
(function frame(){ if(sword)sword.update(); renderer.render(scene,camera); requestAnimationFrame(frame); })();

main().catch((error) => {
  document.documentElement.dataset.g332 = 'fail';
  status.textContent = `G3.4.1 FAIL · ${error?.message || error}`;
  status.className = 'bad';
  reportNode.textContent = error?.stack || String(error);
  window.__G332_RESULT__ = { stage:'G3.4.1', pass:false, error:error?.stack || String(error) };
});

window.__G332_LAB__ = { displayReaction, runVerification };
