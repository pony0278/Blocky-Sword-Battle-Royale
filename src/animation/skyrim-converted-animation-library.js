import { retargetSkyrimClip } from './skyrim-animation-retarget.js';

export const SKYRIM_GUARD_CONVERTED_FILES = Object.freeze([
  Object.freeze({
    id: 'shd_blockidle',
    file: 'shd_blockidle.source.glb',
    clipId: 'SKYRIM_GUARD/shd_blockidle',
    role: 'Guard Hold',
  }),
]);

const DEFAULT_BASE_URL = '../../assets/skyrim/guard/converted/';

function normalizedBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/?$/, '/');
}

function loadGlb(loader, url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

function parseGlb(loader, arrayBuffer) {
  return new Promise((resolve, reject) => loader.parse(arrayBuffer, '', resolve, reject));
}

function disposeSourceScene(scene) {
  scene?.traverse?.((object3d) => {
    if (!object3d?.isMesh) return;
    object3d.geometry?.dispose?.();
    const materials = Array.isArray(object3d.material) ? object3d.material : [object3d.material];
    materials.forEach((material) => material?.dispose?.());
  });
}

function validateBridgeInput(THREE, rig, entry) {
  if (!THREE) throw new Error('Skyrim converted-source bridge requires THREE');
  if (!rig?.definition || !rig?.restTransforms || !rig?.bones) {
    throw new Error('Skyrim converted-source bridge requires the Action Studio procedural target rig');
  }
  if (!entry?.clipId) throw new Error('Skyrim converted-source bridge requires a canonical clipId');
}

export function retargetConvertedSkyrimGltf(THREE, gltf, rig, entry = SKYRIM_GUARD_CONVERTED_FILES[0], options = {}) {
  validateBridgeInput(THREE, rig, entry);
  const retarget = options.retargetClip || retargetSkyrimClip;
  const scene = gltf?.scene || gltf?.root || null;
  const clip = gltf?.animations?.[0] || gltf?.clip || null;
  if (!scene || !clip) {
    throw new Error('Converted Skyrim GLB must contain a named source hierarchy and at least one animation');
  }
  return retarget(THREE, { scene, animations: [clip] }, rig, {
    fps: options.fps || 30,
    clipId: entry.clipId,
    boneRetargets: options.boneRetargets,
  });
}

export function createSkyrimConvertedAnimationLibrary(clip, options = {}) {
  if (!clip?.name) throw new Error('Skyrim converted animation library requires a named retargeted clip');
  return {
    clips: new Map([[clip.name, clip]]),
    files: options.files || SKYRIM_GUARD_CONVERTED_FILES,
    source: 'skyrim',
    retargetFps: Math.max(1, Number(options.fps) || 30),
    duplicates: [],
    bridge: 'converted-glb',
  };
}

export async function loadSkyrimConvertedAnimationLibrary(loader, options = {}) {
  if (!loader?.load) throw new Error('loadSkyrimConvertedAnimationLibrary requires a GLTFLoader instance');
  const THREE = options.THREE;
  const rig = options.rig;
  const files = options.files || SKYRIM_GUARD_CONVERTED_FILES;
  if (!files.length) throw new Error('Skyrim converted animation library requires at least one source file');
  const baseUrl = normalizedBaseUrl(options.baseUrl);
  const clips = [];

  for (const entry of files) {
    let gltf;
    try {
      gltf = await loadGlb(loader, `${baseUrl}${entry.file}`);
    } catch (error) {
      const detail = error?.message ? `: ${error.message}` : '';
      throw new Error(`Converted Skyrim source not found: ${entry.file}${detail}`);
    }
    try {
      clips.push(retargetConvertedSkyrimGltf(THREE, gltf, rig, entry, options));
    } finally {
      disposeSourceScene(gltf?.scene);
    }
  }

  return {
    clips: new Map(clips.map((clip) => [clip.name, clip])),
    files,
    source: 'skyrim',
    retargetFps: Math.max(1, Number(options.fps) || 30),
    duplicates: [],
    bridge: 'converted-glb',
  };
}

export async function importSkyrimConvertedAnimationFile(loader, file, options = {}) {
  if (!loader?.parse) throw new Error('importSkyrimConvertedAnimationFile requires a GLTFLoader instance');
  if (!file?.arrayBuffer) throw new Error('Select a converted Skyrim .glb file first');
  const filename = String(file.name || '').toLowerCase();
  if (filename && !filename.endsWith('.glb')) {
    throw new Error('Local Skyrim bridge import currently accepts self-contained .glb files only');
  }

  const entry = options.entry || SKYRIM_GUARD_CONVERTED_FILES[0];
  const bytes = await file.arrayBuffer();
  const gltf = await parseGlb(loader, bytes);
  try {
    const clip = retargetConvertedSkyrimGltf(options.THREE, gltf, options.rig, entry, options);
    return createSkyrimConvertedAnimationLibrary(clip, {
      files: [Object.freeze({ ...entry, localFile: file.name || entry.file })],
      fps: options.fps || 30,
    });
  } finally {
    disposeSourceScene(gltf?.scene);
  }
}
