import * as THREE from "three";
import { shootingVisual } from "./shooting";

function mesh(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  color: string,
  at: number[],
) {
  const object = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
  );
  object.position.set(at[0], at[1], at[2]);
  group.add(object);
  return object;
}
function box(group: THREE.Group, size: number[], color: string, at: number[]) {
  return mesh(
    group,
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    color,
    at,
  );
}
function round(
  group: THREE.Group,
  size: number[],
  color: string,
  at: number[],
) {
  const object = mesh(group, new THREE.SphereGeometry(1, 16, 12), color, at);
  object.scale.set(size[0], size[1], size[2]);
  return object;
}
function limb(group: THREE.Group, side: number, at: number[]) {
  const pivot = new THREE.Group();
  pivot.position.set(at[0], at[1], at[2]);
  pivot.userData.stride = side;
  group.add(pivot);
  return pivot;
}

export function americanVisual() {
  const group = new THREE.Group();
  const skin = "#d6a17b";
  round(group, [0.205, 0.29, 0.15], "#f7f5ed", [0, 0.035, 0]);
  round(group, [0.15, 0.16, 0.145], skin, [0, 0.47, 0]);
  mesh(
    group,
    new THREE.SphereGeometry(
      0.153,
      16,
      12,
      0,
      Math.PI * 2,
      Math.PI / 2,
      Math.PI / 2,
    ),
    "#51423b",
    [0, 0.47, 0],
  );
  round(group, [0.027, 0.034, 0.03], skin, [0, 0.47, 0.148]);
  for (const side of [-1, 1]) {
    box(group, [0.115, 0.06, 0.025], "#28333b", [side * 0.075, 0.5, 0.137]);
    const leg = limb(group, side, [side * 0.095, -0.21, 0]);
    box(leg, [0.16, 0.22, 0.17], "#69714e", [0, -0.11, 0]);
    round(leg, [0.062, 0.11, 0.065], skin, [0, -0.28, 0]);
    round(leg, [0.082, 0.045, 0.105], "#344047", [0, -0.395, 0.025]);
    const arm = limb(group, -side, [side * 0.22, 0.22, 0]);
    box(arm, [0.1, 0.16, 0.15], "#f7f5ed", [0, -0.07, 0]);
    round(arm, [0.045, 0.13, 0.055], skin, [0, -0.23, 0]);
  }
  box(group, [0.045, 0.015, 0.02], "#28333b", [0, 0.5, 0.157]);
  box(group, [0.07, 0.012, 0.015], "#f8e4c5", [0, 0.393, 0.131]);
  const strap = box(
    group,
    [0.022, 0.45, 0.018],
    "#52584a",
    [0.015, 0.09, 0.155],
  );
  strap.rotation.z = 0.38;
  box(group, [0.15, 0.18, 0.08], "#5b6149", [0.11, -0.08, 0.18]);
  box(group, [0.1, 0.12, 0.38], "#4c5961", [0.2, 0.04, 0.34]);
  group.add(shootingVisual());
  return group;
}

export function tanukiVisual() {
  const group = new THREE.Group();
  const brown = "#a68c73",
    cream = "#dfceb7",
    mask = "#65533f";
  round(group, [0.225, 0.23, 0.275], brown, [0, -0.07, -0.08]);
  round(group, [0.18, 0.18, 0.12], cream, [0, -0.07, 0.13]);
  const face = new THREE.Group();
  face.name = "face";
  face.position.set(0, 0.12, 0.15);
  group.add(face);
  round(face, [0.21, 0.185, 0.17], brown, [0, 0, 0]);
  for (const side of [-1, 1]) {
    round(face, [0.064, 0.055, 0.044], brown, [side * 0.145, 0.15, -0.018]);
    round(face, [0.035, 0.031, 0.022], mask, [side * 0.145, 0.15, 0.02]);
    round(face, [0.061, 0.079, 0.018], mask, [side * 0.079, 0.003, 0.151]);
    round(face, [0.025, 0.025, 0.013], "#201d19", [side * 0.078, 0.016, 0.171]);
    round(face, [0.007, 0.007, 0.005], "#fff8e8", [
      side * 0.078 - 0.006,
      0.023,
      0.182,
    ]);
    for (const end of [-1, 1]) {
      const leg = limb(group, side * end, [
        side * 0.145,
        -0.13,
        end * 0.12 - 0.05,
      ]);
      round(leg, [0.055, 0.085, 0.06], brown, [0, -0.085, 0]);
      round(leg, [0.064, 0.05, 0.083], mask, [0, -0.145, 0.025]);
    }
  }
  round(face, [0.09, 0.066, 0.074], cream, [0, -0.06, 0.165]);
  round(face, [0.023, 0.018, 0.014], "#201d19", [0, -0.021, 0.23]);
  for (let index = 0; index < 3; index++) {
    round(
      group,
      [0.087 - index * 0.01, 0.077 - index * 0.01, 0.06],
      index % 2 ? mask : brown,
      [0, -0.08, -0.28 - index * 0.035],
    );
  }
  return group;
}

