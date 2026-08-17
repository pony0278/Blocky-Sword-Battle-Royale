import test from 'node:test';
import assert from 'node:assert/strict';

import { createStudioExternalAnimationController } from '../tools/action-studio/studio-external-animation-controller.js';

class FakeElement {
  constructor(value = '') {
    this.value = value;
    this.textContent = '';
    this.children = [];
    this.listeners = new Map();
    this.checked = false;
    this.classList = { toggle() {} };
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this.children = [];
    this.value = '';
  }

  get innerHTML() { return this._innerHTML || ''; }

  appendChild(child) {
    this.children.push(child);
    if (this.children.length === 1) this.value = child.value;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }
}

function installFakeDocument(ids) {
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement()]));
  const previousDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elements[id],
    createElement: () => new FakeElement(),
  };
  return {
    elements,
    restore() {
      if (previousDocument === undefined) delete globalThis.document;
      else globalThis.document = previousDocument;
    },
  };
}

test('cached UAL2 playback preserves the clip selected by the author', async () => {
  const ids = [
    'animationPackSource', 'kaykitClip', 'kaykitStatus',
    'loadKayKitAnimations', 'playKayKitAnimation', 'stopKayKitAnimation',
    'bindKayKitAnimation', 'fitKayKitAnimation', 'clearAnimationBinding',
    'clipNow', 'phaseNow',
  ];
  const { elements, restore } = installFakeDocument(ids);
  elements.animationPackSource.value = 'ual2';
  const played = [];

  try {
    const controller = createStudioExternalAnimationController({
      THREE: {},
      character: {
        rig: { bones: {} },
        playAnimation: (name) => played.push(name),
      },
      getAction: () => ({ animationBinding: { source: 'authored' } }),
      getClip: () => ({ id: 'test', fps: 30, durationFrames: 30 }),
      setBinding() {},
      pausePlayer() {},
      applyCurrentEvaluation() {},
      clearWeaponTrail() {},
      updatePlaybackButtons() {},
      setAnimationSource() {},
      renderBinding() {},
    });
    controller.libraries.set('ual2', {
      clips: new Map([
        ['UAL2/Sword_Regular_A', { duration: 0.433 }],
        ['UAL2/Sword_Regular_B', { duration: 0.533 }],
      ]),
    });
    elements.kaykitClip.value = 'UAL2/Sword_Regular_B';

    await controller.playSelected();

    assert.equal(elements.kaykitClip.value, 'UAL2/Sword_Regular_B');
    assert.deepEqual(played, ['UAL2/Sword_Regular_B']);

    elements.animationPackSource.value = 'ual1';
    controller.libraries.set('ual1', {
      clips: new Map([['UAL1/Sword_Attack', { duration: 1.533 }], ['UAL1/Sword_Idle', { duration: 1.667 }]]),
    });
    elements.kaykitClip.value = 'UAL1/Sword_Idle';
    await controller.playSelected();
    assert.equal(elements.kaykitClip.value, 'UAL1/Sword_Idle');
    assert.deepEqual(played, ['UAL2/Sword_Regular_B', 'UAL1/Sword_Idle']);
  } finally {
    restore();
  }
});

test('Preview + Impact fits the selected external motion and restarts Action playback through its impact marker', async () => {
  const ids = [
    'animationPackSource', 'kaykitClip', 'kaykitStatus',
    'loadKayKitAnimations', 'playKayKitAnimation', 'stopKayKitAnimation',
    'bindKayKitAnimation', 'fitKayKitAnimation', 'clearAnimationBinding',
    'animationBindingSpeed', 'animationBindingOffset', 'animationBindingInPlace', 'animationBindingLoop',
    'clipNow', 'phaseNow',
  ];
  const { elements, restore } = installFakeDocument(ids);
  elements.animationPackSource.value = 'ual2';
  elements.animationBindingSpeed.value = '1';
  elements.animationBindingOffset.value = '0';
  elements.animationBindingInPlace.checked = true;
  elements.animationBindingLoop.checked = false;
  const bindings = [];
  let restartCount = 0;

  try {
    const controller = createStudioExternalAnimationController({
      THREE: {},
      character: { rig: { bones: {} } },
      getAction: () => ({ animationBinding: { source: 'authored' } }),
      getClip: () => ({
        id: 'slash_test',
        fps: 30,
        durationFrames: 30,
        timeline: [
          { name: 'windup', frame: 0 },
          { name: 'contact', frame: 14, impact: true },
          { name: 'recover', frame: 30 },
        ],
      }),
      setBinding: (binding) => bindings.push(binding),
      pausePlayer() {},
      applyCurrentEvaluation() {},
      clearWeaponTrail() {},
      updatePlaybackButtons() {},
      setAnimationSource() {},
      renderBinding() {},
      restartActionPlayback: () => { restartCount += 1; },
    });
    controller.libraries.set('ual2', {
      clips: new Map([
        ['UAL2/Sword_Regular_A', { duration: 0.433 }],
        ['UAL2/Sword_Regular_B', { duration: 0.533 }],
      ]),
    });
    elements.kaykitClip.value = 'UAL2/Sword_Regular_B';

    const binding = await controller.playSelectedWithImpact();

    assert.equal(binding.source, 'ual2');
    assert.equal(binding.clipId, 'UAL2/Sword_Regular_B');
    assert.equal(bindings.length, 1);
    assert.equal(bindings[0].clipId, 'UAL2/Sword_Regular_B');
    assert.equal(restartCount, 1);
    assert.match(elements.kaykitStatus.textContent, /impact preview · Sword_Regular_B/);
    assert.match(elements.kaykitStatus.textContent, /Impact 14f/);
  } finally {
    restore();
  }
});
