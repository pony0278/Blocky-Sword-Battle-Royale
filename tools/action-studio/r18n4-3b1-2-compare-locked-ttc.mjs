import { readFile } from 'node:fs/promises';

const [oldPath, newPath] = process.argv.slice(2);
if (!oldPath || !newPath) throw new Error('usage: node compare <old.json> <new.json>');
const oldData = JSON.parse(await readFile(oldPath, 'utf8'));
const newData = JSON.parse(await readFile(newPath, 'utf8'));

const checkpoints = [150, 120, 90, 60, 30, 10, 0];
const distance = (a, b) => a && b ? Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) : null;
const quatAngleDeg = (a, b) => {
  if (!a || !b) return null;
  const dot = Math.abs(a.x*b.x + a.y*b.y + a.z*b.z + a.w*b.w);
  return 2 * Math.acos(Math.min(1, Math.max(-1, dot))) * 180 / Math.PI;
};
const mean = (values) => {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
};

const pairedTrials = Math.min(oldData.trials.length, newData.trials.length);
const summary = {
  stage: 'R18N.4.3-B.1.2',
  pairedTrials,
  inputTtcOldMeanMs: mean(oldData.trials.slice(0, pairedTrials).map((t) => t.afterInput?.inputTtcMs)),
  inputTtcNewMeanMs: mean(newData.trials.slice(0, pairedTrials).map((t) => t.afterInput?.inputTtcMs)),
  latchedTargetDistanceMeanMeters: mean(Array.from({ length: pairedTrials }, (_, i) =>
    distance(oldData.trials[i].afterInput?.targetCenter, newData.trials[i].afterInput?.targetCenter))),
  checkpoints: {},
};

for (const checkpoint of checkpoints) {
  const rows = [];
  for (let i = 0; i < pairedTrials; i += 1) {
    const oldSample = oldData.trials[i].samples[String(checkpoint)] ?? oldData.trials[i].samples[checkpoint];
    const newSample = newData.trials[i].samples[String(checkpoint)] ?? newData.trials[i].samples[checkpoint];
    if (!oldSample || !newSample) continue;
    rows.push({
      shieldCenterDistanceMeters: distance(oldSample.surfaceCenter, newSample.surfaceCenter),
      shieldYDeltaMeters: newSample.surfaceCenter?.y - oldSample.surfaceCenter?.y,
      upperarmPositionDistanceMeters: distance(oldSample.upperarm?.position, newSample.upperarm?.position),
      lowerarmPositionDistanceMeters: distance(oldSample.lowerarm?.position, newSample.lowerarm?.position),
      wristPositionDistanceMeters: distance(oldSample.wrist?.position, newSample.wrist?.position),
      upperarmQuaternionAngleDeg: quatAngleDeg(oldSample.upperarm?.quaternion, newSample.upperarm?.quaternion),
      lowerarmQuaternionAngleDeg: quatAngleDeg(oldSample.lowerarm?.quaternion, newSample.lowerarm?.quaternion),
      wristQuaternionAngleDeg: quatAngleDeg(oldSample.wrist?.quaternion, newSample.wrist?.quaternion),
    });
  }
  summary.checkpoints[checkpoint] = {
    samples: rows.length,
    shieldCenterDistanceMeanMeters: mean(rows.map((r) => r.shieldCenterDistanceMeters)),
    shieldYDeltaMeanMeters: mean(rows.map((r) => r.shieldYDeltaMeters)),
    upperarmPositionDistanceMeanMeters: mean(rows.map((r) => r.upperarmPositionDistanceMeters)),
    lowerarmPositionDistanceMeanMeters: mean(rows.map((r) => r.lowerarmPositionDistanceMeters)),
    wristPositionDistanceMeanMeters: mean(rows.map((r) => r.wristPositionDistanceMeters)),
    upperarmQuaternionAngleMeanDeg: mean(rows.map((r) => r.upperarmQuaternionAngleDeg)),
    lowerarmQuaternionAngleMeanDeg: mean(rows.map((r) => r.lowerarmQuaternionAngleDeg)),
    wristQuaternionAngleMeanDeg: mean(rows.map((r) => r.wristQuaternionAngleDeg)),
  };
}

const targetDiff = summary.latchedTargetDistanceMeanMeters;
const earlyPoseDiff = summary.checkpoints[120]?.wristPositionDistanceMeanMeters;
summary.classification = targetDiff != null && targetDiff > 0.002
  ? 'latched-target-divergence'
  : earlyPoseDiff != null && earlyPoseDiff > 0.002
    ? 'same-target-writer-pose-divergence'
    : 'no-material-old-vs-new-divergence-at-locked-input';

console.log(JSON.stringify(summary, null, 2));
