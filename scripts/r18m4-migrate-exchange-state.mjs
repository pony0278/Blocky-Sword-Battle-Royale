import { readFile, writeFile } from 'node:fs/promises';
import { parse } from 'acorn';

const entryPath = 'tools/action-studio/shield-driven-contact-coupling-lab-r281.js';
const exchangeKeys = [
  'previousShieldLeadSurface',
  'firstContact',
  'latestContact',
  'latestCombatResult',
  'latestCombatUpdate',
  'latestFinePlan',
  'latestFineTracking',
  'latestPredictiveAnalysis',
  'latestReachableInterceptTarget',
  'latestInterceptDriveReport',
  'interceptDriveTrace',
  'latestPredictiveReport',
  'latestPredictiveHandoff',
  'latestShieldLeadMotion',
  'latestLeadHandoff',
  'directOldB3Diagnostic',
  'latestParryInput',
  'latestParryOpportunity',
  'latestParryConfirmation',
  'frozenAttackerContactPose',
  'canonicalAttackerOldB3Pose',
  'canonicalAttackerOldB3WorldSilhouette',
  'step3AContactTransfer',
  'latestGripConstraintReport',
  'latestLiveSurfaceAtContact',
  'step3AReleaseBlend',
  'visibleOldB3Peak',
  'latchedDefenderDeflectReleaseGate',
  'latestParryWhiff',
  'whiffProbeFrames',
  'closestWhiffApproach',
  'outsideActiveContact',
  'latestInputSignal',
  'parryPromptHold',
  'parryPromptHoldSequence',
];
const exchangeKeySet = new Set(exchangeKeys);

let source = await readFile(entryPath, 'utf8');
if (source.includes("./shield-parry-r281/exchange-state.js")) {
  throw new Error('R18M.4 migration already appears to be applied');
}

const importMarker = "import { createShieldParryLabUi, bindShieldParryLabUiEvents } from './shield-parry-r281/lab-ui.js';\n";
if (!source.includes(importMarker)) throw new Error('lab UI import marker not found');
source = source.replace(importMarker, `${importMarker}import {\n  createShieldParryExchangeState,\n  resetShieldParryExchangeState,\n} from './shield-parry-r281/exchange-state.js';\n`);

for (const key of exchangeKeys) {
  const declarationPattern = new RegExp(`^let ${key.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')} = [^\\n]*;\\n`, 'm');
  const matches = source.match(declarationPattern);
  if (!matches) throw new Error(`expected loose declaration not found for ${key}`);
  source = source.replace(declarationPattern, '');
}

const ownerMarker = 'const parryGate = createCommittedParryContactGate();\n';
if (!source.includes(ownerMarker)) throw new Error('parry gate owner marker not found');
source = source.replace(ownerMarker, `${ownerMarker}const exchangeState = createShieldParryExchangeState();\n`);

const resetFunctionStart = source.indexOf('function resetExchange() {');
if (resetFunctionStart < 0) throw new Error('resetExchange function not found');
const resetStateStart = source.indexOf('  firstContact = null;\n', resetFunctionStart);
const resetStateEndMarker = '  previousShieldLeadSurface = cloneSurface(buckler.getWorldParrySurface());\n';
const resetStateEndStart = source.indexOf(resetStateEndMarker, resetStateStart);
if (resetStateStart < 0 || resetStateEndStart < 0) throw new Error('resetExchange state assignment range not found');
const resetStateEnd = resetStateEndStart + resetStateEndMarker.length;
const centralizedReset = [
  '  resetShieldParryExchangeState(exchangeState, {',
  '    previousShieldLeadSurface: cloneSurface(buckler.getWorldParrySurface()),',
  '  });',
  '  updateLiveContactMarkers(null);',
  '',
].join('\n');
source = source.slice(0, resetStateStart) + centralizedReset + source.slice(resetStateEnd);

function parseSource(text) {
  return parse(text, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    allowHashBang: true,
  });
}

function identifierRoleIsReference(node, parent, key) {
  if (!parent) return true;
  if (parent.type === 'VariableDeclarator' && key === 'id') return false;
  if ((parent.type === 'FunctionDeclaration' || parent.type === 'FunctionExpression') && key === 'id') return false;
  if ((parent.type === 'FunctionDeclaration' || parent.type === 'FunctionExpression' || parent.type === 'ArrowFunctionExpression')
    && key === 'params') return false;
  if (parent.type === 'CatchClause' && key === 'param') return false;
  if (parent.type === 'MemberExpression' && key === 'property' && !parent.computed) return false;
  if ((parent.type === 'Property' || parent.type === 'PropertyDefinition' || parent.type === 'MethodDefinition')
    && key === 'key' && !parent.computed) return false;
  if (parent.type === 'Property' && parent.shorthand && key === 'value') return true;
  if (parent.type === 'ImportSpecifier' || parent.type === 'ImportDefaultSpecifier' || parent.type === 'ImportNamespaceSpecifier') return false;
  if (parent.type === 'ExportSpecifier') return false;
  if (parent.type === 'LabeledStatement' && key === 'label') return false;
  if ((parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') && key === 'label') return false;
  if (parent.type === 'MetaProperty') return false;
  return true;
}

const ast = parseSource(source);
const replacements = new Map();

function visit(value, parent = null, key = null) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) visit(item, parent, key);
    return;
  }
  if (typeof value !== 'object') return;
  if (value.type === 'Identifier' && exchangeKeySet.has(value.name)) {
    if (identifierRoleIsReference(value, parent, key)) {
      const replacement = parent?.type === 'Property' && parent.shorthand && key === 'value'
        ? `${value.name}: exchangeState.${value.name}`
        : `exchangeState.${value.name}`;
      const id = `${value.start}:${value.end}`;
      const existing = replacements.get(id);
      if (existing && existing.text !== replacement) {
        throw new Error(`conflicting replacement for ${value.name} at ${id}`);
      }
      replacements.set(id, { start: value.start, end: value.end, text: replacement });
    }
  }
  for (const [childKey, childValue] of Object.entries(value)) {
    if (['start', 'end', 'loc', 'range', 'type'].includes(childKey)) continue;
    if (childValue && typeof childValue === 'object') visit(childValue, value, childKey);
  }
}
visit(ast);

const ordered = [...replacements.values()].sort((a, b) => b.start - a.start);
for (const edit of ordered) {
  source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
}

parseSource(source);

if (!source.includes('const exchangeState = createShieldParryExchangeState();')) {
  throw new Error('exchange state owner was not installed');
}
if (!source.includes('resetShieldParryExchangeState(exchangeState, {')) {
  throw new Error('resetExchange was not centralized');
}
for (const key of exchangeKeys) {
  if (new RegExp(`\\blet\\s+${key}\\b`).test(source)) {
    throw new Error(`loose exchange declaration survived migration: ${key}`);
  }
  if (!source.includes(`exchangeState.${key}`)) {
    throw new Error(`exchange owner has no reference for ${key}`);
  }
}
for (const persistentName of [
  'ready', 'selectedDirection', 'selectedMode', 'lastTimestamp', 'attackerIdleDuration',
  'attackerIdleClockSeconds', 'attackerRecovery', 'repeatCooldownMs', 'previousBlade',
  'hudClockMs', 'reportClockMs',
]) {
  if (!new RegExp(`\\blet\\s+${persistentName}\\b`).test(source)) {
    throw new Error(`persistent lab/runtime state was unexpectedly migrated: ${persistentName}`);
  }
}

await writeFile(entryPath, source);
console.log(`R18M.4 migrated ${exchangeKeys.length} exchange fields with ${ordered.length} reference edits.`);
