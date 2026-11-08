import * as THREE from "three";
import { ConvexHull } from "three/addons/math/ConvexHull.js";
import { growthVisual } from "./growth-visuals";
import { disposeScene } from "./visuals";
import type { GrowthObject } from "./growth-stage";
import type { StageId } from "./stage";

type Part = { vertices: Float32Array; indices: Uint32Array };
type Rotation = { x: number; y: number; z: number; w: number };
const templates = new Map<string, Part[]>();
const shapes = new Map<string, Part[]>();

function convexPart(points: THREE.Vector3[]): Part | undefined {
  // Painted circles and other zero-thickness decorations cannot support a body.
  const bounds = new THREE.Box3().setFromPoints(points);
  const size = bounds.getSize(new THREE.Vector3());
  if (Math.min(size.x, size.y, size.z) < 1e-8) return;
  const hull = new ConvexHull().setFromPoints(points);
  const vertices: number[] = [],
    indices: number[] = [];
  const offsets = new Map<THREE.Vector3, number>();
  for (const face of hull.faces) {
    let edge = face.edge;
    do {
      const point = edge.head().point;
      if (!offsets.has(point)) {
        offsets.set(point, vertices.length / 3);
        vertices.push(point.x, point.y, point.z);
      }
      indices.push(offsets.get(point)!);
      edge = edge.next;
    } while (edge !== face.edge);
  }
  if (vertices.length < 12) return;
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
  };
}

function convexVolume(points: THREE.Vector3[]) {
  const hull = new ConvexHull().setFromPoints(points);
  const cross = new THREE.Vector3();
  let volume = 0;
  for (const face of hull.faces) {
    const a = face.edge.head().point,
      b = face.edge.next.head().point,
      c = face.edge.next.next.head().point;
    volume += a.dot(cross.crossVectors(b, c)) / 6;
  }
  return Math.abs(volume);
}

function mergePrisms(prisms: THREE.Vector3[][]) {
  const parts = prisms.map((points) => ({
    points,
    cap: points.slice(0, 3),
    volume: convexVolume(points),
  }));
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < parts.length; i++)
      for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i],
          b = parts[j];
        if (a.cap.filter((p) => b.cap.some((q) => p.equals(q))).length < 2)
          continue;
        const points = [...a.points, ...b.points],
          volume = a.volume + b.volume;
        // Only merge if the convex hull adds no volume: concave gaps stay empty.
        if (Math.abs(convexVolume(points) - volume) > volume * 1e-6) continue;
        parts[i] = {
          points,
          cap: [
            ...a.cap,
            ...b.cap.filter((p) => !a.cap.some((q) => p.equals(q))),
          ],
          volume,
        };
        parts.splice(j, 1);
        merged = true;
        break outer;
      }
  }
  return parts.map((p) => p.points);
}

function meshParts(
  geometry: THREE.BufferGeometry,
  mergeExtrusion = false,
): THREE.Vector3[][] {
  const position = geometry.getAttribute("position");
  const point = (index: number) =>
    new THREE.Vector3().fromBufferAttribute(position, index);
  if (geometry instanceof THREE.TorusGeometry) {
    const { radialSegments, tubularSegments } = geometry.parameters;
    // A hull around the whole ring would fill the visible central hole.
    return Array.from({ length: tubularSegments }, (_, segment) => {
      const points: THREE.Vector3[] = [];
      for (const ring of [segment, segment + 1])
        for (let radial = 0; radial <= radialSegments; radial++)
          points.push(point(radial * (tubularSegments + 1) + ring));
      return points;
    });
  }
  if (geometry instanceof THREE.ExtrudeGeometry) {
    if (geometry.parameters.options.bevelEnabled)
      throw new Error("面取りした押し出し形状の衝突分割が未対応です。");
    // Use the actual cap vertices: geometry transforms may already be baked in.
    const prisms = geometry.groups
      .filter((group) => group.materialIndex === 0)
      .flatMap((group) => {
        const capCount = group.count / 2;
        return Array.from({ length: capCount / 3 }, (_, triangle) =>
          [group.start, group.start + capCount].flatMap((start) =>
            [0, 1, 2].map((corner) => point(start + triangle * 3 + corner)),
          ),
        );
      });
    return mergeExtrusion ? mergePrisms(prisms) : prisms;
  }

  return [Array.from({ length: position.count }, (_, index) => point(index))];
}

function template(definition: GrowthObject, stage: StageId) {
  const key = [
    stage,
    definition.model,
    definition.kind,
    definition.toyKind,
    definition.egyptKind,
  ].join(":");
  const cached = templates.get(key);
  if (cached) return cached;
  const visual = growthVisual(
    { ...definition, size: [1, 1, 1], scale: 1 },
    stage,
  );
  const parts: Part[] = [];
  try {
    visual.updateMatrixWorld(true);
    visual.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const localParts = meshParts(object.geometry, stage === "egypt");
      const matrices = [object.matrixWorld];
      if (object instanceof THREE.InstancedMesh) {
        matrices.length = 0;
        for (let i = 0; i < object.count; i++) {
          const instance = new THREE.Matrix4();
          object.getMatrixAt(i, instance);
          matrices.push(object.matrixWorld.clone().multiply(instance));
        }
      }
      for (const matrix of matrices)
        for (const points of localParts) {
          const part = convexPart(
            points.map((p) => p.clone().applyMatrix4(matrix)),
          );
          if (part) parts.push(part);
        }
    });
    if (!parts.length)
      throw new Error(`${definition.label}の衝突形状が空です。`);
    templates.set(key, parts);
    return parts;
  } finally {
    disposeScene(visual);
  }
}

export function growthShapeParts(
  definition: GrowthObject,
  stage: StageId = "plaza",
) {
  const scale =
    definition.model === "original"
      ? [definition.scale, definition.scale, definition.scale]
      : definition.size;
  const key = [
    stage,
    definition.model,
    definition.kind,
    definition.toyKind,
    definition.egyptKind,
    ...scale,
  ].join(":");
  const cached = shapes.get(key);
  if (cached) return cached;
  const parts = template(definition, stage).map(({ vertices, indices }) => ({
    vertices: vertices.map((value, index) => value * scale[index % 3]),
    indices,
  }));
  shapes.set(key, parts);
  return parts;
}

export function growthCollisionBounds(
  definition: GrowthObject,
  rotation: Rotation,
  stage: StageId = "plaza",
) {
  const quaternion = new THREE.Quaternion(
    rotation.x,
    rotation.y,
    rotation.z,
    rotation.w,
  );
  const point = new THREE.Vector3();
  let top = -Infinity,
    bottom = Infinity,
    footprint = 0;
  for (const { vertices } of growthShapeParts(definition, stage))
    for (let i = 0; i < vertices.length; i += 3) {
      point.fromArray(vertices, i).applyQuaternion(quaternion);
      top = Math.max(top, point.y);
      bottom = Math.min(bottom, point.y);
      footprint = Math.max(footprint, Math.hypot(point.x, point.z));
    }
  return { top, bottom, footprint };
}
