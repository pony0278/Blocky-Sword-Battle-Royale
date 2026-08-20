export const OFFHAND_BUCKLER_STAGE = 'G4.2.2';
export const OFFHAND_SOCKET_ID = 'HAND_L';

export const DEFAULT_OFFHAND_BUCKLER_MOUNT = Object.freeze({
  position: Object.freeze({ x: 0, y: 0, z: 0.035 }),
  rotation: Object.freeze({ x: 0, y: 0, z: 0 }),
  scale: Object.freeze({ x: 1, y: 1, z: 1 }),
});

export const DEFAULT_BUCKLER_STYLE = Object.freeze({
  faceColor: 0x354a63,
  rimColor: 0xaab8c8,
  bossColor: 0xd7e0ea,
  debugColor: 0x62e7c6,
});

function finitePositive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function createBucklerDefinition(input = {}) {
  const radius = finitePositive(input.radius, 0.24);
  const thickness = finitePositive(input.thickness, 0.055);
  const parryPadding = Math.max(0, Number(input.parryPadding) || 0.02);
  return Object.freeze({
    stage: OFFHAND_BUCKLER_STAGE,
    id: 'offhand_buckler_round_v1',
    equipmentType: 'buckler',
    socketId: OFFHAND_SOCKET_ID,
    radius,
    thickness,
    rimTube: finitePositive(input.rimTube, 0.018),
    bossRadius: finitePositive(input.bossRadius, 0.075),
    bossDepth: finitePositive(input.bossDepth, 0.035),
    parrySurface: Object.freeze({
      shape: 'oriented-disc',
      localCenter: Object.freeze([0, 0, thickness * 0.5]),
      localNormal: Object.freeze([0, 0, 1]),
      visualRadius: radius,
      radius: radius + parryPadding,
      thickness: finitePositive(input.parryThickness, 0.075),
      gameplayPadding: parryPadding,
      authority: 'authoring surface only; G4.3A owns swept sword contact',
    }),
  });
}

function requireThree(THREE) {
  const required = [
    'Group', 'Mesh', 'CylinderGeometry', 'TorusGeometry', 'SphereGeometry',
    'MeshStandardMaterial', 'MeshBasicMaterial', 'Vector3', 'Quaternion',
  ];
  const missing = required.filter((name) => !THREE?.[name]);
  if (missing.length) throw new Error(`G4.2.2 Buckler requires THREE: ${missing.join(', ')}`);
}

function style(input = {}) {
  return { ...DEFAULT_BUCKLER_STYLE, ...input };
}

export function createProceduralBuckler(THREE, options = {}) {
  requireThree(THREE);
  const definition = createBucklerDefinition(options.definition || options);
  const visualStyle = style(options.style);
  const object3d = new THREE.Group();
  object3d.name = 'OFFHAND_BUCKLER';
  object3d.userData.equipmentType = definition.equipmentType;
  object3d.userData.equipmentStage = OFFHAND_BUCKLER_STAGE;
  object3d.userData.definitionId = definition.id;

  const faceGeometry = new THREE.CylinderGeometry(
    definition.radius,
    definition.radius,
    definition.thickness,
    24,
    1,
    false,
  );
  faceGeometry.rotateX(Math.PI * 0.5);
  const face = new THREE.Mesh(
    faceGeometry,
    new THREE.MeshStandardMaterial({ color: visualStyle.faceColor, roughness: 0.68, metalness: 0.32 }),
  );
  face.name = 'BUCKLER_FACE';
  object3d.add(face);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(
      Math.max(0.01, definition.radius - definition.rimTube * 0.8),
      definition.rimTube,
      8,
      32,
    ),
    new THREE.MeshStandardMaterial({ color: visualStyle.rimColor, roughness: 0.38, metalness: 0.72 }),
  );
  rim.name = 'BUCKLER_RIM';
  rim.position.z = definition.thickness * 0.5 + definition.rimTube * 0.2;
  object3d.add(rim);

  const boss = new THREE.Mesh(
    new THREE.SphereGeometry(definition.bossRadius, 16, 10),
    new THREE.MeshStandardMaterial({ color: visualStyle.bossColor, roughness: 0.32, metalness: 0.78 }),
  );
  boss.name = 'BUCKLER_BOSS';
  boss.scale.set(1, 1, 0.48);
  boss.position.z = definition.thickness * 0.5 + definition.bossDepth * 0.55;
  object3d.add(boss);

  const parryAnchor = new THREE.Group();
  parryAnchor.name = 'BUCKLER_PARRY_SURFACE';
  parryAnchor.position.fromArray(definition.parrySurface.localCenter);
  parryAnchor.userData.parrySurface = definition.parrySurface;
  object3d.add(parryAnchor);

  const debugGeometry = new THREE.CylinderGeometry(
    definition.parrySurface.radius,
    definition.parrySurface.radius,
    0.006,
    32,
    1,
    false,
  );
  debugGeometry.rotateX(Math.PI * 0.5);
  const debugSurface = new THREE.Mesh(
    debugGeometry,
    new THREE.MeshBasicMaterial({
      color: visualStyle.debugColor,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  );
  debugSurface.name = 'BUCKLER_PARRY_SURFACE_DEBUG';
  debugSurface.visible = false;
  parryAnchor.add(debugSurface);

  const worldCenter = new THREE.Vector3();
  const worldNormal = new THREE.Vector3();
  const worldQuaternion = new THREE.Quaternion();

  function getWorldParrySurface() {
    parryAnchor.updateWorldMatrix?.(true, false);
    parryAnchor.getWorldPosition(worldCenter);
    parryAnchor.getWorldQuaternion(worldQuaternion);
    worldNormal.set(0, 0, 1).applyQuaternion(worldQuaternion).normalize();
    return Object.freeze({
      stage: OFFHAND_BUCKLER_STAGE,
      shape: definition.parrySurface.shape,
      center: Object.freeze({ x: worldCenter.x, y: worldCenter.y, z: worldCenter.z }),
      normal: Object.freeze({ x: worldNormal.x, y: worldNormal.y, z: worldNormal.z }),
      radius: definition.parrySurface.radius,
      visualRadius: definition.parrySurface.visualRadius,
      thickness: definition.parrySurface.thickness,
      authority: definition.parrySurface.authority,
    });
  }

  return Object.freeze({
    id: definition.id,
    stage: OFFHAND_BUCKLER_STAGE,
    definition,
    object3d,
    face,
    rim,
    boss,
    parryAnchor,
    debugSurface,
    setParrySurfaceVisible(value) { debugSurface.visible = Boolean(value); },
    getWorldParrySurface,
  });
}

export function mountOffhandBuckler(character, buckler, calibration = DEFAULT_OFFHAND_BUCKLER_MOUNT) {
  if (!character?.attach) throw new Error('G4.2.2 Buckler mount requires an equipment-capable character');
  if (!buckler?.object3d) throw new Error('G4.2.2 Buckler mount requires a procedural buckler');
  character.attach(OFFHAND_SOCKET_ID, buckler.object3d, calibration);
  buckler.object3d.userData.offhandRole = 'parry-buckler';
  return buckler;
}
