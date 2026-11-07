import * as THREE from "three";
import { ConvexHull } from "three/addons/math/ConvexHull.js";
import { OBJECT_TYPES, type ObjectKind } from "./stage";
import { objectVisual, disposeScene } from "./visuals";
import { topOfBox } from "./floor";
import { horizontalFootprint } from "./object-exit";

export const FITTED_COLLIDER_KINDS: readonly ObjectKind[] = [
  "shrub",
  "sapling",
  "tree",
  "greatTree",
  "hellStatue",
  "spikedPillar",
  "oni",
  "giantOni",
];
type Rotation = { x: number; y: number; z: number; w: number };
const hulls = new Map<ObjectKind, Float32Array>();

export function objectHullVertices(kind: ObjectKind) {
  if (!FITTED_COLLIDER_KINDS.includes(kind)) return undefined;
  const cached = hulls.get(kind);
  if (cached) return cached;
  const visual = objectVisual(kind);
  try {
    const hull = new ConvexHull().setFromObject(visual);
    const points = new Set<THREE.Vector3>();
    for (const face of hull.faces) {
      let edge = face.edge;
      do {
        points.add(edge.head().point);
        edge = edge.next;
      } while (edge !== face.edge);
    }
    if (points.size < 4)
      throw new Error(`${OBJECT_TYPES[kind].label}の衝突形状を作れません。`);
    const vertices = new Float32Array(
      [...points].flatMap(({ x, y, z }) => [x, y, z]),
    );
    hulls.set(kind, vertices);
    return vertices;
  } finally {
    disposeScene(visual);
  }
}

export function objectCollisionTop(
  kind: ObjectKind,
  positionY: number,
  rotation: Rotation,
  scale = 1,
) {
  const vertices = objectHullVertices(kind);
  if (!vertices)
    return topOfBox(
      positionY,
      rotation,
      scale === 1
        ? OBJECT_TYPES[kind].size
        : OBJECT_TYPES[kind].size.map((value) => value * scale),
    );
  const { x, y, z, w } = rotation;
  const a = 2 * (x * y + w * z),
    b = 1 - 2 * (x * x + z * z),
    c = 2 * (y * z - w * x);
  let top = -Infinity;
  for (let index = 0; index < vertices.length; index += 3)
    top = Math.max(
      top,
      a * vertices[index] + b * vertices[index + 1] + c * vertices[index + 2],
    );
  return positionY + top * scale;
}

export function objectCollisionFootprint(
  kind: ObjectKind,
  rotation: Rotation,
  scale = 1,
) {
  const vertices = objectHullVertices(kind);
  if (!vertices) return horizontalFootprint(kind, rotation) * scale;
  const { x, y, z, w } = rotation;
  const a = 1 - 2 * (y * y + z * z),
    b = 2 * (x * y - w * z),
    c = 2 * (x * z + w * y),
    d = 2 * (x * z - w * y),
    e = 2 * (y * z + w * x),
    f = 1 - 2 * (x * x + y * y);
  let radius = 0;
  for (let index = 0; index < vertices.length; index += 3) {
    const px = vertices[index],
      py = vertices[index + 1],
      pz = vertices[index + 2];
    radius = Math.max(
      radius,
      Math.hypot(a * px + b * py + c * pz, d * px + e * py + f * pz),
    );
  }
  return radius * scale;
}
