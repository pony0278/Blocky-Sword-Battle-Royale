import { createDefaultCharacter } from '../../src/character/default-character.js';
import { createDebugSword, mountDebugSword } from '../../src/character/debug-sword.js';
import { DEFAULT_KAYKIT_SWORD_MOUNT } from '../../src/character/default-character-mount.js';
import { applyMountCalibration, normalizeMountCalibration } from '../../src/character/character-sockets.js';
import { POSE_KEYS } from '../../src/animation/pose-schema.js';
import { normalizePose } from '../../src/animation/pose-utils.js';
import { createAnimationClip, clipMarkerSummary } from '../../src/animation/animation-clip.js';
import { ClipPlayer } from '../../src/animation/clip-player.js';
import { loadKayKitAnimationLibrary } from '../../src/animation/kaykit-animation-library.js';
import { ACTION_TEMPLATE_FACTORIES } from '../../src/animation/action-templates.js';
import { importLegacyPunchSnapshot } from '../../src/animation/legacy-punch-import.js';
import {
  ACTION_WINDOW_TYPES,
  createActionDefinition,
  isFrameInWindow,
} from '../../src/combat/action-definition.js';

const THREE = window.THREE;
if (!THREE) throw new Error('Action Studio requires Three.js r128');

const LIBRARY_KEY = 'ACTION_STUDIO_CLIP_LIBRARY_V1';
const MOUNT_KEY = 'ACTION_STUDIO_KAYKIT_SWORD_MOUNT_V2';
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

const canvas = document.getElementById('stageCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f19);
scene.fog = new THREE.Fog(0x0a0f19, 7, 16);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
const cameraTarget = new THREE.Vector3(0, 1.05, 0);
let cameraTheta = 0.45;
let cameraPhi = 1.12;
let cameraRadius = 5.1;
let gameCameraOn = false;
let savedCamera = null;

scene.add(new THREE.HemisphereLight(0xb9d2ff, 0x11131d, 1.15));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
keyLight.position.set(4, 7, 5);
keyLight.castShadow = true;
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x55e6c1, 0.7);
rimLight.position.set(-4, 3, -4);
scene.add(rimLight);
const grid = new THREE.GridHelper(18, 18, 0x33425f, 0x1b263a);
scene.add(grid);

const character = createDefaultCharacter(THREE);
scene.add(character.object3d);
const sword = createDebugSword(THREE);
let mountCalibration = loadMountCalibration();
mountDebugSword(character, sword, mountCalibration);

const dummy = createPreviewDummy();
scene.add(dummy);
const trailMaterial = new THREE.LineBasicMaterial({ color: 0x55e6c1, transparent: true, opacity: 0.92 });
const weaponTrail = new THREE.Line(new THREE.BufferGeometry(), trailMaterial);
weaponTrail.frustumCulled = false;
scene.add(weaponTrail);
let trailPoints = [];

const player = new ClipPlayer();
let animationSource = 'authored';
let kayKitLibrary = null;
let clip = null;
let action = null;
let selectedKeyIndex = 0;
let loopEnabled = false;
let slowEnabled = false;
let comboQueue = [];
let lastTick = performance.now();
let previousPlaybackFrame = 0;
let hitstopRemaining = 0;
let shakeRemaining = 0;
let dummyHitRemaining = 0;
const feel = { hitstop: 0.08, shake: 0.45, knockback: 0.55 };

function placeCamera() {
  camera.position.set(
    cameraTarget.x + cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta),
    cameraTarget.y + cameraRadius * Math.cos(cameraPhi),
    cameraTarget.z + cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta),
  );
  camera.lookAt(cameraTarget);
}

function createPreviewDummy() {
  const group = new THREE.Group();
  group.name = 'PREVIEW_DUMMY';
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 1.32, 0.46),
    new THREE.MeshStandardMaterial({ color: 0x7b314d, roughness: 0.82, metalness: 0 }),
  );
  body.position.y = 0.82;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.52, 0.52),
    new THREE.MeshStandardMaterial({ color: 0xb74a68, roughness: 0.7 }),
  );
  head.position.y = 1.72;
  group.add(head);
  group.position.z = 2.15;
  return group;
}

