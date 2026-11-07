import { beforeAll, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ToyWorldScene } from "../src/game/toy-world-scene";
import { HoleOcclusion } from "../src/game/occlusion";
import { disposeScene } from "../src/game/visuals";
beforeAll(async () => {
  await RAPIER.init();
});
function setup(radius: number, z: number) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }),
    room = new ToyWorldScene(world, new Set());
  const camera = new THREE.PerspectiveCamera(
      44,
      390 / 844,
      radius * 0.015,
      16000,
    ),
    scale = (radius * 844) / 390;
  camera.position.set(0, 7.6 * scale, z + 6.8 * scale);
  camera.lookAt(0, 0, z);
  camera.updateMatrixWorld();
  room.group.updateMatrixWorld(true);
  const hole = { x: 0, z, radius },
    occlusion = new HoleOcclusion(4);
  const target = room.occluders()[0],
    frame = target.object;
  const meshes: THREE.Mesh[] = [];
  frame.traverse((p) => {
    if (p instanceof THREE.Mesh) meshes.push(p);
  });
  const originals = new Map(meshes.map((p) => [p, p.material]));
  return {
    world,
    room,
    camera,
    hole,
    occlusion,
    target,
    frame,
    meshes,
    originals,
    dispose() {
      occlusion.dispose();
      disposeScene(room.group);
      world.free();
    },
  };
}
it("レベル1の手前の壁で穴が隠れても、奥の壁と蓋は透過しない", () => {
  const s = setup(0.08, 0.4);
  try {
    s.occlusion.update(s.camera, s.hole, [s.target], 0.25);
    expect(s.occlusion.snapshot().length).toBeGreaterThan(0);
    const front = s.frame.children.find(
      (p) =>
        p instanceof THREE.Mesh &&
        Math.abs(p.position.z - 0.55) < 1e-6 &&
        p.position.y === 0.135,
    )!;
    const back = s.frame.children.find(
      (p) =>
        p instanceof THREE.Mesh &&
        Math.abs(p.position.z + 0.55) < 1e-6 &&
        p.position.y === 0.135,
    )!;
    expect(front).toBeDefined();
    expect(back).toBeDefined();
    expect((front as THREE.Mesh).material).not.toBe(
      s.originals.get(front as THREE.Mesh),
    );
    expect((back as THREE.Mesh).material).toBe(
      s.originals.get(back as THREE.Mesh),
    );
    const lid = s.frame.children.find(
      (p) => p instanceof THREE.Group && p.position.y === 0.27,
    )!;
    expect(lid).toBeDefined();
    lid.traverse((p) => {
      if (p instanceof THREE.Mesh) expect(p.material).toBe(s.originals.get(p));
    });
  } finally {
    s.dispose();
  }
});
it("レベル2の箱内では、手前の壁が穴全体を覆わなければ透過しない", () => {
  const s = setup(0.14, 0.39);
  try {
    s.occlusion.update(s.camera, s.hole, [s.target], 0.25);
    expect(s.occlusion.snapshot()).toEqual([]);
    for (const m of s.meshes) expect(m.material).toBe(s.originals.get(m));
  } finally {
    s.dispose();
  }
});

it("2枚の面が一緒に穴全体を隠す場合は両方を透過し、入る大きさになればまとめて戻す", () => {
  const camera = new THREE.PerspectiveCamera(44, 1, 0.01, 100);
  camera.position.set(0, 4, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const material = new THREE.MeshBasicMaterial(),
    group = new THREE.Group();
  for (const x of [-0.25, 0.25]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 1), material);
    mesh.position.set(x, 2, 2.5);
    group.add(mesh);
  }
  const behind = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  behind.position.set(0, 0, -3);
  group.add(behind);
  group.updateMatrixWorld(true);
  const occlusion = new HoleOcclusion(4),
    hole = { x: 0, z: 0, radius: 0.2 };
  occlusion.update(
    camera,
    hole,
    [{ object: group, footprint: 2, fadeSurfaces: true }],
    0.25,
  );
  expect(occlusion.snapshot()).toHaveLength(2);
  for (const part of group.children.slice(0, 2))
    expect((part as THREE.Mesh).material).not.toBe(material);
  expect(behind.material).toBe(material);
  occlusion.update(
    camera,
    hole,
    [{ object: group, footprint: 0.1, fadeSurfaces: true }],
    0.01,
  );
  expect(occlusion.snapshot()).toEqual([]);
  for (const part of group.children)
    expect((part as THREE.Mesh).material).toBe(material);
  occlusion.dispose();
  disposeScene(group);
});
it("面単位でも、穴の一部しか遮らない場合はどの面も透過しない", () => {
  const camera = new THREE.PerspectiveCamera(44, 1, 0.01, 100);
  camera.position.set(0, 4, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial(),
  );
  mesh.position.set(0.6, 2, 2.5);
  mesh.updateMatrixWorld();
  const original = mesh.material,
    occlusion = new HoleOcclusion(4);
  occlusion.update(
    camera,
    { x: 0, z: 0, radius: 0.3 },
    [{ object: mesh, footprint: 1, fadeSurfaces: true }],
    0.25,
  );
  expect(occlusion.snapshot()).toEqual([]);
  expect(mesh.material).toBe(original);
  occlusion.dispose();
  disposeScene(mesh);
});

it("箱の手前を出入りして透過が切り替わっても、奥の壁と蓋の材質は変化しない", () => {
  const s = setup(0.08, 0.4),
    back = s.frame.children.find(
      (p) =>
        p instanceof THREE.Mesh &&
        p.position.z === -0.55 &&
        p.position.y === 0.135,
    ) as THREE.Mesh,
    lid = s.frame.children.find(
      (p) => p instanceof THREE.Group && p.position.y === 0.27,
    )!;
  try {
    for (let step = 0; step < 120; step++) {
      s.hole.z = Math.floor(step / 12) % 2 ? 0.36 : 0.4;
      const scale = (s.hole.radius * 844) / 390;
      s.camera.position.set(0, 7.6 * scale, s.hole.z + 6.8 * scale);
      s.camera.lookAt(0, 0, s.hole.z);
      s.camera.updateMatrixWorld();
      s.occlusion.update(s.camera, s.hole, [s.target], 1 / 60);
      expect(back.material).toBe(s.originals.get(back));
      lid.traverse((p) => {
        if (p instanceof THREE.Mesh)
          expect(p.material).toBe(s.originals.get(p));
      });
    }
  } finally {
    s.dispose();
  }
});
