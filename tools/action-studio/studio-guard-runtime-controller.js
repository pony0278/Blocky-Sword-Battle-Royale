import { DEFAULT_KAYKIT_SWORD_MOUNT } from '../../src/character/default-character-mount.js';
import { applyMountCalibration } from '../../src/character/character-sockets.js';
import { loadKayKitAnimationLibrary } from '../../src/animation/kaykit-animation-library.js';
import { loadSkyrimConvertedAnimationLibrary } from '../../src/animation/skyrim-converted-animation-library.js';
import { composeSkyrimWeaponMountCalibration } from '../../src/animation/skyrim-weapon-bind-calibration.js';
import {
  GUARD_EVENTS,
  GUARD_STATES,
  createGuardStateMachine,
} from '../../src/combat/guard-state-machine.js';
import { createGuardPresentationRuntime } from '../../src/combat/guard-presentation-runtime.js';
import { GUARD_WEAPON_MOUNT_PROFILE_IDS } from '../../src/combat/guard-counter-presentation.js';
import { createGuardWeaponMountRuntime } from '../../src/combat/guard-weapon-mount-runtime.js';

const MODE_LABELS = Object.freeze({
  hold: 'Guard Hold',
  block: 'Block Hit',
  parry: 'Parry',
  perfect: 'Perfect Parry',
  counter: 'Counter',
});

function captureMountCalibration(object3d) {
  return {
    position: {
      x: Number(object3d?.position?.x) || 0,
      y: Number(object3d?.position?.y) || 0,
      z: Number(object3d?.position?.z) || 0,
    },
    rotation: {
      x: Number(object3d?.rotation?.x) || 0,
      y: Number(object3d?.rotation?.y) || 0,
      z: Number(object3d?.rotation?.z) || 0,
    },
    scale: {
      x: Number(object3d?.scale?.x) || 1,
      y: Number(object3d?.scale?.y) || 1,
      z: Number(object3d?.scale?.z) || 1,
    },
  };
}

function installGuardPanel() {
  if (document.getElementById('guardRuntimePanel')) return document.getElementById('guardRuntimePanel');
  const quickActions = document.querySelector('.quick-actions');
  if (!quickActions) return null;

  const legacyGuardRow = quickActions.querySelector('.secondary-row');
  legacyGuardRow?.remove();

  quickActions.insertAdjacentHTML('afterend', `
    <section id="guardRuntimePanel" class="panel guard-runtime-panel" data-stage="G3.4">
      <div class="panel-title"><span>Guard Runtime · G3.4</span><small>Skyrim Guard ↔ KayKit Counter</small></div>
      <p class="blocking-intro">真正 Guard FSM 預覽。Block / Parry 使用 Skyrim Guard family；Counter 只會在預覽送出 authoritative <b>COUNTER_CONFIRMED</b> 後進入 KayKit <b>Melee_Block_Attack</b>，完成後回到 Skyrim Recover / Hold。</p>
      <div class="button-grid three">
        <button data-guard-runtime="hold">Guard Hold</button>
        <button data-guard-runtime="block">Block Hit</button>
        <button data-guard-runtime="parry">Parry</button>
      </div>
      <div class="button-grid two secondary-row">
        <button data-guard-runtime="perfect">Perfect Parry</button>
        <button data-guard-runtime="counter" class="primary">▶ Counter</button>
      </div>
      <div id="guardRuntimeStatus" class="status-line">G3.4 · assets load on first preview</div>
      <div id="guardRuntimeDetail" class="status-line">Counter = Melee_Block_Attack · presentation never self-confirms combat authority</div>
    </section>
  `);
  return document.getElementById('guardRuntimePanel');
}

function createUnavailableGuardRuntime() {
  return Object.freeze({
    start: async () => null,
    deactivate: () => {},
    get active() { return false; },
    get mode() { return null; },
    get snapshot() { return null; },
    get report() { return null; },
    get ready() { return false; },
  });
}