function loadMountCalibration() {
  try {
    const stored = JSON.parse(localStorage.getItem(MOUNT_KEY) || 'null');
    return normalizeMountCalibration(stored || DEFAULT_KAYKIT_SWORD_MOUNT);
  } catch {
    return normalizeMountCalibration(DEFAULT_KAYKIT_SWORD_MOUNT);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function currentProject() {
  return {
    format: 'action-studio-project',
    version: 1,
    clip: clone(clip),
    action: clone(action),
    weaponMount: clone(mountCalibration),
  };
}

function setProject(project, options = {}) {
  character.stopAnimation();
  animationSource = 'authored';
  clip = createAnimationClip(project.clip || project);
  action = createActionDefinition(project.action || {
    id: clip.id,
    clipId: clip.id,
    category: 'custom',
  }, clip.durationFrames);
  if (project.weaponMount) {
    mountCalibration = normalizeMountCalibration(project.weaponMount);
    applyMountCalibration(sword.object3d, mountCalibration);
  }
  player.setClip(clip);
  player.loop = loopEnabled;
  player.speed = slowEnabled ? 0.25 : 1;
  selectedKeyIndex = 0;
  previousPlaybackFrame = 0;
  clearWeaponTrail();
  renderEditor();
  applyEvaluation(player.evaluate());
  if (options.autoplay) {
    player.play({ restart: true });
    updatePlaybackButtons();
  }
}

function loadTemplate(id, autoplay = false) {
  const factory = ACTION_TEMPLATE_FACTORIES[id];
  if (!factory) return;
  setProject(factory(), { autoplay });
}

function setKayKitStatus(message, isError = false) {
  const status = document.getElementById('kaykitStatus');
  status.textContent = message;
  status.classList.toggle('error', isError);
}

async function loadKayKitRuntime() {
  if (kayKitLibrary) return kayKitLibrary;
  if (!THREE.GLTFLoader) throw new Error('Three.js GLTFLoader is unavailable');
  if (location.protocol === 'file:') {
    throw new Error('KayKit GLB animation packs require the local HTTP server');
  }
  setKayKitStatus('Loading four animation packs…');
  const loader = new THREE.GLTFLoader();
  kayKitLibrary = await loadKayKitAnimationLibrary(loader, {
    baseUrl: '../../assets/kaykit/animations/',
  });
  character.registerAnimations(kayKitLibrary);
  const select = document.getElementById('kaykitClip');
  select.innerHTML = '';
  [...kayKitLibrary.clips.keys()].forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });
  select.value = 'Idle_A';
  setKayKitStatus(
    `ready · ${kayKitLibrary.clips.size} clips · ${Object.keys(character.rig.bones).length} procedural bones`,
  );
  return kayKitLibrary;
}

function shouldLoopKayKitClip(name) {
  return /Idle|Walking|Running|Blocking|Crouching|Sneaking|Crawling/.test(name);
}

async function playSelectedKayKitClip() {
  await loadKayKitRuntime();
  const name = document.getElementById('kaykitClip').value;
  player.pause();
  clearWeaponTrail();
  animationSource = 'kaykit';
  character.playAnimation(name, { loop: shouldLoopKayKitClip(name), inPlace: true });
  document.getElementById('clipNow').textContent = name.toUpperCase();
  document.getElementById('phaseNow').textContent = 'KAYKIT RUNTIME';
  updatePlaybackButtons();
}

function rebuildClip(selectedName, seekFrame) {
  clip = createAnimationClip({
    ...clip,
    timeline: clip.timeline,
    poses: clip.poses,
  });
  action = createActionDefinition(action, clip.durationFrames);
  player.setClip(clip);
  player.loop = loopEnabled;
  player.speed = slowEnabled ? 0.25 : 1;
  selectedKeyIndex = Math.max(0, clip.timeline.findIndex((key) => key.name === selectedName));
  const targetFrame = Number.isFinite(Number(seekFrame)) ? Number(seekFrame) : clip.timeline[selectedKeyIndex].frame;
  player.seek(targetFrame);
  previousPlaybackFrame = player.frame;
  clearWeaponTrail();
  renderEditor();
  applyEvaluation(player.evaluate());
}

function renderEditor() {
  renderTimeline();
  renderKeyEditor();
  renderPoseControls();
  renderWindowEditor();
  renderMountEditor();
  renderLibrary();
  renderComboQueue();
  document.getElementById('clipNow').textContent = clip.name.toUpperCase();
  document.getElementById('libraryName').value = clip.id;
  document.getElementById('poseAxisSummary').textContent = `${POSE_KEYS.length} axes from POSE_KEYS`;
}

