# G2.5 — Skyrim Guard Adoption Decision & Triangle Correction Plan

## Status

**LOW-LEVEL RETARGET PIPELINE: ACCEPTED / FROZEN**  
**CANONICAL GUARD SOURCE: ADOPT WITH CORRECTIONS**  
**TRIANGLE CORRECTION CONTRACT: DEFINED**  
**CANONICAL LOCAL QUATERNION OFFSETS: NOT YET AUTHORED**

Canonical source:

`assets/skyrim/guard/converted/shd_blockidle.source.glb`

Canonical runtime clip:

`SKYRIM_GUARD/shd_blockidle`

Correction contract:

`src/combat/longsword-guard-metadata.js`

---

## 1. Final adoption decision

G2.4 through G2.4.5 established that the remaining Guard silhouette problem is not a technical retarget failure.

Accepted technical evidence:

- root / pelvis translation correctness: PASS
- canonical 40 s GLB playback stability: PASS
- Skyrim → Action Studio coordinate basis: PASS
- complete KayKit arm-chain / wrist retarget fidelity: PASS
- weapon helper ↔ KayKit sword socket bind calibration: GOOD
- calibrated weapon-frame max error: `0.004103°`
- full Guard visual workflow: PASS

Therefore `shd_blockidle` is frozen as:

**ADOPT WITH CORRECTIONS**

Reason:

`retarget-is-usable-but-triangle-guard-needs-local-corrections`

G2.5 explicitly forbids reopening the HKX decoder, translation scale, humanoid basis, arm FK, or G2.4.5 weapon bind merely to make the Guard look prettier.

---

## 2. What is good in the Skyrim source and must be preserved

The calibrated G2.4.5 review shows that these authored properties are already useful:

- hips / legs weight and planted stance
- body micro-motion
- torso side angle around `35.77–36.11°`
- off-hand height around `0.715–0.753` torso heights
- compact weapon/off-hand center distances around `0.565–0.591`
- a usable hand triangle rather than an open-chest pose
- stable loop / no fly-away

G2.5 treats these as **source assets to preserve**, not values to redesign from zero.

---

## 3. The three actual correction targets

After G2.4.5, the trustworthy canonical samples consistently fail only these Triangle Forward requirements:

1. `weaponHandHeight`
   - measured roughly `0.397–0.425`
   - sword hand is slightly too low
2. `swordTipHeight`
   - measured roughly `0.225–0.321`
   - blade tip is much too low
3. `swordForwardDot`
   - measured roughly `-0.787 to -0.825`
   - blade points substantially away from the intended lock-on threat direction

This is the exact correction scope. G2.5 must not turn a three-variable silhouette correction into a full-body re-authoring project.

---

## 4. Canonical Triangle Forward target contract

G2.5 introduces a tighter production target than the broad G2.4 suitability gate.

All normalized values use the same torso-height convention as the existing Guard review.

| Metric | G2.5 target | Intent |
| --- | ---: | --- |
| weapon-hand height | `0.50–0.75` | sternum / upper-chest combat position |
| off-hand height | `0.55–0.85` | preserve active free hand near centerline |
| weapon-hand center distance | `≤ 0.58` | keep right elbow / armpit compact |
| off-hand center distance | `≤ 0.62` | avoid opening the left side |
| sword-tip height | `0.70–1.10` | upper-chest to face threat region |
| sword-forward dot | `≥ 0.65` | blade clearly threatens lock-on target |
| triangle area | `0.035–0.20` | visible wedge without opening the torso |
| torso yaw | `20–38°` | preserve useful side-on body language |

The important tightening is:

- generic G2.4 sword-tip pass was only `≥ 0.55`; G2.5 raises it to `≥ 0.70`;
- generic G2.4 forward-dot pass was only `≥ 0.20`; G2.5 raises it to `≥ 0.65`;
- torso yaw is narrowed to the authored Triangle Guard target instead of allowing a very broad stance.

A target `swordForwardDot ≥ 0.65` corresponds to the blade remaining within roughly `49°` of the lock-on threat vector. The desired authored result should preferably sit closer to `0.8+`, but `0.65` is the canonical minimum gate.

---

## 5. Correction layer architecture

The G2.5 correction is an **additive local quaternion layer applied after Skyrim humanoid retargeting**.

Execution order:

```text
canonical Skyrim shd_blockidle
        ↓
G2.4 accepted humanoid retarget
        ↓
G2.5 local upper-body Guard correction
        ↓
right-hand / sword-tip target geometry
        ↓
G2.4.5 weapon bind calibration
        ↓
optional tiny handslot.r equipment trim
        ↓
procedural longsword model-space mount
        ↓
Triangle Guard validation
```

The correction must not be baked back into the raw source GLB and must not modify the canonical retarget math.

---

## 6. Bone scope

### Required correction bones

Start with only:

```text
upperarm.r
lowerarm.r
wrist.r
```

These three bones should carry the main change because the actual failures are right-hand height and sword direction.

### Optional bones

Use only when the required chain cannot meet all gates cleanly:

```text
chest
upperarm.l
lowerarm.l
wrist.l
handslot.r
```

Policy:

