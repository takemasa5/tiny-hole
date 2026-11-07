import { beforeAll, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  createGrowthStage,
  areasForStage,
  GROWTH_LEVELS,
  footprintOf,
} from "../src/game/growth-stage";
import { growthVisual, GrowthScenery } from "../src/game/growth-visuals";
import { createGrowthBody } from "../src/game/growth-physics";
import { createFloor, topOfBox, updateFloor } from "../src/game/floor";
import { createThemeMotion, themeVelocity } from "../src/game/theme-behavior";
import { disposeScene } from "../src/game/visuals";

const definitions = createGrowthStage(42, "toys");
const toyKinds = [
  ...new Set(definitions.flatMap((d) => (d.toyKind ? [d.toyKind] : []))),
];
beforeAll(async () => {
  await RAPIER.init();
});

it("玩具・実物の家具・街の種類と、道路・線路・巨大物を含む", () => {
  expect(toyKinds.length).toBeGreaterThanOrEqual(25);
  for (const kind of ["bed", "desk", "fridge", "counter", "sofa", "bin"])
    expect(toyKinds).toContain(kind);
  for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
    const stock = definitions.filter((d) =>
      d.id.startsWith(`growth-${level}-`),
    );
    expect(stock).toHaveLength(24);
    expect(new Set(stock.map((d) => d.label)).size).toBeGreaterThanOrEqual(3);
    expect(
      stock.filter((d) => d.behavior === "still").length,
    ).toBeGreaterThanOrEqual(20);
  }
  expect(definitions.find((d) => d.id === "hero")?.partnerId).toBe("monster");
  expect(definitions.find((d) => d.id === "monster")?.partnerId).toBe("hero");
  expect(definitions.find((d) => d.id === "goal")?.label).toBe("巨大ロボット");
});

it.each(toyKinds)(
  "%sの外形は物理の寸法からはみ出さず、実際の穴に落下できる",
  (toyKind) => {
    const definition = definitions.find(
      (d) =>
        d.toyKind === toyKind &&
        Math.hypot(d.size[0], d.size[2]) / 2 <
          GROWTH_LEVELS[d.level - 1].radius * 0.95,
    )!;
    const mesh = growthVisual(definition, "toys");
    mesh.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(mesh);
    for (const [index, axis] of (["x", "y", "z"] as const).entries()) {
      expect(bounds.min[axis], `${toyKind} ${axis} min`).toBeGreaterThanOrEqual(
        -definition.size[index] * 0.505,
      );
      expect(bounds.max[axis], `${toyKind} ${axis} max`).toBeLessThanOrEqual(
        definition.size[index] * 0.505,
      );
    }
    disposeScene(mesh);
    const radius = GROWTH_LEVELS[definition.level - 1].radius;
    const world = new RAPIER.World({
      x: 0,
      y: -9.81 * Math.max(0.25, radius),
      z: 0,
    });
    try {
      const floor = createFloor(world);
      updateFloor(floor, 0, 0, radius, radius * 40);
      const bodies = [0, radius * 4].map(
        (x) =>
          createGrowthBody(
            world,
            { ...definition, behavior: "still" },
            { x, y: definition.size[1] / 2 + 0.0005, z: 0 },
            { x: 0, y: 0, z: 0, w: 1 },
          ).body,
      );
      for (let frame = 0; frame < 180; frame++) world.step();
      expect(
        topOfBox(
          bodies[0].translation().y,
          bodies[0].rotation(),
          definition.size,
        ),
      ).toBeLessThan(0);
      expect(bodies[1].translation().y).toBeGreaterThan(0);
    } finally {
      world.free();
    }
  },
);