function renderTimeline() {
  const bar = document.getElementById('timelineBar');
  bar.querySelectorAll('.timeline-marker').forEach((node) => node.remove());
  const keysHost = document.getElementById('timelineKeys');
  keysHost.innerHTML = '';
  const duration = Math.max(1, clip.durationFrames);
  clip.timeline.forEach((key, index) => {
    const marker = document.createElement('button');
    marker.className = `timeline-marker${key.impact ? ' impact' : ''}${key.cancel ? ' cancel' : ''}${index === selectedKeyIndex ? ' selected' : ''}`;
    marker.style.left = `${(key.frame / duration) * 100}%`;
    marker.title = `${key.name} @ ${key.frame}f · ${key.tag}`;
    marker.innerHTML = `<span>${index}</span>`;
    marker.addEventListener('click', () => selectKey(index));
    bar.appendChild(marker);

    const button = document.createElement('button');
    button.className = `${index === selectedKeyIndex ? 'on ' : ''}${key.impact ? 'impact ' : ''}${key.cancel ? 'cancel' : ''}`;
    button.textContent = `${key.frame}f ${key.name}`;
    button.addEventListener('click', () => selectKey(index));
    keysHost.appendChild(button);
  });
  const markers = clipMarkerSummary(clip);
  document.getElementById('timelineSummary').textContent = `${clip.durationFrames}f · Impact ${markers.impacts.join(', ') || '—'} · Cancel ${markers.cancels.join(', ') || '—'}`;
  const scrub = document.getElementById('timelineScrub');
  scrub.max = Math.max(1, clip.durationFrames);
  scrub.value = player.frame;
  updateTimelineReadout();
}

function selectKey(index) {
  selectedKeyIndex = Math.max(0, Math.min(index, clip.timeline.length - 1));
  const key = clip.timeline[selectedKeyIndex];
  player.pause();
  player.seek(key.frame);
  previousPlaybackFrame = player.frame;
  renderTimeline();
  renderKeyEditor();
  renderPoseControls();
  applyEvaluation(player.evaluate());
  updatePlaybackButtons();
}

function renderKeyEditor() {
  const key = clip.timeline[selectedKeyIndex];
  document.getElementById('keyName').value = key.name;
  document.getElementById('keyFrame').value = key.frame;
  document.getElementById('keyEase').value = key.ease;
  document.getElementById('keyTag').value = key.tag;
  document.getElementById('keyImpact').checked = key.impact;
  document.getElementById('keyCancel').checked = key.cancel;
  document.getElementById('deleteKey').disabled = clip.timeline.length <= 1;
}

const POSE_GROUPS = [
  ['ROOT / TORSO / HEAD', (key) => key.startsWith('root_') || ['sq', 'body_scale', 'squat', 'spine_x', 'spine_y', 'pelvis_y', 'head_y', 'head_x', 'head_pz'].includes(key)],
  ['ARM L · SHOULDER / ELBOW / WRIST', (key) => key.startsWith('aL_') && !key.includes('_f')],
  ['ARM R · SHOULDER / ELBOW / WRIST', (key) => key.startsWith('aR_') && !key.includes('_f')],
  ['LEG L · HIP / KNEE / ANKLE', (key) => key.startsWith('lL_')],
  ['LEG R · HIP / KNEE / ANKLE', (key) => key.startsWith('lR_')],
  ['OPTIONAL FINGER POSE', (key) => key.startsWith('aL_f') || key.startsWith('aR_f')],
];

function sliderSpec(key) {
  if (key === 'body_scale' || key.endsWith('_scale')) return [0.3, 3, 0.01];
  if (key.endsWith('_stretch')) return [0.4, 3, 0.01];
  if (key.endsWith('_idle')) return [0, 1, 0.01];
  if (key.endsWith('_contact')) return [0, 2, 1];
  if (key === 'root_py' || key === 'root_pz' || key === 'head_pz') return [-0.8, 0.8, 0.01];
  if (key === 'sq') return [-0.4, 0.4, 0.01];
  if (key === 'squat') return [0, 80, 1];
  if (key.includes('_f')) return [-120, 30, 1];
  return [-180, 180, 1];
}

