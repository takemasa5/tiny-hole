import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { createFloor, topOfBox, updateFloor } from "./floor";
import { writeGroundGeometry } from "./ground-geometry";
import { isTap, moveGesture, type PointerGesture } from "./gesture";
import { standTarget } from "./target";
import { isMovementKey, keyboardDirection } from "./keyboard";
import { createWalker, driveWalker, type Walker } from "./walker";
import { GameSounds } from "./sound";
import { GrowthEffect } from "./growth-effect";
import {
  COLLECTION_Y,
  createStage,
  LEVELS,
  MAP_HALF_SIZE,
  STAGES,
  isHuman,
  type StageId,
  type StageDefinition,
  OBJECT_TYPES,
  PHYSICS_STEP,
  Progress,
  objectFootprint,
  seededRandom,
  type PlacedObject,
} from "./stage";
import {
  animateWalker,
  disposeScene,
  groundTexture,
  objectVisual,
} from "./visuals";

import { mountainBackground } from "./themed-visuals";
import { objectCollider } from "./object-collider";
import {
  createShooting,
  stepShooting,
  animateShooting,
  type Shooting,
} from "./shooting";

const physicsReady = RAPIER.init();

export interface GameStatus {
  level: number;
  score: number;
  collected: number;
  cleared: boolean;
  lastObject: string;
  moved: boolean;
  resets: number;
  growthEvents: number;
  audioError: string;
}

export interface GameControls {
  dispose: () => void;
  setSoundEnabled: (enabled: boolean) => void;
}

interface PhysicalObject {
  definition: PlacedObject;
  body: RAPIER.RigidBody;
  mesh: THREE.Group;
  collider: RAPIER.Collider;
  walker?: Walker;
  shooting?: Shooting;
}

