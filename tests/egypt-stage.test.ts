import { beforeAll, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  createGrowthStage,
  footprintOf,
  clampToArea,
  GROWTH_LEVELS,
} from "../src/game/growth-stage";
import {
  EGYPT_SPACES,
  EGYPT_WALLS,
  EGYPT_ROADS,
  egyptAreaForLevel,
} from "../src/game/egypt-world";
import { insideToyRect } from "../src/game/toy-world";
import { NestedWorldScene } from "../src/game/toy-world-scene";
import { growthVisual } from "../src/game/growth-visuals";
import {
  growthCollisionBounds,
  createGrowthBody,
  growthLosesSupport,
} from "../src/game/growth-physics";
import { createFloor, updateFloor } from "../src/game/floor";
import {
  themeYaw,
  createThemeMotion,
  themeVelocity,
} from "../src/game/theme-behavior";
import { disposeScene } from "../src/game/visuals";
const definitions = createGrowthStage(42, "egypt");
const kinds = [...new Set(definitions.map((d) => d.egyptKind!))];
beforeAll(async () => {
  await RAPIER.init();
});
it("壁画→墓→神殿→街が同じ平面に含まれ、全段階の種類と街の物量がある", () => {
  expect(EGYPT_SPACES.map((s) => s.level)).toEqual([1, 4, 7, 9]);
  expect([1, 3, 4, 6, 7, 8, 9, 12].map(egyptAreaForLevel)).toEqual([
    0, 0, 1, 1, 2, 2, 3, 3,
  ]);
  for (let i = 0; i < 3; i++)
    for (const point of [
      { x: EGYPT_SPACES[i].bounds.minX, z: EGYPT_SPACES[i].bounds.minZ },
      { x: EGYPT_SPACES[i].bounds.maxX, z: EGYPT_SPACES[i].bounds.maxZ },
    ])
      expect(insideToyRect(point, EGYPT_SPACES[i + 1].bounds)).toBe(true);
  expect(kinds.length).toBeGreaterThanOrEqual(20);
  expect(
    definitions.filter((d) => d.id.startsWith("egypt-city-")),
  ).toHaveLength(200);
  for (let level = 1; level <= 11; level++)
    expect(
      definitions.filter((d) => d.id.startsWith(`growth-${level}-`)),
    ).toHaveLength(24);
  const early = definitions.filter((d) => d.level <= 3 && !d.sourceLevel);
  expect(early.filter((d) => d.behavior === "march")).toHaveLength(8);
  for (const d of early.filter((d) => d.egyptKind?.startsWith("mural"))) {
    expect(d.size[2] / Math.max(d.size[0], d.size[1])).toBeLessThan(0.15);
    expect(themeYaw(d, Math.PI / 2)).toBe(0);
  }
});
it("1000シードで配置が完了し、可視の壁・親空間・都市の道路に重ならない", () => {
  for (let seed = 0; seed < 1000; seed++) {
    let ds;
    try {
      ds = createGrowthStage(seed, "egypt");
    } catch (e) {
      throw new Error(`seed ${seed}: ${e}`, { cause: e });
    }
    expect(new Set(ds.map((d) => d.id)).size, `seed ${seed}`).toBe(ds.length);
    for (const d of ds) {
      const r = footprintOf(d);
      expect(
        insideToyRect(d, EGYPT_SPACES[d.area].bounds, r),
        `${seed}:${d.id}`,
      ).toBe(true);
      if (
        d.route ||
        d.id === "goal" ||
        d.id === "landmark" ||
        d.id.startsWith("egypt-column-")
      )
        continue;
      const clearance = Math.min(
        ...EGYPT_WALLS.map(
          (w) =>
            Math.hypot(
              Math.max(0, w.minX - d.x, d.x - w.maxX),
              Math.max(0, w.minZ - d.z, d.z - w.maxZ),
            ) - r,
        ),
      );
      expect(clearance, `${seed}:${d.id}:wall`).toBeGreaterThan(0);
      if (d.area === 3) {
        const roadClearance = Math.min(
          ...EGYPT_ROADS.map(
            (road) =>
              Math.hypot(
                Math.max(0, Math.abs(d.x - road.x) - road.width / 2),
                Math.max(0, Math.abs(d.z - road.z) - road.depth / 2),
              ) - r,
          ),
        );
        expect(roadClearance, `${seed}:${d.id}:road`).toBeGreaterThan(0);
      }
    }
  }
}, 60000);
it.each(kinds)(
  "%s: 傾いた実モデルと衝突範囲が一致し、外形の入る穴へ落下する",
  (kind) => {
    const d = definitions.find((d) => d.egyptKind === kind)!;
    const rotation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0.51, 0.39, -0.22),
    );
    const visual = growthVisual(d, "egypt");
    visual.quaternion.copy(rotation);
    visual.updateMatrixWorld(true);
    let top = -Infinity,
      bottom = Infinity;
    const point = new THREE.Vector3();
    visual.traverse((mesh) => {
      if (!(mesh instanceof THREE.Mesh)) return;
      const positions = mesh.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
        top = Math.max(top, point.y);
        bottom = Math.min(bottom, point.y);
      }
    });
    const bounds = growthCollisionBounds(d, rotation, "egypt"),
      tolerance = Math.max(...d.size) * 1e-5;
    expect(Math.abs(bounds.top - top)).toBeLessThan(tolerance);
    expect(Math.abs(bounds.bottom - bottom)).toBeLessThan(tolerance);
    disposeScene(visual);
    const identity = { x: 0, y: 0, z: 0, w: 1 },
      radius = footprintOf(d) * 1.2;
    const world = new RAPIER.World({
      x: 0,
      y: -9.81 * Math.max(0.25, radius),
      z: 0,
    });
    try {
      const floor = createFloor(world);
      updateFloor(floor, 0, 0, radius, radius * 50);
      const { body } = createGrowthBody(
        world,
        { ...d, behavior: "still" },
        {
          x: 0,
          y: -growthCollisionBounds(d, identity, "egypt").bottom + 0.0005,
          z: 0,
        },
        identity,
        "egypt",
      );
      for (let i = 0; i < 180; i++) world.step();
      expect(
        body.translation().y +
          growthCollisionBounds(d, body.rotation(), "egypt").top,
      ).toBeLessThan(0);
    } finally {
      world.free();
    }
  },
);
it.each(["gateway", "table", "temple"])(
  "%sの通路・脚の間には見えない当たり判定がない",
  (kind) => {
    const d = {
      ...definitions.find((d) => d.egyptKind === kind)!,
      size: [1, 1, 1] as [number, number, number],
    };
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    try {
      const { colliders } = createGrowthBody(
        world,
        d,
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0, w: 1 },
        "egypt",
      );
      expect(colliders.some((c) => c.containsPoint({ x: 0, y: 0, z: 0 }))).toBe(
        false,
      );
    } finally {
      world.free();
    }
  },
);
it.each([0, 1, 2])(
  "空間%sの扉は閉じていると通せず、成長して開くと次へ進める",
  (area) => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const scene = new NestedWorldScene(world, new Set(), {
      spaces: EGYPT_SPACES,
      walls: EGYPT_WALLS,
      roads: EGYPT_ROADS,
      style: "egypt",
    });
    try {
      const space = EGYPT_SPACES[area],
        gate = space.gate!,
        radius = GROWTH_LEVELS[gate.level - 1].radius;
      const previous = { x: space.bounds.maxX - radius * 1.2, z: gate.along };
      scene.update(
        gate.level - 1,
        area,
        { x: previous.x, z: previous.z, radius },
        0,
      );
      const walk = () => {
        let at = { ...previous };
        for (let step = 0; step < 30; step++)
          at = scene.constrain(at, { x: at.x + radius * 0.1, z: at.z }, radius);
        return at.x;
      };
      expect(walk()).toBeLessThan(space.bounds.maxX);
      scene.update(
        gate.level,
        area + 1,
        { x: previous.x, z: previous.z, radius },
        1,
      );
      expect(walk()).toBeGreaterThan(space.bounds.maxX);
      expect(
        clampToArea({ x: 1e5, z: 1e5 }, area, radius, "egypt").x,
      ).toBeLessThan(space.bounds.maxX);
    } finally {
      disposeScene(scene.group);
      world.free();
    }
  },
);

