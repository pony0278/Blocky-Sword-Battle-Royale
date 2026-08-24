import { readFile, writeFile, mkdir } from 'node:fs/promises';

const entryPath = 'tools/action-studio/shield-driven-contact-coupling-lab-r281.js';
const moduleDir = 'tools/action-studio/shield-parry-r281';
const packagePath = 'package.json';
const testPath = 'tests/shield-parry-r281-ui.test.js';

let source = await readFile(entryPath, 'utf8');

function requireMarker(text, marker) {
  const index = text.indexOf(marker);
  if (index < 0) throw new Error(`R18M.3 marker not found: ${marker}`);
  return index;
}

function replaceRange(text, startMarker, endMarker, replacement) {
  const start = requireMarker(text, startMarker);
  const end = requireMarker(text.slice(start), endMarker) + start;
  if (end <= start) throw new Error(`R18M.3 invalid range: ${startMarker} -> ${endMarker}`);
  return text.slice(0, start) + replacement + text.slice(end);
}

const alreadyApplied = source.includes("./shield-parry-r281/lab-ui.js");

const domModule = `// R18M.3 — DOM lookup only. No gameplay/runtime authority lives here.\n\nconst REQUIRED_IDS = Object.freeze([\n  'hudAttack',\n  'hudInput',\n  'parryCue',\n  'parryCueMain',\n  'parryCueDetail',\n  'hudContact',\n  'hudCoupling',\n  'hudShield',\n  'hudWeapon',\n  'hudSeparation',\n  'hudLineClearance',\n  'hudRecoil',\n  'hudDiagnostic',\n  'status',\n  'report',\n  'autoRepeat',\n  'slowReview',\n  'showSurface',\n  'forceOldB3',\n  'parryNow',\n  'retryAttack',\n  'stanceDebugPanel',\n  'debugProfileSummary',\n  'debugApplyRetry',\n  'debugResetDefaults',\n]);\n\nexport function createShieldParryLabDom(documentRef) {\n  const elements = {};\n  for (const id of REQUIRED_IDS) {\n    const element = documentRef.getElementById(id);\n    if (!element) throw new Error(\`R18M.3 missing required lab element #\${id}\`);\n    const key = id === 'report' ? 'reportNode' : id;\n    elements[key] = element;\n  }\n  return Object.freeze(elements);\n}\n\nexport { REQUIRED_IDS as SHIELD_PARRY_LAB_REQUIRED_DOM_IDS };\n`;

