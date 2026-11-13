import type { GrowthObject } from "./growth-stage";
import { districtItem, type DistrictKind } from "./district-catalog";
import {
  districtSpaces,
  districtWalls,
  districtAreaForLevel,
  DISTRICT_STREETS,
  type DistrictProfile,
} from "./district-world";
import { insideToyRect, type ToyRect } from "./toy-world";
const RADII = [0.08, 0.14, 0.25, 0.45, 0.8, 1.5, 3, 6, 12, 24, 48, 160];
function sizeFor(kind: DistrictKind, r: number): [number, number, number] {
  return [r * 1.1, r * (districtItem(kind).height ?? 0.9), r * 0.8];
}
function foot(d: GrowthObject) {
  return Math.hypot(d.size[0], d.size[2]) / 2;
}
function touches(x: number, z: number, r: number, b: ToyRect) {
  return (
    Math.hypot(
      Math.max(0, b.minX - x, x - b.maxX),
      Math.max(0, b.minZ - z, z - b.maxZ),
    ) < r
  );
}
function routeDistance(
  x: number,
  z: number,
  points: readonly { x: number; z: number }[],
) {
  return Math.min(
    ...points.map((a, i) => {
      const b = points[(i + 1) % points.length],
        dx = b.x - a.x,
        dz = b.z - a.z,
        t = Math.max(
          0,
          Math.min(
            1,
            ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1),
          ),
        );
      return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
    }),
  );
}
class PlacementError extends Error {}
export function createDistrictStage(
  definitions: GrowthObject[],
  random: () => number,
  profile: DistrictProfile,
) {
  let last: PlacementError | undefined;
  for (let attempt = 0; attempt < 8; attempt++)
    try {
      return layout(definitions[0], random, profile);
    } catch (e) {
      if (!(e instanceof PlacementError)) throw e;
      last = e;
    }
  throw last!;
}
function layout(
  template: GrowthObject,
  random: () => number,
  profile: DistrictProfile,
) {
  const spaces = districtSpaces(profile),
    walls = districtWalls(profile);
  const placed: GrowthObject[] = [],
    reserved: { x: number; z: number; r: number }[] = [];
  const corridors = profile.routes.map((r) => ({
    area: r.area,
    kind: r.kind,
    foot: Math.hypot(r.size[0], r.size[2]) / 2,
    points: r.points.map(([x, z]) => ({ x, z })),
  }));
  const object = (
    id: string,
    kind: DistrictKind,
    size: [number, number, number],
    level: number,
    area = districtAreaForLevel(level),
  ): GrowthObject => ({
    ...template,
    id,
    kind: districtItem(kind).actor
      ? profile.stageId === "america"
        ? "american"
        : profile.stageId === "harbor"
          ? "dockWorker"
          : "officeWorker"
      : (districtItem(kind).original ??
        (districtItem(kind).vehicle
          ? "car"
          : kind === "liberty"
            ? "liberty"
            : kind === "tanker"
              ? "dinghy"
              : "parcel")),
    model: "district",
    districtKind: kind,
    label: districtItem(kind).label,
    size,
    level,
    area,
    scale: 1,
    value: 4 ** (level - 1),
    x: 0,
    z: 0,
    yaw: 0,
    behavior: "still",
    route: undefined,
    sourceLevel: undefined,
  });
  const add = (d: GrowthObject) => {
    placed.push(d);
    reserved.push({ x: d.x, z: d.z, r: foot(d) });
    return d;
  };
  const goal = object("goal", profile.goal.kind, profile.goal.size, 12, 4);
  goal.x = 600;
  goal.z = 0;
  if (profile.stageId === "harbor") goal.behavior = "moored";
  add(goal);
  profile.landmarks.forEach((l, i) => {
    const d = object(`district-landmark-${i}`, l.kind, l.size, l.level, l.area);
    d.x = l.x;
    d.z = l.z;
    if (l.kind === "boat") d.behavior = "moored";
    add(d);
  });
  if (profile.stageId === "harbor") {
    for (const crane of placed.filter((d) => d.districtKind === "crane")) {
      const d = object(
        `district-hoist-${crane.id}`,
        "hoistLoad",
        [crane.size[0] * 0.2, crane.size[1] * 0.09, crane.size[2] * 0.2],
        crane.level,
        crane.area,
      );
      d.behavior = "hoist";
      d.partnerId = crane.id;
      d.x = crane.x;
      d.z = crane.z + crane.size[2] * 0.43;
      d.stackY = crane.size[1] * 0.42;
      add(d);
    }
    // Separate crates rest on visible crates, and can fall independently.
    for (let i = 0; i < 3; i++) {
      const d = object(`district-stack-${i}`, "crate", [3, 2, 2.6], 7, 2);
      d.x = 95;
      d.z = -58;
      d.stackY = i * 2;
      add(d);
    }
  }
  const place = (d: GrowthObject, region = spaces[d.area].bounds) => {
    const s = spaces[d.area],
      r = foot(d),
      margin = r + s.thickness + 0.025;
    for (let i = 0; i < 4000; i++) {
      const x =
          region.minX +
          margin +
          random() * (region.maxX - region.minX - 2 * margin),
        z =
          region.minZ +
          margin +
          random() * (region.maxZ - region.minZ - 2 * margin);
      if (!insideToyRect({ x, z }, s.bounds, margin)) continue;
      if (d.area === 0 && Math.hypot(x, z) < r + 0.13) continue;
      if (d.area > 0 && touches(x, z, r + 0.05, spaces[d.area - 1].bounds))
        continue;
      if (walls.some((w) => touches(x, z, r + 0.025, w))) continue;
      if (
        corridors.some(
          (c) =>
            c.area === d.area &&
            routeDistance(x, z, c.points) <
              r + c.foot + (districtItem(c.kind).vehicle ? 2 : 0.12),
        )
      )
        continue;
      if (
        d.area === 4 &&
        DISTRICT_STREETS.some(
          (a) => Math.abs(x - a) < r + 16 || Math.abs(z - a) < r + 16,
        )
      )
        continue;
      if (d.area === 4 && profile.water.some((b) => touches(x, z, r + 0.05, b)))
        continue;
      if (reserved.some((o) => Math.hypot(x - o.x, z - o.z) < r + o.r + 0.02))
        continue;
      return { ...d, x, z, yaw: random() * Math.PI * 2 };
    }
    throw new PlacementError(`${d.label}を${s.label}へ配置できません`);
  };
  for (let level = 11; level >= 1; level--)
    for (let i = 0; i < 24; i++) {
      const kind =
        profile.stock[level - 1][i % profile.stock[level - 1].length];
      add(
        place(
          object(
            `growth-${level}-${i}`,
            kind,
            sizeFor(kind, RADII[level - 1]),
            level,
          ),
        ),
      );
    }
  for (const [index, route] of profile.routes.entries()) {
    const count = route.count,
      points = corridors[index].points;
    for (let i = 0; i < count; i++) {
      const side =
          route.queue || points.length === 2
            ? 0
            : Math.floor((i * points.length) / count),
        t = route.queue
          ? i / count
          : points.length === 2
            ? (i + 0.5) / count
            : (i * points.length) / count - side,
        a = points[side],
        b = points[(side + 1) % points.length];
      const d = object(
        `district-moving-${index}-${i}`,
        route.kind,
        [...route.size],
        spaces[route.area].level,
        route.area,
      );
      d.x = a.x + (b.x - a.x) * t;
      d.z = a.z + (b.z - a.z) * t;
      d.value = route.driving ? 256 : 16;
      d.behavior = route.driving ? "route" : "work";
      d.speedMultiplier = route.driving
        ? route.kind === "forklift"
          ? 1.5
          : 2.5
        : 0.7;
      d.route =
        route.queue || points.length === 2
          ? points
          : [
              { x: d.x, z: d.z },
              ...Array.from(
                { length: points.length },
                (_, j) => points[(side + 1 + j) % points.length],
              ),
            ];
      d.stationStop = route.driving ? 1 : undefined;
      add(d);
    }
  }
  for (const [area, count] of [
    [1, 12],
    [2, 40],
    [3, 36],
  ] as const)
    for (let i = 0; i < count; i++) {
      const kinds = profile.extras[area - 1],
        kind = kinds[i % kinds.length];
      const base = area === 1 ? 0.9 : area === 2 ? 4 : 12;
      const d = object(
        `district-scenery-${area}-${i}`,
        kind,
        sizeFor(kind, base),
        spaces[area].level,
        area,
      );
      d.value = area === 1 ? 16 : area === 2 ? 4096 : 65536;
      add(place(d));
    }
  const centres = [-1200, -720, -240, 240, 720, 1200];
  for (let column = 0; column < 6; column++)
    for (let row = 0; row < 6; row++) {
      const cx = centres[column],
        cz = centres[row];
      const region = {
        minX: cx - 200,
        maxX: cx + 200,
        minZ: cz - 200,
        maxZ: cz + 200,
      };
      if (
        touches(
          (region.minX + region.maxX) / 2,
          (region.minZ + region.maxZ) / 2,
          200,
          spaces[3].bounds,
        )
      )
        continue;
      for (let i = 0; i < 8; i++) {
        const kind = profile.skyline[i % profile.skyline.length],
          base = i < 4 ? 45 + random() * 22 : i < 6 ? 22 : 9;
        const d = object(
          `district-city-${column}-${row}-${i}`,
          kind,
          sizeFor(kind, base),
          11,
          4,
        );
        d.value = i < 4 ? 4 ** 10 : 4 ** 8;
        d.yaw = 0;
        const p = place(d, region);
        p.yaw = 0;
        add(p);
      }
    }
  return placed.sort((a, b) => a.area - b.area || a.level - b.level);
}
