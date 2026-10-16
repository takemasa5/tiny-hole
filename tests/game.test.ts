import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { writeGroundGeometry } from "../src/game/ground-geometry";
import {
  createStage,
  LEVELS,
  levelForScore,
  OBJECT_TYPES,
  objectFootprint,
  Progress,
  ROADS,
  MAP_HALF_SIZE,
  MOVING_OBJECTS,
} from "../src/game/stage";
import {
  createFloor,
  floorShape,
  topOfBox,
  updateFloor,
} from "../src/game/floor";

it("床の移動・拡大でGPU用バッファを交換せず、頂点と境界を更新する", () => {
  const geometry = new THREE.BufferGeometry();
  const initial = floorShape(0, 0, 0.9);
  writeGroundGeometry(geometry, initial.vertices, initial.indices);
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  const indices = geometry.index;
  const next = floorShape(3, 4, 2.3);
  writeGroundGeometry(geometry, next.vertices, next.indices);
  expect(geometry.getAttribute("position")).toBe(position);
  expect(geometry.getAttribute("uv")).toBe(uv);
  expect(geometry.index).toBe(indices);
  expect(position.getX(0)).toBeCloseTo(5.3);
  expect(geometry.boundingSphere?.center.x).toBeCloseTo(3);
  geometry.dispose();
});

describe("成長とクリア", () => {
  it("閾値の境界、複数段階、最大段階を扱う", () => {
    LEVELS.slice(1).forEach((level, index) => {
      expect(levelForScore(level.threshold - 1)).toBe(index);
      expect(levelForScore(level.threshold)).toBe(index + 1);
    });
    expect(levelForScore(600)).toBe(6);
    expect(levelForScore(100000)).toBe(7);
  });
  it("面積を1.5倍にして、開始・最大半径を維持した8段階へ進む", () => {
    expect((MAP_HALF_SIZE * 2) ** 2 / 56 ** 2).toBeCloseTo(1.5);
    expect(LEVELS).toHaveLength(8);
    expect(LEVELS[0].radius).toBe(0.9);
    expect(LEVELS.at(-1)?.radius).toBe(5.1);
    const progress = new Progress();
    progress.collect({ id: "house", kind: "house" });
    expect(progress.level).toBe(4);
  });
  it("回収は一度だけ加算し、目標物だけでクリアする", () => {
    const progress = new Progress();
    expect(progress.collect({ id: "house-0", kind: "house" })).toBe(true);
    expect(progress.collect({ id: "house-0", kind: "house" })).toBe(false);
    expect(progress.score).toBe(178);
    expect(progress.cleared).toBe(false);
    progress.collect({ id: "goal", kind: "monument" });
    expect(progress.cleared).toBe(true);
    expect(progress.collect({ id: "parcel-0", kind: "parcel" })).toBe(false);
  });
});

describe("ランダム配置", () => {
  it("同じシードを再現し、配置を変えられる", () => {
    expect(createStage(42)).toEqual(createStage(42));
    expect(createStage(42)).not.toEqual(createStage(43));
  });
  it("初期重なりがなく、各段階で成長量が足りる", () => {
    for (const seed of [42, 43, 20261014]) {
      const objects = createStage(seed);
      for (let index = 0; index < objects.length; index++) {
        const object = objects[index];
        expect(Math.abs(object.x) + objectFootprint(object.kind)).toBeLessThan(
          MAP_HALF_SIZE,
        );
        expect(Math.abs(object.z) + objectFootprint(object.kind)).toBeLessThan(
          MAP_HALF_SIZE,
        );
        for (const other of objects.slice(index + 1)) {
          const horizontalOverlap =
            Math.hypot(object.x - other.x, object.z - other.z) <
            objectFootprint(object.kind) + objectFootprint(other.kind);
          const verticalOverlap =
            Math.abs(object.y - other.y) <
            (OBJECT_TYPES[object.kind].size[1] +
              OBJECT_TYPES[other.kind].size[1]) /
              2;
          expect(horizontalOverlap && verticalOverlap).toBe(false);
        }
      }
      LEVELS.slice(0, -1).forEach((level, index) => {
        const available = objects
          .filter((object) => objectFootprint(object.kind) < level.radius)
          .reduce((sum, object) => sum + OBJECT_TYPES[object.kind].value, 0);
        expect(available).toBeGreaterThanOrEqual(LEVELS[index + 1].threshold);
      });
    }
  });
  it("道路の両側へ生成し、20か所の小箱を20段ずつ積む", () => {
    const objects = createStage(20261014);
    expect(objects).toHaveLength(535 + MOVING_OBJECTS.count);
    expect(
      objects.filter((object) => object.kind === MOVING_OBJECTS.kind),
    ).toHaveLength(MOVING_OBJECTS.count);
    expect(new Set(objects.map((object) => object.id)).size).toBe(
      objects.length,
    );
    for (const object of objects) {
      expect(
        ROADS.some((road) => {
          const distance =
            Math.abs(
              (road.axis === "x" ? object.z : object.x) - road.position,
            ) -
            road.width / 2 -
            objectFootprint(object.kind);
          return distance >= 0.39 && distance <= 7.41;
        }),
      ).toBe(true);
      for (const road of ROADS)
        expect(
          Math.abs((road.axis === "x" ? object.z : object.x) - road.position),
        ).toBeGreaterThan(road.width / 2 + objectFootprint(object.kind));
    }
    const stackIds = new Set(
      objects.map((object) => object.stackId).filter(Boolean),
    );
    expect(stackIds.size).toBe(20);
    for (const id of stackIds) {
      const stack = objects.filter((object) => object.stackId === id);
      expect(stack).toHaveLength(20);
      expect(
        stack.every(
          (object) =>
            object.kind === "parcel" &&
            object.x === stack[0].x &&
            object.z === stack[0].z &&
            object.yaw === stack[0].yaw,
        ),
      ).toBe(true);
      expect(stack[19].y - stack[0].y).toBeCloseTo(19 * 0.675);
    }
  });
});

