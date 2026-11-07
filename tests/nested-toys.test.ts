import { beforeAll, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  createGrowthStage,
  GROWTH_LEVELS,
  footprintOf,
  GrowthProgress,
} from "../src/game/growth-stage";
import {
  TOY_SPACES,
  TOY_CITY_ROADS,
  TOY_CITY_COLUMNS,
  TOY_CITY_ROWS,
  toyAreaForLevel,
  toyBlockingWalls,
  constrainToyStep,
  insideToyRect,
} from "../src/game/toy-world";
import { ToyWorldScene } from "../src/game/toy-world-scene";
import { createFloor, updateFloor } from "../src/game/floor";
import { growthVisual } from "../src/game/growth-visuals";
import { GrowthScenery } from "../src/game/growth-visuals";
import { disposeScene } from "../src/game/visuals";
import {
  createThemeMotion,
  vehicleBlocksRoute,
} from "../src/game/theme-behavior";
beforeAll(async () => {
  await RAPIER.init();
});

it("列車は有効化した地点から次の経路点へ向き、横の列車を前方と誤認しない", () => {
  const trains = createGrowthStage(42, "toys").filter(
    (d) => d.behavior === "train",
  );
  const train = trains.find((d) => d.id === "growth-6-3")!;
  const motion = createThemeMotion(train);
  const target = train.route![motion.waypoint];
  expect(motion.heading).toBe(
    Math.atan2(target.x - train.x, target.z - train.z),
  );
  expect(
    vehicleBlocksRoute(train, Math.PI, { x: 3, z: 29 }, train, {
      x: 4.7,
      z: 28.99,
    }),
  ).toBe(false);
  expect(
    vehicleBlocksRoute(train, Math.PI, { x: 3, z: 29 }, train, {
      x: 3,
      z: 27.5,
    }),
  ).toBe(true);
  expect(
    vehicleBlocksRoute(train, Math.PI, { x: 3, z: 29 }, train, {
      x: 3,
      z: 30.5,
    }),
  ).toBe(false);
});

it.each([0, 1, 2, 3])(
  "開放済みの空間%sで入口より成長しても閉じ込めない",
  (area) => {
    const radius = TOY_SPACES[area].gate!.width * 0.6;
    expect(toyBlockingWalls(area, radius).some((w) => w.space === area)).toBe(
      true,
    );
    expect(
      toyBlockingWalls(area + 1, radius).some((w) => w.space === area),
    ).toBe(false);
  },
);

it("子供部屋の線路と道路は部屋の床より後に描画し、本はカウンターに積む", () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const room = new ToyWorldScene(world, new Set());
  const definitions = createGrowthStage(42, "toys");
  const scenery = new GrowthScenery(definitions, "toys");
  const planes = (root: THREE.Group) =>
    root.children.filter(
      (child): child is THREE.Mesh =>
        child instanceof THREE.Mesh &&
        child.geometry instanceof THREE.PlaneGeometry,
    );
  expect(
    Math.min(...planes(scenery.group).map((mesh) => mesh.renderOrder)),
  ).toBeGreaterThan(room.group.getObjectByName("bedroom-floor")!.renderOrder);
  for (const d of definitions.filter(
    (d) => d.area === 3 && d.toyKind === "bookStack",
  )) {
    expect(d.stackY).toBeGreaterThanOrEqual(8);
    expect(d.x - d.size[0] / 2).toBeGreaterThan(47.5);
    expect(d.x + d.size[0] / 2).toBeLessThan(72.5);
  }
  disposeScene(room.group);
  disposeScene(scenery.group);
  world.free();
});

