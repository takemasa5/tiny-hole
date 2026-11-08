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
  HELL_SPACES,
  HELL_WALLS,
  hellAreaForLevel,
  isHellActor,
} from "../src/game/hell-world";
import { createThemeMotion, themeVelocity } from "../src/game/theme-behavior";
import { growthVisual } from "../src/game/growth-visuals";
import {
  growthCollisionBounds,
  createGrowthBody,
  growthLosesSupport,
} from "../src/game/growth-physics";
import { createFloor, updateFloor } from "../src/game/floor";
import { disposeScene } from "../src/game/visuals";
import { NestedWorldScene } from "../src/game/toy-world-scene";
const definitions = createGrowthStage(42, "hell");
const kinds = [...new Set(definitions.map((d) => d.hellKind!))];
beforeAll(async () => {
  await RAPIER.init();
});
it("6つの世界と各段階の捕獲対象があり、巨大な閻魔が走る", () => {
  expect(HELL_SPACES.map((s) => s.level)).toEqual([1, 3, 5, 7, 9, 12]);
  expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12].map(hellAreaForLevel)).toEqual([
    0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5,
  ]);
  for (let level = 1; level <= 11; level++) {
    const stock = definitions.filter((d) =>
      d.id.startsWith(`growth-${level}-`),
    );
    expect(stock).toHaveLength(level <= 2 ? 24 : 16);
    expect(
      stock.every((d) =>
        level <= 2
          ? d.hellKind === "pebble" && d.behavior === "still"
          : isHellActor(d) && d.behavior === "work",
      ),
    ).toBe(true);
  }
  const goal = definitions.find((d) => d.id === "goal")!;
  expect(goal.hellKind).toBe("enma");
  expect(goal.behavior).toBe("work");
  expect(goal.size[1]).toBeGreaterThan(400);
  expect(footprintOf(goal)).toBeLessThan(160);
  expect(
    definitions.filter((d) => d.id.startsWith("hell-scenery-")),
  ).toHaveLength(180);
});
it("静止物では小鬼以降へ成長せず、捕獲で全12段階からクリアできる", () => {
  const p = new GrowthProgress("hell");
  for (let i = 0; i < 100; i++)
    p.collect({ id: `static-${i}`, value: 4 ** 11 });
  expect(p.level).toBe(3);
  expect(p.score).toBe(60);
  for (let level = 3; level <= 11; level++) {
    for (const d of definitions
      .filter((d) => d.id.startsWith(`growth-${level}-`))
      .slice(0, 4))
      expect(p.collect(d)).toBe(true);
    expect(p.level).toBe(level + 1);
    const score = p.score;
    p.collect({ id: `world-${level}`, value: 4 ** 11 });
    expect(p.score).toBe(score);
  }
  expect(p.collect(definitions.find((d) => d.id === "goal")!)).toBe(true);
  expect(p.cleared).toBe(true);
  expect(p.collect(definitions.find((d) => d.id === "goal")!)).toBe(false);
});
it("1000シードで生成でき、対象と巡回路が壁・内側の空間を横切らない", () => {
  for (let seed = 0; seed < 1000; seed++) {
    let ds;
    try {
      ds = createGrowthStage(seed, "hell");
    } catch (e) {
      throw new Error(`seed ${seed}`, { cause: e });
    }
    if (new Set(ds.map((d) => d.id)).size !== ds.length)
      throw new Error(`duplicate seed ${seed}`);
    for (const d of ds) {
      if (d.id.startsWith("hell-landmark-")) continue;
      const b = HELL_SPACES[d.area].bounds,
        r = footprintOf(d);
      const inside = (x: number, z: number) =>
        x - r > b.minX && x + r < b.maxX && z - r > b.minZ && z + r < b.maxZ;
      if (!inside(d.x, d.z)) throw new Error(`${seed}:${d.id}:outside`);
      if (!d.route) continue;
      const inner = HELL_SPACES[d.area - 1].bounds;
      for (let i = 0; i < d.route.length; i++) {
        const a = d.route[i],
          c = d.route[(i + 1) % d.route.length];
        for (let j = 0; j <= 8; j++) {
          const t = j / 8,
            x = a.x + (c.x - a.x) * t,
            z = a.z + (c.z - a.z) * t;
          if (
            !inside(x, z) ||
            Math.hypot(
              Math.max(0, inner.minX - x, x - inner.maxX),
              Math.max(0, inner.minZ - z, z - inner.maxZ),
            ) <= r
          )
            throw new Error(`${seed}:${d.id}:route ${i} crosses boundary`);
        }
      }
    }
  }
}, 60000);
it.each(kinds)("%sの実形状と衝突範囲が合い、穴へ物理落下する", (kind) => {
  const d = definitions.find((d) => d.hellKind === kind)!,
    rot = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0.51, 0.39, -0.22),
    );
  const mesh = growthVisual(d, "hell");
  mesh.quaternion.copy(rot);
  mesh.updateMatrixWorld(true);
  let top = -Infinity,
    bottom = Infinity;
  const point = new THREE.Vector3();
  mesh.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const p = o.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      point.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      top = Math.max(top, point.y);
      bottom = Math.min(bottom, point.y);
    }
  });
  const bounds = growthCollisionBounds(d, rot, "hell"),
    tolerance = Math.max(...d.size) * 1e-4;
  expect(Math.abs(bounds.top - top)).toBeLessThan(tolerance);
  expect(Math.abs(bounds.bottom - bottom)).toBeLessThan(tolerance);
  disposeScene(mesh);
  const radius = footprintOf(d) * 1.2,
    world = new RAPIER.World({ x: 0, y: -9.81 * Math.max(0.25, radius), z: 0 });
  try {
    const floor = createFloor(world);
    updateFloor(floor, 0, 0, radius, radius * 100);
    const identity = { x: 0, y: 0, z: 0, w: 1 };
    const { body } = createGrowthBody(
      world,
      d,
      {
        x: 0,
        y: -growthCollisionBounds(d, identity, "hell").bottom + 0.0005,
        z: 0,
      },
      identity,
      "hell",
    );
    for (let step = 0; step < 240; step++) world.step();
    expect(
      body.translation().y +
        growthCollisionBounds(d, body.rotation(), "hell").top,
    ).toBeLessThan(0);
  } finally {
    world.free();
  }
});
it.each(["smallOni", "ghost", "redOni", "blueOni", "enma"])(
  "%sは小さい穴を避けず、速く逃げ、落下時は行動を止める",
  (kind) => {
    const d = definitions.find((d) => d.hellKind === kind)!,
      m = createThemeMotion(d),
      r = GROWTH_LEVELS[d.level - 1].radius;
    const p = { x: d.x, z: d.z },
      small = { x: d.x - r * 2, z: d.z, radius: r * 0.4 };
    const walk = themeVelocity(d, m, p, small, 1 / 60);
    expect(m.phase).toBe("working");
    expect(Math.hypot(walk.x, walk.z)).toBeGreaterThan(r);
    const hole = { ...small, radius: r };
    const flee = themeVelocity(d, m, p, hole, 1 / 60);
    expect(m.phase).toBe("fleeing");
    expect(Math.hypot(flee.x, flee.z)).toBeGreaterThanOrEqual(r * 7 * 0.8);
    const edge = HELL_SPACES[d.area].bounds;
    expect(p.x + flee.x / 20 + footprintOf(d)).toBeLessThan(edge.maxX);
    expect(p.z + flee.z / 20 + footprintOf(d)).toBeLessThan(edge.maxZ);
    m.phase = "falling";
    expect(themeVelocity(d, m, p, hole, 1 / 60)).toEqual({ x: 0, z: 0 });
    const q = { x: 0, y: 0, z: 0, w: 1 },
      y = -growthCollisionBounds(d, q, "hell").bottom;
    expect(growthLosesSupport(d, { x: d.x, y, z: d.z }, q, hole, "hell")).toBe(
      false,
    );
    expect(
      growthLosesSupport(
        d,
        { x: d.x, y: y - r * 0.1, z: d.z },
        q,
        { ...hole, x: d.x },
        "hell",
      ),
    ).toBe(true);
  },
);
it.each([
  ["smallOni", 2.16, 0.945, 0.585, 2],
  ["redOni", 1.8, 0.972, 0.54, 2.5],
  ["blueOni", 1.44, 0.9, 0.648, 3.5],
] as const)(
  "%sは巡回・逃走とも10％減速し、ダッシュ中も穴に追いつかれる",
  (kind, walkRatio, burstRatio, recoveryRatio, recoveryTime) => {
    const d = definitions.find((d) => d.hellKind === kind)!,
      r = GROWTH_LEVELS[d.level - 1].radius,
      p = { x: d.x, z: d.z },
      hole = { x: d.x - r * 2, z: d.z, radius: r },
      delta = 1 / 60;
    const walking = themeVelocity(
      d,
      createThemeMotion(d),
      p,
      { ...hole, radius: r * 0.4 },
      delta,
    );
    expect(Math.hypot(walking.x, walking.z)).toBeCloseTo(r * walkRatio);
    for (const [time, ratio] of [
      [0, burstRatio],
      [recoveryTime, recoveryRatio],
    ]) {
      const motion = createThemeMotion(d);
      motion.fleeTime = time;
      const velocity = themeVelocity(d, motion, p, hole, delta);
      expect(motion.phase).toBe("fleeing");
      expect(Math.hypot(velocity.x, velocity.z)).toBeCloseTo(r * 7 * ratio);
      expect(Math.hypot(velocity.x, velocity.z)).toBeLessThan(r * 7);
    }
  },
);
it.each(["smallOni", "redOni", "blueOni"])(
  "%sは穴をまたいでも90度/秒を超える急旋回をせず、壁際では曲がるまで止まる",
  (kind) => {
    const d = definitions.find((d) => d.hellKind === kind)!,
      r = GROWTH_LEVELS[d.level - 1].radius,
      p = { x: d.x, z: d.z },
      delta = 1 / 60,
      motion = createThemeMotion(d);
    motion.heading = -Math.PI / 2;
    const hole = { x: p.x - r * 2, z: p.z, radius: r };
    for (let frame = 0; frame < 60; frame++) {
      const previous = motion.heading;
      themeVelocity(d, motion, p, hole, delta);
      const turn = Math.atan2(
        Math.sin(motion.heading - previous),
        Math.cos(motion.heading - previous),
      );
      expect(Math.abs(turn)).toBeLessThanOrEqual((Math.PI / 2) * delta + 1e-9);
    }
    const wall = HELL_SPACES[d.area];
    const atWall = {
      x: wall.bounds.maxX - footprintOf(d) - wall.thickness / 2 - 0.021,
      z: 0,
    };
    motion.heading = Math.PI / 2;
    const velocity = themeVelocity(
      d,
      motion,
      atWall,
      { x: atWall.x - r * 2, z: 0, radius: r },
      delta,
    );
    expect(velocity).toEqual({ x: 0, z: 0 });
    expect(Math.abs(motion.heading - Math.PI / 2)).toBeLessThanOrEqual(
      (Math.PI / 2) * delta + 1e-9,
    );
  },
);
it.each(["smallOni", "redOni", "blueOni"])(
  "%sを先読みせず追う穴が実際の物理演算で捕まえて落とせる",
  (kind) => {
    const d = definitions.find((d) => d.hellKind === kind)!,
      r = GROWTH_LEVELS[d.level - 1].radius,
      world = new RAPIER.World({ x: 0, y: -9.81 * Math.max(0.25, r), z: 0 });
    try {
      const floor = createFloor(world),
        rotation = { x: 0, y: 0, z: 0, w: 1 },
        motion = createThemeMotion(d),
        hole = { x: d.x - r * 2, z: d.z, radius: r },
        delta = 1 / 60;
      const { body } = createGrowthBody(
        world,
        d,
        {
          x: d.x,
          y: -growthCollisionBounds(d, rotation, "hell").bottom + 0.0005,
          z: d.z,
        },
        rotation,
        "hell",
      );
      let aim = { x: d.x, z: d.z },
        falling = false,
        caught = false;
      for (let frame = 0; frame < 60 * 20; frame++) {
        const at = body.translation();
        // Refresh the chase direction every 150ms without predicting the target's next turn.
        if (frame % 9 === 0) aim = { x: at.x, z: at.z };
        const dx = aim.x - hole.x,
          dz = aim.z - hole.z,
          distance = Math.hypot(dx, dz),
          step = Math.min(distance, r * 7 * delta);
        if (distance > 0) {
          hole.x += (dx / distance) * step;
          hole.z += (dz / distance) * step;
        }
        updateFloor(floor, hole.x, hole.z, r, r * 1000);
        if (
          !falling &&
          growthLosesSupport(d, at, body.rotation(), hole, "hell")
        ) {
          falling = true;
          motion.phase = "falling";
          body.setEnabledRotations(true, true, true, true);
        }
        if (!falling) {
          const velocity = themeVelocity(d, motion, at, hole, delta);
          body.setLinvel({ ...velocity, y: body.linvel().y }, true);
          body.setAngvel({ x: 0, y: 0, z: 0 }, true);
          body.setRotation(
            {
              x: 0,
              y: Math.sin(motion.heading / 2),
              z: 0,
              w: Math.cos(motion.heading / 2),
            },
            true,
          );
        }
        world.step();
        if (
          body.translation().y +
            growthCollisionBounds(d, body.rotation(), "hell").top <
          0
        ) {
          caught = true;
          break;
        }
      }
      expect(falling).toBe(true);
      expect(
        caught,
        JSON.stringify({
          at: body.translation(),
          hole,
          rotation: body.rotation(),
          top: growthCollisionBounds(d, body.rotation(), "hell").top,
        }),
      ).toBe(true);
    } finally {
      world.free();
    }
  },
);
it.each(["smallOni", "redOni", "blueOni"])(
  "%sは足場が減ると減速し、穴に完全に収まると自力移動だけを止める",
  (kind) => {
    const d = definitions.find((d) => d.hellKind === kind)!,
      r = GROWTH_LEVELS[d.level - 1].radius,
      p = { x: d.x, z: d.z },
      delta = 1 / 60;
    const atDistance = (distance: number) => {
      const motion = createThemeMotion(d);
      const velocity = themeVelocity(
        d,
        motion,
        p,
        { x: p.x - distance, z: p.z, radius: r },
        delta,
      );
      expect(motion.phase).toBe("fleeing");
      return Math.hypot(velocity.x, velocity.z);
    };
    expect(atDistance(r)).toBeCloseTo(atDistance(r * 2) * 0.5);
    expect(atDistance((r - footprintOf(d)) * 0.5)).toBe(0);
  },
);
it.each(["torii", "palace", "cauldron"])(
  "%sの見えている空間を箱型判定で塞がない",
  (kind) => {
    const d = {
        ...definitions.find((d) => d.hellKind === kind)!,
        size: [1, 1, 1] as [number, number, number],
      },
      world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    try {
      const { colliders } = createGrowthBody(
        world,
        d,
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0, w: 1 },
        "hell",
      );
      expect(
        colliders.some((c) =>
          c.containsPoint({ x: 0, y: kind === "cauldron" ? 0.1 : 0, z: 0 }),
        ),
      ).toBe(false);
    } finally {
      world.free();
    }
  },
);
it.each([0, 1, 2, 3, 4])(
  "空間%sは低レベルでは壁で止まり、成長後は門が開く",
  (area) => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const scene = new NestedWorldScene(world, new Set(), {
      spaces: HELL_SPACES,
      walls: HELL_WALLS,
      roads: [],
      style: "hell",
    });
    try {
      const s = HELL_SPACES[area],
        gate = s.gate!,
        r = GROWTH_LEVELS[gate.level - 1].radius;
      const previous = { x: s.bounds.maxX - r * 1.5, z: 0 };
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
    } finally {
      disposeScene(scene.group);
      world.free();
    }
  },
);