it("100シードで経路は開放範囲内にあり、同じ段階の展示物に重ならない", () => {
  for (let seed = 0; seed < 100; seed++) {
    const objects = createGrowthStage(seed, "toys");
    for (const d of objects.filter((d) => d.route)) {
      const extent = areasForStage("toys")[d.area].extent;
      let minimumClearance = Infinity;
      for (const point of d.route!) {
        expect(
          Math.max(Math.abs(point.x), Math.abs(point.z)) + footprintOf(d),
        ).toBeLessThan(extent);
        for (const other of objects.filter(
          (o) =>
            o.level === d.level && !o.sourceLevel && o.behavior === "still",
        )) {
          // Routes are axis-aligned; the swept footprint must clear the exhibit rows.
          const next =
            d.route![(d.route!.indexOf(point) + 1) % d.route!.length];
          const x = Math.max(
            Math.min(point.x, next.x),
            Math.min(Math.max(point.x, next.x), other.x),
          );
          const z = Math.max(
            Math.min(point.z, next.z),
            Math.min(Math.max(point.z, next.z), other.z),
          );
          minimumClearance = Math.min(
            minimumClearance,
            Math.hypot(x - other.x, z - other.z) -
              footprintOf(d) -
              footprintOf(other),
          );
        }
      }
      expect(minimumClearance, `${seed}: ${d.id}`).toBeGreaterThan(0);
    }
  }
});

it.each([5, 6, 9])(
  "レベル%sの動く玩具は経路を進み、角で止まり、支持を失うと制御しない",
  (level) => {
    const d = definitions.find((d) => d.level === level && d.route)!;
    const motion = createThemeMotion(d);
    const hole = { x: 0, z: 0, radius: 0.001 };
    const velocity = themeVelocity(d, motion, d, hole, 1 / 60);
    expect(Math.hypot(velocity.x, velocity.z)).toBeGreaterThan(0);
    const corner = d.route![motion.waypoint];
    expect(themeVelocity(d, motion, corner, hole, 1 / 60)).toEqual({
      x: 0,
      z: 0,
    });
    expect(motion.phase).toBe("waiting");
    motion.phase = "falling";
    expect(themeVelocity(d, motion, corner, hole, 1 / 60)).toEqual({
      x: 0,
      z: 0,
    });
  },
);

it("機関車は停車点で2秒止まり、部屋の車・汽車は速い速度設定を持つ", () => {
  const train = definitions.find((d) => d.behavior === "train")!;
  const stop = train.route![train.stationStop!];
  const motion = createThemeMotion(train);
  motion.waypoint = train.stationStop!;
  const hole = { x: 0, z: 0, radius: 0.001 };
  themeVelocity(train, motion, stop, hole, 1 / 60);
  expect(motion.wait).toBe(2);
  expect(themeVelocity(train, motion, stop, hole, 1)).toEqual({ x: 0, z: 0 });
  expect(motion.phase).toBe("waiting");
  for (const d of definitions.filter((d) => d.area === 2 && d.route))
    expect(d.speedMultiplier).toBe(6);
});

it("補充箱の帯と本体は上面で競合せず、地面の模様は物体より先に描く", () => {
  const d = definitions.find((d) => d.sourceLevel === 1)!;
  const mesh = growthVisual(d, "toys");
  mesh.updateMatrixWorld(true);
  for (const x of [-0.45, -0.3, 0, 0.3, 0.45]) {
    const ray = new THREE.Raycaster(
      new THREE.Vector3(x * d.size[0], d.size[1] * 2, 0.17 * d.size[2]),
      new THREE.Vector3(0, -1, 0),
    );
    const top = ray
      .intersectObject(mesh, true)
      .filter((hit) => Math.abs(hit.point.y - d.size[1] / 2) < 0.000001);
    expect(top).toHaveLength(1);
  }
  const scenery = new GrowthScenery(definitions, "toys");
  const patches = scenery.group.children.filter(
    (child) =>
      child instanceof THREE.Mesh &&
      child.geometry instanceof THREE.PlaneGeometry,
  ) as THREE.Mesh[];
  expect(patches.length).toBeGreaterThan(6);
  for (const patch of patches) {
    const material = patch.material as THREE.Material;
    expect(patch.renderOrder).toBeLessThan(0);
    expect(material.depthTest).toBe(false);
    expect(material.depthWrite).toBe(false);
  }
  disposeScene(mesh);
  disposeScene(scenery.group);
});