it.each([
  { kind: "muralPerson", point: { x: 0, y: -0.35, z: 0 } },
  { kind: "muralBird", point: { x: 0.08, y: -0.4, z: 0 } },
])("$kind: 凸形状をまとめても脚の隙間を塞がない", ({ kind, point }) => {
  const d = {
    ...definitions.find((d) => d.egyptKind === kind)!,
    size: [1, 1, 1] as [number, number, number],
  };
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  try {
    const { colliders } = createGrowthBody(
      world,
      d,
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0, w: 1 },
      "egypt",
    );
    expect(colliders.some((c) => c.containsPoint(point))).toBe(false);
    expect(colliders.some((c) => c.containsPoint({ x: 0, y: 0, z: 0 }))).toBe(
      true,
    );
    if (kind === "muralPerson") expect(colliders.length).toBeLessThan(50);
  } finally {
    world.free();
  }
});

it("最終ピラミッドは神殿東壁のすぐ外にあり、出口と神殿を塞がない", () => {
  const goal = definitions.find((d) => d.id === "goal")!;
  const temple = EGYPT_SPACES[2];
  const gap = goal.x - goal.size[0] / 2 - temple.bounds.maxX;
  expect(gap).toBeGreaterThan(0);
  expect(gap).toBeLessThan(20);
  expect(goal.z + goal.size[2] / 2).toBeLessThan(
    temple.gate!.along - temple.gate!.width / 2,
  );
  expect(goal.size).toEqual([180, 180, 180]);
});

