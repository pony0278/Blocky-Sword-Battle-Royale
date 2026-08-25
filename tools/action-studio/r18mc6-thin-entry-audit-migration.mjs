import fs from 'node:fs';

const entryPath = 'tools/action-studio/shield-driven-contact-coupling-lab-r281.js';
const packagePath = 'package.json';
let source = fs.readFileSync(entryPath, 'utf8');

function count(marker) {
  return source.split(marker).length - 1;
}
function requireCount(marker, expected) {
  const actual = count(marker);
  if (actual !== expected) throw new Error(`marker count mismatch for ${marker}: expected ${expected}, got ${actual}`);
}
function removeExact(block, label) {
  if (!source.includes(block)) throw new Error(`missing ${label} block`);
  source = source.replace(block, '');
}

requireCount('step3AOwnsLiveContact()', 4);
requireCount('defenderDeflectReleaseGate()', 3);
requireCount('updateDefenderDeflectReleaseGate()', 1);
requireCount('releaseLiveContactToOldB3()', 1);
requireCount('recordVisibleOldB3Sample(', 1);
requireCount('requestedOutcome()', 2);

removeExact(`function step3AOwnsLiveContact() {\n  return contactHandoffController.ownsLiveContact();\n}\n\n`, 'step3AOwnsLiveContact');
removeExact(`function updateDefenderDeflectReleaseGate() {\n  return contactHandoffController.updateDefenderDeflectReleaseGate();\n}\n\n`, 'updateDefenderDeflectReleaseGate');
removeExact(`function defenderDeflectReleaseGate() {\n  return contactHandoffController.defenderDeflectReleaseGate();\n}\n\n`, 'defenderDeflectReleaseGate');
removeExact(`function releaseLiveContactToOldB3() {\n  return contactHandoffController.releaseLiveContactToOldB3({ selectedDirection });\n}\n\n`, 'releaseLiveContactToOldB3');
removeExact(`function recordVisibleOldB3Sample(combatUpdate) {\n  return contactHandoffController.recordVisibleOldB3Sample(combatUpdate);\n}\n\n`, 'recordVisibleOldB3Sample');
removeExact(`function requestedOutcome() { return selectedMode; }\n`, 'requestedOutcome');

source = source.replaceAll('step3AOwnsLiveContact()', 'contactHandoffController.ownsLiveContact()');
source = source.replaceAll('defenderDeflectReleaseGate()', 'contactHandoffController.defenderDeflectReleaseGate()');
source = source.replace('requestedOutcome: requestedOutcome(),', 'requestedOutcome: selectedMode,');

for (const forbidden of [
  'function step3AOwnsLiveContact()',
  'function updateDefenderDeflectReleaseGate()',
  'function defenderDeflectReleaseGate()',
  'function releaseLiveContactToOldB3()',
  'function recordVisibleOldB3Sample(',
  'function requestedOutcome()',
]) {
  if (source.includes(forbidden)) throw new Error(`wrapper survived migration: ${forbidden}`);
}
for (const required of [
  'function frame(timestamp)',
  "function triggerParryNow(source = 'button')",
  'function dispatchParryInput(source, event = null)',
  'function startAttack(direction = selectedDirection)',
  'function restartAttack(direction = selectedDirection)',
  'function setMode(mode)',
  'function resetExchange()',
  'function resolveContact(snapshot, currentBlade, deltaSeconds)',
  'function forceOldTwoActorB3(direction = selectedDirection)',
]) {
  if (!source.includes(required)) throw new Error(`authority boundary moved unexpectedly: ${required}`);
}
fs.writeFileSync(entryPath, source);

let pkg = fs.readFileSync(packagePath, 'utf8');
const marker = 'tests/shield-parry-r281-startup-debug-facade.test.js tests/shield-sword-hand-contact-coupling.test.js';
if (!pkg.includes(marker)) throw new Error('package C5 test marker missing');
pkg = pkg.replace(
  marker,
  'tests/shield-parry-r281-startup-debug-facade.test.js tests/shield-parry-r281-thin-entry-audit.test.js tests/shield-sword-hand-contact-coupling.test.js',
);
fs.writeFileSync(packagePath, pkg);

console.log('R18M.C6 thin entry audit migration applied.');
