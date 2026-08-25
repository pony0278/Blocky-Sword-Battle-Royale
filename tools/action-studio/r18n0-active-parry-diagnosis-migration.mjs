import fs from 'node:fs';

const debugApiPath = 'tools/action-studio/shield-parry-r281/debug-api.js';
const startupDebugTestPath = 'tests/shield-parry-r281-startup-debug-facade.test.js';
const packagePath = 'package.json';

let debugApi = fs.readFileSync(debugApiPath, 'utf8');
const importLine = "import { buildActiveParryInterceptDiagnosis } from './active-parry-intercept-diagnosis.js';\n\n";
if (debugApi.includes('active-parry-intercept-diagnosis.js')) throw new Error('R18N.0 diagnosis import already present');
debugApi = importLine + debugApi;

const getterMarker = '    get latestInputSignal() { return getExchangeState().latestInputSignal; },\n';
if (!debugApi.includes(getterMarker)) throw new Error('R18N.0 debug getter marker missing');
debugApi = debugApi.replace(getterMarker, `${getterMarker}    get activeParryInterceptDiagnosis() {\n      return buildActiveParryInterceptDiagnosis({\n        attackSnapshot: runtimes.attackRuntime.snapshot,\n        exchangeState: getExchangeState(),\n      });\n    },\n`);
fs.writeFileSync(debugApiPath, debugApi);

let startupDebugTest = fs.readFileSync(startupDebugTestPath, 'utf8');
const apiKeyMarker = "    'latestInterceptDriveReport', 'latestInputSignal',\n";
if (!startupDebugTest.includes(apiKeyMarker)) throw new Error('R18N.0 C5 public API contract marker missing');
startupDebugTest = startupDebugTest.replace(
  apiKeyMarker,
  "    'latestInterceptDriveReport', 'latestInputSignal', 'activeParryInterceptDiagnosis',\n",
);
fs.writeFileSync(startupDebugTestPath, startupDebugTest);

let pkg = fs.readFileSync(packagePath, 'utf8');
const testMarker = 'tests/shield-parry-r281-startup-debug-facade.test.js tests/shield-parry-r281-thin-entry-audit.test.js';
if (!pkg.includes(testMarker)) throw new Error('R18N.0 package test marker missing');
pkg = pkg.replace(testMarker, 'tests/shield-parry-r281-startup-debug-facade.test.js tests/shield-parry-r281-active-parry-intercept-diagnosis.test.js tests/shield-parry-r281-thin-entry-audit.test.js');
fs.writeFileSync(packagePath, pkg);

console.log('R18N.0 diagnosis integration applied without touching the R281 entry or exchange state.');
