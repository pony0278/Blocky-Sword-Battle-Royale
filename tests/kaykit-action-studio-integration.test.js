import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Action Studio uses the procedural KayKit character as its default character factory', async () => {
  const source = await readFile(new URL('../tools/action-studio/action-studio.js', import.meta.url), 'utf8');
  assert.match(source, /createDefaultCharacter/);
  assert.doesNotMatch(source, /createBlockCharacter/);
  assert.match(source, /loadKayKitAnimationLibrary/);
  assert.match(source, /character\.registerAnimations/);
  assert.match(source, /ActionMotionPlayer/);
  assert.match(source, /createFittedAnimationBinding/);
  assert.match(source, /createStudioPreviewRuntime/);
  assert.match(source, /createWholeBodyMotionGuideOverlay/);
  assert.match(source, /createStudioMotionGuideEditor/);
  assert.match(source, /bakeStudioMotionConstraints/);
  assert.match(source, /character\.update\(deltaSeconds, preview\.camera\)/);
  assert.ok(source.split(/\r?\n/).length < 650, 'Action Studio entry should stay a thin composition root');
  assert.doesNotMatch(source, /setCharacterRenderStyle|data-character-style/);
  assert.match(source, /sword\.update\(\)/);
  assert.match(source, /sword\.setNodesVisible/);
  assert.match(source, /sword\.setGlowVisible/);
  assert.match(source, /sword\.getSweepSegment/);
});

test('Action Studio separates preview, project, and editor view responsibilities', async () => {
  const preview = await readFile(new URL('../tools/action-studio/studio-preview-runtime.js', import.meta.url), 'utf8');
  const project = await readFile(new URL('../tools/action-studio/studio-project.js', import.meta.url), 'utf8');
  const editorView = await readFile(new URL('../tools/action-studio/studio-editor-view.js', import.meta.url), 'utf8');
  const motionEditor = await readFile(new URL('../tools/action-studio/studio-motion-guide-editor.js', import.meta.url), 'utf8');
  const motionOverlay = await readFile(new URL('../tools/action-studio/studio-motion-guide-overlay.js', import.meta.url), 'utf8');
  const constraintBaker = await readFile(new URL('../tools/action-studio/studio-motion-constraint-baker.js', import.meta.url), 'utf8');
  assert.match(preview, /createStudioPreviewRuntime/);
  assert.match(preview, /sword\.trailTip\.getWorldPosition/);
  assert.match(project, /createStudioProject/);
  assert.match(editorView, /renderTimelineView/);
  assert.match(motionEditor, /createStudioMotionGuideEditor/);
  assert.match(motionEditor, /Bake Pose Keys/);
  assert.match(motionOverlay, /WHOLE_BODY_MOTION_GUIDES/);
  assert.match(motionOverlay, /Raycaster/);
  assert.match(motionOverlay, /stage-drag/);
  assert.match(motionOverlay, /GUIDE_WINDUP_TARGET/);
  assert.match(motionOverlay, /windupPullback/);
  assert.match(motionEditor, /Windup body load/);
  assert.match(constraintBaker, /WINDUP_HAND_POSE_KEYS/);
  assert.match(constraintBaker, /handslot\.r/);
  assert.match(constraintBaker, /SECONDARY_GRIP_POSE_KEYS/);
  assert.match(constraintBaker, /sword\.secondaryGrip/);
});

test('Action Studio exposes explicit KayKit runtime controls and GLTFLoader', async () => {
  const template = await readFile(new URL('../tools/action-studio/index.template.html', import.meta.url), 'utf8');
  assert.match(template, /GLTFLoader\.js/);
  assert.match(template, /id="loadKayKitAnimations"/);
  assert.match(template, /id="kaykitClip"/);
  assert.match(template, /id="playKayKitAnimation"/);
  assert.match(template, /id="bindKayKitAnimation"/);
  assert.match(template, /id="fitKayKitAnimation"/);
  assert.match(template, /id="clearAnimationBinding"/);
  assert.match(template, /id="wholeBodyMotionEditor"/);
  assert.match(template, /semantic guides → Pose Keys/);
  assert.match(template, /橘色圓環編排舉劍蓄力/);
  assert.match(template, /23 generated bones/);
  assert.match(template, /id="toggleRigNodes"/);
  assert.match(template, /id="toggleRigGlow"/);
  assert.doesNotMatch(template, />Hybrid<|>Block<|data-character-style/);
  assert.match(template, /id="weaponRigStatus"/);
  assert.match(template, /11 weapon bones/);
  assert.match(template, /exact v3 edges/);
});

test('default character dependency graph does not import a source KayKit model', async () => {
  const factory = await readFile(new URL('../src/character/default-character.js', import.meta.url), 'utf8');
  const character = await readFile(new URL('../src/character/procedural-kaykit-character.js', import.meta.url), 'utf8');
  const rig = await readFile(new URL('../src/character/procedural-kaykit-rig.js', import.meta.url), 'utf8');
  assert.doesNotMatch(`${factory}\n${character}\n${rig}`, /GLTFLoader|knight\.glb|EMBED\.knight/);
  assert.match(character, /createProceduralKayKitRig/);
  assert.match(character, /sampleAnimation/);
  assert.match(rig, /new THREE\.Bone/);
  assert.match(rig, /createKayKitV3LineAppearance/);
  assert.doesNotMatch(rig, /buildProceduralMeshes|BoxGeometry|MeshStandardMaterial/);
});