function gableRoof(group: THREE.Group) {
  const vertices = new Float32Array([
    -1.725, 0.25, 1.175, 1.725, 0.25, 1.175, 0, 1.65, 1.175, -1.725, 0.25,
    -1.675, 1.725, 0.25, -1.675, 0, 1.65, -1.675,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex([
    0, 1, 2, 4, 3, 5, 0, 2, 5, 0, 5, 3, 2, 1, 4, 2, 4, 5, 0, 3, 4, 0, 4, 1,
  ]);
  geometry.addGroup(0, 6, 0);
  geometry.addGroup(6, 18, 1);
  geometry.computeVertexNormals();
  const roof = new THREE.Mesh(geometry, [
    new THREE.MeshStandardMaterial({ color: "#d5c6a0", roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: "#65737c", roughness: 0.9 }),
  ]);
  roof.name = "roof";
  group.add(roof);
}
function windowFrame(
  group: THREE.Group,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
) {
  box(group, [width, height, 0.045], "#f4eee0", [x, y, z]);
  box(group, [width - 0.1, height - 0.1, 0.025], "#526879", [x, y, z + 0.031]);
  box(group, [0.035, height - 0.09, 0.018], "#f4eee0", [x, y, z + 0.055]);
  box(group, [width - 0.09, 0.035, 0.018], "#f4eee0", [x, y, z + 0.055]);
}
export function americanHouseVisual() {
  const group = new THREE.Group();
  box(group, [3.2, 2.1, 2.6], "#d5c6a0", [0, -0.8, -0.3]).name = "walls";
  gableRoof(group);
  box(group, [0.3, 1, 0.38], "#a06951", [0.75, 1.5, -0.6]);
  box(group, [3.45, 0.18, 0.7], "#b0a18a", [0, -1.91, 1.38]);
  box(group, [3.45, 0.12, 0.7], "#f4eee0", [0, 0.14, 1.38]);
  for (const x of [-1.55, -0.65, 0.65, 1.55])
    box(group, [0.1, 1.99, 0.1], "#f4eee0", [x, -0.92, 1.65]);
  for (const side of [-1, 1]) {
    box(group, [0.9, 0.07, 0.07], "#f4eee0", [side * 1.1, -1.2, 1.65]);
    for (let index = 0; index < 5; index++)
      box(group, [0.04, 0.54, 0.04], "#f4eee0", [
        side * (0.72 + index * 0.2),
        -1.48,
        1.65,
      ]);
    windowFrame(group, side * 1.02, -0.53, 1.033, 0.58, 1.05);
  }
  for (let y = -1.7; y < 0.2; y += 0.22)
    box(group, [3.19, 0.017, 0.014], "#b9aa87", [0, y, 1.012]);
  box(group, [0.62, 1.5, 0.06], "#f4eee0", [0, -1.0, 1.04]);
  box(group, [0.48, 1.39, 0.025], "#8d5148", [0, -1.0, 1.085]);
  windowFrame(group, 0, 0.77, 1.203, 0.55, 0.58);
  return group;
}