it("小物箱→おもちゃ箱→子供部屋→家→街が同じ座標上に入れ子で残る", () => {
  expect(TOY_SPACES.map((s) => s.level)).toEqual([1, 3, 5, 7, 9]);
  for (let index = 0; index < 4; index++) {
    const b = TOY_SPACES[index].bounds,
      parent = TOY_SPACES[index + 1].bounds;
    expect(insideToyRect({ x: b.minX, z: b.minZ }, parent)).toBe(true);
    expect(insideToyRect({ x: b.maxX, z: b.maxZ }, parent)).toBe(true);
  }
  expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 12].map(toyAreaForLevel)).toEqual([
    0, 0, 1, 1, 2, 2, 3, 3, 4, 4,
  ]);
});

it.each([0, 1, 2, 3])(
  "空間%sは壁・閉じた出口で止まり、開いた出口だけを通れる",
  (area) => {
    const space = TOY_SPACES[area],
      gate = space.gate!,
      radius = GROWTH_LEVELS[gate.level - 1].radius;
    const east = gate.side === "east",
      boundary = east ? space.bounds.maxX : space.bounds.maxZ;
    const approach = {
      x: east ? boundary - radius * 1.5 : gate.along,
      z: east ? gate.along : boundary - radius * 1.5,
    };
    const walk = (opened: number, offset = 0) => {
      let position = {
        x: approach.x + (east ? 0 : offset),
        z: approach.z + (east ? offset : 0),
      };
      for (let step = 0; step < 35; step++)
        position = constrainToyStep(
          position,
          {
            x: position.x + (east ? radius * 0.1 : 0),
            z: position.z + (east ? 0 : radius * 0.1),
          },
          radius,
          toyBlockingWalls(opened, radius),
        );
      return east ? position.x : position.z;
    };
    expect(walk(area)).toBeLessThan(boundary);
    expect(walk(area + 1)).toBeGreaterThan(boundary + radius);
    const opposite = east ? space.bounds.minX : space.bounds.minZ;
    let position = {
      x: east ? opposite + radius * 1.5 : gate.along,
      z: east ? gate.along : opposite + radius * 1.5,
    };
    for (let step = 0; step < 35; step++)
      position = constrainToyStep(
        position,
        {
          x: position.x - (east ? radius * 0.1 : 0),
          z: position.z - (east ? 0 : radius * 0.1),
        },
        radius,
        toyBlockingWalls(area + 1, radius),
      );
    expect(east ? position.x : position.z).toBeGreaterThan(opposite);
  },
);

it("1000シードで配置が完了し、箱の小物はばらばらの向きで積まれ、各空間に収まる", () => {
  for (let seed = 0; seed < 1000; seed++) {
    const definitions = createGrowthStage(seed, "toys");
    const small = definitions.filter(
      (d) => d.id.startsWith("growth-") && d.area < 2,
    );
    expect(small.some((d) => (d.stackY ?? 0) > 0)).toBe(true);
    expect(new Set(small.map((d) => d.yaw)).size).toBeGreaterThan(20);
    for (const d of definitions.filter(
      (d) =>
        (d.id.startsWith("growth-") || d.id.startsWith("city-block-")) &&
        !d.route,
    )) {
      expect(insideToyRect(d, TOY_SPACES[d.area].bounds, footprintOf(d))).toBe(
        true,
      );
      if (d.area === 4) {
        const clearance = Math.min(
          ...TOY_CITY_ROADS.map((road) => {
            const dx = Math.max(0, Math.abs(d.x - road.x) - road.width / 2);
            const dz = Math.max(0, Math.abs(d.z - road.z) - road.depth / 2);
            return Math.hypot(dx, dz) - footprintOf(d);
          }),
        );
        expect(clearance, `${seed}: ${d.id}`).toBeGreaterThan(0);
      }
    }
  }
}, 60000);

