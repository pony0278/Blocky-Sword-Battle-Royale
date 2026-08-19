# G3.5 — Parry / Counter Semantic Remap

## Goal

Make Guard animation naming match what the player can actually read on screen.

G3.5 does **not** change authoritative combat outcomes or Guard state-machine transitions. It classifies the currently wired animation sources honestly, preserves technically useful assets, and defines the acceptance criteria for replacement Parry / Perfect Parry / Counter motions.

## Current semantic audit

| Runtime role | Current source | What it actually reads as | G3.5 decision |
| --- | --- | --- | --- |
| Block Hit | `SKYRIM_GUARD/shd_blockhit` | Defensive impact / recoil | **KEEP** |
| Parry | `SKYRIM_GUARD/shd_blockbash` | Shield bash | **REPLACE for Parry; keep as Shield Bash candidate** |
| Perfect Parry | `SKYRIM_GUARD/shd_blockbashpower` | Strong / powered shield bash | **REPLACE for Perfect Parry; keep as Power Shield Bash candidate** |
| Counter | `Melee_Block_Attack` | Block attack / shield-forward push | **REPLACE for Counter; keep as Shield Bash / Guard Push candidate** |

## Semantic contract

### Guard

Readable meaning: sustained defensive posture. The sword + shield close the body opening and face the opponent.

### Parry

Readable meaning: a short defensive **deflection**, not an attack.

Replacement motion criteria:

- short, reactive defensive movement;
- shield or sword redirects the incoming attack line laterally or upward;
- limited forward body displacement;
- should not look like the character is trying to hit the opponent with the shield;
- finishes in a weapon-ready pose that can immediately flow into Counter.

### Perfect Parry

Readable meaning: the same defensive deflection language as normal Parry, but with a stronger and clearer contact accent.

Replacement motion criteria:

- still reads primarily as a deflection rather than a shield bash;
- may commit the torso/arms more strongly;
- contact should visibly open the opponent's attack line;
- must leave a readable Counter opportunity.

### Counter

Readable meaning: the offensive payoff after a successful Parry.

Replacement motion criteria:

- **right-hand longsword is the primary attacking tool**;
- clear slash or thrust contact silhouette shortly after launch;
- shield is secondary and cannot be the only forward-driving object;
- should feel faster and more decisive than a normal neutral attack;
- recovery must be able to blend back into Triangle Guard.

## Asset policy

Do not delete the current mismatched sources. They are technically valid and useful for a future Shield Bash family:

- `shd_blockbash` → Shield Bash candidate
- `shd_blockbashpower` → Power Shield Bash candidate
- `Melee_Block_Attack` → Shield Bash / Guard Push candidate

This avoids wasting already-retargeted and runtime-safe animation work.

## Runtime policy for G3.5

Until replacement motions are supplied:

- keep current clips wired so existing Guard flow, CI, and Action Studio inspection remain functional;
- mark Parry / Perfect Parry / Counter profiles with `semanticFit: mismatch` and `replacementRequired: true`;
- do not call these animations visually approved in future handoffs;
- Block Hit remains semantically approved.

## Suggested next stage

### G3.5.1 — Parry Source Replacement

When a candidate animation is available, review it first against the Parry semantic checklist before changing runtime mapping.

### G3.5.2 — Counter Source Replacement

Prefer a compact longsword slash or thrust with a clear early contact pose. Only after visual approval should the existing `Melee_Block_Attack` mapping be replaced.

## Search brief for new animation assets

Useful search terms:

- `shield parry animation`
- `weapon deflect animation`
- `sword parry animation`
- `one handed sword riposte animation`
- `longsword counter attack animation`
- `sword riposte FBX`

For Counter, **riposte** is often a better search term than `counter`, because it specifically describes an immediate attack following a successful parry.
