import { beforeAll, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  STAGES,
  OBJECT_TYPES,
  createStage,
  levelsForStage,
  walkingKindsForStage,
  objectSizeForStage,
  objectFootprint,
  createSupplySites,
  type ObjectKind,
} from "../src/game/stage";
import { objectVisual, disposeScene } from "../src/game/visuals";
import { objectCollider } from "../src/game/object-collider";
import { createFloor, updateFloor, topOfBox } from "../src/game/floor";
import { createWalker, driveWalker } from "../src/game/walker";
import {
  createObjectSupply,
  findSupplyPlacement,
  supplyLaunch,
  supplyMouth,
} from "../src/game/object-supply";
import {
  createSupplyFactory,
  releaseSupplyFactory,
  supplyFactoryTop,
} from "../src/game/supply-factory";
import {
  createStreetSweeper,
  stepStreetSweeper,
} from "../src/game/street-sweeper";

const NEW_STAGES = ["harbor", "toys", "office", "hell"] as const;
const kinds = [
  ...new Set<ObjectKind>(
    NEW_STAGES.flatMap((id) => [
      STAGES[id].goal,
      STAGES[id].moving.kind,
      ...STAGES[id].groups.map(({ kind }) => kind),
    ]),
  ),
];
beforeAll(async () => {
  await RAPIER.init();
});

it.each(kinds)(
  "%sの専用モデルは衝突寸法に収まり、GPU資源を解放する",
  (kind) => {
    const visual = objectVisual(kind);
    const actual = new THREE.Box3()
      .setFromObject(visual, true)
      .getSize(new THREE.Vector3());
    const expected = OBJECT_TYPES[kind].size;
    expected.forEach((size, index) =>
      expect(actual.getComponent(index)).toBeLessThanOrEqual(size + 0.002),
    );
    expect(visual.children.length).toBeGreaterThan(1);
    let disposed = 0;
    visual.traverse((part) => {
      if (part instanceof THREE.Mesh)
        part.geometry.addEventListener("dispose", () => disposed++);
    });
    disposeScene(visual);
    expect(disposed).toBeGreaterThan(0);
  },
);

it.each(NEW_STAGES)("%sの最終目標を最大の穴へ物理的に落とせる", (id) => {
  const kind = STAGES[id].goal,
    size = OBJECT_TYPES[kind].size;
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const floor = createFloor(world);
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(3, size[1] / 2 + 0.02, 0)
      .setCcdEnabled(true),
  );
  world.createCollider(objectCollider(kind), body);
  for (let step = 0; step < 120; step++) world.step();
  expect(body.translation().y).toBeGreaterThan(0);
  updateFloor(floor, 3, 0, levelsForStage(id)[7].radius);
  body.wakeUp();
  for (let step = 0; step < 240; step++) world.step();
  expect(topOfBox(body.translation().y, body.rotation(), size)).toBeLessThan(
    -1.2,
  );
  world.free();
});

it("おもちゃのボールは床を転がり、穴へ落ちる", () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const floor = createFloor(world);
  updateFloor(floor, -20, -20, 0.9, 180);
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 0.52, 0)
      .setCcdEnabled(true),
  );
  world.createCollider(objectCollider("toyBall").setFriction(0.65), body);
  body.setLinvel({ x: 3, y: 0, z: 0 }, true);
  body.setAngvel({ x: 0, y: 0, z: -6 }, true);
  for (let step = 0; step < 60; step++) world.step();
  expect(body.translation().x).toBeGreaterThan(2);
  expect(body.translation().y).toBeGreaterThan(0.48);
  const position = body.translation();
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  updateFloor(floor, position.x, position.z, 0.9, 180);
  for (let step = 0; step < 120; step++) world.step();
  expect(body.translation().y).toBeLessThan(-2);
  world.free();
});

it("会社は小物から始まり、家具と社長まで段階的に広がる", () => {
  const levels = levelsForStage("office");
  expect(levels.map(({ radius }) => radius)).toEqual([
    0.08, 0.12, 0.2, 0.28, 0.42, 0.62, 0.9, 1.6,
  ]);
  expect(objectFootprint("documents")).toBeLessThan(levels[2].radius * 0.99);
  const objects = createStage(42, "office");
  expect(objects.filter(({ kind }) => kind === "eraser")).toHaveLength(50);
  expect(objects.filter(({ kind }) => kind === "pencil")).toHaveLength(50);
  const starters = objects.filter(({ id }) => /^eraser-[0-7]$/.test(id));
  expect(starters).toHaveLength(8);
  expect(
    Math.min(...starters.map(({ x, z }) => Math.hypot(x, z))),
  ).toBeLessThan(0.4);
  expect(objectSizeForStage("streetSweeper", "office")[0]).toBeCloseTo(0.64);
  const state = createStreetSweeper();
  const velocity = stepStreetSweeper(
    state,
    { x: 0, z: 0 },
    [],
    1 / 60,
    false,
    [],
    [],
    0.2,
  );
  expect(Math.hypot(velocity.x, velocity.z)).toBeCloseTo(1.28);
});