- `chest` is a small silhouette trim only; do not erase Skyrim torso weight.
- left-arm bones are initially preserved because current off-hand geometry is already usable.
- `handslot.r` is **fine trim only** after the arm/wrist pose is physically believable.

### Forbidden bones

G2.5 correction may not touch:

```text
root
hips
upperleg.l / upperleg.r
lowerleg.l / lowerleg.r
foot.l / foot.r
toes.l / toes.r
```

This is the hard boundary that protects the authored lower-body motion.

---

## 7. Correction magnitude budget

These values are authoring safety budgets, not pre-authored offsets:

| Bone | Max local correction budget |
| --- | ---: |
| chest | `8°` |
| upperarm.r | `40°` |
| lowerarm.r | `50°` |
| wrist.r | `65°` |
| upperarm.l | `20°` |
| lowerarm.l | `25°` |
| wrist.l | `30°` |
| handslot.r | `15°` |

Why `handslot.r` is capped at `15°`:

A large equipment-only rotation could make the blade point correctly while the wrist / hand still visibly holds it incorrectly. That would pass a sword ray metric but fail the physical pose. The major direction change must therefore come from the right arm / wrist chain; the equipment socket is only a final alignment trim.

If the authored pose requires more than these budgets to pass, G2.5.1 should report that fact rather than silently widening the budgets.

---

## 8. Lock-on sword threat definition

The authoring gate must be target-relative rather than camera-relative.

Recommended geometry:

```text
bladeDirection = normalize(swordTipWorld - swordGripWorld)
threatDirection = normalize(lockOnTargetAimWorld - swordGripWorld)
swordForwardDot = dot(bladeDirection, threatDirection)
```

For the static Guard Lab, use a fixed debug target in front of the character at upper-chest height.

Do not aim toward camera forward, because camera yaw / orbit is presentation state and must not redefine the Guard pose.

G2.5 base authoring remains a fixed additive pose. Continuous runtime aim correction / IK is explicitly deferred until the base Guard itself is accepted.

---

## 9. Authoring strategy

G2.5.1 should tune the base Guard in this order:

1. sample canonical `shd_blockidle` at `50%` as the primary authoring frame;
2. raise and compact the right weapon hand using `upperarm.r / lowerarm.r`;
3. rotate `wrist.r` to lift the blade while keeping the hand/blade relationship believable;
4. solve sword-tip forward threat toward the static lock-on target;
5. re-check right elbow / armpit openness;
6. leave the off hand untouched unless triangle area or centerline gates fail;
7. leave chest untouched unless a very small correction improves silhouette without destroying source weight;
8. use `handslot.r` only for ≤ `15°` final equipment trim;
9. export local quaternion offsets as canonical source-controlled metadata.

No hand-authored quaternion numbers are invented in G2.5. They must come from the Action Studio authoring result.

---

## 10. G2.5.1 acceptance gate — Base Guard Authoring

The first authored correction is accepted only when the same fixed local offsets are evaluated at:

- `0%`
- `25%`
- `50%`
- `75%`
- `99.8%`

Required:

- all eight G2.5 Triangle target gates pass at all five samples;
- no root / hips / lower-body correction tracks exist;
- no required bone exceeds its correction budget;
- `handslot.r` correction, if present, remains ≤ `15°`;
- G2.4.5 weapon bind frame equivalence remains GOOD;
- original 40 s loop stability remains PASS;
- no shoulder flip, elbow inversion, wrist snap, chest opening, or hand/blade disconnect appears in Front / 3-quarter / Side / Back review.

If one fixed additive pose cannot pass all five samples cleanly, the next escalation is **not** to change retarget math. Instead evaluate whether the source clip needs a small time-aware Guard correction curve or a selected stable hold segment.

---

## 11. Source-controlled implementation contract

New file:

`src/combat/longsword-guard-metadata.js`

It records:

- canonical source / runtime clip
- final adoption decision
- `lowLevelRetargetFrozen: true`
- Triangle Forward target ranges
- required / optional / forbidden bone scope
- per-bone authoring budgets
- equipment trim limit
- correction execution order
- current authoring state

Current authoring state is intentionally:

```text
authored = false
offsets = {}
```

This prevents G2.5 from pretending that a correction pose has already been authored.

Tests:

`tests/longsword-guard-metadata.test.js`

The test contract verifies that the representative pre-correction Guard fails exactly:

```text
weaponHandHeight
swordTipHeight
swordForwardDot
```

while the preserved off-hand / compactness / triangle / torso properties remain inside the new target contract.

---

## 12. G2.5 conclusion

The engineering question is now closed:

> Can the Skyrim `shd_blockidle` animation be used as the Action Studio longsword Guard base?

**Yes — ADOPT WITH CORRECTIONS.**

The remaining work is intentional animation authoring, not conversion debugging.

The corrected base Guard should preserve Skyrim's body life while changing only enough of the right upper-body chain to produce the desired forward-facing sword triangle.

---

## Next stage

**G2.5.1 — Triangle Forward Base Guard Authoring Lab**

Implement the additive correction layer in Action Studio, expose the allowed bones and target debug geometry, author the first real local quaternion offsets, export them into `longsword-guard-metadata.js`, and run the five-sample / four-view acceptance gate.

Only after the corrected base Guard passes should the project proceed to TOP / RIGHT / LEFT directional Guard authoring.
