import test from 'node:test';
import assert from 'node:assert/strict';
import { createKayKitAnimationController } from '../src/animation/kaykit-animation-library.js';

class FakeAction {
  constructor(clip) {
    this.clip = clip;
    this.enabled = false;
    this.paused = false;
    this.time = 0;
    this.clampWhenFinished = false;
  }
  getClip() { return this.clip; }
  reset() { this.time = 0; return this; }
  setEffectiveWeight() { return this; }
  setEffectiveTimeScale() { return this; }
  setLoop() { return this; }
  play() { return this; }
  stop() { return this; }
  fadeIn() { return this; }
  fadeOut() { return this; }
}

class FakeMixer {
  constructor() {
    this.setTimeCalls = [];
    this.updateCalls = [];
    this.actions = new Map();
  }
  clipAction(clip) {
    if (!this.actions.has(clip.name)) this.actions.set(clip.name, new FakeAction(clip));
    return this.actions.get(clip.name);
  }
  stopAllAction() {}
  uncacheAction() {}
  setTime(value) {
    this.setTimeCalls.push(value);
    for (const action of this.actions.values()) action.time = value;
  }
  update(value) { this.updateCalls.push(value); }
}

const THREE = {
  AnimationMixer: FakeMixer,
  LoopRepeat: 'repeat',
  LoopOnce: 'once',
};

function clip(name) {
  return {
    name,
    duration: 2,
    tracks: [{ name: 'chest.quaternion' }],
    clone() {
      return {
        name: this.name,
        duration: this.duration,
        tracks: [...this.tracks],
        resetDuration() {},
      };
    },
  };
}

test('external KayKit sample re-evaluates the same action and same timestamp absolutely', () => {
  const controller = createKayKitAnimationController(THREE, {});
  controller.register(new Map([['guard', clip('guard')]]));

  controller.sample('guard', 1, { inPlace: true, loop: false });
  controller.sample('guard', 1, { inPlace: true, loop: false });
  controller.sample('guard', 1.25, { inPlace: true, loop: false });

  assert.deepEqual(controller.mixer.setTimeCalls, [1, 1, 1.25]);
  assert.deepEqual(controller.mixer.updateCalls, []);
  assert.equal(controller.currentClipName, 'guard');
});
