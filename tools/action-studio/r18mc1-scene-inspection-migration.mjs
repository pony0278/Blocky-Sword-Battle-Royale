import fs from 'node:fs';

const entryPath = 'tools/action-studio/shield-driven-contact-coupling-lab-r281.js';
const packagePath = 'package.json';
const legacyCameraTestPath = 'tests/shield-sword-hand-contact-coupling-lab.test.js';
let entry = fs.readFileSync(entryPath, 'utf8');

function replaceExact(text, before, after, label) {
  const first = text.indexOf(before);
  if (first < 0) throw new Error(`${label}: marker not found`);
  if (text.indexOf(before, first + before.length) >= 0) throw new Error(`${label}: marker is not unique`);
  return `${text.slice(0, first)}${after}${text.slice(first + before.length)}`;
}

const oldImports = `import { createDefaultCharacter } from '../../src/character/default-character.js';\nimport { createFreeInspectionCameraControls } from './free-inspection-camera-controls.js?v=g43b5r281-residual-body-reach-r18';\nimport { createDebugSword, mountDebugSword } from '../../src/character/debug-sword.js';\nimport { DEFAULT_KAYKIT_SWORD_MOUNT } from '../../src/character/default-character-mount.js';\nimport { createProceduralBuckler, mountOffhandBuckler } from '../../src/character/offhand-buckler.js';\nimport {\n  ACCEPTED_OFFHAND_BUCKLER_MOUNT_G423,\n  ACCEPTED_OFFHAND_BUCKLER_SHAPE_G423,\n} from '../../src/character/offhand-buckler-accepted-calibration.js';\n`;
const newImports = `import { createDebugSword, mountDebugSword } from '../../src/character/debug-sword.js';\nimport { DEFAULT_KAYKIT_SWORD_MOUNT } from '../../src/character/default-character-mount.js';\n`;
entry = replaceExact(entry, oldImports, newImports, 'scene dependency imports');

const controllerImport = `import { createShieldParryContactHandoffController } from './shield-parry-r281/contact-handoff-controller.js';\n`;
entry = replaceExact(entry, controllerImport, `${controllerImport}import { createShieldParryLabScene } from './shield-parry-r281/lab-scene.js';\nimport { createShieldParryInspectionOverlay } from './shield-parry-r281/inspection-overlay.js';\n`, 'composition imports');

const sceneStart = `const canvas = document.getElementById('canvas');\n`;
const sceneEnd = `const currentWristGripLine = createInspectionLine(0xc58cff);\n`;
const startIndex = entry.indexOf(sceneStart);
const endIndex = entry.indexOf(sceneEnd, startIndex);
if (startIndex < 0 || endIndex < 0) throw new Error('scene bootstrap block markers not found');
const afterSceneEnd = endIndex + sceneEnd.length;
const sceneReplacement = `const labScene = createShieldParryLabScene({ THREE, documentRef: document, windowRef: window });\nconst {\n  canvas, renderer, scene, camera, freeCamera, attacker, defender, attackerSword, buckler, resize, setView,\n} = labScene;\nconst inspectionOverlay = createShieldParryInspectionOverlay({ THREE, scene });\nlet defenderSword = null;\n`;
entry = `${entry.slice(0, startIndex)}${sceneReplacement}${entry.slice(afterSceneEnd)}`;

const overlayStart = `function setInspectionLine(line, start, end) {\n`;
const overlayEnd = `function enterGuard() {\n`;
const overlayStartIndex = entry.indexOf(overlayStart);
const overlayEndIndex = entry.indexOf(overlayEnd, overlayStartIndex);
if (overlayStartIndex < 0 || overlayEndIndex < 0) throw new Error('inspection overlay helper block markers not found');
entry = `${entry.slice(0, overlayStartIndex)}${entry.slice(overlayEndIndex)}`;

entry = replaceExact(
  entry,
  `    updateLiveContactMarkers,\n`,
  `    updateLiveContactMarkers: (report) => inspectionOverlay.update(report),\n`,
  'contact controller overlay callback',
);
entry = replaceExact(
  entry,
  `  updateLiveContactMarkers(null);\n`,
  `  inspectionOverlay.clear();\n`,
  'reset overlay clear',
);

for (const forbidden of [
  'new THREE.WebGLRenderer({ canvas, antialias: true })',
  'new THREE.PerspectiveCamera(38, 1, 0.05, 100)',
  'function updateLiveContactMarkers(report)',
  'function resize()',
  'function setView(view)',
]) {
  if (entry.includes(forbidden)) throw new Error(`entry still owns C1 composition token: ${forbidden}`);
}
for (const required of [
  'createShieldParryLabScene({ THREE, documentRef: document, windowRef: window })',
  'createShieldParryInspectionOverlay({ THREE, scene })',
  'function frame(timestamp)',
  "function triggerParryNow(source = 'button')",
  'function resetExchange()',
  'contactHandoffController.updateCombatBeforeGuard',
  'guardRuntime.update(deltaMs, camera)',
  'contactHandoffController.updateDefenderDeflectReleaseGate()',
  'contactHandoffController.updateLiveConstraintAfterGuard',
]) {
  if (!entry.includes(required)) throw new Error(`required authority/composition token missing: ${required}`);
}
fs.writeFileSync(entryPath, entry);

let legacyCameraTest = fs.readFileSync(legacyCameraTestPath, 'utf8');
const cameraReadBlock = `const cameraSource = readFileSync(\n  new URL('../tools/action-studio/free-inspection-camera-controls.js', import.meta.url),\n  'utf8',\n);\n`;
legacyCameraTest = replaceExact(
  legacyCameraTest,
  cameraReadBlock,
  `${cameraReadBlock}const sceneCompositionSource = readFileSync(\n  new URL('../tools/action-studio/shield-parry-r281/lab-scene.js', import.meta.url),\n  'utf8',\n);\n`,
  'legacy camera composition source',
);
legacyCameraTest = replaceExact(
  legacyCameraTest,
  `  assert.match(source, /createFreeInspectionCameraControls/);\n`,
  `  assert.match(sceneCompositionSource, /createFreeInspectionCameraControls/);\n`,
  'legacy free-camera construction assertion',
);
fs.writeFileSync(legacyCameraTestPath, legacyCameraTest);

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const testToken = 'tests/shield-parry-r281-composition-scene.test.js';
if (!pkg.scripts.test.includes(testToken)) {
  const anchor = 'tests/shield-parry-r281-contact-handoff-controller.test.js';
  if (!pkg.scripts.test.includes(anchor)) throw new Error('package test anchor missing');
  pkg.scripts.test = pkg.scripts.test.replace(anchor, `${anchor} ${testToken}`);
}
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`R18M.C1 migration prepared; entry lines=${entry.split('\n').length - 1}`);
