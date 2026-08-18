const freezeRange = (range) => Object.freeze({ ...range });

export const LONGSWORD_GUARD_BASE = Object.freeze({
  weapon: 'longsword',
  source: 'skyrim',
  sourceAsset: 'assets/skyrim/guard/converted/shd_blockidle.source.glb',
  clipId: 'SKYRIM_GUARD/shd_blockidle',
  adoptionDecision: 'ADOPT WITH CORRECTIONS',
  adoptionReason: 'retarget-is-usable-but-triangle-guard-needs-local-corrections',
  lowLevelRetargetFrozen: true,
  correctionLayerId: 'longsword_triangle_forward_v1',
});

export const LONGSWORD_TRIANGLE_GUARD_TARGETS = Object.freeze({
  weaponHandHeight: freezeRange({ min: 0.50, max: 0.75 }),
  offHandHeight: freezeRange({ min: 0.55, max: 0.85 }),
  weaponHandCenterDistance: freezeRange({ max: 0.58 }),
  offHandCenterDistance: freezeRange({ max: 0.62 }),
  swordTipHeight: freezeRange({ min: 0.70, max: 1.10 }),
  swordForwardDot: freezeRange({ min: 0.65 }),
  triangleArea: freezeRange({ min: 0.035, max: 0.20 }),
  torsoYawDegrees: freezeRange({ min: 20, max: 38 }),
});

export const LONGSWORD_GUARD_CORRECTION_SCOPE = Object.freeze({
  requiredBones: Object.freeze([
    'upperarm.r',
    'lowerarm.r',
    'wrist.r',
  ]),
  optionalBones: Object.freeze([
    'chest',
    'upperarm.l',
    'lowerarm.l',
    'wrist.l',
    'handslot.r',
  ]),
  forbiddenBones: Object.freeze([
    'root',
    'hips',
    'upperleg.l',
    'upperleg.r',
    'lowerleg.l',
    'lowerleg.r',
    'foot.l',
    'foot.r',
    'toes.l',
    'toes.r',
  ]),
  maxLocalCorrectionDegrees: Object.freeze({
    chest: 8,
    'upperarm.r': 40,
    'lowerarm.r': 50,
    'wrist.r': 65,
    'upperarm.l': 20,
    'lowerarm.l': 25,
    'wrist.l': 30,
    'handslot.r': 15,
  }),
  policy: Object.freeze({
    preserveRootAndLowerBody: true,
    preserveSourceTorsoWeight: true,
    preserveOffHandUnlessNeeded: true,
    equipmentTrimOnly: true,
    equipmentTrimMaxDegrees: 15,
  }),
});

export const LONGSWORD_GUARD_CORRECTION_ORDER = Object.freeze([
  'sample-retargeted-skyrim-guard',
  'apply-local-upper-body-corrections',
  'solve-weapon-hand-height-and-compactness',
  'solve-sword-tip-height-and-forward-threat',
  'apply-g2.4.5-weapon-bind-calibration',
  'apply-handslot-fine-trim-if-needed',
  'validate-triangle-guard-gates',
]);

export const LONGSWORD_GUARD_AUTHORING_STATE = Object.freeze({
  authored: false,
  baseSample: 0.50,
  offsets: Object.freeze({}),
  note: 'G2.5 freezes the correction contract only. Canonical local quaternion offsets are authored in G2.5.1+ and must not be guessed here.',
});

function finite(value, fallback = Number.NaN) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function passesRange(value, range) {
  if (!Number.isFinite(value)) return false;
  if (Number.isFinite(range.min) && value < range.min) return false;
  if (Number.isFinite(range.max) && value > range.max) return false;
  return true;
}

export function evaluateLongswordTriangleGuardTargets(input = {}, targets = LONGSWORD_TRIANGLE_GUARD_TARGETS) {
  const metrics = Object.freeze({
    weaponHandHeight: finite(input.weaponHandHeight),
    offHandHeight: finite(input.offHandHeight),
    weaponHandCenterDistance: finite(input.weaponHandCenterDistance),
    offHandCenterDistance: finite(input.offHandCenterDistance),
    swordTipHeight: finite(input.swordTipHeight),
    swordForwardDot: finite(input.swordForwardDot),
    triangleArea: finite(input.triangleArea),
    torsoYawDegrees: finite(input.torsoYawDegrees),
  });

  const gates = Object.freeze(Object.fromEntries(
    Object.entries(targets).map(([name, range]) => [name, passesRange(metrics[name], range)]),
  ));
  const failures = Object.freeze(Object.entries(gates)
    .filter(([, pass]) => !pass)
    .map(([name]) => name));

  return Object.freeze({
    status: failures.length === 0 ? 'good' : 'needs-correction',
    metrics,
    gates,
    failures,
  });
}

export function getLongswordGuardCorrectionBones() {
  return Object.freeze([
    ...LONGSWORD_GUARD_CORRECTION_SCOPE.requiredBones,
    ...LONGSWORD_GUARD_CORRECTION_SCOPE.optionalBones,
  ]);
}
