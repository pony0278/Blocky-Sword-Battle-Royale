# Skyrim Guard converted-source slot

G2 experimental source asset name:

```text
shd_blockidle.source.glb
```

This GLB is expected to contain the **Skyrim source hierarchy + source animation**, not an Action Studio-baked target rig.

Preferred during the probe: keep the GLB local and use **Import converted Skyrim GLB** in Action Studio or the dedicated G2.3 review page:

```text
tools/action-studio/skyrim-guard-visual-review.html
```

The dedicated review page adds Front / Side / 3/4 views, Once / Loop / scrub, automatic loop-seam measurements, and the five ADOPT decision gates.

If deliberately placed here, Action Studio can load it through **Skyrim Guard Probe → Load selected pack**.

The bridge retargets it at runtime/authoring time to:

```text
SKYRIM_GUARD/shd_blockidle
```

The source GLB should be produced from the real `shd_blockidle.hkx` using a matching Skyrim LE humanoid `skeleton.hkx`. Do not approximate the source rest pose from the Action Studio rig.

Do not place raw `.hkx` files in this directory. The repository `.gitignore` also ignores experimental `.glb` files in this slot.
