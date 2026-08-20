import { createDefaultCharacter } from '../../src/character/default-character.js';
import { createDebugSword, mountDebugSword } from '../../src/character/debug-sword.js';
import { DEFAULT_KAYKIT_SWORD_MOUNT } from '../../src/character/default-character-mount.js';
import { loadSkyrimConvertedAnimationLibrary } from '../../src/animation/skyrim-converted-animation-library.js';
import { composeSkyrimWeaponMountCalibration } from '../../src/animation/skyrim-weapon-bind-calibration.js';
import {
  POWER_BASH_READABILITY_CANDIDATE_IDS,
  POWER_BASH_READABILITY_CANDIDATES,
  POWER_BASH_READABILITY_SOURCE_CLIP_ID,
  POWER_BASH_READABILITY_STAGE,
  buildPowerBashReadabilityProbeReport,
  resolvePowerBashReadabilityCandidate,
  samplePowerBashReadabilityCandidate,
  samplePowerBashReadabilityCandidateProgress,
} from '../../src/animation/power-bash-readability-probe.js';

const THREE = window.THREE;
if (!THREE?.WebGLRenderer || !THREE?.GLTFLoader || !THREE?.Quaternion) {
  throw new Error(`${POWER_BASH_READABILITY_STAGE} requires Three.js + GLTFLoader`);
}

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x09101a);
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
scene.add(new THREE.HemisphereLight(0xffffff, 0x26344b, 1.35));
const key = new THREE.DirectionalLight(0xffffff, 1.0);
key.position.set(3, 6, 5);
scene.add(key);
scene.add(new THREE.GridHelper(12, 24, 0x34435d, 0x202a3b));

const status = document.getElementById('status');
const reportNode = document.getElementById('report');
const progressInput = document.getElementById('progress');
const progressLabel = document.getElementById('progressLabel');
const playButton = document.getElementById('play');
const resetButton = document.getElementById('reset');
const cards = new Map();

const slots = POWER_BASH_READABILITY_CANDIDATES.map((candidate, index) => ({
  candidate,
  character: createDefaultCharacter(THREE),
  sword: null,
  resolved: null,
  metrics: null,
  x: (index - 1) * 2.55,
}));
slots.forEach((slot) => {
  slot.character.object3d.position.x = slot.x;
  scene.add(slot.character.object3d);
});

let library = null;
let sourceClip = null;
let autoplay = true;
let staticProgress = 0.5;
let playbackStartedAt = performance.now();
const PAUSE_SECONDS = 0.55;

