import { execFileSync, spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';

const direction = String(process.env.R18N_DIRECTION || 'top').toLowerCase();
const targetTtcSeconds = Number(process.env.R18N_TARGET_TTC || 0.158);
const label = String(process.env.R18N_LABEL || `${direction}-${Math.round(targetTtcSeconds * 1000)}`);
const expectHold = String(process.env.R18N_EXPECT_HOLD || 'true') === 'true';
const port = Number(process.env.R18N_HTTP_PORT || 4193);
const debugPort = Number(process.env.R18N_DEBUG_PORT || 9233);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function commandPath(name) {
  try { return execFileSync('bash', ['-lc', `command -v ${name}`], { encoding: 'utf8' }).trim(); }
  catch { return ''; }
}

const browser = commandPath('google-chrome') || commandPath('chromium') || commandPath('chromium-browser');
if (!browser) throw new Error('No Chrome/Chromium executable available');

const profile = `/tmp/r18n4-3b1-3-${label}-${process.pid}`;
const server = spawn('python3', ['-m', 'http.server', String(port)], { stdio: 'ignore' });
const chrome = spawn(browser, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

async function cleanup() {
  try { chrome.kill('SIGTERM'); } catch {}
  try { server.kill('SIGTERM'); } catch {}
}
process.on('exit', () => { try { chrome.kill('SIGTERM'); } catch {}; try { server.kill('SIGTERM'); } catch {}; });

async function waitFor(labelText, predicate, timeoutMs = 60000, intervalMs = 25) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeoutMs) {
    try { if (await predicate()) return; } catch (error) { lastError = error; }
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for ${labelText}${lastError ? `: ${lastError.message}` : ''}`);
}

async function openPage() {
  await waitFor('Chrome CDP', async () => {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`).catch(() => null);
    return response?.ok === true;
  }, 30000, 100);
  const pageUrl = `http://127.0.0.1:${port}/tools/action-studio/shield-driven-contact-coupling-lab.html?debug=1`;
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(pageUrl)}`, { method: 'PUT' });
  if (!response.ok) throw new Error(`CDP target creation failed: ${response.status}`);
  const target = await response.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const requestId = ++id;
    pending.set(requestId, { resolve, reject });
    ws.send(JSON.stringify({ id: requestId, method, params }));
  });
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Runtime.evaluate failed');
    return result.result?.value;
  }
  await send('Runtime.enable');
  await waitFor('R281 lab boot', () => evaluate(`Boolean(window.__G43B5R281_LAB__?.attackRuntime?.snapshot?.action && window.__G43B5R281_RESULT__ && document.documentElement.dataset.g43b5r281 !== 'fail')`), 90000);
  return { ws, evaluate };
}

const recorder = `(() => {
  window.__R18N43B13_CAPTURE__ = [];
  window.__R18N43B13_STOP__ = false;
  let lastElapsed = null;
  const compact = () => {
    const api = window.__G43B5R281_LAB__;
    const drive = api?.latestInterceptDriveReport;
    const hold = drive?.topPrepReadabilityHold;
    const ownership = api?.latestVisualOwnershipBaseline;
    const target = drive?.activeInterceptIntent?.targetCenter || null;
    return {
      attackElapsedMs: Number.isFinite(api?.attackRuntime?.snapshot?.elapsedSeconds) ? api.attackRuntime.snapshot.elapsedSeconds * 1000 : null,
      ttcMs: Number.isFinite(drive?.timeToContactSeconds) ? drive.timeToContactSeconds * 1000 : null,
      presentationElapsedMs: api?.latestPredictiveReport?.presentationElapsedMs ?? null,
      targetCenter: target ? { x: target.x, y: target.y, z: target.z } : null,
      targetErrorAfterMeters: drive?.activeInterceptTargetErrorAfterMeters ?? null,
      shieldStepTranslationMeters: drive?.shieldStepTranslationMeters ?? null,
      hold: hold ? {
        stage: hold.stage, active: hold.active, applied: hold.applied, reason: hold.reason,
        anchorCaptured: hold.anchorCaptured ?? false,
        envelopeWeight: hold.envelopeWeight, appliedBones: hold.appliedBones || [],
        upperDegrees: hold.bones?.['upperarm.l']?.targetAngleDegrees ?? 0,
        lowerDegrees: hold.bones?.['lowerarm.l']?.targetAngleDegrees ?? 0,
        wristSolverOnly: hold.bones?.['wrist.l']?.solverOnly ?? true,
        finalPoseOwner: hold.finalPoseOwner ?? null, authority: hold.authority ?? null,
      } : null,
      writerOrderValid: ownership?.orderValid ?? null,
      writerOrderViolations: ownership?.orderViolations ?? [],
      realContact: api?.latestContact?.contact === true,
      parryConfirmed: api?.latestParryConfirmation?.accepted === true,
      whiff: Boolean(api?.latestParryWhiff),
    };
  };
  window.__R18N43B13_COMPACT__ = compact;
  const tick = () => {
    const sample = compact();
    if (sample.attackElapsedMs !== lastElapsed) { lastElapsed = sample.attackElapsedMs; window.__R18N43B13_CAPTURE__.push(sample); }
    if (!window.__R18N43B13_STOP__ && !sample.realContact && !sample.whiff) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return true;
})()`;

function targetDrift(samples) {
  const targets = samples.map((sample) => sample.targetCenter).filter(Boolean);
  if (targets.length < 2) return 0;
  const first = targets[0];
  return Math.max(...targets.map((target) => Math.hypot(target.x - first.x, target.y - first.y, target.z - first.z)));
}

let evidence = null;
let page = null;
try {
  page = await openPage();
  const { evaluate } = page;
  const restarted = await evaluate(`window.__G43B5R281_LAB__.restartAttack('${direction}')`);
  if (!restarted) throw new Error(`${label}: restartAttack rejected`);
  const sequence = await evaluate(`window.__G43B5R281_LAB__.attackRuntime.snapshot.sequence`);
  await waitFor(`${label} legal Parry prompt`, () => evaluate(`window.__G43B5R281_LAB__.attackRuntime.snapshot.sequence === ${Number(sequence)} && window.__G43B5R281_LAB__.latestParryOpportunity?.accepted === true`), 45000, 20);
  await evaluate(recorder);
  const input = await evaluate(`new Promise((resolve, reject) => {
    const api = window.__G43B5R281_LAB__; const targetTtc = ${targetTtcSeconds}; const deadline = performance.now() + 15000;
    const tick = () => {
      const snapshot = api?.attackRuntime?.snapshot;
      const contactSeconds = Number(snapshot?.contactSeconds ?? snapshot?.action?.runtime?.contactSeconds);
      const elapsedSeconds = Number(snapshot?.elapsedSeconds);
      const ttc = Number.isFinite(contactSeconds) && Number.isFinite(elapsedSeconds) ? contactSeconds - elapsedSeconds : NaN;
      if (!snapshot?.action) return reject(new Error('attack-ended-before-${label}'));
      if (performance.now() > deadline) return reject(new Error('ttc-dispatch-timeout-${label}'));
      if (api?.latestParryOpportunity?.accepted === true && Number.isFinite(ttc) && ttc <= targetTtc && ttc > 0.02) return resolve({ input: api.dispatchParryInput('r18n4-3b1-3-${label}'), acceptedTtcSeconds: ttc });
      requestAnimationFrame(tick);
    }; requestAnimationFrame(tick);
  })`);
  if (!input?.input?.accepted) throw new Error(`${label}: Parry input rejected ${input?.input?.reason || 'unknown'}`);
  await waitFor(`${label} real contact or whiff`, () => evaluate(`Boolean(window.__G43B5R281_LAB__.latestContact?.contact === true || window.__G43B5R281_LAB__.latestParryWhiff || !window.__G43B5R281_LAB__.attackRuntime.snapshot.action)`), 30000, 20);
  await evaluate(`window.__R18N43B13_STOP__ = true`);
  const captured = await evaluate(`({ samples: window.__R18N43B13_CAPTURE__ || [], terminal: window.__R18N43B13_COMPACT__?.() || null })`);
  const samples = captured.samples || [];
  const terminal = captured.terminal || null;
  const holdSamples = samples.filter((sample) => sample.hold?.stage === 'R18N.4.3-B.1.3');
  const activeHold = holdSamples.filter((sample) => sample.hold?.active === true);
  const appliedHold = activeHold.filter((sample) => sample.hold?.applied === true);
  const drift = targetDrift(samples);
  const releasedBeforeContact = holdSamples.some((sample) => !sample.realContact && (sample.presentationElapsedMs ?? 0) >= 80 && (sample.hold?.envelopeWeight ?? 1) <= 0.001);
  const issues = [];
  if (!terminal?.realContact || !terminal?.parryConfirmed || terminal?.whiff) issues.push('real-contact-terminal');
  if (samples.some((sample) => sample.writerOrderValid === false)) issues.push('writer-order');
  if (drift > 1e-9) issues.push(`target-drift:${drift}`);
  if (!holdSamples.length) issues.push('missing-hold-telemetry');
  if (holdSamples.some((sample) => (sample.hold?.envelopeWeight ?? 0) > 1.000001)) issues.push('envelope-cap');
  if (holdSamples.some((sample) => (sample.hold?.upperDegrees ?? 0) > 6.000001)) issues.push('upper-cap');
  if (holdSamples.some((sample) => (sample.hold?.lowerDegrees ?? 0) > 8.000001)) issues.push('lower-cap');
  if (holdSamples.some((sample) => sample.hold?.wristSolverOnly !== true)) issues.push('wrist-not-solver-only');
  if (holdSamples.some((sample) => sample.hold?.finalPoseOwner && sample.hold.finalPoseOwner !== 'active-intercept-final-arm-closure')) issues.push('final-owner');
  if (holdSamples.some((sample) => sample.hold?.authority && sample.hold.authority !== 'presentation-readability-local-pose-before-final-closure-no-contact-authority')) issues.push('authority');
  if (expectHold) {
    if (activeHold.length < 2) issues.push(`active-hold-frames:${activeHold.length}`);
    if (!appliedHold.length) issues.push('hold-never-applied');
    if (!releasedBeforeContact) issues.push('not-released-before-contact');
    if (!holdSamples.some((sample) => sample.hold?.anchorCaptured === true)) issues.push('golden-anchor-not-captured');
  } else if (activeHold.length || appliedHold.length) issues.push('non-top-hold-active');
  const firstActive = activeHold[0] || null;
  const firstStep = firstActive?.shieldStepTranslationMeters ?? null;
  evidence = {
    stage: 'R18N.4.3-B.1.3', label, direction, requestedTtcMs: targetTtcSeconds * 1000,
    acceptedTtcMs: input.acceptedTtcSeconds * 1000, sequence,
    sampleCount: samples.length, holdSampleCount: holdSamples.length,
    activeHoldFrames: activeHold.length, appliedHoldFrames: appliedHold.length,
    maxEnvelope: holdSamples.length ? Math.max(...holdSamples.map((s) => s.hold?.envelopeWeight ?? 0)) : 0,
    maxUpperDegrees: holdSamples.length ? Math.max(...holdSamples.map((s) => s.hold?.upperDegrees ?? 0)) : 0,
    maxLowerDegrees: holdSamples.length ? Math.max(...holdSamples.map((s) => s.hold?.lowerDegrees ?? 0)) : 0,
    firstActiveShieldStepMeters: firstStep,
    maxTargetErrorAfterMeters: Math.max(0, ...samples.map((s) => Number(s.targetErrorAfterMeters) || 0)),
    latchedTargetDriftMeters: drift, releasedBeforeContact,
    terminal, issues,
    activeSamples: activeHold.slice(0, 8),
  };
  await mkdir('r18n4-3b1-3-evidence', { recursive: true });
  await writeFile(`r18n4-3b1-3-evidence/${label}.json`, JSON.stringify(evidence, null, 2));
  console.log(`R18N43B13_LOCALIZED=${JSON.stringify(evidence)}`);
  if (issues.length) throw new Error(`${label}: ${issues.join(' | ')}`);
} finally {
  try { page?.ws?.close(); } catch {}
  await cleanup();
}
