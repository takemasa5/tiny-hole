import { beforeAll, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  createGrowthStage,
  GROWTH_LEVELS,
  GrowthProgress,
  footprintOf,
} from "../src/game/growth-stage";
import {
  PLAZA_SPACES,
  PLAZA_WALLS,
  plazaAreaForLevel,
} from "../src/game/plaza-world";
import { createThemeMotion, themeVelocity } from "../src/game/theme-behavior";
import { growthVisual } from "../src/game/growth-visuals";
import {
  createGrowthBody,
  growthCollisionBounds,
} from "../src/game/growth-physics";
import { createFloor, updateFloor } from "../src/game/floor";
import { disposeScene } from "../src/game/visuals";
import { NestedWorldScene } from "../src/game/toy-world-scene";
const definitions = createGrowthStage(42, "plaza");
const kinds = [...new Set(definitions.map((d) => d.plazaKind!))];
beforeAll(async () => {
  await RAPIER.init();
});
it("花壇から5空間へ広がり、各段階の対象が変わり、記念塔が出口正面に立つ", () => {
  expect(PLAZA_SPACES.map((s) => s.level)).toEqual([1, 4, 7, 9, 11]);
  expect(kinds).toHaveLength(23);
  expect(definitions.length).toBeGreaterThan(600);
  for (let level = 1; level < 12; level++) {
    const stock = definitions.filter((d) =>
      d.id.startsWith(`growth-${level}-`),
    );
    expect(stock).toHaveLength(24);
    expect(new Set(stock.map((d) => d.plazaKind)).size).toBeGreaterThanOrEqual(
      2,
    );
  }
  const goal = definitions.find((d) => d.id === "goal")!;
  expect(goal.x - PLAZA_SPACES[3].bounds.maxX).toBeGreaterThan(
    footprintOf(goal),
  );
  expect(goal.x - PLAZA_SPACES[3].bounds.maxX).toBeLessThan(240);
  expect(goal.z).toBe(0);
  expect(goal.size[1]).toBe(540);
  const blocks = new Set(
    definitions
      .filter((d) => d.id.startsWith("plaza-city-"))
      .map((d) => d.id.split("-").slice(2, 4).join("-")),
  );
  expect(blocks.size).toBeGreaterThanOrEqual(24);
  for (const [sx, sz] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ])
    expect(
      definitions.filter(
        (d) =>
          d.id.startsWith("plaza-city-") && d.x * sx > 500 && d.z * sz > 500,
      ).length,
    ).toBeGreaterThan(20);
});
it("静止物だけでも全12段階まで進み、実際の回収でクリアできる", () => {
  const p = new GrowthProgress("plaza");
  for (let level = 1; level < 12; level++) {
    for (const d of definitions
      .filter((d) => d.id.startsWith(`growth-${level}-`))
      .slice(0, 12))
      p.collect(d);
    expect(p.level).toBe(level + 1);
  }
  p.collect(definitions.find((d) => d.id === "goal")!);
  expect(p.cleared).toBe(true);
});
it("1000シードで壁・道路と在庫の配置が成立し、散歩・配送の経路が内側の空間を横切らない", () => {
  for (let seed = 0; seed < 1000; seed++) {
    const ds = createGrowthStage(seed, "plaza");
    if (ds.length !== new Set(ds.map((d) => d.id)).size)
      throw new Error(`seed ${seed}: duplicate`);
    for (const d of ds) {
      const b = PLAZA_SPACES[d.area].bounds,
        r = footprintOf(d);
      if (
        d.x - r < b.minX ||
        d.x + r > b.maxX ||
        d.z - r < b.minZ ||
        d.z + r > b.maxZ
      )
        throw new Error(`${seed}:${d.id}: outside`);
      if (!d.route) continue;
      const inner = PLAZA_SPACES[d.area - 1].bounds;
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
            throw new Error(`${seed}:${d.id}: route outside`);
          if (
            x > inner.minX - r &&
            x < inner.maxX + r &&
            z > inner.minZ - r &&
            z < inner.maxZ + r
          )
            throw new Error(`${seed}:${d.id}: crosses previous space`);
        }
    }
  }
}, 60000);
it.each(kinds)("%sの見える実形状と衝突範囲が一致し、穴へ落下できる", (kind) => {
  const d = definitions.find((d) => d.plazaKind === kind)!,
    rot = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0.51, 0.39, -0.22),
    ),
    mesh = growthVisual(d, "plaza");
  mesh.quaternion.copy(rot);
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
  const b = growthCollisionBounds(d, rot, "plaza"),
    tolerance = Math.max(...d.size) * 1e-4;
  expect(Math.abs(b.top - top)).toBeLessThan(tolerance);
  expect(Math.abs(b.bottom - bottom)).toBeLessThan(tolerance);
  disposeScene(mesh);
  const radius = Math.hypot(...d.size) * 0.6,
    world = new RAPIER.World({ x: 0, y: -9.81 * Math.max(0.25, radius), z: 0 });
  try {
    const floor = createFloor(world);
    updateFloor(floor, 0, 0, radius, radius * 100);
    const q = { x: 0, y: 0, z: 0, w: 1 };
    const { body } = createGrowthBody(
      world,
      d,
      { x: 0, y: -growthCollisionBounds(d, q, "plaza").bottom + 0.0005, z: 0 },
      q,
      "plaza",
    );
    for (let step = 0; step < 240; step++) world.step();
    expect(
      body.translation().y +
        growthCollisionBounds(d, body.rotation(), "plaza").top,
    ).toBeLessThan(0);
  } finally {
    world.free();
  }
});
it.each(["bucket", "swing", "stall", "monument"])(
  "%sの中空部を見えない箱で塞がない",
  (kind) => {
    const d = {
        ...definitions.find((d) => d.plazaKind === kind)!,
        size: [1, 1, 1] as [number, number, number],
      },
      world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    try {
      const { colliders } = createGrowthBody(
        world,
        d,
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0, w: 1 },
        "plaza",
      );
      expect(
        colliders.some((c) =>
          c.containsPoint({
            x: 0,
            y: kind === "monument" || kind === "stall" ? -0.25 : 0.1,
            z: 0,
          }),
        ),
      ).toBe(false);
    } finally {
      world.free();
    }
  },
);
it.each(["person", "van"])(
  "%sは散歩・配送経路を進み、到着して待ち、落下後は動かない",
  (kind) => {
    const d = definitions.find((d) => d.plazaKind === kind && d.route)!,
      m = createThemeMotion(d),
      p = { x: d.x, z: d.z },
      hole = { x: -10000, z: -10000, radius: 0.08 };
    const v = themeVelocity(d, m, p, hole, 1 / 60);
    expect(Math.hypot(v.x, v.z)).toBeGreaterThan(0);
    expect(m.phase).toBe(kind === "van" ? "driving" : "working");
    themeVelocity(d, m, d.route![m.waypoint], hole, 1 / 60);
    expect(m.phase).toBe("waiting");
    expect(m.wait).toBeGreaterThan(0);
    expect(themeVelocity(d, m, p, hole, 1 / 60)).toEqual({ x: 0, z: 0 });
    m.phase = "falling";
    expect(themeVelocity(d, m, p, hole, 1 / 60)).toEqual({ x: 0, z: 0 });
  },
);
it.each([0, 1, 2, 3])("境界%sは成長まで止め、成長後は門を通せる", (area) => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }),
    scene = new NestedWorldScene(world, new Set(), {
      spaces: PLAZA_SPACES,
      walls: PLAZA_WALLS,
      roads: [],
      style: "plaza",
    });
  try {
    const s = PLAZA_SPACES[area],
      gate = s.gate!,
      r = GROWTH_LEVELS[gate.level - 1].radius,
      previous = { x: s.bounds.maxX - r * 1.5, z: 0 };
    scene.update(gate.level - 1, area, { ...previous, radius: r }, 0);
    let at = previous;
    for (let i = 0; i < 40; i++)
      at = scene.constrain(at, { x: at.x + r * 0.1, z: 0 }, r);
    expect(at.x + r).toBeLessThanOrEqual(s.bounds.maxX + s.thickness + 0.01);
    for (let i = 0; i < 60; i++)
      scene.update(gate.level, area + 1, { ...previous, radius: r }, 1 / 60);
    at = previous;
    for (let i = 0; i < 40; i++)
      at = scene.constrain(at, { x: at.x + r * 0.1, z: 0 }, r);
    expect(at.x).toBeGreaterThan(s.bounds.maxX);
    expect(plazaAreaForLevel(gate.level)).toBe(area + 1);
  } finally {
    disposeScene(scene.group);
    world.free();
  }
});
it("柵の支柱には衝突し、支柱と横桟の間の空間は空いている", () => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }),
    scene = new NestedWorldScene(world, new Set(), {
      spaces: PLAZA_SPACES,
      walls: PLAZA_WALLS,
      roads: [],
      style: "plaza",
    });
  try {
    world.step();
    const s = PLAZA_SPACES[1],
      length = s.bounds.maxX - s.bounds.minX,
      count = Math.ceil(length / (s.height * 0.75)),
      postX = s.bounds.minX + s.thickness / 2,
      mid = postX + (length - s.thickness) / count / 2;
    const cast = (x: number) =>
      world.castRay(
        new RAPIER.Ray(
          { x, y: s.height * 0.5, z: s.bounds.minZ - 1 },
          { x: 0, y: 0, z: 1 },
        ),
        2,
        true,
      );
    expect(cast(postX)).not.toBeNull();
    expect(cast(mid)).toBeNull();
  } finally {
    disposeScene(scene.group);
    world.free();
  }
});
