import * as THREE from "three";
import {
  MAP_HALF_SIZE,
  OBJECT_TYPES,
  STAGES,
  placementClusters,
  type ObjectKind,
  type StageId,
} from "./stage";

function part(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  color: string,
  position: number[],
) {
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
  );
  mesh.position.set(position[0], position[1], position[2]);
  group.add(mesh);
  return mesh;
}
function box(
  group: THREE.Group,
  size: number[],
  color: string,
  position = [0, 0, 0],
) {
  return part(
    group,
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    color,
    position,
  );
}
function ball(
  group: THREE.Group,
  radius: number,
  color: string,
  position: number[],
  scale = [1, 1, 1],
) {
  const mesh = part(
    group,
    new THREE.IcosahedronGeometry(radius, 1),
    color,
    position,
  );
  mesh.scale.set(scale[0], scale[1], scale[2]);
  return mesh;
}
function cylinder(
  group: THREE.Group,
  radius: number,
  height: number,
  color: string,
  y: number,
) {
  return part(
    group,
    new THREE.CylinderGeometry(radius, radius, height, 12),
    color,
    [0, y, 0],
  );
}

export function themedObject(kind: ObjectKind): THREE.Group | undefined {
  const group = new THREE.Group();
  const {
    size: [width, height, depth],
    color,
  } = OBJECT_TYPES[kind];
  if (kind === "flower") {
    box(group, [0.05, 0.4, 0.05], "#518051", [0, -0.075, 0]);
    box(group, [0.24, 0.04, 0.08], "#6b9751", [0.06, -0.08, 0]);
    for (let index = 0; index < 5; index++) {
      const angle = (index * Math.PI * 2) / 5;
      ball(
        group,
        0.1,
        color,
        [Math.cos(angle) * 0.13, 0.15, Math.sin(angle) * 0.13],
        [1, 0.6, 1],
      );
    }
    ball(group, 0.085, "#e78a56", [0, 0.18, 0]);
  } else if (kind === "shrub") {
    ball(group, 0.55, color, [0, 0, 0]);
  } else if (kind === "sapling" || kind === "tree" || kind === "greatTree") {
    box(group, [width * 0.22, height * 0.65, width * 0.22], "#946b48", [
      0,
      -height * 0.175,
      0,
    ]);
    for (let index = 0; index < 3; index++) {
      const canopy = part(
        group,
        new THREE.ConeGeometry(width * (0.5 - index * 0.08), height * 0.38, 8),
        color,
        [0, height * (-0.08 + index * 0.18), 0],
      );
      canopy.rotation.y = index * 0.3;
    }
  } else if (kind === "camel") {
    ball(group, width * 0.32, color, [0, -0.25, 0], [1.4, 1, 0.7]);
    ball(group, 0.36, color, [-0.15, 0.12, 0], [1, 1.3, 1]);
    box(group, [0.28, 1.2, 0.3], color, [0.57, 0.24, 0]);
    const head = [0.65, 0.88, 0];
    ball(group, 0.26, color, head, [1, 1, 0.85]);
    for (const side of [-1, 1]) {
      ball(group, 0.075, "#75553d", [
        head[0] - 0.025,
        head[1] + 0.2,
        side * 0.14,
      ]);
      box(group, [0.06, 0.055, 0.025], "#3d3530", [
        head[0] + 0.07,
        head[1] + 0.025,
        side * 0.21,
      ]);
      for (const end of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(end * width * 0.25, -0.48, side * depth * 0.25);
        box(leg, [0.12, 0.65, 0.12], "#75553d", [0, -0.325, 0]);
        group.add(leg);
      }
    }
  } else if (kind === "burger") {
    cylinder(group, 0.39, 0.14, color, -0.245);
    cylinder(group, 0.4, 0.05, "#76a557", -0.145);
    cylinder(group, 0.36, 0.12, "#785143", -0.06);
    box(group, [0.62, 0.035, 0.62], "#f4ce67", [0, 0.015, 0]);
    ball(group, 0.39, "#efb96d", [0, 0.11, 0], [1, 0.54, 1]);
    for (const x of [-0.16, 0, 0.16])
      box(group, [0.06, 0.018, 0.025], "#fff1bf", [
        x,
        0.3 - Math.abs(x) * 0.25,
        0,
      ]);
  } else if (kind === "hotdog") {
    box(group, [width, 0.27, depth], color, [0, -0.07, 0]);
    const sausage = part(
      group,
      new THREE.CapsuleGeometry(0.105, 0.8, 4, 8),
      "#c36c52",
      [0, 0.08, 0],
    );
    sausage.rotation.z = Math.PI / 2;
    box(group, [0.86, 0.025, 0.04], "#f3d565", [0, 0.19, 0]);
  } else if (kind === "stone" || kind === "columnBlock") {
    box(group, [width, height, depth], color);
    box(group, [width * 0.65, 0.025, 0.012], "#af916b", [
      0,
      height * 0.12,
      depth / 2 + 0.007,
    ]);
    box(group, [0.025, height * 0.45, 0.012], "#af916b", [
      width * 0.17,
      0,
      depth / 2 + 0.007,
    ]);
  } else if (kind === "column") {
    box(group, [width, 0.45, depth], color, [0, -height / 2 + 0.225, 0]);
    cylinder(group, 0.68, height - 0.9, color, 0);
    box(group, [width, 0.45, depth], color, [0, height / 2 - 0.225, 0]);
    for (const y of [-1.4, -0.5, 0.5, 1.4])
      cylinder(group, 0.695, 0.035, "#c0a378", y);
  } else if (kind === "pyramid") {
    const pyramid = part(
      group,
      new THREE.ConeGeometry(width / Math.sqrt(2), height, 4),
      color,
      [0, 0, 0],
    );
    pyramid.rotation.y = Math.PI / 4;
    for (let index = 1; index < 8; index++) {
      const extent = (width / 2) * (1 - index / 8);
      const points = [
        [-extent, -extent],
        [extent, -extent],
        [extent, extent],
        [-extent, extent],
        [-extent, -extent],
      ].map(
        ([x, z]) => new THREE.Vector3(x, -height / 2 + (height * index) / 8, z),
      );
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: "#b89460" }),
      );
      line.scale.set(1.006, 1, 1.006);
      group.add(line);
    }
  } else if (kind === "liberty") {
    box(group, [6, 1.5, 6], "#d8cdb6", [0, -5.75, 0]);
    box(group, [3.4, 1.6, 3.4], "#e7dbc3", [0, -4.2, 0]);
    part(
      group,
      new THREE.CylinderGeometry(0.65, 1.5, 5.4, 8),
      color,
      [0, -0.7, 0],
    );
    ball(group, 0.7, color, [0, 2.65, 0]);
    box(group, [0.55, 3.2, 0.65], color, [-1.15, 3.25, 0]);
    box(group, [1.1, 1.7, 0.25], "#559b88", [0.9, 0.9, 0.7]);
    box(group, [0.3, 1, 0.3], "#629f86", [-1.15, 5, 0]);
    ball(group, 0.5, "#f8c15b", [-1.15, 5.9, 0], [0.7, 1.2, 0.7]);
    for (let index = 0; index < 7; index++) {
      const angle = (index / 6 - 0.5) * Math.PI;
      const spike = part(group, new THREE.ConeGeometry(0.13, 0.8, 4), color, [
        Math.sin(angle) * 0.85,
        2.85 + Math.cos(angle) * 0.65,
        0,
      ]);
      spike.rotation.z = -angle;
    }
  } else return undefined;
  return group;
}

