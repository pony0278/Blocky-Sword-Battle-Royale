import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.argv[2];
if (!root) throw new Error('usage: node r18n4-3b1-2-inject-readonly-pose-debug.mjs <checkout-root>');

const entryPath = path.join(root, 'tools/action-studio/shield-driven-contact-coupling-lab-r281.js');
const debugApiPath = path.join(root, 'tools/action-studio/shield-parry-r281/debug-api.js');

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`ambiguous ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

let entry = await readFile(entryPath, 'utf8');
entry = replaceOnce(
  entry,
  `    residualStanceReachRuntime,\n    swordGripConstraint,\n  },\n  debugMode: DEBUG_MODE,`,
  `    residualStanceReachRuntime,\n    swordGripConstraint,\n    defender,\n    buckler,\n    activeParryInterceptIntent,\n  },\n  debugMode: DEBUG_MODE,`,
  'debug runtime exposure block',
);
await writeFile(entryPath, entry);

let debugApi = await readFile(debugApiPath, 'utf8');
debugApi = replaceOnce(
  debugApi,
  `    swordGripConstraint: runtimes.swordGripConstraint,\n    triggerParryNow: actions.triggerParryNow,`,
  `    swordGripConstraint: runtimes.swordGripConstraint,\n    defender: runtimes.defender,\n    buckler: runtimes.buckler,\n    activeParryInterceptIntent: runtimes.activeParryInterceptIntent,\n    triggerParryNow: actions.triggerParryNow,`,
  'debug api read-only runtime exposure',
);
await writeFile(debugApiPath, debugApi);

console.log(`R18N.4.3-B.1.2 read-only pose debug injected into ${root}`);
