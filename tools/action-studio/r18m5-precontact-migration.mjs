import { readFile, writeFile } from 'node:fs/promises';

const entryPath = 'tools/action-studio/shield-driven-contact-coupling-lab-r281.js';
const controllerPath = 'tools/action-studio/shield-parry-r281/pre-contact-controller.js';
const testPath = 'tests/shield-parry-r281-pre-contact-controller.test.js';
const packagePath = 'package.json';

function countOccurrences(source, needle) {
  let count = 0;
  let index = 0;
  while ((index = source.indexOf(needle, index)) !== -1) {
    count += 1;
    index += needle.length;
  }
  return count;
}

function requireCount(source, needle, expected, label = needle) {
  const actual = countOccurrences(source, needle);
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected} occurrence(s), found ${actual}`);
  }
}

function replaceOnce(source, needle, replacement, label = needle) {
  requireCount(source, needle, 1, label);
  return source.replace(needle, replacement);
}

function indent(source, prefix = '  ') {
  return source.split('\n').map((line) => `${prefix}${line}`).join('\n');
}

function extractFunction(source, signature) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Missing function signature: ${signature}`);
  const braceStart = source.indexOf('{', start);
  if (braceStart < 0) throw new Error(`Missing opening brace for ${signature}`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = braceStart; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (ch === '\'' || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unterminated function: ${signature}`);
}

let entry = await readFile(entryPath, 'utf8');
const originalEntry = entry;
if (entry.includes("./shield-parry-r281/pre-contact-controller.js")) {
  throw new Error('R18M.5 pre-contact controller is already wired; refusing to re-run migration');
}

const blockStartMarker = 'function updateBlockPreContact(snapshot, currentBlade, deltaSeconds) {';
const blockEndMarker = '\nfunction resolveContact(snapshot, currentBlade, deltaSeconds) {';
requireCount(entry, blockStartMarker, 1, 'Block pre-contact function');
requireCount(entry, 'function updateParryPreContact(snapshot, currentBlade, deltaSeconds) {', 1, 'Parry pre-contact function');
requireCount(entry, 'function updatePreContact(snapshot, currentBlade, deltaSeconds) {', 1, 'Pre-contact dispatcher');
requireCount(entry, 'function recordWhiffProbe(snapshot, probe) {', 1, 'Whiff recorder');
requireCount(entry, blockEndMarker, 1, 'Authoritative resolveContact boundary');

const start = entry.indexOf(blockStartMarker);
const end = entry.indexOf(blockEndMarker, start);
if (end <= start) throw new Error('Invalid R18M.5 extraction boundary');
let extracted = entry.slice(start, end).trimEnd();

for (const marker of [
  'planArticulatedImpactBracing({',
  'planFineGuardTracking({',
  'analyzePredictiveInterceptParry({',
  'evaluateCommittedParryInput({',
  'selectReachableParryInterceptTarget({',
  'fineTrackingRuntime.refineMeasuredContact(',
  'residualBodyReachRuntime.update({',
  'residualStanceReachRuntime.update({',
  'sampleActiveShieldLeadMotion({',
  'compactInterceptDriveTraceFrame(',
  'compactInterceptDriveTelemetry(',
]) {
  if (!extracted.includes(marker)) throw new Error(`Extraction block is missing authority marker: ${marker}`);
}
if (extracted.includes('probeSweptSwordBucklerContact(')
  || extracted.includes('parryGate.confirm(')
  || extracted.includes('combat.resolveContact(')
  || extracted.includes('swordGripConstraint.')) {
  throw new Error('Pre-contact extraction boundary crossed into real-contact authority');
}

extracted = replaceOnce(
  extracted,
  blockStartMarker,
  `${blockStartMarker}\n  const { previousBlade, defenderSword } = context;`.replace(
    'function updateBlockPreContact(snapshot, currentBlade, deltaSeconds) {',
    'function updateBlockPreContact(snapshot, currentBlade, deltaSeconds, context) {',
  ),
  'Block function signature migration',
);
extracted = replaceOnce(
  extracted,
  'function updateParryPreContact(snapshot, currentBlade, deltaSeconds) {',
  [
    'function updateParryPreContact(snapshot, currentBlade, deltaSeconds, context) {',
    '  const {',
    '    selectedMode,',
    '    slowReviewChecked,',
    '    previousBlade,',
    '    defenderSword,',
    '    debugStanceProfile,',
    '  } = context;',
  ].join('\n'),
  'Parry function signature migration',
);
extracted = extracted.replaceAll('slowReview.checked', 'slowReviewChecked');
extracted = extracted.replaceAll('DEBUG_MODE', 'debugMode');

const oldDispatcher = [
  'function updatePreContact(snapshot, currentBlade, deltaSeconds) {',
  '  if (!snapshot.action || exchangeState.firstContact) return;',
  "  if (selectedMode === 'block') updateBlockPreContact(snapshot, currentBlade, deltaSeconds);",
  '  else updateParryPreContact(snapshot, currentBlade, deltaSeconds);',
  '}',
].join('\n');
const newDispatcher = [
  'function updatePreContact(snapshot, currentBlade, deltaSeconds) {',
  '  const context = readContext();',
  '  if (!snapshot.action || exchangeState.firstContact) return;',
  "  if (context.selectedMode === 'block') updateBlockPreContact(snapshot, currentBlade, deltaSeconds, context);",
  '  else updateParryPreContact(snapshot, currentBlade, deltaSeconds, context);',
  '}',
].join('\n');
extracted = replaceOnce(extracted, oldDispatcher, newDispatcher, 'Pre-contact dispatcher migration');
extracted = replaceOnce(
  extracted,
  'function recordWhiffProbe(snapshot, probe) {',
  'function recordWhiffProbe(snapshot, probe) {\n  const { selectedMode } = readContext();',
  'Whiff recorder context migration',
);
if (extracted.includes('slowReview.checked') || extracted.includes('DEBUG_MODE')) {
  throw new Error('Dynamic Lab context leaked into extracted controller');
}

const controllerSource = [
  'export function createShieldParryPreContactController({',
  '  exchangeState,',
  '  buckler,',
  '  defender,',
  '  camera,',
  '  bracingRuntime,',
  '  fineTrackingRuntime,',
  '  residualBodyReachRuntime,',
  '  residualStanceReachRuntime,',
  '  predictivePresentation,',
  '  parryGate,',
  '  longswordAttackPhases,',
  '  promptHoldMs,',
  '  debugMode,',
  '  readContext,',
  '  services,',
  '}) {',
  '  const LONGSWORD_ATTACK_PHASES = longswordAttackPhases;',
  '  const PARRY_PROMPT_HOLD_MS = promptHoldMs;',
  '  const {',
  '    cloneSurface,',
  '    magnitude,',
  '    planArticulatedImpactBracing,',
  '    planFineGuardTracking,',
  '    analyzePredictiveInterceptParry,',
  '    evaluateCommittedParryInput,',
  '    measureSweptSwordBucklerClosestApproach,',
  '    selectReachableParryInterceptTarget,',
  '    planGuardThreatCorrection,',
  '    sampleActiveShieldLeadMotion,',
  '    compactInterceptDriveTraceFrame,',
  '    compactInterceptDriveTelemetry,',
  '  } = services;',
  '',
  "  function zeroBracePlan() { return planArticulatedImpactBracing({ mode: 'off' }); }",
  '',
  indent(extracted, '  '),
  '',
  '  return Object.freeze({',
  '    update: updatePreContact,',
  '    recordWhiffProbe,',
  '  });',
  '}',
  '',
].join('\n');

const exchangeImport = [
  'import {',
  '  createShieldParryExchangeState,',
  '  resetShieldParryExchangeState,',
  "} from './shield-parry-r281/exchange-state.js';",
  '',
].join('\n');
entry = entry.slice(0, start) + entry.slice(end);
entry = replaceOnce(
  entry,
  exchangeImport,
  `${exchangeImport}import { createShieldParryPreContactController } from './shield-parry-r281/pre-contact-controller.js';\n\n`,
  'R18M module import insertion',
);

const stateAnchor = 'let reportClockMs = REPORT_INTERVAL_MS;\n';
const controllerWiring = [
  stateAnchor.trimEnd(),
  '',
  'const preContactController = createShieldParryPreContactController({',
  '  exchangeState,',
  '  buckler,',
  '  defender,',
  '  camera,',
  '  bracingRuntime,',
  '  fineTrackingRuntime,',
  '  residualBodyReachRuntime,',
  '  residualStanceReachRuntime,',
  '  predictivePresentation,',
  '  parryGate,',
  '  longswordAttackPhases: LONGSWORD_ATTACK_PHASES,',
  '  promptHoldMs: PARRY_PROMPT_HOLD_MS,',
  '  debugMode: DEBUG_MODE,',
  '  readContext: () => ({',
  '    selectedMode,',
  '    slowReviewChecked: slowReview.checked,',
  '    previousBlade,',
  '    defenderSword,',
  '    debugStanceProfile,',
  '  }),',
  '  services: {',
  '    cloneSurface,',
  '    magnitude,',
  '    planArticulatedImpactBracing,',
  '    planFineGuardTracking,',
  '    analyzePredictiveInterceptParry,',
  '    evaluateCommittedParryInput,',
  '    measureSweptSwordBucklerClosestApproach,',
  '    selectReachableParryInterceptTarget,',
  '    planGuardThreatCorrection,',
  '    sampleActiveShieldLeadMotion,',
  '    compactInterceptDriveTraceFrame,',
  '    compactInterceptDriveTelemetry,',
  '  },',
  '});',
  '',
].join('\n');
entry = replaceOnce(entry, stateAnchor, controllerWiring, 'Pre-contact controller wiring');

entry = replaceOnce(
  entry,
  "function zeroBracePlan() { return planArticulatedImpactBracing({ mode: 'off' }); }\n",
  '',
  'Obsolete entry zeroBracePlan helper',
);
entry = replaceOnce(
  entry,
  'updatePreContact(snapshot, currentBlade, deltaSeconds);',
  'preContactController.update(snapshot, currentBlade, deltaSeconds);',
  'Frame pre-contact delegation',
);
entry = replaceOnce(
  entry,
  'recordWhiffProbe(snapshot, exchangeState.latestContact);',
  'preContactController.recordWhiffProbe(snapshot, exchangeState.latestContact);',
  'Whiff probe delegation',
);

for (const oldOwner of [
  'function updateBlockPreContact(',
  'function updateParryPreContact(',
  'function updatePreContact(',
  'function recordWhiffProbe(',
]) {
  if (entry.includes(oldOwner)) throw new Error(`Entry still owns extracted pre-contact function: ${oldOwner}`);
}

const originalResolve = extractFunction(originalEntry, 'function resolveContact(snapshot, currentBlade, deltaSeconds)');
const migratedResolve = extractFunction(entry, 'function resolveContact(snapshot, currentBlade, deltaSeconds)');
const expectedResolve = originalResolve.replace(
  'recordWhiffProbe(snapshot, exchangeState.latestContact);',
  'preContactController.recordWhiffProbe(snapshot, exchangeState.latestContact);',
);
if (migratedResolve !== expectedResolve) {
  throw new Error('Authoritative resolveContact changed beyond the whiff-recorder delegation');
}
for (const authorityMarker of [
  'exchangeState.latestContact = probeSweptSwordBucklerContact({',
  'parryGate.confirm({ attackSnapshot: snapshot, contact: exchangeState.latestContact })',
  'exchangeState.latestCombatResult = combat.resolveContact({',
  'swordGripConstraint.start({',
  'buildLiveParryOldB3Handoff({',
]) {
  if (!entry.includes(authorityMarker)) throw new Error(`Entry lost contact authority marker: ${authorityMarker}`);
  if (controllerSource.includes(authorityMarker)) throw new Error(`Controller illegally owns contact authority marker: ${authorityMarker}`);
}

const testSource = `import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createShieldParryPreContactController } from '../tools/action-studio/shield-parry-r281/pre-contact-controller.js';

const entry = await readFile(new URL('../tools/action-studio/shield-driven-contact-coupling-lab-r281.js', import.meta.url), 'utf8');
const controller = await readFile(new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url), 'utf8');

