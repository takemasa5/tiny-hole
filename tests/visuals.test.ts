import { expect, it } from "vitest";
import * as THREE from "three";
import { OBJECT_TYPES } from "../src/game/stage";
import { disposeScene, objectVisual } from "../src/game/visuals";
import { animateWalker } from "../src/game/visuals";
import { createWalker, walkerVelocity } from "../src/game/walker";

it.each(["house", "kiosk"] as const)(
  "%s の本体と屋根は重ならず、建物の全高を維持する",
  (kind) => {
    const visual = objectVisual(kind);
    visual.updateMatrixWorld(true);
    const body = new THREE.Box3().setFromObject(visual.children[0]);
    const roof = new THREE.Box3().setFromObject(visual.children[1]);
    const [width, height, depth] = OBJECT_TYPES[kind].size;
    expect(body.max.y).toBeCloseTo(roof.min.y);
    expect(body.min.y).toBeCloseTo(-height / 2);
    expect(roof.max.y).toBeCloseTo(height / 2);
    expect(roof.max.x - roof.min.x).toBeCloseTo(width);
    expect(roof.max.z - roof.min.z).toBeCloseTo(depth);
    disposeScene(visual);
  },
);

it("粒子のインスタンス用GPU資源も終了時に破棄する", () => {
  const scene = new THREE.Group();
  const particles = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.05),
    new THREE.MeshBasicMaterial(),
    28,
  );
  let disposed = false;
  particles.addEventListener("dispose", () => {
    disposed = true;
  });
  scene.add(particles);
  disposeScene(scene);
  expect(disposed).toBe(true);
});

it("たぬきの顔と歩行・逃走の速度が同じ向きを向き、脚は前後へ振れる", () => {
  const visual = objectVisual("tanuki");
  const face = visual.getObjectByName("face")!;
  for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const walker = createWalker(heading, () => 0.5);
    const velocity = walkerVelocity(
      walker,
      { x: 10, z: 10 },
      { x: 0, z: 0, radius: 0.9 },
      0.47,
      1 / 60,
      () => 0.5,
    );
    visual.rotation.y = walker.heading;
    visual.updateMatrixWorld(true);
    const front = face
      .getWorldPosition(new THREE.Vector3())
      .sub(visual.position);
    front.y = 0;
    expect(
      front
        .normalize()
        .dot(new THREE.Vector3(velocity.x, 0, velocity.z).normalize()),
    ).toBeCloseTo(1);
    const fleeing = walkerVelocity(
      walker,
      { x: 2, z: 1 },
      { x: 0, z: 0, radius: 0.9 },
      0.47,
      1 / 60,
      () => 0.5,
    );
    visual.rotation.y = walker.heading;
    visual.updateMatrixWorld(true);
    front.copy(face.getWorldPosition(new THREE.Vector3())).sub(visual.position);
    front.y = 0;
    expect(
      front
        .normalize()
        .dot(new THREE.Vector3(fleeing.x, 0, fleeing.z).normalize()),
    ).toBeCloseTo(1);
  }
  animateWalker(visual, Math.PI / 2, false, false);
  const leg = visual.children.find((part) => part.userData.stride)!;
  expect(Math.abs(leg.rotation.x)).toBeCloseTo(0.3);
  expect(leg.rotation.z).toBe(0);
  animateWalker(visual, 1, false, true);
  expect(leg.rotation.x).toBe(0);
  disposeScene(visual);
});

it("アメリカの家は屋根と壁を重ねず、ポーチ・煙突を含めて物理寸法に収まる", () => {
  const visual = objectVisual("house", "america");
  visual.updateMatrixWorld(true);
  const walls = new THREE.Box3().setFromObject(
    visual.getObjectByName("walls")!,
  );
  const roof = new THREE.Box3().setFromObject(visual.getObjectByName("roof")!);
  expect(walls.max.y).toBeCloseTo(roof.min.y);
  const whole = new THREE.Box3().setFromObject(visual);
  const size = OBJECT_TYPES.house.size;
  expect(whole.min.y).toBeCloseTo(-size[1] / 2);
  expect(whole.max.y).toBeCloseTo(size[1] / 2);
  expect(whole.max.x - whole.min.x).toBeLessThanOrEqual(size[0]);
  expect(whole.max.z - whole.min.z).toBeLessThanOrEqual(size[2]);
  disposeScene(visual);
});

it("エジプトの人は薄い板で、壁画のポーズを歩行アニメーションが立体的に崩さない", () => {
  const visual = objectVisual("egyptian");
  visual.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(visual);
  expect(bounds.max.x - bounds.min.x).toBeLessThanOrEqual(
    OBJECT_TYPES.egyptian.size[0],
  );
  expect(bounds.max.y - bounds.min.y).toBeGreaterThan(1.2);
  expect(bounds.max.z - bounds.min.z).toBeGreaterThan(0.4);
  const before = bounds.clone();
  animateWalker(visual, Math.PI / 2, true, false);
  visual.updateMatrixWorld(true);
  expect(new THREE.Box3().setFromObject(visual).equals(before)).toBe(true);
  disposeScene(visual);
});
