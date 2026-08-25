import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const browser = process.env.BROWSER;
if (!browser) throw new Error('R18N.1 probe requires BROWSER');
const debugPort = Number(process.env.R18N1_DEBUG_PORT || 9441);
const pageUrl = process.env.R18N1_PAGE_URL || 'http://127.0.0.1:4175/tools/action-studio/shield-driven-contact-coupling-lab.html';
const profileDir = mkdtempSync(join(tmpdir(), 'r18n1-chrome-'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const chrome = spawn(browser, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader',
  '--hide-scrollbars', '--remote-allow-origins=*', `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`, '--window-size=1440,1000', pageUrl,
], { stdio: ['ignore', 'ignore', 'inherit'] });

async function pageTarget() {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json());
      const target = targets.find((item) => item.type === 'page' && item.url.includes('shield-driven-contact-coupling-lab.html'));
      if (target?.webSocketDebuggerUrl) return target;
    } catch {}
    await sleep(100);
  }
  throw new Error('R18N.1 probe could not attach to standalone lab');
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
async function waitFor(expression, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await sleep(20);
  }
  const state = await evaluate(`({
    href: location.href,
    readyState: document.readyState,
    status: document.querySelector('#status')?.textContent ?? null,
    dataset: document.documentElement.dataset.g43b5r281 ?? null,
    snapshot: window.__G43B5R281_LAB__?.attackRuntime?.snapshot ?? null,
  })`);
  throw new Error(`R18N.1 probe timeout waiting for ${expression}; state=${JSON.stringify(state)}`);
}

await cdp('Runtime.enable');
await waitFor("window.__G43B5R281_LAB__ && document.documentElement.dataset.g43b5r281 !== 'fail'");
await waitFor("window.__G43B5R281_LAB__.attackRuntime.snapshot?.action && window.__G43B5R281_LAB__.attackRuntime.snapshot.direction === 'right'");

async function diagnoseDirection(direction) {
  const restarted = await evaluate(`window.__G43B5R281_LAB__.restartAttack(${JSON.stringify(direction)})`);
  if (restarted !== true) throw new Error(`R18N.1 could not restart ${direction} attack`);
  const timelineWindow = `(() => { const s = window.__G43B5R281_LAB__.attackRuntime.snapshot; const r = s?.action?.runtime; if (!r || s.direction !== ${JSON.stringify(direction)}) return false; const ttc = Number(r.contactSeconds) - Number(s.elapsedSeconds); return Number(s.elapsedSeconds) >= Number(r.movementStartSeconds) && ttc >= 0.08 && ttc <= 0.16; })()`;
  await waitFor(timelineWindow);
  const inputResult = await evaluate(`window.__G43B5R281_LAB__.dispatchParryInput('r18n1-browser-probe')`);
  await waitFor(`window.__G43B5R281_LAB__.latestInterceptDriveReport?.drivePlanSource === 'latched-f-active-intercept-intent'`);
  const first = await evaluate(`({
    drive: window.__G43B5R281_LAB__.latestInterceptDriveReport,
    motion: window.__G43B5R281_LAB__.latestShieldLeadMotion,
    diagnosis: window.__G43B5R281_LAB__.activeParryInterceptDiagnosis,
    presentation: window.__G43B5R281_LAB__.predictivePresentation?.report ?? null,
  })`);

  const samples = [];
  const started = Date.now();
  while (Date.now() - started < 900) {
    const sample = await evaluate(`({
      drive: window.__G43B5R281_LAB__.latestInterceptDriveReport,
      motion: window.__G43B5R281_LAB__.latestShieldLeadMotion,
      confirmation: window.__G43B5R281_LAB__.latestParryConfirmation,
      whiff: window.__G43B5R281_LAB__.latestParryWhiff,
    })`);
    if (sample.drive?.drivePlanSource === 'latched-f-active-intercept-intent') {
      samples.push({
        required: sample.drive.planRequiredDistanceMeters,
        applied: sample.drive.planAppliedDistanceMeters,
        achieved: sample.drive.trackingAchievedDistanceMeters,
        shieldStep: sample.drive.shieldStepTranslationMeters,
        motionTranslation: sample.motion?.translationMeters ?? null,
      });
    }
    if (sample.confirmation?.accepted === true || sample.whiff) break;
    await sleep(8);
  }
  await waitFor(`window.__G43B5R281_LAB__.latestParryConfirmation?.accepted === true || window.__G43B5R281_LAB__.latestParryWhiff`);
  const final = await evaluate(`({
    drive: window.__G43B5R281_LAB__.latestInterceptDriveReport,
    motion: window.__G43B5R281_LAB__.latestShieldLeadMotion,
    confirmation: window.__G43B5R281_LAB__.latestParryConfirmation,
    whiff: window.__G43B5R281_LAB__.latestParryWhiff,
    diagnosis: window.__G43B5R281_LAB__.activeParryInterceptDiagnosis,
  })`);
  return { direction, inputResult, first, samples, final };
}

try {
  const top = await diagnoseDirection('top');
  const right = await diagnoseDirection('right');
  console.log(`R18N1_PROBE_JSON=${JSON.stringify({ stage: 'R18N.1', top, right })}`);
} finally {
  socket.close();
  chrome.kill('SIGTERM');
  rmSync(profileDir, { recursive: true, force: true });
}
