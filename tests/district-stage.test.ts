import { hoistFrame, HoistCable } from "../src/game/district-hoist";
import { NestedWorldScene } from "../src/game/toy-world-scene";
import { districtWalls } from "../src/game/district-world";
import { GROWTH_LEVELS } from "../src/game/growth-stage";
import { beforeAll, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  createGrowthStage,
  footprintOf,
  GrowthProgress,
} from "../src/game/growth-stage";
import {
  DISTRICT_PROFILES,
  districtSpaces,
  type DistrictProfile,
} from "../src/game/district-world";
import { growthVisual } from "../src/game/growth-visuals";
import {
  createGrowthBody,
  growthCollisionBounds,
} from "../src/game/growth-physics";
import { createFloor, updateFloor } from "../src/game/floor";
import { disposeScene } from "../src/game/visuals";
import { createThemeMotion, themeVelocity } from "../src/game/theme-behavior";
const profiles = Object.values(DISTRICT_PROFILES) as DistrictProfile[];
beforeAll(async () => {
  await RAPIER.init();
});
for (const profile of profiles) {
  const stage = profile.stageId,
    ds = createGrowthStage(42, stage),
    spaces = districtSpaces(profile),
    kinds = [...new Set(ds.map((d) => d.districtKind!))];
  it(`${stage}:5空間で対象が変わり、出口正面に巨大目標、全域に街区がある`, () => {
    expect(spaces.map((s) => s.level)).toEqual([1, 4, 7, 9, 11]);
    expect(ds.length).toBeGreaterThan(600);
    expect(kinds.length).toBeGreaterThanOrEqual(20);
    const p = new GrowthProgress(stage);
    for (let level = 1; level < 12; level++) {
      const stock = ds.filter((d) => d.id.startsWith(`growth-${level}-`));
      expect(stock).toHaveLength(24);
      expect(
        new Set(stock.map((d) => d.districtKind)).size,
      ).toBeGreaterThanOrEqual(2);
      stock.slice(0, 12).forEach((d) => p.collect(d));
      expect(p.level).toBe(level + 1);
    }
    const goal = ds.find((d) => d.id === "goal")!;
    expect(goal.x - spaces[3].bounds.maxX).toBeGreaterThan(footprintOf(goal));
    expect(goal.x - spaces[3].bounds.maxX).toBeLessThan(240);
    expect(goal.z).toBe(0);
    expect(goal.size).toEqual(profile.goal.size);
    p.collect(goal);
    expect(p.cleared).toBe(true);
    for (const [sx, sz] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ])
      expect(
        ds.filter(
          (d) =>
            d.id.startsWith("district-city-") &&
            d.x * sx > 500 &&
            d.z * sz > 500,
        ).length,
      ).toBeGreaterThan(20);
  });
  it(`${stage}:1000シードで配置が成立し、経路が壁や内側の空間を横切らない`, () => {
    for (let seed = 0; seed < 1000; seed++) {
      const definitions = createGrowthStage(seed, stage);
      if (new Set(definitions.map((d) => d.id)).size !== definitions.length)
        throw Error(`${seed}:duplicate`);
      for (const d of definitions) {
        const b = spaces[d.area].bounds,
          r = footprintOf(d);
        if (
          d.x - r < b.minX ||
          d.x + r > b.maxX ||
          d.z - r < b.minZ ||
          d.z + r > b.maxZ
        )
          throw Error(`${seed}:${d.id}:outside`);
        if (!d.route) continue;
        const inner = spaces[d.area - 1].bounds;
        for (let i = 0; i < d.route.length; i++)
          for (let step = 0; step <= 8; step++) {
            const a = d.route[i],
              next = d.route[(i + 1) % d.route.length],
              x = a.x + ((next.x - a.x) * step) / 8,
              z = a.z + ((next.z - a.z) * step) / 8;
            if (
              x - r <= b.minX ||
              x + r >= b.maxX ||
              z - r <= b.minZ ||
              z + r >= b.maxZ
            )
              throw Error(`${seed}:${d.id}:route outside`);
            if (
              x > inner.minX - r &&
              x < inner.maxX + r &&
              z > inner.minZ - r &&
              z < inner.maxZ + r
            )
              throw Error(`${seed}:${d.id}:route crosses inner`);
          }
      }
    }
  }, 60000);
  it.each(kinds)(
    `${stage}:%sの見える部品と衝突範囲が一致し、実際に穴へ落下する`,
    (kind) => {
      const d = ds.find((d) => d.districtKind === kind)!,
        q = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(0.51, 0.39, -0.22),
        ),
        mesh = growthVisual(d, stage);
      mesh.quaternion.copy(q);
      mesh.updateMatrixWorld(true);
      const point = new THREE.Vector3();
      let top = -Infinity,
        bottom = Infinity;
      mesh.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const p = o.geometry.getAttribute("position");
        for (let i = 0; i < p.count; i++) {
          point.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
          top = Math.max(top, point.y);
          bottom = Math.min(bottom, point.y);
        }
      });
      const bounds = growthCollisionBounds(d, q, stage),
        tol = Math.max(...d.size) * 1e-4;
      expect(Math.abs(bounds.top - top)).toBeLessThan(tol);
      expect(Math.abs(bounds.bottom - bottom)).toBeLessThan(tol);
      disposeScene(mesh);
      const radius = Math.hypot(...d.size) * 0.6,
        world = new RAPIER.World({
          x: 0,
          y: -9.81 * Math.max(0.25, radius),
          z: 0,
        });
      try {
        const floor = createFloor(world);
        updateFloor(floor, 0, 0, radius, radius * 100);
        const rot = { x: 0, y: 0, z: 0, w: 1 };
        const { body } = createGrowthBody(
          world,
          d,
          {
            x: 0,
            y: -growthCollisionBounds(d, rot, stage).bottom + 0.0005,
            z: 0,
          },
          rot,
          stage,
        );
        for (let step = 0; step < 240; step++) world.step();
        expect(
          body.translation().y +
            growthCollisionBounds(d, body.rotation(), stage).top,
        ).toBeLessThan(0);
      } finally {
        world.free();
      }
    },
  );
  it(`${stage}:経路移動・停止と、落下後の操縦解除を保つ`, () => {
    for (const d of ds.filter((d) => d.route)) {
      const motion = createThemeMotion(d),
        hole = { x: -1e6, z: -1e6, radius: 0.08 };
      themeVelocity(d, motion, d, hole, 1 / 60);
      expect(["driving", "working"]).toContain(motion.phase);
      motion.phase = "falling";
      expect(themeVelocity(d, motion, d, hole, 1 / 60)).toEqual({ x: 0, z: 0 });
    }
  });
}

