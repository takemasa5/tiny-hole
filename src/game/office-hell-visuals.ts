import * as THREE from "three";
import {
  OBJECT_TYPES,
  mapHalfSizeForStage,
  roadsForStage,
  placementClusters,
  type ObjectKind,
  type StageId,
} from "./stage";
import { box, cylinder, material } from "./expansion-visuals";

function sphere(
  group: THREE.Group,
  radius: number,
  color: string,
  position: number[],
) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 14, 10),
    material(color),
  );
  mesh.position.set(position[0], position[1], position[2]);
  group.add(mesh);
  return mesh;
}
function cone(
  group: THREE.Group,
  radius: number,
  height: number,
  color: string,
  position: number[],
) {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, 12),
    material(color),
  );
  mesh.position.set(position[0], position[1], position[2]);
  group.add(mesh);
  return mesh;
}
function legs(
  group: THREE.Group,
  color: string,
  hip: number,
  length: number,
  offset = 0.18,
) {
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * offset, hip, 0);
    box(leg, [0.14, length, 0.18], color, [0, -length / 2, 0]);
    leg.userData.stride = side;
    group.add(leg);
  }
}
function officePerson(group: THREE.Group) {
  box(group, [0.36, 0.46, 0.24], "#8ca3b9", [0, 0.02, 0]);
  sphere(group, 0.145, "#eac4a2", [0, 0.4, 0]);
  box(group, [0.27, 0.08, 0.26], "#55545a", [0, 0.51, -0.01]);
  box(group, [0.06, 0.23, 0.025], "#596f92", [0, 0.05, 0.13]);
  legs(group, "#5e7188", -0.2, 0.45, 0.1);
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.225, 0.15, 0);
    box(arm, [0.09, 0.36, 0.11], "#8ca3b9", [0, -0.18, 0]);
    arm.userData.stride = -side;
    group.add(arm);
    box(group, [0.035, 0.035, 0.02], "#344958", [side * 0.06, 0.43, 0.14]);
  }
}

