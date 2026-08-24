import { readFile, writeFile } from 'node:fs/promises';

const regressionPath = 'tests/shield-driven-contact-coupling-r281-regression.test.js';
const exchangeStatePath = 'tests/shield-parry-r281-exchange-state.test.js';
const committedGateLabPath = 'tests/committed-parry-contact-gate-lab.test.js';
const oldB3DiagnosticPath = 'tests/old-two-actor-b3-direct-diagnostic.test.js';
const shieldSwordLabPath = 'tests/shield-sword-hand-contact-coupling-lab.test.js';

function countOccurrences(source, needle) {
  let count = 0;
  let index = 0;
  while ((index = source.indexOf(needle, index)) !== -1) {
    count += 1;
    index += needle.length;
  }
  return count;
}

function replaceOnce(source, needle, replacement, label = needle) {
  const count = countOccurrences(source, needle);
  if (count !== 1) throw new Error(`${label}: expected 1 occurrence, found ${count}`);
  return source.replace(needle, replacement);
}

function replaceExactCount(source, needle, replacement, expected, label = needle) {
  const count = countOccurrences(source, needle);
  if (count !== expected) throw new Error(`${label}: expected ${expected} occurrence(s), found ${count}`);
  return source.replaceAll(needle, replacement);
}

let regression = await readFile(regressionPath, 'utf8');
regression = replaceOnce(
  regression,
  ");\nconst html = await readFile(\n  new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url),",
  ");\nconst preContactSource = await readFile(\n  new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url),\n  'utf8',\n);\nconst html = await readFile(\n  new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url),",
  'R18M.1 pre-contact source fixture',
);
for (const marker of [
  'analyzePredictiveInterceptParry',
  'selectReachableParryInterceptTarget',
  'measureSweptSwordBucklerClosestApproach',
  'residualBodyReachRuntime.update',
  'residualStanceReachRuntime.update',
]) {
  regression = replaceOnce(
    regression,
    `assert.match(source, /${marker.replaceAll('.', '\\.')}`,
    `assert.match(preContactSource, /${marker.replaceAll('.', '\\.')}`,
    `R18M.1 predictive ownership assertion: ${marker}`,
  );
}

let exchangeState = await readFile(exchangeStatePath, 'utf8');
exchangeState = replaceOnce(
  exchangeState,
  "const entry = await readFile(new URL('../tools/action-studio/shield-driven-contact-coupling-lab-r281.js', import.meta.url), 'utf8');\n",
  "const entry = await readFile(new URL('../tools/action-studio/shield-driven-contact-coupling-lab-r281.js', import.meta.url), 'utf8');\nconst preContactController = await readFile(new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url), 'utf8');\nconst exchangeOwnershipSources = `${entry}\\n${preContactController}`;\n",
  'R18M.4 split ownership fixture',
);
exchangeState = replaceOnce(
  exchangeState,
  "assert.doesNotMatch(entry, new RegExp('\\\\blet\\\\s+' + key + '\\\\b'), 'loose exchange let remains: ' + key);",
  "assert.doesNotMatch(exchangeOwnershipSources, new RegExp('\\\\blet\\\\s+' + key + '\\\\b'), 'loose exchange let remains: ' + key);",
  'R18M.4 loose-state assertion scope',
);
exchangeState = replaceOnce(
  exchangeState,
  "assert.match(entry, new RegExp('exchangeState\\\\.' + key + '\\\\b'), 'exchange owner is not used for: ' + key);",
  "assert.match(exchangeOwnershipSources, new RegExp('exchangeState\\\\.' + key + '\\\\b'), 'exchange owner is not used for: ' + key);",
  'R18M.4 exchange-owner assertion scope',
);