it.each([
  ["america", "mug", [-0.15, 0, 0]],
  ["america", "construction", [0, 0.22, 0]],
] as const)("%s:%sの空洞に見えない支持面を作らない", (stage, kind, gap) => {
  const d = createGrowthStage(42, stage).find((d) => d.districtKind === kind)!;
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  try {
    const { colliders } = createGrowthBody(
      world,
      { ...d, size: [1, 1, 1] },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0, w: 1 },
      stage,
    );
    expect(
      colliders.some((c) =>
        c.containsPoint({ x: gap[0], y: gap[1], z: gap[2] }),
      ),
    ).toBe(false);
    expect(colliders.length).toBeGreaterThan(1);
  } finally {
    world.free();
  }
});

for (const profile of profiles)
  it.each([0, 1, 2, 3])(
    `${profile.stageId}:境界%sは成長前に止め、成長後に通れる`,
    (area) => {
      const spaces = districtSpaces(profile),
        world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }),
        scene = new NestedWorldScene(world, new Set(), {
          spaces,
          walls: districtWalls(profile),
          roads: [],
          style: profile.stageId,
        });
      try {
        const s = spaces[area],
          gate = s.gate!,
          r = GROWTH_LEVELS[gate.level - 1].radius,
          previous = { x: s.bounds.maxX - r * 1.5, z: 0 };
        scene.update(gate.level - 1, area, { ...previous, radius: r }, 0);
        let at = previous;
        for (let i = 0; i < 40; i++)
          at = scene.constrain(at, { x: at.x + r * 0.1, z: 0 }, r);
        expect(at.x + r).toBeLessThanOrEqual(
          s.bounds.maxX + s.thickness + 0.01,
        );
        for (let i = 0; i < 60; i++)
          scene.update(
            gate.level,
            area + 1,
            { ...previous, radius: r },
            1 / 60,
          );
        at = previous;
        for (let i = 0; i < 40; i++)
          at = scene.constrain(at, { x: at.x + r * 0.1, z: 0 }, r);
        expect(at.x).toBeGreaterThan(s.bounds.maxX);
      } finally {
        disposeScene(scene.group);
        world.free();
      }
    },
  );

