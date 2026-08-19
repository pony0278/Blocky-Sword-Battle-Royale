export const PRODUCTION_PARRY_DEFLECT_STAGE = 'G3.5.1P-T3';

export const PRODUCTION_PARRY_DEFLECT_VARIANTS = Object.freeze({
  PARRY: 'parry',
  PERFECT_PARRY: 'perfect-parry',
});

export const PRODUCTION_PARRY_DEFLECT_PHASES = Object.freeze({
  CONTACT: 'contact',
  CONTACT_HOLD: 'contact-hold',
  BLEND: 'blend',
  DEFLECT: 'deflect',
  SETTLE: 'settle',
});

export const PRODUCTION_PARRY_DEFLECT_CLIP_IDS = Object.freeze({
  PARRY: 'SKYRIM_GUARD/parry_contact_deflect_t3',
  PERFECT_PARRY: 'SKYRIM_GUARD/perfect_parry_contact_deflect_t3',
});

const CONTACT_CLIP_ID = 'SKYRIM_GUARD/shd_blockhit';
const DEFLECT_CLIP_ID = 'SKYRIM_GUARD/shd_blockbash';
const REACTION_DURATION_SECONDS = 0.6;
const CONTACT_END_SECONDS = 0.16;
const DEFLECT_START_SECONDS = 0.09;
const DEFLECT_END_SECONDS = 0.22;
const DEFLECT_BLEND_LEAD_SECONDS = 0.03;
const DEFLECT_RATE = 1.15;

