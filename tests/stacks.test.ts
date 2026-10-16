import { beforeAll, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import {
  createStage,
  OBJECT_TYPES,
  Progress,
  type ObjectKind,
  type StageId,
} from "../src/game/stage";
import { createFloor, topOfBox, updateFloor } from "../src/game/floor";
import { objectCollider } from "../src/game/object-collider";
import { disposeScene, objectVisual } from "../src/game/visuals";

beforeAll(async () => {
  await RAPIER.init();
});

const cases = [
  ["mountain", "firewood", 4, 20, 20],
  ["mountain", "log", 4, 6, 12],
  ["america", "burgerBox", 4, 20, 20],
  ["america", "tire", 6, 6, 6],
] as const satisfies readonly (readonly [
  StageId,
  ObjectKind,
  number,
  number,
  number,
])[];

it.each(cases)(
  "%s / %s: 段数と山の数、描画寸法、支持・落下・一度だけの回収",
  (stage, kind, piles, levels, pieces) => {
    const objects = createStage(42, stage).filter(
      (object) => object.kind === kind,
    );
    expect(objects).toHaveLength(piles * pieces);
    expect(new Set(objects.map((object) => object.stackId)).size).toBe(piles);
    expect(new Set(objects.map((object) => object.stackLevel)).size).toBe(
      levels,
    );
    const visual = objectVisual(kind, stage);
    const visualSize = new THREE.Box3()
      .setFromObject(visual)
      .getSize(new THREE.Vector3());
    OBJECT_TYPES[kind].size.forEach((extent, index) =>
      expect(visualSize.getComponent(index)).toBeLessThanOrEqual(extent + 0.01),
    );
    disposeScene(visual);

    const pile = objects.filter(
      (object) => object.stackId === objects[0].stackId,
    );
    const center = pile.reduce(
      (sum, object) => ({
        x: sum.x + object.x / pile.length,
        z: sum.z + object.z / pile.length,
      }),
      { x: 0, z: 0 },
    );
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const floor = createFloor(world);
    const bodies = pile.map((object) => {
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(
            object.x - center.x + 4,
            object.y,
            object.z - center.z,
          )
          .setRotation({
            x: 0,
            y: Math.sin(object.yaw / 2),
            z: 0,
            w: Math.cos(object.yaw / 2),
          })
          .setCcdEnabled(true),
      );
      world.createCollider(objectCollider(kind).setFriction(0.65), body);
      return body;
    });
    for (const [index, body] of bodies.entries()) {
      for (const other of bodies.slice(index + 1)) {
        const contact = body.collider(0).contactCollider(other.collider(0), 0);
        expect(contact?.distance ?? 0).toBeGreaterThanOrEqual(-0.001);
      }
    }
    for (let step = 0; step < 120; step++) world.step();
    expect(bodies.every((body) => body.translation().y > 0)).toBe(true);
    expect(
      Math.max(...bodies.map((body) => body.translation().y)),
    ).toBeGreaterThan((levels - 1) * OBJECT_TYPES[kind].size[1] * 0.85);
    updateFloor(floor, 4, 0, kind === "log" ? 1.45 : 0.9);
    bodies.forEach((body) => body.wakeUp());
    for (let step = 0; step < 240; step++) world.step();
    const progress = new Progress();
    bodies.forEach((body, index) => {
      expect(
        topOfBox(
          body.translation().y,
          body.rotation(),
          OBJECT_TYPES[kind].size,
        ),
      ).toBeLessThan(-1.2);
      expect(progress.collect(pile[index])).toBe(true);
      expect(progress.collect(pile[index])).toBe(false);
    });
    expect(progress.score).toBe(pieces * OBJECT_TYPES[kind].value);
    world.free();
  },
);

it("丸太は各段2本、隣り合う段が直角の井桁になる", () => {
  const pile = createStage(42, "mountain").filter(
    (object) => object.stackId === "log-0",
  );
  for (let layer = 0; layer < 6; layer++) {
    const tier = pile.filter((object) => object.stackLevel === layer);
    expect(tier).toHaveLength(2);
    expect(
      Math.hypot(tier[0].x - tier[1].x, tier[0].z - tier[1].z),
    ).toBeCloseTo(0.9);
    expect(tier[0].yaw - pile[0].yaw).toBeCloseTo(((layer % 2) * Math.PI) / 2);
  }
});
