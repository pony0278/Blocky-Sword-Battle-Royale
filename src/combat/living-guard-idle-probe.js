export const LIVING_GUARD_IDLE_STAGE = 'G3.6.4';
export const LIVING_GUARD_IDLE_SOURCE_CLIP_ID = 'SKYRIM_GUARD/shd_blockidle';
export const LIVING_GUARD_IDLE_CANONICAL_SAMPLE = 0.50;

export const LIVING_GUARD_IDLE_CANDIDATE_IDS = Object.freeze({
  STABLE_G363: 'stable-g363',
  SKYRIM_LIVE: 'skyrim-live',
  LIVING_TRIANGLE: 'living-triangle',
});

export const LIVING_GUARD_IDLE_BONE_WEIGHTS = Object.freeze({
  spine: 0.24,
  chest: 0.32,
  'upperarm.r': 0.30,
  'lowerarm.r': 0.30,
  'wrist.r': 0.28,
  'handslot.r': 0.25,
  'upperarm.l': 0.22,
  'lowerarm.l': 0.22,
  'wrist.l': 0.18,
});

export const LIVING_GUARD_IDLE_CANDIDATES = Object.freeze([
  Object.freeze({
    id: LIVING_GUARD_IDLE_CANDIDATE_IDS.STABLE_G363,
    slot: 'A',
    label: 'Stable G3.6.3',
    strategy: 'canonical-static',
    sourceRate: 0,
    productionReference: true,
    probeOnly: true,
    note: 'Current production Hold: corrected Skyrim guard sampled at the canonical 50% pose and held perfectly still.',
  }),
  Object.freeze({
    id: LIVING_GUARD_IDLE_CANDIDATE_IDS.SKYRIM_LIVE,
    slot: 'B',
    label: 'Skyrim Live',
    strategy: 'live-source',
    sourceRate: 1.0,
    productionReference: false,
    probeOnly: true,
    note: 'Full corrected shd_blockidle loop. This exposes the source package motion without the G3.5.2 static Hold freeze.',
  }),
  Object.freeze({
    id: LIVING_GUARD_IDLE_CANDIDATE_IDS.LIVING_TRIANGLE,
    slot: 'C',
    label: 'Living Triangle',
    strategy: 'canonical-plus-live-delta',
    sourceRate: 0.85,
    productionReference: false,
    probeOnly: true,
    note: 'Preserve the approved Triangle Guard silhouette while blending only a restrained upper-body delta from Skyrim idle.',
  }),
]);

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function resolveLivingGuardIdleCandidate(value) {
  if (typeof value === 'object' && value?.id) {
    return LIVING_GUARD_IDLE_CANDIDATES.find((candidate) => candidate.id === value.id)
      || LIVING_GUARD_IDLE_CANDIDATES[0];
  }
  return LIVING_GUARD_IDLE_CANDIDATES.find((candidate) => candidate.id === value)
    || LIVING_GUARD_IDLE_CANDIDATES[0];
}

export function livingGuardCanonicalSourceTime(durationSeconds) {
  const duration = Math.max(0, Number(durationSeconds) || 0);
  return duration * LIVING_GUARD_IDLE_CANONICAL_SAMPLE;
}

export function sampleLivingGuardIdleCandidate(candidateInput, elapsedSeconds = 0, durationSeconds = 0) {
  const candidate = resolveLivingGuardIdleCandidate(candidateInput);
  const duration = Math.max(1e-6, Number(durationSeconds) || 0);
  const canonical = livingGuardCanonicalSourceTime(duration);
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const sourceRate = Math.max(0, Number(candidate.sourceRate) || 0);
  const sourceTimeSeconds = candidate.strategy === 'canonical-static'
    ? canonical
    : (canonical + elapsed * sourceRate) % duration;
  return Object.freeze({
    stage: LIVING_GUARD_IDLE_STAGE,
    candidateId: candidate.id,
    strategy: candidate.strategy,
    sourceTimeSeconds,
    canonicalSourceTimeSeconds: canonical,
    sourceRate,
    live: candidate.strategy !== 'canonical-static',
    probeOnly: candidate.probeOnly === true,
    productionReference: candidate.productionReference === true,
  });
}

export function getLivingGuardIdleBoneWeight(candidateInput, boneId) {
  const candidate = resolveLivingGuardIdleCandidate(candidateInput);
  if (candidate.strategy === 'canonical-static') return 0;
  if (candidate.strategy === 'live-source') return 1;
  return clamp01(LIVING_GUARD_IDLE_BONE_WEIGHTS[boneId]);
}

export function buildLivingGuardIdleProbeReport(durationSeconds) {
  const duration = Math.max(0, Number(durationSeconds) || 0);
  return Object.freeze({
    stage: LIVING_GUARD_IDLE_STAGE,
    sourceClipId: LIVING_GUARD_IDLE_SOURCE_CLIP_ID,
    sourceDurationSeconds: duration,
    canonicalSample: LIVING_GUARD_IDLE_CANONICAL_SAMPLE,
    canonicalSourceTimeSeconds: livingGuardCanonicalSourceTime(duration),
    productionUnchanged: true,
    productionStage: 'G3.6.3',
    candidates: LIVING_GUARD_IDLE_CANDIDATES,
    livingTriangleBoneWeights: LIVING_GUARD_IDLE_BONE_WEIGHTS,
    decision: 'PROBE_ONLY — compare Stable, full Skyrim live motion, and restrained Living Triangle motion before changing production Hold.',
  });
}
