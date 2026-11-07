import { expect, it } from "vitest";
import * as THREE from "three";
import { HoleOcclusion } from "../src/game/occlusion";

it("重なった遮蔽物だけを透過し、共有材質を汚さず、通過後に復帰する", () => {
  const camera = new THREE.PerspectiveCamera(44, 1, 0.01, 100);
  camera.position.set(0, 4, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const material = new THREE.MeshBasicMaterial({ color: "red" });
  const objects = [
    new THREE.Vector3(0, 2, 2.5),
    new THREE.Vector3(0, 1, 1.25),
    new THREE.Vector3(5, 0.5, 0),
  ].map((at, index) => {
    const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    object.position.copy(at);
    object.userData.objectId = String(index);
    object.updateMatrixWorld();
    return object;
  });
  const occlusion = new HoleOcclusion();
  const hole = { x: 0, z: 0, radius: 0.15 };
  occlusion.update(
    camera,
    hole,
    objects.map((object) => ({ object, footprint: Math.SQRT1_2 })),
    0.2,
  );
  expect(occlusion.snapshot().map(({ id }) => id)).toEqual(["0", "1"]);
  expect(material.opacity).toBe(1);
  expect(objects[2].material).toBe(material);
  expect(objects[0].material.opacity).toBeLessThan(0.3);
  for (const object of objects) {
    object.position.x += 10;
    object.updateMatrixWorld();
  }
  occlusion.update(
    camera,
    hole,
    objects.map((object) => ({ object, footprint: Math.SQRT1_2 })),
    0.4,
  );
  expect(occlusion.snapshot()).toEqual([]);
  expect(objects[0].material).toBe(material);
  occlusion.dispose();
  for (const object of objects) object.geometry.dispose();
  material.dispose();
});

it("カメラが大きな物の内部に入っても透過し、回収時に材質を戻す", () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1, 0);
  const object = new THREE.Mesh(
    new THREE.BoxGeometry(4, 4, 4),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  object.updateMatrixWorld();
  const original = object.material;
  const occlusion = new HoleOcclusion();
  occlusion.update(
    camera,
    { x: 0, z: -3, radius: 0.1 },
    [{ object, footprint: 3 }],
    0.2,
  );
  expect(occlusion.snapshot()).toHaveLength(1);
  occlusion.remove(object);
  expect(object.material).toBe(original);
  expect(occlusion.snapshot()).toEqual([]);
  object.geometry.dispose();
  original.dispose();
});

function cameraAboveHole() {
  const camera = new THREE.PerspectiveCamera(44, 1, 0.01, 100);
  camera.position.set(0, 4, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}

it("飲み込める細い物は、遠近法で穴を覆っても透過しない", () => {
  const object = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1, 0.1),
    new THREE.MeshBasicMaterial(),
  );
  object.position.set(0, 3.75, 4.7);
  object.updateMatrixWorld();
  const occlusion = new HoleOcclusion(),
    camera = cameraAboveHole();
  occlusion.update(
    camera,
    { x: 0, z: 0, radius: 0.2 },
    [{ object, footprint: Math.hypot(0.1, 0.1) / 2 }],
    0.2,
  );
  expect(occlusion.snapshot()).toEqual([]);
  occlusion.update(
    camera,
    { x: 0, z: 0, radius: 0.2 },
    [{ object, footprint: 1 }],
    0.2,
  );
  expect(occlusion.snapshot()).toHaveLength(1);
  occlusion.dispose();
  object.geometry.dispose();
  object.material.dispose();
});

it("大きな物でも穴の一部だけを隠す場合は透過しない", () => {
  const object = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial(),
  );
  object.position.set(0.6, 2, 2.5);
  object.updateMatrixWorld();
  const occlusion = new HoleOcclusion();
  occlusion.update(
    cameraAboveHole(),
    { x: 0, z: 0, radius: 0.3 },
    [{ object, footprint: Math.SQRT1_2 }],
    0.2,
  );
  expect(occlusion.snapshot()).toEqual([]);
  object.geometry.dispose();
  object.material.dispose();
});

it("外枠にカメラが入っても、空いている隙間は遮蔽として扱わない", () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1, 0);
  camera.lookAt(0, 0, -5);
  camera.updateMatrixWorld();
  const object = new THREE.Group();
  for (const x of [-1, 1]) {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 4, 6),
      new THREE.MeshBasicMaterial(),
    );
    pillar.position.set(x, 1, 0);
    object.add(pillar);
  }
  object.updateMatrixWorld(true);
  const occlusion = new HoleOcclusion();
  occlusion.update(
    camera,
    { x: 0, z: -5, radius: 0.1 },
    [{ object, footprint: 4 }],
    0.2,
  );
  expect(occlusion.snapshot()).toEqual([]);
  object.traverse((part) => {
    if (part instanceof THREE.Mesh) {
      part.geometry.dispose();
      part.material.dispose();
    }
  });
});

it("成長して飲み込めるサイズになった時点で材質を戻す", () => {
  const object = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial(),
  );
  object.position.set(0, 2, 2.5);
  object.updateMatrixWorld();
  const original = object.material,
    camera = cameraAboveHole(),
    occlusion = new HoleOcclusion();
  occlusion.update(
    camera,
    { x: 0, z: 0, radius: 0.1 },
    [{ object, footprint: Math.SQRT1_2 }],
    0.2,
  );
  expect(occlusion.snapshot()).toHaveLength(1);
  occlusion.update(
    camera,
    { x: 0, z: 0, radius: 1 },
    [{ object, footprint: Math.SQRT1_2 }],
    0.01,
  );
  expect(occlusion.snapshot()).toEqual([]);
  expect(object.material).toBe(original);
  object.geometry.dispose();
  object.material.dispose();
});

