import { readFileSync, writeFileSync } from 'node:fs';

function migrateExact(path, oldSource, newSource, label) {
  let source = readFileSync(path, 'utf8');
  if (!source.includes(oldSource)) {
    throw new Error(`R18N.3 v6.4 could not locate ${label}`);
  }
  if (source.indexOf(oldSource) !== source.lastIndexOf(oldSource)) {
    throw new Error(`R18N.3 v6.4 expected one ${label}`);
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

const step3ATestPath = 'tests/shield-sword-hand-contact-coupling-lab.test.js';
const oldStep3AImports = `const contactHandoffSource = readFileSync(\n  new URL('../tools/action-studio/shield-parry-r281/contact-handoff-controller.js', import.meta.url),\n  'utf8',\n);\nconst postContactOwnershipSource = \`${'${source}'}\\n${'${contactHandoffSource}'}\`;`;
const newStep3AImports = `const contactHandoffSource = readFileSync(\n  new URL('../tools/action-studio/shield-parry-r281/contact-handoff-controller.js', import.meta.url),\n  'utf8',\n);\nconst labUiSource = readFileSync(\n  new URL('../tools/action-studio/shield-parry-r281/lab-ui.js', import.meta.url),\n  'utf8',\n);\nconst diagnosticFormattersSource = readFileSync(\n  new URL('../tools/action-studio/shield-parry-r281/diagnostic-formatters.js', import.meta.url),\n  'utf8',\n);\nconst stanceDebugSource = readFileSync(\n  new URL('../tools/action-studio/shield-parry-r281/stance-debug-controls.js', import.meta.url),\n  'utf8',\n);\nconst postContactOwnershipSource = \`${'${source}'}\\n${'${contactHandoffSource}'}\`;`;

migrateExact(
  step3ATestPath,
  oldStep3AImports,
  newStep3AImports,
  'Step 3A extracted presentation ownership imports',
);

const oldStep3AInspection = `  assert.match(source, /STEP 3A HOLD · LIVE CONTACT VERIFIED/);\n  assert.match(source, /formatInspectionFailureSummary/);\n  assert.match(source, /failedGateCount/);\n  assert.match(source, /formatTerminalState/);\n  assert.match(source, /contactGeometryDiagnostic: describeContactGeometry/);\n  assert.match(source, /bladePercent/);\n  assert.match(source, /shieldRegion/);`;
const newStep3AInspection = `  assert.match(labUiSource, /STEP 3A HOLD · LIVE CONTACT VERIFIED/);\n  assert.match(labUiSource, /formatInspectionFailureSummary/);\n  assert.match(labUiSource, /failedGateCount/);\n  assert.match(labUiSource, /formatTerminalState/);\n  assert.match(verificationReportSource, /contactGeometryDiagnostic: describeContactGeometry/);\n  assert.match(diagnosticFormattersSource, /bladePercent/);\n  assert.match(diagnosticFormattersSource, /shieldRegion/);`;

migrateExact(
  step3ATestPath,
  oldStep3AInspection,
  newStep3AInspection,
  'Step 3A live contact inspection ownership contract',
);

for (const [needle, owner, label] of [
  ['assert.match(source, /rawQueryValue', 'assert.match(stanceDebugSource, /rawQueryValue', 'R18E raw query parser ownership'],
  ['assert.match(source, /\\? Number\\.NaN/', 'assert.match(stanceDebugSource, /\\? Number\\.NaN/', 'R18E NaN fallback ownership'],
  ["assert.match(source, /query: 'leadMs'/", "assert.match(stanceDebugSource, /query: 'leadMs'/", 'R18E lead query ownership'],
  ["assert.match(source, /query: 'crouchCm'/", "assert.match(stanceDebugSource, /query: 'crouchCm'/", 'R18E crouch query ownership'],
  ["assert.match(source, /query: 'crouchSpeed'/", "assert.match(stanceDebugSource, /query: 'crouchSpeed'/", 'R18E crouch speed ownership'],
  ["assert.match(source, /query: 'edgeCm'/", "assert.match(stanceDebugSource, /query: 'edgeCm'/", 'R18E edge query ownership'],
  ["assert.match(source, /query: 'planeCm'/", "assert.match(stanceDebugSource, /query: 'planeCm'/", 'R18E plane query ownership'],
  ["assert.match(source, /query: 'lowGapCm'/", "assert.match(stanceDebugSource, /query: 'lowGapCm'/", 'R18E low gap ownership'],
  ["assert.match(source, /query: 'downRatio'/", "assert.match(stanceDebugSource, /query: 'downRatio'/", 'R18E down ratio ownership'],
  ["assert.match(source, /query: 'kneeBandCm'/", "assert.match(stanceDebugSource, /query: 'kneeBandCm'/", 'R18E knee band ownership'],
  ["assert.match(source, /query: 'armAttemptCm'/", "assert.match(stanceDebugSource, /query: 'armAttemptCm'/", 'R18E arm attempt ownership'],
  ['assert.match(source, /DEBUG pred', 'assert.match(diagnosticFormattersSource, /DEBUG pred', 'R18E debug prediction ownership'],
  ['assert.match(source, /anticipatedEligibilityReason/', 'assert.match(diagnosticFormattersSource, /anticipatedEligibilityReason/', 'R18E eligibility reason ownership'],
  ['assert.match(source, /pflags', 'assert.match(diagnosticFormattersSource, /pflags', 'R18E prediction flags ownership'],
]) {
  migrateExact(step3ATestPath, needle, owner, label);
}

const oldR18EAuthorityBlock = `  assert.match(source, /latestThreatSelection/);\n  assert.match(source, /debug-profile-changes-posture-guidance-only-real-swept-contact-remains-success-authority/);\n  assert.match(source, /if \\(!latestContact\\.contact\\) return/);`;
const newR18EAuthorityBlock = `  assert.match(verificationReportSource, /latestThreatSelection/);\n  assert.match(verificationReportSource, /debug-profile-changes-posture-guidance-only-real-swept-contact-remains-success-authority/);\n  assert.match(contactHandoffSource, /if \\(!exchangeState\\.latestContact\\.contact\\) return/);`;

migrateExact(
  step3ATestPath,
  oldR18EAuthorityBlock,
  newR18EAuthorityBlock,
  'R18E report plus real-contact authority ownership block',
);

console.log('R18N.3 v6.4 contact authority source contracts migrated.');