function renderPoseControls() {
  const host = document.getElementById('poseControls');
  host.innerHTML = '';
  const keyframe = clip.timeline[selectedKeyIndex];
  const pose = clip.poses[keyframe.name];
  for (const [title, matches] of POSE_GROUPS) {
    const keys = POSE_KEYS.filter(matches);
    const details = document.createElement('details');
    details.className = 'pose-group';
    details.open = title.includes('ROOT') || title.includes('ARM R');
    details.innerHTML = `<summary>${title}</summary>`;
    const gridHost = document.createElement('div');
    gridHost.className = 'pose-grid';
    for (const poseKey of keys) {
      const [min, max, step] = sliderSpec(poseKey);
      const label = document.createElement('label');
      label.textContent = poseKey;
      const range = document.createElement('input');
      range.type = 'range';
      range.min = min;
      range.max = max;
      range.step = step;
      range.value = pose[poseKey];
      const output = document.createElement('output');
      output.textContent = Number(pose[poseKey]).toFixed(step < 1 ? 2 : 0);
      range.addEventListener('input', () => {
        clip.poses[keyframe.name][poseKey] = Number(range.value);
        output.textContent = Number(range.value).toFixed(step < 1 ? 2 : 0);
        player.pause();
        player.seek(keyframe.frame);
        character.applyPose(clip.poses[keyframe.name]);
        previousPlaybackFrame = player.frame;
        updatePlaybackButtons();
      });
      gridHost.append(label, range, output);
    }
    details.appendChild(gridHost);
    host.appendChild(details);
  }
}

function renderWindowEditor() {
  const host = document.getElementById('windowEditor');
  host.innerHTML = '';
  for (const type of ACTION_WINDOW_TYPES) {
    const window = action.windows[type][0] || null;
    const row = document.createElement('div');
    row.className = 'window-row';
    row.innerHTML = `
      <label><input type="checkbox" ${window ? 'checked' : ''}>${type}</label>
      <label>start <input type="number" min="0" max="${clip.durationFrames}" step="1" value="${window?.startFrame ?? 0}"></label>
      <label>end <input type="number" min="0" max="${clip.durationFrames}" step="1" value="${window?.endFrame ?? 0}"></label>`;
    const [enabled, start, end] = row.querySelectorAll('input');
    const commit = () => {
      const windows = clone(action.windows);
      windows[type] = enabled.checked ? [{ startFrame: Number(start.value), endFrame: Number(end.value), label: window?.label || '' }] : [];
      action = createActionDefinition({ ...action, windows }, clip.durationFrames);
    };
    enabled.addEventListener('change', commit);
    start.addEventListener('input', commit);
    end.addEventListener('input', commit);
    host.appendChild(row);
  }
}

function renderMountEditor() {
  const host = document.getElementById('mountEditor');
  host.innerHTML = '<span></span><b>X</b><b>Y</b><b>Z</b>';
  const rows = [
    ['position', mountCalibration.position, 1],
    ['rotation °', mountCalibration.rotation, RAD_TO_DEG],
    ['scale', mountCalibration.scale, 1],
  ];
  rows.forEach(([label, values, factor]) => {
    const rowLabel = document.createElement('span');
    rowLabel.textContent = label;
    host.appendChild(rowLabel);
    ['x', 'y', 'z'].forEach((axis) => {
      const input = document.createElement('input');
      input.type = 'number';
      input.step = label === 'rotation °' ? '1' : '0.01';
      input.value = Number(values[axis] * factor).toFixed(label === 'rotation °' ? 0 : 2);
      input.addEventListener('input', () => {
        const raw = Number(input.value);
        if (!Number.isFinite(raw)) return;
        if (label === 'position') mountCalibration.position[axis] = raw;
        else if (label === 'rotation °') mountCalibration.rotation[axis] = raw * DEG_TO_RAD;
        else mountCalibration.scale[axis] = Math.max(0.01, raw);
        mountCalibration = normalizeMountCalibration(mountCalibration);
        applyMountCalibration(sword.object3d, mountCalibration);
        document.getElementById('socketStatus').textContent = 'attached · unsaved';
      });
      host.appendChild(input);
    });
  });
}

function updateTimelineReadout() {
  const duration = Math.max(1, clip?.durationFrames || 1);
  document.getElementById('timelineScrub').value = player.frame;
  document.getElementById('frameNow').textContent = `${player.frame.toFixed(2)}f`;
  document.getElementById('timelinePlayhead').style.left = `${Math.min(100, (player.frame / duration) * 100)}%`;
}

function applyEvaluation(evaluation) {
  if (!evaluation) return;
  character.applyPose(evaluation.pose);
  document.getElementById('phaseNow').textContent = `${evaluation.to.toUpperCase()} · ${evaluation.frame.toFixed(1)}F`;
  updateTimelineReadout();
}

function clearWeaponTrail() {
  trailPoints = [];
  weaponTrail.geometry.dispose();
  weaponTrail.geometry = new THREE.BufferGeometry();
}

