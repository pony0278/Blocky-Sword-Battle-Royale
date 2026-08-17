import { createFittedAnimationBinding } from '../../src/animation/animation-binding.js';
import {
  KAYKIT_ANIMATION_PACKS,
  loadKayKitAnimationLibrary,
} from '../../src/animation/kaykit-animation-library.js';
import {
  UAL1_ANIMATION_FILES,
  loadUal1AnimationLibrary,
} from '../../src/animation/ual1-animation-library.js';
import {
  UAL2_ANIMATION_FILES,
  loadUal2AnimationLibrary,
} from '../../src/animation/ual2-animation-library.js';
import { readAnimationBindingView } from './studio-editor-view.js';

const SOURCE_INFO = Object.freeze({
  ual2: Object.freeze({ label: 'UAL2 Sword Combat', count: UAL2_ANIMATION_FILES.length, defaultClip: 'UAL2/Sword_Regular_A' }),
  ual1: Object.freeze({ label: 'UAL1 Sword Basics', count: UAL1_ANIMATION_FILES.length, defaultClip: 'UAL1/Sword_Attack' }),
  kaykit: Object.freeze({ label: 'KayKit Base', count: KAYKIT_ANIMATION_PACKS.length, defaultClip: 'Idle_A' }),
});

function shouldLoopClip(name) {
  return /Idle|Walking|Running|Block|Crouching|Sneaking|Crawling/.test(name);
}

