import * as THREE from "three";
import { objectVisual } from "./visuals";
import type { ObjectKind } from "./stage";
export type PlazaKind =
  | "seed"
  | "pebble"
  | "petal"
  | "leaf"
  | "flower"
  | "bucket"
  | "ball"
  | "wateringCan"
  | "tricycle"
  | "bench"
  | "bin"
  | "slide"
  | "swing"
  | "tree"
  | "fountain"
  | "stall"
  | "lamp"
  | "shop"
  | "apartment"
  | "civicHall"
  | "person"
  | "van"
  | "monument";
const wood = "#b27d4d",
  green = "#538c6a",
  cream = "#ede0c1",
  ink = "#435366";
function material(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
}
function box(g: THREE.Group, size: number[], at: number[], color: string) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    material(color),
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
    material(color),
  );
  m.position.set(at[0], at[1], at[2]);
  g.add(m);
  return m;
}
function sphere(g: THREE.Group, size: number[], at: number[], color: string) {
  const m = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.5, 1),
    material(color),
  );
  m.scale.set(size[0], size[1], size[2]);
  m.position.set(at[0], at[1], at[2]);
  g.add(m);
  return m;
}
function paint(g: THREE.Group, z: number, panels: number[][], color: string) {
  const vertices: number[] = [];
  for (const [x, y, w, h] of panels)
    for (const [dx, dy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, -1],
      [1, 1],
      [-1, 1],
    ])
      vertices.push(x + (dx * w) / 2, y + (dy * h) / 2, z);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.computeVertexNormals();
  g.add(
    new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2,
      }),
    ),
  );
}
function openBucket(g: THREE.Group, color: string) {
  cylinder(g, 0.35, 0.35, 0.08, [0, -0.42, 0], color);
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5;
    const wall = box(
      g,
      [0.23, 0.78, 0.06],
      [Math.sin(a) * 0.35, 0, Math.cos(a) * 0.35],
      color,
    );
    wall.rotation.y = a;
  }
}
function wheels(g: THREE.Group, positions: number[][], radius: number) {
  for (const p of positions) {
    const m = cylinder(g, radius, radius, 0.12, p, ink);
    m.rotation.z = Math.PI / 2;
  }
}
function building(g: THREE.Group, kind: PlazaKind) {
  if (kind === "civicHall") {
    box(g, [0.95, 0.12, 0.9], [0, -0.44, 0], cream);
    box(g, [0.9, 0.62, 0.6], [0, -0.08, -0.15], "#c7bdb0");
    for (const x of [-0.36, -0.12, 0.12, 0.36])
      cylinder(g, 0.045, 0.045, 0.7, [x, -0.02, 0.33], cream, 8);
    box(g, [1, 0.14, 0.9], [0, 0.39, 0], cream);
    return;
  }
  const apartment = kind === "apartment";
  box(g, [0.92, 0.88, 0.82], [0, -0.06, 0], apartment ? "#b9c6c7" : "#e5bc8c");
  box(g, [1, 0.12, 0.92], [0, 0.44, 0], apartment ? "#7e9e97" : "#b36b58");
  const windows: number[][] = [];
  for (let y = 0; y < (apartment ? 5 : 2); y++)
    for (let x = 0; x < 3; x++)
      windows.push([
        (x - 1) * 0.26,
        y * (apartment ? 0.15 : 0.3) - 0.28,
        0.14,
        apartment ? 0.09 : 0.18,
      ]);
  paint(g, 0.411, windows, "#5d8190");
  if (!apartment)
    for (let i = 0; i < 5; i++) {
      const awning = box(
        g,
        [0.19, 0.04, 0.3],
        [(i - 2) * 0.19, -0.02, 0.52],
        i % 2 ? cream : green,
      );
      awning.rotation.x = 0.2;
    }
}
export function plazaVisual(kind: PlazaKind) {
  const g = new THREE.Group();
  const originals: Partial<Record<PlazaKind, ObjectKind>> = {
    flower: "flower",
    bench: "bench",
    tree: "tree",
    person: "person",
  };
  const original = originals[kind];
  if (original) g.add(objectVisual(original, "plaza"));
  else if (["seed", "petal", "pebble", "leaf"].includes(kind)) {
    sphere(
      g,
      [1, kind === "pebble" ? 0.55 : 0.18, 0.65],
      [0, 0, 0],
      kind === "petal"
        ? "#d886af"
        : kind === "leaf"
          ? "#6f9252"
          : kind === "seed"
            ? "#8f6845"
            : "#a0a29a",
    );
    if (kind === "leaf") box(g, [0.75, 0.025, 0.025], [0, 0.095, 0], "#b7bb6c");
  } else if (kind === "bucket" || kind === "bin")
    openBucket(g, kind === "bucket" ? "#e3ad55" : green);
  else if (kind === "ball") sphere(g, [1, 1, 1], [0, 0, 0], "#d97b63");
  else if (kind === "wateringCan") {
    cylinder(g, 0.26, 0.3, 0.62, [-0.1, -0.08, 0], green);
    const spout = cylinder(g, 0.08, 0.1, 0.55, [0.28, 0.07, 0], green);
    spout.rotation.z = -Math.PI / 3;
    box(g, [0.07, 0.5, 0.07], [-0.46, 0, 0], green);
    box(g, [0.25, 0.07, 0.07], [-0.36, 0.22, 0], green);
  } else if (kind === "tricycle") {
    wheels(
      g,
      [
        [0, -0.29, 0.36],
        [-0.28, -0.29, -0.28],
        [0.28, -0.29, -0.28],
      ],
      0.2,
    );
    box(g, [0.1, 0.12, 0.65], [0, -0.15, 0], "#d45f57");
    box(g, [0.36, 0.1, 0.3], [0, 0, -0.2], cream);
    box(g, [0.07, 0.65, 0.07], [0, 0.12, 0.32], "#d45f57");
    box(g, [0.55, 0.07, 0.1], [0, 0.43, 0.32], ink);
  } else if (kind === "slide") {
    for (const z of [-0.3, 0.3])
      box(g, [0.1, 0.85, 0.1], [-0.35, -0.06, z], "#dbb84d");
    box(g, [0.3, 0.08, 0.7], [-0.35, 0.38, 0], "#d78353");
    const ramp = box(g, [1.05, 0.065, 0.6], [0.15, -0.02, 0], "#6d9bb5");
    ramp.rotation.z = -0.7;
    for (const z of [-0.32, 0.32]) {
      const rail = box(g, [1.08, 0.1, 0.055], [0.15, 0.05, z], "#d78353");
      rail.rotation.z = -0.7;
    }
    for (let i = 0; i < 4; i++)
      box(g, [0.24, 0.05, 0.55], [-0.52, -0.4 + i * 0.2, 0], "#dbb84d");
  } else if (kind === "swing") {
    for (const x of [-0.42, 0.42])
      for (const z of [-1, 1]) {
        const leg = box(g, [0.065, 1, 0.065], [x, -0.02, z * 0.22], "#65a3b9");
        leg.rotation.x = z * 0.4;
      }
    box(g, [1, 0.085, 0.085], [0, 0.45, 0], "#d7b453");
    for (const x of [-0.15, 0.15])
      box(g, [0.02, 0.57, 0.02], [x, 0.12, 0], ink);
    box(g, [0.42, 0.06, 0.3], [0, -0.2, 0], "#cb7757");
  } else if (kind === "fountain") {
    cylinder(g, 0.48, 0.5, 0.08, [0, -0.44, 0], cream);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const wall = box(
        g,
        [0.25, 0.2, 0.05],
        [Math.sin(a) * 0.46, -0.3, Math.cos(a) * 0.46],
        "#bcb8a9",
      );
      wall.rotation.y = a;
    }
    cylinder(g, 0.08, 0.12, 0.65, [0, -0.08, 0], cream);
    cylinder(g, 0.24, 0.1, 0.09, [0, 0.25, 0], "#bad5d5");
    cylinder(g, 0.035, 0.04, 0.28, [0, 0.4, 0], "#a6d2db");
  } else if (kind === "stall") {
    for (const x of [-0.38, 0.38])
      for (const z of [-0.3, 0.3])
        box(g, [0.06, 0.85, 0.06], [x, -0.05, z], wood);
    box(g, [0.9, 0.16, 0.65], [0, -0.05, 0], wood);
    for (let i = 0; i < 5; i++)
      box(g, [0.2, 0.12, 0.9], [(i - 2) * 0.2, 0.44, 0], i % 2 ? cream : green);
    for (const x of [-0.25, 0, 0.25])
      sphere(g, [0.17, 0.16, 0.17], [x, 0.1, 0.12], "#d68c4f");
  } else if (kind === "lamp") {
    cylinder(g, 0.16, 0.23, 0.12, [0, -0.44, 0], ink);
    cylinder(g, 0.045, 0.06, 0.75, [0, -0.05, 0], ink);
    box(g, [0.32, 0.28, 0.32], [0, 0.35, 0], "#f1d99a");
    box(g, [0.4, 0.06, 0.4], [0, 0.52, 0], ink);
  } else if (["shop", "apartment", "civicHall"].includes(kind))
    building(g, kind);
  else if (kind === "van") {
    box(g, [0.9, 0.4, 0.58], [0, 0.03, 0], "#eee1c4");
    box(g, [0.42, 0.36, 0.55], [0.19, 0.34, 0], green);
    paint(g, 0.276, [[0.2, 0.37, 0.28, 0.17]], "#8eb6c2");
    for (const x of [-0.31, 0.31])
      for (const z of [-0.3, 0.3]) {
        const wheel = cylinder(g, 0.15, 0.15, 0.12, [x, -0.17, z], ink);
        wheel.rotation.x = Math.PI / 2;
      }
    box(g, [0.04, 0.09, 0.42], [0.46, 0.02, 0], "#e5b45e");
  } else if (kind === "monument") {
    box(g, [1, 0.07, 1], [0, -0.465, 0], "#d4c8aa");
    for (const x of [-0.26, 0.26])
      box(g, [0.17, 0.33, 0.55], [x, -0.265, 0], cream);
    box(g, [0.7, 0.12, 0.6], [0, -0.04, 0], cream);
    cylinder(g, 0.2, 0.3, 0.62, [0, 0.31, 0], cream, 4).rotation.y =
      Math.PI / 4;
    box(g, [0.3, 0.045, 0.3], [0, 0.64, 0], "#caa867");
    sphere(g, [0.19, 0.16, 0.19], [0, 0.74, 0], "#d4ae61");
  }
  g.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(g),
    size = bounds.getSize(new THREE.Vector3()),
    centre = bounds.getCenter(new THREE.Vector3());
  if (Math.min(size.x, size.y, size.z) <= 0)
    throw new Error(`${kind}の広場モデルが空です`);
  const fit = new THREE.Group();
  fit.scale.set(1 / size.x, 1 / size.y, 1 / size.z);
  fit.position.copy(centre).multiply(fit.scale).negate();
  fit.add(g);
  const result = new THREE.Group();
  result.add(fit);
  return result;
}
