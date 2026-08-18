# G2.4.4 — Canonical Source ↔ Target Pose Equivalence & Guard Adoption Review

## Status

**BODY RETARGET EQUIVALENCE: WARNING / ACCEPTABLE FOR REVIEW**  
**WEAPON SOCKET EQUIVALENCE: BAD / BLOCKER**  
**FINAL GUARD ADOPTION: PENDING**

Reason:

`weapon-socket-equivalence-not-accepted`

This stage deliberately separates two questions that had previously been mixed together:

1. Does the Action Studio Blockman preserve the canonical Skyrim `shd_blockidle` body pose closely enough?
2. If it does, is the authored source pose actually suitable for the intended Triangle Forward Guard?

The answer to question 1 is now sufficiently clear for the body. The answer to question 2 is **not yet valid for the sword silhouette**, because the Skyrim `Weapon` helper frame and the KayKit / procedural-longword equipment frame are still not equivalent.

---

## Canonical comparison setup

Source:

`assets/skyrim/guard/converted/shd_blockidle.source.glb`

Target:

`SKYRIM_GUARD/shd_blockidle`

Comparison timestamps:

- 0%
- 25%
- 50%
- 75%
- 99.8%

The review page loads the real source GLB and the real runtime-retargeted Blockman simultaneously:

- `tools/action-studio/skyrim-pose-equivalence-review.html`
- `tools/action-studio/skyrim-pose-equivalence-review.js`

The source skeleton is converted through the accepted G2.4.2 humanoid basis and normalized by `source pelvis → head` versus `target hips → head` for side-by-side display. This display scale is intentionally independent from the runtime root-motion translation scale.

---

## Fair semantic equivalence policy

Skyrim and the Action Studio target do not have identical torso segmentation.

Skyrim contains a deeper Spine0 / Spine1 / Spine2 chain, while the target uses a simpler hips / spine / chest chain. Therefore G2.4.4 does **not** compare `Skyrim Pelvis → Spine0` directly against `KayKit hips → spine` as if they were identical semantic segments.

The accepted technical body gate instead compares aggregate semantic directions:

- source pelvis → chest vs target hips → chest
- source pelvis → head vs target hips → head
- source chest → head vs target chest → head
- upper arm / lower arm on both sides
- upper leg / lower leg / foot on both sides

Hand → Weapon and Hand → Shield helper directions are recorded separately as equipment/helper diagnostics.

---

## Body technical equivalence result

Across the five canonical timestamps, the core body direction comparison produced:

- mean direction error: `6.51447°`
- p95 direction error: `15.63755°`
- max direction error: `15.64991°`
- classification: **WARNING**

Thresholds:

- GOOD: mean ≤ `8°`, p95 ≤ `15°`, max ≤ `25°`
- WARNING: mean ≤ `15°`, p95 ≤ `28°`, max ≤ `45°`

The result narrowly misses GOOD on p95, but remains well inside the accepted correction range.

### Worst error per semantic segment

- torso pelvis → chest: `9.84037°`
- torso pelvis → head: `5.00477°`
- torso chest → head: `11.83468°`
- left upper arm: `0.00306°`
- left lower arm: `0.00315°`
- right upper arm: `0.00352°`
- right lower arm: `0.00225°`
- left upper leg: `8.12041°`
- left lower leg: `5.49533°`
- left foot: `15.64991°`
- right upper leg: `8.11827°`
- right lower leg: `5.51395°`
- right foot: `15.63889°`

This confirms the G2.4.3 arm-chain work: the weapon arm itself is no longer the dominant retarget error. The largest remaining body differences are target/source rig segmentation and foot/rest-axis differences.

---

## Weapon helper / sword socket blocker

The helper diagnostics exposed a separate problem:

- helper mean direction error: `75.24312°`
- helper max direction error: `77.08663°`
- right `Hand → Weapon` vs target `wrist → handslot.r` max error: `77.08663°`
- weapon socket classification: **BAD**

