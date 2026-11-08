import RAPIER from "@dimforge/rapier3d-compat";
import { growthShapeParts, growthCollisionBounds } from "./growth-shape";
import type { StageId } from "./stage";
export { growthCollisionBounds } from "./growth-shape";
import { isEgyptGod, type GrowthObject } from "./growth-stage";

export function createGrowthBody(
  world: RAPIER.World,
  definition: GrowthObject,
  position: { x: number; y: number; z: number },
  rotation: { x: number; y: number; z: number; w: number },
  stage: StageId = "plaza",
) {
  // Size and level must not pin an object when the aperture removes its support.
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setRotation(rotation)
      .setCanSleep(true)
      .setCcdEnabled(true),
  );
  const colliders = growthShapeParts(definition, stage).map(
    ({ vertices, indices }) => {
      const shape = RAPIER.ColliderDesc.convexMesh(vertices, indices);
      if (!shape)
        throw new Error(`${definition.label}の衝突形状を作れません。`);
      return world.createCollider(
        shape
          .setFriction(0.65)
          .setRestitution(0)
          .setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS),
        body,
      );
    },
  );
  if (!["still", "moored"].includes(definition.behavior))
    body.setEnabledRotations(false, !isEgyptGod(definition), false, true);
  return { body, collider: colliders[0], colliders };
}

export function apertureOverlapsBase(
  definition: Pick<GrowthObject, "size">,
  position: { x: number; z: number },
  rotation: { x: number; y: number; z: number; w: number },
  hole: { x: number; z: number; radius: number },
) {
  const yaw = Math.atan2(
    2 * (rotation.w * rotation.y + rotation.x * rotation.z),
    1 - 2 * (rotation.y ** 2 + rotation.z ** 2),
  );
  const dx = hole.x - position.x;
  const dz = hole.z - position.z;
  const localX = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  const localZ = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const outsideX = Math.max(0, Math.abs(localX) - definition.size[0] / 2);
  const outsideZ = Math.max(0, Math.abs(localZ) - definition.size[2] / 2);
  return Math.hypot(outsideX, outsideZ) < hole.radius;
}

export function growthCollisionFootprint(
  definition: GrowthObject,
  rotation: { x: number; y: number; z: number; w: number },
  stage: StageId = "plaza",
) {
  return growthCollisionBounds(definition, rotation, stage).footprint;
}

export function growthLosesSupport(
  definition: GrowthObject,
  position: { x: number; y: number; z: number },
  rotation: { x: number; y: number; z: number; w: number },
  hole: { x: number; z: number; radius: number },
  stage: StageId,
) {
  const bottom =
    position.y + growthCollisionBounds(definition, rotation, stage).bottom;
  const overlaps = apertureOverlapsBase(definition, position, rotation, hole);
  if (isEgyptGod(definition)) {
    // A walking character balances on its remaining foot; contact with its outline is not a fall.
    return overlaps && bottom < -Math.max(0.01, hole.radius * 0.03);
  }
  return (
    (!["still", "moored"].includes(definition.behavior) && overlaps) ||
    bottom < -Math.max(0.003, hole.radius * 0.03) ||
    Math.hypot(position.x - hole.x, position.z - hole.z) +
      Math.hypot(...definition.size) / 2 <
      hole.radius * 0.96
  );
}
