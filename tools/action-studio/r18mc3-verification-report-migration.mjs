import fs from 'node:fs';

const entryPath = 'tools/action-studio/shield-driven-contact-coupling-lab-r281.js';
const modulePath = 'tools/action-studio/shield-parry-r281/verification-report.js';
const packagePath = 'package.json';

function requireExactlyOnce(text, token, label) {
  const count = text.split(token).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one occurrence, got ${count}`);
}

let entry = fs.readFileSync(entryPath, 'utf8');
if (fs.existsSync(modulePath)) throw new Error(`${modulePath} already exists`);

const functionMarker = 'function buildReport(combatSnapshot = combat.snapshot) {';
const publicationMarker = '  const publication = serializeVerificationReport({';
const mainMarker = '\nasync function main() {';
const importAnchor = "import { serializeVerificationReport } from './shield-parry-r281/report-serialization.js';";

requireExactlyOnce(entry, functionMarker, 'buildReport marker');
requireExactlyOnce(entry, publicationMarker, 'publication marker');
requireExactlyOnce(entry, mainMarker, 'main marker');
requireExactlyOnce(entry, importAnchor, 'report serialization import');

const functionStart = entry.indexOf(functionMarker);
const publicationStart = entry.indexOf(publicationMarker, functionStart);
const mainStart = entry.indexOf(mainMarker, publicationStart);
if (!(functionStart >= 0 && publicationStart > functionStart && mainStart > publicationStart)) {
  throw new Error('R18M.C3 report boundaries are not ordered as expected');
}

const assemblyStart = functionStart + functionMarker.length;
let assembly = entry.slice(assemblyStart, publicationStart);
const publicationTail = entry.slice(publicationStart, mainStart);

const replacements = [
  ['LAB_STAGE', 'labStage'],
  ['RECOIL_STAGE', 'recoilStage'],
  ['parryGate.profile', 'parryProfile'],
  ['defenderDeflectReleaseGate()', 'defenderReleaseGate'],
  ['step3AOwnsLiveContact()', 'ownsLiveContact'],
  ['freeCamera.snapshot()', 'inspectionCameraSnapshot'],
  ['RECENT_COMPACT_TRACE_FRAMES', 'recentCompactTraceFrames'],
  ['DEBUG_MODE', 'debugMode'],
  ['TWO_ACTOR_PARRY_REACTION_PHASE_LATCHES.LIVE_CONTACT', 'liveContactPhaseLatch'],
];
for (const [from, to] of replacements) assembly = assembly.split(from).join(to);

if (!assembly.includes('  const report = {')) throw new Error('report object was not captured');
if (!assembly.includes('invariants: {')) throw new Error('invariants block was not captured');
if (assembly.includes('serializeVerificationReport')) throw new Error('serializer leaked into pure builder assembly');
if (assembly.includes('window.') || assembly.includes('document.')) throw new Error('browser publication leaked into pure builder assembly');

const moduleSource = `// R18M.C3 — read-only verification report assembly.\n// This module receives snapshots/context and never advances combat, mutates exchange state, or publishes DOM/window globals.\n\nimport {\n  compactInterceptDriveTelemetry,\n  compactPredictiveAnalysis,\n  compactParryGateAttempt,\n  compactReachableInterceptTarget,\n  compactLiveContactConstraint,\n  compactThreatSelection,\n} from './diagnostic-telemetry.js';\nimport { describeContactGeometry } from './diagnostic-formatters.js';\n\nexport function buildShieldParryVerificationReport(context) {\n  const {\n    combatSnapshot,\n    exchangeState,\n    labStage,\n    recoilStage,\n    ready,\n    selectedDirection,\n    selectedMode,\n    parryProfile,\n    defenderReleaseGate,\n    ownsLiveContact,\n    inspectionCameraSnapshot,\n    debugMode,\n    debugStanceProfile,\n    recentCompactTraceFrames,\n    liveContactPhaseLatch,\n  } = context;\n${assembly}\n  return report;\n}\n`;

const builderImport = "import { buildShieldParryVerificationReport } from './shield-parry-r281/verification-report.js';";
entry = entry.replace(importAnchor, `${importAnchor}\n${builderImport}`);

const wrapper = `function buildReport(combatSnapshot = combat.snapshot) {\n  const report = buildShieldParryVerificationReport({\n    combatSnapshot,\n    exchangeState,\n    labStage: LAB_STAGE,\n    recoilStage: RECOIL_STAGE,\n    ready,\n    selectedDirection,\n    selectedMode,\n    parryProfile: parryGate.profile,\n    defenderReleaseGate: defenderDeflectReleaseGate(),\n    ownsLiveContact: step3AOwnsLiveContact(),\n    inspectionCameraSnapshot: freeCamera.snapshot(),\n    debugMode: DEBUG_MODE,\n    debugStanceProfile,\n    recentCompactTraceFrames: RECENT_COMPACT_TRACE_FRAMES,\n    liveContactPhaseLatch: TWO_ACTOR_PARRY_REACTION_PHASE_LATCHES.LIVE_CONTACT,\n  });\n${publicationTail}`;

entry = entry.slice(0, functionStart) + wrapper + entry.slice(mainStart);

if (entry.includes('const report = {\n    stage: LAB_STAGE')) throw new Error('inline report assembly remains in entry');
requireExactlyOnce(entry, 'buildShieldParryVerificationReport({', 'builder delegation');
requireExactlyOnce(entry, 'window.__G43B5R281_RESULT__ = report;', 'result publication');
requireExactlyOnce(entry, 'window.__G43B5R281_PERF__ = publication.perf;', 'perf publication');
requireExactlyOnce(entry, 'maxCharacters: MAX_REPORT_DOM_CHARACTERS,', '60k serializer budget wiring');

fs.writeFileSync(modulePath, moduleSource.replace(/[ \t]+$/gm, ''));
fs.writeFileSync(entryPath, entry.replace(/[ \t]+$/gm, ''));

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const testToken = 'tests/shield-parry-r281-verification-report.test.js';
const anchor = 'tests/shield-parry-r281-attacker-presentation.test.js';
if (!pkg.scripts?.test?.includes(testToken)) {
  const count = pkg.scripts.test.split(anchor).length - 1;
  if (count !== 1) throw new Error(`package test anchor expected once, got ${count}`);
  pkg.scripts.test = pkg.scripts.test.replace(anchor, `${anchor} ${testToken}`);
}
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log('R18M.C3 verification report migration applied.');
