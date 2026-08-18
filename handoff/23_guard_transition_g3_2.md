# G3.2 — Guard Enter / Recover / Exit Authoring

## Goal

Turn the G3.1 Guard state slots into authored presentation transitions without creating unrelated full-body animation clips.

G3.2 reuses the accepted Skyrim Triangle Forward Guard as the only Guard base:

- clip: `SKYRIM_GUARD/shd_blockidle`
- correction layer: `longsword_triangle_forward_v1`
- in-place: `true`
- canonical G2.5.1 quaternion offsets remain unchanged

## Authoring Strategy

The transition family uses deterministic presentation weights instead of new FBX/GLB clips.

### Guard Enter — 180 ms

Curve: `ease-out-cubic`

```text
holdWeight       0 -> 1
correctionWeight 0 -> 1
reactionOverlay  0
```

This lets the real Skyrim Hold blend from the character's neutral/rest presentation while the G2.5.1 local quaternion correction ramps through the same envelope.

### Guard Recover — 140 ms

Curve: `ease-out-cubic`

```text
holdWeight       1
correctionWeight 1
reactionOverlay  1 -> 0
```

Recover deliberately does not weaken the mother Guard. G3.3 will author Block/Parry recoil as an additive reaction overlay; G3.2 already defines how that overlay returns to zero.

### Guard Exit — 160 ms

Curve: `ease-in-cubic`

```text
holdWeight       1 -> 0
correctionWeight 1 -> 0
reactionOverlay  0
```

Exit releases the Skyrim Hold and its authored correction together, avoiding a frame where the sword orientation and body pose disagree.

## Quaternion Blend Rule

G2.5.1 correction offsets are not interpolated as Euler angles.

`scaleQuaternionOffset()` scales each local correction through the shortest quaternion arc from identity to the accepted canonical offset. Therefore a 50% correction has approximately 50% of the canonical quaternion angle and cannot take an arbitrary Euler-axis route.

`applyGuardQuaternionOffsetsWeighted()` is the runtime/application helper for the weighted correction layer.

## G3.1 State Contract Integration

The following presentation slots are now authored at G3.2:

- `guard_enter`
- `guard_recover`
- `guard_exit`

All three point to the same canonical Skyrim Guard clip and correction layer and expose a `transitionProfileId`.

The following remain intentionally unauthored:

- `guard_block_hit` -> G3.3
- `guard_parry` -> G3.3
- `guard_counter` -> G3.4

The G3.1 authority boundary is unchanged. G3.2 only controls presentation weights and completion timing; it does not decide whether block/parry/counter succeeds.

## Action Studio Visual Lab

`tools/action-studio/guard-transition-authoring-lab.html`

The lab loads:

1. the real canonical converted Skyrim Guard GLB,
2. the actual procedural character,
3. the G2.4.5 weapon-bind calibrated sword,
4. the committed G2.5.1 correction offsets,
5. the committed G3.2 transition profiles.

Controls:

- Enter / Hold / Recover / Exit / Neutral
- transition-time scrubber
- Enter -> Hold -> Exit cycle playback
- Front / 3-quarter / Side / Back views

The automation gate verifies:

- canonical clip identity,
- Enter endpoint weights,
- Recover reaction-overlay contract,
- Exit endpoint weights,
- root stability,
- motion-root stability.

## CI / Visual Evidence

Workflow: `.github/workflows/guard-transition-visual.yml`

Screenshots:

- Enter start
- Enter midpoint
- Enter end
- Hold
- Recover midpoint
- Exit midpoint
- Exit end
- Enter midpoint side view

The workflow fails unless the lab reports `data-g32="pass"` and the committed timing metadata is exactly `180 / 140 / 160 ms`.

## Acceptance Contract

G3.2 is complete when:

1. Enter uses the real canonical Skyrim Hold and ramps both hold/correction weight `0 -> 1`.
2. Enter reaches full Guard in 180 ms.
3. Recover preserves full Guard and fades only the future G3.3 reaction overlay in 140 ms.
4. Exit fades hold/correction together `1 -> 0` in 160 ms.
5. Weighted correction uses shortest-path quaternion interpolation.
6. No root, hips, leg or locomotion authoring is introduced.
7. Real-browser visual lab reports PASS.
8. Full repository tests remain green.

## Follow-up

### G3.3 — Block Hit / Parry Reaction Authoring

Create compact additive recoil overlays over the stable mother Guard. G3.2's `reactionOverlayWeight` contract is already ready to fade those reactions back into Hold.

### G3.4 — Counter Transition

Bind authoritative counter confirmation to a readable Guard -> Counter presentation.

G4 TOP / RIGHT / LEFT Guard variants remain out of scope until the Guard family lifecycle is visually stable.
