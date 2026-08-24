import { readFile, writeFile, mkdir } from 'node:fs/promises';

const entryPath = 'tools/action-studio/shield-driven-contact-coupling-lab-r281.js';
const moduleDir = 'tools/action-studio/shield-parry-r281';
const packagePath = 'package.json';
const testPath = 'tests/shield-parry-r281-diagnostics.test.js';

let source = await readFile(entryPath, 'utf8');

function requireMarker(text, marker) {
  const index = text.indexOf(marker);
  if (index < 0) throw new Error(`R18M.2 marker not found: ${marker}`);
  return index;
}

function extractRange(text, startMarker, endMarker) {
  const start = requireMarker(text, startMarker);
  const end = requireMarker(text.slice(start), endMarker) + start;
  if (end <= start) throw new Error(`R18M.2 invalid range: ${startMarker} -> ${endMarker}`);
  return {
    block: text.slice(start, end),
    remaining: text.slice(0, start) + text.slice(end),
  };
}

if (source.includes("./shield-parry-r281/diagnostic-telemetry.js")) {
  throw new Error('R18M.2 appears to have already been applied');
}

const telemetry = extractRange(
  source,
  'function compactVector(value) {',
  'function setInspectionLine(line, start, end) {',
);
source = telemetry.remaining;

const telemetryExports = [
  'compactInterceptDriveTelemetry',
  'compactInterceptDriveTraceFrame',
  'compactPredictiveAnalysis',
  'compactParryGateAttempt',
  'compactReachableInterceptTarget',
  'compactLiveContactConstraint',
  'compactThreatSelection',
];
let telemetryModule = `// R18M.2 — pure compact telemetry builders extracted from the R281 browser lab.\n// These helpers deliberately retain scalar review data only; they have no combat authority.\n\n${telemetry.block.trim()}\n`;
for (const name of telemetryExports) {
  const marker = `function ${name}(`;
  if (!telemetryModule.includes(marker)) throw new Error(`Missing telemetry export: ${name}`);
  telemetryModule = telemetryModule.replace(marker, `export function ${name}(`);
}

const formatters = extractRange(
  source,
  'const INSPECTION_GATE_ORDER = Object.freeze([',
  'let parryCueState = null;',
);
source = formatters.remaining;
let formatterModule = formatters.block.trim();
formatterModule = formatterModule.replace(
  'function describeContactGeometry(contact = firstContact) {',
  'export function describeContactGeometry(contact) {',
);
formatterModule = formatterModule.replace(
  'function formatWhiffDiagnostic(whiff) {',
  'export function formatWhiffDiagnostic(whiff, { debugMode = false } = {}) {',
);
formatterModule = formatterModule.replace('if (DEBUG_MODE) {', 'if (debugMode) {');
for (const name of [
  'formatTerminalState',
  'formatInspectionFailureSummary',
  'formatAllInspectionGates',
]) {
  const marker = `function ${name}(`;
  if (!formatterModule.includes(marker)) throw new Error(`Missing formatter export: ${name}`);
  formatterModule = formatterModule.replace(marker, `export function ${name}(`);
}
const formatterHeader = `// R18M.2 — presentation-only diagnostic formatters extracted from R281.\n// No function in this module may decide combat success or mutate a runtime.\n\nfunction magnitude(v) {\n  return v ? Math.hypot(Number(v.x) || 0, Number(v.y) || 0, Number(v.z) || 0) : 0;\n}\n\n`;
formatterModule = formatterHeader + formatterModule + '\n';

source = source.replaceAll(
  'formatWhiffDiagnostic(latestParryWhiff)',
  'formatWhiffDiagnostic(latestParryWhiff, { debugMode: DEBUG_MODE })',
);

const reportStart = requireMarker(source, '  const reportText = JSON.stringify(report, null, 2);');
const returnMarker = '  return report;\n}';
const reportReturn = requireMarker(source.slice(reportStart), returnMarker) + reportStart;
const publicationReplacement = `  const publication = serializeVerificationReport({\n    report,\n    maxCharacters: MAX_REPORT_DOM_CHARACTERS,\n    traceFrames: interceptDriveTrace.length,\n    recentTraceFrames: Math.min(interceptDriveTrace.length, RECENT_COMPACT_TRACE_FRAMES),\n  });\n  reportNode.textContent = publication.displayText;\n  document.documentElement.dataset.g43b5r281 = report.pass ? 'pass' : 'fail';\n  window.__G43B5R281_RESULT__ = report;\n  window.__G43B5R281_PERF__ = publication.perf;\n`;
source = source.slice(0, reportStart) + publicationReplacement + source.slice(reportReturn);

