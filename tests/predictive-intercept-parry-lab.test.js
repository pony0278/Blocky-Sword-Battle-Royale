import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../tools/action-studio/predictive-intercept-parry-lab.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../tools/action-studio/predictive-intercept-parry-lab.html', import.meta.url), 'utf8');

test('G4.3B.5R Lab predicts and starts defender Parry before authoritative contact', () => {
  assert.match(source, /analyzePredictiveInterceptParry\(/);
  assert.match(source, /predictivePresentation\.start\(/);
  assert.match(source, /function updateContact\(/);
  assert.ok(
    source.indexOf('updatePredictiveParry(snapshot, currentBlade, deltaSeconds);')
      < source.indexOf('updateContact(snapshot, currentBlade, deltaSeconds);'),
    'predictive Parry must run before physical contact resolution in each frame',
  );
});

test('G4.3B.5R Lab uses the 18cm Parry tracking profile instead of the old 7cm fine Guard cap', () => {
  assert.match(source, /planGuardThreatCorrection\(\{\s*mode: 'parry'/s);
  assert.match(html, /Parry tracking envelope<\/span><b>max 0\.18 m<\/b>/);
  assert.doesNotMatch(source, /maxCorrectionMeters:\s*0\.07/);
});

test('G4.3B.5R Lab keeps real swept geometry as authoritative outcome gate', () => {
  assert.match(source, /probeSweptSwordBucklerContact\(/);
  assert.match(source, /if \(!latestContact\.contact\) return;/);
  assert.ok(
    source.indexOf('if (!latestContact.contact) return;')
      < source.indexOf('latestCombatResult = combat.resolveContact({'),
    'combat outcome must not resolve until real contact exists',
  );
});

test('G4.3B.5R hands predictive pose to Guard authority in the same render frame', () => {
  assert.match(source, /predictivePresentation\.handoff\(\)/);
  assert.match(source, /guardReport = guardRuntime\.sync\(camera\);/);
  assert.match(source, /presentationOffsetSeconds:\s*0\.35/);
  assert.match(source, /parryAttackerRecoilDelayMs:\s*0/);
  assert.match(source, /perfectParryAttackerRecoilDelayMs:\s*0/);
});

test('G4.3B.5R failed or absent predictive input falls back to Guard Block instead of contact-time Parry', () => {
  assert.match(source, /const guardIntentAgeMs = predictiveIntentAgeMs \?\? BLOCK_INTENT_AGE_MS;/);
  assert.equal((source.match(/combat\.resolveContact\(/g) || []).length, 1);
});