it("MSAAが使える場合は透過中も深度を保ち、部品の透明描画ソートを使わない", () => {
  const object = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial(),
  );
  object.position.set(0, 2, 2.5);
  object.updateMatrixWorld();
  const original = object.material,
    occlusion = new HoleOcclusion(4);
  occlusion.update(
    cameraAboveHole(),
    { x: 0, z: 0, radius: 0.1 },
    [{ object, footprint: 1 }],
    0.2,
  );
  expect(occlusion.mode).toBe("coverage");
  expect(object.material.alphaToCoverage).toBe(true);
  expect(object.material.transparent).toBe(false);
  expect(object.material.depthWrite).toBe(true);
  expect(object.material.opacity).toBe(0.25);
  expect(original.alphaToCoverage).toBe(false);
  occlusion.dispose();
  expect(object.material).toBe(original);
  object.geometry.dispose();
  original.dispose();
});

it("MSAAがない環境では通常の半透明描画へ戻す", () => {
  const object = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial(),
  );
  object.position.set(0, 2, 2.5);
  object.updateMatrixWorld();
  const original = object.material,
    occlusion = new HoleOcclusion(0);
  occlusion.update(
    cameraAboveHole(),
    { x: 0, z: 0, radius: 0.1 },
    [{ object, footprint: 1 }],
    0.2,
  );
  expect(occlusion.mode).toBe("blend");
  expect(object.material.alphaToCoverage).toBe(false);
  expect(object.material.transparent).toBe(true);
  expect(object.material.depthWrite).toBe(false);
  expect(object.material.opacity).toBe(0.25);
  occlusion.dispose();
  object.geometry.dispose();
  original.dispose();
});

it("別の遮蔽物の出入りで、すでに透過中の物の濃さを変えない", () => {
  const objects = [
    new THREE.Vector3(0, 2, 2.5),
    new THREE.Vector3(0, 1, 1.25),
  ].map((position) => {
    const object = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
    );
    object.position.copy(position);
    object.updateMatrixWorld();
    return object;
  });
  const originals = objects.map((o) => o.material),
    camera = cameraAboveHole(),
    occlusion = new HoleOcclusion(4),
    hole = { x: 0, z: 0, radius: 0.1 };
  occlusion.update(camera, hole, [{ object: objects[0], footprint: 1 }], 0.2);
  const opacity = objects[0].material.opacity;
  for (let i = 0; i < 20; i++) {
    const targets = (i % 2 ? objects : [objects[0]]).map((object) => ({
      object,
      footprint: 1,
    }));
    occlusion.update(camera, hole, targets, 1 / 60);
    expect(objects[0].material.opacity).toBe(opacity);
  }
  occlusion.dispose();
  objects.forEach((o, i) => {
    o.geometry.dispose();
    originals[i].dispose();
  });
});

it("透過へ再進入した際は同じ材質を再利用し、物を除去した際に一度だけ破棄する", () => {
  const object = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial(),
  );
  object.position.set(0, 2, 2.5);
  object.updateMatrixWorld();
  const original = object.material,
    camera = cameraAboveHole(),
    occlusion = new HoleOcclusion(4),
    hole = { x: 0, z: 0, radius: 0.1 },
    targets = [{ object, footprint: 1 }];
  occlusion.update(camera, hole, targets, 0.2);
  const faded = object.material;
  let disposed = 0;
  faded.addEventListener("dispose", () => disposed++);
  for (let i = 0; i < 5; i++) {
    object.position.x = 10;
    object.updateMatrixWorld();
    occlusion.update(camera, hole, targets, 0.4);
    expect(object.material).toBe(original);
    expect(occlusion.snapshot()).toHaveLength(0);
    expect(disposed).toBe(0);
    object.position.x = 0;
    object.updateMatrixWorld();
    occlusion.update(camera, hole, targets, 0.2);
    expect(object.material).toBe(faded);
  }
  occlusion.remove(object);
  expect(disposed).toBe(1);
  expect(object.material).toBe(original);
  occlusion.dispose();
  expect(disposed).toBe(1);
  object.geometry.dispose();
  original.dispose();
});

it("短い遮蔽判定の欠落では透過を戻さず、継続して遮らなければ元へ戻す", () => {
  const object = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial(),
  );
  object.position.set(0, 2, 2.5);
  object.updateMatrixWorld();
  const original = object.material,
    camera = cameraAboveHole(),
    occlusion = new HoleOcclusion(4),
    hole = { x: 0, z: 0, radius: 0.1 },
    targets = [{ object, footprint: 1 }];
  occlusion.update(camera, hole, targets, 0.2);
  for (let i = 0; i < 10; i++) {
    object.position.x = 10;
    object.updateMatrixWorld();
    occlusion.update(camera, hole, targets, 0.06);
    expect(object.material.opacity).toBe(0.25);
    object.position.x = 0;
    object.updateMatrixWorld();
    occlusion.update(camera, hole, targets, 0.06);
    expect(object.material.opacity).toBe(0.25);
  }
  object.position.x = 10;
  object.updateMatrixWorld();
  occlusion.update(camera, hole, targets, 0.4);
  expect(object.material).toBe(original);
  occlusion.dispose();
  object.geometry.dispose();
  original.dispose();
});
