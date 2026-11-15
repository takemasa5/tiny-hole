import { beforeAll, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { createGrowthStage, GROWTH_LEVELS } from "../src/game/growth-stage";
import { growthVisual } from "../src/game/growth-visuals";
import {
  createGrowthBody,
  growthCollisionBounds,
} from "../src/game/growth-physics";
import { createFloor, updateFloor } from "../src/game/floor";
import { disposeScene } from "../src/game/visuals";
import { createThemeMotion, themeVelocity } from "../src/game/theme-behavior";

beforeAll(async () => {
  await RAPIER.init();
});

it.each(["hero", "monster"])(
  "%s: 長い尾の外接箱によって逃走が遅れず、実際に入るレベル11で戦闘から回避へ移る",
  (id) => {
    const d = createGrowthStage(42, "toys").find((d) => d.id === id)!;
    const motion = createThemeMotion(d);
    const partner = { x: d.x + 100, z: d.z };
    themeVelocity(
      d,
      motion,
      d,
      { x: d.x + 1, z: d.z, radius: 24 },
      1 / 60,
      partner,
    );
    expect(motion.phase).toBe("fighting");
    themeVelocity(
      d,
      motion,
      d,
      { x: d.x + 1, z: d.z, radius: 48 },
      1 / 60,
      partner,
    );
    expect(motion.phase).toBe("fleeing");
  },
);

it.each(["hero", "monster"])(
  "%s: 新しい輪郭が登録寸法に収まり、レベル11の穴に落ち、隣の床では支えられる",
  (id) => {
    const definition = createGrowthStage(42, "toys").find((d) => d.id === id)!;
    const visual = growthVisual(definition, "toys");
    try {
      const bounds = new THREE.Box3().setFromObject(visual);
      for (const [index, axis] of (["x", "y", "z"] as const).entries()) {
        expect(bounds.min[axis]).toBeGreaterThanOrEqual(
          -definition.size[index] * 0.505,
        );
        expect(bounds.max[axis]).toBeLessThanOrEqual(
          definition.size[index] * 0.505,
        );
      }
      expect(bounds.max.y - bounds.min.y).toBeCloseTo(definition.size[1], 3);
    } finally {
      disposeScene(visual);
    }
    const radius = GROWTH_LEVELS[10].radius;
    const world = new RAPIER.World({ x: 0, y: -9.81 * radius, z: 0 });
    try {
      const floor = createFloor(world);
      updateFloor(floor, 0, 0, radius, radius * 20);
      const rotation = { x: 0, y: 0, z: 0, w: 1 };
      const bodies = [0, radius * 4].map(
        (x) =>
          createGrowthBody(
            world,
            { ...definition, behavior: "still" },
            { x, y: definition.size[1] / 2 + 0.005, z: 0 },
            rotation,
            "toys",
          ).body,
      );
      for (let frame = 0; frame < 180; frame++) world.step();
      const top =
        bodies[0].translation().y +
        growthCollisionBounds(definition, bodies[0].rotation(), "toys").top;
      const bottom =
        bodies[1].translation().y +
        growthCollisionBounds(definition, bodies[1].rotation(), "toys").bottom;
      expect(top).toBeLessThan(-radius);
      expect(bottom).toBeGreaterThan(-0.1);
      expect(bottom).toBeLessThan(0.1);
    } finally {
      world.free();
    }
  },
);
