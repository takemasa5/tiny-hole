import { beforeAll, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import {
  createSupplySites,
  MAP_HALF_SIZE,
  OBJECT_TYPES,
  Progress,
  levelsForStage,
  mapHalfSizeForStage,
  objectFootprint,
} from "../src/game/stage";
import {
  createStreetSweeper,
  stepStreetSweeper,
  canSweep,
  SWEEPER_RULES,
} from "../src/game/street-sweeper";
import {
  createObjectSupply,
  supplyRequest,
  findSupplyPlacement,
  finishSupplyAttempt,
  availableGrowth,
  SUPPLY_RULES,
  type SupplyObject,
} from "../src/game/object-supply";
import { isObjectOutside, objectExit } from "../src/game/object-exit";
import { createFloor, updateFloor, topOfBox } from "../src/game/floor";
import { objectCollider } from "../src/game/object-collider";
import { writeGroundGeometry } from "../src/game/ground-geometry";

function createCarSweeper() {
  const state = createStreetSweeper();
  state.phase = "approaching";
  state.targetId = "car-0";
  state.targetKind = "car";
  return state;
}

const TEST_SUPPLY_SITES = createSupplySites(0, "america");

it("全ステージを100四方へ広げ、最大成長時も床とUVが全域を支える", () => {
  expect(mapHalfSizeForStage("america")).toBe(50);
  expect(mapHalfSizeForStage("plaza")).toBe(MAP_HALF_SIZE);
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([-50, 0, -50, 50, 0, 50, 0, 0, 0]);
  writeGroundGeometry(geometry, vertices, new Uint32Array([0, 1, 2]), 50);
  const uv = geometry.getAttribute("uv");
  expect([uv.getX(0), uv.getY(0), uv.getX(1), uv.getY(1)]).toEqual([
    0, 1, 1, 0,
  ]);
  geometry.dispose();
});

it("家を押せるが、目標物・人・落下中の物は清掃対象から除く", () => {
  const candidate = {
    id: "car-0",
    kind: "car" as const,
    x: 8,
    z: 14,
    y: 0.55,
    falling: false,
  };
  expect(canSweep(candidate)).toBe(true);
  expect(canSweep({ ...candidate, id: "goal" })).toBe(false);
  expect(canSweep({ ...candidate, kind: "house" })).toBe(true);
  expect(canSweep({ ...candidate, kind: "american" })).toBe(false);
  expect(canSweep({ ...candidate, falling: true })).toBe(false);
  const enemy = createCarSweeper();
  expect(
    stepStreetSweeper(enemy, { x: 8, z: 9 }, [candidate], 1 / 60, true),
  ).toEqual({ x: 0, z: 0 });
  expect(enemy.phase).toBe("falling");
  expect(
    stepStreetSweeper(enemy, { x: 8, z: 9 }, [candidate], 1 / 60, false),
  ).toEqual({ x: 0, z: 0 });
});

it("場外の物には加点せず、穴に落ちた物だけを一度回収する", () => {
  const object = { id: "car-0", kind: "car" as const };
  expect(objectExit(object, { x: 52, z: 0 }, 1, 50, false)).toBe("lost");
  expect(objectExit(object, { x: 52, z: 0 }, -3, 50, false)).toBe("lost");
  expect(
    objectExit({ ...object, id: "goal" }, { x: 52, z: 0 }, 1, 50, false),
  ).toBeUndefined();
  expect(
    objectExit(
      { id: "streetSweeper-0", kind: "streetSweeper" },
      { x: 55, z: 0 },
      1,
      50,
      false,
    ),
  ).toBeUndefined();
  const progress = new Progress("america");
  const exit = objectExit(object, { x: 0, z: 0 }, -2, 50, true);
  if (exit === "collected") expect(progress.collect(object)).toBe(true);
  expect(progress.collect(object)).toBe(false);
  expect(progress.score).toBe(32);
});

it("供給地点ごとの間隔を保ち、片側の滞留でも他方の供給が止まらない", () => {
  const state = createObjectSupply();
  const stock: SupplyObject[] = Array.from({ length: 4 }, (_, index) => ({
    id: `stock-${index}`,
    kind: "burger",
    x: -20 - index * 2,
    z: 0,
    footprint: objectFootprint("burger"),
    falling: false,
  }));
  expect(supplyRequest(state, 0, 0, stock, 7)).toBeUndefined();
  expect(supplyRequest(state, 0, 0, stock, 1)?.siteId).toBe("food");
  finishSupplyAttempt(state, "food", false);
  const served = new Set<string>();
  for (let second = 0; second < 15; second++) {
    const request = supplyRequest(state, 0, 0, stock, 1);
    if (request) {
      served.add(request.siteId);
      finishSupplyAttempt(state, request.siteId, false);
    }
  }
  expect([...served].sort()).toEqual(["depot", "food"]);
});

it("全成長段階で在庫ゼロから飲み込める物を補充し、供給だけでも次段階へ到達できる", () => {
  const levels = levelsForStage("america");
  for (let level = 0; level < levels.length - 1; level++) {
    const state = createObjectSupply();
    let score = levels[level].threshold;
    let produced = 0;
    while (score < levels[level + 1].threshold && produced < 100) {
      const request = supplyRequest(state, level, score, [], 2);
      expect(request?.recovery).toBe(true);
      expect(objectFootprint(request!.kind)).toBeLessThan(levels[level].radius);
      const object = findSupplyPlacement(
        state,
        request!.siteId,
        request!.kind,
        [],
        { x: 0, z: 0, radius: levels[level].radius },
      );
      expect(object).toBeDefined();
      score += OBJECT_TYPES[object!.kind].value;
      produced++;
      finishSupplyAttempt(state, request!.siteId, true);
    }
    expect(score).toBeGreaterThanOrEqual(levels[level + 1].threshold);
  }
});

it("生成物は重なり・穴への直出し・設備との干渉を避け、数を制限する", () => {
  const state = createObjectSupply();
  const objects: SupplyObject[] = [];
  const hole = { x: -7, z: 9, radius: 0.9 };
  for (let index = 0; index < SUPPLY_RULES.maxPerSite; index++) {
    const object = findSupplyPlacement(
      state,
      "food",
      "burgerBox",
      objects,
      hole,
    )!;
    expect(object).toBeDefined();
    expect(Math.hypot(object.x - hole.x, object.z - hole.z)).toBeGreaterThan(
      hole.radius + objectFootprint(object.kind),
    );
    expect(
      objects.every(
        (other) =>
          Math.hypot(object.x - other.x, object.z - other.z) >
          other.footprint + objectFootprint(object.kind),
      ),
    ).toBe(true);
    objects.push({
      ...object,
      footprint: objectFootprint(object.kind),
      falling: false,
    });
  }
  expect(new Set(objects.map(({ id }) => id)).size).toBe(
    SUPPLY_RULES.maxPerSite,
  );
  expect(
    findSupplyPlacement(state, "food", "burgerBox", objects, hole),
  ).toBeUndefined();
  expect(
    findSupplyPlacement(
      state,
      "depot",
      "tire",
      Array.from({ length: SUPPLY_RULES.maxObjects }, (_, index) => ({
        ...objects[0],
        id: `full-${index}`,
        sourceId: undefined,
      })),
      hole,
    ),
  ).toBeUndefined();
  expect(availableGrowth(objects, 0.9)).toBe(8);
  expect(
    availableGrowth(
      objects.map((object) => ({ ...object, x: 51 })),
      0.9,
    ),
  ).toBe(0);
  expect(
    availableGrowth(
      objects.map((object) => ({ ...object, falling: true })),
      0.9,
    ),
  ).toBe(0);
});

beforeAll(async () => {
  await RAPIER.init();
});

it("清掃車の剛体接触だけで車を場外まで押し出せる", () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const floor = createFloor(world);
  updateFloor(floor, -30, -30, 0.9, 180);
  const sweeper = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(8, 0.92, 9)
      .setCcdEnabled(true),
  );
  sweeper.setEnabledRotations(false, true, false, true);
  world.createCollider(
    objectCollider("streetSweeper")
      .setDensity(SWEEPER_RULES.density)
      .setFriction(0.65),
    sweeper,
  );
  const car = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(8, 0.57, 14)
      .setCcdEnabled(true),
  );
  world.createCollider(objectCollider("car").setFriction(0.65), car);
  const state = createCarSweeper();
  let outside = false;
  for (let step = 0; step < 1440; step++) {
    const position = car.translation();
    const velocity = stepStreetSweeper(
      state,
      sweeper.translation(),
      [{ id: "car-0", kind: "car", ...position, falling: false }],
      1 / 60,
      false,
    );
    sweeper.setLinvel({ ...velocity, y: sweeper.linvel().y }, true);
    sweeper.setAngvel({ x: 0, y: 0, z: 0 }, true);
    sweeper.setRotation(
      {
        x: 0,
        y: Math.sin(state.heading / 2),
        z: 0,
        w: Math.cos(state.heading / 2),
      },
      true,
    );
    world.step();
    if (isObjectOutside(car.translation(), "car", 50)) {
      outside = true;
      break;
    }
  }
  expect(outside).toBe(true);
  expect(car.translation().z).toBeGreaterThan(51);
  expect(
    objectExit({ id: "car-0", kind: "car" }, car.translation(), 1, 50, false),
  ).toBe("lost");
  world.free();
});

it("最大成長で隅へ移動しても、反対の隅の物は床に支えられる", () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const floor = createFloor(world);
  updateFloor(floor, -44.9, -44.9, 5.1, 180);
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(48, 0.6, 48),
  );
  world.createCollider(objectCollider("burgerBox"), body);
  for (let step = 0; step < 120; step++) world.step();
  expect(
    topOfBox(
      body.translation().y,
      body.rotation(),
      OBJECT_TYPES.burgerBox.size,
    ),
  ).toBeGreaterThan(0);
  expect(TEST_SUPPLY_SITES).toHaveLength(2);
  world.free();
});