function recordWeaponTrail(frame) {
  if (!isFrameInWindow(action, 'weaponTrail', frame)) return;
  const point = new THREE.Vector3();
  sword.trailTip.getWorldPosition(point);
  if (!trailPoints.length || trailPoints[trailPoints.length - 1].distanceToSquared(point) > 0.0002) {
    trailPoints.push(point);
    if (trailPoints.length > 70) trailPoints.shift();
    weaponTrail.geometry.dispose();
    weaponTrail.geometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
  }
}

function triggerImpactPreview() {
  hitstopRemaining = feel.hitstop;
  shakeRemaining = 0.18;
  dummyHitRemaining = 0.34;
  const flash = document.getElementById('impactFlash');
  if (document.getElementById('dummyToggle').checked) {
    flash.style.transition = 'none';
    flash.style.opacity = String(0.18 + feel.shake * 0.28);
    requestAnimationFrame(() => {
      flash.style.transition = 'opacity .16s ease-out';
      flash.style.opacity = '0';
    });
  }
}

function crossedImpact(previousFrame, currentFrame) {
  if (currentFrame < previousFrame) return false;
  return clip.timeline.some((key) => key.impact && key.frame > previousFrame && key.frame <= currentFrame);
}

function updatePreviewEffects(deltaSeconds) {
  dummy.visible = document.getElementById('dummyToggle').checked;
  if (dummyHitRemaining > 0) {
    dummyHitRemaining = Math.max(0, dummyHitRemaining - deltaSeconds);
    const amount = dummyHitRemaining / 0.34;
    dummy.position.z = 2.15 + feel.knockback * 0.72 * amount;
    dummy.rotation.x = -feel.knockback * 0.18 * amount;
  } else {
    dummy.position.z = 2.15;
    dummy.rotation.x = 0;
  }
}

function updatePlaybackButtons() {
  document.getElementById('playToggle').textContent = player.playing ? '❚❚ Pause' : '▶ Play';
  document.getElementById('slowToggle').classList.toggle('on', slowEnabled);
  document.getElementById('loopToggle').classList.toggle('on', loopEnabled);
}

function readLibrary() {
  try { return JSON.parse(localStorage.getItem(LIBRARY_KEY) || '{}'); } catch { return {}; }
}

function writeLibrary(library) {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
}

function renderLibrary() {
  const host = document.getElementById('clipLibrary');
  const library = readLibrary();
  host.innerHTML = '';
  const names = Object.keys(library).sort();
  if (!names.length) {
    host.innerHTML = '<div class="status-line">Library is empty. Save the current action to begin.</div>';
    return;
  }
  names.forEach((name) => {
    const row = document.createElement('div');
    row.className = 'library-row';
    row.innerHTML = `<span>${name}</span>`;
    const load = document.createElement('button');
    load.textContent = 'Load';
    load.addEventListener('click', () => setProject(library[name]));
    const queue = document.createElement('button');
    queue.textContent = '+ Combo';
    queue.addEventListener('click', () => {
      comboQueue.push({ name, project: clone(library[name]) });
      renderComboQueue();
    });
    const remove = document.createElement('button');
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => {
      const latest = readLibrary();
      delete latest[name];
      writeLibrary(latest);
      renderLibrary();
    });
    row.append(load, queue, remove);
    host.appendChild(row);
  });
}

function renderComboQueue() {
  const host = document.getElementById('comboQueue');
  host.textContent = comboQueue.length ? comboQueue.map((entry, index) => `${index + 1}. ${entry.name}`).join('  →  ') : 'queue is empty';
}

function buildComboProject(queue) {
  const timeline = [];
  const poses = {};
  const windows = Object.fromEntries(ACTION_WINDOW_TYPES.map((type) => [type, []]));
  let endFrame = 0;
  queue.forEach((entry, clipIndex) => {
    const sourceClip = createAnimationClip(entry.project.clip);
    const sourceAction = createActionDefinition(entry.project.action, sourceClip.durationFrames);
    const firstFrame = sourceClip.timeline[0].frame;
    const offset = clipIndex === 0 ? -firstFrame : endFrame + 4 - firstFrame;
    sourceClip.timeline.forEach((key) => {
      const name = `combo_${clipIndex + 1}_${key.name}`;
      timeline.push({ ...key, name, frame: key.frame + offset });
      poses[name] = sourceClip.poses[key.name];
    });
    ACTION_WINDOW_TYPES.forEach((type) => {
      sourceAction.windows[type].forEach((window) => windows[type].push({
        ...window,
        startFrame: window.startFrame + offset,
        endFrame: window.endFrame + offset,
      }));
    });
    endFrame = sourceClip.durationFrames + offset;
  });
  const comboClip = createAnimationClip({ id: 'combo_preview', name: 'Combo Preview', timeline, poses });
  return {
    clip: comboClip,
    action: createActionDefinition({ id: comboClip.id, clipId: comboClip.id, category: 'combo-preview', windows }, comboClip.durationFrames),
    weaponMount: mountCalibration,
  };
}

