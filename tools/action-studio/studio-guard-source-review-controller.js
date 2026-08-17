import {
  KAYKIT_GUARD_REVIEW_CLIPS,
  getKayKitGuardReviewClip,
} from '../../src/combat/kaykit-guard-source-review.js';

function formatSeconds(value) {
  return `${Math.max(0, Number(value) || 0).toFixed(3)}s`;
}

export function createStudioGuardSourceReviewController(options) {
  const {
    externalAnimations,
    character,
    pausePlayer,
    clearWeaponTrail,
    applyCurrentEvaluation,
    updatePlaybackButtons,
  } = options;

  const clipSelect = document.getElementById('guardReviewClip');
  const status = document.getElementById('guardReviewStatus');
  const duration = document.getElementById('guardReviewDuration');
  const role = document.getElementById('guardReviewRole');
  const strategy = document.getElementById('guardReviewStrategy');
  let loaded = false;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle('error', isError);
  }

  function selectedDefinition() {
    return getKayKitGuardReviewClip(clipSelect.value) || KAYKIT_GUARD_REVIEW_CLIPS[0];
  }

  function selectedSourceClip() {
    return externalAnimations.libraries.get('kaykit')?.clips.get(selectedDefinition().clipId) || null;
  }

  function renderDefinition() {
    const definition = selectedDefinition();
    const sourceClip = selectedSourceClip();
    duration.textContent = sourceClip ? formatSeconds(sourceClip.duration) : 'load source';
    role.textContent = `${definition.label} · ${definition.intent}`;
    strategy.textContent = definition.holdStrategy === 'authored-loop-candidate'
      ? 'Hold candidate: authored Melee_Blocking loop; compare with Hold End before G2.'
      : `Preview default: ${definition.defaultPreviewMode}`;
  }

  async function load() {
    const library = await externalAnimations.load('kaykit', { populateUi: false });
    for (const definition of KAYKIT_GUARD_REVIEW_CLIPS) {
      if (!library.clips.has(definition.clipId)) {
        throw new Error(`KayKit melee pack is missing ${definition.clipId}`);
      }
    }
    loaded = true;
    renderDefinition();
    setStatus(`G1 ready · ${KAYKIT_GUARD_REVIEW_CLIPS.length} KayKit guard clips found`);
    return library;
  }

  async function ensureLoaded() {
    if (loaded && externalAnimations.hasLoaded('kaykit')) return externalAnimations.libraries.get('kaykit');
    return load();
  }

  function preparePreview(label) {
    pausePlayer();
    clearWeaponTrail();
    document.getElementById('clipNow').textContent = selectedDefinition().clipId.toUpperCase();
    document.getElementById('phaseNow').textContent = `G1 GUARD SOURCE · ${label}`;
    updatePlaybackButtons();
  }

  async function preview(mode) {
    await ensureLoaded();
    const definition = selectedDefinition();
    const sourceClip = selectedSourceClip();
    if (!sourceClip) throw new Error(`Missing KayKit clip ${definition.clipId}`);
    preparePreview(mode.toUpperCase());

    if (mode === 'hold-end') {
      const holdTime = Math.max(0, Number(sourceClip.duration) - 1 / 60);
      character.sampleAnimation(definition.clipId, holdTime, { loop: false, inPlace: true });
      setStatus(`hold end · ${definition.clipId} · ${formatSeconds(holdTime)} / ${formatSeconds(sourceClip.duration)}`);
      return;
    }

    const loop = mode === 'loop';
    externalAnimations.playClip('kaykit', definition.clipId, {
      loop,
      inPlace: true,
      speed: 1,
      fadeSeconds: 0.08,
    });
    setStatus(`${loop ? 'loop' : 'once'} · ${definition.clipId} · duration ${formatSeconds(sourceClip.duration)}`);
  }

  function returnToAction() {
    character.stopAnimation();
    applyCurrentEvaluation();
    updatePlaybackButtons();
    setStatus('Returned to current Action timeline');
  }

  clipSelect.innerHTML = '';
  for (const definition of KAYKIT_GUARD_REVIEW_CLIPS) {
    const option = document.createElement('option');
    option.value = definition.clipId;
    option.textContent = `${definition.label} · ${definition.clipId}`;
    clipSelect.appendChild(option);
  }
  clipSelect.value = KAYKIT_GUARD_REVIEW_CLIPS[0].clipId;
  renderDefinition();

  clipSelect.addEventListener('change', renderDefinition);
  document.getElementById('loadGuardReviewSource').addEventListener('click', () => {
    load().catch((error) => setStatus(error.message, true));
  });
  document.getElementById('guardReviewOnce').addEventListener('click', () => {
    preview('once').catch((error) => setStatus(error.message, true));
  });
  document.getElementById('guardReviewLoop').addEventListener('click', () => {
    preview('loop').catch((error) => setStatus(error.message, true));
  });
  document.getElementById('guardReviewHoldEnd').addEventListener('click', () => {
    preview('hold-end').catch((error) => setStatus(error.message, true));
  });
  document.getElementById('guardReviewReturn').addEventListener('click', returnToAction);

  return {
    load,
    preview,
    renderDefinition,
    get selected() { return selectedDefinition(); },
  };
}