it("会社の小さな消しゴムも床に支えられ、微小な穴へ落ちる", () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const floor = createFloor(world);
  updateFloor(floor, 0, 0, 0.08, 36);
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0.4, 0.014, 0)
      .setCcdEnabled(true),
  );
  world.createCollider(objectCollider("eraser"), body);
  for (let step = 0; step < 90; step++) world.step();
  expect(body.translation().y).toBeGreaterThan(0.008);
  updateFloor(floor, 0.4, 0, 0.08, 36);
  body.wakeUp();
  for (let step = 0; step < 120; step++) world.step();
  expect(body.translation().y).toBeLessThan(-1.2);
  world.free();
});

it("会社の工場は煙突位置と排出が一致し、最終段階で全体を回収できる", () => {
  const sites = createSupplySites(42, "office"),
    site = sites[0];
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const floor = createFloor(world);
  updateFloor(floor, site.x, site.z, 1.6, 36);
  const factory = createSupplyFactory(world, site);
  const mouth = factory.mesh
    .getObjectByName("supply-mouth")!
    .getWorldPosition(new THREE.Vector3());
  expect(mouth.x).toBeCloseTo(supplyMouth(site).x);
  expect(mouth.y).toBeCloseTo(supplyMouth(site).y, 2);
  const supply = createObjectSupply(42, "office");
  const def = findSupplyPlacement(supply, site.id, "eraser", [], {
    x: 0,
    z: 0,
    radius: 0.08,
  })!;
  const launch = supplyLaunch(def, sites);
  expect(launch.gravityScale).toBeCloseTo(0.8);
  expect(launch.velocity.y).toBeGreaterThan(0);
  expect(
    releaseSupplyFactory(factory, 7, { x: site.x, z: site.z, radius: 1.6 }),
  ).toBe(false);
  expect(
    releaseSupplyFactory(factory, 8, { x: site.x, z: site.z, radius: 1.6 }),
  ).toBe(true);
  for (let step = 0; step < 120; step++) world.step();
  expect(supplyFactoryTop(factory)).toBeLessThan(-1.2);
  disposeScene(factory.mesh);
  world.free();
});

it("地獄の8割以上が歩く種類で、大小の鬼と亡者・ドクロが移動し落下する", () => {
  const objects = createStage(42, "hell");
  const kinds = walkingKindsForStage("hell");
  expect(
    objects.filter(({ kind }) => kinds.includes(kind)).length /
      (objects.length + 2),
  ).toBeGreaterThan(0.8);
  for (const kind of kinds) {
    const size = OBJECT_TYPES[kind].size;
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const floor = createFloor(world);
    updateFloor(floor, -20, -20, 0.9, 180);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(0, size[1] / 2 + 0.02, 0)
        .setCcdEnabled(true),
    );
    body.setEnabledRotations(false, true, false, true);
    world.createCollider(objectCollider(kind), body);
    const walker = createWalker(0, () => 0.5);
    for (let step = 0; step < 120; step++) {
      driveWalker(
        body,
        walker,
        kind,
        { x: -20, z: -20, radius: 0.9 },
        1 / 60,
        () => 0.5,
        50,
        STAGES.hell.moving.speeds,
      );
      world.step();
    }
    expect(
      Math.hypot(body.translation().x, body.translation().z),
    ).toBeGreaterThan(0.5);
    const pos = body.translation();
    updateFloor(floor, pos.x, pos.z, 5.1, 180);
    for (let step = 0; step < 180; step++) {
      driveWalker(
        body,
        walker,
        kind,
        { x: pos.x, z: pos.z, radius: 5.1 },
        1 / 60,
        () => 0.5,
        50,
        STAGES.hell.moving.speeds,
      );
      world.step();
    }
    expect(walker.mode).toBe("falling");
    expect(body.translation().y).toBeLessThan(-2);
    world.free();
  }
});
