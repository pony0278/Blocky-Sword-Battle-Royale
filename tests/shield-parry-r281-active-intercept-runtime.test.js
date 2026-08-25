import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPredictiveInterceptParryPresentationRuntime } from '../src/combat/predictive-intercept-parry.js';

const entry = await readFile(new URL('../tools/action-studio/shield-driven-contact-coupling-lab-r281.js', import.meta.url), 'utf8');
const preContact = await readFile(new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url), 'utf8');
const exchangeState = await readFile(new URL('../tools/action-studio/shield-parry-r281/exchange-state.js', import.meta.url), 'utf8');

class FakeQuaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) { this.set(x, y, z, w); }
  set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
  clone() { return new FakeQuaternion(this.x, this.y, this.z, this.w); }
  copy(other) { return this.set(other.x, other.y, other.z, other.w); }
  normalize() {
    const size = Math.hypot(this.x, this.y, this.z, this.w) || 1;
    this.x /= size; this.y /= size; this.z /= size; this.w /= size;
    return this;
  }
  slerp(other, alpha) {
    let bx = other.x; let by = other.y; let bz = other.z; let bw = other.w;
    if (this.x * bx + this.y * by + this.z * bz + this.w * bw < 0) {
      bx *= -1; by *= -1; bz *= -1; bw *= -1;
    }
    return this.set(
      this.x + (bx - this.x) * alpha,
      this.y + (by - this.y) * alpha,
      this.z + (bz - this.z) * alpha,
      this.w + (bw - this.w) * alpha,
    ).normalize();
  }
}

function yaw(degrees) {
  const radians = degrees * Math.PI / 180;
  return new FakeQuaternion(0, Math.sin(radians / 2), 0, Math.cos(radians / 2));
}

function angleDegrees(quaternion) {
  return 2 * Math.acos(Math.min(1, Math.abs(quaternion.clone().normalize().w))) * 180 / Math.PI;
}

test('R18N.1 keeps manual Parry authority in the entry and only latches intent after accepted F', () => {
  assert.match(entry, /latestParryInput = parryGate\.arm\(\{[\s\S]*manual: true,/);
  assert.match(entry, /if \(exchangeState\.latestParryInput\.accepted\) \{[\s\S]*preContactController\.armActiveIntercept\(snapshot\);/);
  assert.match(entry, /function resetExchange\(\) \{[\s\S]*preContactController\.resetActiveIntercept\(\);/);
  assert.ok(entry.split('\n').length <= 725, 'R281 entry must stay inside the C6 725-line ceiling');
  assert.doesNotMatch(exchangeState, /activeParryInterceptIntent|activeInterceptIntent/);
});

test('R18N.1 makes the F-latched intent the primary shield drive without moving contact authority', () => {
  assert.match(preContact, /activeInterceptIntent\?\.plan\(\{/);
  assert.match(preContact, /exchangeState\.latestFinePlan = activeIntentPlan \|\|/);
  assert.match(preContact, /drivePlanSource: activeIntentPlan/);
  assert.match(preContact, /function armActiveIntercept\(snapshot\)/);
  assert.match(preContact, /function resetActiveIntercept\(\)/);
  assert.doesNotMatch(preContact, /parryGate\.arm\(/);
  assert.doesNotMatch(preContact, /parryGate\.confirm\(/);
  assert.doesNotMatch(preContact, /combat\.resolveContact\(/);
  assert.doesNotMatch(preContact, /probeSweptSwordBucklerContact\(/);
});

test('R18N.1 blends the first Guard-to-Parry shield-arm frames instead of teleporting to the sampled pose', () => {
  const bones = Object.fromEntries(
    ['spine', 'chest', 'upperarm.l', 'lowerarm.l', 'wrist.l']
      .map((name) => [name, { quaternion: new FakeQuaternion() }]),
  );
  const target = yaw(90);
  const character = {
    rig: { bones },
    sampleAnimation() {
      for (const bone of Object.values(bones)) bone.quaternion.copy(target);
    },
    getAnimationDuration() { return 1; },
    update() {},
  };
  const runtime = createPredictiveInterceptParryPresentationRuntime(
    { Quaternion: FakeQuaternion },
    { character, guardOffsets: {} },
  );
  assert.equal(runtime.start({ sequence: 1, requestedGrade: 'parry', triggerTtcSeconds: 0.12 }).accepted, true);
  const first = runtime.update({ deltaSeconds: 0.01, timeToContactSeconds: 0.11 });
  const firstAngle = angleDegrees(bones['upperarm.l'].quaternion);
  assert.ok(first.entryBlendProgress > 0 && first.entryBlendProgress < 1);
  assert.ok(firstAngle > 0 && firstAngle < 90, `expected blended first-frame arm angle, got ${firstAngle}`);

  runtime.update({ deltaSeconds: 0.02, timeToContactSeconds: 0.09 });
  runtime.update({ deltaSeconds: 0.02, timeToContactSeconds: 0.07 });
  const settled = runtime.update({ deltaSeconds: 0.02, timeToContactSeconds: 0.05 });
  assert.equal(settled.entryBlendProgress, 1);
  assert.ok(angleDegrees(bones['upperarm.l'].quaternion) > firstAngle);
});

test('R18N.1 presentation continuity remains presentation-only', async () => {
  const source = await readFile(new URL('../src/combat/predictive-intercept-parry.js', import.meta.url), 'utf8');
  assert.match(source, /PREDICTIVE_PARRY_ENTRY_BLEND_SECONDS/);
  assert.match(source, /entryBlendProgress/);
  assert.doesNotMatch(source, /probeSweptSwordBucklerContact|combat\.resolveContact|parryGate\.confirm/);
});