export function createStudioGuardRuntimeController(THREE, options = {}) {
  const {
    character,
    pausePlayer = () => {},
    clearWeaponTrail = () => {},
    updatePlaybackButtons = () => {},
    setAnimationSource = () => {},
    applyCurrentEvaluation = () => {},
  } = options;
  if (!character?.sampleAnimation || !character?.registerAnimations) {
    return createUnavailableGuardRuntime();
  }

  const panel = installGuardPanel();
  const status = document.getElementById('guardRuntimeStatus');
  const detail = document.getElementById('guardRuntimeDetail');
  const weaponObject3d = character.sockets?.HAND_R?.children?.[0] || null;
  let machine = null;
  let runtime = null;
  let mountRuntime = null;
  let loadPromise = null;
  let loaded = false;
  let active = false;
  let activeMode = null;
  let lastFrameAt = performance.now();
  let restoreMountCalibration = null;
  let lastResult = null;

  function setStatus(message, isError = false) {
    if (status) {
      status.textContent = message;
      status.classList.toggle('error', isError);
    }
  }

  function setActiveButton(mode) {
    document.querySelectorAll('[data-guard-runtime]').forEach((button) => {
      button.classList.toggle('on', Boolean(mode) && button.dataset.guardRuntime === mode);
    });
  }

  function updateReadout(result) {
    if (!result) return;
    const { snapshot, report } = result;
    panel?.setAttribute('data-guard-state', snapshot.state);
    panel?.setAttribute('data-guard-clip', report.clipId || '');
    panel?.setAttribute('data-guard-mount', report.weaponMountProfileId || '');
    if (report.counterProfileId) panel?.setAttribute('data-counter-profile', report.counterProfileId);
    const clipLabel = String(report.clipId || snapshot.presentation?.clipId || '—').replace(/^SKYRIM_GUARD\//, '');
    const sourceSeconds = Number(report.sourceTimeSeconds) || 0;
    document.getElementById('clipNow').textContent = clipLabel.toUpperCase();
    document.getElementById('phaseNow').textContent = `GUARD RUNTIME · ${snapshot.state.toUpperCase()}`;
    if (detail) {
      detail.textContent = `${snapshot.state} · ${clipLabel} · ${sourceSeconds.toFixed(3)}s · mount ${report.weaponMountProfileId || '—'}${report.counterProfileId ? ` · ${report.counterProfileId}` : ''}`;
    }
  }

  async function ensureLoaded() {
    if (loaded) return;
    if (loadPromise) return loadPromise;
    if (!THREE?.GLTFLoader) throw new Error('Action Studio Guard Runtime requires Three.js GLTFLoader');
    if (location.protocol === 'file:') throw new Error('Guard Runtime assets require Action Studio over HTTP / GitHub Pages');
    if (!weaponObject3d) throw new Error('Guard Runtime could not resolve the HAND_R weapon object');

    setStatus('G3.4 · loading Skyrim Guard + KayKit melee…');
    loadPromise = (async () => {
      const loader = new THREE.GLTFLoader();
      const [skyrim, kaykit] = await Promise.all([
        loadSkyrimConvertedAnimationLibrary(loader, {
          THREE,
          rig: character.rig,
          baseUrl: '../../assets/skyrim/guard/converted/',
          fps: 30,
        }),
        loadKayKitAnimationLibrary(loader, {
          baseUrl: '../../assets/kaykit/animations/',
          packIds: ['melee'],
        }),
      ]);
      character.registerAnimations(skyrim);
      character.registerAnimations(kaykit);

      const counterClip = kaykit.clips.get('Melee_Block_Attack');
      if (!counterClip) throw new Error('G3.4 requires KayKit Melee_Block_Attack');
      const bind = skyrim.clips.get('SKYRIM_GUARD/shd_blockidle')?.userData?.weaponBindCalibration;
      if (!bind?.correctionQuaternion) {
        throw new Error('G3.4 requires the accepted Skyrim Guard weapon-bind calibration');
      }
      const skyrimMount = composeSkyrimWeaponMountCalibration(
        THREE,
        DEFAULT_KAYKIT_SWORD_MOUNT,
        bind,
      );
      mountRuntime = createGuardWeaponMountRuntime({
        weaponObject3d,
        profiles: {
          [GUARD_WEAPON_MOUNT_PROFILE_IDS.SKYRIM_GUARD]: skyrimMount,
          [GUARD_WEAPON_MOUNT_PROFILE_IDS.KAYKIT_DEFAULT]: DEFAULT_KAYKIT_SWORD_MOUNT,
        },
      });
      machine = createGuardStateMachine();
      runtime = createGuardPresentationRuntime(THREE, {
        machine,
        character,
        applyWeaponMountProfile(profileId) {
          const result = mountRuntime.apply(profileId);
          if (result.applied) weaponObject3d.updateMatrixWorld?.(true);
        },
      });
      loaded = true;
      setStatus(`G3.4 ready · Counter Melee_Block_Attack ${Number(counterClip.duration).toFixed(3)}s`);
      panel?.setAttribute('data-g34-ready', 'true');
    })().catch((error) => {
      loadPromise = null;
      setStatus(`G3.4 load failed · ${error.message}`, true);
      panel?.setAttribute('data-g34-ready', 'false');
      throw error;
    });
    return loadPromise;
  }

  function resetMachine() {
    machine.send(GUARD_EVENTS.RESET, { source: 'action-studio-guard-runtime' });
    return runtime.sync();
  }

  function forceHold() {
    resetMachine();
    machine.send(GUARD_EVENTS.GUARD_PRESS, { source: 'action-studio-guard-runtime' });
    runtime.sync();
    let result = runtime.update(180);
    if (result.snapshot.state !== GUARD_STATES.HOLD) result = runtime.update(180);
    if (result.snapshot.state !== GUARD_STATES.HOLD) {
      throw new Error(`Action Studio Guard Enter did not settle to Hold: ${result.snapshot.state}`);
    }
    return result;
  }

  function dispatchPreviewMode(mode) {
    if (mode === 'hold') {
      resetMachine();
      machine.send(GUARD_EVENTS.GUARD_PRESS, { source: 'action-studio-guard-runtime' });
      return runtime.sync();
    }

    forceHold();
    if (mode === 'block') {
      machine.send(GUARD_EVENTS.BLOCK_CONFIRMED, {
        source: 'action-studio-preview-authority',
        verification: 'action-studio-block-hit',
      });
    } else if (mode === 'parry' || mode === 'perfect') {
      machine.send(GUARD_EVENTS.PARRY_CONFIRMED, {
        source: 'action-studio-preview-authority',
        perfect: mode === 'perfect',
        verification: `action-studio-${mode}`,
      });
    } else if (mode === 'counter') {
      machine.send(GUARD_EVENTS.PARRY_CONFIRMED, {
        source: 'action-studio-preview-authority',
        perfect: false,
        verification: 'action-studio-counter-entry-parry',
      });
      runtime.sync();
      const confirmed = machine.send(GUARD_EVENTS.COUNTER_CONFIRMED, {
        source: 'action-studio-preview-authority',
        verification: 'action-studio-g34-counter',
      });
      if (!confirmed.accepted || confirmed.snapshot.state !== GUARD_STATES.COUNTER) {
        throw new Error(`Action Studio COUNTER_CONFIRMED rejected: ${confirmed.snapshot.state}`);
      }
    } else {
      throw new Error(`Unknown Guard Runtime preview mode: ${mode}`);
    }
    return runtime.sync();
  }

  async function start(mode) {
    if (!(mode in MODE_LABELS)) throw new Error(`Unknown Guard Runtime mode: ${mode}`);
    await ensureLoaded();
    pausePlayer();
    clearWeaponTrail();
    character.stopAnimation?.();
    restoreMountCalibration = captureMountCalibration(weaponObject3d);
    active = true;
    activeMode = mode;
    lastFrameAt = performance.now();
    setAnimationSource('guard-runtime');
    setActiveButton(mode);
    lastResult = dispatchPreviewMode(mode);
    updateReadout(lastResult);
    setStatus(`${MODE_LABELS[mode]} · real Guard FSM${mode === 'counter' ? ' · preview authority sent COUNTER_CONFIRMED' : ''}`);
    updatePlaybackButtons();
    return lastResult;
  }

  function deactivate(options = {}) {
    if (!active && !options.force) return;
    active = false;
    activeMode = null;
    setActiveButton(null);
    if (machine && runtime) resetMachine();
    character.stopAnimation?.();
    if (restoreMountCalibration && weaponObject3d) {
      applyMountCalibration(weaponObject3d, restoreMountCalibration);
      weaponObject3d.updateMatrixWorld?.(true);
    }
    restoreMountCalibration = null;
    if (options.restoreEvaluation !== false) applyCurrentEvaluation();
    if (!options.quiet) setStatus('G3.4 ready · choose a Guard runtime preview');
  }

  document.querySelectorAll('[data-guard-runtime]').forEach((button) => {
    button.addEventListener('click', () => {
      start(button.dataset.guardRuntime).catch((error) => setStatus(error.message, true));
    });
  });

  document.addEventListener('pointerdown', (event) => {
    if (!active) return;
    if (event.target.closest?.('[data-guard-runtime], #guardRuntimePanel, .stage-shell')) return;
    deactivate({ quiet: true });
  }, true);

  function frame(now) {
    const deltaMs = Math.min(50, Math.max(0, now - lastFrameAt));
    lastFrameAt = now;
    if (active && runtime) {
      try {
        lastResult = runtime.update(deltaMs);
        updateReadout(lastResult);
      } catch (error) {
        setStatus(`Guard Runtime stopped · ${error.message}`, true);
        deactivate({ quiet: true });
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if (typeof window !== 'undefined') {
    window.__ACTION_STUDIO_GUARD_RUNTIME__ = {
      start,
      deactivate,
      get active() { return active; },
      get mode() { return activeMode; },
      get snapshot() { return machine?.snapshot || null; },
      get report() { return lastResult?.report || null; },
      get ready() { return loaded; },
    };
  }

  return Object.freeze({
    start,
    deactivate,
    get active() { return active; },
    get mode() { return activeMode; },
    get snapshot() { return machine?.snapshot || null; },
    get report() { return lastResult?.report || null; },
    get ready() { return loaded; },
  });
}
