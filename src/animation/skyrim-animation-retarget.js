import { sanitizeAnimationTargetName } from './animation-target-name.js';

function aliases(...names) {
  return Object.freeze(names.filter(Boolean));
}

export const SKYRIM_BONE_RETARGETS = Object.freeze([
  Object.freeze({
    id: 'root',
    sourceAliases: aliases('NPC Root [Root]', 'NPC Root', 'Root', 'root'),
    target: 'root',
    position: true,
  }),
  Object.freeze({
    id: 'pelvis',
    sourceAliases: aliases('NPC Pelvis [Pelv]', 'NPC Pelvis', 'Pelvis', 'pelvis'),
    target: 'hips',
    position: true,
  }),
  Object.freeze({
    id: 'spine',
    sourceAliases: aliases('NPC Spine [Spn0]', 'NPC Spine', 'Spine', 'spine'),
    target: 'spine',
  }),
  Object.freeze({
    id: 'chest',
    sourceAliases: aliases('NPC Spine2 [Spn2]', 'NPC Spine2', 'Spine2', 'spine2', 'Chest', 'chest'),
    target: 'chest',
  }),
  Object.freeze({
    id: 'head',
    sourceAliases: aliases('NPC Head [Head]', 'NPC Head', 'Head', 'head'),
    target: 'head',
  }),
  Object.freeze({
    id: 'upperarm.l',
    sourceAliases: aliases('NPC L UpperArm [LUar]', 'NPC L UpperArm', 'L UpperArm', 'UpperArm.L'),
    target: 'upperarm.l',
  }),
  Object.freeze({
    id: 'lowerarm.l',
    sourceAliases: aliases('NPC L Forearm [LLar]', 'NPC L Forearm', 'L Forearm', 'Forearm.L'),
    target: 'lowerarm.l',
  }),
  Object.freeze({
    id: 'wrist.l',
    sourceAliases: aliases('NPC L Hand [LHnd]', 'NPC L Hand', 'L Hand', 'Hand.L'),
    target: 'wrist.l',
  }),
  Object.freeze({
    id: 'upperarm.r',
    sourceAliases: aliases('NPC R UpperArm [RUar]', 'NPC R UpperArm', 'R UpperArm', 'UpperArm.R'),
    target: 'upperarm.r',
  }),
  Object.freeze({
    id: 'lowerarm.r',
    sourceAliases: aliases('NPC R Forearm [RLar]', 'NPC R Forearm', 'R Forearm', 'Forearm.R'),
    target: 'lowerarm.r',
  }),
  Object.freeze({
    id: 'wrist.r',
    sourceAliases: aliases('NPC R Hand [RHnd]', 'NPC R Hand', 'R Hand', 'Hand.R'),
    target: 'wrist.r',
  }),
  Object.freeze({
    id: 'upperleg.l',
    sourceAliases: aliases('NPC L Thigh [LThg]', 'NPC L Thigh', 'L Thigh', 'Thigh.L'),
    target: 'upperleg.l',
  }),
  Object.freeze({
    id: 'lowerleg.l',
    sourceAliases: aliases('NPC L Calf [LClf]', 'NPC L Calf', 'L Calf', 'Calf.L'),
    target: 'lowerleg.l',
  }),
  Object.freeze({
    id: 'foot.l',
    sourceAliases: aliases('NPC L Foot [Lft ]', 'NPC L Foot [Lft]', 'NPC L Foot', 'L Foot', 'Foot.L'),
    target: 'foot.l',
  }),
  Object.freeze({
    id: 'toes.l',
    sourceAliases: aliases('NPC L Toe0 [LToe]', 'NPC L Toe0', 'L Toe0', 'Toe.L'),
    target: 'toes.l',
  }),
  Object.freeze({
    id: 'upperleg.r',
    sourceAliases: aliases('NPC R Thigh [RThg]', 'NPC R Thigh', 'R Thigh', 'Thigh.R'),
    target: 'upperleg.r',
  }),
  Object.freeze({
    id: 'lowerleg.r',
    sourceAliases: aliases('NPC R Calf [RClf]', 'NPC R Calf', 'R Calf', 'Calf.R'),
    target: 'lowerleg.r',
  }),
  Object.freeze({
    id: 'foot.r',
    sourceAliases: aliases('NPC R Foot [Rft ]', 'NPC R Foot [Rft]', 'NPC R Foot', 'R Foot', 'Foot.R'),
    target: 'foot.r',
  }),
  Object.freeze({
    id: 'toes.r',
    sourceAliases: aliases('NPC R Toe0 [RToe]', 'NPC R Toe0', 'R Toe0', 'Toe.R'),
    target: 'toes.r',
  }),
]);

