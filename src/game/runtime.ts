import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { createFloor, updateFloor } from "./floor";
import {
  BASE_GROUND_RENDER_ORDER,
  writeGroundGeometry,
} from "./ground-geometry";
import { isTap, moveGesture, type PointerGesture } from "./gesture";
import { isMovementKey, keyboardDirection } from "./keyboard";
import { GameSounds } from "./sound";
import { GrowthEffect } from "./growth-effect";
import { PHYSICS_STEP, STAGES, isHuman, type StageId } from "./stage";
import { animateWalker, disposeScene } from "./visuals";
import {
  createGrowthBody,
  apertureOverlapsBase,
  growthCollisionFootprint,
  growthCollisionBounds,
} from "./growth-physics";
import { HoleOcclusion } from "./occlusion";
import {
  createGrowthStage,
  GROWTH_LEVELS,
  areasForStage,
  GrowthProgress,
  areaForLevel,
  clampToArea,
  footprintOf,
  canRetire,
  growthObjectExit,
  type GrowthObject,
} from "./growth-stage";
import { growthVisual, GrowthScenery } from "./growth-visuals";
import { ToyWorldScene } from "./toy-world-scene";
import {
  createThemeMotion,
  themeVelocity,
  themeYaw,
  vehicleBlocksRoute,
  type ThemeMotion,
} from "./theme-behavior";

const physicsReady = RAPIER.init();
export interface GameStatus {
  cleared: boolean;
  audioError: string;
  boundaryHint: string;
}
export interface GameControls {
  dispose: () => void;
  setSoundEnabled: (enabled: boolean) => void;
}
export type RenderDiagnosticMode =
  "normal" | "no-occlusion" | "precise-depth" | "no-antialias" | "plain-floor";
export interface RenderDiagnostics {
  mode: RenderDiagnosticMode;
  seed: number;
}
interface Entity {
  definition: GrowthObject;
  mesh: THREE.Group;
  detailed: boolean;
  body?: RAPIER.RigidBody;
  colliders?: RAPIER.Collider[];
  motion: ThemeMotion;
  falling: boolean;
  enteredHole: boolean;
  previousPosition: THREE.Vector3;
  previousRotation: THREE.Quaternion;
}

