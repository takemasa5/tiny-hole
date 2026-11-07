import * as THREE from "three";
import type { ToyKind } from "./toy-stage";
import { furnitureVisual } from "./furniture-visuals";

const colors = {
  blue: "#72aeca",
  red: "#e59180",
  yellow: "#edc35d",
  green: "#89b9a0",
  cream: "#f5e8c9",
  ink: "#486477",
};
function material(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72 });
}
function box(
  group: THREE.Group,
  size: [number, number, number],
  at: [number, number, number],
  color: string,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color));
  mesh.position.set(...at);
  group.add(mesh);
  return mesh;
}
function cylinder(
  group: THREE.Group,
  radius: number,
  height: number,
  at: [number, number, number],
  color: string,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 12),
    material(color),
  );
  mesh.position.set(...at);
  group.add(mesh);
  return mesh;
}
function sphere(
  group: THREE.Group,
  size: [number, number, number],
  at: [number, number, number],
  color: string,
) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 12, 8),
    material(color),
  );
  mesh.scale.set(...size);
  mesh.position.set(...at);
  group.add(mesh);
  return mesh;
}
function windows(
  group: THREE.Group,
  rows: number,
  columns: number,
  width: number,
  height: number,
  z: number,
) {
  for (const side of [-1, 1])
    for (let row = 0; row < rows; row++)
      for (let column = 0; column < columns; column++)
        box(
          group,
          [(width / columns) * 0.55, (height / rows) * 0.45, 0.012],
          [
            ((column + 0.5) / columns - 0.5) * width,
            ((row + 0.5) / rows - 0.5) * height,
            side * z,
          ],
          colors.ink,
        );
}
function vehicle(group: THREE.Group, kind: "miniCar" | "bus" | "truck") {
  box(
    group,
    [1, 0.3, 0.9],
    [0, -0.1, 0],
    kind === "truck" ? colors.green : colors.yellow,
  );
  if (kind === "bus") {
    box(group, [0.94, 0.55, 0.82], [0, 0.2, 0], colors.red);
    for (const side of [-1, 1])
      for (let window = 0; window < 4; window++)
        box(
          group,
          [0.16, 0.24, 0.014],
          [-0.33 + window * 0.22, 0.25, side * 0.424],
          colors.blue,
        );
  } else if (kind === "truck") {
    box(group, [0.59, 0.56, 0.82], [-0.18, 0.22, 0], colors.cream);
    box(group, [0.3, 0.5, 0.8], [0.35, 0.2, 0], colors.green);
    box(group, [0.014, 0.22, 0.62], [0.493, 0.26, 0], colors.blue);
  } else {
    box(group, [0.55, 0.35, 0.76], [-0.06, 0.3, 0], colors.blue);
    box(group, [0.014, 0.2, 0.6], [0.225, 0.3, 0], colors.cream);
  }
  for (const x of [-0.3, 0.3])
    for (const z of [-0.44, 0.44]) {
      const wheel = cylinder(group, 0.18, 0.12, [x, -0.32, z], colors.ink);
      wheel.rotation.x = Math.PI / 2;
    }
  for (const z of [-0.29, 0.29])
    box(group, [0.012, 0.1, 0.14], [0.493, -0.08, z], colors.cream);
}
function figure(group: THREE.Group, kind: "windupRobot" | "teddy" | "doll") {
  const teddy = kind === "teddy";
  const color = teddy ? "#bd916a" : kind === "doll" ? colors.red : colors.blue;
  const primitive = teddy ? sphere : box;
  primitive(group, [0.56, 0.43, 0.58], [0, -0.04, 0], color);
  primitive(
    group,
    [0.58, 0.3, 0.58],
    [0, 0.31, 0],
    teddy ? color : colors.cream,
  );
  for (const side of [-1, 1]) {
    if (teddy) sphere(group, [0.2, 0.2, 0.2], [side * 0.25, 0.4, 0], color);
    else if (kind === "doll")
      sphere(group, [0.16, 0.35, 0.3], [side * 0.3, 0.23, -0.09], "#805a45");
    const leg = new THREE.Group();
    leg.position.set(side * 0.16, -0.25, 0);
    primitive(leg, [0.24, 0.25, 0.37], [0, -0.125, 0.03], color);
    leg.userData.stride = side;
    group.add(leg);
    primitive(group, [0.18, 0.4, 0.3], [side * 0.36, -0.08, 0], color);
    box(group, [0.055, 0.06, 0.018], [side * 0.12, 0.34, 0.298], colors.ink);
  }
  box(
    group,
    [0.16, 0.05, 0.018],
    [0, 0.22, 0.3],
    teddy ? colors.ink : colors.red,
  );
  if (kind === "windupRobot") {
    box(group, [0.12, 0.18, 0.07], [0.4, 0.1, 0], colors.yellow);
    box(group, [0.18, 0.07, 0.07], [0.4, 0.1, 0], colors.yellow);
  }
}
function building(group: THREE.Group, kind: ToyKind) {
  if (kind === "radioTower") {
    box(group, [1, 0.08, 1], [0, -0.46, 0], colors.ink);
    for (const side of [-1, 1]) {
      const leg = box(
        group,
        [0.08, 0.85, 0.08],
        [side * 0.2, -0.02, side * 0.2],
        colors.red,
      );
      leg.rotation.z = side * 0.2;
    }
    for (const y of [-0.3, -0.05, 0.2])
      box(group, [0.64, 0.045, 0.64], [0, y, 0], colors.cream);
    cylinder(group, 0.035, 0.3, [0, 0.35, 0], colors.red);
    return;
  }
  if (kind === "filmCamera") {
    for (const side of [-1, 1]) {
      const leg = box(
        group,
        [0.08, 0.55, 0.1],
        [side * 0.23, -0.23, 0],
        colors.ink,
      );
      leg.rotation.z = -side * 0.3;
      const reel = cylinder(
        group,
        0.19,
        0.2,
        [side * 0.21, 0.31, 0],
        colors.ink,
      );
      reel.rotation.x = Math.PI / 2;
    }
    box(group, [0.6, 0.4, 0.54], [0, 0.07, 0], colors.green);
    const lens = cylinder(group, 0.17, 0.3, [0.34, 0.07, 0], colors.ink);
    lens.rotation.z = Math.PI / 2;
    return;
  }
  if (kind === "clockTower") {
    box(group, [0.7, 0.9, 0.7], [0, -0.05, 0], colors.yellow);
    box(group, [0.9, 0.1, 0.9], [0, 0.45, 0], colors.red);
    const clock = cylinder(group, 0.22, 0.02, [0, 0.23, 0.37], colors.cream);
    clock.rotation.x = Math.PI / 2;
    box(group, [0.025, 0.16, 0.018], [0, 0.27, 0.39], colors.ink);
    box(group, [0.13, 0.025, 0.018], [0.05, 0.2, 0.39], colors.ink);
    return;
  }
  if (kind === "powerPlant") {
    box(group, [1, 0.35, 0.85], [0, -0.325, 0], colors.blue);
    for (const x of [-0.28, 0.28]) {
      cylinder(group, 0.19, 0.65, [x, 0, 0], colors.cream);
      cylinder(group, 0.21, 0.06, [x, 0.355, 0], colors.red);
      box(group, [0.06, 0.1, 0.3], [x, 0.44, 0], colors.ink);
    }
    return;
  }
  if (kind === "garage" || kind === "hangar") {
    box(
      group,
      [1, 0.8, 0.95],
      [0, -0.1, 0],
      kind === "garage" ? colors.blue : colors.green,
    );
    box(group, [0.7, 0.6, 0.014], [0, -0.19, 0.483], colors.ink);
    for (const y of [-0.35, -0.15, 0.05])
      box(group, [0.66, 0.015, 0.014], [0, y, 0.497], colors.cream);
    box(group, [1, 0.2, 1], [0, 0.4, 0], colors.red);
    return;
  }
  if (kind === "station") {
    box(group, [0.9, 0.65, 0.8], [0, -0.175, 0], colors.cream);
    box(group, [1, 0.15, 1], [0, 0.225, 0], colors.green);
    box(group, [0.28, 0.2, 0.1], [0, 0.4, 0.35], colors.yellow);
    windows(group, 1, 3, 0.8, 0.6, 0.412);
    return;
  }
  if (kind === "factory") {
    box(group, [1, 0.65, 0.95], [0, -0.175, 0], colors.red);
    box(group, [1, 0.13, 1], [0, 0.215, 0], colors.cream);
    cylinder(group, 0.1, 0.22, [-0.3, 0.39, -0.25], colors.ink);
    windows(group, 1, 3, 0.85, 0.55, 0.487);
    return;
  }
  if (kind === "cityHall") {
    box(group, [1, 0.65, 0.9], [0, -0.175, 0], colors.cream);
    box(group, [0.36, 0.35, 0.5], [0, 0.325, 0], colors.red);
    for (const x of [-0.34, -0.12, 0.12, 0.34])
      box(group, [0.09, 0.52, 0.08], [x, -0.15, 0.46], colors.yellow);
    return;
  }
  box(group, [0.92, 1, 0.9], [0, 0, 0], colors.blue);
  windows(group, 5, 3, 0.8, 0.9, 0.462);
}

