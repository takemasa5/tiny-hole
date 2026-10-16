import * as THREE from "three";
import type { ObjectKind } from "./stage";

function material(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
}

function wood(length: number, radius: number) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 10),
    [material("#805538"), material("#e2ba7d"), material("#e2ba7d")],
  );
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

function firewoodVisual() {
  const group = new THREE.Group();
  for (const y of [-0.08, 0.08]) {
    for (const z of [-0.16, 0, 0.16]) {
      const piece = wood(0.7, 0.075);
      piece.position.set(0, y, z);
      group.add(piece);
    }
  }
  for (const x of [-0.21, 0.21]) {
    const rope = new THREE.Mesh(
      new THREE.TorusGeometry(0.19, 0.008, 5, 12),
      material("#dfc896"),
    );
    rope.scale.set(1.2, 0.8, 1);
    rope.rotation.y = Math.PI / 2;
    rope.position.x = x;
    group.add(rope);
  }
  return group;
}

function logVisual() {
  const group = new THREE.Group();
  group.add(wood(1.8, 0.23));
  for (const x of [-0.901, 0.901]) {
    const grain = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.115, 12),
      new THREE.MeshStandardMaterial({
        color: "#af7d49",
        side: THREE.DoubleSide,
      }),
    );
    grain.rotation.y = Math.PI / 2;
    grain.position.x = x;
    group.add(grain);
  }
  return group;
}

function burgerBoxVisual() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.18, 0.56),
    material("#e7b86f"),
  );
  base.position.y = -0.035;
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.07, 0.6),
    material("#fff0cb"),
  );
  lid.position.y = 0.09;
  group.add(base, lid);
  // An unbranded burger mark keeps the tiny carton readable from above.
  for (const [z, depth, color] of [
    [-0.08, 0.09, "#de9a47"],
    [0, 0.035, "#6c9b55"],
    [0.045, 0.045, "#b96542"],
    [0.11, 0.06, "#de9a47"],
  ] as const) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.002, depth),
      material(color),
    );
    stripe.position.set(0, 0.127, z);
    group.add(stripe);
  }
  return group;
}

function tireVisual() {
  const group = new THREE.Group();
  const rubber = material("#343940");
  const tire = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.16, 8, 16),
    rubber,
  );
  tire.rotation.x = Math.PI / 2;
  group.add(tire);
  for (let index = 0; index < 16; index++) {
    const angle = (index * Math.PI) / 8;
    const tread = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.16, 0.03),
      material("#252a30"),
    );
    tread.position.set(Math.sin(angle) * 0.48, 0, Math.cos(angle) * 0.48);
    tread.rotation.y = angle;
    group.add(tread);
  }
  return group;
}

export function stackObjectVisual(kind: ObjectKind) {
  switch (kind) {
    case "firewood":
      return firewoodVisual();
    case "log":
      return logVisual();
    case "burgerBox":
      return burgerBoxVisual();
    case "tire":
      return tireVisual();
    default:
      return undefined;
  }
}