let committedGateLab = await readFile(committedGateLabPath, 'utf8');
committedGateLab = replaceOnce(
  committedGateLab,
  "const source = readFileSync(new URL('../tools/action-studio/shield-driven-contact-coupling-lab-r281.js', import.meta.url), 'utf8');\n",
  "const source = readFileSync(new URL('../tools/action-studio/shield-driven-contact-coupling-lab-r281.js', import.meta.url), 'utf8');\nconst preContactSource = readFileSync(new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url), 'utf8');\n",
  'Step 2 pre-contact source fixture',
);
committedGateLab = replaceOnce(
  committedGateLab,
  "}\n\ntest('Step 2 exposes one manual Parry and removes Perfect from the Lab',",
  "}\n\nfunction preContactFunctionBody(name, nextName) {\n  const start = preContactSource.indexOf(`function ${name}(`);\n  const end = preContactSource.indexOf(`function ${nextName}(`, start + 1);\n  assert.notEqual(start, -1, `${name} must exist in pre-contact controller`);\n  assert.notEqual(end, -1, `${nextName} must exist in pre-contact controller`);\n  return preContactSource.slice(start, end);\n}\n\ntest('Step 2 exposes one manual Parry and removes Perfect from the Lab',",
  'Step 2 pre-contact helper',
);
committedGateLab = replaceExactCount(
  committedGateLab,
  "const preContact = functionBody('updateParryPreContact', 'updatePreContact');",
  "const preContact = preContactFunctionBody('updateParryPreContact', 'updatePreContact');",
  2,
  'Step 2 extracted Parry function bodies',
);
committedGateLab = replaceOnce(
  committedGateLab,
  "assert.match(source, /(?:exchangeState\\.)?parryPromptHoldSequence !== snapshot\\.sequence/);",
  "assert.match(preContactSource, /(?:exchangeState\\.)?parryPromptHoldSequence !== snapshot\\.sequence/);",
  'Step 2 prompt-hold exchange ownership',
);
committedGateLab = replaceOnce(
  committedGateLab,
  "const review = functionBody('isParryPreContactReviewActive', 'updateBlockPreContact');",
  "const review = functionBody('isParryPreContactReviewActive', 'resolveContact');",
  'Step 2 review function boundary after extraction',
);

let oldB3Diagnostic = await readFile(oldB3DiagnosticPath, 'utf8');
oldB3Diagnostic = replaceOnce(
  oldB3Diagnostic,
  "const source = readFileSync(new URL('../tools/action-studio/shield-driven-contact-coupling-lab-r281.js', import.meta.url), 'utf8');\n",
  "const source = readFileSync(new URL('../tools/action-studio/shield-driven-contact-coupling-lab-r281.js', import.meta.url), 'utf8');\nconst preContactSource = readFileSync(new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url), 'utf8');\n",
  'Step 1 pre-contact source fixture',
);
oldB3Diagnostic = replaceOnce(
  oldB3Diagnostic,
  'assert.match(source, /function updateParryPreContact/);',
  'assert.match(preContactSource, /function updateParryPreContact/);',
  'Step 1 active Parry controller availability assertion',
);

let shieldSwordLab = await readFile(shieldSwordLabPath, 'utf8');
shieldSwordLab = replaceOnce(
  shieldSwordLab,
  ");\nconst html = readFileSync(\n  new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url),",
  ");\nconst preContactSource = readFileSync(\n  new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url),\n  'utf8',\n);\nconst html = readFileSync(\n  new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url),",
  'Step 3A pre-contact source fixture',
);
shieldSwordLab = replaceOnce(
  shieldSwordLab,
  "}\n\ntest('Step 3A exposes an explicit live contact inspection state and markers',",
  "}\n\nfunction preContactFunctionBody(name, nextName) {\n  const start = preContactSource.indexOf(`function ${name}(`);\n  const end = preContactSource.indexOf(`function ${nextName}(`, start + 1);\n  assert.notEqual(start, -1, `${name} must exist in pre-contact controller`);\n  assert.notEqual(end, -1, `${nextName} must exist in pre-contact controller`);\n  return preContactSource.slice(start, end);\n}\n\ntest('Step 3A exposes an explicit live contact inspection state and markers',",
  'Step 3A pre-contact helper',
);
shieldSwordLab = replaceOnce(
  shieldSwordLab,
  "test('Step 3A does not add the live grip constraint to the original Block pre-contact path', () => {\n  const block = functionBody('updateBlockPreContact', 'updateParryPreContact');",
  "test('Step 3A does not add the live grip constraint to the original Block pre-contact path', () => {\n  const block = preContactFunctionBody('updateBlockPreContact', 'updateParryPreContact');",
  'Step 3A original Block pre-contact ownership assertion',
);

await writeFile(regressionPath, regression, 'utf8');
await writeFile(exchangeStatePath, exchangeState, 'utf8');
await writeFile(committedGateLabPath, committedGateLab, 'utf8');
await writeFile(oldB3DiagnosticPath, oldB3Diagnostic, 'utf8');
await writeFile(shieldSwordLabPath, shieldSwordLab, 'utf8');

console.log('R18M.5 contract patch prepared:');
console.log('- R18M.1 predictive guidance assertions follow the extracted controller');
console.log('- R18M.4 exchange ownership assertions cover entry + controller without weakening loose-let checks');
console.log('- only the five newly exposed legacy Step 1/2/3A source-shape contracts follow the extracted pre-contact module');
console.log('- pre-existing full-suite failures remain untouched for exact baseline comparison');
