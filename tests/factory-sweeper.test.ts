import { beforeAll, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { createSupplySites, OBJECT_TYPES } from "../src/game/stage";
import {
  createObjectSupply,
  findSupplyPlacement,
  supplyLaunch,
  supplyMouth,
} from "../src/game/object-supply";
import { supplySiteVisual } from "../src/game/america-visuals";
import { disposeScene } from "../src/game/visuals";
import { objectCollider } from "../src/game/object-collider";
import { createFloor, updateFloor, topOfBox } from "../src/game/floor";
import { isObjectOutside } from "../src/game/object-exit";
import {
  createStreetSweeper,
  stepStreetSweeper,
  SWEEPER_RULES,
} from "../src/game/street-sweeper";
import { sweeperWaypoint } from "../src/game/sweeper-path";

function createCarSweeper() {
  const state = createStreetSweeper();
  state.phase = "approaching";
  state.targetId = "car-0";
  state.targetKind = "car";
  return state;
}

const TEST_SUPPLY_SITES = createSupplySites(0, "america");

beforeAll(async () => {
  await RAPIER.init();
});

it.each(["burgerBox", "tire", "kiosk", "car", "house"] as const)(
  "%sは工場の煙突から上昇し、放物線を描いて搬出先へ着地する",
  (kind) => {
    const definition = findSupplyPlacement(
      createObjectSupply(),
      "depot",
      kind,
      [],
      { x: 0, z: 0, radius: 0.9 },
    )!;
    const launch = supplyLaunch(definition, TEST_SUPPLY_SITES);
    const mouth = supplyMouth(TEST_SUPPLY_SITES[1]);
    expect(launch.position.x).toBe(mouth.x);
    expect(launch.position.z).toBe(mouth.z);
    expect(launch.position.y - OBJECT_TYPES[kind].size[1] / 2).toBeCloseTo(
      mouth.y + 0.05,
    );
    expect(launch.velocity.y).toBeGreaterThan(0);
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const floor = createFloor(world);
    updateFloor(floor, -25, -25, 0.9, 180);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(launch.position.x, launch.position.y, launch.position.z)
        .setCcdEnabled(true),
    );
    world.createCollider(objectCollider(kind).setFriction(0.65), body);
    body.setLinvel(launch.velocity, true);
    body.setGravityScale(launch.gravityScale, true);
    let highest = launch.position.y;
    for (let step = 0; step < Math.round(launch.duration * 60); step++) {
      world.step();
      highest = Math.max(highest, body.translation().y);
    }
    expect(highest).toBeGreaterThan(launch.position.y + 0.5);
    expect(
      Math.hypot(
        body.translation().x - definition.x,
        body.translation().z - definition.z,
      ),
    ).toBeLessThan(0.25);
    body.setGravityScale(1, true);
    for (let step = 0; step < 120; step++) world.step();
    const position = body.translation();
    const bottom =
      2 * position.y -
      topOfBox(position.y, body.rotation(), OBJECT_TYPES[kind].size);
    expect(bottom).toBeGreaterThan(-0.04);
    expect(bottom).toBeLessThan(0.04);
    world.free();
  },
);

it("工場モデルの煙突開口と排出位置が同じ高さにある", () => {
  for (const site of TEST_SUPPLY_SITES) {
    const visual = supplySiteVisual(site);
    const mouth = visual.getObjectByName("supply-mouth")!;
    expect(mouth).toBeDefined();
    const point = mouth.getWorldPosition(new THREE.Vector3());
    expect(point.x).toBe(supplyMouth(site).x);
    expect(point.y).toBeCloseTo(supplyMouth(site).y + 0.005);
    disposeScene(visual);
  }
});

