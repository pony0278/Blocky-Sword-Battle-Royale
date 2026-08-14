# KayKit runtime animation assets

This directory is generated from `tools/kaykit_combat_lab_v3_procedural_character_generator.html` by:

```powershell
npm run extract:kaykit
```

Runtime policy:

- The Knight model and its skinned presentation mesh are not runtime dependencies.
- `src/character/kaykit-rig-definition.js` contains the extracted Rest Pose used to construct 23 `THREE.Bone` nodes procedurally.
- The four GLB files in `animations/` are loaded only for `AnimationClip` data; their source scenes are discarded after parsing.
- Stable game-facing sockets are generated below the animated `handslot.l` and `handslot.r` bones.

Before public redistribution, retain and verify the license/provenance supplied with the original KayKit asset package. This repository currently records the user-provided Combat Lab HTML as the immediate source.