const stanceModule = `// R18M.3 — stance debug UI/query controller.\n// This controller mutates only debug presentation guidance values and DOM/query state.\n\nexport function createStanceDebugController({\n  documentRef,\n  windowRef,\n  debugMode,\n  debugQuery,\n  profileDefaults,\n  elements,\n}) {\n  const controls = Object.freeze([\n    Object.freeze({ id: 'debugLeadMs', query: 'leadMs', profileKey: 'anticipatoryLeadMaxSeconds', scale: 0.001, defaultValue: profileDefaults.anticipatoryLeadMaxSeconds * 1000, precision: 0, unit: 'ms' }),\n    Object.freeze({ id: 'debugMaxCrouchCm', query: 'crouchCm', profileKey: 'maxCrouchMeters', scale: 0.01, defaultValue: profileDefaults.maxCrouchMeters * 100, precision: 1, unit: 'cm' }),\n    Object.freeze({ id: 'debugCrouchSpeed', query: 'crouchSpeed', profileKey: 'crouchSpeedMps', scale: 1, defaultValue: profileDefaults.crouchSpeedMps, precision: 2, unit: 'm/s' }),\n    Object.freeze({ id: 'debugEdgeCm', query: 'edgeCm', profileKey: 'edgeActivationMeters', scale: 0.01, defaultValue: profileDefaults.edgeActivationMeters * 100, precision: 1, unit: 'cm' }),\n    Object.freeze({ id: 'debugPlaneCm', query: 'planeCm', profileKey: 'kneeThreatPlaneMeters', scale: 0.01, defaultValue: profileDefaults.kneeThreatPlaneMeters * 100, precision: 1, unit: 'cm' }),\n    Object.freeze({ id: 'debugLowGapCm', query: 'lowGapCm', profileKey: 'lowGapVerticalActivationMeters', scale: 0.01, defaultValue: profileDefaults.lowGapVerticalActivationMeters * 100, precision: 1, unit: 'cm' }),\n    Object.freeze({ id: 'debugDownRatio', query: 'downRatio', profileKey: 'kneeThreatDownRatio', scale: 1, defaultValue: profileDefaults.kneeThreatDownRatio, precision: 2, unit: '' }),\n    Object.freeze({ id: 'debugKneeBandCm', query: 'kneeBandCm', profileKey: 'kneeLineBandMeters', scale: 0.01, defaultValue: profileDefaults.kneeLineBandMeters * 100, precision: 0, unit: 'cm' }),\n    Object.freeze({ id: 'debugArmAttemptCm', query: 'armAttemptCm', profileKey: 'armAttemptActivationMeters', scale: 0.01, defaultValue: profileDefaults.armAttemptActivationMeters * 100, precision: 1, unit: 'cm' }),\n  ]);\n  const profile = {};\n\n  function clampControl(input, value) {\n    return Math.max(Number(input.min), Math.min(Number(input.max), Number(value)));\n  }\n\n  function refresh(syncUrl = true) {\n    if (!debugMode) return;\n    const url = new URL(windowRef.location.href);\n    for (const spec of controls) {\n      const input = documentRef.getElementById(spec.id);\n      const value = clampControl(input, input.value);\n      input.value = String(value);\n      profile[spec.profileKey] = value * spec.scale;\n      documentRef.getElementById(\`\${spec.id}Value\`).textContent = \`\${value.toFixed(spec.precision)}\${spec.unit}\`;\n      if (syncUrl) url.searchParams.set(spec.query, String(value));\n    }\n    if (syncUrl) windowRef.history.replaceState(null, '', url);\n    elements.debugProfileSummary.textContent = \`ACTIVE · lead \${Math.round(profile.anticipatoryLeadMaxSeconds * 1000)}ms · crouch \${(profile.maxCrouchMeters * 100).toFixed(1)}cm @ \${profile.crouchSpeedMps.toFixed(2)}m/s · edge \${(profile.edgeActivationMeters * 100).toFixed(1)}cm · plane \${(profile.kneeThreatPlaneMeters * 100).toFixed(1)}cm · lowgap \${(profile.lowGapVerticalActivationMeters * 100).toFixed(1)}cm · down \${profile.kneeThreatDownRatio.toFixed(2)} · knee ±\${(profile.kneeLineBandMeters * 100).toFixed(0)}cm · arm gate \${(profile.armAttemptActivationMeters * 100).toFixed(1)}cm\`;\n  }\n\n  function initialize() {\n    elements.stanceDebugPanel.hidden = !debugMode;\n    documentRef.documentElement.dataset.debugMode = debugMode ? 'on' : 'off';\n    if (!debugMode) return;\n    for (const spec of controls) {\n      const input = documentRef.getElementById(spec.id);\n      const rawQueryValue = debugQuery.get(spec.query);\n      const queryValue = rawQueryValue == null || rawQueryValue.trim() === ''\n        ? Number.NaN\n        : Number(rawQueryValue);\n      input.value = String(Number.isFinite(queryValue)\n        ? clampControl(input, queryValue)\n        : spec.defaultValue);\n      input.addEventListener('input', () => refresh(true));\n    }\n    refresh(false);\n  }\n\n  function resetDefaults() {\n    for (const spec of controls) {\n      documentRef.getElementById(spec.id).value = String(spec.defaultValue);\n    }\n    refresh(true);\n  }\n\n  return Object.freeze({\n    profile,\n    controls,\n    initialize,\n    refresh,\n    resetDefaults,\n  });\n}\n`;

let uiModule = '';

