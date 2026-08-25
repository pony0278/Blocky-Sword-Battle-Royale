import fs from 'node:fs';

const entryPath = 'tools/action-studio/shield-driven-contact-coupling-lab-r281.js';
const packagePath = 'package.json';
const bootstrapPath = 'tools/action-studio/shield-parry-r281/lab-bootstrap.js';
const debugApiPath = 'tools/action-studio/shield-parry-r281/debug-api.js';

let source = fs.readFileSync(entryPath, 'utf8');

const removedStartupImports = [
  "import { createDebugSword, mountDebugSword } from '../../src/character/debug-sword.js';\n",
  "import { DEFAULT_KAYKIT_SWORD_MOUNT } from '../../src/character/default-character-mount.js';\n",
  "import { loadUal1AnimationLibrary } from '../../src/animation/ual1-animation-library.js';\n",
  "import { loadUal2AnimationLibrary } from '../../src/animation/ual2-animation-library.js';\n",
  "import { loadSkyrimConvertedAnimationLibrary } from '../../src/animation/skyrim-converted-animation-library.js';\n",
  "import { composeSkyrimWeaponMountCalibration } from '../../src/animation/skyrim-weapon-bind-calibration.js';\n",
];
for (const marker of removedStartupImports) {
  if (!source.includes(marker)) throw new Error(`missing startup import marker: ${marker.trim()}`);
  source = source.replace(marker, '');
}

const localImportMarker = "import { createDirectOldB3DiagnosticController } from './shield-parry-r281/direct-old-b3-diagnostic.js';\n";
if (!source.includes(localImportMarker)) throw new Error('missing C4 local import marker');
source = source.replace(
  localImportMarker,
  `${localImportMarker}import { bootstrapShieldParryLabAssets } from './shield-parry-r281/lab-bootstrap.js';\nimport { createShieldParryDebugApi } from './shield-parry-r281/debug-api.js';\n`,
);

const startupBlock = `  const [ual1, ual2, skyrim] = await Promise.all([\n    loadUal1AnimationLibrary(new THREE.GLTFLoader(), { THREE, rig: attacker.rig, fps: 30 }),\n    loadUal2AnimationLibrary(new THREE.GLTFLoader(), { THREE, rig: attacker.rig, fps: 30 }),\n    loadSkyrimConvertedAnimationLibrary(new THREE.GLTFLoader(), { THREE, rig: defender.rig, fps: 30 }),\n  ]);\n  attacker.registerAnimations(ual1); attacker.registerAnimations(ual2); defender.registerAnimations(skyrim);\n  attackerIdleDuration = attacker.getAnimationDuration('UAL1/Sword_Idle') || 1;\n  const idle = skyrim.clips.get('SKYRIM_GUARD/shd_blockidle');\n  const bind = idle?.userData?.weaponBindCalibration;\n  if (!bind?.correctionQuaternion) throw new Error(\`${'${LAB_STAGE}'} requires Skyrim Guard weapon bind calibration\`);\n  defenderSword = createDebugSword(THREE);\n  mountDebugSword(defender, defenderSword, composeSkyrimWeaponMountCalibration(THREE, DEFAULT_KAYKIT_SWORD_MOUNT, bind));\n`;
if ((source.match(/loadUal1AnimationLibrary/g) || []).length !== 1) throw new Error('unexpected UAL1 loader count before migration');
if (!source.includes(startupBlock)) throw new Error('startup block marker mismatch');
source = source.replace(startupBlock, `  const bootstrap = await bootstrapShieldParryLabAssets({\n    THREE,\n    attacker,\n    defender,\n    labStage: LAB_STAGE,\n  });\n  attackerIdleDuration = bootstrap.attackerIdleDuration;\n  defenderSword = bootstrap.defenderSword;\n`);

const facadeStart = source.indexOf('window.__G43B5R281_LAB__ = {');
if (facadeStart < 0) throw new Error('debug facade start marker missing');
const facadeTail = source.slice(facadeStart);
if (!facadeTail.trimEnd().endsWith('};')) throw new Error('debug facade is not the entry tail');
source = source.slice(0, facadeStart) + `window.__G43B5R281_LAB__ = createShieldParryDebugApi({\n  actions: {\n    startAttack,\n    restartAttack,\n    setMode,\n    refreshDebugStanceProfile,\n    resetDebugStanceDefaults,\n    triggerParryNow,\n    dispatchParryInput,\n    forceOldTwoActorB3,\n  },\n  runtimes: {\n    combat,\n    attackRuntime,\n    guardMachine,\n    predictivePresentation,\n    parryGate,\n    freeCamera,\n    residualBodyReachRuntime,\n    residualStanceReachRuntime,\n    swordGripConstraint,\n  },\n  debugMode: DEBUG_MODE,\n  getDebugStanceProfile: () => debugStanceProfile,\n  getExchangeState: () => exchangeState,\n});\n`;

