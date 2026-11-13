import {
  districtProfile,
  districtSpaces,
  districtWalls,
} from "../src/game/district-world";
import { beforeAll, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { STAGE_IDS } from "../src/game/stage";
import { createGrowthStage } from "../src/game/growth-stage";
import { GrowthScenery } from "../src/game/growth-visuals";
import {
  EGYPT_SPACES,
  EGYPT_WALLS,
  EGYPT_ROADS,
} from "../src/game/egypt-world";
import { MOUNTAIN_SPACES, MOUNTAIN_WALLS } from "../src/game/mountain-world";
import { PLAZA_SPACES, PLAZA_WALLS } from "../src/game/plaza-world";
import { HELL_SPACES, HELL_WALLS } from "../src/game/hell-world";
import { NestedWorldScene, ToyWorldScene } from "../src/game/toy-world-scene";
import { BASE_GROUND_RENDER_ORDER } from "../src/game/ground-geometry";
import { disposeScene } from "../src/game/visuals";
beforeAll(async () => {
  await RAPIER.init();
});
function checkPaint(root: THREE.Group) {
  let count = 0;
  root.traverse((part) => {
    if (!(part instanceof THREE.Mesh) || part.geometry.type !== "PlaneGeometry")
      return;
    count++;
    expect(part.renderOrder).toBeGreaterThan(BASE_GROUND_RENDER_ORDER);
    expect(part.renderOrder).toBeLessThan(0);
    for (const material of Array.isArray(part.material)
      ? part.material
      : [part.material]) {
      expect(material.depthTest).toBe(false);
      expect(material.depthWrite).toBe(false);
    }
  });
  expect(count).toBeGreaterThan(0);
}
it("全ステージの道路・水面と、おもちゃの床・模様は、物体を上書きしない背景として描く", () => {
  for (const stage of STAGE_IDS) {
    const scenery = new GrowthScenery(createGrowthStage(42, stage), stage);
    if (
      districtProfile(stage) ||
      stage === "egypt" ||
      stage === "hell" ||
      stage === "plaza" ||
      stage === "mountain"
    ) {
      const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
      const egypt = new NestedWorldScene(world, new Set(), {
        spaces: districtProfile(stage)
          ? districtSpaces(districtProfile(stage)!)
          : stage === "mountain"
            ? MOUNTAIN_SPACES
            : stage === "plaza"
              ? PLAZA_SPACES
              : stage === "hell"
                ? HELL_SPACES
                : EGYPT_SPACES,
        walls: districtProfile(stage)
          ? districtWalls(districtProfile(stage)!)
          : stage === "mountain"
            ? MOUNTAIN_WALLS
            : stage === "plaza"
              ? PLAZA_WALLS
              : stage === "hell"
                ? HELL_WALLS
                : EGYPT_WALLS,
        roads: stage === "egypt" ? EGYPT_ROADS : [],
        style: stage,
      });
      checkPaint(egypt.group);
      disposeScene(egypt.group);
      world.free();
    } else checkPaint(scenery.group);
    disposeScene(scenery.group);
  }
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }),
    room = new ToyWorldScene(world, new Set());
  checkPaint(room.group);
  disposeScene(room.group);
  world.free();
});