export function createStudioExternalAnimationController(options) {
  const {
    THREE,
    character,
    getAction,
    getClip,
    setBinding,
    pausePlayer,
    applyCurrentEvaluation,
    clearWeaponTrail,
    updatePlaybackButtons,
    setAnimationSource,
    renderBinding,
    restartActionPlayback,
  } = options;
  const libraries = new Map();
  const sourceSelect = document.getElementById('animationPackSource');
  const clipSelect = document.getElementById('kaykitClip');
  const status = document.getElementById('kaykitStatus');

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('error', isError);
  }

  function selectedSource() {
    return sourceSelect.value in SOURCE_INFO ? sourceSelect.value : 'ual2';
  }

  function populate(source, preferredClipId = '') {
    clipSelect.innerHTML = '';
    const library = libraries.get(source);
    if (!library) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = `Load ${SOURCE_INFO[source].label} first`;
      clipSelect.appendChild(option);
      return;
    }
    [...library.clips.keys()].forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name.replace(/^UAL[12]\//, '');
      clipSelect.appendChild(option);
    });
    clipSelect.value = library.clips.has(preferredClipId)
      ? preferredClipId
      : SOURCE_INFO[source].defaultClip;
  }

  async function load(source = selectedSource()) {
    if (libraries.has(source)) return libraries.get(source);
    if (!THREE.GLTFLoader) throw new Error('Three.js GLTFLoader is unavailable');
    if (location.protocol === 'file:') throw new Error('External GLB animations require the local HTTP server');
    const info = SOURCE_INFO[source];
    setStatus(`Loading ${info.label} · ${info.count} files…`);
    const loader = new THREE.GLTFLoader();
    let library;
    if (source === 'ual1') {
      library = await loadUal1AnimationLibrary(loader, {
        THREE,
        rig: character.rig,
        baseUrl: '../../assets/UAL1_Animation_Split_Package/Animation_Only/No_Root_Motion/',
        fps: 30,
      });
    } else if (source === 'ual2') {
      library = await loadUal2AnimationLibrary(loader, {
        THREE,
        rig: character.rig,
        baseUrl: '../../assets/UAL2_Sword_Combat_Package/Animation_Only/No_Root_Motion/',
        fps: 30,
      });
    } else {
      library = await loadKayKitAnimationLibrary(loader, { baseUrl: '../../assets/kaykit/animations/' });
    }
    character.registerAnimations(library);
    libraries.set(source, library);
    populate(source, getAction()?.animationBinding?.clipId);
    const detail = source === 'kaykit'
      ? `${library.clips.size} unique clips · ${library.duplicates.length} duplicates ignored`
      : `${library.clips.size} sword clips retargeted at ${library.retargetFps} fps`;
    setStatus(`ready · ${info.label} · ${detail} · ${Object.keys(character.rig.bones).length} target bones`);
    renderBinding();
    return library;
  }

  async function ensureBinding(binding) {
    if (!binding || binding.source === 'authored') return null;
    sourceSelect.value = binding.source;
    const library = await load(binding.source);
    populate(binding.source, binding.clipId);
    return library;
  }

  function isAvailable(binding) {
    return Boolean(binding?.source !== 'authored'
      && libraries.get(binding.source)?.clips.has(binding.clipId)
      && character.hasAnimation(binding.clipId));
  }

  async function bindSelected(fitToAction = false) {
    const source = selectedSource();
    const library = await load(source);
    const controlBinding = readAnimationBindingView(source);
    const sourceClip = library.clips.get(controlBinding.clipId);
    if (!sourceClip) throw new Error(`Select a ${SOURCE_INFO[source].label} clip first`);
    const binding = fitToAction ? createFittedAnimationBinding({
      ...controlBinding,
      source,
      animationDurationSeconds: sourceClip.duration,
      durationFrames: getClip().durationFrames,
      fps: getClip().fps,
    }) : controlBinding;
    setBinding(binding);
    return binding;
  }

  async function playSelected() {
    const source = selectedSource();
    await load(source);
    const name = clipSelect.value;
    if (!name) throw new Error(`Select a ${SOURCE_INFO[source].label} clip first`);
    pausePlayer();
    clearWeaponTrail();
    setAnimationSource(`${source}-preview`);
    character.playAnimation(name, { loop: shouldLoopClip(name), inPlace: true });
    document.getElementById('clipNow').textContent = name.replace(/^UAL[12]\//, '').toUpperCase();
    document.getElementById('phaseNow').textContent = source === 'kaykit'
      ? 'KAYKIT RUNTIME'
      : `${source.toUpperCase()} RETARGET PREVIEW`;
    updatePlaybackButtons();
  }

  function impactFrames() {
    return (getClip()?.timeline || [])
      .filter((key) => key.impact)
      .map((key) => key.frame);
  }

  function activeFeelProfile() {
    if (typeof window === 'undefined') return 'active profile';
    return window.__actionStudio?.combatFeelProfile || 'active profile';
  }

  function restartBoundAction() {
    if (typeof restartActionPlayback === 'function') {
      restartActionPlayback();
      return;
    }
    const scrub = document.getElementById('timelineScrub');
    const play = document.getElementById('playToggle');
    if (!scrub || !play) throw new Error('Action playback controls are unavailable');
    scrub.value = '0';
    const EventCtor = globalThis.Event || window.Event;
    scrub.dispatchEvent(new EventCtor('input', { bubbles: true }));
    play.click();
  }

  async function playSelectedWithImpact() {
    const frames = impactFrames();
    if (!frames.length) {
      throw new Error('Preview + Impact requires an Impact marker in the current Action timeline');
    }
    const binding = await bindSelected(true);
    restartBoundAction();
    const clipName = binding.clipId.replace(/^UAL[12]\//, '');
    setStatus(`impact preview · ${clipName} · ${activeFeelProfile()} · Impact ${frames.join(', ')}f`);
    return binding;
  }

  function installImpactPreviewButton() {
    const sourcePreviewButton = document.getElementById('playKayKitAnimation');
    if (!sourcePreviewButton || typeof sourcePreviewButton.insertAdjacentElement !== 'function') return null;
    if (document.getElementById('previewKayKitWithImpact')) return document.getElementById('previewKayKitWithImpact');
    const button = document.createElement('button');
    button.id = 'previewKayKitWithImpact';
    button.className = 'primary';
    button.textContent = '▶ Preview + Impact';
    button.title = 'Fit + bind the selected motion, restart the current Action, and use its Impact marker + active Combat Feel profile.';
    sourcePreviewButton.insertAdjacentElement('afterend', button);
    button.addEventListener('click', () => {
      playSelectedWithImpact().catch((error) => setStatus(error.message, true));
    });
    return button;
  }

  sourceSelect.addEventListener('change', () => {
    const source = selectedSource();
    populate(source, getAction()?.animationBinding?.source === source ? getAction().animationBinding.clipId : '');
    const state = libraries.has(source) ? 'ready' : 'not loaded';
    setStatus(`${SOURCE_INFO[source].label} · ${state}`);
  });
  document.getElementById('loadKayKitAnimations').addEventListener('click', () => {
    load().catch((error) => setStatus(error.message, true));
  });
  document.getElementById('playKayKitAnimation').addEventListener('click', () => {
    playSelected().catch((error) => setStatus(error.message, true));
  });
  document.getElementById('stopKayKitAnimation').addEventListener('click', applyCurrentEvaluation);
  document.getElementById('bindKayKitAnimation').addEventListener('click', () => {
    bindSelected(false).catch((error) => setStatus(error.message, true));
  });
  document.getElementById('fitKayKitAnimation').addEventListener('click', () => {
    bindSelected(true).catch((error) => setStatus(error.message, true));
  });
  document.getElementById('clearAnimationBinding').addEventListener('click', () => {
    setBinding({ source: 'authored', clipId: getClip().id });
  });
  installImpactPreviewButton();
  populate(selectedSource());

  return {
    get libraries() { return libraries; },
    hasLoaded: (source) => libraries.has(source),
    isAvailable,
    ensureBinding,
    load,
    bindSelected,
    playSelected,
    playSelectedWithImpact,
    setStatus,
    playClip(source, name, playOptions = {}) {
      if (!libraries.has(source)) throw new Error(`${SOURCE_INFO[source]?.label || source} is not loaded`);
      setAnimationSource(`${source}-preview`);
      return character.playAnimation(name, playOptions);
    },
  };
}
