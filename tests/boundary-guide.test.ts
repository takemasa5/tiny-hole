import { expect, it } from "vitest";
import * as THREE from "three";
import { BoundaryGuide } from "../src/game/boundary-guide";
import { GROWTH_AREAS, GROWTH_LEVELS } from "../src/game/growth-stage";
import { disposeScene } from "../src/game/visuals";

it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])(
  "レベル%sの全方向で、エリア固定の尺度の柵と開放条件を出す",
  (level) => {
    const guide = new BoundaryGuide();
    const radius = GROWTH_LEVELS[level - 1].radius;
    const area = Math.min(3, Math.max(0, Math.floor((level - 1) / 3)));
    const extent = GROWTH_AREAS[area].extent;
    for (const [x, z] of [
      [extent - radius, 0],
      [-extent + radius, 0],
      [0, extent - radius],
      [0, -extent + radius],
    ]) {
      guide.update({ x, z, radius }, area);
      expect(guide.snapshot().visible).toBe(true);
      expect(guide.snapshot().level).toBe(GROWTH_AREAS[area + 1].level);
      expect(guide.snapshot().posts).toBeGreaterThan(0);
      const cones = guide.group.children[0] as THREE.InstancedMesh;
      const matrix = new THREE.Matrix4();
      cones.getMatrixAt(0, matrix);
      const scale = new THREE.Vector3();
      matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
      const fixedScale = GROWTH_LEVELS[GROWTH_AREAS[area].level - 1].radius;
      expect(scale.x).toBeCloseTo(fixedScale);
      expect(scale.y).toBeCloseTo(fixedScale);
    }
    disposeScene(guide.group);
  },
);

it("穴の移動・同じエリア内での成長によってコーン・柵の位置や大きさを変えない", () => {
  const guide = new BoundaryGuide();
  guide.update({ x: 2.3, z: -0.4, radius: 0.08 }, 0);
  const before = guide.group.children.map((mesh) =>
    Array.from((mesh as THREE.InstancedMesh).instanceMatrix.array),
  );
  for (const hole of [
    { x: 2.3, z: 0.4, radius: 0.08 },
    { x: -2.1, z: 0.5, radius: 0.25 },
    { x: 0, z: 0, radius: 0.25 },
  ]) {
    guide.update(hole, 0);
    expect(
      guide.group.children.map((mesh) =>
        Array.from((mesh as THREE.InstancedMesh).instanceMatrix.array),
      ),
    ).toEqual(before);
  }
  expect(guide.snapshot().posts).toBeLessThanOrEqual(512);
  disposeScene(guide.group);
});

it("境界から離れると案内を消し、最終エリアには柵を残さない", () => {
  const guide = new BoundaryGuide();
  guide.update({ x: 2.32, z: 0, radius: 0.08 }, 0);
  expect(guide.snapshot().visible).toBe(true);
  guide.update({ x: 0, z: 0, radius: 0.08 }, 0);
  expect(guide.snapshot().visible).toBe(false);
  guide.update({ x: 1500, z: 0, radius: 48 }, 3);
  expect(guide.group.visible).toBe(false);
  disposeScene(guide.group);
});
