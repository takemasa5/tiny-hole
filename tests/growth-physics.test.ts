import { beforeAll, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { STAGE_IDS } from "../src/game/stage";
import {
  createGrowthStage,
  GROWTH_LEVELS,
  GrowthProgress,
  growthObjectExit,
  footprintOf,
} from "../src/game/growth-stage";
import { createFloor, topOfBox, updateFloor } from "../src/game/floor";
import {
  createGrowthBody,
  apertureOverlapsBase,
  growthCollisionFootprint,
  growthCollisionBounds,
} from "../src/game/growth-physics";

beforeAll(async () => {
  await RAPIER.init();
});

it.each(STAGE_IDS)(
  "%s: 微小物から巨大目標まで実際の穴へ落下し、隣の物は床に支えられる",
  (stage) => {
    const definitions = createGrowthStage(12, stage);
    for (let level = 1; level <= 12; level++) {
      const d = definitions.find(
        (d) =>
          d.level === level &&
          !d.sourceLevel &&
          (["hell", "plaza", "mountain", "america", "harbor"].includes(stage)
            ? level === 12
              ? d.id === "goal"
              : d.id.startsWith(`growth-${level}-`)
            : ["still", "moored"].includes(d.behavior)),
      )!;
      const radius = GROWTH_LEVELS[level - 1].radius;
      const world = new RAPIER.World({
        x: 0,
        y: -9.81 * Math.max(0.25, radius),
        z: 0,
      });
      const floor = createFloor(world);
      updateFloor(floor, 0, 0, radius, radius * 40);
      const bodies = [0, radius * 4].map((x) => {
        const { body } = createGrowthBody(
          world,
          d,
          {
            x,
            y:
              -growthCollisionBounds(d, { x: 0, y: 0, z: 0, w: 1 }, stage)
                .bottom + 0.0005,
            z: 0,
          },
          { x: 0, y: 0, z: 0, w: 1 },
          stage,
        );
        return body;
      });
      for (let frame = 0; frame < 180; frame++) world.step();
      expect(
        topOfBox(bodies[0].translation().y, bodies[0].rotation(), d.size),
      ).toBeLessThan(0);
      const neighbor = growthCollisionBounds(d, bodies[1].rotation(), stage);
      // Curved and top-heavy shapes may settle on their side, still on the floor.
      expect(
        bodies[1].translation().y + neighbor.bottom,
        `${d.label}: support`,
      ).toBeGreaterThan(-Math.max(0.003, radius * 0.01));
      expect(
        bodies[1].translation().y + neighbor.top,
        `${d.label}: above floor`,
      ).toBeGreaterThan(0);
      world.free();
    }
  },
);

it.each([0.1, 1, 100])(
  "穴に収まらない次レベルの物も一部の支持を失うと自然に傾く（縮尺%s）",
  (scale) => {
    const template = createGrowthStage(1, "harbor").find(
      (definition) => definition.districtKind === "warehouse",
    )!;
    const definition = {
      ...template,
      level: 12,
      behavior: "still" as const,
      size: [2 * scale, 0.4 * scale, 0.4 * scale] as [number, number, number],
    };
    const radius = 0.8 * scale;
    const world = new RAPIER.World({
      x: 0,
      y: -9.81 * Math.max(0.25, radius),
      z: 0,
    });
    const floor = createFloor(world);
    updateFloor(floor, -4 * scale, 0, radius, 30 * scale);
    const { body } = createGrowthBody(
      world,
      definition,
      { x: 0.5 * scale, y: 0.2 * scale + 0.0005, z: 0 },
      { x: 0, y: 0, z: 0, w: 1 },
    );
    expect(body.isDynamic()).toBe(true);
    for (let frame = 0; frame < 60; frame++) world.step();
    expect(Math.abs(body.rotation().z)).toBeLessThan(0.01);
    updateFloor(floor, 0, 0, radius, 30 * scale);
    body.wakeUp();
    let tilt = 0;
    for (let frame = 0; frame < 40; frame++) {
      world.step();
      tilt = Math.max(tilt, Math.abs(body.rotation().z));
    }
    expect(tilt).toBeGreaterThan(0.1);
    world.free();
  },
);

it("対象レベル前の長い最終目標も、傾いて穴へ落ちきれば加点・クリアする", () => {
  const template = createGrowthStage(1, "harbor").find((d) => d.id === "goal")!;
  const definition = {
    ...template,
    model: "building" as const,
    size: [120, 24, 24] as [number, number, number],
  };
  const progress = new GrowthProgress();
  const score = GROWTH_LEVELS[10].threshold;
  progress.collect({ id: "previous", value: score });
  const radius = GROWTH_LEVELS[progress.level - 1].radius;
  expect(progress.level).toBe(11);
  expect(definition.level).toBe(12);
  expect(
    growthCollisionFootprint(definition, { x: 0, y: 0, z: 0, w: 1 }),
  ).toBeGreaterThan(radius);
  const world = new RAPIER.World({ x: 0, y: -9.81 * radius, z: 0 });
  try {
    const floor = createFloor(world);
    updateFloor(floor, -240, 0, radius, 1800);
    const { body } = createGrowthBody(
      world,
      definition,
      { x: 30, y: 12.0005, z: 0 },
      { x: 0, y: 0, z: 0, w: 1 },
    );
    for (let frame = 0; frame < 60; frame++) world.step();
    updateFloor(floor, 0, 0, radius, 1800);
    body.wakeUp();
    let enteredHole = false;
    for (let frame = 0; frame < 360; frame++) {
      world.step();
      const position = body.translation();
      const top = topOfBox(position.y, body.rotation(), definition.size);
      if (
        position.y * 2 - top < -radius * 0.03 &&
        Math.hypot(position.x, position.z) < radius + footprintOf(definition)
      )
        enteredHole = true;
      if (growthObjectExit(enteredHole, top, radius) === "collected") {
        expect(progress.collect(definition)).toBe(true);
        break;
      }
    }
    expect(progress.cleared).toBe(true);
    expect(progress.score).toBe(score + definition.value);
    expect(progress.level).toBe(11);
    expect(progress.collect(definition)).toBe(false);
  } finally {
    world.free();
  }
});

it("回転した車でも接地面と穴が重なる時点で操縦の直立制限を解ける", () => {
  const definition = { size: [2, 1, 0.4] as [number, number, number] };
  const rotation = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 };
  expect(
    apertureOverlapsBase(definition, { x: 0, z: 0 }, rotation, {
      x: 0,
      z: 1.1,
      radius: 0.2,
    }),
  ).toBe(true);
  expect(
    apertureOverlapsBase(definition, { x: 0, z: 0 }, rotation, {
      x: 1.1,
      z: 0,
      radius: 0.2,
    }),
  ).toBe(false);
});

it("球や円柱を箱の対角で大きく見積もらず、傾いた長い物の実際の投影幅を使う", () => {
  const definitions = [
    ...createGrowthStage(1, "harbor"),
    ...createGrowthStage(1, "toys"),
  ];
  const barrel = definitions.find(
    (definition) => definition.kind === "barrel",
  )!;
  const ball = definitions.find((definition) => definition.kind === "toyBall")!;
  const upright = { x: 0, y: 0, z: 0, w: 1 };
  expect(growthCollisionFootprint(barrel, upright)).toBeCloseTo(
    barrel.size[0] / 2,
  );
  expect(growthCollisionFootprint(ball, upright)).toBeCloseTo(ball.size[0] / 2);
  const longBox = {
    ...barrel,
    model: "building" as const,
    size: [4, 0.2, 0.2] as [number, number, number],
  };
  expect(growthCollisionFootprint(longBox, upright)).toBeGreaterThan(2);
  expect(
    growthCollisionFootprint(longBox, {
      x: 0,
      y: 0,
      z: Math.SQRT1_2,
      w: Math.SQRT1_2,
    }),
  ).toBeCloseTo(Math.hypot(0.1, 0.1));
});
