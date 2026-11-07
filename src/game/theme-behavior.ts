import type { GrowthObject } from "./growth-stage";
import { footprintOf } from "./growth-stage";

export interface ThemeMotion {
  phase:
    | "working"
    | "driving"
    | "waiting"
    | "fighting"
    | "searching"
    | "fleeing"
    | "falling";
  waypoint: number;
  time: number;
  wait: number;
  heading: number;
}

export function createThemeMotion(definition: GrowthObject): ThemeMotion {
  const start =
    definition.route?.findIndex(
      (p) => p.x === definition.x && p.z === definition.z,
    ) ?? 0;
  const waypoint = definition.route
    ? (Math.max(0, start) + 1) % definition.route.length
    : 0;
  const target = definition.route?.[waypoint];
  return {
    phase: definition.behavior === "battle" ? "fighting" : "working",
    waypoint,
    time: 0,
    wait: 0,
    heading: target
      ? Math.atan2(target.x - definition.x, target.z - definition.z)
      : definition.yaw,
  };
}

export function vehicleBlocksRoute(
  definition: GrowthObject,
  heading: number,
  position: { x: number; z: number },
  other: GrowthObject,
  otherPosition: { x: number; z: number },
) {
  const dx = otherPosition.x - position.x,
    dz = otherPosition.z - position.z;
  const width = Math.min(definition.size[0], definition.size[2]);
  const otherWidth = Math.min(other.size[0], other.size[2]);
  const forward = dx * Math.sin(heading) + dz * Math.cos(heading);
  const sideways = Math.abs(dx * Math.cos(heading) - dz * Math.sin(heading));
  return (
    Math.hypot(dx, dz) < footprintOf(definition) * 3 &&
    forward > width * 0.1 &&
    sideways < (width + otherWidth) * 0.55
  );
}

export function themeVelocity(
  definition: GrowthObject,
  motion: ThemeMotion,
  position: { x: number; z: number },
  hole: { x: number; z: number; radius: number },
  delta: number,
  partner?: { x: number; z: number },
  blocked = false,
) {
  motion.time += delta;
  if (motion.phase === "falling") return { x: 0, z: 0 };
  const footprint = footprintOf(definition);
  const speed =
    Math.max(0.08, Math.hypot(...definition.size) * 0.35) *
    (definition.speedMultiplier ?? 1);
  const distance = Math.hypot(position.x - hole.x, position.z - hole.z);
  const driving =
    definition.behavior === "route" || definition.behavior === "train";
  if (!driving && footprint < hole.radius && distance < hole.radius * 2.5) {
    motion.phase = "fleeing";
    const dx = position.x - hole.x || Math.sin(motion.heading) * 0.01;
    const dz = position.z - hole.z || Math.cos(motion.heading) * 0.01;
    const length = Math.hypot(dx, dz) || 1;
    motion.heading = Math.atan2(dx, dz);
    return { x: (dx / length) * speed * 1.8, z: (dz / length) * speed * 1.8 };
  }
  if (definition.behavior === "battle") {
    motion.phase = partner ? "fighting" : "searching";
    const target = partner ?? {
      x: definition.x + Math.sin(motion.time * 0.35) * 12,
      z: definition.z + Math.cos(motion.time * 0.35) * 12,
    };
    motion.heading = Math.atan2(target.x - position.x, target.z - position.z);
    const beat = motion.time % 6;
    const movement = partner
      ? beat < 1.5
        ? 0.6
        : beat > 4.5
          ? -0.35
          : 0
      : 0.3;
    // Keep the encounter within its plaza even after one participant disappears.
    const home = Math.hypot(
      position.x - definition.x,
      position.z - definition.z,
    );
    if (home > 25)
      motion.heading = Math.atan2(
        definition.x - position.x,
        definition.z - position.z,
      );
    return {
      x: Math.sin(motion.heading) * speed * (home > 25 ? 0.6 : movement),
      z: Math.cos(motion.heading) * speed * (home > 25 ? 0.6 : movement),
    };
  }
  if (!definition.route) return { x: 0, z: 0 };
  if (blocked || motion.wait > 0) {
    motion.phase = "waiting";
    motion.wait = Math.max(0, motion.wait - delta);
    return { x: 0, z: 0 };
  }
  const target = definition.route[motion.waypoint];
  const dx = target.x - position.x,
    dz = target.z - position.z;
  const length = Math.hypot(dx, dz);
  if (length < Math.max(speed * delta * 2, footprint * 0.2)) {
    const atStation = definition.stationStop === motion.waypoint;
    motion.waypoint = (motion.waypoint + 1) % definition.route.length;
    motion.wait = atStation ? 2 : driving ? 0.7 : 2;
    motion.phase = "waiting";
    return { x: 0, z: 0 };
  }
  motion.phase = driving ? "driving" : "working";
  motion.heading = Math.atan2(dx, dz);
  return { x: (dx / length) * speed, z: (dz / length) * speed };
}

export function themeYaw(
  definition: Pick<GrowthObject, "behavior">,
  heading: number,
) {
  return (
    heading -
    (["route", "train"].includes(definition.behavior) ? Math.PI / 2 : 0)
  );
}
