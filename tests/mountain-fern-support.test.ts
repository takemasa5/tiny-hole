import { beforeAll, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { createGrowthStage, GROWTH_LEVELS } from "../src/game/growth-stage";
import {
  createGrowthBody,
  growthCollisionBounds,
} from "../src/game/growth-physics";
import { createFloor, updateFloor } from "../src/game/floor";
const definitions = createGrowthStage(42, "mountain");
const examples = [
  definitions.find(
    (d) => d.mountainKind === "fern" && d.id.startsWith("growth-"),
  )!,
  definitions.find(
    (d) => d.mountainKind === "fern" && d.id.startsWith("mountain-landmark-"),
  )!,
  definitions.find(
    (d) => d.mountainKind === "fern" && d.id.startsWith("mountain-scenery-"),
  )!,
  definitions.find(
    (d) => d.mountainKind === "fern" && d.id.startsWith("mountain-grove-"),
  )!,
];
const cases = examples.flatMap((d) =>
  [0, Math.PI / 8, Math.PI / 4, Math.PI / 2].map((yaw) => ({
    name: d.id,
    d,
    yaw,
    radius: GROWTH_LEVELS[d.level - 1].radius,
  })),
);
cases.push(
  ...[0, Math.PI / 8, Math.PI / 4, Math.PI / 2].map((yaw) => ({
    name: "endgame-" + examples[3].id,
    d: examples[3],
    yaw,
    radius: 160 as const,
  })),
);
beforeAll(async () => {
  await RAPIER.init();
});
it.each(cases)(
  "$name / yaw $yaw: 遠方の穴が移動しても平地で10秒直立し、足場を抜くと落ちる",
  ({ d, yaw, radius: r }) => {
    const world = new RAPIER.World({
      x: 0,
      y: -9.81 * Math.max(0.25, r),
      z: 0,
    });
    try {
      const floor = createFloor(world);
      updateFloor(floor, r * 8, 0, r, r * 100);
      const q = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) },
        { body, colliders } = createGrowthBody(
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
      expect(colliders).toHaveLength(8);
      let worst = 1;
      for (let frame = 0; frame < 600; frame++) {
        if (frame % 12 === 0)
          updateFloor(
            floor,
            r * (8 + 0.3 * Math.sin(frame * 0.01)),
            r * 2 * Math.sin(frame * 0.005),
            r,
            r * 100,
          );
        world.step();
        worst = Math.min(
          worst,
          new THREE.Vector3(0, 1, 0).applyQuaternion(body.rotation()).y,
        );
      }
      expect(
        worst,
        JSON.stringify({
          size: d.size,
          at: body.translation(),
          rotation: body.rotation(),
        }),
      ).toBeGreaterThan(Math.cos(Math.PI / 36));
      updateFloor(floor, 0, 0, r, r * 100);
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
it("足元の一部を穴で失うと草は傾き、転倒を固定しない", () => {
  const d = examples[0],
    r = GROWTH_LEVELS[d.level - 1].radius,
    world = new RAPIER.World({ x: 0, y: -9.81 * Math.max(0.25, r), z: 0 });
  try {
    const floor = createFloor(world);
    updateFloor(floor, r * 8, 0, r, r * 100);
    const q = { x: 0, y: 0, z: 0, w: 1 };
    const { body } = createGrowthBody(
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
    for (let frame = 0; frame < 120; frame++) world.step();
    updateFloor(floor, r * 0.9, 0, r, r * 100);
    body.wakeUp();
    let tilt = 0;
    for (let frame = 0; frame < 180; frame++) {
      world.step();
      tilt = Math.max(
        tilt,
        1 - new THREE.Vector3(0, 1, 0).applyQuaternion(body.rotation()).y,
      );
    }
    expect(tilt).toBeGreaterThan(0.05);
  } finally {
    world.free();
  }
});