export async function startGame(
  canvas: HTMLCanvasElement,
  onStatus: (status: GameStatus) => void,
  onError: (message: string) => void,
  soundEnabled = true,
  stageId: StageId = "plaza",
  diagnostics?: RenderDiagnostics,
): Promise<GameControls> {
  await physicsReady;
  const stage = STAGES[stageId];
  const areas = areasForStage(stageId);
  const diagnosticMode = import.meta.env.DEV
    ? (diagnostics?.mode ?? "normal")
    : "normal";
  const seed =
    import.meta.env.DEV && diagnostics
      ? diagnostics.seed
      : Math.floor(Math.random() * 4294967296);
  if (!Number.isInteger(seed) || seed < 0 || seed >= 4294967296)
    throw new Error("配置シードが不正です。");
  const definitions = createGrowthStage(seed, stageId);
  const progress = new GrowthProgress();
  const entities = new Map<string, Entity>();
  const terminal = new Map<string, "collected" | "retired" | "lost">();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: diagnosticMode !== "no-antialias",
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
  const camera = new THREE.PerspectiveCamera(44, 1, 0.001, 16000);
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = PHYSICS_STEP;
  const floor = createFloor(world);
  floor.setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS);
  const belowFloor = new Set<number>();
  const hooks: RAPIER.PhysicsHooks = {
    filterContactPair: (a, b) =>
      belowFloor.has(a) || belowFloor.has(b)
        ? null
        : RAPIER.SolverFlags.COMPUTE_IMPULSE,
    filterIntersectionPair: () => true,
  };
  const groundGeometry = new THREE.BufferGeometry();
  const ground = new THREE.Mesh(
    groundGeometry,
    new THREE.MeshStandardMaterial({
      color: stage.groundColor,
      roughness: 1,
      side: THREE.DoubleSide,
    }),
  );
  scene.add(ground);
  ground.renderOrder = BASE_GROUND_RENDER_ORDER;
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.04, 8, 64),
    new THREE.MeshStandardMaterial({ color: stage.accent, roughness: 0.5 }),
  );
  rim.rotation.x = -Math.PI / 2;
  scene.add(rim);
  const abyss = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 1, 64, 1, true),
    new THREE.MeshBasicMaterial({ color: "#1c2433", side: THREE.BackSide }),
  );
  scene.add(abyss);
  const bottom = new THREE.Mesh(
    new THREE.CircleGeometry(1, 64),
    new THREE.MeshBasicMaterial({ color: "#17202e" }),
  );
  bottom.rotation.x = -Math.PI / 2;
  scene.add(bottom);
  const marker = new THREE.Mesh(
    new THREE.OctahedronGeometry(1),
    new THREE.MeshBasicMaterial({ color: stage.accent }),
  );
  scene.add(marker);
  const growthEffect = new GrowthEffect();
  scene.add(growthEffect.group);
  const scenery = new GrowthScenery(definitions, stageId);
  scene.add(scenery.group);
  const toyWorld =
    stageId === "toys" ? new ToyWorldScene(world, belowFloor) : undefined;
  if (toyWorld) scene.add(toyWorld.group);
  if (diagnosticMode === "plain-floor") {
    for (const root of [scenery.group, toyWorld?.group])
      root?.traverse((part) => {
        if (
          part instanceof THREE.Mesh &&
          part.geometry.type === "PlaneGeometry"
        )
          part.visible = false;
      });
  }
  const context = renderer.getContext();
  const antialiasSamples = context.getParameter(context.SAMPLES) as number;
  const occlusion = new HoleOcclusion(antialiasSamples);
  const hole = new THREE.Vector2(),
    destination = new THREE.Vector2(),
    previousHole = new THREE.Vector2(),
    renderHole = new THREE.Vector2();
  let radius: number = GROWTH_LEVELS[0].radius;
  let openedArea = 0;
  let audioError = "";
  let boundaryHint = "";
  const sounds = new GameSounds(
    soundEnabled,
    (message) => {
      audioError = message;
      notify();
    },
    stageId === "america",
  );
  let pointer: PointerGesture | undefined;
  const heldKeys = new Set<string>();
  const abort = new AbortController();
  const eventOptions = { signal: abort.signal };
  const raycaster = new THREE.Raycaster();
  let disposed = false,
    frame = 0,
    accumulator = 0,
    lastTime = performance.now();
  let physicsMilliseconds = 0,
    floorMilliseconds = 0,
    lifecycleMilliseconds = 0,
    occlusionMilliseconds = 0;
  let growthEvents = 0,
    resets = 0,
    collectedMoving = 0,
    supplySerial = 0,
    supplyTimer = 0;
  let lifecycleTimer = 0;
  const frameTimes: number[] = [];

  function notify() {
    onStatus({ cleared: progress.cleared, audioError, boundaryHint });
  }
  function holeState() {
    return { x: hole.x, z: hole.y, radius };
  }
  function renderHoleState() {
    return { x: renderHole.x, z: renderHole.y, radius };
  }
  function updateGround() {
    const start = performance.now();
    const { vertices, indices } = updateFloor(
      floor,
      hole.x,
      hole.y,
      radius,
      areas[openedArea].extent * 4,
    );
    writeGroundGeometry(groundGeometry, vertices, indices, 1600);
    floorMilliseconds = performance.now() - start;
  }
  function cameraUpdate() {
    const width = canvas.clientWidth,
      height = canvas.clientHeight;
    const scale = (radius * height) / Math.min(width, height);
    camera.position.set(renderHole.x, 7.6 * scale, renderHole.y + 6.8 * scale);
    camera.lookAt(renderHole.x, 0, renderHole.y);
    camera.near = Math.max(
      0.0005,
      radius * (diagnosticMode === "precise-depth" ? 0.4 : 0.015),
    );
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    rim.position.set(renderHole.x, radius * 0.008, renderHole.y);
    rim.scale.setScalar(radius);
    const depth = Math.max(4, radius * 10);
    abyss.position.set(renderHole.x, -depth / 2, renderHole.y);
    abyss.scale.set(radius, depth, radius);
    bottom.position.set(renderHole.x, -depth + 0.001, renderHole.y);
    bottom.scale.setScalar(radius);
    scenery.update(renderHoleState(), openedArea);
    const guide = toyWorld?.guide(holeState()) ?? scenery.boundarySnapshot();
    const nextHint = guide.visible && !progress.cleared ? guide.label : "";
    if (nextHint !== boundaryHint) {
      boundaryHint = nextHint;
      notify();
    }
  }
  function resize() {
    const width = canvas.clientWidth,
      height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
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
  function clampDestination() {
    const point = clampToArea(
      { x: destination.x, z: destination.y },
      openedArea,
      radius,
      stageId,
    );
    destination.set(point.x, point.z);
  }
  function removeBody(entity: Entity) {
    if (!entity.body) return;
    entity.colliders?.forEach((collider) => belowFloor.delete(collider.handle));
    world.removeRigidBody(entity.body);
    entity.body = undefined;
    entity.colliders = undefined;
  }
  function removeEntity(id: string, reason: "collected" | "retired" | "lost") {
    const entity = entities.get(id);
    if (!entity) return;
    occlusion.remove(entity.mesh);
    removeBody(entity);
    disposeScene(entity.mesh);
    scene.remove(entity.mesh);
    entities.delete(id);
    terminal.set(id, reason);
  }
  function createEntity(definition: GrowthObject, detailed: boolean) {
    const previous = entities.get(definition.id);
    if (previous) {
      if (previous.detailed || !detailed) return previous;
      removeBody(previous);
      occlusion.remove(previous.mesh);
      disposeScene(previous.mesh);
      scene.remove(previous.mesh);
    }
    const mesh = growthVisual(definition, stageId, !detailed);
    mesh.rotation.y = definition.yaw;
    mesh.position.set(
      definition.x,
      -growthCollisionBounds(definition, mesh.quaternion, stageId).bottom +
        (definition.stackY ?? 0) +
        0.0005,
      definition.z,
    );
    scene.add(mesh);
    const entity: Entity = {
      definition,
      mesh,
      detailed,
      motion: createThemeMotion(definition),
      falling: false,
      enteredHole: false,
      previousPosition: mesh.position.clone(),
      previousRotation: mesh.quaternion.clone(),
    };
    entities.set(definition.id, entity);
    return entity;
  }
  function attachBody(entity: Entity) {
    if (entity.body) return;
    const physical = createGrowthBody(
      world,
      entity.definition,
      entity.mesh.position,
      entity.mesh.quaternion,
      stageId,
    );
    entity.body = physical.body;
    entity.colliders = physical.colliders;
    entity.previousPosition.copy(entity.body.translation());
    entity.previousRotation.copy(entity.body.rotation());
  }
  function prepareObjects(budget = 4) {
    let prepared = 0;
    for (const definition of definitions) {
      if (
        !(
          definition.level <= Math.min(12, progress.level + 1) ||
          (stageId === "toys" &&
            definition.area <= areaForLevel(progress.level, stageId))
        ) ||
        terminal.has(definition.id) ||
        entities.get(definition.id)?.detailed
      )
        continue;
      createEntity(definition, true);
      if (++prepared >= budget) break;
    }
    openReadyAreas();
  }
  function openReadyAreas() {
    const eligible = areaForLevel(progress.level, stageId);
    while (openedArea < eligible) {
      const entryLevel = areas[openedArea + 1].level;
      if (
        definitions.some(
          (d) =>
            d.level === entryLevel &&
            !terminal.has(d.id) &&
            !entities.get(d.id)?.detailed,
        )
      )
        break;
      openedArea++;
      updateGround();
    }
  }
  function manageEntities() {
    const start = performance.now();
    const faded = new Set(occlusion.snapshot().map(({ id }) => id));
    for (const [id, current] of entities) {
      let entity = current;
      const d = entity.definition;
      const position = entity.body?.translation() ?? entity.mesh.position;
      const distance = Math.hypot(position.x - hole.x, position.z - hole.y);
      const footprint = footprintOf(d);
      const near = distance < radius * 12 + footprint * 2;
      // Distant city buildings remain visible without simulating the entire skyline.
      const physicsNear = d.id.startsWith("city-block-")
        ? distance < radius * 4 + footprint * 2
        : near;
      let touchingAnotherObject = false;
      if (entity.colliders && (!physicsNear || d.level <= progress.level - 6)) {
        for (const collider of entity.colliders)
          world.contactPairsWith(collider, (other) => {
            if (other.handle !== floor.handle) touchingAnotherObject = true;
          });
      }
      if (
        canRetire(
          d,
          progress.level,
          distance,
          radius,
          entity.falling || faded.has(id) || touchingAnotherObject,
        )
      ) {
        removeEntity(id, "retired");
        continue;
      }
      // The earlier build submitted hundreds of subpixel meshes after growth.
      entity.mesh.visible =
        entity.falling ||
        (Math.hypot(...d.size) / radius >= 0.03 &&
          (near || d.level >= progress.level - 2));
      if (
        !physicsNear &&
        !entity.falling &&
        !touchingAnotherObject &&
        entity.body &&
        (entity.body.isFixed() ||
          entity.body.isSleeping() ||
          (Math.abs(entity.body.linvel().y) < 0.05 &&
            Math.abs(
              position.y +
                growthCollisionBounds(d, entity.body.rotation(), stageId)
                  .bottom,
            ) < Math.max(0.01, d.size[1] * 0.03)))
      ) {
        entity.mesh.position.copy(position);
        entity.mesh.quaternion.copy(entity.body.rotation());
        removeBody(entity);
      }
      if (
        !physicsNear ||
        entity.falling ||
        (stageId === "toys" && d.area > openedArea)
      )
        continue;
      if (!entity.detailed) entity = createEntity(d, true);
      if (!entity.body) attachBody(entity);
    }
    lifecycleMilliseconds = performance.now() - start;
  }
  function tapTarget(clientX: number, clientY: number) {
    const bounds = canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((clientX - bounds.left) / bounds.width) * 2 - 1,
        1 - ((clientY - bounds.top) / bounds.height) * 2,
      ),
      camera,
    );
    const hit = raycaster.intersectObjects(
      [...entities.values()]
        .filter(({ mesh }) => mesh.visible)
        .map(({ mesh }) => mesh),
      true,
    )[0];
    let object: THREE.Object3D | null = hit?.object ?? null;
    while (object && !object.userData.objectId) object = object.parent;
    const entity = entities.get(object?.userData.objectId);
    if (!entity || entity.definition.id !== "goal" || progress.cleared) return;
    const at = entity.body?.translation() ?? entity.mesh.position;
    let supportY = 0;
    for (const other of entities.values())
      if (other !== entity && other.body) {
        const position = other.body.translation();
        if (
          Math.hypot(position.x - at.x, position.z - at.z) <
          footprintOf(entity.definition) + footprintOf(other.definition)
        )
          supportY = Math.max(
            supportY,
            position.y +
              growthCollisionBounds(
                other.definition,
                other.body.rotation(),
                stageId,
              ).top,
          );
      }
    entity.falling = false;
    entity.enteredHole = false;
    entity.motion.phase = "working";
    entity.colliders?.forEach((collider) => belowFloor.delete(collider.handle));
    entity.mesh.rotation.set(0, entity.definition.yaw, 0);
    entity.mesh.position.set(
      at.x,
      supportY -
        growthCollisionBounds(
          entity.definition,
          entity.mesh.quaternion,
          stageId,
        ).bottom +
        0.0005,
      at.z,
    );
    if (entity.body) {
      entity.body.setTranslation(entity.mesh.position, true);
      entity.body.setRotation(entity.mesh.quaternion, true);
      entity.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      entity.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    resets++;
  }
  window.addEventListener(
    "keydown",
    (event) => {
      const target = event.target;
      if (
        !isMovementKey(event.code) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        progress.cleared ||
        document.hidden ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || target.closest("input,textarea,select")))
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
      if (heldKeys.delete(event.code)) destination.copy(hole);
    },
    eventOptions,
  );
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
      const units =
        (2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) /
        canvas.clientHeight;
      destination.x += movement.dx * units;
      destination.y += (movement.dy * units) / (7.6 / Math.hypot(7.6, 6.8));
      clampDestination();
    },
    eventOptions,
  );
  canvas.addEventListener(
    "pointerup",
    (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
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

  function replenish() {
    supplyTimer += PHYSICS_STEP;
    if (supplyTimer < 2 || progress.level === 12) return;
    supplyTimer = 0;
    const needed = GROWTH_LEVELS[progress.level].threshold - progress.score;
    const available = [...entities.values()]
      .filter(
        (entity) =>
          entity.detailed &&
          !entity.falling &&
          entity.definition.level === progress.level &&
          !entity.definition.sourceLevel &&
          ["still", "moored"].includes(entity.definition.behavior),
      )
      .reduce((sum, entity) => sum + entity.definition.value, 0);
    if (available >= needed * 1.5) return;
    const source = definitions.find(
      (d) =>
        d.level === progress.level && d.behavior === "still" && !d.sourceLevel,
    )!;
    const depot = entities.get(`stock-${progress.level}`);
    if (!depot) return;
    // Reserve a free landing spot before launching from the visible local stock box.
    for (let attempt = 0; attempt < 32; attempt++) {
      const angle = (supplySerial + attempt) * 2.399963;
      const distance = radius * (3.8 + attempt * 0.2);
      const point = clampToArea(
        {
          x: depot.mesh.position.x + Math.cos(angle) * distance,
          z: depot.mesh.position.z + Math.sin(angle) * distance,
        },
        openedArea,
        radius * 0.9,
        stageId,
      );
      const footprint = footprintOf(source);
      if (
        [...entities.values()].some(
          (entity) =>
            Math.hypot(
              entity.mesh.position.x - point.x,
              entity.mesh.position.z - point.z,
            ) <
            footprint + footprintOf(entity.definition) + radius * 0.2,
        )
      )
        continue;
      const definition = {
        ...source,
        id: `supply-${++supplySerial}`,
        ...point,
        yaw: angle,
      };
      const entity = createEntity(definition, true);
      const startY =
        depot.mesh.position.y +
        growthCollisionBounds(depot.definition, depot.mesh.quaternion, stageId)
          .top -
        growthCollisionBounds(definition, entity.mesh.quaternion, stageId)
          .bottom +
        radius * 0.05;
      entity.mesh.position.set(
        depot.mesh.position.x,
        startY,
        depot.mesh.position.z,
      );
      attachBody(entity);
      const duration = 0.55;
      const gravity = 9.81 * Math.max(0.25, radius);
      entity.body!.setLinvel(
        {
          x: (point.x - entity.mesh.position.x) / duration,
          z: (point.z - entity.mesh.position.z) / duration,
          y:
            (-growthCollisionBounds(definition, entity.mesh.quaternion, stageId)
              .bottom -
              startY +
              0.5 * gravity * duration * duration) /
            duration,
        },
        true,
      );
      return;
    }
  }
  function physicsStep() {
    previousHole.copy(hole);
    for (const entity of entities.values()) {
      if (!entity.body) continue;
      entity.previousPosition.copy(entity.body.translation());
      entity.previousRotation.copy(entity.body.rotation());
    }
    const oldX = hole.x,
      oldZ = hole.y;
    toyWorld?.update(progress.level, openedArea, holeState(), PHYSICS_STEP);
    const maximum = radius * 7 * PHYSICS_STEP;
    const direction = keyboardDirection(heldKeys);
    if (direction.x || direction.z) {
      destination.set(
        hole.x + direction.x * maximum,
        hole.y + direction.z * maximum,
      );
      clampDestination();
    }
    const difference = destination.clone().sub(hole);
    if (difference.length() > maximum) difference.setLength(maximum);
    hole.add(difference);
    if (toyWorld) {
      const point = toyWorld.constrain(
        { x: oldX, z: oldZ },
        { x: hole.x, z: hole.y },
        radius,
      );
      hole.set(point.x, point.z);
    }
    if (hole.x !== oldX || hole.y !== oldZ) {
      updateGround();
      for (const entity of entities.values())
        if (entity.body?.isDynamic()) {
          const at = entity.body.translation();
          if (
            Math.min(
              Math.hypot(at.x - hole.x, at.z - hole.y),
              Math.hypot(at.x - oldX, at.z - oldZ),
            ) <
            radius + footprintOf(entity.definition) * 1.5
          )
            entity.body.wakeUp();
        }
    }
    lifecycleTimer += PHYSICS_STEP;
    if (lifecycleTimer >= 0.1) {
      manageEntities();
      lifecycleTimer = 0;
    }
    const start = performance.now();
    world.gravity.y = -9.81 * Math.max(0.25, radius);
    for (const entity of entities.values()) {
      const { body, definition: d, motion } = entity;
      if (!body) continue;
      const at = body.translation();
      if (
        !entity.falling &&
        ((!["still", "moored"].includes(d.behavior) &&
          apertureOverlapsBase(d, at, body.rotation(), holeState())) ||
          at.y + growthCollisionBounds(d, body.rotation(), stageId).bottom <
            -Math.max(0.003, radius * 0.03) ||
          Math.hypot(at.x - hole.x, at.z - hole.y) + Math.hypot(...d.size) / 2 <
            radius * 0.96)
      ) {
        entity.falling = true;
        motion.phase = "falling";
        body.setEnabledRotations(true, true, true, true);
        if (isHuman(d.kind))
          sounds.play(
            d.kind === "american" ? "americanCry" : "personCry",
            progress.level,
          );
        else if (d.kind === "tanuki") sounds.play("tanukiCry", progress.level);
      }
      if (entity.falling || ["still", "moored"].includes(d.behavior)) continue;
      const partner = d.partnerId ? entities.get(d.partnerId) : undefined;
      const partnerPosition =
        partner && !partner.falling
          ? (partner.body?.translation() ?? partner.mesh.position)
          : undefined;
      const blocked =
        (d.behavior === "route" || d.behavior === "train") &&
        [...entities.values()].some((other) => {
          if (
            other === entity ||
            other.falling ||
            !other.definition.route ||
            other.definition.level !== d.level ||
            !other.body
          )
            return false;
          return vehicleBlocksRoute(
            d,
            motion.heading,
            at,
            other.definition,
            other.body.translation(),
          );
        });
      const velocity = themeVelocity(
        d,
        motion,
        at,
        holeState(),
        PHYSICS_STEP,
        partnerPosition,
        blocked,
      );
      if (d.route && motion.phase === "fleeing") {
        const xs = d.route.map((p) => p.x),
          zs = d.route.map((p) => p.z);
        if (at.x < Math.min(...xs) || at.x > Math.max(...xs))
          velocity.x = (d.x - at.x) * 0.5;
        if (at.z < Math.min(...zs) || at.z > Math.max(...zs))
          velocity.z = (d.z - at.z) * 0.5;
      }
      body.setLinvel({ ...velocity, y: body.linvel().y }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      const yaw = themeYaw(d, motion.heading);
      body.setRotation(
        {
          x: 0,
          y: Math.sin(yaw / 2),
          z: 0,
          w: Math.cos(yaw / 2),
        },
        true,
      );
    }
    world.step(undefined, hooks);
    physicsMilliseconds = performance.now() - start;
    const previousLevel = progress.level;
    let picked = false;
    for (const [id, entity] of entities) {
      if (!entity.body) continue;
      const position = entity.body.translation();
      const bounds = growthCollisionBounds(
        entity.definition,
        entity.body.rotation(),
        stageId,
      );
      const top = position.y + bounds.top;
      if (top < -Math.max(0.005, radius * 0.02))
        entity.colliders?.forEach((collider) =>
          belowFloor.add(collider.handle),
        );
      const bottomY = position.y + bounds.bottom;
      if (
        bottomY < -Math.max(0.003, radius * 0.03) &&
        Math.hypot(position.x - hole.x, position.z - hole.y) <
          radius + footprintOf(entity.definition)
      )
        entity.enteredHole = true;
      const exit = entity.falling
        ? growthObjectExit(entity.enteredHole, top, radius)
        : undefined;
      if (exit) {
        const collected =
          exit === "collected" && progress.collect(entity.definition);
        if (collected) {
          picked = true;
          if (entity.definition.behavior !== "still") collectedMoving++;
        }
        removeEntity(id, exit);
      } else if (
        !entity.falling &&
        (Math.abs(position.x) > 1650 ||
          Math.abs(position.z) > 1650 ||
          top < -Math.max(2, radius * 2))
      )
        removeEntity(id, "lost");
    }
    for (const definition of toyWorld?.afterStep(radius) ?? [])
      if (progress.collect(definition)) picked = true;
    if (picked) sounds.play("pickup", progress.level);
    if (previousLevel !== progress.level) {
      radius = GROWTH_LEVELS[progress.level - 1].radius;
      openReadyAreas();
      const point = clampToArea(
        { x: hole.x, z: hole.y },
        openedArea,
        radius,
        stageId,
      );
      hole.set(point.x, point.z);
      destination.copy(hole);
      previousHole.copy(hole);
      updateGround();
      manageEntities();
      for (const entity of entities.values()) entity.body?.wakeUp();
      growthEffect.trigger();
      growthEvents++;
      sounds.play("growth", progress.level);
    }
    if (progress.cleared) {
      stopInput();
      marker.visible = false;
      sounds.play("clear", progress.level);
    } else replenish();
    if (picked) notify();
  }

  // Only lightweight silhouettes of later landmarks exist at startup.
  for (const definition of definitions)
    if (
      definition.id === "goal" ||
      definition.id === "hero" ||
      definition.id === "monster" ||
      definition.id === "landmark" ||
      definition.id.startsWith("room-") ||
      (definition.level >= 3 && definition.id.endsWith("-23"))
    )
      createEntity(definition, false);
  prepareObjects(48);
  manageEntities();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  updateGround();
  notify();

  function animate(time: number) {
    if (disposed) return;
    try {
      const frameElapsed = (time - lastTime) / 1000;
      const elapsed = Math.min(frameElapsed, 0.1);
      lastTime = time;
      if (!document.hidden && !progress.cleared) {
        frameTimes.push(frameElapsed * 1000);
        if (frameTimes.length > 300) frameTimes.shift();
        prepareObjects();
        accumulator += elapsed;
        let steps = 0;
        while (accumulator >= PHYSICS_STEP && steps < 5 && !progress.cleared) {
          physicsStep();
          accumulator -= PHYSICS_STEP;
          steps++;
        }
        if (steps === 5) accumulator = 0;
      }
      const alpha =
        document.hidden || progress.cleared ? 1 : accumulator / PHYSICS_STEP;
      renderHole.lerpVectors(previousHole, hole, alpha);
      // Only the plain visual ground moves; the physics floor stays at the current hole.
      ground.position.set(renderHole.x - hole.x, 0, renderHole.y - hole.y);
      for (const entity of entities.values()) {
        if (entity.body) {
          entity.mesh.position
            .copy(entity.body.translation())
            .lerp(entity.previousPosition, 1 - alpha);
          entity.mesh.quaternion
            .copy(entity.body.rotation())
            .slerp(entity.previousRotation, 1 - alpha);
        }
        const { motion, definition: d, mesh } = entity;
        if (
          entity.detailed &&
          entity.body &&
          !["still", "moored"].includes(d.behavior)
        )
          animateWalker(
            mesh,
            motion.time * 6,
            motion.phase === "fleeing",
            entity.falling || motion.phase === "waiting",
          );
        const arm = mesh.getObjectByName("attack-arm");
        if (arm)
          arm.rotation.x =
            !entity.falling && motion.phase === "fighting"
              ? -0.7 - Math.sin(motion.time * 3) * 0.65
              : 0;
      }
      toyWorld?.update(progress.level, openedArea, holeState(), 0);
      toyWorld?.render(renderHoleState(), alpha);
      cameraUpdate();
      growthEffect.update(
        document.hidden ? 0 : elapsed,
        renderHole.x,
        renderHole.y,
        radius,
      );
      const target = entities.get("goal");
      if (target) {
        marker.position.copy(target.mesh.position).y +=
          target.definition.size[1] / 2 + 15;
        marker.scale.setScalar(8);
        marker.rotation.y = time * 0.001;
      }
      scene.updateMatrixWorld(true);
      const start = performance.now();
      if (diagnosticMode !== "no-occlusion")
        occlusion.update(
          camera,
          renderHoleState(),
          [
            ...[...entities.values()]
              .filter(({ mesh }) => mesh.visible)
              .map(({ mesh, definition, body }) => ({
                object: mesh,
                footprint: growthCollisionFootprint(
                  definition,
                  body?.rotation() ?? mesh.quaternion,
                  stageId,
                ),
              })),
            ...(toyWorld?.occluders() ?? []),
          ],
          document.hidden ? 0 : elapsed,
        );
      occlusionMilliseconds = performance.now() - start;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "ゲームの更新に失敗しました。",
      );
    }
  }
  frame = requestAnimationFrame(animate);
  const project = (point: THREE.Vector3) => {
    point.project(camera);
    return {
      x: ((point.x + 1) / 2) * canvas.clientWidth,
      y: ((1 - point.y) / 2) * canvas.clientHeight,
    };
  };
  const snapshot = () => ({
    seed,
    boundaryGuide: toyWorld?.guide(holeState()) ?? scenery.boundarySnapshot(),
    toyWorld: toyWorld?.snapshot(holeState()),
    stageId,
    levels: GROWTH_LEVELS,
    hole: holeState(),
    renderHole: renderHoleState(),
    level: progress.level,
    score: progress.score,
    cleared: progress.cleared,
    mapHalfSize: 1600,
    playableHalfSize: areas[openedArea].extent,
    openedArea,
    areas,
    collectedIds: [...progress.collected],
    retiredIds: [...terminal]
      .filter(([, reason]) => reason === "retired")
      .map(([id]) => id),
    pending: definitions.filter(
      (d) => !entities.has(d.id) && !terminal.has(d.id),
    ).length,
    previews: [...entities.values()].filter((e) => !e.detailed).length,
    rigidBodies: world.bodies.len(),
    colliders: world.colliders.len(),
    activeBodies: [...entities.values()].filter(
      (e) => e.body && !e.body.isFixed() && !e.body.isSleeping(),
    ).length,
    physicsMilliseconds,
    floorMilliseconds,
    lifecycleMilliseconds,
    occlusionMilliseconds,
    frameMilliseconds: (() => {
      const sorted = [...frameTimes].sort((a, b) => a - b);
      return {
        median: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
        p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      };
    })(),
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    memory: { ...renderer.info.memory },
    occlusion: occlusion.snapshot(),
    occlusionRendering: { samples: antialiasSamples, mode: occlusion.mode },
    renderDiagnostics: {
      mode: diagnosticMode,
      cameraNear: camera.near,
      cameraFar: camera.far,
    },
    growthEvents,
    growthEffect: growthEffect.snapshot(),
    audio: sounds.snapshot(),
    resets,
    collectedMoving,
    supply: { serial: supplySerial },
    objects: [...entities.values()].map(
      ({ definition, body, mesh, motion, falling, detailed }) => ({
        ...definition,
        position: body?.translation() ?? {
          x: mesh.position.x,
          y: mesh.position.y,
          z: mesh.position.z,
        },
        rotation: body?.rotation() ?? {
          x: mesh.quaternion.x,
          y: mesh.quaternion.y,
          z: mesh.quaternion.z,
          w: mesh.quaternion.w,
        },
        velocity: body?.linvel() ?? { x: 0, y: 0, z: 0 },
        motion: falling ? "falling" : motion.phase,
        behaviorActive: !!body && body.isDynamic() && !falling,
        detailed,
        physical: !!body,
        visible: mesh.visible,
        collisionFootprint: growthCollisionFootprint(
          definition,
          body?.rotation() ?? mesh.quaternion,
          stageId,
        ),
        top:
          mesh.position.y +
          growthCollisionBounds(definition, mesh.quaternion, stageId).top,
        screen: project(mesh.position.clone()),
      }),
    ),
    aperture: [
      project(new THREE.Vector3(renderHole.x - radius, 0, renderHole.y)),
      project(new THREE.Vector3(renderHole.x + radius, 0, renderHole.y)),
    ],
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
      occlusion.dispose();
      disposeScene(scene);
      renderer.dispose();
      world.free();
      if (import.meta.env.DEV) Reflect.deleteProperty(window, "__hole");
    },
  };
}
