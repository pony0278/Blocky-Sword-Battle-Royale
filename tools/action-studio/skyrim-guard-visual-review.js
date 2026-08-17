import { createDefaultCharacter } from '../../src/character/default-character.js';
import { createDebugSword, mountDebugSword } from '../../src/character/debug-sword.js';
import { DEFAULT_KAYKIT_SWORD_MOUNT } from '../../src/character/default-character-mount.js';
import {
  SKYRIM_GUARD_CONVERTED_FILES,
  importSkyrimConvertedAnimationFile,
} from '../../src/animation/skyrim-converted-animation-library.js';
import {
  SKYRIM_GUARD_VISUAL_REVIEW_ITEMS,
  classifySkyrimGuardLoopSeam,
  decideSkyrimGuardVisualReview,
} from '../../src/combat/skyrim-guard-visual-review.js';

const THREE = window.THREE;
if (!THREE?.WebGLRenderer || !THREE?.GLTFLoader) throw new Error('G2.3 requires Three.js + GLTFLoader');

const CLIP_ID = SKYRIM_GUARD_CONVERTED_FILES[0].clipId;
const canvas = document.getElementById('reviewCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
scene.add(new THREE.HemisphereLight(0xffffff, 0x293142, 1.25));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
keyLight.position.set(2.5, 4, 3);
scene.add(keyLight);
const grid = new THREE.GridHelper(8, 16, 0x3b465b, 0x252d3b);
scene.add(grid);

const character = createDefaultCharacter(THREE);
const sword = createDebugSword(THREE);
mountDebugSword(character, sword, DEFAULT_KAYKIT_SWORD_MOUNT);
scene.add(character.object3d);

const sourceFile = document.getElementById('sourceFile');
const status = document.getElementById('reviewStatus');
const sampleTime = document.getElementById('sampleTime');
const hudMode = document.getElementById('hudMode');
const ratings = {};
let library = null;
let lastTime = performance.now();
let dragging = false;
let lastPointer = null;
let yaw = 0;
let pitch = 0;

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function sourceClip() {
  return library?.clips.get(CLIP_ID) || null;
}

function formatSeconds(value) {
  return `${Math.max(0, Number(value) || 0).toFixed(3)}s`;
}

function setView(view) {
  if (view === 'front') { yaw = 0; pitch = 0; }
  else if (view === 'side') { yaw = Math.PI / 2; pitch = 0; }
  else { yaw = Math.PI / 4; pitch = 0.04; }
  updateCamera();
}

function updateCamera() {
  const target = new THREE.Vector3(0, 1.05, 0);
  const radius = 4.5;
  const cp = Math.cos(pitch);
  camera.position.set(
    target.x + Math.sin(yaw) * cp * radius,
    target.y + Math.sin(pitch) * radius + 0.15,
    target.z + Math.cos(yaw) * cp * radius,
  );
  camera.lookAt(target);
}

function renderDecision() {
  const result = decideSkyrimGuardVisualReview(ratings);
  const output = document.getElementById('decisionValue');
  output.textContent = result.decision;
  output.className = `decision ${result.decision === 'ADOPT' ? 'good' : result.decision === 'ADOPT WITH CORRECTIONS' ? 'warning' : result.decision === 'REJECT' ? 'bad' : 'pending'}`;
}

function renderReviewItems() {
  const root = document.getElementById('reviewItems');
  root.innerHTML = '';
  for (const item of SKYRIM_GUARD_VISUAL_REVIEW_ITEMS) {
    const row = document.createElement('div');
    row.className = 'rating';
    row.innerHTML = `<div><b>${item.label}</b><small>${item.question}</small></div><div class="rating-controls"><button data-rating="pass">✓</button><button data-rating="correct">~</button><button data-rating="fail">×</button></div>`;
    row.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', () => {
        ratings[item.id] = button.dataset.rating;
        row.querySelectorAll('button').forEach((candidate) => candidate.classList.toggle('on', candidate === button));
        renderDecision();
      });
    });
    root.appendChild(row);
  }
  renderDecision();
}

async function importSource(file) {
  if (!file) return;
  setStatus(`Retargeting ${file.name} to Action Studio Blockman rig…`);
  const loader = new THREE.GLTFLoader();
  const nextLibrary = await importSkyrimConvertedAnimationFile(loader, file, {
    THREE,
    rig: character.rig,
    fps: 30,
    entry: SKYRIM_GUARD_CONVERTED_FILES[0],
  });
  character.registerAnimations(nextLibrary);
  library = nextLibrary;
  const clip = sourceClip();
  sampleTime.max = String(clip.duration);
  sampleTime.value = '0';
  character.sampleAnimation(CLIP_ID, 0, { loop:false, inPlace:true });
  hudMode.textContent = `retargeted · ${formatSeconds(clip.duration)} · 30 fps review`;
  setStatus(`G2.3 ready · ${file.name} → ${CLIP_ID} · inspect Once / Loop / seam / visual gates`);
}

async function ensureLoaded() {
  if (!sourceClip()) throw new Error('Import the real converted shd_blockidle.source.glb first');
}

async function preview(loop) {
  await ensureLoaded();
  character.playAnimation(CLIP_ID, { loop, inPlace:true, speed:1, fadeSeconds:0.05 });
  hudMode.textContent = `${loop ? 'LOOP' : 'ONCE'} · natural 1.00×`;
}

