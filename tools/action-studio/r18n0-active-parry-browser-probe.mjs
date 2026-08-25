import { spawn } from 'node:child_process';

const browser = process.env.BROWSER;
if (!browser) throw new Error('R18N.0 probe requires BROWSER');
const debugPort = Number(process.env.R18N0_DEBUG_PORT || 9223);
const pageUrl = process.env.R18N0_PAGE_URL || 'http://127.0.0.1:4174/tools/action-studio/shield-driven-contact-coupling-lab.html';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const chrome = spawn(browser, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader', '--hide-scrollbars',
  '--remote-allow-origins=*', `--remote-debugging-port=${debugPort}`, '--window-size=1440,1000', pageUrl,
], { stdio: ['ignore', 'ignore', 'inherit'] });

async function pageTarget() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json());
      const target = targets.find((item) => item.type === 'page' && item.url.includes('shield-driven-contact-coupling-lab.html'));
      if (target?.webSocketDebuggerUrl) return target;
    } catch {}
    await sleep(100);
  }
  throw new Error('R18N.0 probe could not attach to standalone lab');
}

const target = await pageTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let commandId = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});
function cdp(method, params = {}) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'browser evaluation failed');
  return result.result?.value;
}
async function waitFor(expression, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await sleep(20);
  }
  const snapshot = await evaluate(`window.__G43B5R281_LAB__?.attackRuntime?.snapshot`);
  throw new Error(`R18N.0 probe timeout waiting for ${expression}; snapshot=${JSON.stringify(snapshot)}`);
}

await cdp('Runtime.enable');
await waitFor("window.__G43B5R281_LAB__ && document.documentElement.dataset.g43b5r281 !== 'fail'");

async function diagnoseDirection(direction) {
  const restarted = await evaluate(`window.__G43B5R281_LAB__.restartAttack(${JSON.stringify(direction)})`);
  if (restarted !== true) throw new Error(`R18N.0 could not restart ${direction} attack`);
  const timelineWindow = `(() => { const s = window.__G43B5R281_LAB__.attackRuntime.snapshot; const r = s?.action?.runtime; if (!r || s.direction !== ${JSON.stringify(direction)}) return false; const ttc = Number(r.contactSeconds) - Number(s.elapsedSeconds); return Number(s.elapsedSeconds) >= Number(r.movementStartSeconds) && ttc >= 0.08 && ttc <= 0.16; })()`;
  await waitFor(timelineWindow);
  const timelineAtInput = await evaluate(`(() => { const s = window.__G43B5R281_LAB__.attackRuntime.snapshot; const r = s?.action?.runtime; return { direction: s.direction, elapsedSeconds: s.elapsedSeconds, movementStartSeconds: r?.movementStartSeconds ?? null, contactSeconds: r?.contactSeconds ?? null, timeToContactMs: r ? (r.contactSeconds - s.elapsedSeconds) * 1000 : null }; })()`);
  const opportunity = await evaluate(`window.__G43B5R281_LAB__.latestParryOpportunity`);
  const beforeInput = await evaluate(`window.__G43B5R281_LAB__.activeParryInterceptDiagnosis`);
  const inputResult = await evaluate(`window.__G43B5R281_LAB__.dispatchParryInput('r18n0-browser-probe')`);
  const afterInput = await evaluate(`window.__G43B5R281_LAB__.activeParryInterceptDiagnosis`);
  await waitFor(`window.__G43B5R281_LAB__.latestParryConfirmation?.accepted === true || window.__G43B5R281_LAB__.latestParryWhiff`);
  const final = await evaluate(`window.__G43B5R281_LAB__.activeParryInterceptDiagnosis`);
  const whiff = await evaluate(`window.__G43B5R281_LAB__.latestParryWhiff`);
  return { direction, timelineAtInput, opportunity, beforeInput, inputResult, afterInput, final, whiff };
}

try {
  const top = await diagnoseDirection('top');
  const right = await diagnoseDirection('right');
  const output = { stage: 'R18N.0', top, right };
  console.log(`R18N0_PROBE_JSON=${JSON.stringify(output)}`);
} finally {
  socket.close();
  chrome.kill('SIGTERM');
}
