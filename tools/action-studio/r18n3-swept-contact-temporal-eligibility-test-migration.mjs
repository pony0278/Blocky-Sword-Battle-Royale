import { readFileSync, writeFileSync } from 'node:fs';

const path = 'tests/shield-parry-r281-contact-handoff-controller.test.js';
let source = readFileSync(path, 'utf8');

const oldOrder = `  indexOrder(controller, [\n    'exchangeState.latestContact = probeSweptSwordBucklerContact({',\n    'if (!exchangeState.latestContact.contact) return;',\n    'parryGate.confirm({ attackSnapshot: snapshot, contact: exchangeState.latestContact })',\n    'exchangeState.latestCombatResult = combat.resolveContact({',\n    'exchangeState.latestGripConstraintReport = swordGripConstraint.start({',\n  ]);\n  assert.match(controller, /active: snapshot\\.phase === LONGSWORD_ATTACK_PHASES\\.ACTIVE/);`;
const newOrder = `  indexOrder(controller, [\n    'const geometricContact = probeSweptSwordBucklerContact({',\n    'exchangeState.latestContact = evaluateSweptContactTemporalEligibility({',\n    'if (!exchangeState.latestContact.contact) return;',\n    'parryGate.confirm({ attackSnapshot: snapshot, contact: exchangeState.latestContact })',\n    'exchangeState.latestCombatResult = combat.resolveContact({',\n    'exchangeState.latestGripConstraintReport = swordGripConstraint.start({',\n  ]);\n  assert.match(controller, /active: true/);\n  assert.match(controller, /fallbackEligible: snapshot\\.phase === LONGSWORD_ATTACK_PHASES\\.ACTIVE/);`;

if (!source.includes(oldOrder)) {
  throw new Error('R18N.3 v6.4 could not locate legacy contact authority source contract');
}
if (source.includes('evaluateSweptContactTemporalEligibility')) {
  throw new Error('R18N.3 v6.4 contact authority source contract already migrated');
}
source = source.replace(oldOrder, newOrder);
writeFileSync(path, source);
console.log('R18N.3 v6.4 contact authority source contract migrated.');