export function toyVisual(kind: ToyKind): THREE.Group {
  const furniture = furnitureVisual(kind);
  if (furniture) return furniture;
  const group = new THREE.Group();
  if (["miniCar", "bus", "truck"].includes(kind))
    vehicle(group, kind as "miniCar" | "bus" | "truck");
  else if (["windupRobot", "teddy", "doll"].includes(kind))
    figure(group, kind as "windupRobot" | "teddy" | "doll");
  else if (kind === "button") {
    cylinder(group, 0.5, 0.9, [0, -0.05, 0], colors.red);
    for (const x of [-0.15, 0.15])
      for (const z of [-0.15, 0.15])
        cylinder(group, 0.07, 0.04, [x, 0.42, z], colors.ink);
  } else if (kind === "puzzle") {
    const shape = new THREE.Shape();
    shape.moveTo(-0.35, -0.5);
    shape.lineTo(0.35, -0.5);
    shape.lineTo(0.35, -0.13);
    shape.lineTo(0.5, -0.13);
    shape.lineTo(0.5, 0.13);
    shape.lineTo(0.35, 0.13);
    shape.lineTo(0.35, 0.5);
    shape.lineTo(0.1, 0.5);
    shape.lineTo(0.1, 0.32);
    shape.lineTo(-0.1, 0.32);
    shape.lineTo(-0.1, 0.5);
    shape.lineTo(-0.35, 0.5);
    shape.closePath();
    const piece = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }),
      material(colors.green),
    );
    piece.rotation.x = -Math.PI / 2;
    piece.position.y = -0.5;
    group.add(piece);
  } else if (kind === "brick") {
    box(group, [1, 0.7, 1], [0, -0.15, 0], colors.blue);
    for (const x of [-0.3, 0.3])
      for (const z of [-0.3, 0.3])
        cylinder(group, 0.14, 0.3, [x, 0.35, z], colors.blue);
  } else if (kind === "dice") {
    box(group, [0.96, 0.96, 0.96], [0, 0, 0], colors.cream);
    for (const x of [-0.25, 0, 0.25])
      for (const z of [-0.23, 0.23])
        cylinder(group, 0.065, 0.014, [x, 0.489, z], colors.ink);
    for (const x of [-0.23, 0.23])
      box(group, [0.12, 0.12, 0.014], [x, -x, 0.489], colors.ink);
  } else if (kind === "rockingHorse") {
    for (const side of [-1, 1]) {
      box(group, [1, 0.1, 0.1], [0, -0.45, side * 0.33], colors.red);
      for (const x of [-0.27, 0.27])
        box(group, [0.12, 0.4, 0.12], [x, -0.2, side * 0.25], colors.yellow);
    }
    box(group, [0.75, 0.32, 0.5], [0, 0, 0], colors.yellow);
    box(group, [0.23, 0.55, 0.4], [0.25, 0.19, 0], colors.cream);
    box(group, [0.3, 0.2, 0.42], [0.33, 0.36, 0], colors.cream);
    for (const z of [-0.15, 0.15])
      box(group, [0.08, 0.1, 0.08], [0.27, 0.45, z], colors.yellow);
  } else building(group, kind);
  return group;
}
