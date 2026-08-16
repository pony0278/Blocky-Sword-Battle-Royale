import test from 'node:test';
import assert from 'node:assert/strict';

import { createStudioExternalAnimationController } from '../tools/action-studio/studio-external-animation-controller.js';

class FakeElement {
  constructor(value = '') {
    this.value = value;
    this.textContent = '';
    this.children = [];
    this.listeners = new Map();
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

test('cached UAL2 playback preserves the clip selected by the author', async () => {
  const ids = [
    'animationPackSource', 'kaykitClip', 'kaykitStatus',
    'loadKayKitAnimations', 'playKayKitAnimation', 'stopKayKitAnimation',
    'bindKayKitAnimation', 'fitKayKitAnimation', 'clearAnimationBinding',
    'clipNow', 'phaseNow',
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement()]));
  elements.animationPackSource.value = 'ual2';
  const previousDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => elements[id],
    createElement: () => new FakeElement(),
  };
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
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
