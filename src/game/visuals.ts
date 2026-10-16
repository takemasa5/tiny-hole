import * as THREE from "three";
import {
  MAP_HALF_SIZE,
  OBJECT_TYPES,
  ROADS,
  isHuman,
  type ObjectKind,
  type StageId,
} from "./stage";

import { themedObject, drawThemedGround } from "./themed-visuals";
import {
  americanVisual,
  tanukiVisual,
  americanHouseVisual,
} from "./stage-models";
import { egyptianReliefVisual } from "./egyptian-relief";
import { stackObjectVisual } from "./stack-visuals";

function box(
  group: THREE.Group,
  size: number[],
  color: string,
  position: number[] = [0, 0, 0],
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...(size as [number, number, number])),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
  );
  mesh.position.set(...(position as [number, number, number]));
  group.add(mesh);
  return mesh;
}

export function objectVisual(kind: ObjectKind, stageId: StageId = "plaza") {
  const stack = stackObjectVisual(kind);
  if (stack) return stack;
  if (kind === "american") return americanVisual();
  if (kind === "egyptian") return egyptianReliefVisual();
  if (kind === "tanuki") return tanukiVisual();
  if (kind === "house" && stageId === "america") return americanHouseVisual();
  const themed = themedObject(kind);
  if (themed) return themed;
  const group = new THREE.Group();
  const { size, color } = OBJECT_TYPES[kind];
  const [width, height, depth] = size;
  if (isHuman(kind)) {
    box(group, [0.38, 0.48, 0.25], color, [0, 0.04, 0]);
    box(group, [0.3, 0.3, 0.3], "#f2c99b", [0, 0.46, 0]);
    box(group, [0.32, 0.07, 0.31], "#514039", [0, 0.615, 0]);
    for (const side of [-1, 1]) {
      box(group, [0.025, 0.035, 0.015], "#3d4048", [side * 0.075, 0.47, 0.157]);
      const leg = new THREE.Group();
      leg.position.set(side * 0.1, -0.2, 0);
      box(leg, [0.13, 0.4, 0.14], "#45627a", [0, -0.2, 0]);
      box(leg, [0.15, 0.05, 0.2], "#34414e", [0, -0.425, 0.025]);
      leg.userData.stride = side;
      group.add(leg);
      const arm = new THREE.Group();
      arm.position.set(side * 0.235, 0.24, 0);
      box(arm, [0.08, 0.36, 0.12], color, [0, -0.18, 0]);
      arm.userData.stride = -side;
      group.add(arm);
    }
  } else if (kind === "monument") {
    box(group, [6, 1.3, 6], "#dad0b9", [0, -5.85, 0]);
    box(group, [4.7, 1.1, 4.7], "#f4e8cd", [0, -4.65, 0]);
    box(group, [2.3, 8.5, 2.3], color, [0, 0.15, 0]);
    box(group, [2.8, 0.5, 2.8], "#c7b38d", [0, 4.6, 0]);
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(1.55, 1.65, 4),
      new THREE.MeshStandardMaterial({ color: "#dcc394", roughness: 0.7 }),
    );
    tip.position.y = 5.675;
    tip.rotation.y = Math.PI / 4;
    group.add(tip);
    for (const offset of [-0.65, 0.65])
      box(group, [0.16, 7.7, 0.06], "#c0a97f", [offset, 0.05, 1.18]);
  } else if (kind === "bench") {
    box(group, [width, 0.14, depth], color, [0, 0.155, 0]);
    for (const offset of [-0.68, 0.68])
      box(group, [0.12, 0.31, 0.35], "#536874", [offset, -0.07, 0]);
  } else if (kind === "planter") {
    box(group, [width, 0.6, depth], "#d8b292", [0, -0.25, 0]);
    const plant = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.55, 1),
      new THREE.MeshStandardMaterial({ color }),
    );
    plant.position.y = 0.05;
    group.add(plant);
  } else {
    if (kind === "parcel") {
      box(group, [...size], color);
      box(group, [0.14, 0.015, depth], "#f8dec0", [0, height / 2 + 0.008, 0]);
    } else {
      const roofHeight = 0.15;
      // Separate the volumes so the roof and walls never compete for the same exterior pixels.
      box(
        group,
        [width, height - roofHeight, depth],
        stageId === "egypt" ? "#dcb986" : color,
        [0, -roofHeight / 2, 0],
      );
      box(
        group,
        [width, roofHeight, depth],
        stageId === "egypt"
          ? "#c49e70"
          : kind === "house"
            ? "#607f9b"
            : "#b95759",
        [0, (height - roofHeight) / 2, 0],
      );
      for (const offset of [-width * 0.23, width * 0.23]) {
        box(group, [width * 0.25, height * 0.32, 0.035], "#f5ebce", [
          offset,
          height * 0.1,
          depth / 2 + 0.015,
        ]);
        box(group, [0.035, height * 0.32, depth * 0.25], "#f5ebce", [
          width / 2 + 0.015,
          height * 0.1,
          offset,
        ]);
      }
      box(group, [width * 0.23, height * 0.3, 0.04], "#53687b", [
        0,
        -height * 0.35,
        depth / 2 + 0.02,
      ]);
    }
  }
  return group;
}

export function animateWalker(
  mesh: THREE.Group,
  phase: number,
  running: boolean,
  falling: boolean,
) {
  mesh.traverse((limb) => {
    const stride = limb.userData.stride as number | undefined;
    if (stride)
      limb.rotation.x = falling
        ? 0
        : Math.sin(phase) * stride * (running ? 0.6 : 0.3);
  });
}

export function groundTexture(stageId: StageId = "plaza", seed = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("地面の描画を初期化できませんでした。");
  if (drawThemedGround(context, stageId, seed)) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  context.strokeStyle = "#dcd7ca";
  context.lineWidth = 1;
  for (let coordinate = 0; coordinate <= 1024; coordinate += 32) {
    context.beginPath();
    context.moveTo(coordinate, 0);
    context.lineTo(coordinate, 1024);
    context.stroke();
    context.beginPath();
    context.moveTo(0, coordinate);
    context.lineTo(1024, coordinate);
    context.stroke();
  }
  context.fillStyle = "#b6c4a4";
  for (const [x, y, width, height] of [
    [120, 140, 190, 230],
    [690, 630, 200, 180],
    [100, 730, 160, 150],
  ]) {
    context.beginPath();
    context.roundRect(x, y, width, height, 24);
    context.fill();
  }
  context.fillStyle = "#aab3b4";
  const toPixel = (value: number) =>
    ((value + MAP_HALF_SIZE) / (MAP_HALF_SIZE * 2)) * canvas.width;
  for (const road of ROADS) {
    const edge = toPixel(road.position - road.width / 2);
    const thickness = (road.width / (MAP_HALF_SIZE * 2)) * canvas.width;
    if (road.axis === "x") context.fillRect(0, edge, canvas.width, thickness);
    else context.fillRect(edge, 0, thickness, canvas.height);
  }
  context.strokeStyle = "#edf0e9";
  context.lineWidth = 3;
  context.setLineDash([14, 16]);
  for (const road of ROADS) {
    const center = toPixel(road.position);
    context.beginPath();
    if (road.axis === "x") {
      context.moveTo(0, center);
      context.lineTo(canvas.width, center);
    } else {
      context.moveTo(center, 0);
      context.lineTo(center, canvas.height);
    }
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function disposeScene(scene: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line))
      return;
    if (object instanceof THREE.InstancedMesh) object.dispose();
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      materials.add(material);
      if ("map" in material && material.map instanceof THREE.Texture)
        textures.add(material.map);
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}