const bootstrapSource = `// R18M.C5 — startup asset loading and defender weapon-bind initialization only.\n// Ready state, Guard entry, initial report, and initial attack ordering stay in the R281 entry.\n\nimport { createDebugSword, mountDebugSword } from '../../src/character/debug-sword.js';\nimport { DEFAULT_KAYKIT_SWORD_MOUNT } from '../../src/character/default-character-mount.js';\nimport { loadUal1AnimationLibrary } from '../../src/animation/ual1-animation-library.js';\nimport { loadUal2AnimationLibrary } from '../../src/animation/ual2-animation-library.js';\nimport { loadSkyrimConvertedAnimationLibrary } from '../../src/animation/skyrim-converted-animation-library.js';\nimport { composeSkyrimWeaponMountCalibration } from '../../src/animation/skyrim-weapon-bind-calibration.js';\n\nexport async function bootstrapShieldParryLabAssets({ THREE, attacker, defender, labStage }) {\n  const [ual1, ual2, skyrim] = await Promise.all([\n    loadUal1AnimationLibrary(new THREE.GLTFLoader(), { THREE, rig: attacker.rig, fps: 30 }),\n    loadUal2AnimationLibrary(new THREE.GLTFLoader(), { THREE, rig: attacker.rig, fps: 30 }),\n    loadSkyrimConvertedAnimationLibrary(new THREE.GLTFLoader(), { THREE, rig: defender.rig, fps: 30 }),\n  ]);\n  attacker.registerAnimations(ual1);\n  attacker.registerAnimations(ual2);\n  defender.registerAnimations(skyrim);\n\n  const attackerIdleDuration = attacker.getAnimationDuration('UAL1/Sword_Idle') || 1;\n  const idle = skyrim.clips.get('SKYRIM_GUARD/shd_blockidle');\n  const bind = idle?.userData?.weaponBindCalibration;\n  if (!bind?.correctionQuaternion) throw new Error(\`${'${labStage}'} requires Skyrim Guard weapon bind calibration\`);\n\n  const defenderSword = createDebugSword(THREE);\n  mountDebugSword(\n    defender,\n    defenderSword,\n    composeSkyrimWeaponMountCalibration(THREE, DEFAULT_KAYKIT_SWORD_MOUNT, bind),\n  );\n\n  return Object.freeze({ attackerIdleDuration, defenderSword });\n}\n`;

const debugApiSource = `// R18M.C5 — debug facade composition only.\n// This module exposes injected actions/runtimes and read-only exchange getters; it owns no gameplay authority.\n\nexport function createShieldParryDebugApi({\n  actions,\n  runtimes,\n  debugMode,\n  getDebugStanceProfile,\n  getExchangeState,\n}) {\n  return {\n    startAttack: actions.startAttack,\n    restartAttack: actions.restartAttack,\n    setMode: actions.setMode,\n    combat: runtimes.combat,\n    attackRuntime: runtimes.attackRuntime,\n    guardMachine: runtimes.guardMachine,\n    predictivePresentation: runtimes.predictivePresentation,\n    parryGate: runtimes.parryGate,\n    freeCamera: runtimes.freeCamera,\n    residualBodyReachRuntime: runtimes.residualBodyReachRuntime,\n    residualStanceReachRuntime: runtimes.residualStanceReachRuntime,\n    debugMode,\n    get debugStanceProfile() { return Object.freeze({ ...getDebugStanceProfile() }); },\n    refreshDebugStanceProfile: actions.refreshDebugStanceProfile,\n    resetDebugStanceDefaults: actions.resetDebugStanceDefaults,\n    swordGripConstraint: runtimes.swordGripConstraint,\n    triggerParryNow: actions.triggerParryNow,\n    dispatchParryInput: actions.dispatchParryInput,\n    forceOldTwoActorB3: actions.forceOldTwoActorB3,\n    get directOldB3Diagnostic() { return getExchangeState().directOldB3Diagnostic; },\n    get latestPredictiveReport() { return getExchangeState().latestPredictiveReport; },\n    get latestShieldLeadMotion() { return getExchangeState().latestShieldLeadMotion; },\n    get latestLeadHandoff() { return getExchangeState().latestLeadHandoff; },\n    get latestCombatResult() { return getExchangeState().latestCombatResult; },\n    get latestParryInput() { return getExchangeState().latestParryInput; },\n    get latestParryOpportunity() { return getExchangeState().latestParryOpportunity; },\n    get latestParryConfirmation() { return getExchangeState().latestParryConfirmation; },\n    get step3AContactTransfer() { return getExchangeState().step3AContactTransfer; },\n    get latestGripConstraintReport() { return getExchangeState().latestGripConstraintReport; },\n    get latestParryWhiff() { return getExchangeState().latestParryWhiff; },\n    get latestInterceptDriveReport() { return getExchangeState().latestInterceptDriveReport; },\n    get latestInputSignal() { return getExchangeState().latestInputSignal; },\n  };\n}\n`;

fs.writeFileSync(entryPath, source);
fs.writeFileSync(bootstrapPath, bootstrapSource);
fs.writeFileSync(debugApiPath, debugApiSource);

let pkg = fs.readFileSync(packagePath, 'utf8');
const packageMarker = 'tests/shield-parry-r281-direct-old-b3-diagnostic.test.js tests/shield-sword-hand-contact-coupling.test.js';
if (!pkg.includes(packageMarker)) throw new Error('package test marker missing');
pkg = pkg.replace(
  packageMarker,
  'tests/shield-parry-r281-direct-old-b3-diagnostic.test.js tests/shield-parry-r281-startup-debug-facade.test.js tests/shield-sword-hand-contact-coupling.test.js',
);
fs.writeFileSync(packagePath, pkg);

console.log('R18M.C5 startup/debug facade migration applied.');
