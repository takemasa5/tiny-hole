import RAPIER from "@dimforge/rapier3d-compat";
import { OBJECT_TYPES, type ObjectKind } from "./stage";

export function objectCollider(kind: ObjectKind) {
  const [width, height, depth] = OBJECT_TYPES[kind].size;
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