function normalizedNodeName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function compactNodeName(value) {
  return normalizedNodeName(value).replace(/[^a-z0-9]/g, '');
}

function nodeNameKeys(value) {
  const normalized = normalizedNodeName(value);
  const compact = compactNodeName(value);
  return [...new Set([normalized, compact].filter(Boolean))];
}

function collectNamedNodes(root) {
  const nodes = new Map();
  root?.traverse?.((node) => {
    for (const key of nodeNameKeys(node?.name)) {
      if (!nodes.has(key)) nodes.set(key, node);
    }
  });
  return nodes;
}

function findNode(root, namedNodes, sourceAliases) {
  for (const alias of sourceAliases) {
    const exact = root?.getObjectByName?.(alias);
    if (exact) return exact;
    for (const key of nodeNameKeys(alias)) {
      const normalized = namedNodes.get(key);
      if (normalized) return normalized;
    }
  }
  return null;
}

export function resolveSkyrimSourceNodes(root, retargets = SKYRIM_BONE_RETARGETS) {
  if (!root) throw new Error('Skyrim retarget source is missing its hierarchy root');
  const namedNodes = collectNamedNodes(root);
  const nodes = {};
  const missing = [];
  for (const mapping of retargets) {
    const node = findNode(root, namedNodes, mapping.sourceAliases || []);
    if (node) nodes[mapping.id] = node;
    else missing.push(mapping.id);
  }
  return { nodes, missing, valid: missing.length === 0 };
}

export function validateSkyrimTargetRig(rig, retargets = SKYRIM_BONE_RETARGETS) {
  const targetBones = new Set(Object.keys(rig?.bones || {}));
  const missing = retargets.map(({ target }) => target).filter((target) => !targetBones.has(target));
  return { valid: missing.length === 0, missing };
}

function createTargetProxy(THREE, rig) {
  const root = new THREE.Object3D();
  const bones = {};
  for (const definition of rig.definition.bones) {
    const bone = new THREE.Object3D();
    const rest = rig.restTransforms[definition.id];
    bone.name = sanitizeAnimationTargetName(definition.id);
    bone.position.fromArray(rest.position);
    bone.quaternion.fromArray(rest.quaternion);
    bone.scale.fromArray(rest.scale);
    (definition.parent ? bones[definition.parent] : root).add(bone);
    bones[definition.id] = bone;
  }
  root.updateMatrixWorld(true);
  return { root, bones };
}

function restoreTargetProxy(proxy, rig) {
  for (const [boneId, rest] of Object.entries(rig.restTransforms)) {
    const bone = proxy.bones[boneId];
    bone.position.fromArray(rest.position);
    bone.quaternion.fromArray(rest.quaternion);
    bone.scale.fromArray(rest.scale);
  }
  proxy.root.updateMatrixWorld(true);
}

function worldSnapshot(THREE, object3d) {
  return {
    position: object3d.getWorldPosition(new THREE.Vector3()),
    quaternion: object3d.getWorldQuaternion(new THREE.Quaternion()),
  };
}

function sampleTimes(duration, fps) {
  const step = 1 / Math.max(1, Number(fps) || 30);
  const times = [];
  for (let time = 0; time < duration - step * 0.25; time += step) times.push(time);
  if (!times.length || Math.abs(times.at(-1) - duration) > 1e-5) times.push(duration);
  return times;
}

function motionScale(sourceRest, targetRest) {
  const sourceHeight = sourceRest.head.position.distanceTo(sourceRest.root.position);
  const targetHeight = targetRest.head.position.distanceTo(targetRest.root.position);
  if (sourceHeight < 0.001 || targetHeight < 0.001) return 1;
  return Math.max(0.5, Math.min(1.5, targetHeight / sourceHeight));
}

function decodedSource(input) {
  const root = input?.root || input?.scene || null;
  const clip = input?.clip || input?.animations?.[0] || null;
  return { root, clip };
}

