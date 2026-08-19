# G3.5.1P — Parry Contact → Deflect Presentation Probe

## Goal

Test the revised visual hypothesis for Parry without changing combat authority or the production Parry mapping.

The hypothesis is:

1. the incoming weapon first **contacts the raised shield**;
2. the defender briefly absorbs the impact;
3. the shield then **redirects / brushes the attack line outward**;
4. only after that visual success does the gameplay Parry Advantage matter.

The previous problem was that `shd_blockbash` or `shd_blockbashpower` played by themselves read as Shield Bash. G3.5.1P tests whether those same source motions become readable as a Parry when they are used only after a clear Block Hit contact.

## Probe-only rule

This stage must not silently replace production Parry.

`src/combat/parry-contact-deflect-probe.js` is explicitly:

- `probeOnly: true`;
- `productionEnabled: false`;
- authority: `presentation-probe-only`;
- in-place playback;
- root rotation policy: `lock`.

Production G3.5.1 remains unchanged until visual review is accepted.

## Candidate chains

### Normal Parry

`SKYRIM_GUARD/shd_blockhit`

→ short impact hold / hitstop

→ crossfade

→ trimmed `SKYRIM_GUARD/shd_blockbash`

Default probe values:

- Block Hit contact end: `0.180s`;
- contact hold: `65ms`;
- crossfade: `55ms`;
- blockbash trim: `0.040–0.300s`;
- blend lead inside blockbash: `0.045s`;
- deflect speed: `1.0x`.

These values are starting points, not production decisions.

### Perfect Parry

`SKYRIM_GUARD/shd_blockhit`

→ slightly stronger impact hold

→ crossfade

→ trimmed `SKYRIM_GUARD/shd_blockbashpower`

Default probe values:

- Block Hit contact end: `0.180s`;
- contact hold: `75ms`;
- crossfade: `60ms`;
- blockbashpower trim: `0.080–0.460s`;
- blend lead: `0.060s`;
- deflect speed: `1.0x`.

## Why crossfade matters

A hard switch can make the second clip read as a new attack even if the source itself is useful.

The Action Studio probe captures both bone poses and blends them using:

- local bone position interpolation;
- quaternion slerp;
- local scale interpolation.

This allows us to judge the intended semantic chain instead of judging a clip seam.

## Action Studio lab

`tools/action-studio/parry-contact-deflect-probe.html`

Controls:

- Normal / Power variant;
- play / restart;
- chain scrubber;
- Block Hit contact end;
- impact hold / hitstop;
- crossfade duration;
- deflect source start / end;
- blend lead;
- deflect playback speed;
- front / 3-quarter / side / back camera.

The lab loads the real converted Skyrim Guard GLBs and uses the accepted Skyrim weapon-bind calibration.

## Acceptance criteria

A candidate is visually successful only if all of the following are true:

- shield contact is readable **before** outward motion begins;
- the second motion reads as redirecting the opponent's attack, not initiating an unrelated shield strike;
- the character does not lunge or spin because of imported root motion;
- the sword / shield silhouette remains coherent through the crossfade;
- the final pose can plausibly hand off into the existing Parry Advantage / free directional attack flow.

## Rejection signs

Reject or re-trim the candidate if:

- the shield begins moving forward before impact is readable;
- the chain looks like two separate moves;
- the bash section still reads primarily as body-check / shield strike;
- the blend creates hand, shield, sword, or shoulder snapping;
- the root orientation rotates unexpectedly.

## Relationship to G3.5.1

G3.5.1 gameplay semantics remain valid:

`Parry success → opponent stagger / unbalance → defender may use normal Top / Left / Right attack.`

G3.5.1P changes only the possible **presentation** of the Parry success itself.

No dedicated Counter animation is reintroduced.

## Next decision

After visual review:

- if the contact → deflect chain reads correctly, promote the accepted timing into a production Parry presentation stage;
- if it still reads as Shield Bash, keep production `shd_blockhit` only and do not force the source clips into Parry.
