# Blocky Sword Battle Royale

Phase A introduces **Action Studio** and a clean procedural block-character animation core for a multiplayer-oriented 3D action game.

## Action Studio

Start any static HTTP server from the repository root. For example:

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

Then open:

- `http://127.0.0.1:4173/tools/action-studio/`
- The former `tools/punch-studio.html` URL redirects to the same page.

The Phase A page provides T-pose, idle, Slash Test, Guard, Parry and Counter templates; arbitrary timeline keys; impact/cancel markers; scrub/play/slow/loop; pose sliders; generic action windows; a `HAND_R` debug sword with saved mount calibration; weapon-trail and combat-feel previews; and a local clip library/combo preview.

## Runtime boundaries

- `src/animation/` owns pose normalization/interpolation, clips, timeline evaluation and presentation playback.
- `src/character/` owns the procedural hierarchy, pose application, grounding and stable equipment sockets.
- `src/combat/action-definition.js` owns authoring metadata windows only.
- Network/combat simulation remains authoritative for hit, block, parry and counter outcomes.

Action Studio does not load the legacy Punch Studio modules. The preserved old entry is `tools/punch-studio.legacy.html`; its classic-script sources remain under `tools/ps/` for visual cross-checking only.

See [ACTION_STUDIO_EXTRACTION_PLAN.md](handoff/ACTION_STUDIO_EXTRACTION_PLAN.md) for the dependency map, extraction boundary, compatibility strategy and recorded source/spec differences.

## Tests

```powershell
npm test
```

The tests cover pose normalization, pose interpolation, timeline normalization, clip evaluation, action metadata, socket existence, the `HAND_R` weapon attachment contract, legacy snapshot compatibility, template metadata and the no-legacy-import boundary.