function setIoStatus(message, error = false) {
  const status = document.getElementById('ioStatus');
  status.textContent = message;
  status.style.color = error ? 'var(--impact)' : 'var(--cyan)';
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / Math.max(1, rect.height);
  camera.updateProjectionMatrix();
}

let orbiting = false;
let pointerX = 0;
let pointerY = 0;
canvas.addEventListener('pointerdown', (event) => {
  orbiting = true;
  pointerX = event.clientX;
  pointerY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointerup', () => { orbiting = false; });
canvas.addEventListener('pointercancel', () => { orbiting = false; });
canvas.addEventListener('pointermove', (event) => {
  if (!orbiting || gameCameraOn) return;
  cameraTheta -= (event.clientX - pointerX) * 0.008;
  cameraPhi = Math.max(0.3, Math.min(1.48, cameraPhi - (event.clientY - pointerY) * 0.008));
  pointerX = event.clientX;
  pointerY = event.clientY;
  placeCamera();
});
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  cameraRadius = Math.max(3.2, Math.min(10, cameraRadius + event.deltaY * 0.008));
  placeCamera();
}, { passive: false });

function bindV3AppearanceToggle(buttonId, setter) {
  const button = document.getElementById(buttonId);
  button.addEventListener('click', () => {
    const visible = !button.classList.contains('on');
    button.classList.toggle('on', visible);
    setter(visible);
  });
}

bindV3AppearanceToggle('toggleRigNodes', (visible) => {
  character.setRigNodesVisible(visible);
  sword.setNodesVisible(visible);
});
bindV3AppearanceToggle('toggleRigGlow', (visible) => {
  character.setRigGlowVisible(visible);
  sword.setGlowVisible(visible);
});

document.getElementById('loadKayKitAnimations').addEventListener('click', () => {
  loadKayKitRuntime().catch((error) => setKayKitStatus(error.message, true));
});
document.getElementById('playKayKitAnimation').addEventListener('click', () => {
  playSelectedKayKitClip().catch((error) => setKayKitStatus(error.message, true));
});
document.getElementById('stopKayKitAnimation').addEventListener('click', () => loadTemplate('idle'));