export async function startGame(
  canvas: HTMLCanvasElement,
  onStatus: (status: GameStatus) => void,
  onError: (message: string) => void,
  soundEnabled = true,
  stageId: StageId = "plaza",
): Promise<GameControls> {
  await physicsReady;
  const stage: StageDefinition = STAGES[stageId];
  const seed = Math.floor(Math.random() * 4294967296);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(stage.backgroundColor);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#ffffff", "#858c7c", 2.4));
  const sunlight = new THREE.DirectionalLight("#fff0d8", 3);
  sunlight.position.set(-15, 30, 20);
  scene.add(sunlight);
  const camera = new THREE.PerspectiveCamera(44, 1, 0.08, 800);
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = PHYSICS_STEP;
  const floor = createFloor(world);
  floor.setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS);
  const belowFloor = new Set<number>();
  const hooks: RAPIER.PhysicsHooks = {
    filterContactPair: (first, second) =>
      belowFloor.has(first) || belowFloor.has(second)
        ? null
        : RAPIER.SolverFlags.COMPUTE_IMPULSE,
    filterIntersectionPair: () => true,
  };
  const groundGeometry = new THREE.BufferGeometry();
  const ground = new THREE.Mesh(
    groundGeometry,
    new THREE.MeshStandardMaterial({
      map: groundTexture(stageId, seed),
      roughness: 1,
      side: THREE.DoubleSide,
    }),
  );
  scene.add(ground);
  if (stageId === "mountain") scene.add(mountainBackground());
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.04, 8, 64),
    new THREE.MeshStandardMaterial({ color: stage.accent, roughness: 0.5 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.025;
  scene.add(rim);
  const abyss = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 30, 64, 1, true),
    new THREE.MeshBasicMaterial({ color: "#1c2433", side: THREE.BackSide }),
  );
  scene.add(abyss);
  const bottom = new THREE.Mesh(
    new THREE.CircleGeometry(1, 64),
    new THREE.MeshBasicMaterial({ color: "#17202e" }),
  );
  bottom.rotation.x = -Math.PI / 2;
  scene.add(bottom);
  const goalMarker = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.8),
    new THREE.MeshStandardMaterial({
      color: stage.accent,
      emissive: stage.accent,
      emissiveIntensity: 0.3,
    }),
  );
  scene.add(goalMarker);
  const growthEffect = new GrowthEffect();
  scene.add(growthEffect.group);

  const shootingRandom = seededRandom(seed ^ 0x17c839);
  let shotsFired = 0;
  const movementRandom = seededRandom(seed ^ 0x57a1c3);
  const objects: PhysicalObject[] = createStage(seed, stageId).map(
    (definition) => {
      const quaternion = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        definition.yaw,
      );
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(definition.x, definition.y, definition.z)
          .setRotation(quaternion)
          .setCanSleep(true)
          .setCcdEnabled(true),
      );
      const walker =
        definition.kind === stage.moving.kind
          ? createWalker(definition.yaw, movementRandom)
          : undefined;
      if (walker) body.setEnabledRotations(false, true, false, true);
      const collider = world.createCollider(
        objectCollider(definition.kind)
          .setFriction(walker ? 0.15 : 0.65)
          .setRestitution(0),
        body,
      );
      const mesh = objectVisual(definition.kind, stageId);
      mesh.userData.objectId = definition.id;
      scene.add(mesh);
      return {
        definition,
        body,
        collider,
        mesh,
        walker,
        shooting:
          walker && stage.moving.armed
            ? createShooting(shootingRandom)
            : undefined,
      };
    },
  );
  const progress = new Progress();
  let resets = 0;
  let growthEvents = 0;
  let collectedMoving = 0;
  let audioError = "";
  const sounds = new GameSounds(
    soundEnabled,
    (message) => {
      audioError = message;
      notify();
    },
    stageId === "america",
  );
  const hole = new THREE.Vector2();
  const destination = new THREE.Vector2();
  let radius = LEVELS[0].radius as number;
  let moved = false;
  let lastObject = "";
  let frame = 0;
  let disposed = false;
  let lastTime = performance.now();
  let accumulator = 0;
  let pointer: PointerGesture | undefined;
  const heldKeys = new Set<string>();
  const raycaster = new THREE.Raycaster();
  let physicsMilliseconds = 0;
  let floorMilliseconds = 0;
  const abort = new AbortController();
  const eventOptions = { signal: abort.signal };

  function notify() {
    onStatus({
      level: progress.level + 1,
      score: progress.score,
      collected: progress.collected.size,
      cleared: progress.cleared,
      lastObject,
      moved,
      resets,
      growthEvents,
      audioError,
    });
  }

  function cameraUpdate() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const scale = (radius * height) / Math.min(width, height);
    camera.position.set(hole.x, 7.6 * scale, hole.y + 6.8 * scale);
    camera.lookAt(hole.x, 0, hole.y);
    camera.updateMatrixWorld();
    rim.position.set(hole.x, 0.025, hole.y);
    rim.scale.setScalar(radius);
    abyss.position.set(hole.x, -15, hole.y);
    abyss.scale.set(radius, 1, radius);
    bottom.position.set(hole.x, -29.9, hole.y);
    bottom.scale.setScalar(radius);
  }

  function updateGround() {
    const start = performance.now();
    const { vertices, indices } = updateFloor(floor, hole.x, hole.y, radius);
    writeGroundGeometry(groundGeometry, vertices, indices);
    floorMilliseconds = performance.now() - start;
  }

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    cameraUpdate();
  }

  function releasePointer() {
    if (pointer && canvas.hasPointerCapture(pointer.id))
      canvas.releasePointerCapture(pointer.id);
    pointer = undefined;
    destination.copy(hole);
  }

  function stopInput() {
    heldKeys.clear();
    releasePointer();
  }

  window.addEventListener(
    "keydown",
    (event) => {
      const target = event.target;
      const editing =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          !!target.closest("input, textarea, select"));
      if (
        !isMovementKey(event.code) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        editing ||
        progress.cleared ||
        document.hidden
      )
        return;
      event.preventDefault();
      sounds.unlock();
      heldKeys.add(event.code);
    },
    eventOptions,
  );
  window.addEventListener(
    "keyup",
    (event) => {
      if (!isMovementKey(event.code)) return;
      if (heldKeys.delete(event.code)) destination.copy(hole);
    },
    eventOptions,
  );

  function tapTarget(clientX: number, clientY: number) {
    if (progress.cleared) return;
    const bounds = canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((clientX - bounds.left) / bounds.width) * 2 - 1,
        1 - ((clientY - bounds.top) / bounds.height) * 2,
      ),
      camera,
    );
    const hit = raycaster.intersectObjects(
      objects.map((object) => object.mesh),
      true,
    )[0];
    let mesh: THREE.Object3D | null = hit?.object ?? null;
    while (mesh && !mesh.userData.objectId) mesh = mesh.parent;
    const target = objects.find(
      (object) => object.definition.id === mesh?.userData.objectId,
    );
    if (!target || target.definition.id !== "goal") return;
    const position = target.body.translation();
    let supportY = 0;
    // Reposition above neighbours rather than teleporting into their colliders.
    for (const other of objects) {
      if (other === target) continue;
      const otherPosition = other.body.translation();
      const otherSize = OBJECT_TYPES[other.definition.kind].size;
      if (
        Math.hypot(otherPosition.x - position.x, otherPosition.z - position.z) <
        objectFootprint(target.definition.kind) + Math.hypot(...otherSize) / 2
      ) {
        supportY = Math.max(
          supportY,
          topOfBox(otherPosition.y, other.body.rotation(), otherSize),
        );
      }
    }
    if (
      standTarget(target.body, target.definition, progress.cleared, supportY)
    ) {
      belowFloor.delete(target.collider.handle);
      target.mesh.position.copy(target.body.translation());
      target.mesh.quaternion.copy(target.body.rotation());
      target.mesh.updateMatrixWorld(true);
      resets++;
      notify();
    }
  }

  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (pointer || progress.cleared || event.button !== 0) return;
      event.preventDefault();
      sounds.unlock();
      pointer = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        dragging: false,
        startedAt: performance.now(),
      };
      canvas.setPointerCapture(event.pointerId);
    },
    eventOptions,
  );
  canvas.addEventListener(
    "pointermove",
    (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const movement = moveGesture(pointer, event.clientX, event.clientY);
      if (!pointer.dragging) return;
      const distance = camera.position.distanceTo(
        new THREE.Vector3(hole.x, 0, hole.y),
      );
      const unitsPerPixel =
        (2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) /
        canvas.clientHeight;
      destination.x += movement.dx * unitsPerPixel;
      destination.y +=
        (movement.dy * unitsPerPixel) / (7.6 / Math.hypot(7.6, 6.8));
      destination.clampScalar(-MAP_HALF_SIZE + radius, MAP_HALF_SIZE - radius);
      if (!moved) {
        moved = true;
        notify();
      }
    },
    eventOptions,
  );
  canvas.addEventListener(
    "pointerup",
    (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      sounds.unlock();
      const tapped = isTap(
        pointer,
        event.clientX,
        event.clientY,
        performance.now(),
      );
      releasePointer();
      if (tapped) tapTarget(event.clientX, event.clientY);
    },
    eventOptions,
  );
  canvas.addEventListener("pointercancel", releasePointer, eventOptions);
  canvas.addEventListener("lostpointercapture", releasePointer, eventOptions);
  window.addEventListener("blur", stopInput, eventOptions);
  document.addEventListener(
    "visibilitychange",
    () => {
      stopInput();
      accumulator = 0;
      lastTime = performance.now();
      sounds.setPaused(document.hidden);
    },
    eventOptions,
  );
  canvas.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault();
      cancelAnimationFrame(frame);
      onError("描画が中断されました。もう一度読み込んでください。");
    },
    eventOptions,
  );
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  updateGround();
  notify();

  function physicsStep() {
    const oldX = hole.x;
    const oldZ = hole.y;
    const maximum = radius * 7 * PHYSICS_STEP;
    const direction = keyboardDirection(heldKeys);
    if (direction.x || direction.z) {
      destination.set(
        hole.x + direction.x * maximum,
        hole.y + direction.z * maximum,
      );
      destination.clampScalar(-MAP_HALF_SIZE + radius, MAP_HALF_SIZE - radius);
      if (!moved) {
        moved = true;
        notify();
      }
    }
    const difference = destination.clone().sub(hole);
    if (difference.length() > maximum) difference.setLength(maximum);
    hole.add(difference);
    const changed = hole.x !== oldX || hole.y !== oldZ;
    if (changed) {
      updateGround();
      for (const object of objects) {
        const position = object.body.translation();
        const size = OBJECT_TYPES[object.definition.kind].size;
        const reach = radius + Math.hypot(size[0], size[2]) / 2 + 0.5;
        if (
          Math.hypot(position.x - hole.x, position.z - hole.y) < reach ||
          Math.hypot(position.x - oldX, position.z - oldZ) < reach
        )
          object.body.wakeUp();
      }
    }
    const start = performance.now();
    for (const object of objects) {
      if (object.walker) {
        const wasFalling = object.walker.mode === "falling";
        driveWalker(
          object.body,
          object.walker,
          object.definition.kind,
          { x: hole.x, z: hole.y, radius },
          PHYSICS_STEP,
          movementRandom,
        );
        if (!wasFalling && object.walker.mode === "falling") {
          if (object.definition.kind === "american")
            sounds.play("americanCry", progress.level + 1);
          else if (isHuman(object.definition.kind))
            sounds.play("personCry", progress.level + 1);
          else if (object.definition.kind === "tanuki")
            sounds.play("tanukiCry", progress.level + 1);
        }
        if (
          object.shooting &&
          stepShooting(
            object.shooting,
            PHYSICS_STEP,
            object.walker.mode !== "falling",
            shootingRandom,
          )
        ) {
          shotsFired++;
          sounds.play("shot", progress.level + 1);
        }
      }
    }
    world.step(undefined, hooks);
    physicsMilliseconds = performance.now() - start;
    let progressed = false;
    for (let index = objects.length - 1; index >= 0; index--) {
      const object = objects[index];
      const position = object.body.translation();
      const top = topOfBox(
        position.y,
        object.body.rotation(),
        OBJECT_TYPES[object.definition.kind].size,
      );
      // Once entirely below the surface, a moving aperture must not resurrect support.
      if (top < -0.15) belowFloor.add(object.collider.handle);
      if (top >= COLLECTION_Y) continue;
      if (progress.collect(object.definition)) {
        lastObject = OBJECT_TYPES[object.definition.kind].label;
        if (object.walker) collectedMoving++;
        progressed = true;
      }
      belowFloor.delete(object.collider.handle);
      world.removeRigidBody(object.body);
      disposeScene(object.mesh);
      scene.remove(object.mesh);
      objects.splice(index, 1);
    }
    if (progressed) {
      sounds.play("pickup", progress.level + 1);
      const nextRadius = LEVELS[progress.level].radius;
      if (nextRadius !== radius) {
        radius = nextRadius;
        hole.clampScalar(-MAP_HALF_SIZE + radius, MAP_HALF_SIZE - radius);
        destination.copy(hole);
        updateGround();
        objects.forEach((object) => object.body.wakeUp());
        growthEvents++;
        growthEffect.trigger();
        sounds.play("growth", progress.level + 1);
      }
      if (progress.cleared) {
        stopInput();
        goalMarker.visible = false;
        sounds.play("clear", progress.level + 1);
      }
      notify();
    }
  }

  function animate(time: number) {
    if (disposed) return;
    try {
      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;
      if (!document.hidden && !progress.cleared) {
        accumulator += delta;
        let steps = 0;
        while (accumulator >= PHYSICS_STEP && steps < 5) {
          physicsStep();
          accumulator -= PHYSICS_STEP;
          steps++;
        }
        if (steps === 5) accumulator = 0;
      }
      objects.forEach(({ body, mesh, walker, shooting }) => {
        mesh.position.copy(body.translation());
        mesh.quaternion.copy(body.rotation());
        if (walker)
          animateWalker(
            mesh,
            walker.phase,
            walker.mode === "fleeing",
            walker.mode === "falling",
          );
        if (shooting)
          animateShooting(
            mesh,
            shooting,
            !document.hidden && !progress.cleared && walker?.mode !== "falling",
          );
      });
      cameraUpdate();
      growthEffect.update(document.hidden ? 0 : delta, hole.x, hole.y, radius);
      const target = objects.find((object) => object.definition.id === "goal");
      if (target) {
        const position = target.body.translation();
        goalMarker.position.set(
          position.x,
          topOfBox(
            position.y,
            target.body.rotation(),
            OBJECT_TYPES[target.definition.kind].size,
          ) + 2,
          position.z,
        );
      }
      goalMarker.rotation.y = time * 0.001;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "ゲームの更新に失敗しました。",
      );
    }
  }
  frame = requestAnimationFrame(animate);

  const snapshot = () => ({
    seed,
    stageId,
    shotsFired,
    rigidBodies: world.bodies.len(),
    resets,
    mapHalfSize: MAP_HALF_SIZE,
    growthEvents,
    growthEffect: growthEffect.snapshot(),
    audio: sounds.snapshot(),
    collectedMoving,
    hole: { x: hole.x, z: hole.y, radius },
    level: progress.level + 1,
    score: progress.score,
    cleared: progress.cleared,
    physicsMilliseconds,
    floorMilliseconds,
    activeBodies: objects.filter((object) => !object.body.isSleeping()).length,
    objects: objects.map(({ definition, body, mesh, walker }) => ({
      ...definition,
      size: OBJECT_TYPES[definition.kind].size,
      value: OBJECT_TYPES[definition.kind].value,
      position: body.translation(),
      rotation: body.rotation(),
      velocity: body.linvel(),
      motion: walker?.mode,
      screen: (() => {
        const point = mesh.children[0]
          .getWorldPosition(new THREE.Vector3())
          .project(camera);
        return {
          x: ((point.x + 1) / 2) * canvas.clientWidth,
          y: ((1 - point.y) / 2) * canvas.clientHeight,
        };
      })(),
      top: topOfBox(
        body.translation().y,
        body.rotation(),
        OBJECT_TYPES[definition.kind].size,
      ),
    })),
    aperture: [
      new THREE.Vector3(hole.x - radius, 0, hole.y),
      new THREE.Vector3(hole.x + radius, 0, hole.y),
    ].map((point) => {
      point.project(camera);
      return {
        x: ((point.x + 1) / 2) * canvas.clientWidth,
        y: ((1 - point.y) / 2) * canvas.clientHeight,
      };
    }),
  });
  if (import.meta.env.DEV) Object.assign(window, { __hole: { snapshot } });

  return {
    setSoundEnabled: (enabled) => sounds.setEnabled(enabled),
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frame);
      stopInput();
      abort.abort();
      observer.disconnect();
      sounds.dispose();
      disposeScene(scene);
      renderer.dispose();
      world.free();
      if (import.meta.env.DEV) Reflect.deleteProperty(window, "__hole");
    },
  };
}
