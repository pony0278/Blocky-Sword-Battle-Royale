import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const browser = process.env.BROWSER;
if (!browser) throw new Error('R18N.3 v6.4 probe requires BROWSER');
const debugPort = Number(process.env.R18N3_V64_DEBUG_PORT || 9465);
const pageUrl = process.env.R18N3_V64_PAGE_URL || 'http://127.0.0.1:4175/tools/action-studio/shield-driven-contact-coupling-lab.html';
const targetTtc = Number(process.env.R18N3_V64_TTC || 0.110);
const hitchAtSeconds = Number(process.env.R18N3_V64_HITCH_AT || 0.235);
const hitchMs = Number(process.env.R18N3_V64_HITCH_MS || 55);
const trialCount = Number(process.env.R18N3_V64_TRIALS || 4);
const profileDir = mkdtempSync(join(tmpdir(), 'r18n3-v64-chrome-'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const chrome = spawn(browser, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader',
  '--hide-scrollbars', '--remote-allow-origins=*', `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`, '--window-size=1440,1000', pageUrl,
], { stdio: ['ignore', 'ignore', 'inherit'] });

async function pageTarget() {
  for (let i = 0; i < 180; i += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((r) => r.json());
      const page = targets.find((item) => item.type === 'page' && item.url.includes('shield-driven-contact-coupling-lab.html'));
      if (page?.webSocketDebuggerUrl) return page;
    } catch {}
    await sleep(100);
  }
  throw new Error('R18N.3 v6.4 could not attach to lab');
}

const target = await pageTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let id = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  const entry = pending.get(message.id);
  if (!entry) return;
  pending.delete(message.id);
  if (message.error) entry.reject(new Error(message.error.message));
  else entry.resolve(message.result);
});
function cdp(method, params = {}) {
  const commandId = ++id;
  socket.send(JSON.stringify({ id: commandId, method, params }));
  return new Promise((resolve, reject) => pending.set(commandId, { resolve, reject }));
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'browser evaluation failed');
  return result.result?.value;
}
async function waitFor(expression, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await sleep(8);
  }
  throw new Error(`timeout waiting for ${expression}`);
}

await cdp('Runtime.enable');
await waitFor("window.__G43B5R281_LAB__ && document.documentElement.dataset.g43b5r281 !== 'fail'");
await waitFor('window.__G43B5R281_LAB__.attackRuntime.snapshot?.action');

async function runTrial(index) {
  const restarted = await evaluate("window.__G43B5R281_LAB__.restartAttack('right')");
  if (restarted !== true) throw new Error(`RIGHT restart failed for v6.4 trial ${index}`);
  await waitFor("window.__G43B5R281_LAB__.attackRuntime.snapshot?.direction === 'right'");

  const setup = await evaluate(`new Promise((resolve, reject) => {
    const lab = window.__G43B5R281_LAB__;
    const targetTtc = ${JSON.stringify(targetTtc)};
    const hitchAt = ${JSON.stringify(hitchAtSeconds)};
    const hitchMs = ${JSON.stringify(hitchMs)};
    const deadline = performance.now() + 3000;
    let dispatched = null;
    function tick() {
      const s = lab?.attackRuntime?.snapshot;
      const r = s?.action?.runtime;
      if (!s || !r || s.direction !== 'right') {
        if (performance.now() > deadline) return reject(new Error('RIGHT runtime missing'));
        return requestAnimationFrame(tick);
      }
      const elapsed = Number(s.elapsedSeconds);
      const ttc = Number(r.contactSeconds) - elapsed;
      if (!dispatched && elapsed >= Number(r.movementStartSeconds) && ttc > 0 && ttc <= targetTtc) {
        const result = lab.dispatchParryInput(${JSON.stringify(`r18n3-v64-${index}`)});
        if (result?.accepted !== true) return reject(new Error('F rejected'));
        dispatched = { actualTtc: ttc, inputElapsedSeconds: elapsed };
      }
      if (dispatched && elapsed >= hitchAt && s.phase === 'attack_active') {
        const before = performance.now();
        while (performance.now() - before < hitchMs) {}
        return resolve({
          dispatched,
          hitch: { requestedMs: hitchMs, actualMs: performance.now() - before, beforeElapsedSeconds: elapsed },
        });
      }
      if (performance.now() > deadline) return reject(new Error('hitch scheduling deadline'));
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })`);

  await waitFor('window.__G43B5R281_LAB__.latestParryConfirmation?.accepted === true || window.__G43B5R281_LAB__.latestParryWhiff', 5000);
  const outcome = await evaluate(`(() => {
    const lab = window.__G43B5R281_LAB__;
    const contact = lab.latestContact || null;
    const temporal = contact?.temporalEligibility || null;
    const confirmation = lab.latestParryConfirmation || null;
    const combatResult = lab.latestCombatResult || null;
    const interruption = lab.attackRuntime?.snapshot?.interruption || null;
    return {
      confirmed: confirmation?.accepted === true,
      confirmationReason: confirmation?.reason ?? null,
      whiff: Boolean(lab.latestParryWhiff),
      contact: contact?.contact === true,
      geometricContact: contact?.geometricContact === true,
      contactReason: contact?.reason ?? null,
      sweepAlpha: contact?.sweepAlpha ?? null,
      temporalAuthority: temporal?.authority ?? null,
      temporalEligible: temporal?.eligible ?? null,
      contactElapsedSeconds: temporal?.contactElapsedSeconds ?? null,
      activeStartSeconds: temporal?.activeStartSeconds ?? null,
      activeEndSeconds: temporal?.activeEndSeconds ?? null,
      frameEndElapsedSeconds: temporal?.frameEndElapsedSeconds ?? null,
      frameEndPhase: temporal?.frameEndPhase ?? null,
      frameEndPhaseActive: temporal?.frameEndPhaseActive ?? null,
      combatAccepted: combatResult?.accepted === true,
      interruptionSourceTimeSeconds: interruption?.sourceTimeSeconds ?? null,
      interruptionPhaseAtInterrupt: interruption?.phaseAtInterrupt ?? null,
      interruptionFrameEndElapsedMs: interruption?.frameEndElapsedMs ?? null,
      interruptionTemporalAuthority: interruption?.contactTemporalAuthority ?? null,
    };
  })()`);

  return { trial: index, targetTtc, hitchAtSeconds, hitch: setup.hitch, ...setup.dispatched, ...outcome };
}

async function cleanup() {
  try { socket.close(); } catch {}
  if (chrome.exitCode === null) chrome.kill('SIGTERM');
  await sleep(250);
  if (chrome.exitCode === null) chrome.kill('SIGKILL');
  try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
}

try {
  const trials = [];
  for (let i = 1; i <= trialCount; i += 1) {
    const trial = await runTrial(i);
    trials.push(trial);
    console.log(`R18N3_V64_TRIAL=${JSON.stringify(trial)}`);
    await sleep(70);
  }
  console.log(`R18N3_V64_PROBE_JSON=${JSON.stringify({
    stage: 'R18N.3-v6.4-swept-contact-temporal-eligibility',
    targetTtc,
    hitchAtSeconds,
    hitchMs,
    trials,
    confirmed: trials.filter((row) => row.confirmed).length,
    whiffs: trials.filter((row) => row.whiff).length,
  })}`);
} finally {
  await cleanup();
}
