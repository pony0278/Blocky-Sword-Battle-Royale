export const PARRY_CONTACT_DEFLECT_PROBE_STAGE = 'G3.5.1P';

export const PARRY_CONTACT_DEFLECT_VARIANTS = Object.freeze({
  PARRY: 'parry',
  PERFECT: 'perfect',
});

export const PARRY_CONTACT_DEFLECT_PHASES = Object.freeze({
  CONTACT: 'contact',
  CONTACT_HOLD: 'contact-hold',
  BLEND: 'blend',
  DEFLECT: 'deflect',
  COMPLETE: 'complete',
});

const CONTACT_CLIP_ID = 'SKYRIM_GUARD/shd_blockhit';
const ROOT_ROTATION_POLICY = 'lock';

const DEFAULTS = Object.freeze({
  [PARRY_CONTACT_DEFLECT_VARIANTS.PARRY]: Object.freeze({
    id: 'g351p_parry_contact_to_deflect',
    deflectClipId: 'SKYRIM_GUARD/shd_blockbash',
    contactEndSeconds: 0.18,
    contactHoldMs: 65,
    blendMs: 55,
    deflectStartSeconds: 0.04,
    deflectEndSeconds: 0.30,
    blendLeadSeconds: 0.045,
  }),
  [PARRY_CONTACT_DEFLECT_VARIANTS.PERFECT]: Object.freeze({
    id: 'g351p_perfect_contact_to_power_deflect',
    deflectClipId: 'SKYRIM_GUARD/shd_blockbashpower',
    contactEndSeconds: 0.18,
    contactHoldMs: 75,
    blendMs: 60,
    deflectStartSeconds: 0.08,
    deflectEndSeconds: 0.46,
    blendLeadSeconds: 0.06,
  }),
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function finiteOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function createParryContactDeflectProbeProfile(variant = PARRY_CONTACT_DEFLECT_VARIANTS.PARRY, overrides = {}) {
  const base = DEFAULTS[variant] || DEFAULTS[PARRY_CONTACT_DEFLECT_VARIANTS.PARRY];
  const contactEndSeconds = clamp(finiteOr(overrides.contactEndSeconds, base.contactEndSeconds), 0.02, 0.60);
  const contactHoldMs = clamp(finiteOr(overrides.contactHoldMs, base.contactHoldMs), 0, 180);
  const blendMs = clamp(finiteOr(overrides.blendMs, base.blendMs), 0, 180);
  const deflectStartSeconds = Math.max(0, finiteOr(overrides.deflectStartSeconds, base.deflectStartSeconds));
  const deflectEndSeconds = Math.max(deflectStartSeconds + 0.01, finiteOr(overrides.deflectEndSeconds, base.deflectEndSeconds));
  const blendLeadSeconds = clamp(
    finiteOr(overrides.blendLeadSeconds, base.blendLeadSeconds),
    0,
    deflectEndSeconds - deflectStartSeconds,
  );
  const deflectRate = clamp(finiteOr(overrides.deflectRate, 1), 0.25, 2.5);
  const deflectPlaybackSeconds = (deflectEndSeconds - deflectStartSeconds - blendLeadSeconds) / deflectRate;
  const durationMs = contactEndSeconds * 1000 + contactHoldMs + blendMs + deflectPlaybackSeconds * 1000;

  return Object.freeze({
    stage: PARRY_CONTACT_DEFLECT_PROBE_STAGE,
    id: base.id,
    variant: base === DEFAULTS[PARRY_CONTACT_DEFLECT_VARIANTS.PERFECT]
      ? PARRY_CONTACT_DEFLECT_VARIANTS.PERFECT
      : PARRY_CONTACT_DEFLECT_VARIANTS.PARRY,
    productionEnabled: false,
    probeOnly: true,
    contactClipId: CONTACT_CLIP_ID,
    deflectClipId: base.deflectClipId,
    contactWindow: Object.freeze({ startSeconds: 0, endSeconds: contactEndSeconds }),
    contactHoldMs,
    blendMs,
    deflectWindow: Object.freeze({ startSeconds: deflectStartSeconds, endSeconds: deflectEndSeconds }),
    blendLeadSeconds,
    deflectRate,
    durationMs,
    rootRotationPolicy: ROOT_ROTATION_POLICY,
    inPlace: true,
    semanticIntent: 'incoming attack contacts shield first, then shield redirects the attack line outward',
    authority: 'presentation-probe-only',
  });
}

export function sampleParryContactDeflectProbe(profile, elapsedMs = 0) {
  if (!profile) return null;
  const elapsed = clamp(elapsedMs, 0, profile.durationMs);
  const contactEndMs = profile.contactWindow.endSeconds * 1000;
  const holdEndMs = contactEndMs + profile.contactHoldMs;
  const blendEndMs = holdEndMs + profile.blendMs;

  if (elapsed < contactEndMs) {
    return Object.freeze({
      phase: PARRY_CONTACT_DEFLECT_PHASES.CONTACT,
      elapsedMs: elapsed,
      clipId: profile.contactClipId,
      sourceTimeSeconds: elapsed / 1000,
      rootRotationPolicy: profile.rootRotationPolicy,
      complete: false,
    });
  }

  if (elapsed < holdEndMs) {
    return Object.freeze({
      phase: PARRY_CONTACT_DEFLECT_PHASES.CONTACT_HOLD,
      elapsedMs: elapsed,
      clipId: profile.contactClipId,
      sourceTimeSeconds: profile.contactWindow.endSeconds,
      rootRotationPolicy: profile.rootRotationPolicy,
      complete: false,
    });
  }

  if (elapsed < blendEndMs && profile.blendMs > 0) {
    const alpha = clamp((elapsed - holdEndMs) / profile.blendMs, 0, 1);
    return Object.freeze({
      phase: PARRY_CONTACT_DEFLECT_PHASES.BLEND,
      elapsedMs: elapsed,
      fromClipId: profile.contactClipId,
      fromSourceTimeSeconds: profile.contactWindow.endSeconds,
      toClipId: profile.deflectClipId,
      toSourceTimeSeconds: profile.deflectWindow.startSeconds + profile.blendLeadSeconds * alpha,
      blendAlpha: alpha,
      rootRotationPolicy: profile.rootRotationPolicy,
      complete: false,
    });
  }

  if (elapsed < profile.durationMs) {
    const afterBlendSeconds = Math.max(0, elapsed - blendEndMs) / 1000;
    const sourceTimeSeconds = Math.min(
      profile.deflectWindow.endSeconds,
      profile.deflectWindow.startSeconds + profile.blendLeadSeconds + afterBlendSeconds * profile.deflectRate,
    );
    return Object.freeze({
      phase: PARRY_CONTACT_DEFLECT_PHASES.DEFLECT,
      elapsedMs: elapsed,
      clipId: profile.deflectClipId,
      sourceTimeSeconds,
      rootRotationPolicy: profile.rootRotationPolicy,
      complete: false,
    });
  }

  return Object.freeze({
    phase: PARRY_CONTACT_DEFLECT_PHASES.COMPLETE,
    elapsedMs: profile.durationMs,
    clipId: profile.deflectClipId,
    sourceTimeSeconds: profile.deflectWindow.endSeconds,
    rootRotationPolicy: profile.rootRotationPolicy,
    complete: true,
  });
}
