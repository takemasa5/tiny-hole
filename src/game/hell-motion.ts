import type { GrowthObject } from "./growth-stage";
import { footprintOf, GROWTH_RADII } from "./growth-stage";
import type { ThemeMotion } from "./theme-behavior";
import { HELL_SPACES } from "./hell-world";
function profile(kind: GrowthObject["hellKind"], time: number) {
  switch (kind) {
    case "smallOni":
      return {
        ratio: time % 2.8 < 1.8 ? 1.05 : 0.65,
        angle: Math.sin(time * 7) * 0.45,
        walk: 2.4,
      };
    case "ghost":
      return { ratio: 0.85, angle: Math.sin(time * 2.7) * 0.25, walk: 2.3 };
    case "redOni":
      return { ratio: time % 3.4 < 2.2 ? 1.08 : 0.6, angle: 0, walk: 2 };
    case "blueOni":
      return {
        ratio: time % 4.6 < 2.8 ? 1 : 0.72,
        angle: Math.sin(time * 1.25) * 0.5,
        walk: 1.6,
      };
    default:
      return {
        ratio: time % 4.5 < 3 ? 1.1 : 0.62,
        angle: Math.sin(time * 0.8) * 0.16,
        walk: 1.4,
      };
  }
}
export function hellVelocity(
  d: GrowthObject,
  m: ThemeMotion,
  p: { x: number; z: number },
  hole: { x: number; z: number; radius: number },
  delta: number,
) {
  const oni =
    d.hellKind === "smallOni" ||
    d.hellKind === "redOni" ||
    d.hellKind === "blueOni";
  const speedScale = oni ? 0.9 : 1;
  m.time += delta;
  if (m.phase === "falling") return { x: 0, z: 0 };
  const foot = footprintOf(d),
    distance = Math.hypot(p.x - hole.x, p.z - hole.z),
    enma = d.hellKind === "enma";
  if (
    foot < hole.radius &&
    distance <
      hole.radius *
        (m.phase === "fleeing" ? (enma ? 6 : 5.2) : enma ? 4.2 : 3.4)
  ) {
    m.fleeTime += delta;
    m.phase = "fleeing";
    const f = profile(d.hellKind, m.fleeTime);
    const angle =
      Math.atan2(p.x - hole.x || 0.0001, p.z - hole.z || 0.0001) + f.angle;
    // Losing footholds removes the push for a last dodge before vertical sinking is measurable.
    const traction = oni
      ? Math.max(0, Math.min(1, (distance + foot - hole.radius) / (2 * foot)))
      : 1;
    const speed = hole.radius * 7 * f.ratio * speedScale * traction;
    const direction = escapeDirection(
      d,
      p,
      angle,
      speed,
      hole.radius,
      delta,
      m.heading,
      oni ? (Math.PI / 2) * delta : Infinity,
    );
    m.heading = direction.heading;
    return { x: direction.x * speed, z: direction.z * speed };
  }
  m.fleeTime = 0;
  const speed =
    GROWTH_RADII[d.level - 1] * profile(d.hellKind, 0).walk * speedScale;
  if (m.wait > 0) {
    m.wait = Math.max(0, m.wait - delta);
    m.phase = "waiting";
    return { x: 0, z: 0 };
  }
  if (!d.route?.length) return { x: 0, z: 0 };
  const target = d.route[m.waypoint],
    dx = target.x - p.x,
    dz = target.z - p.z,
    length = Math.hypot(dx, dz);
  if (length < Math.max(speed * delta * 2, foot * 0.2)) {
    m.waypoint = (m.waypoint + 1) % d.route.length;
    m.wait = 0.18;
    m.phase = "waiting";
    return { x: 0, z: 0 };
  }
  m.phase = "working";
  m.heading = Math.atan2(dx, dz);
  return { x: (dx / length) * speed, z: (dz / length) * speed };
}
function escapeDirection(
  d: GrowthObject,
  p: { x: number; z: number },
  angle: number,
  speed: number,
  radius: number,
  delta: number,
  previous: number,
  maxTurn: number,
) {
  const area = HELL_SPACES[d.area],
    outer = area.bounds,
    inner = d.area > 0 ? HELL_SPACES[d.area - 1].bounds : undefined;
  const foot = footprintOf(d) + area.thickness / 2 + 0.02,
    look = Math.max(speed * delta * 3, radius * 0.55, foot * 0.4);
  const inInner = (q: { x: number; z: number }) =>
    inner &&
    q.x > inner.minX - foot &&
    q.x < inner.maxX + foot &&
    q.z > inner.minZ - foot &&
    q.z < inner.maxZ + foot;
  const depth = (q: { x: number; z: number }) =>
    inner
      ? Math.min(
          q.x - inner.minX + foot,
          inner.maxX + foot - q.x,
          q.z - inner.minZ + foot,
          inner.maxZ + foot - q.z,
        )
      : 0;
  const clear = (q: { x: number; z: number }) =>
    q.x >= outer.minX + foot &&
    q.x <= outer.maxX - foot &&
    q.z >= outer.minZ + foot &&
    q.z <= outer.maxZ - foot &&
    !(inInner(q) && (!inInner(p) || depth(q) >= depth(p)));
  let best = previous,
    score = -Infinity;
  for (let i = 0; i < 24; i++) {
    const a = angle + (i * Math.PI) / 12,
      q = { x: p.x + Math.sin(a) * look, z: p.z + Math.cos(a) * look };
    if (!clear(q)) continue;
    const value = Math.cos(a - angle) + 0.02 * Math.cos(a - previous);
    if (value > score) {
      score = value;
      best = a;
    }
  }
  const difference = Math.atan2(
      Math.sin(best - previous),
      Math.cos(best - previous),
    ),
    heading = previous + Math.max(-maxTurn, Math.min(maxTurn, difference)),
    x = Math.sin(heading),
    z = Math.cos(heading);
  // Brake while turning at a wall instead of snapping to an instantly safe heading.
  if (maxTurn !== Infinity && !clear({ x: p.x + x * look, z: p.z + z * look }))
    return { x: 0, z: 0, heading };
  return { x, z, heading };
}