document.getElementById('showTPose').addEventListener('click', () => loadTemplate('t_pose'));
document.getElementById('showIdle').addEventListener('click', () => loadTemplate('idle'));
document.getElementById('playSlash').addEventListener('click', () => loadTemplate('slash_test', true));
document.querySelectorAll('[data-template]').forEach((button) => {
  button.addEventListener('click', () => loadTemplate(button.dataset.template));
});
document.getElementById('playToggle').addEventListener('click', () => {
  if (player.playing) player.pause();
  else {
    if (player.frame >= clip.durationFrames) player.seek(0);
    previousPlaybackFrame = player.frame;
    if (player.frame === 0) clearWeaponTrail();
    player.play();
  }
  updatePlaybackButtons();
});
document.getElementById('slowToggle').addEventListener('click', () => {
  slowEnabled = !slowEnabled;
  player.speed = slowEnabled ? 0.25 : 1;
  updatePlaybackButtons();
});
document.getElementById('loopToggle').addEventListener('click', () => {
  loopEnabled = !loopEnabled;
  player.loop = loopEnabled;
  updatePlaybackButtons();
});
document.getElementById('gameCamera').addEventListener('click', () => {
  gameCameraOn = !gameCameraOn;
  if (gameCameraOn) {
    savedCamera = { cameraTheta, cameraPhi, cameraRadius, fov: camera.fov };
    cameraTheta = Math.PI;
    cameraPhi = 0.82;
    cameraRadius = 5.35;
    camera.fov = 34;
  } else if (savedCamera) {
    ({ cameraTheta, cameraPhi, cameraRadius } = savedCamera);
    camera.fov = savedCamera.fov;
  }
  camera.updateProjectionMatrix();
  placeCamera();
  document.getElementById('gameCamera').classList.toggle('on', gameCameraOn);
});
document.getElementById('timelineScrub').addEventListener('input', (event) => {
  player.pause();
  player.seek(Number(event.target.value));
  previousPlaybackFrame = player.frame;
  clearWeaponTrail();
  applyEvaluation(player.evaluate());
  updatePlaybackButtons();
});
document.getElementById('applyKey').addEventListener('click', () => {
  const key = clip.timeline[selectedKeyIndex];
  const oldName = key.name;
  const desiredName = document.getElementById('keyName').value.trim() || oldName;
  if (desiredName !== oldName && clip.timeline.some((entry) => entry.name === desiredName)) {
    setIoStatus(`Key name already exists: ${desiredName}`, true);
    return;
  }
  if (desiredName !== oldName) {
    clip.poses[desiredName] = clip.poses[oldName];
    delete clip.poses[oldName];
    key.name = desiredName;
  }
  key.frame = Math.max(0, Math.round(Number(document.getElementById('keyFrame').value) || 0));
  key.ease = document.getElementById('keyEase').value;
  key.tag = document.getElementById('keyTag').value;
  key.impact = document.getElementById('keyImpact').checked;
  key.cancel = document.getElementById('keyCancel').checked;
  rebuildClip(desiredName);
});
document.getElementById('addKey').addEventListener('click', () => {
  const current = clip.timeline[selectedKeyIndex];
  let frame = current.frame + 4;
  const next = clip.timeline[selectedKeyIndex + 1];
  if (next && next.frame - current.frame > 1) frame = Math.floor((next.frame + current.frame) / 2);
  else clip.timeline.forEach((key) => { if (key.frame >= frame) key.frame += 4; });
  const name = `key_${frame}`;
  clip.timeline.push({ name, frame, ease: 'out', tag: 'custom' });
  clip.poses[name] = normalizePose(clip.poses[current.name]);
  rebuildClip(name, frame);
});
document.getElementById('duplicateKey').addEventListener('click', () => {
  const current = clip.timeline[selectedKeyIndex];
  const nameRoot = `${current.name}_copy`;
  let name = nameRoot;
  let index = 2;
  while (clip.poses[name]) name = `${nameRoot}_${index++}`;
  const frame = current.frame + 3;
  clip.timeline.forEach((key) => { if (key.frame >= frame) key.frame += 3; });
  clip.timeline.push({ ...current, name, frame, impact: false, cancel: false });
  clip.poses[name] = normalizePose(clip.poses[current.name]);
  rebuildClip(name, frame);
});
document.getElementById('deleteKey').addEventListener('click', () => {
  if (clip.timeline.length <= 1) return;
  const [removed] = clip.timeline.splice(selectedKeyIndex, 1);
  delete clip.poses[removed.name];
  const next = clip.timeline[Math.max(0, selectedKeyIndex - 1)];
  rebuildClip(next.name, next.frame);
});
document.getElementById('saveMount').addEventListener('click', () => {
  localStorage.setItem(MOUNT_KEY, JSON.stringify(mountCalibration));
  document.getElementById('socketStatus').textContent = 'attached · saved';
});
document.getElementById('resetMount').addEventListener('click', () => {
  mountCalibration = normalizeMountCalibration(DEFAULT_KAYKIT_SWORD_MOUNT);
  applyMountCalibration(sword.object3d, mountCalibration);
  localStorage.removeItem(MOUNT_KEY);
  renderMountEditor();
  document.getElementById('socketStatus').textContent = 'attached · reset';
});

