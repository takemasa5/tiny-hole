import { beforeAll, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { OBJECT_TYPES } from "../src/game/stage";
import { objectVisual, disposeScene } from "../src/game/visuals";
import { objectCollider } from "../src/game/object-collider";
import {
  FITTED_COLLIDER_KINDS,
  objectCollisionFootprint,
  objectCollisionTop,
  objectHullVertices,
} from "../src/game/object-shape";
import { horizontalFootprint } from "../src/game/object-exit";
import { createFloor, updateFloor } from "../src/game/floor";
import { createWalker, driveWalker } from "../src/game/walker";

const upright = { x: 0, y: 0, z: 0, w: 1 };
beforeAll(async () => {
  await RAPIER.init();
});

it("既存の人は斜めを向いていても同じ大きさの穴へ落下し始める", () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const rotation = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    Math.PI / 4,
  );
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 0.65, 0)
      .setRotation(rotation),
  );
  world.createCollider(objectCollider("person"), body);
  body.setEnabledRotations(false, true, false, true);
  const walker = createWalker(Math.PI / 4, () => 0.5);
  driveWalker(
    body,
    walker,
    "person",
    { x: 0, z: 0, radius: 0.4 },
    1 / 60,
    () => 0.5,
  );
  expect(walker.mode).toBe("falling");
  world.free();
});

it.each(FITTED_COLLIDER_KINDS)(
  "%sの外側の箱の角には当たり判定がない",
  (kind) => {
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    const [width, height, depth] = OBJECT_TYPES[kind].size;
    const collider = world.createCollider(objectCollider(kind));
    expect(collider.containsPoint({ x: 0, y: -height * 0.1, z: 0 })).toBe(true);
    expect(
      collider.containsPoint({
        x: width * 0.45,
        y: height * 0.45,
        z: depth * 0.45,
      }),
    ).toBe(false);
    expect(objectCollisionFootprint(kind, upright)).toBeLessThanOrEqual(
      horizontalFootprint(kind, upright) + 0.000001,
    );
    expect(objectHullVertices(kind)).toBe(objectHullVertices(kind));
    world.free();
  },
);

it.each(FITTED_COLLIDER_KINDS)(
  "%sが傾いても回収面の判定は見た目の最上点に一致する",
  (kind) => {
    const visual = objectVisual(kind);
    visual.quaternion.setFromEuler(new THREE.Euler(0.6, 0.4, 1));
    visual.position.y = -2;
    const top = new THREE.Box3().setFromObject(visual, true).max.y;
    expect(objectCollisionTop(kind, -2, visual.quaternion)).toBeCloseTo(top, 4);
    disposeScene(visual);
  },
);

it.each(FITTED_COLLIDER_KINDS)("%sは見た目が収まる穴へ落下する", (kind) => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const floor = createFloor(world);
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(5, OBJECT_TYPES[kind].size[1] / 2 + 0.02, 0)
      .setCcdEnabled(true),
  );
  world.createCollider(objectCollider(kind), body);
  for (let step = 0; step < 120; step++) world.step();
  expect(body.translation().y).toBeGreaterThan(0);
  const radius = objectCollisionFootprint(kind, upright) + 0.05;
  updateFloor(floor, 5, 0, radius, 180);
  body.wakeUp();
  if (kind === "oni" || kind === "giantOni") {
    const walker = createWalker(0, () => 0.5);
    driveWalker(body, walker, kind, { x: 5, z: 0, radius }, 1 / 60, () => 0.5);
    expect(walker.mode).toBe("falling");
  }
  for (let step = 0; step < 240; step++) world.step();
  expect(
    objectCollisionTop(kind, body.translation().y, body.rotation()),
  ).toBeLessThan(-1.2);
  world.free();
});
