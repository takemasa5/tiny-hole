import { beforeAll, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { createGrowthStage, type GrowthObject } from "../src/game/growth-stage";
import { STAGE_IDS } from "../src/game/stage";
import {
  createGrowthBody,
  growthCollisionBounds,
} from "../src/game/growth-physics";
import { growthVisual } from "../src/game/growth-visuals";
import { disposeScene } from "../src/game/visuals";
import { createFloor, updateFloor } from "../src/game/floor";

const identity = { x: 0, y: 0, z: 0, w: 1 };
const toys = createGrowthStage(42, "toys");
const definition = (kind: string): GrowthObject => {
  const found = toys.find((d) => d.toyKind === kind || d.model === kind);
  if (!found) throw new Error(`モデルがありません: ${kind}`);
  return { ...found, size: [1, 1, 1], scale: 1, behavior: "still" };
};
beforeAll(async () => {
  await RAPIER.init();
});

it.each([
  ["desk", [0, -0.2, 0], [0, 0.44, 0]],
  ["table", [0, -0.2, 0], [0, 0.425, 0]],
  ["chair", [0, -0.3, 0], [0, -0.08, 0]],
  ["floorLamp", [0.3, 0, 0.3], [0, 0, 0]],
  ["puzzle", [0, 0, -0.44], [0, 0, 0]],
  ["hero", [0, -0.35, 0], [0.15, -0.35, 0]],
  ["monster", [0, -0.35, 0], [0.15, -0.35, 0]],
] as const)(
  "%s: 空洞に見えない支持面がなく、実部品には接触する",
  (kind, gap, solid) => {
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    try {
      const { colliders } = createGrowthBody(
        world,
        definition(kind),
        { x: 0, y: 0, z: 0 },
        identity,
        "toys",
      );
      const contains = (point: readonly number[]) =>
        colliders.some((c) =>
          c.containsPoint({ x: point[0], y: point[1], z: point[2] }),
        );
      expect(contains(gap)).toBe(false);
      expect(contains(solid)).toBe(true);
    } finally {
      world.free();
    }
  },
);

it("ナットとタイヤの中央を凸形状で塞がない", () => {
  for (const [stage, d] of [
    [
      "america",
      createGrowthStage(42, "harbor").find(
        (d) => d.model === "nut" || d.districtKind === "nut",
      ),
    ],
    [
      "america",
      createGrowthStage(42, "america").find((d) => d.kind === "tire"),
    ],
  ] as const) {
    expect(d).toBeDefined();
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    try {
      const { colliders } = createGrowthBody(
        world,
        { ...d!, size: [1, 1, 1], scale: 1 },
        { x: 0, y: 0, z: 0 },
        identity,
        stage,
      );
      expect(colliders.some((c) => c.containsPoint({ x: 0, y: 0, z: 0 }))).toBe(
        false,
      );
      expect(colliders.length).toBeGreaterThan(1);
    } finally {
      world.free();
    }
  }
});

it.each([0.01, 1, 100])(
  "丸い照明は見えない箱の四隅で引っかからず落下する（縮尺%s）",
  (scale) => {
    const d = {
      ...definition("floorLamp"),
      size: [scale, 3 * scale, scale] as [number, number, number],
    };
    const radius = 0.65 * scale; // The lamp fits; the old square corners (0.707) do not.
    const world = new RAPIER.World({
      x: 0,
      y: -9.81 * Math.max(radius, 0.25),
      z: 0,
    });
    try {
      const floor = createFloor(world);
      updateFloor(floor, 0, 0, radius, scale * 100);
      const { body } = createGrowthBody(
        world,
        d,
        { x: 0, y: d.size[1] / 2 + 0.0005, z: 0 },
        identity,
        "toys",
      );
      for (let frame = 0; frame < 180; frame++) world.step();
      expect(
        body.translation().y +
          growthCollisionBounds(d, body.rotation(), "toys").top,
      ).toBeLessThan(-radius);
    } finally {
      world.free();
    }
  },
);

it.each(STAGE_IDS)(
  "%s: 全種類の傾いた当たり判定・回収範囲が実モデルの外形と一致する",
  (stage) => {
    const seen = new Set<string>();
    const rotation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0.61, 0.37, -0.48),
    );
    for (const d of createGrowthStage(42, stage)) {
      const key = [d.model, d.kind, d.toyKind, ...d.size].join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      const visual = growthVisual(d, stage);
      try {
        visual.quaternion.copy(rotation);
        visual.updateMatrixWorld(true);
        // Vertex extrema, not Box3's rotated local bounding boxes.
        let top = -Infinity,
          bottom = Infinity,
          footprint = 0;
        const point = new THREE.Vector3();
        visual.traverse((mesh) => {
          if (!(mesh instanceof THREE.Mesh)) return;
          const vertices = mesh.geometry.getAttribute("position");
          const matrices = [mesh.matrixWorld];
          if (mesh instanceof THREE.InstancedMesh) {
            matrices.length = 0;
            for (let i = 0; i < mesh.count; i++) {
              const instance = new THREE.Matrix4();
              mesh.getMatrixAt(i, instance);
              matrices.push(mesh.matrixWorld.clone().multiply(instance));
            }
          }
          for (const matrix of matrices)
            for (let i = 0; i < vertices.count; i++) {
              point.fromBufferAttribute(vertices, i).applyMatrix4(matrix);
              top = Math.max(top, point.y);
              bottom = Math.min(bottom, point.y);
              footprint = Math.max(footprint, Math.hypot(point.x, point.z));
            }
        });
        const collision = growthCollisionBounds(d, rotation, stage);
        const tolerance = Math.max(...d.size) * 0.00001;
        expect(Math.abs(collision.top - top), `${d.label} top`).toBeLessThan(
          tolerance,
        );
        expect(
          Math.abs(collision.bottom - bottom),
          `${d.label} bottom`,
        ).toBeLessThan(tolerance);
        expect(
          Math.abs(collision.footprint - footprint),
          `${d.label} footprint`,
        ).toBeLessThan(tolerance);
      } finally {
        disposeScene(visual);
      }
    }
  },
);