it("部屋に入った時点では机・ベッドを飲み込めず、最終目標と巨大物は以前より大きい", () => {
  const definitions = createGrowthStage(42, "toys");
  for (const id of ["room-bed", "room-desk"]) {
    const d = definitions.find((d) => d.id === id)!;
    expect(footprintOf(d)).toBeGreaterThan(GROWTH_LEVELS[4].radius * 5);
  }
  expect(
    definitions.find((d) => d.id === "hero")!.size[1],
  ).toBeGreaterThanOrEqual(180);
  expect(
    definitions.find((d) => d.id === "monster")!.size[1],
  ).toBeGreaterThanOrEqual(180);
  const goal = definitions.find((d) => d.id === "goal")!;
  expect(goal.size[1]).toBe(700);
  expect(footprintOf(goal)).toBeLessThan(160 * 0.9);
  const mesh = growthVisual(goal, "toys");
  mesh.updateMatrixWorld(true);
  const size = new THREE.Box3()
    .setFromObject(mesh)
    .getSize(new THREE.Vector3());
  expect(size.y).toBeCloseTo(700, 1);
  disposeScene(mesh);
});

it("穴が箱全体を覆うと、壁は実際の物理で落下し一度だけ回収される", () => {
  const world = new RAPIER.World({ x: 0, y: -14.715, z: 0 });
  const below = new Set<number>();
  const floor = createFloor(world);
  updateFloor(floor, 0, 0, 1.5, 120);
  const scene = new ToyWorldScene(world, below);
  const progress = new GrowthProgress();
  let count = 0;
  try {
    for (let frame = 0; frame < 180; frame++) {
      scene.update(6, 2, { x: 0, z: 0, radius: 1.5 }, 1 / 60);
      world.step();
      for (const d of scene.afterStep(1.5)) {
        expect(progress.collect(d)).toBe(true);
        count++;
      }
    }
    expect(
      scene.snapshot({ x: 0, z: 0, radius: 1.5 }).frames[0].collected,
    ).toBe(true);
    expect(count).toBe(1);
    expect(progress.collected.has("world-notions")).toBe(true);
  } finally {
    disposeScene(scene.group);
    world.free();
  }
});

it("最初の箱の壁は穴の移動や表示補間で位置・姿勢が変わらない", () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const room = new ToyWorldScene(world, new Set());
  const original = room.snapshot({ x: 0, z: 0, radius: 0.08 }).frames[0];
  for (let step = 0; step < 120; step++) {
    const hole = {
      x: Math.sin(step * 0.1) * 0.3,
      z: Math.cos(step * 0.1) * 0.2,
      radius: 0.08,
    };
    room.update(1, 0, hole, 1 / 60);
    world.step();
    room.afterStep(hole.radius);
    room.update(1, 0, hole, 0);
    room.render(hole, 0.35);
    expect(room.snapshot(hole).frames[0]).toEqual(original);
  }
  disposeScene(room.group);
  world.free();
});

it("落下する箱の表示は前後の物理姿勢を補間し、物理世界を書き換えない", () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const room = new ToyWorldScene(world, new Set()),
    hole = { x: 0, z: 0, radius: 0.8 };
  room.update(5, 2, hole, 1 / 60);
  const moving: RAPIER.RigidBody[] = [];
  world.forEachRigidBody((body) => {
    if (body.isDynamic()) moving.push(body);
  });
  expect(moving).toHaveLength(1);
  const body = moving[0],
    before = body.translation();
  body.setLinvel({ x: 2, y: 0, z: 1 }, true);
  body.setAngvel({ x: 0, y: 1, z: 0 }, true);
  world.step();
  room.afterStep(hole.radius);
  const after = body.translation(),
    rotation = body.rotation(),
    frame = room.occluders()[0].object;
  room.render(hole, 0);
  expect(frame.position.toArray()).toEqual([before.x, before.y, before.z]);
  room.render(hole, 0.5);
  expect(frame.position.x).toBeCloseTo((before.x + after.x) / 2, 10);
  expect(frame.position.y).toBeCloseTo((before.y + after.y) / 2, 10);
  expect(
    frame.quaternion.angleTo(new THREE.Quaternion().copy(rotation)),
  ).toBeGreaterThan(0);
  expect(body.translation()).toEqual(after);
  expect(body.rotation()).toEqual(rotation);
  const halfway = frame.position.clone();
  room.update(5, 2, hole, 0);
  room.render(hole, 0.5);
  expect(frame.position).toEqual(halfway);
  room.render(hole, 1);
  expect(frame.position.toArray()).toEqual([after.x, after.y, after.z]);
  expect(body.translation()).toEqual(after);
  disposeScene(room.group);
  world.free();
});

