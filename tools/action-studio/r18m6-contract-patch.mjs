import { readFile, writeFile } from 'node:fs/promises';

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

function replaceTestBlockSource(source, title, nextTitle, replacementName) {
  const startMarker = `test('${title}', () => {`;
  const endMarker = `test('${nextTitle}', () => {`;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end <= start) throw new Error(`test block boundary missing: ${title}`);
  const block = source.slice(start, end);
  if (!block.includes('source,')) throw new Error(`test block has no source fixture: ${title}`);
  return source.slice(0, start) + block.replaceAll('source,', `${replacementName},`) + source.slice(end);
}

const regressionPath = 'tests/shield-driven-contact-coupling-r281-regression.test.js';
let regression = await readFile(regressionPath, 'utf8');
regression = replaceOnce(
  regression,
  ");\nconst html = await readFile(\n  new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url),",
  ");\nconst contactHandoffSource = await readFile(\n  new URL('../tools/action-studio/shield-parry-r281/contact-handoff-controller.js', import.meta.url),\n  'utf8',\n);\nconst html = await readFile(\n  new URL('../tools/action-studio/shield-driven-contact-coupling-lab.html', import.meta.url),",
  'R18M.1 contact handoff fixture',
);
regression = replaceOnce(
  regression,
  "assert.match(source, /(?:exchangeState\\.)?latestParryConfirmation = selectedMode === 'parry'[\\s\\S]*parryGate\\.confirm\\(\\{/);",
  "assert.match(contactHandoffSource, /exchangeState\\.latestParryConfirmation = selectedMode === 'parry'[\\s\\S]*parryGate\\.confirm\\(\\{/);",
  'R18M.1 Parry confirmation ownership',
);
regression = replaceOnce(
  regression,
  "const body = sliceFunction(source, 'function resolveContact(');",
  "const body = sliceFunction(contactHandoffSource, 'function resolveContact(');",
  'R18M.1 resolveContact ownership',
);
regression = replaceOnce(
  regression,
  "const body = sliceBetween(source, 'function releaseLiveContactToOldB3()', 'function recordVisibleOldB3Sample(');",
  "const body = sliceBetween(contactHandoffSource, 'function releaseLiveContactToOldB3({ selectedDirection })', 'function recordVisibleOldB3Sample(');",
  'R18M.1 release ownership',
);
regression = replaceOnce(
  regression,
  "assert.match(source, /marker: 'deflect-impulse'/);",
  "assert.match(contactHandoffSource, /marker: 'deflect-impulse'/);",
  'R18M.1 deflect marker ownership',
);
regression = replaceTestBlockSource(
  regression,
  'R18M.1 locks TOP\\/RIGHT calibrated arm assistance while LEFT release remains deferred',
  'R18M.1 locks current verification budget so extraction cannot silently expand telemetry',
  'contactHandoffSource',
);
await writeFile(regressionPath, regression, 'utf8');

const exchangePath = 'tests/shield-parry-r281-exchange-state.test.js';
let exchange = await readFile(exchangePath, 'utf8');
exchange = replaceOnce(
  exchange,
  "const preContactController = await readFile(new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url), 'utf8');\nconst exchangeOwnershipSources = `${entry}\\n${preContactController}`;",
  "const preContactController = await readFile(new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url), 'utf8');\nconst contactHandoffController = await readFile(new URL('../tools/action-studio/shield-parry-r281/contact-handoff-controller.js', import.meta.url), 'utf8');\nconst exchangeOwnershipSources = `${entry}\\n${preContactController}\\n${contactHandoffController}`;",
  'R18M.4 contact ownership fixture',
);
await writeFile(exchangePath, exchange, 'utf8');

const preContactPath = 'tests/shield-parry-r281-pre-contact-controller.test.js';
let preContact = await readFile(preContactPath, 'utf8');
preContact = replaceOnce(
  preContact,
  "const controller = await readFile(new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url), 'utf8');\n",
  "const controller = await readFile(new URL('../tools/action-studio/shield-parry-r281/pre-contact-controller.js', import.meta.url), 'utf8');\nconst contactHandoffController = await readFile(new URL('../tools/action-studio/shield-parry-r281/contact-handoff-controller.js', import.meta.url), 'utf8');\n",
  'R18M.5 contact handoff fixture',
);
preContact = replaceOnce(
  preContact,
  "test('R18M.5 whiff probing remains diagnostic and real swept contact stays authoritative in entry', () => {",
  "test('R18M.5 whiff probing remains diagnostic and real swept contact stays authoritative outside pre-contact', () => {",
  'R18M.5 test title',
);
preContact = replaceOnce(
  preContact,
  "  const probeIndex = entry.indexOf('exchangeState.latestContact = probeSweptSwordBucklerContact({');\n  const whiffIndex = entry.indexOf('preContactController.recordWhiffProbe(snapshot, exchangeState.latestContact);', probeIndex);\n  const confirmIndex = entry.indexOf('parryGate.confirm({ attackSnapshot: snapshot, contact: exchangeState.latestContact })', probeIndex);\n  const resolveIndex = entry.indexOf('exchangeState.latestCombatResult = combat.resolveContact({', probeIndex);",
  "  const probeIndex = contactHandoffController.indexOf('exchangeState.latestContact = probeSweptSwordBucklerContact({');\n  const whiffIndex = contactHandoffController.indexOf('preContactController.recordWhiffProbe(snapshot, exchangeState.latestContact);', probeIndex);\n  const confirmIndex = contactHandoffController.indexOf('parryGate.confirm({ attackSnapshot: snapshot, contact: exchangeState.latestContact })', probeIndex);\n  const resolveIndex = contactHandoffController.indexOf('exchangeState.latestCombatResult = combat.resolveContact({', probeIndex);",
  'R18M.5 authoritative contact ownership',
);
preContact = replaceOnce(
  preContact,
  "  assert.match(entry, /swordGripConstraint\\.start\\(\\{/);\n  assert.match(entry, /buildLiveParryOldB3Handoff\\(\\{/);\n  assert.match(entry, /continuityBridgeMs: handoff\\.releaseBlendMs/);",
  "  assert.match(contactHandoffController, /swordGripConstraint\\.start\\(\\{/);\n  assert.match(contactHandoffController, /buildLiveParryOldB3Handoff\\(\\{/);\n  assert.match(contactHandoffController, /continuityBridgeMs: handoff\\.releaseBlendMs/);",
  'R18M.5 post-contact ownership',
);
await writeFile(preContactPath, preContact, 'utf8');

console.log('R18M.6 contract patch prepared:');
console.log('- R18M.1 authority chain follows contact-handoff controller without weakening ordering assertions');
console.log('- R18M.4 exchange ownership covers entry + pre-contact + contact-handoff modules');
console.log('- R18M.5 preserves the pre-contact boundary while post-contact authority moves to R18M.6');
