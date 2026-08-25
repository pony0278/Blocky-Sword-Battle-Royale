import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`R18N.3 v6.4 could not locate ${label}`);
  if (source.indexOf(needle) !== source.lastIndexOf(needle)) {
    throw new Error(`R18N.3 v6.4 expected one ${label}`);
  }
  return source.replace(needle, replacement);
}

function update(path, transform) {
  const source = readFileSync(path, 'utf8');
  writeFileSync(path, transform(source));
}

const temporalImportController = `import {\n  evaluateSweptContactTemporalEligibility,\n} from '../../../src/combat/swept-contact-temporal-eligibility.js';\n\n`;

update('tools/action-studio/shield-parry-r281/contact-handoff-controller.js', (source) => {
  if (source.includes('evaluateSweptContactTemporalEligibility')) {
    throw new Error('R18N.3 v6.4 contact controller migration expects clean base');
  }
  let next = temporalImportController + source;
  next = replaceOnce(
    next,
    `    exchangeState.latestContact = probeSweptSwordBucklerContact({\n      previousBlade,\n      currentBlade,\n      bucklerSurface: buckler.getWorldParrySurface(),\n      deltaSeconds,\n      active: snapshot.phase === LONGSWORD_ATTACK_PHASES.ACTIVE,\n    });`,
    `    const geometricContact = probeSweptSwordBucklerContact({\n      previousBlade,\n      currentBlade,\n      bucklerSurface: buckler.getWorldParrySurface(),\n      deltaSeconds,\n      active: true,\n    });\n    exchangeState.latestContact = evaluateSweptContactTemporalEligibility({\n      contactReport: geometricContact,\n      attackSnapshot: snapshot,\n      deltaSeconds,\n      fallbackEligible: snapshot.phase === LONGSWORD_ATTACK_PHASES.ACTIVE,\n    });`,
    'contact-controller frame-end active probe',
  );
  return next;
});

update('src/combat/committed-parry-contact-gate.js', (source) => {
  if (source.includes('SWEPT_CONTACT_TEMPORAL_ELIGIBILITY_AUTHORITY')) {
    throw new Error('R18N.3 v6.4 committed parry gate migration expects clean base');
  }
  let next = `import {\n  SWEPT_CONTACT_TEMPORAL_ELIGIBILITY_AUTHORITY,\n} from './swept-contact-temporal-eligibility.js';\n\n${source}`;
  next = replaceOnce(
    next,
    `  const activeContact = attack.phase === 'attack_active';\n  const accepted = armed?.accepted === true && sameSequence && realSweptContact && activeContact;`,
    `  const temporalEligibility = contact?.temporalEligibility || null;\n  const sweptTemporalAuthority = temporalEligibility?.authority === SWEPT_CONTACT_TEMPORAL_ELIGIBILITY_AUTHORITY;\n  const activeContact = sweptTemporalAuthority\n    ? temporalEligibility.eligible === true\n    : attack.phase === 'attack_active';\n  const accepted = armed?.accepted === true && sameSequence && realSweptContact && activeContact;`,
    'committed parry frame-end active gate',
  );
  next = replaceOnce(
    next,
    `      realSweptContact,\n      activeContact,\n      sameAttackSequence: sameSequence,`,
    `      realSweptContact,\n      activeContact,\n      activeContactAuthority: sweptTemporalAuthority\n        ? SWEPT_CONTACT_TEMPORAL_ELIGIBILITY_AUTHORITY\n        : 'legacy-frame-end-attack-phase',\n      contactElapsedSeconds: sweptTemporalAuthority\n        ? temporalEligibility.contactElapsedSeconds ?? null\n        : null,\n      sameAttackSequence: sameSequence,`,
    'committed parry gate telemetry',
  );
  return next;
});

