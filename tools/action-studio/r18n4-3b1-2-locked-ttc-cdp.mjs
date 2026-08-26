import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, '')] = argv[i + 1];
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.browser || !args.url || !args.label || !args.output) {
  throw new Error('required: --browser --url --label --output');
}
if (!globalThis.WebSocket) throw new Error('Node WebSocket global is required');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'r18n-cdp-'));
const browser = spawn(args.browser, [
  '--headless', '--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader', '--hide-scrollbars',
  '--window-size=1400,900', '--remote-debugging-port=9222', `--user-data-dir=${userDataDir}`, 'about:blank',
], { stdio: 'ignore' });

async function waitForJsonList() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:9222/json/list');
      if (response.ok) {
        const list = await response.json();
        const page = list.find((item) => item.type === 'page');
        if (page?.webSocketDebuggerUrl) return page;
      }
    } catch {}
    await sleep(100);
  }
  throw new Error('Chrome DevTools endpoint did not become ready');
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
  }
  async open() {
    this.ws = new WebSocket(this.url);
    this.ws.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    };
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
    return result.result?.value;
  }
  close() { this.ws?.close(); }
}

const captureExpression = `(() => {
  const api = window.__G43B5R281_LAB__;
  if (!api?.defender || !api?.buckler) return null;
  const THREE = window.THREE;
  const snap = api.attackRuntime.snapshot;
  const contactSeconds = Number(snap?.contactSeconds ?? snap?.action?.runtime?.contactSeconds);
  const elapsedSeconds = Number(snap?.elapsedSeconds ?? 0);
  const point = (object) => {
    if (!object?.getWorldPosition) return null;
    const v = new THREE.Vector3();
    object.getWorldPosition(v);
    return { x: v.x, y: v.y, z: v.z };
  };
  const quat = (boneId) => {
    const q = api.defender.rig?.bones?.[boneId]?.quaternion;
    return q ? { x: q.x, y: q.y, z: q.z, w: q.w } : null;
  };
  const bonePoint = (boneId) => point(api.defender.rig?.bones?.[boneId]);
  const surface = api.buckler.getWorldParrySurface();
  return {
    sequence: snap?.sequence ?? null,
    phase: snap?.phase ?? null,
    elapsedMs: elapsedSeconds * 1000,
    ttcMs: Number.isFinite(contactSeconds) ? Math.max(0, (contactSeconds - elapsedSeconds) * 1000) : null,
    inputTtcMs: api.latestParryInput?.timeToContactSeconds == null ? null : api.latestParryInput.timeToContactSeconds * 1000,
    targetCenter: api.activeParryInterceptIntent?.report?.targetCenter || null,
    surfaceCenter: surface?.center ? { x: surface.center.x, y: surface.center.y, z: surface.center.z } : null,
    upperarm: { position: bonePoint('upperarm.l'), quaternion: quat('upperarm.l') },
    lowerarm: { position: bonePoint('lowerarm.l'), quaternion: quat('lowerarm.l') },
    wrist: { position: bonePoint('wrist.l'), quaternion: quat('wrist.l') },
    hand: { position: bonePoint('hand.l'), quaternion: quat('hand.l') },
    handslot: { position: bonePoint('handslot.l'), quaternion: quat('handslot.l') },
    realContact: api.latestContact?.contact === true,
    parryConfirmed: api.latestParryConfirmation?.accepted === true,
    whiff: Boolean(api.latestParryWhiff),
    latestInterceptDriveReport: api.latestInterceptDriveReport ? {
      targetErrorBefore: api.latestInterceptDriveReport.activeInterceptTargetErrorBeforeMeters,
      targetErrorAfter: api.latestInterceptDriveReport.activeInterceptTargetErrorAfterMeters,
      correctionDirectionDot: api.latestInterceptDriveReport.correctionDirectionDot,
      topProbe: api.latestInterceptDriveReport.topDirectionCompatibilityProbe || null,
    } : null,
  };
})()`;

async function waitFor(client, expression, timeoutMs = 10000, intervalMs = 10) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await client.evaluate(expression);
    if (value) return value;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function runTrial(client, trialIndex) {
  if (trialIndex === 0) {
    const started = await client.evaluate(`(() => {
      const api = window.__G43B5R281_LAB__;
      api.setMode('parry');
      document.getElementById('slowReview').checked = true;
      document.getElementById('autoRepeat').checked = false;
      return api.startAttack('top');
    })()`);
    if (!started) throw new Error('startAttack(top) rejected');
  } else {
    const restarted = await client.evaluate(`window.__G43B5R281_LAB__.restartAttack('top')`);
    if (!restarted) throw new Error(`restartAttack(top) rejected for trial ${trialIndex}`);
  }

  await waitFor(client, `window.__G43B5R281_LAB__?.latestParryOpportunity?.accepted === true`, 15000, 5);
  const beforeInput = await client.evaluate(captureExpression);
  const input = await client.evaluate(`window.__G43B5R281_LAB__.dispatchParryInput('locked-ttc-r18n4-3b1-2')`);
  if (!input?.accepted) throw new Error(`Parry input rejected: ${JSON.stringify(input)}`);
  const afterInput = await client.evaluate(captureExpression);

  const checkpoints = [150, 120, 90, 60, 30, 10, 0];
  const samples = {};
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const sample = await client.evaluate(captureExpression);
    if (!sample) { await sleep(5); continue; }
    for (const checkpoint of checkpoints) {
      if (samples[checkpoint] == null && sample.ttcMs != null && sample.ttcMs <= checkpoint + 0.5) {
        samples[checkpoint] = sample;
      }
    }
    if (sample.realContact && sample.parryConfirmed) {
      return { trialIndex, beforeInput, afterInput, samples, terminal: sample };
    }
    if (sample.whiff) throw new Error(`TOP replay whiffed on trial ${trialIndex}`);
    await sleep(5);
  }
  throw new Error(`TOP replay did not reach confirmed real contact on trial ${trialIndex}`);
}

let client;
try {
  const page = await waitForJsonList();
  client = new CdpClient(page.webSocketDebuggerUrl);
  await client.open();
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Page.navigate', { url: args.url });
  await waitFor(client, `Boolean(window.__G43B5R281_LAB__ && document.documentElement.dataset.g43b5r281 === 'pass')`, 30000, 50);

  const trials = [];
  for (let i = 0; i < 3; i += 1) trials.push(await runTrial(client, i));
  const output = { stage: 'R18N.4.3-B.1.2', label: args.label, url: args.url, trials };
  await mkdir(path.dirname(args.output), { recursive: true });
  await writeFile(args.output, JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
} finally {
  client?.close();
  browser.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => browser.once('exit', resolve)),
    sleep(2000),
  ]);
  await rm(userDataDir, { recursive: true, force: true });
}
