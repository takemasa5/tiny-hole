import { beforeAll, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  createWalker,
  driveWalker,
  walkerVelocity,
  WALK_SPEED,
  RUN_SPEED,
} from "../src/game/walker";
import { createFloor, updateFloor, topOfBox } from "../src/game/floor";
import {
  MAP_HALF_SIZE,
  OBJECT_TYPES,
  PHYSICS_STEP,
  Progress,
  seededRandom,
} from "../src/game/stage";

it("普段は直線を歩き、穴が近づくと速く反対へ走り、安全な距離で歩行へ戻る", () => {
  const random = seededRandom(42);
  const walker = createWalker(0, random);
  const hole = { x: 0, z: 0, radius: 0.9 };
  const walking = walkerVelocity(
    walker,
    { x: 10, z: 10 },
    hole,
    0.35,
    PHYSICS_STEP,
    random,
  );
  expect(walking.x).toBe(0);
  expect(walking.z).toBe(WALK_SPEED);
  const sameDirection = walkerVelocity(
    walker,
    { x: 10, z: 11 },
    hole,
    0.35,
    PHYSICS_STEP,
    random,
  );
  expect(sameDirection).toEqual(walking);
  const fleeing = walkerVelocity(
    walker,
    { x: 2, z: 1 },
    hole,
    0.35,
    PHYSICS_STEP,
    random,
  );
  expect(walker.mode).toBe("fleeing");
  expect(Math.hypot(fleeing.x, fleeing.z)).toBeCloseTo(RUN_SPEED);
  expect(fleeing.x * 2 + fleeing.z).toBeGreaterThan(0);
  walkerVelocity(walker, { x: 4.5, z: 0 }, hole, 0.35, PHYSICS_STEP, random);
  expect(walker.mode).toBe("fleeing");
  walkerVelocity(walker, { x: 8, z: 0 }, hole, 0.35, PHYSICS_STEP, random);
  expect(walker.mode).toBe("walking");
});

it("歩行方向はシード付きランダムで変わり、境界では内側へ向きを変える", () => {
  const random = seededRandom(7);
  const walker = createWalker(Math.PI / 2, random);
  walker.turnIn = 0;
  walkerVelocity(
    walker,
    { x: 10, z: 10 },
    { x: 0, z: 0, radius: 0.9 },
    0.35,
    PHYSICS_STEP,
    random,
  );
  expect(walker.heading).not.toBe(Math.PI / 2);
  walker.heading = Math.PI / 2;
  const bounce = walkerVelocity(
    walker,
    { x: MAP_HALF_SIZE - 0.5, z: 0 },
    { x: 0, z: 0, radius: 0.9 },
    0.35,
    PHYSICS_STEP,
    random,
  );
  expect(bounce.x).toBeLessThan(0);
});

beforeAll(async () => {
  await RAPIER.init();
});

it.each(["person", "egyptian", "tanuki"] as const)(
  "%s は床上を歩き、穴が下に来たら重力で落ち、通常の回収で一度だけ成長に加算する",
  (kind) => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = PHYSICS_STEP;
    const floor = createFloor(world);
    const size = OBJECT_TYPES[kind].size;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(10, size[1] / 2 + 0.02, 0)
        .enabledRotations(false, true, false)
        .setCcdEnabled(true),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        size[0] / 2,
        size[1] / 2,
        size[2] / 2,
      ).setFriction(0.15),
      body,
    );
    const random = seededRandom(13);
    const walker = createWalker(0, random);
    for (let step = 0; step < 60; step++) {
      driveWalker(
        body,
        walker,
        kind,
        { x: 0, z: 0, radius: 0.9 },
        PHYSICS_STEP,
        random,
      );
      world.step();
    }
    expect(body.translation().z).toBeGreaterThan(0.8);
    expect(body.translation().y).toBeCloseTo(size[1] / 2, 1);
    const at = body.translation();
    const hole = { x: at.x, z: at.z, radius: 0.9 };
    updateFloor(floor, hole.x, hole.z, hole.radius);
    const progress = new Progress();
    for (let step = 0; step < 120; step++) {
      driveWalker(body, walker, kind, hole, PHYSICS_STEP, random);
      world.step();
      if (topOfBox(body.translation().y, body.rotation(), size) < -1.2)
        progress.collect({ id: `${kind}-0`, kind });
    }
    expect(walker.mode).toBe("falling");
    expect(body.translation().y).toBeLessThan(-2);
    expect(progress.score).toBe(OBJECT_TYPES[kind].value);
    expect(progress.collected.size).toBe(1);
    expect(progress.cleared).toBe(false);
    world.free();
  },
);