if (!alreadyApplied) {
  const cueStart = requireMarker(source, 'let parryCueState = null;');
  const cueEnd = requireMarker(source.slice(cueStart), 'function buildReport(') + cueStart;
  let cueHud = source.slice(cueStart, cueEnd).trim();

  cueHud = cueHud.replace(
    'function updateParryCue(snapshot = attackRuntime.snapshot) {',
    `function updateParryCue(model) {\n  const {\n    snapshot, ready, selectedMode, step3AContactTransfer, latestGripConstraintReport,\n    selectedDirection, latestParryConfirmation, latestParryWhiff, parryAttempt,\n    firstContact, latestParryOpportunity, parryReviewActive, parryReviewRate, debugMode,\n  } = model;`,
  );
  cueHud = cueHud.replace('const attempt = parryGate.attempt;', 'const attempt = parryAttempt;');
  cueHud = cueHud.replaceAll('DEBUG_MODE', 'debugMode');
  cueHud = cueHud.replace(
    'untilCommitMs / (isParryPreContactReviewActive(snapshot) ? PARRY_REVIEW_RATE : 1);',
    'untilCommitMs / (parryReviewActive ? parryReviewRate : 1);',
  );

  cueHud = cueHud.replace(
    'function updateHud(snapshot, combatSnapshot) {',
    `function updateHud(model) {\n  const {\n    snapshot, combatSnapshot, latestCombatResult, latestParryWhiff, latestParryConfirmation,\n    latestParryInput, selectedMode, requestedOutcome, parryReviewActive, parryReviewRate,\n    parryPromptHeld, firstContact, latestFinePlan, latestReachableInterceptTarget,\n    latestGripConstraintReport, step3AContactTransfer, defenderReleaseGate,\n    step3AOwnsLiveContact, directOldB3Diagnostic, debugMode,\n  } = model;`,
  );
  cueHud = cueHud.replace(
    'const reviewRate = isParryPreContactReviewActive(snapshot) ? PARRY_REVIEW_RATE : 1;',
    'const reviewRate = parryReviewActive ? parryReviewRate : 1;',
  );
  cueHud = cueHud.replace('requestedOutcome().toUpperCase()', 'requestedOutcome.toUpperCase()');
  cueHud = cueHud.replace('parryPromptHold ?', 'parryPromptHeld ?');
  cueHud = cueHud.replace('  const defenderReleaseGate = defenderDeflectReleaseGate();\n', '');
  cueHud = cueHud.replace('hudRecoil.textContent = step3AOwnsLiveContact()', 'hudRecoil.textContent = step3AOwnsLiveContact');

  uiModule = `// R18M.3 — presentation-only Parry cue/HUD rendering and DOM event binding.\n// Callers provide snapshots/callbacks. This module never decides combat success.\n\nimport {\n  describeContactGeometry,\n  formatAllInspectionGates,\n  formatInspectionFailureSummary,\n  formatTerminalState,\n  formatWhiffDiagnostic,\n} from './diagnostic-formatters.js';\n\nexport function createShieldParryLabUi(elements) {\n  const {\n    hudAttack, hudInput, parryCue, parryCueMain, parryCueDetail, hudContact, hudCoupling,\n    hudShield, hudWeapon, hudSeparation, hudLineClearance, hudRecoil, hudDiagnostic,\n    parryNow, retryAttack,\n  } = elements;\n\n${cueHud.split('\n').map((line) => `  ${line}`).join('\n')}\n\n  function flashParryInput() {\n    parryNow.classList.add('input-flash');\n    globalThis.setTimeout(() => parryNow.classList.remove('input-flash'), 180);\n  }\n\n  function setInputReceipt(source, result) {\n    hudInput.textContent = \`INPUT RECEIVED: \${source.toUpperCase()} · \${result.accepted ? 'ARMED' : \`REJECTED · \${result.reason}\`}\`;\n  }\n\n  return Object.freeze({\n    updateParryCue,\n    updateHud,\n    flashParryInput,\n    setInputReceipt,\n  });\n}\n\nfunction isParryKey(event) {\n  return event?.code === 'KeyF'\n    || String(event?.key || '').toLowerCase() === 'f'\n    || event?.keyCode === 70;\n}\n\nexport function bindShieldParryLabUiEvents({\n  documentRef,\n  windowRef,\n  canvas,\n  elements,\n  handlers,\n}) {\n  let parryKeyDownObserved = false;\n  documentRef.querySelectorAll('[data-attack]').forEach((button) =>\n    button.addEventListener('click', () => handlers.onAttack(button.dataset.attack)));\n  documentRef.querySelectorAll('[data-mode]').forEach((button) =>\n    button.addEventListener('click', () => handlers.onMode(button.dataset.mode)));\n  documentRef.querySelectorAll('[data-view]').forEach((button) =>\n    button.addEventListener('click', () => handlers.onView(button.dataset.view)));\n  elements.forceOldB3.addEventListener('click', handlers.onForceOldB3);\n  elements.parryNow.addEventListener('click', () => handlers.onParryInput('button'));\n  elements.retryAttack.addEventListener('click', handlers.onRetryAttack);\n  elements.debugApplyRetry.addEventListener('click', handlers.onDebugApplyRetry);\n  elements.debugResetDefaults.addEventListener('click', handlers.onDebugResetDefaults);\n\n  documentRef.addEventListener('keydown', (event) => {\n    if (!isParryKey(event) || event.repeat) return;\n    parryKeyDownObserved = true;\n    event.preventDefault();\n    event.stopPropagation();\n    handlers.onParryInput('keyboard-f', event);\n  }, true);\n  documentRef.addEventListener('keyup', (event) => {\n    if (!isParryKey(event)) return;\n    event.preventDefault();\n    event.stopPropagation();\n    if (!parryKeyDownObserved) handlers.onParryInput('keyboard-f-keyup-fallback', event);\n    parryKeyDownObserved = false;\n  }, true);\n  windowRef.addEventListener('blur', () => { parryKeyDownObserved = false; });\n  canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));\n  elements.showSurface.addEventListener('change', () => handlers.onShowSurface(elements.showSurface.checked));\n  windowRef.addEventListener('resize', handlers.onResize);\n  handlers.onView('three');\n  handlers.onResize();\n}\n`;

  const importAnchor = "import { serializeVerificationReport } from './shield-parry-r281/report-serialization.js';\n";
  const importInsert = `${importAnchor}import { createShieldParryLabDom } from './shield-parry-r281/lab-dom.js';\nimport { createStanceDebugController } from './shield-parry-r281/stance-debug-controls.js';\nimport { createShieldParryLabUi, bindShieldParryLabUiEvents } from './shield-parry-r281/lab-ui.js';\n`;
  source = source.replace(importAnchor, importInsert);

  const uiBootstrap = `const uiElements = createShieldParryLabDom(document);\nconst { status, reportNode, autoRepeat, slowReview, showSurface } = uiElements;\nconst stanceDebug = createStanceDebugController({\n  documentRef: document,\n  windowRef: window,\n  debugMode: DEBUG_MODE,\n  debugQuery: DEBUG_QUERY,\n  profileDefaults: GUARD_RESIDUAL_STANCE_REACH_PROFILE,\n  elements: uiElements,\n});\nconst debugStanceProfile = stanceDebug.profile;\nconst refreshDebugStanceProfile = (syncUrl = true) => stanceDebug.refresh(syncUrl);\nconst resetDebugStanceDefaults = () => stanceDebug.resetDefaults();\nstanceDebug.initialize();\nconst labUi = createShieldParryLabUi(uiElements);\n\n`;
  source = replaceRange(
    source,
    "const hudAttack = document.getElementById('hudAttack');",
    'let ready = false;',
    uiBootstrap,
  );

  source = source.replace('let parryKeyDownObserved = false;\n', '');
  source = source.replace(
    "  parryNowButton.classList.add('input-flash');\n  setTimeout(() => parryNowButton.classList.remove('input-flash'), 180);",
    '  labUi.flashParryInput();',
  );
  source = source.replace(
    "  hudInput.textContent = `INPUT RECEIVED: ${source.toUpperCase()} · ${result.accepted ? 'ARMED' : `REJECTED · ${result.reason}`}`;",
    '  labUi.setInputReceipt(source, result);',
  );

  source = replaceRange(source, 'function isParryKey(event) {', 'function forceOldTwoActorB3(', '');

  const cueWrappers = `function updateParryCue(snapshot = attackRuntime.snapshot) {\n  return labUi.updateParryCue({\n    snapshot,\n    ready,\n    selectedMode,\n    step3AContactTransfer,\n    latestGripConstraintReport,\n    selectedDirection,\n    latestParryConfirmation,\n    latestParryWhiff,\n    parryAttempt: parryGate.attempt,\n    firstContact,\n    latestParryOpportunity,\n    parryReviewActive: isParryPreContactReviewActive(snapshot),\n    parryReviewRate: PARRY_REVIEW_RATE,\n    debugMode: DEBUG_MODE,\n  });\n}\n\nfunction updateHud(snapshot, combatSnapshot) {\n  return labUi.updateHud({\n    snapshot,\n    combatSnapshot,\n    latestCombatResult,\n    latestParryWhiff,\n    latestParryConfirmation,\n    latestParryInput,\n    selectedMode,\n    requestedOutcome: requestedOutcome(),\n    parryReviewActive: isParryPreContactReviewActive(snapshot),\n    parryReviewRate: PARRY_REVIEW_RATE,\n    parryPromptHeld: Boolean(parryPromptHold),\n    firstContact,\n    latestFinePlan,\n    latestReachableInterceptTarget,\n    latestGripConstraintReport,\n    step3AContactTransfer,\n    defenderReleaseGate: defenderDeflectReleaseGate(),\n    step3AOwnsLiveContact: step3AOwnsLiveContact(),\n    directOldB3Diagnostic,\n    debugMode: DEBUG_MODE,\n  });\n}\n\n`;
  source = replaceRange(source, 'let parryCueState = null;', 'function buildReport(', cueWrappers);

  const eventBindings = `bindShieldParryLabUiEvents({\n  documentRef: document,\n  windowRef: window,\n  canvas,\n  elements: uiElements,\n  handlers: {\n    onAttack: (direction) => startAttack(direction),\n    onMode: (mode) => setMode(mode),\n    onView: (view) => setView(view),\n    onForceOldB3: () => forceOldTwoActorB3(selectedDirection),\n    onParryInput: (inputSource, event) => dispatchParryInput(inputSource, event),\n    onRetryAttack: () => restartAttack(selectedDirection),\n    onDebugApplyRetry: () => restartAttack(selectedDirection),\n    onDebugResetDefaults: resetDebugStanceDefaults,\n    onShowSurface: (checked) => buckler.setParrySurfaceVisible(checked),\n    onResize: resize,\n  },\n});\n\n`;
  source = replaceRange(
    source,
    "document.querySelectorAll('[data-attack]').forEach",
    'function frame(timestamp) {',
    eventBindings,
  );
}