const PROFILES = Object.freeze({
  [PRODUCTION_PARRY_DEFLECT_VARIANTS.PARRY]: Object.freeze({
    id: 'g351p_t3_parry_contact_deflect',
    variant: PRODUCTION_PARRY_DEFLECT_VARIANTS.PARRY,
    clipId: PRODUCTION_PARRY_DEFLECT_CLIP_IDS.PARRY,
    contactHoldSeconds: 0.085,
    blendSeconds: 0.070,
  }),
  [PRODUCTION_PARRY_DEFLECT_VARIANTS.PERFECT_PARRY]: Object.freeze({
    id: 'g351p_t3_perfect_parry_contact_deflect',
    variant: PRODUCTION_PARRY_DEFLECT_VARIANTS.PERFECT_PARRY,
    clipId: PRODUCTION_PARRY_DEFLECT_CLIP_IDS.PERFECT_PARRY,
    contactHoldSeconds: 0.095,
    blendSeconds: 0.075,
  }),
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function resolveVariant(value) {
  return value === PRODUCTION_PARRY_DEFLECT_VARIANTS.PERFECT_PARRY
    ? PRODUCTION_PARRY_DEFLECT_VARIANTS.PERFECT_PARRY
    : PRODUCTION_PARRY_DEFLECT_VARIANTS.PARRY;
}

function deflectPlaybackSeconds() {
  return (DEFLECT_END_SECONDS - DEFLECT_START_SECONDS - DEFLECT_BLEND_LEAD_SECONDS) / DEFLECT_RATE;
}

export function getProductionParryDeflectProfile(variant = PRODUCTION_PARRY_DEFLECT_VARIANTS.PARRY) {
  const base = PROFILES[resolveVariant(variant)];
  const holdEndSeconds = CONTACT_END_SECONDS + base.contactHoldSeconds;
  const blendEndSeconds = holdEndSeconds + base.blendSeconds;
  const deflectEndAtSeconds = blendEndSeconds + deflectPlaybackSeconds();
  return Object.freeze({
    ...base,
    stage: PRODUCTION_PARRY_DEFLECT_STAGE,
    productionEnabled: true,
    probeOnly: false,
    contactClipId: CONTACT_CLIP_ID,
    deflectClipId: DEFLECT_CLIP_ID,
    contactEndSeconds: CONTACT_END_SECONDS,
    contactHoldSeconds: base.contactHoldSeconds,
    holdEndSeconds,
    blendSeconds: base.blendSeconds,
    blendEndSeconds,
    deflectStartSeconds: DEFLECT_START_SECONDS,
    deflectEndSeconds: DEFLECT_END_SECONDS,
    deflectBlendLeadSeconds: DEFLECT_BLEND_LEAD_SECONDS,
    deflectRate: DEFLECT_RATE,
    deflectEndAtSeconds,
    reactionDurationSeconds: REACTION_DURATION_SECONDS,
    semanticIntent: 'incoming weapon contacts shield, impact reads, then the shield redirects the attack line upward/laterally',
    sourceDecision: 'T2_SHARED_NORMAL_T1',
    perfectDifferentiation: base.variant === PRODUCTION_PARRY_DEFLECT_VARIANTS.PERFECT_PARRY
      ? 'longer-contact-hold-and-blend; stronger stagger/hitfeel remains external to this clip'
      : 'normal-parry-contact-deflect',
  });
}

export function sampleProductionParryDeflectTimeline(variant, elapsedSeconds = 0) {
  const profile = getProductionParryDeflectProfile(variant);
  const elapsed = clamp(elapsedSeconds, 0, profile.reactionDurationSeconds);

  if (elapsed < profile.contactEndSeconds) {
    return Object.freeze({
      phase: PRODUCTION_PARRY_DEFLECT_PHASES.CONTACT,
      elapsedSeconds: elapsed,
      clipId: profile.contactClipId,
      sourceTimeSeconds: elapsed,
      completeVisualChain: false,
    });
  }

  if (elapsed < profile.holdEndSeconds) {
    return Object.freeze({
      phase: PRODUCTION_PARRY_DEFLECT_PHASES.CONTACT_HOLD,
      elapsedSeconds: elapsed,
      clipId: profile.contactClipId,
      sourceTimeSeconds: profile.contactEndSeconds,
      completeVisualChain: false,
    });
  }

  if (elapsed < profile.blendEndSeconds && profile.blendSeconds > 0) {
    const alpha = clamp((elapsed - profile.holdEndSeconds) / profile.blendSeconds, 0, 1);
    return Object.freeze({
      phase: PRODUCTION_PARRY_DEFLECT_PHASES.BLEND,
      elapsedSeconds: elapsed,
      fromClipId: profile.contactClipId,
      fromSourceTimeSeconds: profile.contactEndSeconds,
      toClipId: profile.deflectClipId,
      toSourceTimeSeconds: profile.deflectStartSeconds + profile.deflectBlendLeadSeconds * alpha,
      blendAlpha: alpha,
      completeVisualChain: false,
    });
  }

  if (elapsed < profile.deflectEndAtSeconds) {
    const afterBlend = Math.max(0, elapsed - profile.blendEndSeconds);
    const sourceTimeSeconds = Math.min(
      profile.deflectEndSeconds,
      profile.deflectStartSeconds + profile.deflectBlendLeadSeconds + afterBlend * profile.deflectRate,
    );
    return Object.freeze({
      phase: PRODUCTION_PARRY_DEFLECT_PHASES.DEFLECT,
      elapsedSeconds: elapsed,
      clipId: profile.deflectClipId,
      sourceTimeSeconds,
      completeVisualChain: false,
    });
  }

  return Object.freeze({
    phase: PRODUCTION_PARRY_DEFLECT_PHASES.SETTLE,
    elapsedSeconds: elapsed,
    clipId: profile.deflectClipId,
    sourceTimeSeconds: profile.deflectEndSeconds,
    completeVisualChain: true,
  });
}

function canSampleTrack(track) {
  return Boolean(track?.name && typeof track.getValueSize === 'function' && typeof track.createInterpolant === 'function');
}

function makeTrackSampler(clip) {
  const byName = new Map();
  for (const track of clip?.tracks || []) {
    if (!canSampleTrack(track)) continue;
    byName.set(track.name, {
      track,
      size: track.getValueSize(),
      interpolant: track.createInterpolant(),
    });
  }
  return byName;
}

function sampleTrack(entry, timeSeconds, clipDuration) {
  if (!entry) return null;
  const time = clamp(timeSeconds, 0, Math.max(0, Number(clipDuration) || 0));
  const value = entry.interpolant.evaluate(time);
  return Array.from(value).slice(0, entry.size);
}

function slerpQuaternion(THREE, from, to, alpha) {
  if (!THREE?.Quaternion || from?.length !== 4 || to?.length !== 4) {
    return from.map((value, index) => value + ((to[index] ?? value) - value) * alpha);
  }
  const a = new THREE.Quaternion(from[0], from[1], from[2], from[3]).normalize();
  const b = new THREE.Quaternion(to[0], to[1], to[2], to[3]).normalize();
  a.slerp(b, alpha);
  return [a.x, a.y, a.z, a.w];
}

function blendValues(THREE, trackName, from, to, alpha) {
  if (!from) return to ? [...to] : [];
  if (!to) return [...from];
  if (trackName.endsWith('.quaternion') && from.length === 4 && to.length === 4) {
    return slerpQuaternion(THREE, from, to, alpha);
  }
  return from.map((value, index) => value + ((to[index] ?? value) - value) * alpha);
}

function uniqueSortedTimes(values) {
  const sorted = [...values]
    .map((value) => Number(Number(value).toFixed(8)))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);
  return sorted.filter((value, index) => index === 0 || Math.abs(value - sorted[index - 1]) > 1e-7);
}

function outputTimes(profile, fps) {
  const values = [
    0,
    profile.contactEndSeconds,
    profile.holdEndSeconds,
    profile.blendEndSeconds,
    profile.deflectEndAtSeconds,
    profile.reactionDurationSeconds,
  ];
  const frames = Math.ceil(profile.reactionDurationSeconds * fps);
  for (let frame = 0; frame <= frames; frame += 1) {
    values.push(Math.min(profile.reactionDurationSeconds, frame / fps));
  }
  return uniqueSortedTimes(values);
}

function valueForTimeline(THREE, timeline, trackName, contactEntry, deflectEntry, contactDuration, deflectDuration) {
  if (timeline.phase === PRODUCTION_PARRY_DEFLECT_PHASES.BLEND) {
    const from = sampleTrack(contactEntry, timeline.fromSourceTimeSeconds, contactDuration);
    const to = sampleTrack(deflectEntry, timeline.toSourceTimeSeconds, deflectDuration);
    return blendValues(THREE, trackName, from, to, timeline.blendAlpha);
  }
  const useContact = timeline.clipId === CONTACT_CLIP_ID;
  const entry = useContact ? contactEntry : deflectEntry;
  const fallback = useContact ? deflectEntry : contactEntry;
  return sampleTrack(entry || fallback, timeline.sourceTimeSeconds, useContact ? contactDuration : deflectDuration);
}

export function canCreateProductionParryDeflectClips(THREE, clipMap) {
  const contact = clipMap?.get?.(CONTACT_CLIP_ID);
  const deflect = clipMap?.get?.(DEFLECT_CLIP_ID);
  return Boolean(
    THREE?.AnimationClip
    && THREE?.Quaternion
    && contact?.tracks?.length
    && deflect?.tracks?.length
  );
}

export function createProductionParryDeflectClip(THREE, clipMap, variant, options = {}) {
  if (!canCreateProductionParryDeflectClips(THREE, clipMap)) {
    throw new Error('G3.5.1P-T3 production Parry clip synthesis requires retargeted Block Hit + Block Bash tracks and Three.js AnimationClip support');
  }
  const profile = getProductionParryDeflectProfile(variant);
  const contactClip = clipMap.get(profile.contactClipId);
  const deflectClip = clipMap.get(profile.deflectClipId);
  const contactTracks = makeTrackSampler(contactClip);
  const deflectTracks = makeTrackSampler(deflectClip);
  const names = new Set([...contactTracks.keys(), ...deflectTracks.keys()]);
  const fps = Math.max(30, Number(options.fps) || 60);
  const times = outputTimes(profile, fps);
  const tracks = [];

  for (const name of names) {
    const contactEntry = contactTracks.get(name) || null;
    const deflectEntry = deflectTracks.get(name) || null;
    const template = contactEntry?.track || deflectEntry?.track;
    if (!template) continue;
    const values = [];
    for (const time of times) {
      const timeline = sampleProductionParryDeflectTimeline(profile.variant, time);
      const value = valueForTimeline(
        THREE,
        timeline,
        name,
        contactEntry,
        deflectEntry,
        contactClip.duration,
        deflectClip.duration,
      );
      if (!value?.length) throw new Error(`G3.5.1P-T3 could not sample track ${name}`);
      values.push(...value);
    }
    tracks.push(new template.constructor(
      name,
      times,
      values,
      typeof template.getInterpolation === 'function' ? template.getInterpolation() : undefined,
    ));
  }

  const clip = new THREE.AnimationClip(profile.clipId, profile.reactionDurationSeconds, tracks);
  clip.userData = {
    ...(clip.userData || {}),
    productionParryDeflect: Object.freeze({
      stage: PRODUCTION_PARRY_DEFLECT_STAGE,
      productionEnabled: true,
      probeOnly: false,
      variant: profile.variant,
      sourceDecision: profile.sourceDecision,
      contactClipId: profile.contactClipId,
      deflectClipId: profile.deflectClipId,
      contactEndSeconds: profile.contactEndSeconds,
      contactHoldSeconds: profile.contactHoldSeconds,
      blendSeconds: profile.blendSeconds,
      deflectWindow: Object.freeze([profile.deflectStartSeconds, profile.deflectEndSeconds]),
      deflectRate: profile.deflectRate,
      visualChainEndSeconds: profile.deflectEndAtSeconds,
      reactionDurationSeconds: profile.reactionDurationSeconds,
    }),
  };
  return clip;
}

export function createProductionParryDeflectClips(THREE, clipMap, options = {}) {
  return Object.freeze([
    createProductionParryDeflectClip(THREE, clipMap, PRODUCTION_PARRY_DEFLECT_VARIANTS.PARRY, options),
    createProductionParryDeflectClip(THREE, clipMap, PRODUCTION_PARRY_DEFLECT_VARIANTS.PERFECT_PARRY, options),
  ]);
}
