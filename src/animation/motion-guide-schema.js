export const MOTION_GUIDE_PRESETS = Object.freeze(['advancing_vertical_chop']);
export const MOTION_GUIDE_LEAD_FEET = Object.freeze(['L', 'R']);

export const DEFAULT_ADVANCING_VERTICAL_CHOP_GUIDE = Object.freeze({
  format: 'whole-body-motion-guide',
  version: 2,
  preset: 'advancing_vertical_chop',
  leadFoot: 'L',
  stepDistance: 0.58,
  crouchDepth: 30,
  forwardLean: 16,
  plantFrame: 16,
  impactFrame: 19,
  durationFrames: 36,
  impactHeight: 1.18,
  cutPlaneOffset: 0,
  coupling: 0.85,
  footLock: true,
  twoHandGrip: true,
  secondaryGripWeight: 1,
  visible: true,
});

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeMotionGuide(input = {}) {
  const preset = MOTION_GUIDE_PRESETS.includes(input.preset)
    ? input.preset
    : DEFAULT_ADVANCING_VERTICAL_CHOP_GUIDE.preset;
  const durationFrames = Math.round(clamp(finiteNumber(
    input.durationFrames,
    DEFAULT_ADVANCING_VERTICAL_CHOP_GUIDE.durationFrames,
  ), 24, 72));
  const impactFrame = Math.round(clamp(finiteNumber(
    input.impactFrame,
    DEFAULT_ADVANCING_VERTICAL_CHOP_GUIDE.impactFrame,
  ), 10, durationFrames - 7));
  const plantFrame = Math.round(clamp(finiteNumber(
    input.plantFrame,
    DEFAULT_ADVANCING_VERTICAL_CHOP_GUIDE.plantFrame,
  ), 8, impactFrame - 1));
  return {
    format: 'whole-body-motion-guide',
    version: 2,
    preset,
    leadFoot: MOTION_GUIDE_LEAD_FEET.includes(input.leadFoot) ? input.leadFoot : 'L',
    stepDistance: clamp(finiteNumber(input.stepDistance, DEFAULT_ADVANCING_VERTICAL_CHOP_GUIDE.stepDistance), 0, 1.2),
    crouchDepth: clamp(finiteNumber(input.crouchDepth, DEFAULT_ADVANCING_VERTICAL_CHOP_GUIDE.crouchDepth), 0, 60),
    forwardLean: clamp(finiteNumber(input.forwardLean, DEFAULT_ADVANCING_VERTICAL_CHOP_GUIDE.forwardLean), 0, 40),
    plantFrame,
    impactFrame,
    durationFrames,
    impactHeight: clamp(finiteNumber(input.impactHeight, DEFAULT_ADVANCING_VERTICAL_CHOP_GUIDE.impactHeight), 0.5, 2),
    cutPlaneOffset: clamp(finiteNumber(input.cutPlaneOffset, DEFAULT_ADVANCING_VERTICAL_CHOP_GUIDE.cutPlaneOffset), -35, 35),
    coupling: clamp(finiteNumber(input.coupling, DEFAULT_ADVANCING_VERTICAL_CHOP_GUIDE.coupling), 0, 1),
    footLock: input.footLock !== false,
    twoHandGrip: input.twoHandGrip !== false,
    secondaryGripWeight: clamp(finiteNumber(
      input.secondaryGripWeight,
      DEFAULT_ADVANCING_VERTICAL_CHOP_GUIDE.secondaryGripWeight,
    ), 0, 1),
    visible: input.visible !== false,
  };
}

export function createAdvancingVerticalChopGuide(overrides = {}) {
  return normalizeMotionGuide({ ...DEFAULT_ADVANCING_VERTICAL_CHOP_GUIDE, ...overrides });
}

export function isWholeBodyMotionGuide(value) {
  return value?.format === 'whole-body-motion-guide'
    && value?.preset === 'advancing_vertical_chop';
}