Weapon socket acceptance thresholds:

- GOOD: ≤ `15°`
- WARNING: ≤ `30°`
- BAD: > `30°`

This means G2.4.3 successfully propagated Skyrim `Weapon` rotation into `handslot.r`, but the two equipment systems do not share the same bind-space frame.

The remaining sword-down visual must therefore **not** be interpreted as proof that the authored `shd_blockidle` source sword pose points downward.

A 77° bind-frame mismatch is large enough to invalidate target sword-tip direction as a source-pose suitability metric.

---

## Triangle Guard suitability observations

The current target samples show the following stable body qualities:

- off-hand height: approximately `0.715–0.753` torso heights — usable
- weapon-hand horizontal center distance: approximately `0.565–0.591` — compact enough
- off-hand horizontal center distance: approximately `0.570–0.586` — compact enough
- torso yaw: approximately `35.77–36.11°` — near the intended side-on combat range
- weapon-hand height: approximately `0.397–0.425` — slightly below the current `0.45` minimum

Ignoring sword-dependent metrics while the equipment bind is unresolved, all five samples classify as **WARNING**, not BAD.

Therefore the provisional body-only adoption result is:

**ADOPT WITH CORRECTIONS**

The main body correction currently indicated is raising / compacting the weapon hand slightly for the intended Triangle Forward Guard language.

### Metrics that are currently invalid for final source suitability

The target currently reports:

- sword-tip height below the intended region
- negative sword-forward dot
- sword/hand/off-hand triangle geometry affected by the mounted sword frame

These values must not drive ADOPT / REJECT while Weapon-helper ↔ sword-bind equivalence is BAD.

---

## Final G2.4.4 decision

**PENDING**

Reason:

`weapon-socket-equivalence-not-accepted`

G2.4.4 does **not** reject `shd_blockidle`.

What is now accepted:

- HKX → canonical source GLB is coherent.
- root / pelvis motion is stable.
- global Skyrim ↔ Action Studio basis is calibrated.
- upper/lower arm FK fidelity is effectively exact.
- full-body source ↔ target semantic pose fidelity is within a correction-level WARNING range.

What remains unresolved:

- Skyrim `Weapon` helper bind frame ↔ KayKit `HAND_R` / `handslot.r` / procedural longsword grip-blade frame.

Only after that equipment-frame correction can the source sword threat direction and final Triangle Guard suitability be judged honestly.

---

## Validation

Latest canonical execution for the final G2.4.4 logic:

- CI Run 97: **success**
- Skyrim Guard Visual Verification Run 28: **success**
- G2.4.2 basis gate: **success**
- G2.4.3 arm-chain gate: **success**
- G2.4.4 source-target review: **success**
- canonical playback / screenshot capture: **success**

Final page state:

- `data-g244="ready"`
- `data-g244-equivalence="warning"`
- `data-g244-weapon-socket="bad"`
- `data-g244-decision="pending"`

---

## Recommended next stage

**G2.4.5 — Skyrim Weapon Helper ↔ KayKit Sword Socket Bind Calibration**

The next stage must derive a bind-space correction rather than manually rotating the visible sword until it looks right.

Recommended approach:

1. Capture Skyrim `Weapon` helper rest world frame.
2. Convert that frame through the accepted G2.4.2 basis.
3. Capture the canonical target equipment frame at `handslot.r / HAND_R`.
4. Include the procedural longsword's canonical grip / blade frame rather than assuming `wrist → handslot` is the blade axis.
5. Derive a bind correction quaternion from source equipment rest frame to target weapon frame.
6. Apply Skyrim Weapon animation delta through that correction.
7. Add a weapon-frame equivalence gate.
8. Rerun G2.4.4 only after weapon socket equivalence reaches GOOD or WARNING.

Do not hard-code `77°` as a visual offset. The `77.08663°` value is evidence of a frame mismatch, not the desired correction axis by itself.
