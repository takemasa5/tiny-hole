import type { GrowthObject } from "./growth-stage";
import type { PlazaKind } from "./plaza-visuals";
import {
  PLAZA_SPACES,
  PLAZA_WALLS,
  PLAZA_ROUTES,
  PLAZA_CITY_STREETS,
  plazaAreaForLevel,
} from "./plaza-world";
import { insideToyRect, type ToyRect } from "./toy-world";
const RADII = [0.08, 0.14, 0.25, 0.45, 0.8, 1.5, 3, 6, 12, 24, 48, 160];
const LABELS: Record<PlazaKind, string> = {
  seed: "花の種",
  pebble: "小石",
  petal: "花びら",
  leaf: "落ち葉",
  flower: "花",
  bucket: "砂遊びのバケツ",
  ball: "ボール",
  wateringCan: "じょうろ",
  tricycle: "三輪車",
  bench: "公園のベンチ",
  bin: "ごみ箱",
  slide: "すべり台",
  swing: "ブランコ",
  tree: "公園の木",
  fountain: "公園の噴水",
  stall: "果物の露店",
  lamp: "街灯",
  shop: "商店",
  apartment: "街のビル",
  civicHall: "記念広場の会館",
  person: "散歩する人",
  van: "配送車",
  monument: "巨大な記念塔",
};
const STOCK: readonly (readonly PlazaKind[])[] = [
  ["seed", "pebble", "petal"],
  ["leaf", "petal", "seed"],
  ["flower", "wateringCan", "bucket"],
  ["ball", "bucket", "tricycle"],
  ["tricycle", "bench", "bin"],
  ["slide", "swing", "bench"],
  ["bench", "tree", "stall"],
  ["fountain", "tree", "stall"],
  ["stall", "shop", "lamp"],
  ["shop", "apartment", "van"],
  ["apartment", "civicHall"],
];
function sizeFor(kind: PlazaKind, r: number): [number, number, number] {
  const h =
    kind === "apartment"
      ? 3.5
      : kind === "lamp"
        ? 3
        : kind === "tree"
          ? 2.8
          : kind === "flower"
            ? 2.4
            : kind === "swing"
              ? 1.9
              : kind === "slide"
                ? 1.6
                : kind === "shop"
                  ? 1.8
                  : kind === "leaf" || kind === "petal"
                    ? 0.12
                    : 0.9;
  return [r * (kind === "bench" ? 1.4 : 1.1), r * h, r * 0.8];
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
export function createPlazaStage(
  definitions: GrowthObject[],
  random: () => number,
) {
  let last: PlacementError | undefined;
  for (let attempt = 0; attempt < 8; attempt++)
    try {
      return layout(definitions[0], random);
    } catch (e) {
      if (!(e instanceof PlacementError)) throw e;
      last = e;
    }
  throw last!;
}
function layout(template: GrowthObject, random: () => number) {
  const placed: GrowthObject[] = [],
    reserved: { x: number; z: number; r: number }[] = [];
  const corridors = PLAZA_ROUTES.map((r) => ({
    area: r.area,
    foot: Math.hypot(r.size[0], r.size[2]) / 2,
    points: r.points.map(([x, z]) => ({ x, z })),
  }));
  const object = (
    id: string,
    kind: PlazaKind,
    size: [number, number, number],
    level: number,
    area = plazaAreaForLevel(level),
  ): GrowthObject => ({
    ...template,
    id,
    kind:
      kind === "person"
        ? "person"
        : kind === "van"
          ? "car"
          : kind === "monument"
            ? "monument"
            : "parcel",
    model: "plaza",
    plazaKind: kind,
    label: LABELS[kind],
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
  const goal = object("goal", "monument", [190, 540, 190], 12, 4);
  goal.x = 600;
  goal.z = 0;
  add(goal);
  const landmarks: [
    PlazaKind,
    [number, number, number],
    number,
    number,
    number,
    number,
  ][] = [
    ["flower", [0.65, 1.7, 0.65], 0, -1.1, -0.7, 3],
    ["flower", [0.7, 1.9, 0.7], 0, -1.1, 0.65, 3],
    ["slide", [5, 4, 2.8], 1, 11, -7, 6],
    ["swing", [5, 5, 3], 1, 12, 7, 6],
    ["fountain", [13, 12, 13], 2, 77, 0, 8],
    ["tree", [15, 28, 15], 2, 75, -53, 8],
    ["shop", [28, 38, 24], 3, 250, -80, 10],
    ["shop", [32, 32, 24], 3, 310, 80, 10],
  ];
  landmarks.forEach(([kind, size, area, x, z, level], i) => {
    const d = object(`plaza-landmark-${i}`, kind, size, level, area);
    d.x = x;
    d.z = z;
    add(d);
  });
  const place = (d: GrowthObject, region = PLAZA_SPACES[d.area].bounds) => {
    const s = PLAZA_SPACES[d.area],
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
      if (
        d.area > 0 &&
        touches(x, z, r + 0.05, PLAZA_SPACES[d.area - 1].bounds)
      )
        continue;
      if (PLAZA_WALLS.some((w) => touches(x, z, r + 0.025, w))) continue;
      if (
        corridors.some(
          (c) =>
            c.area === d.area &&
            routeDistance(x, z, c.points) < r + c.foot + 0.12,
        )
      )
        continue;
      if (
        d.area === 4 &&
        PLAZA_CITY_STREETS.some(
          (a) => Math.abs(x - a) < r + 16 || Math.abs(z - a) < r + 16,
        )
      )
        continue;
      if (reserved.some((o) => Math.hypot(x - o.x, z - o.z) < r + o.r + 0.02))
        continue;
      return { ...d, x, z, yaw: random() * Math.PI * 2 };
    }
    throw new PlacementError(`${d.label}を${s.label}へ配置できません`);
  };
  for (let level = 11; level >= 1; level--)
    for (let i = 0; i < 24; i++) {
      const kind = STOCK[level - 1][i % STOCK[level - 1].length];
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
  // People use footpaths; delivery vehicles stop along routes between the shops.
  for (const [index, route] of PLAZA_ROUTES.entries()) {
    const count =
        route.kind === "person"
          ? route.area === 1
            ? 8
            : 12
          : route.area === 4
            ? 8
            : 4,
      points = corridors[index].points;
    for (let i = 0; i < count; i++) {
      const side = Math.floor((i * 4) / count),
        t = (i * 4) / count - side,
        a = points[side],
        b = points[(side + 1) % 4];
      const d = object(
        `plaza-${route.kind}-${index}-${i}`,
        route.kind,
        [...route.size],
        PLAZA_SPACES[route.area].level,
        route.area,
      );
      d.x = a.x + (b.x - a.x) * t;
      d.z = a.z + (b.z - a.z) * t;
      d.value = route.kind === "person" ? 16 : 256;
      d.behavior = route.kind === "person" ? "work" : "route";
      d.speedMultiplier = route.kind === "person" ? 0.7 : 2.8;
      d.route = [
        { x: d.x, z: d.z },
        ...Array.from({ length: 4 }, (_, j) => points[(side + 1 + j) % 4]),
      ];
      d.stationStop = route.kind === "van" ? 1 : undefined;
      add(d);
    }
  }
  for (const [area, count] of [
    [1, 12],
    [2, 40],
    [3, 36],
  ] as const)
    for (let i = 0; i < count; i++) {
      const kind: PlazaKind =
        area === 1
          ? (["flower", "bench", "bin"] as const)[i % 3]
          : area === 2
            ? (["tree", "bench", "lamp", "stall"] as const)[i % 4]
            : (["shop", "stall", "lamp", "tree"] as const)[i % 4];
      const base = area === 1 ? 0.9 : area === 2 ? 4 : 12;
      const d = object(
        `plaza-scenery-${area}-${i}`,
        kind,
        sizeFor(kind, base),
        PLAZA_SPACES[area].level,
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
          PLAZA_SPACES[3].bounds,
        )
      )
        continue;
      for (let i = 0; i < 8; i++) {
        const kind: PlazaKind =
          i < 4 ? (i % 2 ? "apartment" : "shop") : i < 6 ? "tree" : "lamp";
        const base = i < 4 ? 45 + random() * 22 : i < 6 ? 22 : 9;
        const d = object(
          `plaza-city-${column}-${row}-${i}`,
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