[['hitstop', 'hitstopValue', 'hitstop', (value) => `${value.toFixed(2)}s`],
 ['shake', 'shakeValue', 'shake', (value) => value.toFixed(2)],
 ['knockback', 'knockbackValue', 'knockback', (value) => value.toFixed(2)]].forEach(([id, outputId, key, format]) => {
  document.getElementById(id).addEventListener('input', (event) => {
    feel[key] = Number(event.target.value);
    document.getElementById(outputId).textContent = format(feel[key]);
  });
});
document.getElementById('saveClip').addEventListener('click', () => {
  const name = document.getElementById('libraryName').value.trim() || clip.id;
  const library = readLibrary();
  library[name] = currentProject();
  writeLibrary(library);
  renderLibrary();
  setIoStatus(`Saved ${name} to the local clip library.`);
});
document.getElementById('playCombo').addEventListener('click', () => {
  if (!comboQueue.length) {
    setIoStatus('Add one or more library clips to the combo queue first.', true);
    return;
  }
  setProject(buildComboProject(comboQueue), { autoplay: true });
});
document.getElementById('clearCombo').addEventListener('click', () => {
  comboQueue = [];
  renderComboQueue();
});
document.getElementById('exportProject').addEventListener('click', () => {
  const textarea = document.getElementById('projectJson');
  textarea.value = JSON.stringify(currentProject(), null, 2);
  textarea.select();
  navigator.clipboard?.writeText(textarea.value).catch(() => {});
  setIoStatus('Exported Action Studio project JSON.');
});
document.getElementById('importProject').addEventListener('click', () => {
  try {
    const data = JSON.parse(document.getElementById('projectJson').value);
    if (data.format === 'action-studio-project' && data.clip) {
      setProject(data);
      setIoStatus('Imported Action Studio project.');
    } else if (data.format === 'action-studio-clip' || (data.timeline && data.poses)) {
      setProject({ clip: data });
      setIoStatus('Imported Action Studio clip.');
    } else if (data.seq || data.SEQ || data.phases || data.PHASES) {
      const result = importLegacyPunchSnapshot(data);
      setProject({ clip: result.clip });
      setIoStatus(`Imported legacy Punch snapshot. Ignored editor-only keys: ${result.report.ignoredPoseKeys.join(', ') || 'none'}.`);
    } else {
      throw new Error('Unknown project shape');
    }
  } catch (error) {
    setIoStatus(`Import failed: ${error.message}`, true);
  }
});

function tick(now) {
  const deltaSeconds = Math.min(0.05, Math.max(0, (now - lastTick) / 1000));
  lastTick = now;
  let evaluation = player.evaluate();
  if (player.playing) {
    if (hitstopRemaining > 0) {
      hitstopRemaining = Math.max(0, hitstopRemaining - deltaSeconds);
    } else {
      const before = player.frame;
      evaluation = player.update(deltaSeconds);
      const after = player.frame;
      if (after < before) {
        previousPlaybackFrame = 0;
        clearWeaponTrail();
      }
      if (crossedImpact(previousPlaybackFrame, after)) triggerImpactPreview();
      previousPlaybackFrame = after;
    }
    applyEvaluation(evaluation);
    character.object3d.updateMatrixWorld(true);
    recordWeaponTrail(player.frame);
    if (!player.playing) updatePlaybackButtons();
  }
  character.update(deltaSeconds, camera);
  sword.update();
  updatePreviewEffects(deltaSeconds);

  let shakeX = 0;
  let shakeY = 0;
  if (shakeRemaining > 0) {
    shakeRemaining = Math.max(0, shakeRemaining - deltaSeconds);
    const amount = feel.shake * 0.08 * (shakeRemaining / 0.18);
    shakeX = (Math.random() * 2 - 1) * amount;
    shakeY = (Math.random() * 2 - 1) * amount;
    camera.position.x += shakeX;
    camera.position.y += shakeY;
  }
  renderer.render(scene, camera);
  camera.position.x -= shakeX;
  camera.position.y -= shakeY;
  requestAnimationFrame(tick);
}

window.addEventListener('resize', resize);
window.__actionStudio = {
  get clip() { return clip; },
  get action() { return action; },
  get project() { return currentProject(); },
  get sockets() { return Object.keys(character.sockets); },
  get handRWeaponAttached() { return sword.object3d.parent === character.sockets.HAND_R; },
  get characterRigId() { return character.rig.definition.id; },
  get proceduralBoneCount() { return Object.keys(character.rig.bones).length; },
  get weaponRigId() { return sword.definition.id; },
  get weaponBoneCount() { return Object.keys(sword.bones).length; },
  get weaponSockets() { return Object.keys(sword.sockets); },
  get weaponSweepSegment() {
    const { start, end } = sword.getSweepSegment();
    return { start: start.toArray(), end: end.toArray() };
  },
  get animationSource() { return animationSource; },
  get renderStyle() { return 'v3-rig-line'; },
  loadKayKitRuntime,
  playKayKitClip(name, options = {}) { animationSource = 'kaykit'; return character.playAnimation(name, options); },
  get legacyScriptsLoaded() {
    return [...document.scripts].map((script) => script.src).filter((src) => /\/ps\//.test(src));
  },
  seek(frame) { player.seek(frame); applyEvaluation(player.evaluate()); return player.evaluate(); },
  loadTemplate,
};

placeCamera();
resize();
loadTemplate('slash_test');
updatePlaybackButtons();
requestAnimationFrame(tick);

