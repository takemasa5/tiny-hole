import type RAPIER from "@dimforge/rapier3d-compat";
import { MAP_HALF_SIZE, OBJECT_TYPES, type ObjectKind } from "./stage";

export const WALK_SPEED = 1.1;
export const RUN_SPEED = 3.4;
export const NOTICE_DISTANCE = 3.2;
export const SAFE_DISTANCE = 5.2;

export interface Walker {
  heading: number;
  turnIn: number;
  mode: "walking" | "fleeing" | "falling";
  phase: number;
}

export function createWalker(heading: number, random: () => number): Walker {
  return {
    heading,
    turnIn: 3 + random() * 3,
    mode: "walking",
    phase: random() * Math.PI * 2,
  };
}

export function walkerVelocity(
  walker: Walker,
  position: { x: number; z: number },
  hole: { x: number; z: number; radius: number },
  footprint: number,
  delta: number,
  random: () => number,
) {
  if (walker.mode === "falling") return { x: 0, z: 0 };
  const dx = position.x - hole.x;
  const dz = position.z - hole.z;
  const distance = Math.hypot(dx, dz);
  const alertRange =
    hole.radius + (walker.mode === "fleeing" ? SAFE_DISTANCE : NOTICE_DISTANCE);
  if (distance < alertRange) {
    walker.mode = "fleeing";
    if (distance > 0.001) walker.heading = Math.atan2(dx, dz);
  } else {
    if (walker.mode === "fleeing") walker.turnIn = 0;
    walker.mode = "walking";
    walker.turnIn -= delta;
    if (walker.turnIn <= 0) {
      walker.heading = random() * Math.PI * 2;
      walker.turnIn = 3 + random() * 3;
    }
  }
  const speed = walker.mode === "fleeing" ? RUN_SPEED : WALK_SPEED;
  let x = Math.sin(walker.heading) * speed;
  let z = Math.cos(walker.heading) * speed;
  const boundary = MAP_HALF_SIZE - footprint - 0.15;
  if (Math.abs(position.x + x * delta) > boundary) {
    x = -Math.sign(position.x) * Math.abs(x);
    walker.turnIn = Math.min(walker.turnIn, 0.5);
  }
  if (Math.abs(position.z + z * delta) > boundary) {
    z = -Math.sign(position.z) * Math.abs(z);
    walker.turnIn = Math.min(walker.turnIn, 0.5);
  }
  walker.heading = Math.atan2(x, z);
  walker.phase += delta * (walker.mode === "fleeing" ? 16 : 7);
  return { x, z };
}

export function driveWalker(
  body: RAPIER.RigidBody,
  walker: Walker,
  kind: ObjectKind,
  hole: { x: number; z: number; radius: number },
  delta: number,
  random: () => number,
) {
  const position = body.translation();
  const [width, height, depth] = OBJECT_TYPES[kind].size;
  const footprint = Math.hypot(width, depth) / 2;
  // Stop steering once support is lost so vertical motion and tipping remain physical.
  if (
    walker.mode !== "falling" &&
    (position.y - height / 2 < -0.05 ||
      Math.hypot(position.x - hole.x, position.z - hole.z) + footprint <
        hole.radius)
  ) {
    walker.mode = "falling";
    body.setEnabledRotations(true, true, true, true);
  }
  if (walker.mode === "falling") return;
  const velocity = walkerVelocity(
    walker,
    position,
    hole,
    footprint,
    delta,
    random,
  );
  body.setLinvel({ ...velocity, y: body.linvel().y }, true);
  body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  body.setRotation(
    {
      x: 0,
      y: Math.sin(walker.heading / 2),
      z: 0,
      w: Math.cos(walker.heading / 2),
    },
    true,
  );
}