const uiTest = `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFile } from 'node:fs/promises';\nimport { SHIELD_PARRY_LAB_REQUIRED_DOM_IDS } from '../tools/action-studio/shield-parry-r281/lab-dom.js';\n\nconst entry = await readFile(new URL('../tools/action-studio/shield-driven-contact-coupling-lab-r281.js', import.meta.url), 'utf8');\nconst ui = await readFile(new URL('../tools/action-studio/shield-parry-r281/lab-ui.js', import.meta.url), 'utf8');\nconst stance = await readFile(new URL('../tools/action-studio/shield-parry-r281/stance-debug-controls.js', import.meta.url), 'utf8');\n\ntest('R18M.3 entry delegates DOM, stance debug, Parry cue, HUD, and input bindings', () => {\n  assert.match(entry, /shield-parry-r281\\/lab-dom\\.js/);\n  assert.match(entry, /shield-parry-r281\\/stance-debug-controls\\.js/);\n  assert.match(entry, /shield-parry-r281\\/lab-ui\\.js/);\n  assert.doesNotMatch(entry, /const hudAttack = document\\.getElementById/);\n  assert.doesNotMatch(entry, /let parryCueState = null/);\n  assert.doesNotMatch(entry, /hudAttack\\.textContent/);\n  assert.doesNotMatch(entry, /function isParryKey\\(/);\n  assert.doesNotMatch(entry, /document\\.addEventListener\\('keydown'/);\n  assert.match(entry, /labUi\\.updateParryCue\\(\\{/);\n  assert.match(entry, /labUi\\.updateHud\\(\\{/);\n  assert.match(entry, /bindShieldParryLabUiEvents\\(\\{/);\n  assert.ok(entry.split('\\n').length < 1850, 'R281 entry should become materially smaller after UI extraction');\n});\n\ntest('R18M.3 UI module owns presentation/input wiring but no combat success authority', () => {\n  assert.match(ui, /PARRY NOW! · PRESS F/);\n  assert.match(ui, /keyboard-f-keyup-fallback/);\n  assert.match(ui, /input-flash/);\n  assert.match(ui, /retry-attention/);\n  assert.match(ui, /review hold 最多 1\\.5s/);\n  assert.doesNotMatch(ui, /parryGate\\.arm\\(/);\n  assert.doesNotMatch(ui, /parryGate\\.confirm\\(/);\n  assert.doesNotMatch(ui, /combat\\.resolveContact\\(/);\n  assert.doesNotMatch(ui, /swordGripConstraint\\.(?:start|update)\\(/);\n});\n\ntest('R18M.3 stance debug module preserves existing query keys and remains guidance-only', () => {\n  for (const query of ['leadMs', 'crouchCm', 'crouchSpeed', 'edgeCm', 'planeCm', 'lowGapCm', 'downRatio', 'kneeBandCm', 'armAttemptCm']) {\n    assert.match(stance, new RegExp(\\`query: '\\${query}'\\`));\n  }\n  assert.match(stance, /profile\\[spec\\.profileKey\\] = value \\* spec\\.scale/);\n  assert.doesNotMatch(stance, /combat\\.|parryGate\\.|swordGripConstraint\\./);\n});\n\ntest('R18M.3 DOM contract keeps all current HUD, controls, and debug elements explicit', () => {\n  for (const id of ['hudAttack', 'hudInput', 'parryCue', 'hudDiagnostic', 'status', 'report', 'autoRepeat', 'slowReview', 'showSurface', 'forceOldB3', 'parryNow', 'retryAttack', 'stanceDebugPanel', 'debugApplyRetry', 'debugResetDefaults']) {\n    assert.ok(SHIELD_PARRY_LAB_REQUIRED_DOM_IDS.includes(id), \\`missing DOM contract id: \\${id}\\`);\n  }\n});\n`;

await mkdir(moduleDir, { recursive: true });
await writeFile(`${moduleDir}/lab-dom.js`, domModule, 'utf8');
await writeFile(`${moduleDir}/stance-debug-controls.js`, stanceModule, 'utf8');
if (!alreadyApplied) await writeFile(`${moduleDir}/lab-ui.js`, uiModule, 'utf8');
await writeFile(entryPath, source, 'utf8');
await writeFile(testPath, uiTest, 'utf8');

const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
if (!pkg.scripts?.test) throw new Error('package.json scripts.test missing');
if (!pkg.scripts.test.includes(testPath)) {
  const anchor = 'tests/shield-parry-r281-diagnostics.test.js';
  if (pkg.scripts.test.includes(anchor)) {
    pkg.scripts.test = pkg.scripts.test.replace(anchor, `${anchor} ${testPath}`);
  } else {
    pkg.scripts.test += ` ${testPath}`;
  }
}
await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  stage: 'R18M.3',
  alreadyApplied,
  entryLines: source.split('\n').length,
  domLines: domModule.split('\n').length,
  stanceLines: stanceModule.split('\n').length,
  uiLines: uiModule ? uiModule.split('\n').length : null,
}, null, 2));