const importAnchor = '\nconst LAB_STAGE = LIVE_SHIELD_SWORD_GRIP_CONTACT_STAGE;';
const importIndex = requireMarker(source, importAnchor);
const diagnosticsImports = `\nimport {\n  compactInterceptDriveTelemetry,\n  compactInterceptDriveTraceFrame,\n  compactPredictiveAnalysis,\n  compactParryGateAttempt,\n  compactReachableInterceptTarget,\n  compactLiveContactConstraint,\n  compactThreatSelection,\n} from './shield-parry-r281/diagnostic-telemetry.js';\nimport {\n  describeContactGeometry,\n  formatAllInspectionGates,\n  formatInspectionFailureSummary,\n  formatTerminalState,\n  formatWhiffDiagnostic,\n} from './shield-parry-r281/diagnostic-formatters.js';\nimport { serializeVerificationReport } from './shield-parry-r281/report-serialization.js';\n`;
source = source.slice(0, importIndex) + diagnosticsImports + source.slice(importIndex);

const serializerModule = `// R18M.2 — pure report serialization and DOM-budget accounting.\n// The caller owns publication to DOM/window; this module only shapes text + perf telemetry.\n\nexport function serializeVerificationReport({\n  report,\n  maxCharacters,\n  traceFrames,\n  recentTraceFrames,\n}) {\n  const reportText = JSON.stringify(report, null, 2);\n  const reportWithinDomBudget = reportText.length <= maxCharacters;\n  const oversizedSectionCharacters = reportWithinDomBudget\n    ? null\n    : Object.freeze(Object.fromEntries(\n        Object.entries(report).map(([key, value]) => [key, JSON.stringify(value)?.length ?? 0]),\n      ));\n  const displayText = reportWithinDomBudget\n    ? reportText\n    : JSON.stringify({\n        stage: report.stage,\n        pass: false,\n        reason: 'verification-report-exceeded-dom-budget',\n        reportCharacters: reportText.length,\n        maximumCharacters: maxCharacters,\n        traceFrames,\n        oversizedSectionCharacters,\n      }, null, 2);\n  const perf = Object.freeze({\n    reportCharacters: reportText.length,\n    maximumCharacters: maxCharacters,\n    reportWithinDomBudget,\n    traceFrames,\n    recentTraceFrames,\n    telemetryDetail: 'compact-scalar-frames-only',\n  });\n  return Object.freeze({\n    reportText,\n    displayText,\n    reportWithinDomBudget,\n    oversizedSectionCharacters,\n    perf,\n  });\n}\n`;

