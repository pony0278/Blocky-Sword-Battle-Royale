function createPreviewDummy(THREE) {
  const group = new THREE.Group();
  group.name = 'PREVIEW_DUMMY';
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 1.32, 0.46),
    new THREE.MeshStandardMaterial({ color: 0x7b314d, roughness: 0.82, metalness: 0 }),
  );
  body.position.y = 0.82;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.52, 0.52),
    new THREE.MeshStandardMaterial({ color: 0xb74a68, roughness: 0.7 }),
  );
  head.position.y = 1.72;
  group.add(head);
  group.position.z = 2.15;
  return group;
}

export function createStudioPreviewRuntime(THREE, options) {
  const {
    canvas,
    character,
    sword,
    impactFlash,
    isDummyEnabled,
  } = options;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f19);
  scene.fog = new THREE.Fog(0x0a0f19, 7, 16);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  const cameraTarget = new THREE.Vector3(0, 1.05, 0);
  let cameraTheta = 0.45;
  let cameraPhi = 1.12;
  let cameraRadius = 5.1;
  let gameCameraOn = false;
  let savedCamera = null;

  scene.add(new THREE.HemisphereLight(0xb9d2ff, 0x11131d, 1.15));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
  keyLight.position.set(4, 7, 5);
  keyLight.castShadow = true;
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x55e6c1, 0.7);
  rimLight.position.set(-4, 3, -4);
  scene.add(rimLight);
  scene.add(new THREE.GridHelper(18, 18, 0x33425f, 0x1b263a));
  scene.add(character.object3d);

  const dummy = createPreviewDummy(THREE);
  scene.add(dummy);
  const weaponTrail = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x55e6c1, transparent: true, opacity: 0.92 }),
  );
  weaponTrail.frustumCulled = false;
  scene.add(weaponTrail);
  const trailPoint = new THREE.Vector3();
  let trailPoints = [];

  const feel = { hitstop: 0.08, shake: 0.45, knockback: 0.55 };
  let hitstopRemaining = 0;
  let shakeRemaining = 0;
  let dummyHitRemaining = 0;

  function placeCamera() {
    camera.position.set(
      cameraTarget.x + cameraRadius * Math.sin(cameraPhi) * Math.sin(cameraTheta),
      cameraTarget.y + cameraRadius * Math.cos(cameraPhi),
      cameraTarget.z + cameraRadius * Math.sin(cameraPhi) * Math.cos(cameraTheta),
    );
    camera.lookAt(cameraTarget);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
  }

  function clearWeaponTrail() {
    trailPoints = [];
    weaponTrail.geometry.dispose();
    weaponTrail.geometry = new THREE.BufferGeometry();
  }

  function recordWeaponTrail(enabled) {
    if (!enabled) return;
    sword.trailTip.getWorldPosition(trailPoint);
    if (!trailPoints.length || trailPoints[trailPoints.length - 1].distanceToSquared(trailPoint) > 0.0002) {
      trailPoints.push(trailPoint.clone());
      if (trailPoints.length > 70) trailPoints.shift();
      weaponTrail.geometry.dispose();
      weaponTrail.geometry = new THREE.BufferGeometry().setFromPoints(trailPoints);
    }
  }

  function triggerImpact() {
    hitstopRemaining = feel.hitstop;
    shakeRemaining = 0.18;
    dummyHitRemaining = 0.34;
    if (isDummyEnabled()) {
      impactFlash.style.transition = 'none';
      impactFlash.style.opacity = String(0.18 + feel.shake * 0.28);
      requestAnimationFrame(() => {
        impactFlash.style.transition = 'opacity .16s ease-out';
        impactFlash.style.opacity = '0';
      });
    }
  }

  function consumeHitstop(deltaSeconds) {
    if (hitstopRemaining <= 0) return false;
    hitstopRemaining = Math.max(0, hitstopRemaining - deltaSeconds);
    return true;
  }

  function update(deltaSeconds) {
    dummy.visible = isDummyEnabled();
    if (dummyHitRemaining > 0) {
      dummyHitRemaining = Math.max(0, dummyHitRemaining - deltaSeconds);
      const amount = dummyHitRemaining / 0.34;
      dummy.position.z = 2.15 + feel.knockback * 0.72 * amount;
      dummy.rotation.x = -feel.knockback * 0.18 * amount;
    } else {
      dummy.position.z = 2.15;
      dummy.rotation.x = 0;
    }
  }

  function render() {
    let shakeX = 0;
    let shakeY = 0;
    if (shakeRemaining > 0) {
      const amount = feel.shake * 0.08 * (shakeRemaining / 0.18);
      shakeX = (Math.random() * 2 - 1) * amount;
      shakeY = (Math.random() * 2 - 1) * amount;
      camera.position.x += shakeX;
      camera.position.y += shakeY;
    }
    renderer.render(scene, camera);
    camera.position.x -= shakeX;
    camera.position.y -= shakeY;
  }

  function advanceShake(deltaSeconds) {
    shakeRemaining = Math.max(0, shakeRemaining - deltaSeconds);
  }

  function toggleGameCamera() {
    gameCameraOn = !gameCameraOn;
    if (gameCameraOn) {
      savedCamera = { cameraTheta, cameraPhi, cameraRadius, fov: camera.fov };
      cameraTheta = Math.PI;
      cameraPhi = 0.82;
      cameraRadius = 5.35;
      camera.fov = 34;
    } else if (savedCamera) {
      ({ cameraTheta, cameraPhi, cameraRadius } = savedCamera);
      camera.fov = savedCamera.fov;
    }
    camera.updateProjectionMatrix();
    placeCamera();
    return gameCameraOn;
  }

  function setFeel(key, value) {
    if (!(key in feel)) throw new Error(`Unknown preview feel control: ${key}`);
    feel[key] = Number(value);
    return feel[key];
  }

  let orbiting = false;
  let pointerX = 0;
  let pointerY = 0;
  canvas.addEventListener('pointerdown', (event) => {
    orbiting = true;
    pointerX = event.clientX;
    pointerY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointerup', () => { orbiting = false; });
  canvas.addEventListener('pointercancel', () => { orbiting = false; });
  canvas.addEventListener('pointermove', (event) => {
    if (!orbiting || gameCameraOn) return;
    cameraTheta -= (event.clientX - pointerX) * 0.008;
    cameraPhi = Math.max(0.3, Math.min(1.48, cameraPhi - (event.clientY - pointerY) * 0.008));
    pointerX = event.clientX;
    pointerY = event.clientY;
    placeCamera();
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    cameraRadius = Math.max(3.2, Math.min(10, cameraRadius + event.deltaY * 0.008));
    placeCamera();
  }, { passive: false });

  placeCamera();
  return {
    scene,
    camera,
    renderer,
    feel,
    resize,
    render,
    update,
    advanceShake,
    toggleGameCamera,
    clearWeaponTrail,
    recordWeaponTrail,
    triggerImpact,
    consumeHitstop,
    setFeel,
  };
}