export function mountainBackground() {
  const group = new THREE.Group();
  for (let index = 0; index < 12; index++) {
    const angle = (index * Math.PI * 2) / 12;
    const height = 10 + (index % 4) * 3;
    const mountain = part(
      group,
      new THREE.ConeGeometry(11, height, 5),
      index % 2 ? "#729684" : "#88aa95",
      [
        Math.cos(angle) * (MAP_HALF_SIZE + 19),
        height / 2 - 1,
        Math.sin(angle) * (MAP_HALF_SIZE + 19),
      ],
    );
    mountain.rotation.y = index;
  }
  return group;
}

export function drawThemedGround(
  context: CanvasRenderingContext2D,
  stageId: StageId,
  seed: number,
) {
  const stage = STAGES[stageId];
  context.fillStyle = stage.groundColor;
  context.fillRect(0, 0, 1024, 1024);
  if (stage.placement === "roadside") return false;
  const pixel = (value: number) =>
    ((value + MAP_HALF_SIZE) / (MAP_HALF_SIZE * 2)) * 1024;
  for (const center of placementClusters(seed, stage.placement)) {
    context.fillStyle = stageId === "mountain" ? "#9dbb70" : "#debd85";
    context.beginPath();
    context.ellipse(
      pixel(center.x),
      pixel(center.z),
      125,
      110,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
    if (stageId === "egypt") {
      context.strokeStyle = "#c9a875";
      for (let offset = -80; offset <= 80; offset += 25) {
        context.strokeRect(
          pixel(center.x) + offset,
          pixel(center.z) - 80,
          25,
          160,
        );
      }
    }
  }
  context.strokeStyle = stageId === "mountain" ? "#c8cd91" : "#e7c78d";
  context.lineWidth = stageId === "mountain" ? 12 : 3;
  context.beginPath();
  context.moveTo(0, 550);
  context.bezierCurveTo(250, 300, 620, 720, 1024, 480);
  context.stroke();
  return true;
}