const diagnosticsTest = `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFile } from 'node:fs/promises';\nimport {\n  compactInterceptDriveTelemetry,\n  compactInterceptDriveTraceFrame,\n} from '../tools/action-studio/shield-parry-r281/diagnostic-telemetry.js';\nimport {\n  describeContactGeometry,\n  formatInspectionFailureSummary,\n  formatWhiffDiagnostic,\n} from '../tools/action-studio/shield-parry-r281/diagnostic-formatters.js';\nimport { serializeVerificationReport } from '../tools/action-studio/shield-parry-r281/report-serialization.js';\n\nconst source = await readFile(\n  new URL('../tools/action-studio/shield-driven-contact-coupling-lab-r281.js', import.meta.url),\n  'utf8',\n);\n\ntest('R18M.2 R281 imports diagnostics modules instead of defining compact/formatter blocks inline', () => {\n  assert.match(source, /shield-parry-r281\\/diagnostic-telemetry\\.js/);\n  assert.match(source, /shield-parry-r281\\/diagnostic-formatters\\.js/);\n  assert.match(source, /shield-parry-r281\\/report-serialization\\.js/);\n  assert.doesNotMatch(source, /function compactVector\\(/);\n  assert.doesNotMatch(source, /const INSPECTION_GATE_ORDER = Object\\.freeze/);\n  assert.doesNotMatch(source, /const reportText = JSON\\.stringify\\(report, null, 2\\)/);\n  assert.ok(source.split('\\n').length < 2200, 'R281 entry should be materially smaller after diagnostics extraction');\n});\n\ntest('R18M.2 compact telemetry keeps scalar review evidence and drops solver-only object graphs', () => {\n  const compact = compactInterceptDriveTelemetry({\n    attackPhase: 'attack_active',\n    elapsedSeconds: 0.4,\n    timeToContactSeconds: 0.08,\n    selectionSource: 'measured-current-sweep-closest-approach',\n    residualAfterRefinement: { planeGapMeters: 0.01, radialGapMeters: 0.02, combinedGapMeters: 0.03, solverGraph: { huge: true } },\n    residualStanceReach: {\n      active: true,\n      stanceHeld: true,\n      threat: { zone: 'knee-line', kneeLineThreat: true },\n      internalSolverGraph: { huge: true },\n    },\n    solverGraph: { huge: true },\n  });\n  assert.equal(compact.telemetryDetail, 'compact-scalar-frame');\n  assert.equal(compact.residualAfterRefinement.radialGapMeters, 0.02);\n  assert.equal(compact.residualStanceReach.threat.zone, 'knee-line');\n  assert.equal('solverGraph' in compact, false);\n  assert.equal('internalSolverGraph' in compact.residualStanceReach, false);\n\n  const trace = compactInterceptDriveTraceFrame({\n    attackPhase: 'attack_active',\n    residualStanceReach: { active: true, stanceHeld: true, crouchMeters: 0.04, feetPlanted: true },\n  });\n  assert.deepEqual(trace.stance, { active: true, held: true, activationSource: null, crouchMeters: 0.04, feetPlanted: true });\n});\n\ntest('R18M.2 formatter helpers preserve contact and inspection semantics without combat authority', () => {\n  const contact = describeContactGeometry({\n    geometricContact: true,\n    bladeFraction: 0.6,\n    radialDistance: 0.08,\n    surface: { radius: 0.12 },\n  });\n  assert.equal(contact.bladeRegion, 'MID');\n  assert.equal(contact.shieldRegion, 'FACE OUTER');\n\n  const failure = formatInspectionFailureSummary({\n    inspectionAssessment: {\n      failedGateCount: 1,\n      failedGateKeys: ['swordAxisClearance'],\n      terminalReason: 'insufficient-live-shield-offline-travel',\n      gates: {\n        swordAxisClearance: { key: 'swordAxisClearance', unit: 'degrees', actual: 4, minimum: 7, operator: '>=' },\n      },\n    },\n  });\n  assert.match(failure, /FAIL 1\\/7/);\n  assert.match(failure, /4\\.0°/);\n\n  const whiff = formatWhiffDiagnostic({ category: 'NO_PROBE_DATA', reason: 'no-probe' });\n  assert.equal(whiff.label, 'NO PROBE DATA');\n  assert.match(whiff.detail, /no sweep sample recorded/);\n});\n\ntest('R18M.2 report serializer preserves the 60k-style budget fallback and compact perf telemetry', () => {\n  const normal = serializeVerificationReport({\n    report: { stage: 'R18', pass: true, value: 1 },\n    maxCharacters: 60000,\n    traceFrames: 12,\n    recentTraceFrames: 8,\n  });\n  assert.equal(normal.reportWithinDomBudget, true);\n  assert.equal(normal.displayText, normal.reportText);\n  assert.equal(normal.perf.telemetryDetail, 'compact-scalar-frames-only');\n  assert.equal(normal.perf.recentTraceFrames, 8);\n\n  const oversized = serializeVerificationReport({\n    report: { stage: 'R18', pass: true, payload: 'x'.repeat(200) },\n    maxCharacters: 20,\n    traceFrames: 96,\n    recentTraceFrames: 8,\n  });\n  assert.equal(oversized.reportWithinDomBudget, false);\n  assert.match(oversized.displayText, /verification-report-exceeded-dom-budget/);\n  assert.equal(oversized.perf.maximumCharacters, 20);\n});\n`;

await mkdir(moduleDir, { recursive: true });
await writeFile(`${moduleDir}/diagnostic-telemetry.js`, telemetryModule, 'utf8');
await writeFile(`${moduleDir}/diagnostic-formatters.js`, formatterModule, 'utf8');
await writeFile(`${moduleDir}/report-serialization.js`, serializerModule, 'utf8');
await writeFile(entryPath, source, 'utf8');
await writeFile(testPath, diagnosticsTest, 'utf8');

const pkg = JSON.parse(await readFile(packagePath, 'utf8'));
if (!pkg.scripts?.test) throw new Error('package.json scripts.test missing');
if (!pkg.scripts.test.includes(testPath)) {
  const anchor = 'tests/shield-driven-contact-coupling-r281-regression.test.js';
  if (pkg.scripts.test.includes(anchor)) {
    pkg.scripts.test = pkg.scripts.test.replace(anchor, `${anchor} ${testPath}`);
  } else {
    pkg.scripts.test += ` ${testPath}`;
  }
}
await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  stage: 'R18M.2',
  entryLines: source.split('\n').length,
  telemetryLines: telemetryModule.split('\n').length,
  formatterLines: formatterModule.split('\n').length,
  serializerLines: serializerModule.split('\n').length,
}, null, 2));
