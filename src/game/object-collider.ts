import RAPIER from "@dimforge/rapier3d-compat";
import { OBJECT_TYPES, type ObjectKind } from "./stage";
import { objectHullVertices } from "./object-shape";

export function objectCollider(kind: ObjectKind, scale = 1) {
  const vertices = objectHullVertices(kind);
  if (vertices) {
    const collider = RAPIER.ColliderDesc.convexHull(
      scale === 1 ? vertices : vertices.map((value) => value * scale),
    );
    if (!collider)
      throw new Error(`${OBJECT_TYPES[kind].label}の衝突形状を作れません。`);
    return collider;
  }
  const [width, height, depth] = OBJECT_TYPES[kind].size.map(
    (value) => value * scale,
  );
  if (kind === "toyBall") return RAPIER.ColliderDesc.ball(width / 2);
  if (kind === "buoy" || kind === "barrel")
    return RAPIER.ColliderDesc.cylinder(height / 2, width / 2);
  if (kind === "log") {
    return RAPIER.ColliderDesc.cylinder(width / 2, height / 2).setRotation({
      x: 0,
      y: 0,
      z: Math.SQRT1_2,
      w: Math.SQRT1_2,
    });
  }
  if (kind === "tire")
    return RAPIER.ColliderDesc.cylinder(height / 2, width / 2);
  if (kind === "pyramid") {
    const x = width / 2,
      y = height / 2,
      z = depth / 2;
    const collider = RAPIER.ColliderDesc.convexHull(
      new Float32Array([-x, -y, -z, x, -y, -z, x, -y, z, -x, -y, z, 0, y, 0]),
    );
    if (!collider) throw new Error("ピラミッドの衝突形状を作れませんでした。");
    return collider;
  }
  return RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2);
}
