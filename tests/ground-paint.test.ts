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
    if (stage === "egypt") {
      const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
      const egypt = new NestedWorldScene(world, new Set(), {
        spaces: EGYPT_SPACES,
        walls: EGYPT_WALLS,
        roads: EGYPT_ROADS,
        style: "egypt",
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