update('src/combat/two-actor-combat-integration.js', (source) => {
  if (source.includes('SWEPT_CONTACT_TEMPORAL_ELIGIBILITY_AUTHORITY')) {
    throw new Error('R18N.3 v6.4 two-actor integration migration expects clean base');
  }
  let next = replaceOnce(
    source,
    `import { createGuardOutcomeResolutionGate } from './guard-outcome-resolution.js';`,
    `import { createGuardOutcomeResolutionGate } from './guard-outcome-resolution.js';\nimport {\n  SWEPT_CONTACT_TEMPORAL_ELIGIBILITY_AUTHORITY,\n} from './swept-contact-temporal-eligibility.js';`,
    'two-actor temporal authority import',
  );
  next = replaceOnce(
    next,
    `    const attackSnapshot = attackRuntime.snapshot;\n    const contact = input.contact || input;\n    const resolution = outcomeGate.resolve({\n      attackSequence: attackSnapshot.sequence,\n      attackDirection: attackSnapshot.direction,\n      attackPhase: attackSnapshot.phase,\n      contact,`,
    `    const attackSnapshot = attackRuntime.snapshot;\n    const contact = input.contact || input;\n    const temporalEligibility = contact?.temporalEligibility || null;\n    const sweptTemporalAuthority = temporalEligibility?.authority === SWEPT_CONTACT_TEMPORAL_ELIGIBILITY_AUTHORITY;\n    const effectiveAttackPhase = sweptTemporalAuthority && temporalEligibility.eligible === true\n      ? 'attack_active'\n      : attackSnapshot.phase;\n    const resolution = outcomeGate.resolve({\n      attackSequence: attackSnapshot.sequence,\n      attackDirection: attackSnapshot.direction,\n      attackPhase: effectiveAttackPhase,\n      contact,`,
    'two-actor outcome phase authority',
  );
  next = replaceOnce(
    next,
    `    const interrupted = attackRuntime.interrupt({ resolution });`,
    `    const interrupted = attackRuntime.interrupt({\n      resolution,\n      contactTemporalEligibility: sweptTemporalAuthority ? temporalEligibility : null,\n    });`,
    'two-actor interruption temporal handoff',
  );
  return next;
});

update('src/combat/longsword-directional-attack-runtime.js', (source) => {
  if (source.includes('SWEPT_CONTACT_TEMPORAL_ELIGIBILITY_AUTHORITY')) {
    throw new Error('R18N.3 v6.4 attack runtime migration expects clean base');
  }
  let next = `import {\n  SWEPT_CONTACT_TEMPORAL_ELIGIBILITY_AUTHORITY,\n} from './swept-contact-temporal-eligibility.js';\n${source}`;
  next = replaceOnce(
    next,
    `    const profile = active.runtime;\n    const sourceTimeSeconds = clamp(elapsedMs / 1000, 0, profile.durationSeconds);\n    const phaseAtInterrupt = getLongswordAttackPhase(profile, sourceTimeSeconds);\n    if (phaseAtInterrupt !== LONGSWORD_ATTACK_PHASES.ACTIVE && input.allowOutsideActive !== true) {`,
    `    const profile = active.runtime;\n    const contactTemporalEligibility = input.contactTemporalEligibility || null;\n    const sweptTemporalAuthority = contactTemporalEligibility?.authority === SWEPT_CONTACT_TEMPORAL_ELIGIBILITY_AUTHORITY\n      && contactTemporalEligibility.eligible === true\n      && Number.isFinite(Number(contactTemporalEligibility.contactElapsedSeconds));\n    const sourceTimeSeconds = clamp(\n      sweptTemporalAuthority\n        ? Number(contactTemporalEligibility.contactElapsedSeconds)\n        : elapsedMs / 1000,\n      0,\n      profile.durationSeconds,\n    );\n    const phaseAtInterrupt = getLongswordAttackPhase(profile, sourceTimeSeconds);\n    if (phaseAtInterrupt !== LONGSWORD_ATTACK_PHASES.ACTIVE && input.allowOutsideActive !== true) {`,
    'attack interruption source time authority',
  );
  next = replaceOnce(
    next,
    `      sourceTimeSeconds,\n      elapsedMs,\n      phaseAtInterrupt,`,
    `      sourceTimeSeconds,\n      elapsedMs: sourceTimeSeconds * 1000,\n      frameEndElapsedMs: elapsedMs,\n      contactTemporalAuthority: sweptTemporalAuthority\n        ? SWEPT_CONTACT_TEMPORAL_ELIGIBILITY_AUTHORITY\n        : 'legacy-frame-end-source-time',\n      phaseAtInterrupt,`,
    'attack interruption temporal telemetry',
  );
  return next;
});

console.log('R18N.3 v6.4 swept contact temporal eligibility applied.');
