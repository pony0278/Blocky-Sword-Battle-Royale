import { WEAPON_SOCKET_ID } from './character-sockets.js';

export const DEFAULT_SWORD_MOUNT = Object.freeze({
  position: Object.freeze({ x: 0, y: 0, z: 0 }),
  rotation: Object.freeze({ x: 0, y: 0, z: 0 }),
  scale: Object.freeze({ x: 1, y: 1, z: 1 }),
});

export function createDebugSword(THREE) {
  const object3d = new THREE.Group();
  object3d.name = 'DEBUG_SWORD';
  object3d.userData.weaponType = 'debug-sword';

  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: 0xcce9ff,
    roughness: 0.22,
    metalness: 0.82,
    emissive: 0x102a44,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x161b2b, roughness: 0.8, metalness: 0.1 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: 0x55e6c1, roughness: 0.35, metalness: 0.55 });

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.34, 0.11), darkMaterial);
  grip.position.y = -0.12;
  object3d.add(grip);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.08, 0.12), accentMaterial);
  guard.position.y = -0.34;
  object3d.add(guard);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.10, 0.065), bladeMaterial);
  blade.position.y = -0.91;
  object3d.add(blade);
  const tip = new THREE.Group();
  tip.name = 'DEBUG_SWORD_TIP';
  tip.position.y = -1.48;
  object3d.add(tip);

  return { id: 'debug-sword', object3d, blade, tip, socketId: WEAPON_SOCKET_ID };
}

export function mountDebugSword(character, weapon, calibration = DEFAULT_SWORD_MOUNT) {
  character.attach(WEAPON_SOCKET_ID, weapon.object3d, calibration);
  return weapon;
}

