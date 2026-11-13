import { beforeAll, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { createGrowthStage, GROWTH_LEVELS } from "../src/game/growth-stage";
import {
  createGrowthBody,
  growthCollisionBounds,
} from "../src/game/growth-physics";
import { createFloor, updateFloor } from "../src/game/floor";
beforeAll(async () => {
  await RAPIER.init();
});
it.each(["oak", "ancientTree", "greatTree"])(
  "%sは穴に触れていない平地で直立を保ち、足場を抜くと落下する",
  (kind) => {
    const d = createGrowthStage(42, "mountain").find(
        (d) => d.mountainKind === kind,
      )!,
      radius = GROWTH_LEVELS[d.level - 1].radius,
      world = new RAPIER.World({ x: 0, y: -9.81 * radius, z: 0 });
    try {
      const floor = createFloor(world);
      updateFloor(floor, 1000, 0, radius, 10000);
      const q = { x: 0, y: 0, z: 0, w: 1 },
        { body } = createGrowthBody(
          world,
          d,
          {
            x: 0,
            y: -growthCollisionBounds(d, q, "mountain").bottom + 0.0005,
            z: 0,
          },
          q,
          "mountain",
        );
      for (let frame = 0; frame < 240; frame++) world.step();
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(body.rotation());
      expect(
        up.y,
        JSON.stringify({
          kind,
          at: body.translation(),
          rotation: body.rotation(),
        }),
      ).toBeGreaterThan(Math.cos(Math.PI / 36));
      updateFloor(floor, 0, 0, radius, 10000);
      body.wakeUp();
      for (let frame = 0; frame < 240; frame++) world.step();
      expect(
        body.translation().y +
          growthCollisionBounds(d, body.rotation(), "mountain").top,
      ).toBeLessThan(0);
    } finally {
      world.free();
    }
  },
);
