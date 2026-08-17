# Skyrim Guard converted-source slot

G2 experimental source asset name:

```text
shd_blockidle.source.glb
```

This GLB is expected to contain the **Skyrim source hierarchy + source animation**, not an Action Studio-baked target rig.

Preferred during the probe: keep the GLB local and use **Import converted Skyrim GLB** in Action Studio.

If deliberately placed here, Action Studio can load it through **Skyrim Guard Probe → Load selected pack**.

The bridge retargets it at runtime/authoring time to:

```text
SKYRIM_GUARD/shd_blockidle
```

Do not place raw `.hkx` files in this directory.
