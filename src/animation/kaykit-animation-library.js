import { sanitizeAnimationTargetName } from './animation-target-name.js';

export const KAYKIT_ANIMATION_PACKS = Object.freeze([
  Object.freeze({ id: 'general', file: 'general.glb' }),
  Object.freeze({ id: 'basic', file: 'basic.glb' }),
  Object.freeze({ id: 'advanced', file: 'advanced.glb' }),
  Object.freeze({ id: 'melee', file: 'melee.glb' }),
  Object.freeze({ id: 'ranged', file: 'ranged.glb' }),
  Object.freeze({ id: 'simulation', file: 'simulation.glb' }),
  Object.freeze({ id: 'special', file: 'special.glb' }),
  Object.freeze({ id: 'tools', file: 'tools.glb' }),
]);

function loadGlb(loader, url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

function disposePackScene(scene) {
  scene?.traverse?.((object3d) => {
    if (!object3d.isMesh) return;
    object3d.geometry?.dispose?.();
    const materials = Array.isArray(object3d.material) ? object3d.material : [object3d.material];
    materials.forEach((material) => material?.dispose?.());
  });
}

export function loadKayKitAnimationLibrary(loader, options = {}) {
  if (!loader?.load) throw new Error('loadKayKitAnimationLibrary requires a GLTFLoader instance');
  const baseUrl = String(options.baseUrl || '../../assets/kaykit/animations/').replace(/\/?$/, '/');
  const selected = new Set(options.packIds || KAYKIT_ANIMATION_PACKS.map((pack) => pack.id));
  const packs = KAYKIT_ANIMATION_PACKS.filter((pack) => selected.has(pack.id));
  return Promise.all(packs.map(async (pack) => {
    const gltf = await loadGlb(loader, `${baseUrl}${pack.file}`);
    const result = { packId: pack.id, clips: gltf.animations || [] };
    disposePackScene(gltf.scene);
    return result;
  })).then((loaded) => {
    const clips = new Map();
    const duplicates = [];
    loaded.forEach((pack) => {
      pack.clips.forEach((clip) => {
        if (clips.has(clip.name)) duplicates.push({ name: clip.name, ignoredPack: pack.packId });
        else clips.set(clip.name, clip);
      });
    });
    return { clips, packs: loaded, duplicates };
  });
}

function clipTargetName(trackName) {
  const propertyIndex = trackName.lastIndexOf('.');
  return propertyIndex < 0 ? trackName : trackName.slice(0, propertyIndex);
}

function clipPropertyName(trackName) {
  const propertyIndex = String(trackName || '').lastIndexOf('.');
  return propertyIndex < 0 ? '' : String(trackName || '').slice(propertyIndex + 1);
}

function isRootPositionTrack(track) {
  const name = String(track?.name || '');
  return clipPropertyName(name) === 'position'
    && sanitizeAnimationTargetName(clipTargetName(name)) === sanitizeAnimationTargetName('root');
}

export function validateKayKitClipBindings(clips, boneIds) {
  const known = new Set(boneIds.map((boneId) => sanitizeAnimationTargetName(boneId)));
  const missing = new Map();
  for (const clip of clips.values ? clips.values() : clips) {
    const targets = [...new Set(clip.tracks.map((track) => sanitizeAnimationTargetName(clipTargetName(track.name))))];
    const unbound = targets.filter((target) => !known.has(target));
    if (unbound.length) missing.set(clip.name, unbound);
  }
  return { valid: missing.size === 0, missing };
}

export function createKayKitAnimationController(THREE, object3d) {
  if (!THREE?.AnimationMixer) throw new Error('KayKit animation controller requires THREE.AnimationMixer');
  const mixer = new THREE.AnimationMixer(object3d);
  const clips = new Map();
  const actions = new Map();
  let currentAction = null;
  let currentClipName = null;

  function invalidatePreparedActions(name) {
    for (const [key, action] of [...actions.entries()]) {
      if (!key.startsWith(`${name}|`)) continue;
      if (currentAction === action) {
        currentAction = null;
        currentClipName = null;
      }
      action.stop?.();
      const prepared = action.getClip?.();
      if (prepared && mixer.uncacheAction) mixer.uncacheAction(prepared, object3d);
      actions.delete(key);
    }
  }

  function preparedClip(name, inPlace) {
    const source = clips.get(name);
    if (!source) return null;
    const key = `${name}|${inPlace ? 'in-place' : 'root-motion'}`;
    if (!actions.has(key)) {
      const clip = source.clone();
      clip.name = key;
      if (inPlace) {
        clip.tracks = clip.tracks.filter((track) => !isRootPositionTrack(track));
        clip.resetDuration();
      }
      actions.set(key, mixer.clipAction(clip, object3d));
    }
    return actions.get(key);
  }

  function configureLoop(action, loop) {
    if (loop) {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
    } else {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
  }

  return {
    mixer,
    clips,
    get currentClipName() { return currentClipName; },
    register(source) {
      const iterable = source?.values ? source.values() : source;
      for (const clip of iterable || []) {
        if (!clip?.name) continue;
        if (clips.has(clip.name)) invalidatePreparedActions(clip.name);
        clips.set(clip.name, clip);
      }
      return clips.size;
    },
    has(name) {
      return clips.has(name);
    },
    getClipDuration(name) {
      return Math.max(0, Number(clips.get(name)?.duration) || 0);
    },
    getPreparedClipDiagnostics(name, inPlace = true) {
      const source = clips.get(name);
      const action = preparedClip(name, inPlace);
      const prepared = action?.getClip?.() || null;
      return {
        name,
        inPlace: Boolean(inPlace),
        sourceTrackCount: source?.tracks?.length || 0,
        sourceRootPositionTracks: source?.tracks?.filter(isRootPositionTrack).length || 0,
        preparedTrackCount: prepared?.tracks?.length || 0,
        preparedRootPositionTracks: prepared?.tracks?.filter(isRootPositionTrack).length || 0,
      };
    },
    play(name, options = {}) {
      const action = preparedClip(name, options.inPlace !== false);
      if (!action) throw new Error(`Unknown KayKit animation: ${name}`);
      const fadeSeconds = Math.max(0, Number(options.fadeSeconds ?? 0.12));
      if (currentAction && currentAction !== action) currentAction.fadeOut(fadeSeconds);
      action.enabled = true;
      action.paused = false;
      action.reset();
      action.setEffectiveWeight(1);
      action.setEffectiveTimeScale(Number(options.speed) || 1);
      configureLoop(action, options.loop !== false);
      action.fadeIn(fadeSeconds).play();
      currentAction = action;
      currentClipName = name;
      return action;
    },
    sample(name, timeSeconds, options = {}) {
      const action = preparedClip(name, options.inPlace !== false);
      if (!action) throw new Error(`Unknown KayKit animation: ${name}`);
      if (currentAction !== action) {
        mixer.stopAllAction();
        action.reset();
        action.enabled = true;
        action.setEffectiveWeight(1);
        action.setEffectiveTimeScale(1);
        action.play();
      }
      configureLoop(action, options.loop === true);
      action.enabled = true;
      action.paused = false;
      action.time = Math.max(0, Number(timeSeconds) || 0);
      mixer.update(0);
      action.paused = true;
      currentAction = action;
      currentClipName = name;
      return action.time;
    },
    stop(fadeSeconds = 0) {
      if (currentAction && fadeSeconds > 0) currentAction.fadeOut(fadeSeconds);
      else mixer.stopAllAction();
      currentAction = null;
      currentClipName = null;
    },
    update(deltaSeconds) {
      mixer.update(Math.max(0, Number(deltaSeconds) || 0));
    },
  };
}
