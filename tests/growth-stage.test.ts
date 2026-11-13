import { expect, it } from "vitest";
import { STAGE_IDS } from "../src/game/stage";
import {
  createGrowthStage,
  GROWTH_LEVELS,
  areasForStage,
  GrowthProgress,
  growthObjectExit,
  areaForLevel,
  footprintOf,
  clampToArea,
  canRetire,
} from "../src/game/growth-stage";
import {
  createThemeMotion,
  themeVelocity,
  themeYaw,
} from "../src/game/theme-behavior";
import { growthVisual } from "../src/game/growth-visuals";
import { disposeScene } from "../src/game/visuals";
import * as THREE from "three";
import { isHellActor } from "../src/game/hell-world";

it.each(STAGE_IDS)(
  "%s: 各段階に成長可能な在庫があり、現在の範囲で取れる",
  (stage) => {
    const definitions = createGrowthStage(123, stage);
    expect(new Set(definitions.map((d) => d.id)).size).toBe(definitions.length);
    expect(createGrowthStage(123, stage)).toEqual(definitions);
    expect(createGrowthStage(456, stage)).not.toEqual(definitions);
    for (let level = 1; level < 12; level++) {
      const radius = GROWTH_LEVELS[level - 1].radius;
      const stock = definitions.filter(
        (d) =>
          d.level === level &&
          !d.sourceLevel &&
          (["plaza", "mountain"].includes(stage)
            ? d.id.startsWith("growth-")
            : stage === "hell"
              ? level <= 2
                ? d.hellKind === "pebble"
                : isHellActor(d)
              : ["still", "moored"].includes(d.behavior)),
      );
      const needed =
        GROWTH_LEVELS[level].threshold - GROWTH_LEVELS[level - 1].threshold;
      expect(stock.reduce((sum, d) => sum + d.value, 0)).toBeGreaterThanOrEqual(
        needed * 1.5,
      );
      for (const d of stock) {
        expect(
          ["toys", "egypt", "hell", "plaza", "mountain"].includes(stage)
            ? footprintOf(d)
            : Math.hypot(...d.size) / 2,
        ).toBeLessThan(radius * 0.95);
        expect(
          Math.max(Math.abs(d.x), Math.abs(d.z)) + footprintOf(d),
        ).toBeLessThan(areasForStage(stage)[areaForLevel(level, stage)].extent);
      }
    }
    const goal = definitions.find((d) => d.id === "goal")!;
    expect(
      ["toys", "egypt", "hell", "plaza", "mountain"].includes(stage)
        ? footprintOf(goal)
        : Math.hypot(...goal.size) / 2,
    ).toBeLessThan(GROWTH_LEVELS[11].radius);
    expect(goal.size[1]).toBeGreaterThan(30);
  },
);

it("小物から12段階へ進み、二重回収・クリア後の加点を拒否する", () => {
  const definitions = createGrowthStage(1, "harbor");
  const progress = new GrowthProgress();
  for (let level = 1; level < 12; level++) {
    for (const d of definitions
      .filter(
        (d) =>
          d.level === level &&
          !d.sourceLevel &&
          ["still", "moored"].includes(d.behavior),
      )
      .slice(0, 12)) {
      expect(progress.collect(d)).toBe(true);
      const score = progress.score;
      expect(progress.collect(d)).toBe(false);
      expect(progress.score).toBe(score);
    }
    expect(progress.level).toBe(level + 1);
  }
  expect(progress.collect(definitions.find((d) => d.id === "goal")!)).toBe(
    true,
  );
  expect(progress.cleared).toBe(true);
  expect(progress.collect({ id: "later", value: 10 })).toBe(false);
});

it("ゲート境界は穴の全径を含め、複数レベルの成長にも対応する", () => {
  expect(areaForLevel(3)).toBe(0);
  expect(areaForLevel(4)).toBe(1);
  expect(areaForLevel(7)).toBe(2);
  expect(areaForLevel(10)).toBe(3);
  expect(clampToArea({ x: 100, z: -100 }, 0, 0.25, "america")).toEqual({
    x: 2.15,
    z: -2.15,
  });
  const progress = new GrowthProgress();
  progress.collect({ id: "large", value: GROWTH_LEVELS[9].threshold });
  expect(progress.level).toBe(10);
});

it("小物撤去では落下中・目標・近傍を守る", () => {
  const d = createGrowthStage(1, "office")[0];
  expect(canRetire(d, 12, 10000, 160, false)).toBe(true);
  expect(canRetire(d, 12, 10000, 160, true)).toBe(false);
  expect(canRetire(d, 12, 0.1, 160, false)).toBe(false);
  expect(canRetire({ ...d, id: "goal" }, 12, 10000, 160, false)).toBe(false);
});

