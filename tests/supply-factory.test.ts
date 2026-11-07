import { beforeAll, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { createSupplySites, COLLECTION_Y, Progress } from "../src/game/stage";
import { createFloor, updateFloor } from "../src/game/floor";
import {
  createSupplyFactory,
  releaseSupplyFactory,
  supplyFactoryTop,
} from "../src/game/supply-factory";
import {
  createObjectSupply,
  supplyRequest,
  supplyLaunch,
  findSupplyPlacement,
} from "../src/game/object-supply";
import {
  createStreetSweeper,
  stepStreetSweeper,
} from "../src/game/street-sweeper";
import { disposeScene } from "../src/game/visuals";

const TEST_SUPPLY_SITES = createSupplySites(0, "america");

beforeAll(async () => {
  await RAPIER.init();
});

it.each(TEST_SUPPLY_SITES)(
  "$id工場はレベル7まで固定され、8で土台が穴に収まると煙突ごと落下する",
  (site) => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const floor = createFloor(world);
    updateFloor(floor, site.x, site.z, 5.1, 180);
    const factory = createSupplyFactory(world, site);
    const hole = { x: site.x, z: site.z, radius: 5.1 };
    expect(releaseSupplyFactory(factory, 7, hole)).toBe(false);
    for (let step = 0; step < 120; step++) world.step();
    expect(factory.body.isFixed()).toBe(true);
    expect(factory.body.translation().y).toBe(0);
    expect(releaseSupplyFactory(factory, 8, { ...hole, x: hole.x + 4 })).toBe(
      false,
    );
    expect(releaseSupplyFactory(factory, 8, hole)).toBe(true);
    expect(releaseSupplyFactory(factory, 8, hole)).toBe(false);
    expect(factory.body.isDynamic()).toBe(true);
    expect(factory.colliders).toHaveLength(2);
    for (let step = 0; step < 120; step++) world.step();
    expect(supplyFactoryTop(factory)).toBeLessThan(COLLECTION_Y);
    const progress = new Progress("america");
    expect(progress.collect(factory.definition)).toBe(true);
    expect(progress.collect(factory.definition)).toBe(false);
    world.removeRigidBody(factory.body);
    expect(world.bodies.len()).toBe(0);
    expect(world.colliders.len()).toBe(1);
    disposeScene(factory.mesh);
    world.free();
  },
);

it("飲み込み始めた工場からは供給せず、残った工場だけを稼働させる", () => {
  for (const siteId of ["food", "depot"] as const) {
    const state = createObjectSupply();
    for (let step = 0; step < 60; step++) {
      const request = supplyRequest(state, 7, 2700, [], 1, [siteId]);
      if (request) expect(request.siteId).toBe(siteId);
    }
    expect(supplyRequest(state, 7, 2700, [], 100, [])).toBeUndefined();
    expect(supplyRequest(state, 0, 0, [], 100, [])).toBeUndefined();
  }
});

it("排出は従来と同じ放物線を半分の時間で進む", () => {
  const definition = findSupplyPlacement(
    createObjectSupply(),
    "depot",
    "house",
    [],
    { x: 0, z: 0, radius: 0.9 },
  )!;
  const launch = supplyLaunch(definition, TEST_SUPPLY_SITES);
  expect(launch.duration).toBe(0.9);
  const oldDuration = 1.8;
  const oldVelocityY =
    (definition.y - launch.position.y + 0.5 * 9.81 * oldDuration ** 2) /
    oldDuration;
  for (const fraction of [0.25, 0.5, 0.75, 1]) {
    const oldTime = oldDuration * fraction;
    const newTime = launch.duration * fraction;
    const oldY =
      launch.position.y + oldVelocityY * oldTime - 0.5 * 9.81 * oldTime ** 2;
    const newY =
      launch.position.y +
      launch.velocity.y * newTime -
      0.5 * 9.81 * launch.gravityScale * newTime ** 2;
    expect(newY).toBeCloseTo(oldY);
  }
});

it("清掃車は6.4の速度で進み、なくなった工場を迂回しない", () => {
  const state = createStreetSweeper();
  const velocity = stepStreetSweeper(
    state,
    { x: 8, z: -28 },
    [],
    1 / 60,
    false,
    [],
    [],
  );
  expect(Math.hypot(velocity.x, velocity.z)).toBeCloseTo(6.4);
  expect(velocity.x).toBe(0);
  expect(velocity.z).toBeGreaterThan(0);
});
