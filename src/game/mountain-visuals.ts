import * as THREE from "three";
import { objectVisual } from "./visuals";
export type MountainKind =
  | "acorn"
  | "pinecone"
  | "twig"
  | "mushroom"
  | "leaf"
  | "pebble"
  | "fern"
  | "lantern"
  | "kettle"
  | "stool"
  | "campTable"
  | "tent"
  | "cooler"
  | "firewood"
  | "log"
  | "stump"
  | "cabin"
  | "logRack"
  | "truck"
  | "pine"
  | "oak"
  | "rock"
  | "torii"
  | "tanuki"
  | "deer"
  | "fox"
  | "greatTree"
  | "ancientTree"
  | "shrine"
  | "burrow"
  | "berries";
const bark = "#886443",
  wood = "#b48a58",
  cream = "#e6d5ae",
  green = "#638851",
  dark = "#3d5942";
function mat(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
}
function box(g: THREE.Group, size: number[], at: number[], color: string) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    mat(color),
  );
  m.position.set(at[0], at[1], at[2]);
  g.add(m);
  return m;
}
function cylinder(
  g: THREE.Group,
  top: number,
  bottom: number,
  h: number,
  at: number[],
  color: string,
  n = 10,
) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(top, bottom, h, n),
    mat(color),
  );
  m.position.set(at[0], at[1], at[2]);
  g.add(m);
  return m;
}
function ball(g: THREE.Group, size: number[], at: number[], color: string) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), mat(color));
  m.scale.set(size[0], size[1], size[2]);
  m.position.set(at[0], at[1], at[2]);
  g.add(m);
  return m;
}
function cone(
  g: THREE.Group,
  r: number,
  h: number,
  at: number[],
  color: string,
  n = 8,
) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, n), mat(color));
  m.position.set(at[0], at[1], at[2]);
  g.add(m);
  return m;
}
function log(g: THREE.Group, at: number[], length = 1, r = 0.16) {
  const m = cylinder(g, r, r, length, at, bark, 12);
  m.rotation.z = Math.PI / 2;
  return m;
}
function foliage(g: THREE.Group, old: boolean) {
  cylinder(g, old ? 0.13 : 0.09, old ? 0.23 : 0.14, 0.95, [0, -0.03, 0], bark);
  for (const [x, z] of [
    [-0.3, 0.05],
    [0.27, 0.1],
    [0.02, -0.3],
  ]) {
    const root = cylinder(
      g,
      0.05,
      old ? 0.12 : 0.07,
      0.55,
      [x / 2, -0.38, z / 2],
      bark,
      8,
    );
    root.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(x, 0, z).normalize(),
    );
    root.updateMatrixWorld(true);
    // Keep the visible roots and the flat trunk base on one ground plane.
    root.position.y += -0.505 - new THREE.Box3().setFromObject(root).min.y;
  }
  for (const [x, y, z, s] of [
    [0, 0.55, 0, 0.75],
    [-0.3, 0.31, 0.05, 0.7],
    [0.3, 0.36, 0.03, 0.65],
    [0.02, 0.25, -0.25, 0.65],
  ])
    ball(g, [s, s * 0.75, s], [x, y, z], old ? dark : green);
}
function cabin(g: THREE.Group, shrine: boolean) {
  const wall = shrine ? "#ad6750" : wood;
  box(g, [1, 0.07, 0.9], [0, -0.46, 0], bark);
  for (const x of [-0.45, 0.45])
    box(g, [0.08, 0.75, 0.82], [x, -0.05, 0], wall);
  box(g, [0.92, 0.75, 0.08], [0, -0.05, -0.38], wall);
  for (const x of [-0.32, 0.32])
    box(g, [0.27, 0.75, 0.08], [x, -0.05, 0.38], wall);
  box(g, [0.38, 0.15, 0.08], [0, 0.25, 0.38], wall);
  for (const side of [-1, 1]) {
    const roof = box(
      g,
      [0.65, 0.07, 1.02],
      [side * 0.24, 0.43, 0],
      shrine ? "#53645e" : "#657979",
    );
    roof.rotation.z = -side * 0.52;
  }
  if (shrine) box(g, [0.07, 0.25, 0.12], [0, 0.68, 0], wood);
  else box(g, [0.12, 0.4, 0.14], [0.25, 0.6, -0.15], "#9f9d8e");
}
function animal(g: THREE.Group, fox: boolean) {
  const fur = fox ? "#bd7946" : "#a78357";
  ball(g, [0.43, 0.43, 0.8], [0, 0, -0.04], fur);
  for (const x of [-0.15, 0.15])
    for (const z of [-0.25, 0.22]) {
      const leg = new THREE.Group();
      leg.position.set(x, -0.15, z);
      leg.userData.stride = x * z > 0 ? 1 : -1;
      box(leg, [0.075, 0.38, 0.08], [0, -0.18, 0], fur);
      g.add(leg);
    }
  ball(g, [0.27, 0.3, 0.3], [0, 0.23, 0.34], fur);
  ball(g, [0.18, 0.13, 0.25], [0, 0.18, 0.48], fox ? cream : fur);
  for (const x of [-0.12, 0.12]) cone(g, 0.075, 0.2, [x, 0.43, 0.32], fur, 4);
  for (const x of [-0.1, 0.1])
    ball(g, [0.04, 0.04, 0.04], [x, 0.27, 0.47], "#303a31");
  if (fox) {
    const tail = ball(g, [0.24, 0.24, 0.65], [0, 0.04, -0.57], fur);
    tail.rotation.x = -0.3;
    ball(g, [0.19, 0.19, 0.2], [0, 0.13, -0.83], cream);
  } else
    for (const side of [-1, 1]) {
      const horn = cylinder(
        g,
        0.016,
        0.03,
        0.35,
        [side * 0.11, 0.57, 0.32],
        wood,
        6,
      );
      horn.rotation.z = -side * 0.35;
      const branch = cylinder(
        g,
        0.012,
        0.02,
        0.18,
        [side * 0.18, 0.64, 0.32],
        wood,
        6,
      );
      branch.rotation.z = -side * 0.9;
    }
}
export function mountainVisual(kind: MountainKind) {
  const g = new THREE.Group();
  if (kind === "tanuki") g.add(objectVisual("tanuki", "mountain"));
  else if (kind === "acorn") {
    ball(g, [0.65, 0.8, 0.65], [0, -0.04, 0], "#ae7d45");
    cylinder(g, 0.38, 0.38, 0.18, [0, 0.3, 0], bark);
    cylinder(g, 0.03, 0.04, 0.15, [0, 0.44, 0], bark, 6);
  } else if (kind === "pinecone") {
    for (let layer = 0; layer < 4; layer++)
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5 + layer * 0.5,
          r = 0.2 * (1 - layer * 0.15);
        ball(
          g,
          [0.22, 0.2, 0.22],
          [Math.sin(a) * r, layer * 0.18 - 0.25, Math.cos(a) * r],
          i % 2 ? bark : wood,
        );
      }
  } else if (kind === "leaf") {
    ball(g, [1, 0.08, 0.6], [0, 0, 0], "#b09653");
    box(g, [0.85, 0.015, 0.018], [0, 0.045, 0], cream);
  } else if (kind === "twig") {
    const m = cylinder(g, 0.025, 0.05, 1, [0, 0, 0], bark, 7);
    m.rotation.z = Math.PI / 2;
    const side = cylinder(g, 0.015, 0.028, 0.45, [0.12, 0.08, 0], bark, 6);
    side.rotation.z = -0.7;
  } else if (kind === "mushroom") {
    cylinder(g, 0.08, 0.13, 0.5, [0, -0.2, 0], cream);
    ball(g, [1, 0.35, 0.8], [0, 0.13, 0], "#ba7752");
  } else if (kind === "pebble" || kind === "rock")
    ball(g, [1, 0.7, 0.8], [0, 0, 0], "#929c8b");
  else if (kind === "fern") {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const leaf = cone(
        g,
        0.11,
        0.8,
        [Math.sin(a) * 0.21, 0.1, Math.cos(a) * 0.21],
        i % 2 ? green : dark,
        4,
      );
      leaf.rotation.z = -Math.sin(a) * 0.55;
      leaf.rotation.x = Math.cos(a) * 0.55;
      leaf.updateMatrixWorld(true);
      // All visible leaf bases share the ground instead of balancing on the lowest leaf.
      leaf.position.y += -0.3 - new THREE.Box3().setFromObject(leaf).min.y;
    }
  } else if (kind === "lantern") {
    cylinder(g, 0.25, 0.3, 0.12, [0, -0.4, 0], dark);
    for (const x of [-0.18, 0.18])
      for (const z of [-0.18, 0.18])
        box(g, [0.03, 0.6, 0.03], [x, -0.06, z], dark);
    ball(g, [0.25, 0.4, 0.25], [0, -0.05, 0], "#ebc56c");
    cone(g, 0.34, 0.2, [0, 0.35, 0], dark);
    box(g, [0.04, 0.2, 0.04], [0, 0.52, 0], dark);
  } else if (kind === "kettle") {
    ball(g, [0.7, 0.65, 0.65], [0, -0.07, 0], "#84928a");
    cylinder(g, 0.25, 0.27, 0.08, [0, 0.23, 0], dark);
    const spout = cylinder(g, 0.06, 0.12, 0.35, [0.37, 0.03, 0], "#84928a");
    spout.rotation.z = -1.0;
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.035, 6, 12, Math.PI),
      mat(dark),
    );
    handle.position.y = 0.21;
    g.add(handle);
  } else if (kind === "stool" || kind === "campTable") {
    box(g, [1, 0.09, 0.7], [0, 0.32, 0], wood);
    for (const x of [-0.37, 0.37])
      for (const z of [-0.25, 0.25]) {
        const leg = box(g, [0.07, 0.75, 0.07], [x, -0.1, z], bark);
        leg.rotation.z = -x * 0.3;
      }
    if (kind === "campTable")
      for (const z of [-0.5, 0.5]) {
        box(g, [0.95, 0.08, 0.18], [0, -0.03, z], wood);
        for (const x of [-0.35, 0.35])
          box(g, [0.07, 0.45, 0.07], [x, -0.25, z], bark);
      }
  } else if (kind === "tent") {
    box(g, [1, 0.035, 0.95], [0, -0.37, 0], "#aa8654");
    for (const side of [-1, 1]) {
      const panel = box(
        g,
        [0.9, 0.035, 0.95],
        [side * 0.25, 0, 0],
        side < 0 ? "#e0bc72" : "#c2a36b",
      );
      panel.rotation.z = -side * 0.95;
    }
    const ridge = cylinder(g, 0.02, 0.02, 0.95, [0, 0.36, 0], bark, 6);
    ridge.rotation.x = Math.PI / 2;
  } else if (kind === "cooler") {
    box(g, [1, 0.65, 0.7], [0, -0.09, 0], "#6f9e9c");
    box(g, [1.04, 0.13, 0.74], [0, 0.3, 0], cream);
    for (const x of [-0.56, 0.56])
      box(g, [0.08, 0.22, 0.25], [x, 0.09, 0], dark);
  } else if (kind === "log") log(g, [0, 0, 0]);
  else if (kind === "firewood")
    for (const [y, z] of [
      [-0.12, -0.14],
      [-0.12, 0.14],
      [0.13, 0],
    ])
      log(g, [0, y, z], 0.85, 0.13);
  else if (kind === "logRack") {
    for (const x of [-0.37, 0.37])
      for (const z of [-0.3, 0.3])
        box(g, [0.06, 0.75, 0.06], [x, -0.05, z], dark);
    for (const [y, z] of [
      [-0.25, -0.2],
      [-0.25, 0.2],
      [0.05, -0.2],
      [0.05, 0.2],
      [0.3, 0],
    ])
      log(g, [0, y, z], 1, 0.14);
  } else if (kind === "stump") {
    cylinder(g, 0.3, 0.43, 0.85, [0, -0.03, 0], bark, 10);
    cylinder(g, 0.31, 0.31, 0.025, [0, 0.41, 0], wood, 10);
    for (const side of [-1, 1]) {
      const root = cylinder(
        g,
        0.06,
        0.15,
        0.5,
        [side * 0.25, -0.3, 0],
        bark,
        7,
      );
      root.rotation.z = -side * 0.8;
    }
  } else if (kind === "cabin" || kind === "shrine") cabin(g, kind === "shrine");
  else if (kind === "truck") {
    box(g, [1, 0.12, 0.45], [0, -0.12, 0], dark);
    box(g, [0.28, 0.42, 0.49], [0.33, 0.12, 0], "#6c9473");
    box(g, [0.31, 0.1, 0.52], [0.33, 0.38, 0], cream);
    for (const x of [-0.35, 0.27])
      for (const z of [-0.27, 0.27]) {
        const wheel = cylinder(g, 0.13, 0.13, 0.1, [x, -0.22, z], "#3c4648");
        wheel.rotation.x = Math.PI / 2;
      }
    for (const [y, z] of [
      [0.02, -0.13],
      [0.02, 0.13],
      [0.24, 0],
    ])
      log(g, [-0.15, y, z], 0.6, 0.1);
    for (const x of [-0.43, 0.1])
      for (const z of [-0.23, 0.23])
        box(g, [0.035, 0.45, 0.035], [x, 0.11, z], dark);
  } else if (kind === "pine") {
    cylinder(g, 0.07, 0.15, 0.85, [0, -0.16, 0], bark);
    for (const [y, r] of [
      [0.03, 0.45],
      [0.3, 0.35],
      [0.55, 0.23],
    ])
      cone(g, r, 0.65, [0, y, 0], dark);
  } else if (kind === "oak" || kind === "ancientTree" || kind === "greatTree") {
    foliage(g, kind !== "oak");
    if (kind === "greatTree") {
      for (const side of [-1, 1]) {
        const b = cylinder(g, 0.045, 0.1, 0.65, [side * 0.25, 0.13, 0], bark);
        b.rotation.z = -side * 0.9;
      }
      const rope = new THREE.Mesh(
        new THREE.TorusGeometry(0.17, 0.014, 5, 12),
        mat(cream),
      );
      rope.rotation.x = Math.PI / 2;
      rope.position.y = -0.1;
      g.add(rope);
    }
  } else if (kind === "torii") {
    for (const x of [-0.35, 0.35])
      box(g, [0.1, 0.85, 0.1], [x, -0.05, 0], wood);
    box(g, [1, 0.1, 0.17], [0, 0.41, 0], bark);
    box(g, [0.85, 0.06, 0.12], [0, 0.21, 0], wood);
  } else if (kind === "deer" || kind === "fox") animal(g, kind === "fox");
  else if (kind === "burrow") {
    for (const x of [-0.35, 0.35])
      ball(g, [0.32, 0.5, 0.65], [x, -0.11, 0], "#83927a");
    ball(g, [0.9, 0.25, 0.65], [0, 0.21, 0], "#83927a");
  } else if (kind === "berries") {
    ball(g, [1, 0.7, 0.8], [0, 0, 0], green);
    for (const [x, y, z] of [
      [-0.24, 0.1, 0.31],
      [0.2, 0.2, 0.28],
      [0, 0.35, 0.1],
      [0.32, 0.05, 0],
    ])
      ball(g, [0.12, 0.12, 0.12], [x, y, z], "#b66758");
  }
  g.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(g),
    size = bounds.getSize(new THREE.Vector3()),
    centre = bounds.getCenter(new THREE.Vector3());
  if (Math.min(size.x, size.y, size.z) <= 0)
    throw new Error(`${kind}の山モデルが空です`);
  const fit = new THREE.Group();
  fit.scale.set(1 / size.x, 1 / size.y, 1 / size.z);
  fit.position.copy(centre).multiply(fit.scale).negate();
  fit.add(g);
  const result = new THREE.Group();
  result.add(fit);
  return result;
}
