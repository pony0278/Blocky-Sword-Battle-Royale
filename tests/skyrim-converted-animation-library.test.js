import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SKYRIM_GUARD_CONVERTED_FILES,
  createSkyrimConvertedAnimationLibrary,
  importSkyrimConvertedAnimationFile,
  loadSkyrimConvertedAnimationLibrary,
  retargetConvertedSkyrimGltf,
} from '../src/animation/skyrim-converted-animation-library.js';

const TARGET_RIG = {
  definition: { id: 'test-rig', bones: [] },
  restTransforms: {},
  bones: {},
};

function fakeGltf() {
  return {
    scene: {
      traverse(callback) { callback(this); },
    },
    animations: [{ name: 'source-blockidle', duration: 1.25 }],
  };
}

function retargetStub(_THREE, decoded, _rig, options) {
  assert.ok(decoded.scene);
  assert.equal(decoded.animations[0].name, 'source-blockidle');
  return {
    name: options.clipId,
    duration: decoded.animations[0].duration,
    userData: { source: 'skyrim', retargetFps: options.fps },
  };
}

test('G2.2 converted source manifest starts with the canonical blockidle Guard Hold probe', () => {
  assert.deepEqual(SKYRIM_GUARD_CONVERTED_FILES, [{
    id: 'shd_blockidle',
    file: 'shd_blockidle.source.glb',
    clipId: 'SKYRIM_GUARD/shd_blockidle',
    role: 'Guard Hold',
  }]);
});

test('converted Skyrim GLB is retargeted to the canonical Action Studio clip id', () => {
  const clip = retargetConvertedSkyrimGltf({}, fakeGltf(), TARGET_RIG, SKYRIM_GUARD_CONVERTED_FILES[0], {
    fps: 30,
    retargetClip: retargetStub,
  });
  assert.equal(clip.name, 'SKYRIM_GUARD/shd_blockidle');
  assert.equal(clip.duration, 1.25);
});

test('converted Skyrim library loads the expected bridge asset and exposes a normal external clip map', async () => {
  const loadedUrls = [];
  const loader = {
    load(url, resolve) {
      loadedUrls.push(url);
      resolve(fakeGltf());
    },
  };
  const library = await loadSkyrimConvertedAnimationLibrary(loader, {
    THREE: {},
    rig: TARGET_RIG,
    baseUrl: '/probe/',
    retargetClip: retargetStub,
  });
  assert.deepEqual(loadedUrls, ['/probe/shd_blockidle.source.glb']);
  assert.equal(library.source, 'skyrim');
  assert.equal(library.bridge, 'converted-glb');
  assert.equal(library.retargetFps, 30);
  assert.ok(library.clips.has('SKYRIM_GUARD/shd_blockidle'));
});

test('a local self-contained GLB can be imported without committing the experimental source asset', async () => {
  const loader = {
    parse(_bytes, _basePath, resolve) {
      resolve(fakeGltf());
    },
  };
  const file = {
    name: 'shd_blockidle.source.glb',
    async arrayBuffer() { return new ArrayBuffer(16); },
  };
  const library = await importSkyrimConvertedAnimationFile(loader, file, {
    THREE: {},
    rig: TARGET_RIG,
    retargetClip: retargetStub,
  });
  assert.equal(library.source, 'skyrim');
  assert.equal(library.files[0].localFile, 'shd_blockidle.source.glb');
  assert.ok(library.clips.has('SKYRIM_GUARD/shd_blockidle'));
});

test('local bridge import rejects non-self-contained source formats', async () => {
  const loader = { parse() {} };
  const file = {
    name: 'shd_blockidle.gltf',
    async arrayBuffer() { return new ArrayBuffer(1); },
  };
  await assert.rejects(
    importSkyrimConvertedAnimationFile(loader, file, { THREE: {}, rig: TARGET_RIG }),
    /self-contained \.glb/,
  );
});

test('a retargeted Skyrim clip can be wrapped as the same library shape used by existing external sources', () => {
  const clip = { name: 'SKYRIM_GUARD/shd_blockidle', duration: 1 };
  const library = createSkyrimConvertedAnimationLibrary(clip);
  assert.equal(library.clips.get(clip.name), clip);
  assert.equal(library.duplicates.length, 0);
});