export function retargetSkyrimClip(THREE, decoded, rig, options = {}) {
  if (!THREE?.AnimationMixer || !THREE?.AnimationClip) {
    throw new Error('Skyrim retargeting requires the Three.js animation runtime');
  }
  if (!rig?.definition || !rig?.restTransforms || !rig?.bones) {
    throw new Error('Skyrim retargeting requires the Action Studio procedural target rig');
  }

  const { root: sourceRoot, clip: sourceClip } = decodedSource(decoded);
  if (!sourceRoot || !sourceClip) {
    throw new Error('Decoded Skyrim animation must provide a hierarchy root and an animation clip');
  }

  const retargets = options.boneRetargets || SKYRIM_BONE_RETARGETS;
  const targetReport = validateSkyrimTargetRig(rig, retargets);
  if (!targetReport.valid) {
    throw new Error(`Action Studio rig is missing Skyrim retarget targets: ${targetReport.missing.join(', ')}`);
  }

  sourceRoot.updateMatrixWorld(true);
  const sourceReport = resolveSkyrimSourceNodes(sourceRoot, retargets);
  if (!sourceReport.valid) {
    throw new Error(`Decoded Skyrim hierarchy is missing required bones: ${sourceReport.missing.join(', ')}`);
  }

  const targetProxy = createTargetProxy(THREE, rig);
  const sourceRest = {};
  const targetRest = {};
  retargets.forEach(({ id, target }) => {
    sourceRest[id] = worldSnapshot(THREE, sourceReport.nodes[id]);
    targetRest[target] = worldSnapshot(THREE, targetProxy.bones[target]);
  });

  const translationScale = motionScale(sourceRest, targetRest);
  const fps = Math.max(1, Number(options.fps) || 30);
  const times = sampleTimes(sourceClip.duration, fps);
  const samples = new Map(retargets.map(({ target, position }) => [target, {
    quaternion: [],
    position: position ? [] : null,
  }]));

  const mixer = new THREE.AnimationMixer(sourceRoot);
  const action = mixer.clipAction(sourceClip).reset();
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();

  const sourceWorldQuaternion = new THREE.Quaternion();
  const sourceWorldPosition = new THREE.Vector3();
  const rotationDelta = new THREE.Quaternion();
  const desiredWorldQuaternion = new THREE.Quaternion();
  const parentWorldQuaternion = new THREE.Quaternion();
  const desiredWorldPosition = new THREE.Vector3();

  times.forEach((time) => {
    mixer.setTime(time);
    sourceRoot.updateMatrixWorld(true);
    restoreTargetProxy(targetProxy, rig);

    retargets.forEach(({ id, target, position }) => {
      const sourceBone = sourceReport.nodes[id];
      const targetBone = targetProxy.bones[target];
      sourceBone.getWorldQuaternion(sourceWorldQuaternion);
      rotationDelta.copy(sourceWorldQuaternion).multiply(sourceRest[id].quaternion.clone().invert());
      desiredWorldQuaternion.copy(rotationDelta).multiply(targetRest[target].quaternion);
      targetBone.parent.getWorldQuaternion(parentWorldQuaternion);
      targetBone.quaternion.copy(parentWorldQuaternion.invert().multiply(desiredWorldQuaternion)).normalize();

      if (position) {
        sourceBone.getWorldPosition(sourceWorldPosition);
        desiredWorldPosition.copy(sourceWorldPosition)
          .sub(sourceRest[id].position)
          .multiplyScalar(translationScale)
          .add(targetRest[target].position);
        targetBone.position.copy(targetBone.parent.worldToLocal(desiredWorldPosition));
      }

      targetBone.updateMatrixWorld(true);
      samples.get(target).quaternion.push(...targetBone.quaternion.toArray());
      if (position) samples.get(target).position.push(...targetBone.position.toArray());
    });
  });
  action.stop();

  const clipId = String(options.clipId || sourceClip.name || 'SKYRIM_GUARD/Action');
  const tracks = [];
  retargets.forEach(({ target, position }) => {
    const targetName = sanitizeAnimationTargetName(target);
    tracks.push(new THREE.QuaternionKeyframeTrack(
      `${targetName}.quaternion`, times, samples.get(target).quaternion,
    ));
    if (position) {
      tracks.push(new THREE.VectorKeyframeTrack(
        `${targetName}.position`, times, samples.get(target).position,
      ));
    }
  });

  const clip = new THREE.AnimationClip(clipId, sourceClip.duration, tracks);
  clip.userData = {
    source: 'skyrim',
    sourceClip: sourceClip.name,
    retargetFps: fps,
    translationScale,
    targetRigId: rig.definition.id,
  };
  return clip;
}

export function createSkyrimRetargetLibrary(THREE, decodedEntries, rig, options = {}) {
  const entries = Array.from(decodedEntries || []);
  if (!entries.length) throw new Error('Skyrim retarget library requires at least one decoded animation');
  const clips = new Map();
  for (const entry of entries) {
    const clip = retargetSkyrimClip(THREE, entry.decoded || entry, rig, {
      ...options,
      clipId: entry.clipId || options.clipId,
    });
    if (clips.has(clip.name)) throw new Error(`Duplicate Skyrim retarget clip id: ${clip.name}`);
    clips.set(clip.name, clip);
  }
  return {
    clips,
    source: 'skyrim',
    retargetFps: Math.max(1, Number(options.fps) || 30),
    duplicates: [],
  };
}
