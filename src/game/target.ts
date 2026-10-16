import type RAPIER from "@dimforge/rapier3d-compat";
import { OBJECT_TYPES, type PlacedObject } from "./stage";

export function standTarget(
  body: RAPIER.RigidBody,
  definition: PlacedObject,
  cleared: boolean,
  supportY = 0,
): boolean {
  if (definition.id !== "goal" || cleared) return false;
  const position = body.translation();
  body.setTranslation(
    {
      x: position.x,
      y: supportY + OBJECT_TYPES[definition.kind].size[1] / 2 + 0.02,
      z: position.z,
    },
    true,
  );
  body.setRotation(
    {
      x: 0,
      y: Math.sin(definition.yaw / 2),
      z: 0,
      w: Math.cos(definition.yaw / 2),
    },
    true,
  );
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  body.resetForces(true);
  body.resetTorques(true);
  return true;
}