it("街は全30区画に住宅・ビル・設備が広がり、家から出た直後の在庫も残る", () => {
  const definitions = createGrowthStage(42, "toys");
  const additions = definitions.filter((d) => d.id.startsWith("city-block-"));
  expect(additions).toHaveLength(300);
  expect(
    definitions.filter((d) => d.id.startsWith("city-traffic-")),
  ).toHaveLength(20);
  for (let column = 0; column < TOY_CITY_COLUMNS.length - 1; column++)
    for (let row = 0; row < TOY_CITY_ROWS.length - 1; row++) {
      const stock = additions.filter((d) =>
        d.id.startsWith(`city-block-${column}-${row}-`),
      );
      expect(stock.length).toBeGreaterThanOrEqual(10);
      expect(stock.some((d) => d.toyKind === "home")).toBe(true);
      expect(stock.some((d) => d.toyKind === "apartment")).toBe(true);
      for (const d of stock) {
        expect(
          insideToyRect(
            d,
            {
              minX: TOY_CITY_COLUMNS[column],
              maxX: TOY_CITY_COLUMNS[column + 1],
              minZ: TOY_CITY_ROWS[row],
              maxZ: TOY_CITY_ROWS[row + 1],
            },
            footprintOf(d),
          ),
        ).toBe(true);
      }
    }
  expect(Math.min(...additions.map((d) => d.x))).toBeLessThan(-1100);
  expect(Math.max(...additions.map((d) => d.x))).toBeGreaterThan(1200);
  expect(Math.min(...additions.map((d) => d.z))).toBeLessThan(-1100);
  expect(Math.max(...additions.map((d) => d.z))).toBeGreaterThan(1100);
  expect(
    definitions.filter((d) => d.id.startsWith("growth-9-") && !d.route),
  ).toHaveLength(20);
});

it("追加した街の建物は既存物や巨大物と重ならず、追加車両は描かれた道路上を走る", () => {
  for (let seed = 0; seed < 20; seed++) {
    const definitions = createGrowthStage(seed, "toys");
    const overlaps: string[] = [];
    const stationary = definitions.filter((d) => d.area === 4 && !d.route);
    for (const d of stationary.filter((d) => d.id.startsWith("city-block-")))
      for (const other of stationary)
        if (
          other.id !== d.id &&
          Math.hypot(d.x - other.x, d.z - other.z) <=
            footprintOf(d) + footprintOf(other)
        )
          overlaps.push(`${seed}: ${d.id} / ${other.id}`);
    expect(overlaps).toEqual([]);
    for (const d of definitions.filter((d) =>
      d.id.startsWith("city-traffic-"),
    )) {
      expect(d.behavior).toBe("route");
      for (let index = 0; index < d.route!.length; index++) {
        const a = d.route![index],
          b = d.route![(index + 1) % d.route!.length];
        for (let sample = 0; sample <= 10; sample++) {
          const point = {
            x: a.x + ((b.x - a.x) * sample) / 10,
            z: a.z + ((b.z - a.z) * sample) / 10,
          };
          expect(
            TOY_CITY_ROADS.some((road) =>
              insideToyRect(point, {
                minX: road.x - road.width / 2,
                maxX: road.x + road.width / 2,
                minZ: road.z - road.depth / 2,
                maxZ: road.z + road.depth / 2,
              }),
            ),
          ).toBe(true);
        }
      }
    }
  }
});
