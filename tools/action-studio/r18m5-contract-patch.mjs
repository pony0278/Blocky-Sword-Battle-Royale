import { readFile, writeFile } from 'node:fs/promises';

const regressionPath = 'tests/shield-driven-contact-coupling-r281-regression.test.js';
const exchangeStatePath = 'tests/shield-parry-r281-exchange-state.test.js';

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

await writeFile(regressionPath, regression, 'utf8');
await writeFile(exchangeStatePath, exchangeState, 'utf8');

console.log('R18M.5 contract patch prepared:');
console.log('- R18M.1 predictive guidance assertions follow the extracted controller');
console.log('- R18M.4 exchange ownership assertions cover entry + controller without weakening loose-let checks');