export function officeHellObjectVisual(
  kind: ObjectKind,
): THREE.Group | undefined {
  const group = new THREE.Group();
  switch (kind) {
    case "eraser":
      box(group, [0.04, 0.02, 0.025], "#e8adad");
      box(group, [0.024, 0.0202, 0.0252], "#647fa9", [-0.003, 0, 0]);
      break;
    case "pencil": {
      const wood = cylinder(group, 0.0075, 0.15, "#dbb45c", [-0.015, 0, 0]);
      wood.rotation.z = Math.PI / 2;
      cone(group, 0.0075, 0.03, "#e1c49a", [0.075, 0, 0]).rotation.z =
        -Math.PI / 2;
      cone(group, 0.002, 0.008, "#4a4e55", [0.086, 0, 0]).rotation.z =
        -Math.PI / 2;
      break;
    }
    case "stapler":
      box(group, [0.14, 0.012, 0.06], "#666f77", [0, -0.024, 0]);
      box(
        group,
        [0.13, 0.035, 0.055],
        "#81a2ba",
        [-0.005, 0.012, 0],
      ).rotation.z = 0.01;
      break;
    case "documents":
      for (const y of [-0.01, 0, 0.01])
        box(group, [0.3, 0.009, 0.22], "#f0ede0", [0, y, 0]);
      for (let row = 0; row < 4; row++)
        box(group, [0.16, 0.001, 0.004], "#aab5bc", [
          -0.025,
          0.015,
          -0.06 + row * 0.025,
        ]);
      break;
    case "officeChair":
      box(group, [0.55, 0.1, 0.5], "#6689aa", [0, 0, 0]);
      box(group, [0.5, 0.48, 0.08], "#6689aa", [0, 0.26, -0.23]);
      cylinder(group, 0.045, 0.42, "#8d979e", [0, -0.25, 0]);
      for (const angle of [0, Math.PI / 3, -Math.PI / 3])
        box(group, [0.52, 0.06, 0.06], "#61727f", [0, -0.46, 0]).rotation.y =
          angle;
      break;
    case "filingCabinet":
      box(group, [1, 2, 0.4], "#b8c2c6");
      for (let row = 0; row < 5; row++) {
        box(group, [0.94, 0.32, 0.02], "#a5b2b9", [
          0,
          -0.77 + row * 0.38,
          0.209,
        ]);
        box(group, [0.22, 0.035, 0.025], "#ebdfbd", [
          0,
          -0.75 + row * 0.38,
          0.2125,
        ]);
      }
      break;
    case "officeDesk":
      box(group, [1.4, 0.09, 0.7], "#c5a67d", [0, 0.33, 0]);
      for (const x of [-0.6, 0.6])
        for (const z of [-0.25, 0.25])
          box(group, [0.09, 0.66, 0.09], "#aeb8bc", [x, -0.045, z]);
      break;
    case "copier":
      box(group, [0.9, 0.95, 0.85], "#c4cccf", [0, -0.125, 0]);
      box(group, [0.8, 0.16, 0.85], "#737e86", [0, 0.43, 0]);
      box(group, [0.72, 0.08, 0.7], "#e9e8d9", [0, 0.56, 0]);
      box(group, [0.33, 0.12, 0.035], "#62899e", [0.18, 0.21, 0.43]);
      for (const y of [-0.4, -0.17])
        box(group, [0.7, 0.035, 0.02], "#8898a0", [0, y, 0.43]);
      break;
    case "officeWorker":
      officePerson(group);
      break;
    case "president":
      box(group, [2.3, 0.1, 0.8], "#9b785d", [0, -0.1, 0.3]);
      for (const x of [-1, 1])
        for (const z of [0, 0.6])
          box(group, [0.12, 0.75, 0.12], "#795f51", [x, -0.525, z]);
      box(group, [0.7, 1.2, 0.15], "#5f505b", [0, -0.05, -0.575]);
      box(group, [0.7, 0.12, 0.55], "#5f505b", [0, -0.45, -0.35]);
      box(group, [0.45, 0.55, 0.3], "#526780", [0, -0.07, -0.35]);
      sphere(group, 0.17, "#e8c19c", [0, 0.4, -0.35]);
      box(group, [0.3, 0.08, 0.24], "#57565b", [0, 0.53, -0.38]);
      for (const x of [-0.09, 0.09])
        box(group, [0.15, 0.06, 0.025], "#344957", [x, 0.42, -0.18]);
      box(group, [0.055, 0.21, 0.03], "#cfa758", [0, 0.05, -0.18]);
      box(group, [0.45, 0.28, 0.035], "#798d9e", [0, 0.09, 0.18]);
      box(group, [0.3, 0.015, 0.22], "#eee8d9", [0.65, -0.04, 0.3]);
      break;
    case "skull":
      sphere(group, 0.4, "#e8dfc4", [0, 0.1, 0]).scale.z = 0.8;
      for (const x of [-0.15, 0.15])
        sphere(group, 0.105, "#484451", [x, 0.16, 0.29]);
      box(group, [0.5, 0.12, 0.22], "#e8dfc4", [0, -0.19, 0.19]);
      for (let x = -0.18; x <= 0.18; x += 0.09)
        box(group, [0.065, 0.08, 0.08], "#f4e9d1", [x, -0.25, 0.28]);
      legs(group, "#ded5bf", -0.29, 0.21, 0.17);
      break;
    case "hungryGhost":
      cylinder(group, 0.3, 0.6, "#b8c3c7", [0, -0.18, 0]);
      sphere(group, 0.19, "#c7d0cb", [0, 0.28, 0]);
      for (const x of [-0.07, 0.07])
        box(group, [0.07, 0.04, 0.04], "#555866", [x, 0.3, 0.18]);
      cone(group, 0.13, 0.16, "#f0e9d7", [0, 0.37, 0.13]).rotation.z = Math.PI;
      for (const side of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(side * 0.34, 0.05, 0);
        box(arm, [0.12, 0.35, 0.15], "#b8c3c7", [0, -0.14, 0]);
        arm.userData.stride = side;
        group.add(arm);
        box(group, [0.04, 0.25, 0.03], "#eee9db", [
          side * 0.05,
          0.05,
          0.3,
        ]).rotation.z = side * 0.5;
      }
      legs(group, "#c6cec5", -0.42, 0.08, 0.15);
      break;
    case "oni":
    case "giantOni": {
      const color = kind === "oni" ? "#c16e62" : "#6a86b1";
      box(group, [0.6, 0.4, 0.44], color, [0, -0.09, 0]);
      box(group, [0.45, 0.35, 0.44], color, [0, 0.22, 0]);
      for (const side of [-1, 1]) {
        cone(group, 0.065, 0.2, "#e6d2a2", [side * 0.15, 0.4, 0]);
        box(group, [0.1, 0.05, 0.035], "#f5e8c3", [side * 0.12, 0.24, 0.23]);
        box(group, [0.15, 0.04, 0.04], "#393c4b", [
          side * 0.12,
          0.31,
          0.24,
        ]).rotation.z = side * 0.15;
        const arm = new THREE.Group();
        arm.position.set(side * 0.38, 0.03, 0);
        box(arm, [0.14, 0.4, 0.16], color, [0, -0.17, 0]);
        arm.userData.stride = -side;
        group.add(arm);
      }
      box(group, [0.55, 0.18, 0.5], "#d9b44e", [0, -0.25, 0]);
      for (const y of [-0.2, -0.26, -0.32])
        box(group, [0.5, 0.025, 0.025], "#514b4b", [0, y, 0.26]);
      cylinder(group, 0.06, 0.7, "#59515e", [0.4, -0.02, 0.25]);
      for (const y of [-0.18, 0, 0.18])
        sphere(group, 0.075, "#625d66", [0.4, y, 0.25]);
      legs(group, color, -0.32, 0.18, 0.17);
      break;
    }
    case "hellStatue":
      box(group, [1, 0.12, 1], "#777f7c", [0, -0.44, 0]);
      cone(group, 0.35, 0.65, "#92998c", [0, -0.175, 0]);
      sphere(group, 0.28, "#9fa49a", [0, 0.22, 0]);
      box(group, [0.3, 0.22, 0.04], "#bd7565", [0, -0.02, 0.28]);
      for (const x of [-0.1, 0.1])
        box(group, [0.09, 0.025, 0.025], "#686c70", [x, 0.25, 0.26]);
      break;
    case "ironCauldron": {
      cylinder(group, 0.42, 0.7, "#555563", [0, -0.1, 0]);
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(0.35, 20),
        material("#a35c59"),
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.y = 0.255;
      group.add(pool);
      for (const x of [-0.32, 0.32])
        box(group, [0.13, 0.15, 0.5], "#454854", [x, -0.425, 0]);
      break;
    }
    case "spikedPillar":
      cone(group, 0.46, 0.8, "#80757d", [0, -0.1, 0]);
      for (let index = 0; index < 8; index++) {
        const angle = (index * Math.PI) / 4;
        const spike = cone(group, 0.07, 0.55, "#b7a4a1", [
          Math.cos(angle) * 0.2,
          0.3,
          Math.sin(angle) * 0.2,
        ]);
        spike.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(Math.cos(angle), 1, Math.sin(angle)).normalize(),
        );
      }
      break;
    case "enma":
      box(group, [6, 0.6, 6], "#746075", [0, -4.7, 0]);
      box(group, [4.6, 7, 0.65], "#77505b", [0, -0.6, -1.9]);
      box(group, [4.6, 0.5, 3.8], "#8d5960", [0, -2.5, -0.3]);
      for (const x of [-1.8, 1.8])
        box(group, [0.3, 1, 0.3], "#bd9a59", [x, 4.5, -1.9]);
      box(group, [3.4, 3.7, 2.6], "#ab524d", [0, -0.7, -0.1]);
      box(group, [2.8, 2.1, 2.3], "#c26b56", [0, 2.1, 0.1]);
      cone(group, 1, 1.6, "#413f4b", [0, 1, 1.15]).rotation.z = Math.PI;
      sphere(group, 0.2, "#bd6652", [0, 2.2, 1.4]);
      for (const side of [-1, 1]) {
        box(group, [0.7, 0.3, 0.08], "#f1d7ac", [side * 0.65, 2.3, 1.29]);
        box(group, [0.85, 0.15, 0.15], "#3f3b49", [
          side * 0.65,
          2.65,
          1.3,
        ]).rotation.z = side * 0.12;
        box(group, [0.15, 3.5, 0.08], "#d5b45f", [side * 1.4, -0.7, 1.25]);
      }
      box(group, [2.7, 1.4, 2.4], "#3c3c4c", [0, 3.65, 0]);
      box(group, [3.7, 0.25, 2.8], "#393a4b", [0, 3.1, 0]);
      box(group, [5.2, 0.18, 0.5], "#393a4b", [0, 3.6, 0]);
      box(group, [0.14, 0.85, 0.08], "#d6b663", [0, 3.85, 1.24]);
      for (const y of [3.5, 3.85, 4.2])
        box(group, [0.9, 0.1, 0.08], "#d6b663", [0, y, 1.24]);
      box(group, [0.25, 2.5, 0.18], "#dbc793", [1.9, 0.1, 1.4]).rotation.z =
        -0.25;
      box(group, [5.4, 0.45, 2.4], "#71524c", [0, -2.05, 1.5]);
      for (const x of [-2.4, 2.4])
        for (const z of [0.5, 2.5])
          box(group, [0.35, 2.5, 0.35], "#70554e", [x, -3.5, z]);
      box(group, [2, 0.07, 1], "#e1d0b0", [0, -1.79, 1.6]);
      break;
    default:
      return undefined;
  }
  if (
    [
      "skull",
      "hungryGhost",
      "oni",
      "giantOni",
      "hellStatue",
      "ironCauldron",
      "spikedPillar",
    ].includes(kind)
  ) {
    const [width, height, depth] = OBJECT_TYPES[kind].size;
    group.scale.set(width, height, depth);
  }
  return group;
}