describe("穴の縁の物理", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  function simulate(size: [number, number, number], x = 0, holeX = 0) {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const floor = createFloor(world);
    updateFloor(floor, holeX, 0, 0.9);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, size[1] / 2 + 0.03, 0)
        .setCcdEnabled(true),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        size[0] / 2,
        size[1] / 2,
        size[2] / 2,
      ).setFriction(0.65),
      body,
    );
    let tilted = false;
    for (let frame = 0; frame < 180; frame++) {
      world.step();
      const rotation = body.rotation();
      tilted ||= Math.abs(rotation.x) + Math.abs(rotation.z) > 0.1;
    }
    const result = { y: body.translation().y, tilted };
    world.free();
    return result;
  }
  it("小物は穴へ落ちる", () => {
    expect(simulate([0.5, 0.5, 0.5]).y).toBeLessThan(-2);
  });
  it("大きすぎる物は床に支えられる", () => {
    expect(simulate([3, 1, 3]).y).toBeGreaterThan(0.45);
  });
  it("片側が縁に残った長い物は傾いて落ちる", () => {
    const result = simulate([1.9, 0.45, 0.45], 0.35);
    expect(result.tilted).toBe(true);
    expect(result.y).toBeLessThan(-2);
  });
  it("穴を移動した先で落ち、遠方は支持される", () => {
    expect(simulate([0.5, 0.5, 0.5], 3, 3).y).toBeLessThan(-2);
    expect(simulate([0.5, 0.5, 0.5], -3, 3).y).toBeGreaterThan(0.2);
  });
  it("傾いた箱の上端を使い、中心だけで回収しない", () => {
    expect(topOfBox(-3, { x: 0, y: 0, z: 0, w: 1 }, [6, 13, 6])).toBe(3.5);
    const halfAngle = Math.PI / 4;
    expect(
      topOfBox(
        -3,
        { x: 0, y: 0, z: Math.sin(halfAngle), w: Math.cos(halfAngle) },
        [6, 13, 6],
      ),
    ).toBeCloseTo(0);
  });
  it("20段積みの箱が床上で支え合い、穴を移動するとまとめて落ちる", () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const floor = createFloor(world);
    const bodies = Array.from({ length: 20 }, (_, layer) => {
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(3, 0.345 + layer * 0.675, 0)
          .setCcdEnabled(true),
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.325, 0.325, 0.325).setFriction(0.65),
        body,
      );
      return body;
    });
    for (let step = 0; step < 120; step++) world.step();
    expect(bodies[19].translation().y).toBeGreaterThan(12);
    updateFloor(floor, 3, 0, 0.9);
    bodies.forEach((body) => body.wakeUp());
    for (let step = 0; step < 180; step++) world.step();
    bodies.forEach((body) =>
      expect(body.translation().y + 0.325).toBeLessThan(-1.2),
    );
    world.free();
  });
});