it("車は経路を守って停止でき、落下後は操縦しない", () => {
  const d = createGrowthStage(1, "harbor").find((d) => d.behavior === "route")!;
  const motion = createThemeMotion(d);
  const hole = { x: d.x - 0.1, z: d.z, radius: 20 };
  const velocity = themeVelocity(d, motion, d, hole, 1 / 60);
  expect(motion.phase).toBe("driving");
  expect(velocity.x === 0 || velocity.z === 0).toBe(true);
  expect(themeVelocity(d, motion, d, hole, 1 / 60, undefined, true)).toEqual({
    x: 0,
    z: 0,
  });
  motion.phase = "falling";
  expect(themeVelocity(d, motion, d, hole, 1 / 60)).toEqual({ x: 0, z: 0 });
});

it("戦闘相手を失っても有限の巡回へ移り、入る大きさになってから回避する", () => {
  const hero = createGrowthStage(1, "toys").find((d) => d.id === "hero")!;
  const motion = createThemeMotion(hero);
  const smallHole = { x: hero.x + 1, z: hero.z, radius: 0.08 };
  themeVelocity(hero, motion, hero, smallHole, 1 / 60, {
    x: hero.x + 40,
    z: hero.z,
  });
  expect(motion.phase).toBe("fighting");
  const velocity = themeVelocity(hero, motion, hero, smallHole, 1 / 60);
  expect(motion.phase).toBe("searching");
  expect(Number.isFinite(velocity.x + velocity.z)).toBe(true);
  themeVelocity(hero, motion, hero, { ...smallHole, radius: 48 }, 1 / 60);
  expect(motion.phase).toBe("fleeing");
});

it("新しい巨大物と小物の表示は物理寸法に収まる", () => {
  const definitions = [
    ...createGrowthStage(1, "harbor").filter((d) =>
      ["tanker", "building", "nut"].includes(d.model),
    ),
    ...createGrowthStage(1, "toys").filter((d) =>
      ["hero", "monster", "bead"].includes(d.model),
    ),
    ...createGrowthStage(1, "mountain").filter((d) => d.model === "seed"),
    ...createGrowthStage(1, "hell").filter((d) => d.model === "bone"),
  ];
  const models = new Set<string>();
  for (const definition of definitions) {
    if (models.has(definition.model)) continue;
    models.add(definition.model);
    const visual = growthVisual(definition, "harbor");
    visual.updateMatrixWorld(true);
    const size = new THREE.Box3()
      .setFromObject(visual)
      .getSize(new THREE.Vector3());
    expect(size.x).toBeLessThanOrEqual(definition.size[0] * 1.01);
    expect(size.y).toBeLessThanOrEqual(definition.size[1] * 1.01);
    expect(size.z).toBeLessThanOrEqual(definition.size[2] * 1.01);
    disposeScene(visual);
  }
});

it.each([1, 7, 11])(
  "レベル%sでも実際に回収した最終目標は加点・クリアする",
  (level) => {
    const goal = createGrowthStage(1, "harbor").find((d) => d.id === "goal")!;
    const progress = new GrowthProgress();
    const score = GROWTH_LEVELS[level - 1].threshold;
    if (score > 0) progress.collect({ id: "previous", value: score });
    expect(progress.level).toBe(level);
    expect(progress.collect(goal)).toBe(true);
    expect(progress.score).toBe(score + goal.value);
    expect(progress.cleared).toBe(true);
    expect(progress.collected.has("goal")).toBe(true);
    expect(progress.level).toBeLessThan(12);
    expect(progress.collect(goal)).toBe(false);
    expect(progress.collect({ id: "after-clear", value: 1 })).toBe(false);
    expect(progress.score).toBe(score + goal.value);
  },
);

it("不正なシード・成長値を拒否する", () => {
  expect(() => createGrowthStage(Number.NaN, "office")).toThrow();
  expect(() => createGrowthStage(-1, "office")).toThrow();
  const progress = new GrowthProgress();
  expect(() => progress.collect({ id: "invalid", value: -1 })).toThrow();
  expect(() => progress.collect({ id: "invalid", value: Infinity })).toThrow();
});

it("車と汽車の車首が走る方向を向く", () => {
  for (const behavior of ["route", "train"] as const) {
    for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const yaw = themeYaw({ behavior }, heading);
      const front = new THREE.Vector3(1, 0, 0).applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        yaw,
      );
      expect(
        front.dot(new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading))),
      ).toBeCloseTo(1);
    }
  }
});

it("穴以外への落下を加点せず、穴に入った物は穴が離れた後も一度だけ回収する", () => {
  expect(growthObjectExit(false, -1, 0.08)).toBe("lost");
  expect(growthObjectExit(true, -1, 0.08)).toBe("collected");
  expect(growthObjectExit(true, 0.1, 0.08)).toBeUndefined();
  expect(growthObjectExit(true, -20, 160)).toBeUndefined();
  expect(growthObjectExit(true, -60, 160)).toBe("collected");
});