it.each(["anubis", "horus", "sobek"])(
  "%sは巨大な巡回者で、入る穴から逃げ、落下後は操縦をやめる",
  (kind) => {
    const d = definitions.find((d) => d.egyptKind === kind)!;
    expect(d.area).toBe(3);
    expect(d.size[1]).toBeGreaterThanOrEqual(180);
    expect(d.route).toHaveLength(4);
    const smallHole = { x: d.x - 80, z: d.z, radius: 24 };
    const motion = createThemeMotion(d);
    const walk = themeVelocity(d, motion, d, smallHole, 1 / 60);
    expect(motion.phase).toBe("working");
    expect(Math.hypot(walk.x, walk.z)).toBeGreaterThan(0);
    const largeHole = { ...smallHole, radius: d.level === 12 ? 160 : 48 };
    const flee = themeVelocity(d, motion, d, largeHole, 1 / 60);
    expect(motion.phase).toBe("fleeing");
    expect(
      flee.x * (d.x - largeHole.x) + flee.z * (d.z - largeHole.z),
    ).toBeGreaterThan(0);
    expect(Math.hypot(flee.x, flee.z)).toBeCloseTo(largeHole.radius * 7 * 1.05);
    expect(d.size[2] / d.size[1]).toBeLessThan(0.02);
    expect(themeYaw(d, Math.PI / 2)).toBe(0);
    motion.phase = "falling";
    expect(themeVelocity(d, motion, d, largeHole, 1 / 60)).toEqual({
      x: 0,
      z: 0,
    });
    for (const other of definitions.filter(
      (o) => o.area === 3 && !o.route && o.id !== "goal",
    )) {
      const point = new THREE.Vector3(other.x, 0, other.z);
      const nearest = new THREE.Vector3();
      const distance = Math.min(
        ...d.route!.map((a, i) => {
          const b = d.route![(i + 1) % d.route!.length];
          new THREE.Line3(
            new THREE.Vector3(a.x, 0, a.z),
            new THREE.Vector3(b.x, 0, b.z),
          ).closestPointToPoint(point, true, nearest);
          return nearest.distanceTo(point);
        }),
      );
      expect(
        distance - footprintOf(d) - footprintOf(other),
        `${kind}:${other.id}`,
      ).toBeGreaterThanOrEqual(3.99);
    }
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    try {
      const { colliders } = createGrowthBody(
        world,
        { ...d, size: [1, 1, 1] },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0, w: 1 },
        "egypt",
      );
      expect(
        colliders.some((c) => c.containsPoint({ x: 0.15, y: -0.35, z: 0 })),
      ).toBe(false);
    } finally {
      world.free();
    }
  },
);