it("固定設備の正面と、既に接近しすぎた位置の両方から迂回できる", () => {
  const obstacle = { x: 0, z: 0, halfWidth: 2, halfDepth: 2 };
  const start = { x: 0, z: -10 },
    destination = { x: 0, z: 10 };
  const first = sweeperWaypoint(start, destination, [obstacle], 2.3);
  expect(Math.abs(first.x)).toBeGreaterThan(4.3);
  const position = { ...start };
  for (let step = 0; step < 1200; step++) {
    const waypoint = sweeperWaypoint(position, destination, [obstacle], 2.3);
    const dx = waypoint.x - position.x,
      dz = waypoint.z - position.z;
    const length = Math.hypot(dx, dz);
    if (length > 0.001) {
      position.x += (dx / length) * Math.min(length, 3.2 / 60);
      position.z += (dz / length) * Math.min(length, 3.2 / 60);
    }
    expect(Math.abs(position.x) >= 4.3 || Math.abs(position.z) >= 4.3).toBe(
      true,
    );
  }
  expect(
    Math.hypot(position.x - destination.x, position.z - destination.z),
  ).toBeLessThan(0.1);
  const escape = sweeperWaypoint(
    { x: 0, z: -3.9 },
    destination,
    [obstacle],
    2.3,
  );
  expect(escape.z).toBeLessThan(-4.3);
});

it("供給拠点に阻まれたときは別の経路へ切り替える", () => {
  const state = createCarSweeper();
  state.phase = "pushing";
  const target = {
    id: "car-0",
    kind: "car" as const,
    x: 8,
    y: 0.55,
    z: -22.7,
    falling: false,
  };
  for (let step = 0; step < 105; step++)
    stepStreetSweeper(
      state,
      { x: 8, z: -25 },
      [target],
      1 / 60,
      false,
      [],
      [{ x: 8, z: -20, halfWidth: 2.25, halfDepth: 2 }],
    );
  expect(state.targetId).not.toBe("car-0");
  expect(state.ignoredId).toBe("car-0");
});

it.each([0, 0.05, 0.5])(
  "速度%sでも時間や停止だけでは押す対象と向きを変えない",
  (speed) => {
    const state = createCarSweeper();
    state.phase = "pushing";
    const direction = { ...state.direction };
    for (let step = 0; step < 2400; step++) {
      const z = 10 + (speed * step) / 60;
      const target = {
        id: "car-0",
        kind: "car" as const,
        x: -25,
        y: 0.55,
        z: z + 3,
        falling: false,
      };
      const nearer = { ...target, id: "car-1", z: z + 1 };
      const velocity = stepStreetSweeper(
        state,
        { x: -25, z },
        [target, nearer],
        1 / 60,
        false,
      );
      expect(state.targetId).toBe("car-0");
      expect(state.phase).toBe("pushing");
      expect(state.direction).toEqual(direction);
      expect(velocity.z).toBeGreaterThan(0);
    }
  },
);

it("押した物が跳ねても追い続け、回収・落下でなくなったら次へ進む", () => {
  const state = createCarSweeper();
  state.phase = "pushing";
  const target = {
    id: "car-0",
    kind: "car" as const,
    x: -25,
    y: 3,
    z: 14,
    falling: false,
  };
  stepStreetSweeper(state, { x: -25, z: 10 }, [target], 1 / 60, false);
  expect(state.targetId).toBe("car-0");
  stepStreetSweeper(
    state,
    { x: -25, z: 10 },
    [{ ...target, falling: true }],
    1 / 60,
    false,
  );
  expect(state.targetId).toBeUndefined();
  expect(state.phase).toBe("patrol");
});

it("最終目標に押している物が引っかかった場合は対象を切り替える", () => {
  const state = createCarSweeper();
  state.phase = "pushing";
  const target = {
    id: "car-0",
    kind: "car" as const,
    x: -25,
    y: 0.55,
    z: 15.7,
    falling: false,
  };
  for (let step = 0; step < 105; step++)
    stepStreetSweeper(state, { x: -25, z: 13 }, [target], 1 / 60, false, [
      { x: -25, z: 20, halfWidth: 3, halfDepth: 3 },
    ]);
  expect(state.targetId).not.toBe("car-0");
  expect(state.ignoredId).toBe("car-0");
});

