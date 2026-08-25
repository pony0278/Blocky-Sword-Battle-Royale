import { readFileSync, writeFileSync } from 'node:fs';

function migrateExact(path, oldSource, newSource, label) {
  let source = readFileSync(path, 'utf8');
  if (!source.includes(oldSource)) {
    throw new Error(`R18N.3 v6.4 could not locate ${label}`);
  }
  if (source.includes(newSource)) {
    throw new Error(`R18N.3 v6.4 ${label} already migrated`);
  }
  source = source.replace(oldSource, newSource);
  writeFileSync(path, source);
}

const contactHandoffTestPath = 'tests/shield-parry-r281-contact-handoff-controller.test.js';
const oldOrder = `  indexOrder(controller, [\n    'exchangeState.latestContact = probeSweptSwordBucklerContact({',\n    'if (!exchangeState.latestContact.contact) return;',\n    'parryGate.confirm({ attackSnapshot: snapshot, contact: exchangeState.latestContact })',\n    'exchangeState.latestCombatResult = combat.resolveContact({',\n    'exchangeState.latestGripConstraintReport = swordGripConstraint.start({',\n  ]);\n  assert.match(controller, /active: snapshot\\.phase === LONGSWORD_ATTACK_PHASES\\.ACTIVE/);`;
const newOrder = `  indexOrder(controller, [\n    'const geometricContact = probeSweptSwordBucklerContact({',\n    'exchangeState.latestContact = evaluateSweptContactTemporalEligibility({',\n    'if (!exchangeState.latestContact.contact) return;',\n    'parryGate.confirm({ attackSnapshot: snapshot, contact: exchangeState.latestContact })',\n    'exchangeState.latestCombatResult = combat.resolveContact({',\n    'exchangeState.latestGripConstraintReport = swordGripConstraint.start({',\n  ]);\n  assert.match(controller, /active: true/);\n  assert.match(controller, /fallbackEligible: snapshot\\.phase === LONGSWORD_ATTACK_PHASES\\.ACTIVE/);`;

migrateExact(
  contactHandoffTestPath,
  oldOrder,
  newOrder,
  'contact authority source contract',
);

const preContactTestPath = 'tests/shield-parry-r281-pre-contact-controller.test.js';
const oldR18M5Order = `  const probeIndex = contactHandoffController.indexOf('exchangeState.latestContact = probeSweptSwordBucklerContact({');\n  const whiffIndex = contactHandoffController.indexOf('preContactController.recordWhiffProbe(snapshot, exchangeState.latestContact);', probeIndex);\n  const confirmIndex = contactHandoffController.indexOf('parryGate.confirm({ attackSnapshot: snapshot, contact: exchangeState.latestContact })', probeIndex);\n  const resolveIndex = contactHandoffController.indexOf('exchangeState.latestCombatResult = combat.resolveContact({', probeIndex);\n  assert.ok(probeIndex >= 0 && whiffIndex > probeIndex && confirmIndex > whiffIndex && resolveIndex > confirmIndex);`;
const newR18M5Order = `  const probeIndex = contactHandoffController.indexOf('const geometricContact = probeSweptSwordBucklerContact({');\n  const temporalEligibilityIndex = contactHandoffController.indexOf('exchangeState.latestContact = evaluateSweptContactTemporalEligibility({', probeIndex);\n  const whiffIndex = contactHandoffController.indexOf('preContactController.recordWhiffProbe(snapshot, exchangeState.latestContact);', temporalEligibilityIndex);\n  const rejectIndex = contactHandoffController.indexOf('if (!exchangeState.latestContact.contact) return;', whiffIndex);\n  const confirmIndex = contactHandoffController.indexOf('parryGate.confirm({ attackSnapshot: snapshot, contact: exchangeState.latestContact })', rejectIndex);\n  const resolveIndex = contactHandoffController.indexOf('exchangeState.latestCombatResult = combat.resolveContact({', confirmIndex);\n  assert.ok(\n    probeIndex >= 0\n      && temporalEligibilityIndex > probeIndex\n      && whiffIndex > temporalEligibilityIndex\n      && rejectIndex > whiffIndex\n      && confirmIndex > rejectIndex\n      && resolveIndex > confirmIndex,\n  );`;

migrateExact(
  preContactTestPath,
  oldR18M5Order,
  newR18M5Order,
  'R18M.5 swept-contact order contract',
);

console.log('R18N.3 v6.4 contact authority source contracts migrated.');