it.each(["anubis", "horus", "sobek"])(
  "%sは足が支持されている間は倒れず、実際に沈むと落下する",
  (kind) => {
    const d = definitions.find((d) => d.egyptKind === kind)!;
    const rotation = { x: 0, y: 0, z: 0, w: 1 };
    const y = -growthCollisionBounds(d, rotation, "egypt").bottom;
    const hole = { x: d.x + d.size[0] / 2 + 24 - 0.1, z: d.z, radius: 24 };
    expect(
      growthLosesSupport(d, { x: d.x, y, z: d.z }, rotation, hole, "egypt"),
    ).toBe(false);
    expect(
      growthLosesSupport(
        d,
        { x: d.x, y: y - 0.1, z: d.z },
        rotation,
        hole,
        "egypt",
      ),
    ).toBe(false);
    expect(
      growthLosesSupport(
        d,
        { x: d.x, y: y - 1, z: d.z },
        rotation,
        hole,
        "egypt",
      ),
    ).toBe(true);
    expect(
      growthLosesSupport(
        d,
        { x: d.x, y: y - 1, z: d.z },
        rotation,
        { ...hole, x: d.x + 500 },
        "egypt",
      ),
    ).toBe(false);
    for (const radius of [48, 160]) {
      const world = new RAPIER.World({ x: 0, y: -9.81 * radius, z: 0 });
      try {
        const floor = createFloor(world);
        updateFloor(floor, -3000, 0, radius, 10000);
        const { body } = createGrowthBody(
          world,
          d,
          { x: 0, y: y + 0.0005, z: 0 },
          rotation,
          "egypt",
        );
        for (let tick = 0; tick < 600; tick++) {
          body.setLinvel(
            {
              x: Math.sin(tick / 60) * radius * 7 * 1.05,
              y: body.linvel().y,
              z: Math.cos(tick / 60) * radius * 7 * 1.05,
            },
            true,
          );
          body.setRotation(rotation, true);
          body.setAngvel({ x: 0, y: 0, z: 0 }, true);
          world.step();
          expect(
            growthLosesSupport(
              d,
              body.translation(),
              body.rotation(),
              { x: -3000, z: 0, radius },
              "egypt",
            ),
          ).toBe(false);
          expect(
            Math.abs(body.rotation().x) + Math.abs(body.rotation().z),
          ).toBeLessThan(1e-6);
        }
      } finally {
        world.free();
      }
    }
  },
);
it("神々の逃走は加速と息継ぎがあり、端で巡回位置へ引き戻さず速度を保つ", () => {
  const d = definitions.find((d) => d.egyptKind === "anubis")!;
  const motion = createThemeMotion(d);
  const hole = { x: d.x - 150, z: d.z, radius: 48 };
  const burst = themeVelocity(d, motion, d, hole, 1 / 60);
  expect(motion.phase).toBe("fleeing");
  expect(Math.hypot(burst.x, burst.z)).toBeGreaterThan(hole.radius * 7);
  motion.fleeTime = 3;
  const recovery = themeVelocity(d, motion, d, hole, 1 / 60);
  expect(Math.hypot(recovery.x, recovery.z)).toBeCloseTo(
    hole.radius * 7 * 0.78,
  );
  motion.fleeTime = 0;
  const edge = { x: 1550, z: 1550 };
  const escape = themeVelocity(
    d,
    motion,
    edge,
    { x: 1450, z: 1450, radius: 48 },
    1 / 60,
  );
  expect(edge.x + escape.x / 20 + footprintOf(d)).toBeLessThan(1600);
  expect(edge.z + escape.z / 20 + footprintOf(d)).toBeLessThan(1600);
  expect(Math.hypot(escape.x, escape.z)).toBeCloseTo(hole.radius * 7 * 1.05);
});

it("神以外の動く物は、従来通り穴の縁に掛かると姿勢を解放する", () => {
  const d = createGrowthStage(42, "toys").find((d) => d.id === "hero")!;
  const rotation = { x: 0, y: 0, z: 0, w: 1 };
  const y = -growthCollisionBounds(d, rotation, "toys").bottom;
  expect(
    growthLosesSupport(
      d,
      { x: d.x, y, z: d.z },
      rotation,
      { x: d.x + d.size[0] / 2 + 1, z: d.z, radius: 3 },
      "toys",
    ),
  ).toBe(true);
});