function setView(view) {
  if (view === 'front') camera.position.set(0, 1.55, 9.2);
  else camera.position.set(5.9, 2.25, 8.3);
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

function quaternionAngleDegrees(a, b) {
  const dot = Math.min(1, Math.max(-1, Math.abs(a.dot(b))));
  return THREE.MathUtils.radToDeg(2 * Math.acos(dot));
}

function boneWorldQuaternion(slot, id) {
  const bone = slot.character.rig?.bones?.[id];
  if (!bone?.getWorldQuaternion) throw new Error(`Missing ${POWER_BASH_READABILITY_STAGE} bone: ${id}`);
  slot.character.object3d.updateMatrixWorld(true);
  return bone.getWorldQuaternion(new THREE.Quaternion());
}

function boneWorldPosition(slot, id) {
  const bone = slot.character.rig?.bones?.[id];
  if (!bone?.getWorldPosition) throw new Error(`Missing ${POWER_BASH_READABILITY_STAGE} bone: ${id}`);
  slot.character.object3d.updateMatrixWorld(true);
  return bone.getWorldPosition(new THREE.Vector3());
}

function swordTipWorldPosition(slot) {
  slot.character.object3d.updateMatrixWorld(true);
  slot.sword.object3d.updateMatrixWorld(true);
  slot.sword.update();
  return slot.sword.getSweepSegment(new THREE.Vector3(), new THREE.Vector3()).end;
}

function sampleSourceTime(slot, sourceTimeSeconds) {
  slot.character.sampleAnimation(POWER_BASH_READABILITY_SOURCE_CLIP_ID, sourceTimeSeconds, {
    inPlace: true,
    loop: false,
    rootRotationPolicy: 'preserve',
  });
  slot.character.object3d.position.x = slot.x;
  slot.character.object3d.updateMatrixWorld(true);
  slot.sword.update();
}

function sampleSlotProgress(slot, progress) {
  const sourceTime = samplePowerBashReadabilityCandidateProgress(
    slot.resolved,
    progress,
    sourceClip.duration,
  );
  sampleSourceTime(slot, sourceTime);
  return sourceTime;
}

function sampleSlotElapsed(slot, elapsedSeconds) {
  const sourceTime = samplePowerBashReadabilityCandidate(
    slot.resolved,
    elapsedSeconds,
    sourceClip.duration,
  );
  sampleSourceTime(slot, sourceTime);
  return sourceTime;
}

function measureCandidate(slot) {
  const visualDuration = Math.max(0.001, slot.resolved.visualDurationSeconds);
  const steps = Math.max(12, Math.min(360, Math.ceil(visualDuration * 60)));
  sampleSlotProgress(slot, 0);
  const chestStart = boneWorldQuaternion(slot, 'chest');
  const shoulderStart = boneWorldQuaternion(slot, 'upperarm.r');
  const handStart = boneWorldPosition(slot, 'handslot.r');
  const tipStart = swordTipWorldPosition(slot);
  let previousHand = handStart.clone();
  let previousTip = tipStart.clone();
  let chestExcursionDegrees = 0;
  let shoulderExcursionDegrees = 0;
  let handPathMeters = 0;
  let swordTipPathMeters = 0;
  let peakSwordTipSpeedMetersPerSecond = 0;
  const dt = visualDuration / steps;

  for (let step = 1; step <= steps; step += 1) {
    sampleSlotProgress(slot, step / steps);
    const chest = boneWorldQuaternion(slot, 'chest');
    const shoulder = boneWorldQuaternion(slot, 'upperarm.r');
    const hand = boneWorldPosition(slot, 'handslot.r');
    const tip = swordTipWorldPosition(slot);
    chestExcursionDegrees = Math.max(chestExcursionDegrees, quaternionAngleDegrees(chestStart, chest));
    shoulderExcursionDegrees = Math.max(shoulderExcursionDegrees, quaternionAngleDegrees(shoulderStart, shoulder));
    const handStep = hand.distanceTo(previousHand);
    const tipStep = tip.distanceTo(previousTip);
    handPathMeters += handStep;
    swordTipPathMeters += tipStep;
    peakSwordTipSpeedMetersPerSecond = Math.max(peakSwordTipSpeedMetersPerSecond, tipStep / Math.max(1e-6, dt));
    previousHand = hand;
    previousTip = tip;
  }

  const handEnd = previousHand;
  const tipEnd = previousTip;
  return Object.freeze({
    sourceWindowSeconds: [slot.resolved.sourceStartSeconds, slot.resolved.sourceEndSeconds],
    playbackRate: slot.resolved.playbackRate,
    visualDurationMilliseconds: Number((visualDuration * 1000).toFixed(2)),
    approximateFrames30: Number(slot.resolved.approximateFrames30.toFixed(2)),
    chestExcursionDegrees: Number(chestExcursionDegrees.toFixed(3)),
    weaponShoulderExcursionDegrees: Number(shoulderExcursionDegrees.toFixed(3)),
    weaponHandPathMeters: Number(handPathMeters.toFixed(4)),
    weaponHandNetDisplacementMeters: Number(handEnd.distanceTo(handStart).toFixed(4)),
    swordTipPathMeters: Number(swordTipPathMeters.toFixed(4)),
    swordTipNetDisplacementMeters: Number(tipEnd.distanceTo(tipStart).toFixed(4)),
    peakSwordTipSpeedMetersPerSecond: Number(peakSwordTipSpeedMetersPerSecond.toFixed(3)),
    samples: steps + 1,
  });
}

function renderCards(sourceTimes = new Map()) {
  for (const slot of slots) {
    const card = cards.get(slot.candidate.id);
    if (!card) continue;
    const sourceTime = sourceTimes.get(slot.candidate.id);
    card.querySelector('[data-role="window"]').textContent = `${slot.resolved.sourceStartSeconds.toFixed(3)} → ${slot.resolved.sourceEndSeconds.toFixed(3)}s · ${slot.resolved.playbackRate.toFixed(2)}×`;
    card.querySelector('[data-role="duration"]').textContent = `${slot.metrics.visualDurationMilliseconds.toFixed(0)}ms · ~${slot.metrics.approximateFrames30.toFixed(1)} frames @30fps`;
    card.querySelector('[data-role="motion"]').textContent = `chest ${slot.metrics.chestExcursionDegrees.toFixed(1)}° · shoulder ${slot.metrics.weaponShoulderExcursionDegrees.toFixed(1)}° · sword path ${slot.metrics.swordTipPathMeters.toFixed(3)}m`;
    card.querySelector('[data-role="source"]').textContent = Number.isFinite(sourceTime) ? `source ${sourceTime.toFixed(3)}s` : 'source —';
  }
}

function applyStaticProgress(progress) {
  staticProgress = Math.max(0, Math.min(1, Number(progress) || 0));
  const times = new Map();
  for (const slot of slots) times.set(slot.candidate.id, sampleSlotProgress(slot, staticProgress));
  progressInput.value = String(staticProgress);
  progressLabel.textContent = `${Math.round(staticProgress * 100)}% source-window progress`;
  renderCards(times);
}

function applyAutoplay(now) {
  const elapsed = Math.max(0, (now - playbackStartedAt) / 1000);
  const times = new Map();
  for (const slot of slots) {
    const cycle = slot.resolved.visualDurationSeconds + PAUSE_SECONDS;
    const local = elapsed % cycle;
    const activeElapsed = Math.min(local, slot.resolved.visualDurationSeconds);
    times.set(slot.candidate.id, sampleSlotElapsed(slot, activeElapsed));
  }
  progressLabel.textContent = 'independent real-time playback · each candidate loops after a 550ms pause';
  renderCards(times);
}

function buildReport() {
  const contract = buildPowerBashReadabilityProbeReport(sourceClip.duration);
  const metrics = Object.fromEntries(slots.map((slot) => [slot.candidate.id, slot.metrics]));
  const current = slots.find((slot) => slot.candidate.id === POWER_BASH_READABILITY_CANDIDATE_IDS.CURRENT_G36);
  const extended = slots.find((slot) => slot.candidate.id === POWER_BASH_READABILITY_CANDIDATE_IDS.EXTENDED);
  const gates = {
    productionUnchanged: contract.productionUnchanged === true,
    sourceClipPresent: Boolean(sourceClip?.tracks?.length),
    allCandidatesMeasured: slots.every((slot) => slot.metrics?.samples > 2),
    currentBeatUnderFiveFrames30: current.metrics.approximateFrames30 < 5,
    extendedAtLeastThreeTimesLonger: extended.resolved.visualDurationSeconds >= current.resolved.visualDurationSeconds * 3,
  };
  const failures = Object.entries(gates).filter(([, pass]) => !pass).map(([name]) => name);
  const report = {
    stage: POWER_BASH_READABILITY_STAGE,
    pass: failures.length === 0,
    productionChanged: false,
    sourceClipId: POWER_BASH_READABILITY_SOURCE_CLIP_ID,
    sourceClipDurationSeconds: Number(sourceClip.duration.toFixed(6)),
    contract,
    metrics,
    gates,
    failures,
    decision: 'PROBE_ONLY — compare A/B/C visually; do not promote Extended until human review approves the authored Power Bash arc.',
  };
  document.documentElement.dataset.g361 = report.pass ? 'pass' : 'fail';
  document.documentElement.dataset.g361ProductionUnchanged = gates.productionUnchanged ? 'pass' : 'fail';
  document.documentElement.dataset.g361CurrentShort = gates.currentBeatUnderFiveFrames30 ? 'pass' : 'fail';
  document.documentElement.dataset.g361ExtendedLonger = gates.extendedAtLeastThreeTimesLonger ? 'pass' : 'fail';
  reportNode.textContent = JSON.stringify(report, null, 2);
  window.__G361_POWER_BASH_READABILITY_RESULT__ = report;
  return report;
}

async function main() {
  status.textContent = `${POWER_BASH_READABILITY_STAGE} loading complete Skyrim Power Bash source…`;
  const loader = new THREE.GLTFLoader();
  library = await loadSkyrimConvertedAnimationLibrary(loader, {
    THREE,
    rig: slots[0].character.rig,
    fps: 30,
  });
  sourceClip = library.clips.get(POWER_BASH_READABILITY_SOURCE_CLIP_ID);
  if (!sourceClip) throw new Error(`Missing ${POWER_BASH_READABILITY_SOURCE_CLIP_ID}`);
  const idle = library.clips.get('SKYRIM_GUARD/shd_blockidle');
  const bind = idle?.userData?.weaponBindCalibration;
  if (!bind?.correctionQuaternion) throw new Error(`${POWER_BASH_READABILITY_STAGE} requires accepted Skyrim weapon bind calibration`);
  const mount = composeSkyrimWeaponMountCalibration(THREE, DEFAULT_KAYKIT_SWORD_MOUNT, bind);

  for (const slot of slots) {
    slot.character.registerAnimations(library);
    slot.sword = createDebugSword(THREE);
    mountDebugSword(slot.character, slot.sword, mount);
    slot.resolved = resolvePowerBashReadabilityCandidate(slot.candidate, sourceClip.duration);
    slot.metrics = measureCandidate(slot);
  }

  const report = buildReport();
  status.textContent = `${POWER_BASH_READABILITY_STAGE} ${report.pass ? 'READY' : 'FAIL'} · source duration ${sourceClip.duration.toFixed(3)}s · production remains G3.6`;
  status.className = report.pass ? 'good' : 'bad';
  const params = new URLSearchParams(location.search);
  const requestedProgress = Number(params.get('progress'));
  if (Number.isFinite(requestedProgress)) {
    autoplay = false;
    playButton.textContent = '▶ Play real-time';
    applyStaticProgress(requestedProgress);
  } else {
    autoplay = true;
    playbackStartedAt = performance.now();
    playButton.textContent = '❚❚ Pause';
  }
}

POWER_BASH_READABILITY_CANDIDATES.forEach((candidate) => {
  const card = document.querySelector(`[data-candidate="${candidate.id}"]`);
  if (card) cards.set(candidate.id, card);
});

playButton.addEventListener('click', () => {
  autoplay = !autoplay;
  if (autoplay) {
    playbackStartedAt = performance.now();
    playButton.textContent = '❚❚ Pause';
  } else {
    playButton.textContent = '▶ Play real-time';
    applyStaticProgress(staticProgress);
  }
});
resetButton.addEventListener('click', () => {
  autoplay = false;
  playButton.textContent = '▶ Play real-time';
  applyStaticProgress(0);
});
progressInput.addEventListener('input', () => {
  autoplay = false;
  playButton.textContent = '▶ Play real-time';
  applyStaticProgress(Number(progressInput.value));
});
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));

setView(new URLSearchParams(location.search).get('view') || 'three');
resize();
addEventListener('resize', resize);

(function frame(now) {
  if (autoplay && sourceClip) applyAutoplay(now);
  slots.forEach((slot) => slot.sword?.update());
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
})(performance.now());

main().catch((error) => {
  document.documentElement.dataset.g361 = 'fail';
  status.textContent = `${POWER_BASH_READABILITY_STAGE} FAIL · ${error?.message || error}`;
  status.className = 'bad';
  reportNode.textContent = error?.stack || String(error);
  window.__G361_POWER_BASH_READABILITY_RESULT__ = { stage: POWER_BASH_READABILITY_STAGE, pass: false, error: error?.stack || String(error) };
});
