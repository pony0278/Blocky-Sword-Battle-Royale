# G3.5 — Parry / Counter Semantic Remap

## Goal

Make Guard animation naming match what the player can actually read on screen.

G3.5 does **not** change authoritative combat outcomes or Guard state-machine transitions. It separates defensive contact presentation from gameplay outcome, so Block / Parry / Perfect Parry may share one defensive reaction while Counter remains the offensive payoff.

## Final semantic audit

| Runtime role | Production source | Readable meaning | G3.5 decision |
| --- | --- | --- | --- |
| Block Hit | `SKYRIM_GUARD/shd_blockhit` | Defensive contact / recoil | **KEEP** |
| Parry | `SKYRIM_GUARD/shd_blockhit` | Successful timed block | **SHARE Block Hit motion** |
| Perfect Parry | `SKYRIM_GUARD/shd_blockhit` | Higher-quality successful timed block | **SHARE Block Hit motion** |
| Counter | `Melee_Block_Attack` | Block attack / shield-forward push | **REPLACE for Counter; keep as Shield Bash / Guard Push candidate** |

## Core semantic decision

Parry is **not** a separate attack animation requirement.

For this combat model:

- **Block** = the defender successfully stops an incoming attack;
- **Parry** = the defender stops it with correct timing and earns a Counter opportunity;
- **Perfect Parry** = the same defensive contact outcome with a stronger gameplay reward / presentation accent;
- **Counter** = the actual offensive retaliation after a confirmed Parry.

Therefore Block, Parry and Perfect Parry can legitimately share the same validated defensive contact animation.

The semantic difference belongs primarily in:

- authoritative combat outcome;
- Counter Window timing;
- opponent stagger / vulnerability;
- hit-stop;
- FX / audio;
- UI feedback if desired.

It does **not** require a separate shield-bash or deflect animation merely to prove that a Parry happened.

## Runtime mapping

### Shared defensive contact

`SKYRIM_GUARD/shd_blockhit`

- source asset duration: `0.80s`
- validated production window: `0.00–0.60s`
- root rotation policy: `lock`

All three defensive outcomes now sample this same source window.

Their gameplay/presentation windows remain distinct:

- Block Hit Counter Window: `0.24–0.60s`
- Parry Counter Window: `0.08–0.333...s`
- Perfect Parry Counter Window: `0.10–0.48s`

Sharing one animation therefore does **not** collapse the three outcomes into one state.

## Shield Bash assets

The following clips are no longer used as Parry presentation sources:

- `shd_blockbash`
- `shd_blockbashpower`

Do not delete them. They remain useful future candidates for a dedicated Shield Bash / Power Shield Bash mechanic.

This is a semantic cleanup, not asset rejection.

## Counter

Counter remains the only unresolved semantic gap in G3.5.

Current source:

`Melee_Block_Attack`

Current problem:

- reads as a shield-forward push / block attack;
- right-hand longsword is not the clear offensive payoff;
- therefore it does not communicate a true retaliation after Parry.

### Counter replacement criteria

- **right-hand longsword is the primary attacking tool**;
- clear slash or thrust contact silhouette shortly after launch;
- shield is secondary and cannot be the only forward-driving object;
- should feel faster and more decisive than a normal neutral attack;
- recovery must be able to blend back into Triangle Guard.

## Recommended next stage

### G3.5.1 — Counter Source Replacement

A dedicated Parry source search is no longer required.

Search only for the missing offensive response. Useful keywords:

- `one handed sword riposte animation`
- `longsword counter attack animation`
- `sword riposte FBX`
- `sword counter slash animation`
- `sword counter thrust animation`

For this role, **riposte** is a particularly useful search term because it describes the immediate offensive answer after a successful parry.

## Non-goals

- no Guard FSM redesign;
- no authority changes;
- no removal of Skyrim shield-bash assets;
- no new Counter asset adopted in this stage;
- no claim that Block / Parry / Perfect Parry are identical gameplay outcomes — only their defensive contact motion is shared.
