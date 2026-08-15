# Action Studio entry files

- `index.template.html` and `action-studio.js` are the editable source entry points.
- `index.html` and `action-studio.bundle.js` are generated standalone files.
- Run `npm run build:action-studio` after changing `src/`, `action-studio.js` or the HTML template.

The entry file is a composition root. Its extracted responsibilities live in:

- `studio-preview-runtime.js` — Three.js scene, camera, trail and hit-feel preview.
- `studio-editor-view.js` — editor DOM rendering and animation-binding controls.
- `studio-project.js` — project serialization, local storage and combo-project assembly.
- `studio-motion-guide-editor.js` — semantic whole-body controls and Pose Key baking.
- `studio-motion-guide-overlay.js` — linked hand, head, center-of-mass, and foot targets in the Three.js stage.
- `studio-motion-constraint-baker.js` — editor-only off-hand fitting against the procedural sword's secondary grip.

Action motion is driven by `src/animation/action-motion-player.js`. Every action owns a normalized `animationBinding`: `authored` uses Action Studio pose keys, while `kaykit` references a clip by name and deterministically maps the action frame to animation time. The JSON never embeds a Three.js `AnimationClip` or GLB data.

The first Whole-Body Motion preset is `advancing_vertical_chop`. Its compact guide data is stored in `clip.metadata.motionGuide`; the editor bakes it into seven ordinary Pose Keys, so runtime playback does not depend on the editor or solver.

Motion guide version 2 adds draggable impact, center-of-mass, and plant targets, lead-foot locking from plant through follow-through, and an editor-only two-hand grip fit. The grip solver writes the fitted left-arm axes and its error report into the clip; it is never required during playback.

The KayKit library currently registers eight `Rig_Medium` packs: general, basic movement, advanced movement, melee, ranged, simulation, special, and tools.

The generated `index.html` deliberately loads a classic script so the pose editor can open directly through `file://` without browser ES-module CORS errors. Loading the external KayKit animation packs requires serving the repository through local HTTP.

