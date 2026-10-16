import { beforeAll, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import {
  createStage,
  STAGES,
  STAGE_IDS,
  LEVELS,
  MAP_HALF_SIZE,
  OBJECT_TYPES,
  objectFootprint,
} from "../src/game/stage";
import { objectCollider } from "../src/game/object-collider";
import { createFloor, updateFloor } from "../src/game/floor";
import { createShooting, stepShooting } from "../src/game/shooting";
import { objectVisual, disposeScene } from "../src/game/visuals";

it.each(STAGE_IDS)(
  "%s: 3シードで重なり・境界・目標・各段階の成長量を検証する",
  (id) => {
    for (const seed of [42, 43, 20261015]) {
      const objects = createStage(seed, id);
      expect(createStage(seed, id)).toEqual(objects);
      expect(
        objects
          .filter((object) => object.id === "goal")
          .map((object) => object.kind),
      ).toEqual([STAGES[id].goal]);
      expect(
        objects.filter((object) => object.kind === STAGES[id].moving.kind),
      ).toHaveLength(24);
      expect(new Set(objects.map((object) => object.id)).size).toBe(
        objects.length,
      );
      objects.forEach((object, index) => {
        expect(
          Math.max(Math.abs(object.x), Math.abs(object.z)) +
            objectFootprint(object.kind),
        ).toBeLessThan(MAP_HALF_SIZE);
        for (const other of objects.slice(index + 1)) {
          let horizontal =
            Math.hypot(object.x - other.x, object.z - other.z) <
            objectFootprint(object.kind) + objectFootprint(other.kind);
          if (object.kind === "log" && object.stackId === other.stackId) {
            const perpendicular = Math.abs(
              (other.x - object.x) * Math.sin(object.yaw) +
                (other.z - object.z) * Math.cos(object.yaw),
            );
            horizontal = perpendicular < OBJECT_TYPES.log.size[2];
          }
          const vertical =
            Math.abs(object.y - other.y) <
            (OBJECT_TYPES[object.kind].size[1] +
              OBJECT_TYPES[other.kind].size[1]) /
              2;
          expect(horizontal && vertical).toBe(false);
        }
      });
      LEVELS.slice(0, -1).forEach((level, index) => {
        const points = objects
          .filter(
            (object) =>
              object.id !== "goal" &&
              objectFootprint(object.kind) < level.radius,
          )
          .reduce((sum, object) => sum + OBJECT_TYPES[object.kind].value, 0);
        expect(points).toBeGreaterThanOrEqual(LEVELS[index + 1].threshold);
      });
      expect(objectFootprint(STAGES[id].goal)).toBeLessThan(LEVELS[7].radius);
    }
  },
);

beforeAll(async () => {
  await RAPIER.init();
});
it("ピラミッドは小さな穴に支えられ、最大穴に移動すると落下する", () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const floor = createFloor(world);
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 3.02, 0),
  );
  world.createCollider(objectCollider("pyramid"), body);
  for (let step = 0; step < 120; step++) world.step();
  expect(body.translation().y).toBeGreaterThan(2.9);
  updateFloor(floor, 0, 0, LEVELS[7].radius);
  body.wakeUp();
  for (let step = 0; step < 180; step++) world.step();
  expect(body.translation().y + 3).toBeLessThan(-1.2);
  world.free();
});
it("銃撃演出は剛体を増やさず、落下中には発砲しない", () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const visual = objectVisual("american", "america");
  const state = createShooting(() => 0.5);
  for (let step = 0; step < 300; step++)
    stepShooting(state, 1 / 60, true, () => 0.5);
  expect(state.shots).toBeGreaterThan(5);
  expect(world.bodies.len()).toBe(0);
  const shots = state.shots;
  for (let step = 0; step < 300; step++)
    stepShooting(state, 1 / 60, false, () => 0.5);
  expect(state.shots).toBe(shots);
  expect(visual.getObjectByName("gunfire")).toBeInstanceOf(THREE.Group);
  disposeScene(visual);
  world.free();
});
it("ピラミッドの線のGPU資源を終了時に解放する", () => {
  const visual = objectVisual("pyramid");
  let released = 0;
  visual.traverse((object) => {
    if (object instanceof THREE.Line)
      object.geometry.addEventListener("dispose", () => released++);
  });
  disposeScene(visual);
  expect(released).toBe(7);
});
