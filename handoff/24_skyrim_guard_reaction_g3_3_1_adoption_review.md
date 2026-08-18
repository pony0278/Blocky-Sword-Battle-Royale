# G3.3.1 — Skyrim Guard Reaction Pack Adoption Review

## Goal

Avoid unnecessary custom animation authoring by reusing the same Skyrim shield-block animation family that already produced the accepted `shd_blockidle` mother Guard.

This review separates two questions:

1. **Engineering compatibility** — can the raw HKX travel through the same Skyrim LE/HavokToolset → GLB → Blockman retarget path?
2. **Combat semantics** — does the motion read correctly as Block Hit, Parry/Deflect, Perfect Parry, or Counter once the shield-oriented source is adapted to the longsword Triangle Guard?

## Stage 1 Decision Rules

### ADOPT
Use directly after the existing Skyrim retarget and weapon bind calibration with no special pose correction beyond the canonical Guard family baseline.

### ADOPT WITH CORRECTIONS
Keep the source motion, but allow a small Guard-family correction layer to preserve:

- sword-forward threat,
- weapon-hand connection,
- readable off-hand position,
- stable root/feet,
- compatibility with the G2.5.1 Triangle Forward Guard.

Do not rewrite lower-body locomotion solely to make a shield-oriented silhouette look like a sword action.

### REJECT
Do not place the clip in the core reactive Guard chain when its semantic timing is wrong for the state, even if the file is technically compatible.

## Raw HKX Compatibility Result

All five reviewed files match the already proven Skyrim LE family signature:

- Havok: `hk_2010.2.0-r1`
- `hkaSplineCompressedAnimation`
- `hkaAnimationBinding`
- `NPC Root [Root]`

Therefore none is rejected for binary-format incompatibility.

## Decisions

### 1. `shd_blockhit` — **ADOPT WITH CORRECTIONS**

Role: `guard_block_hit`

Why:

- exact semantic match for a successful Block reaction,
- belongs to the same shield-block family as the accepted `shd_blockidle`,
- contains `FootScuffLeft` / `FootScuffRight`, suggesting useful lower-body impact response rather than a hand-only twitch.

Correction boundary:

- retain the source impact/recoil timing,
- preserve source foot/weight response unless visual review exposes instability,
- reuse G2.4.5 weapon bind calibration,
- apply only small upper-body/weapon correction if the shield-oriented arm path pulls the longsword away from the Triangle Guard recovery line.

This replaces the earlier plan to author Block Hit from scratch. KayKit `Melee_Block_Hit` becomes fallback only.

### 2. `shd_blockbashintro` — **ADOPT WITH CORRECTIONS**

Primary role: `guard_parry_intro`

Why:

- likely provides the compact departure from Guard Hold needed before a deflect/bash contact,
- small file footprint suggests a short transition rather than a long standalone combat sequence,
- can potentially solve the missing Parry reaction without new authored motion.

Acceptance requirement:

- must leave Triangle Guard quickly,
- cannot visibly prepare a shield strike for too long,
- must connect cleanly into `shd_blockbash` or directly back to Recover.

### 3. `shd_blockbash` — **ADOPT WITH CORRECTIONS**

Primary role candidate: `guard_parry_deflect`
Secondary role candidate: early Counter presentation

Why:

- a bash motion is closer to an active deflection than a passive Block Hit,
- likely has the outward impulse needed to visually communicate that the defender actively displaced the incoming weapon.

Risk:

- shield-family source may drive the off-hand too aggressively while the weapon hand remains secondary.

If that happens, preserve timing/body impulse but correct the weapon arm so the longsword performs the readable deflect.

### 4. `shd_blockbashpower` — **ADOPT WITH CORRECTIONS**

Primary role candidate: Perfect Parry / strong deflect
Secondary role candidate: heavy Guard Counter

Why:

- technically matches the same animation family,
- the `power` variant gives us a natural stronger visual tier without authoring a new animation,
- potentially differentiates ordinary Block from Perfect Parry through body commitment rather than only VFX.

Constraint:

- do **not** use it as the default Parry if it creates a long or exaggerated full-body lunge,
- prefer it for Perfect Parry / heavy deflect / counter if its commitment is visibly larger than `shd_blockbash`.

### 5. `shd_blockanticipate` — **REJECT** for the core reactive G3.3 path

Reason:

- the semantic role is anticipation/brace, while G3.3 reactions occur after or at confirmed defensive contact,
- inserting anticipation after `BLOCK_CONFIRMED` / `PARRY_CONFIRMED` would reverse cause and effect,
- using it before contact would belong to input/telegraph presentation rather than reaction authoring.

Keep it as an optional future reference for:

- AI defensive telegraph,
- heavy-guard brace,
- stamina-break anticipation,
- cinematic guard preparation.

It is not deleted or globally rejected as an asset; it is rejected from the core reactive state chain.

## Proposed Guard Family After Stage 1

```text
Action Studio Idle
        ↓
G3.2 Guard Enter
        ↓
Skyrim shd_blockidle + Triangle correction
        │
        ├─ BLOCK_CONFIRMED
        │      ↓
        │   shd_blockhit
        │      ↓
        │   G3.2 Recover
        │      ↓
        │   Guard Hold
        │
        └─ PARRY_CONFIRMED
               ↓
        shd_blockbashintro
               ↓
          shd_blockbash
          or blockbashpower
               ↓
        G3.2 Recover / Counter
```

## Visual Confirmation Gate

Only the four `ADOPT WITH CORRECTIONS` candidates proceed to conversion/playback review:

- `shd_blockhit`
- `shd_blockbashintro`
- `shd_blockbash`
- `shd_blockbashpower`

The visual probe must compare each against the accepted `shd_blockidle` baseline and issue a final promotion/demotion:

- **ADOPT** — motion already reads correctly with standard family calibration.
- **ADOPT WITH CORRECTIONS** — useful source motion, small correction required.
- **REJECT** — shield-specific semantics remain wrong after reasonable correction.

### Visual gates

1. no root fly-away,
2. feet/root remain physically plausible,
3. no shoulder flip / elbow inversion / wrist snap,
4. sword remains attached through G2.4.5 bind calibration,
5. transition out of and back into Triangle Guard is readable,
6. Parry candidate visibly displaces the threat rather than looking like the defender was simply hit,
7. Perfect Parry candidate is stronger than normal Parry without becoming a long locomotion attack.

## Fallback Order

Only if Skyrim candidates fail visual review:

1. KayKit `Melee_Block_Hit` / `Melee_Block_Attack`
2. UAL2 `Sword_Block`
3. custom authoring

This keeps the Guard family visually consistent and minimizes cross-pack retarget complexity.