test('R18M.5 entry delegates pre-contact orchestration to one controller', () => {
  assert.equal(typeof createShieldParryPreContactController, 'function');
  assert.match(entry, /shield-parry-r281\\/pre-contact-controller\\.js/);
  assert.match(entry, /const preContactController = createShieldParryPreContactController\\(\\{/);
  assert.match(entry, /preContactController\\.update\\(snapshot, currentBlade, deltaSeconds\\);/);
  assert.match(entry, /preContactController\\.recordWhiffProbe\\(snapshot, exchangeState\\.latestContact\\);/);
  assert.doesNotMatch(entry, /function updateBlockPreContact\\(/);
  assert.doesNotMatch(entry, /function updateParryPreContact\\(/);
  assert.doesNotMatch(entry, /function recordWhiffProbe\\(/);
});

test('R18M.5 controller owns the existing Block bracing and fine-tracking path', () => {
  assert.match(controller, /function updateBlockPreContact\\(/);
  assert.match(controller, /planArticulatedImpactBracing\\(\\{/);
  assert.match(controller, /bracingRuntime\\.update\\(bracePlan, deltaSeconds\\)/);
  assert.match(controller, /planFineGuardTracking\\(\\{/);
  assert.match(controller, /fineTrackingRuntime\\.update\\(exchangeState\\.latestFinePlan, deltaSeconds\\)/);
  assert.match(controller, /exchangeState\\.previousShieldLeadSurface = cloneSurface\\(buckler\\.getWorldParrySurface\\(\\)\\)/);
});

test('R18M.5 controller owns predictive/measured Parry intercept and residual reach', () => {
  for (const contract of [
    /analyzePredictiveInterceptParry\\(\\{/,
    /evaluateCommittedParryInput\\(\\{/,
    /selectReachableParryInterceptTarget\\(\\{/,
    /planGuardThreatCorrection\\(\\{/,
    /fineTrackingRuntime\\.refineMeasuredContact\\(/,
    /residualBodyReachRuntime\\.update\\(\\{/,
    /residualStanceReachRuntime\\.update\\(\\{/,
    /sampleActiveShieldLeadMotion\\(\\{/,
    /compactInterceptDriveTraceFrame\\(exchangeState\\.latestInterceptDriveReport\\)/,
  ]) assert.match(controller, contract);
});

test('R18M.5 whiff probing remains diagnostic and real swept contact stays authoritative in entry', () => {
  assert.match(controller, /function recordWhiffProbe\\(snapshot, probe\\)/);
  assert.match(controller, /compactInterceptDriveTelemetry\\(exchangeState\\.latestInterceptDriveReport\\)/);
  assert.doesNotMatch(controller, /probeSweptSwordBucklerContact\\(/);
  assert.doesNotMatch(controller, /parryGate\\.confirm\\(/);
  assert.doesNotMatch(controller, /combat\\.resolveContact\\(/);
  assert.doesNotMatch(controller, /swordGripConstraint\\./);
  assert.doesNotMatch(controller, /buildLiveParryOldB3Handoff\\(/);

  const probeIndex = entry.indexOf('exchangeState.latestContact = probeSweptSwordBucklerContact({');
  const whiffIndex = entry.indexOf('preContactController.recordWhiffProbe(snapshot, exchangeState.latestContact);', probeIndex);
  const confirmIndex = entry.indexOf('parryGate.confirm({ attackSnapshot: snapshot, contact: exchangeState.latestContact })', probeIndex);
  const resolveIndex = entry.indexOf('exchangeState.latestCombatResult = combat.resolveContact({', probeIndex);
  assert.ok(probeIndex >= 0 && whiffIndex > probeIndex && confirmIndex > whiffIndex && resolveIndex > confirmIndex);
});

test('R18M.5 manual timing gate and post-contact handoff authority remain outside the controller', () => {
  assert.match(entry, /exchangeState\\.latestParryInput = parryGate\\.arm\\(\\{/);
  assert.match(entry, /swordGripConstraint\\.start\\(\\{/);
  assert.match(entry, /buildLiveParryOldB3Handoff\\(\\{/);
  assert.match(entry, /continuityBridgeMs: handoff\\.releaseBlendMs/);
  assert.doesNotMatch(controller, /parryGate\\.arm\\(/);
  assert.doesNotMatch(controller, /DEFLECT_IMPULSE|old-b3-handoff|continuityBridgeMs/);
});
`;

let packageJson = await readFile(packagePath, 'utf8');
const packageNeedle = 'tests/shield-parry-r281-exchange-state.test.js tests/shield-sword-hand-contact-coupling.test.js';
const packageReplacement = 'tests/shield-parry-r281-exchange-state.test.js tests/shield-parry-r281-pre-contact-controller.test.js tests/shield-sword-hand-contact-coupling.test.js';
packageJson = replaceOnce(packageJson, packageNeedle, packageReplacement, 'npm test R18M.5 registration');

await writeFile(controllerPath, controllerSource, 'utf8');
await writeFile(testPath, testSource, 'utf8');
await writeFile(entryPath, entry, 'utf8');
await writeFile(packagePath, packageJson, 'utf8');

console.log('R18M.5 migration prepared:');
console.log('- extracted Block/Parry pre-contact orchestration');
console.log('- extracted whiff diagnostic recorder');
console.log('- authoritative resolveContact preserved byte-for-byte except recorder delegation');
console.log('- added R18M.5 contract coverage and npm test registration');
