import { readFile, writeFile } from 'node:fs/promises';

const path = 'tools/action-studio/r18m6-contract-patch.mjs';
let source = await readFile(path, 'utf8');
const oldBlock = `gate = replaceOnce(
  gate,
  "const resolve = functionBody('resolveContact', 'updateHud');",
  "const resolve = contactHandoffFunctionBody('resolveContact', 'updateCombatBeforeGuard');",
  'Step3A gate resolve ownership',
);
gate = replaceOnce(
  gate,
  "const resolve = functionBody('resolveContact', 'updateHud');",
  "const resolve = contactHandoffFunctionBody('resolveContact', 'updateCombatBeforeGuard');",
  'Step2 block fallback resolve ownership',
);`;
const newBlock = `const gateResolveNeedle = "const resolve = functionBody('resolveContact', 'updateHud');";
const gateResolveReplacement = "const resolve = contactHandoffFunctionBody('resolveContact', 'updateCombatBeforeGuard');";
const gateResolveCount = countOccurrences(gate, gateResolveNeedle);
if (gateResolveCount !== 2) throw new Error(\`committed gate resolve ownership: expected 2 occurrences, found \${gateResolveCount}\`);
gate = gate.replaceAll(gateResolveNeedle, gateResolveReplacement);`;
const count = source.split(oldBlock).length - 1;
if (count !== 1) throw new Error(`R18M.6 wrapper expected one duplicate-resolve patch block, found ${count}`);
source = source.replace(oldBlock, newBlock);
await writeFile(path, source, 'utf8');
await import('./r18m6-contract-patch.mjs?exact-two-resolve');