export function drawOfficeHellGround(
  context: CanvasRenderingContext2D,
  stageId: StageId,
  seed: number,
) {
  if (stageId !== "office" && stageId !== "hell") return false;
  const halfSize = mapHalfSizeForStage(stageId);
  const pixel = (value: number) => ((value + halfSize) / (halfSize * 2)) * 1024;
  context.fillStyle = stageId === "office" ? "#d1d0c9" : "#6c626c";
  context.fillRect(0, 0, 1024, 1024);
  if (stageId === "office") {
    context.strokeStyle = "#b8bdc0";
    context.lineWidth = 2;
    for (let value = 0; value <= 1024; value += 32) {
      context.beginPath();
      context.moveTo(value, 0);
      context.lineTo(value, 1024);
      context.stroke();
      context.beginPath();
      context.moveTo(0, value);
      context.lineTo(1024, value);
      context.stroke();
    }
    context.fillStyle = "#aab7c2";
    for (const road of roadsForStage(stageId)) {
      const edge = pixel(road.position - road.width / 2),
        width = (road.width / (halfSize * 2)) * 1024;
      if (road.axis === "x") context.fillRect(0, edge, 1024, width);
      else context.fillRect(edge, 0, width, 1024);
    }
  } else {
    context.strokeStyle = "#85717c";
    context.lineWidth = 3;
    for (let value = 0; value < 1024; value += 96) {
      context.beginPath();
      context.moveTo(value, 0);
      context.lineTo(value + 55, 350);
      context.lineTo(value - 25, 650);
      context.lineTo(value + 35, 1024);
      context.stroke();
    }
    for (const center of placementClusters(seed, "hell")) {
      const x = pixel(center.x),
        y = pixel(center.z);
      context.fillStyle = "#53434e";
      context.beginPath();
      context.ellipse(x, y, 92, 68, -0.2, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#9e4b51";
      context.beginPath();
      context.ellipse(x, y, 78, 54, -0.2, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#ba6564";
      context.lineWidth = 3;
      context.beginPath();
      context.ellipse(x + 5, y, 50, 32, -0.2, 0, Math.PI * 2);
      context.stroke();
    }
  }
  return true;
}