async function freezeAt(value, label) {
  await ensureLoaded();
  const clip = sourceClip();
  const time = Math.max(0, Math.min(Number(value) || 0, clip.duration));
  character.sampleAnimation(CLIP_ID, time, { loop:false, inPlace:true });
  sampleTime.value = String(time);
  hudMode.textContent = `${label || 'FREEZE'} · ${formatSeconds(time)} / ${formatSeconds(clip.duration)}`;
}

function snapshotBone(id) {
  const bone = character.rig.bones[id];
  return {
    position: bone.getWorldPosition(new THREE.Vector3()),
    quaternion: bone.getWorldQuaternion(new THREE.Quaternion()),
  };
}

function quaternionAngleDegrees(a, b) {
  const dot = Math.min(1, Math.max(-1, Math.abs(a.dot(b))));
  return THREE.MathUtils.radToDeg(2 * Math.acos(dot));
}

async function measureLoopSeam() {
  await ensureLoaded();
  const clip = sourceClip();
  const endTime = Math.max(0, clip.duration - Math.min(1 / 120, clip.duration * 0.002));
  const ids = ['root','hips','spine','chest','head','upperarm.l','lowerarm.l','wrist.l','upperarm.r','lowerarm.r','wrist.r','upperleg.l','lowerleg.l','upperleg.r','lowerleg.r'];

  character.sampleAnimation(CLIP_ID, 0, { loop:false, inPlace:false });
  character.object3d.updateMatrixWorld(true);
  const start = Object.fromEntries(ids.map((id) => [id, snapshotBone(id)]));
  character.sampleAnimation(CLIP_ID, endTime, { loop:false, inPlace:false });
  character.object3d.updateMatrixWorld(true);
  const end = Object.fromEntries(ids.map((id) => [id, snapshotBone(id)]));

  const maxRotationDegrees = Math.max(...ids.map((id) => quaternionAngleDegrees(start[id].quaternion, end[id].quaternion)));
  const rootTranslation = start.root.position.distanceTo(end.root.position);
  const pelvisTranslation = start.hips.position.distanceTo(end.hips.position);
  const result = classifySkyrimGuardLoopSeam({ maxRotationDegrees, rootTranslation, pelvisTranslation });

  document.getElementById('rotationMetric').textContent = `${result.maxRotationDegrees.toFixed(2)}°`;
  document.getElementById('rootMetric').textContent = result.rootTranslation.toFixed(4);
  document.getElementById('pelvisMetric').textContent = result.pelvisTranslation.toFixed(4);
  const metric = document.getElementById('loopMetricResult');
  metric.textContent = result.status.toUpperCase();
  metric.className = result.status;
  if (ratings.loop == null) ratings.loop = result.status === 'good' ? 'pass' : result.status === 'warning' ? 'correct' : 'fail';
  const loopRow = [...document.querySelectorAll('.rating')][4];
  loopRow?.querySelectorAll('button').forEach((button) => button.classList.toggle('on', button.dataset.rating === ratings.loop));
  renderDecision();
  await freezeAt(0, 'START AFTER MEASURE');
  setStatus(`Loop seam measured · rotation ${result.maxRotationDegrees.toFixed(2)}° · root ${result.rootTranslation.toFixed(4)} · pelvis ${result.pelvisTranslation.toFixed(4)} · ${result.status}`);
  return result;
}

function resize() {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  if (canvas.width !== Math.round(width * renderer.getPixelRatio()) || canvas.height !== Math.round(height * renderer.getPixelRatio())) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
}

function frame(now) {
  resize();
  const delta = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  character.update(delta, camera);
  sword.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

document.getElementById('chooseSource').addEventListener('click', () => sourceFile.click());
sourceFile.addEventListener('change', () => {
  const file = sourceFile.files?.[0];
  importSource(file).catch((error) => setStatus(error.message, true));
  sourceFile.value = '';
});
document.getElementById('previewOnce').addEventListener('click', () => preview(false).catch((error) => setStatus(error.message, true)));
document.getElementById('previewLoop').addEventListener('click', () => preview(true).catch((error) => setStatus(error.message, true)));
document.getElementById('freezeStart').addEventListener('click', () => freezeAt(0, 'START').catch((error) => setStatus(error.message, true)));
document.getElementById('freezeEnd').addEventListener('click', () => {
  const clip = sourceClip();
  freezeAt(clip ? Math.max(0, clip.duration - 1 / 120) : 0, 'END').catch((error) => setStatus(error.message, true));
});
sampleTime.addEventListener('input', () => freezeAt(sampleTime.value, 'SCRUB').catch((error) => setStatus(error.message, true)));
document.getElementById('measureLoop').addEventListener('click', () => measureLoopSeam().catch((error) => setStatus(error.message, true)));
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));

canvas.addEventListener('pointerdown', (event) => {
  dragging = true;
  lastPointer = { x:event.clientX, y:event.clientY };
  canvas.setPointerCapture?.(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (!dragging || !lastPointer) return;
  yaw -= (event.clientX - lastPointer.x) * 0.006;
  pitch = Math.max(-0.3, Math.min(0.42, pitch + (event.clientY - lastPointer.y) * 0.004));
  lastPointer = { x:event.clientX, y:event.clientY };
  updateCamera();
});
canvas.addEventListener('pointerup', () => { dragging = false; lastPointer = null; });
canvas.addEventListener('pointercancel', () => { dragging = false; lastPointer = null; });

renderReviewItems();
setView('three');
requestAnimationFrame(frame);
