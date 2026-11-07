import { beforeAll, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import {
  ROADS,
  createStage,
  LEVELS,
  mapHalfSizeForStage,
  levelsForStage,
  levelForScore,
  objectFootprint,
  OBJECT_TYPES,
  Progress,
} from "../src/game/stage";
import { supplySiteVisual } from "../src/game/america-visuals";
import { createSupplySites } from "../src/game/stage";
import { createFloor, topOfBox, updateFloor } from "../src/game/floor";
import { objectCollider } from "../src/game/object-collider";
import { disposeScene, objectVisual } from "../src/game/visuals";

const TEST_SUPPLY_SITES = createSupplySites(0, "america");

it("全ステージで中盤を延長し、進行判定と成長表示で同じ閾値を使う", () => {
  const levels = levelsForStage("america");
  expect(levels.map(({ radius }) => radius)).toEqual(
    LEVELS.map(({ radius }) => radius),
  );
  expect(levels[1].threshold).toBe(LEVELS[1].threshold);
  expect(levels[7].threshold).toBe(2700);
  for (const id of ["plaza", "mountain", "egypt"] as const)
    expect(levelsForStage(id)).toBe(LEVELS);
  levels.slice(1).forEach((level, index) => {
    expect(levelForScore(level.threshold - 1, levels)).toBe(index);
    expect(levelForScore(level.threshold, levels)).toBe(index + 1);
  });
  const progress = new Progress("america");
  progress.collect({ id: "car-0", kind: "car" });
  expect(progress.level).toBe(2);
  expect(progress.collect({ id: "car-0", kind: "car" })).toBe(false);
});

it("20シードでアメリカの道路沿いに生成でき、敵を取らなくても全段階へ進める", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const objects = createStage(seed, "america");
    expect(mapHalfSizeForStage("america")).toBe(50);
    expect(objects).toHaveLength(452);
    expect(objects.filter(({ kind }) => kind === "streetSweeper")).toHaveLength(
      1,
    );
    for (const object of objects) {
      expect(
        ROADS.some((road) => {
          const distance =
            Math.abs(
              (road.axis === "x" ? object.z : object.x) - road.position,
            ) -
            road.width / 2 -
            objectFootprint(object.kind);
          return distance >= 0.39 && distance <= 7.41;
        }),
      ).toBe(true);
    }

    const levels = levelsForStage("america");
    levels.slice(0, -1).forEach((level, index) => {
      const available = objects
        .filter(
          ({ kind, id }) =>
            id !== "goal" &&
            kind !== "streetSweeper" &&
            objectFootprint(kind) < level.radius,
        )
        .reduce((sum, object) => sum + OBJECT_TYPES[object.kind].value, 0);
      expect(available).toBeGreaterThanOrEqual(levels[index + 1].threshold);
    });
  }
});

beforeAll(async () => {
  await RAPIER.init();
});

it.each(["car", "streetSweeper"] as const)(
  "%sは小さい穴で支持され、成長後に物理落下して一度だけ加点する",
  (kind) => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const floor = createFloor(world);
    const size = OBJECT_TYPES[kind].size;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(6, size[1] / 2 + 0.02, 0)
        .setCcdEnabled(true),
    );
    world.createCollider(objectCollider(kind), body);
    for (let step = 0; step < 120; step++) world.step();
    expect(body.translation().y).toBeGreaterThan(0);
    updateFloor(floor, 6, 0, kind === "car" ? 1.85 : 2.3);
    body.wakeUp();
    for (let step = 0; step < 240; step++) world.step();
    expect(topOfBox(body.translation().y, body.rotation(), size)).toBeLessThan(
      -1.2,
    );
    const progress = new Progress("america");
    expect(progress.collect({ id: kind, kind })).toBe(true);
    expect(progress.collect({ id: kind, kind })).toBe(false);
    expect(progress.score).toBe(OBJECT_TYPES[kind].value);
    const visual = objectVisual(kind, "america");
    const bounds = new THREE.Box3()
      .setFromObject(visual)
      .getSize(new THREE.Vector3());
    size.forEach((extent, index) =>
      expect(bounds.getComponent(index)).toBeLessThanOrEqual(extent + 0.01),
    );
    disposeScene(visual);
    world.free();
  },
);

it("供給設備のGPU資源も解放する", () => {
  const visual = supplySiteVisual(TEST_SUPPLY_SITES[0]);
  let released = 0;
  visual.traverse((object) => {
    if (object instanceof THREE.Mesh)
      object.geometry.addEventListener("dispose", () => released++);
  });
  disposeScene(visual);
  expect(released).toBeGreaterThan(2);
});