function drive(
  world: RAPIER.World,
  body: RAPIER.RigidBody,
  velocity: { x: number; z: number },
  heading: number,
) {
  body.setLinvel({ ...velocity, y: body.linvel().y }, true);
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  body.setRotation(
    { x: 0, y: Math.sin(heading / 2), z: 0, w: Math.cos(heading / 2) },
    true,
  );
  world.step();
}

it.each(["house", "tree", "column", "bench"] as const)(
  "清掃車は%sを剛体接触で場外まで押せる",
  (kind) => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const floor = createFloor(world);
    updateFloor(floor, -25, -25, 0.9, 180);
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
    const load = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(8, OBJECT_TYPES[kind].size[1] / 2 + 0.02, 14)
        .setCcdEnabled(true),
    );
    world.createCollider(objectCollider(kind).setFriction(0.65), load);
    const state = createCarSweeper();
    state.targetId = "load-0";
    state.targetKind = kind;
    let outside = false;
    for (let step = 0; step < 1440; step++) {
      const velocity = stepStreetSweeper(
        state,
        sweeper.translation(),
        [
          {
            id: "load-0",
            kind,
            ...load.translation(),
            falling: false,
          },
        ],
        1 / 60,
        false,
      );
      drive(world, sweeper, velocity, state.heading);
      if (isObjectOutside(load.translation(), kind, 50)) {
        outside = true;
        break;
      }
    }
    expect(outside).toBe(true);
    world.free();
  },
);

it("家が30秒動かなくても押し続け、動き出した後に場外まで押す", () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const floor = createFloor(world);
  updateFloor(floor, -25, -25, 0.9, 180);
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
  const house = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(8, 2.02, 14),
  );
  world.createCollider(objectCollider("house").setFriction(0.65), house);
  const state = createCarSweeper();
  state.targetId = "house-0";
  state.targetKind = "house";
  let outside = false;
  for (let step = 0; step < 3600; step++) {
    if (step === 1800) house.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    const velocity = stepStreetSweeper(
      state,
      sweeper.translation(),
      [
        {
          id: "house-0",
          kind: "house",
          ...house.translation(),
          falling: false,
        },
      ],
      1 / 60,
      false,
    );
    expect(state.targetId).toBe("house-0");
    expect(state.direction).toEqual({ x: 0, z: 1 });
    drive(world, sweeper, velocity, state.heading);
    if (isObjectOutside(house.translation(), "house", 50)) {
      outside = true;
      break;
    }
  }
  expect(outside).toBe(true);
  world.free();
});

it("固定工場に衝突する巡回経路でも、迂回して通過する", () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const floor = createFloor(world);
  updateFloor(floor, -25, -25, 0.9, 180);
  const site = { ...TEST_SUPPLY_SITES[1], x: 8, z: -20 };
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      site.width / 2,
      site.height / 2,
      site.depth / 2,
    ).setTranslation(site.x, site.height / 2, site.z),
  );
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(8, 0.92, -28)
      .setCcdEnabled(true),
  );
  body.setEnabledRotations(false, true, false, true);
  world.createCollider(
    objectCollider("streetSweeper").setDensity(SWEEPER_RULES.density),
    body,
  );
  const state = createCarSweeper();
  let detoured = false;
  let passed = false;
  for (let step = 0; step < 1200; step++) {
    const velocity = stepStreetSweeper(
      state,
      body.translation(),
      [],
      1 / 60,
      false,
      [],
      [
        {
          x: site.x,
          z: site.z,
          halfWidth: site.width / 2,
          halfDepth: site.depth / 2,
        },
      ],
    );
    detoured ||= Math.abs(body.translation().x - site.x) > 4;
    passed ||= body.translation().z > -8;
    drive(world, body, velocity, state.heading);
  }
  expect(detoured).toBe(true);
  expect(passed).toBe(true);
  world.free();
});