it("港のクレーンは吊り荷の実体とケーブル端を同じ位置で上下させる", () => {
  const ds = createGrowthStage(42, "harbor"),
    load = ds.find((d) => d.behavior === "hoist")!,
    crane = ds.find((d) => d.id === load.partnerId)!;
  expect(load.districtKind).toBe("hoistLoad");
  expect(ds.filter((d) => d.id.startsWith("district-stack-"))).toHaveLength(3);
  const position = { x: crane.x, y: crane.size[1] / 2, z: crane.z },
    q = { x: 0, y: 0, z: 0, w: 1 };
  const a = hoistFrame(crane, position, q, load.size[1], 0),
    b = hoistFrame(crane, position, q, load.size[1], 2);
  expect(Math.abs(a.load.y - b.load.y)).toBeGreaterThan(crane.size[1] * 0.1);
  expect(a.anchor.y - a.load.y).toBeGreaterThan(load.size[1]);
  const cable = new HoistCable();
  cable.update(a.anchor, a.load, load.size[1]);
  const points = cable.line.geometry.getAttribute("position");
  expect(points.getY(1)).toBeCloseTo(a.load.y + load.size[1] / 2);
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  try {
    const { body } = createGrowthBody(world, load, a.load, q, "harbor");
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    body.setNextKinematicTranslation(b.load);
    world.step();
    expect(body.translation().y).toBeCloseTo(b.load.y);
    body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    body.setEnabledRotations(true, true, true, true);
    const start = body.translation().y;
    for (let i = 0; i < 120; i++) world.step();
    expect(body.translation().y).toBeLessThan(start - 1);
  } finally {
    world.free();
    disposeScene(cable.line);
  }
});

for (const [stage, kind, gap] of [
  ["harbor", "nut", [0, 0, 0]],
  ["harbor", "pallet", [0.2, -0.2, 0]],
  ["harbor", "crane", [0, 0, 0]],
  ["harbor", "forklift", [0.06, 0.2, 0]],
  ["office", "headOffice", [0.2, -0.35, 0.33]],
] as const)
  if (DISTRICT_PROFILES[stage])
    it(`${stage}:${kind}の見える隙間を不可視の形で埋めない`, () => {
      const d = createGrowthStage(42, stage).find(
          (d) => d.districtKind === kind,
        )!,
        world = new RAPIER.World({ x: 0, y: 0, z: 0 });
      try {
        const { colliders } = createGrowthBody(
          world,
          { ...d, size: [1, 1, 1] },
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 0, w: 1 },
          stage,
        );
        expect(
          colliders.some((c) =>
            c.containsPoint({ x: gap[0], y: gap[1], z: gap[2] }),
          ),
        ).toBe(false);
        expect(colliders.length).toBeGreaterThan(1);
      } finally {
        world.free();
      }
    });
