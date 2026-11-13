import type { GrowthObject } from "./growth-stage";
import type { MountainKind } from "./mountain-visuals";
import {
  MOUNTAIN_SPACES,
  MOUNTAIN_WALLS,
  MOUNTAIN_ROUTES,
  mountainAreaForLevel,
} from "./mountain-world";
import { insideToyRect, type ToyRect } from "./toy-world";
const RADII = [0.08, 0.14, 0.25, 0.45, 0.8, 1.5, 3, 6, 12, 24, 48, 160];
const LABELS: Record<MountainKind, string> = {
  acorn: "どんぐり",
  pinecone: "松ぼっくり",
  twig: "小枝",
  mushroom: "キノコ",
  leaf: "落ち葉",
  pebble: "小石",
  fern: "シダ",
  lantern: "ランタン",
  kettle: "やかん",
  stool: "キャンプの椅子",
  campTable: "キャンプのテーブル",
  tent: "テント",
  cooler: "クーラーボックス",
  firewood: "薪の束",
  log: "丸太",
  stump: "切り株",
  cabin: "山小屋",
  logRack: "丸太置き場",
  truck: "丸太を運ぶトラック",
  pine: "杉の木",
  oak: "森の木",
  rock: "苔の岩",
  torii: "聖域の鳥居",
  tanuki: "たぬき",
  deer: "鹿",
  fox: "きつね",
  greatTree: "森の大樹",
  ancientTree: "森の巨木",
  shrine: "森の祠",
  burrow: "動物の巣",
  berries: "木の実の茂み",
};
const STOCK: readonly (readonly MountainKind[])[] = [
  ["acorn", "twig", "pebble"],
  ["mushroom", "pinecone", "leaf"],
  ["mushroom", "fern", "twig"],
  ["lantern", "kettle", "stool"],
  ["tent", "cooler", "campTable"],
  ["tent", "firewood", "campTable"],
  ["log", "stump", "logRack"],
  ["cabin", "logRack", "truck"],
  ["pine", "oak", "rock"],
  ["oak", "pine", "torii"],
  ["ancientTree", "shrine", "rock"],
];
function sizeFor(kind: MountainKind, r: number): [number, number, number] {
  const height =
    kind === "pine"
      ? 4
      : kind === "oak" || kind === "ancientTree"
        ? 3.5
        : kind === "torii"
          ? 2.5
          : kind === "cabin"
            ? 1.8
            : kind === "fern"
              ? 1.7
              : kind === "tent" || kind === "shrine"
                ? 1.5
                : kind === "stump"
                  ? 1.2
                  : kind === "leaf"
                    ? 0.12
                    : kind === "twig"
                      ? 0.2
                      : kind === "log"
                        ? 0.5
                        : 0.9;
  return [
    r * (kind === "log" ? 1.4 : 1.1),
    r * height,
    r * (kind === "log" ? 0.6 : 0.8),
  ];
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
export function createMountainStage(
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
  const corridors = MOUNTAIN_ROUTES.map((r) => ({
    area: r.area,
    kind: r.kind,
    foot: Math.hypot(r.size[0], r.size[2]) / 2,
    points: r.points.map(([x, z]) => ({ x, z })),
  }));
  const object = (
    id: string,
    kind: MountainKind,
    size: [number, number, number],
    level: number,
    area = mountainAreaForLevel(level),
  ): GrowthObject => ({
    ...template,
    id,
    kind:
      kind === "tanuki"
        ? "tanuki"
        : kind === "truck"
          ? "car"
          : kind === "greatTree"
            ? "greatTree"
            : "parcel",
    model: "mountain",
    mountainKind: kind,
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
  const goal = object("goal", "greatTree", [200, 680, 200], 12, 4);
  goal.x = 600;
  goal.z = 0;
  add(goal);
  const landmarks: [
    MountainKind,
    [number, number, number],
    number,
    number,
    number,
    number,
  ][] = [
    ["stump", [0.7, 1.25, 0.65], 0, -1.0, 0.65, 3],
    ["fern", [0.6, 1, 0.6], 0, -1.05, -0.65, 3],
    ["tent", [4.8, 3, 3.2], 1, 11, -7, 6],
    ["campTable", [4, 2, 2.7], 1, 12, 7, 6],
    ["cabin", [13, 14, 11], 2, 77, 0, 8],
    ["logRack", [9, 6, 7], 2, 75, -53, 8],
    ["oak", [32, 70, 30], 3, 250, -80, 10],
    ["rock", [40, 25, 35], 3, 310, 80, 10],
    ["torii", [40, 36, 12], 4, 600, 230, 11],
    ["shrine", [28, 26, 25], 4, 600, -230, 11],
  ];
  landmarks.forEach(([kind, size, area, x, z, level], i) => {
    const d = object(`mountain-landmark-${i}`, kind, size, level, area);
    d.x = x;
    d.z = z;
    add(d);
  });
  for (const [index, route] of MOUNTAIN_ROUTES.entries()) {
    if (route.kind === "truck") continue;
    for (const [end, kind] of ["burrow", "berries"].entries()) {
      const point = route.points[end];
      const reach =
        route.kind === "tanuki" ? 1.3 : route.kind === "fox" ? 1.6 : 2;
      const size: [number, number, number] =
        end === 1 || route.kind === "tanuki"
          ? [1.2, 0.9, 1]
          : route.kind === "fox"
            ? [1.6, 1.2, 1.4]
            : [2, 1.5, 1.8];
      const d = object(
        `mountain-habitat-${index}-${end}`,
        kind as MountainKind,
        size,
        MOUNTAIN_SPACES[route.area].level,
        route.area,
      );
      d.x = point[0] + (end === 0 ? -reach : reach);
      d.z = point[1];
      d.yaw = end === 0 ? Math.PI / 2 : 0;
      d.value = 16;
      add(d);
    }
  }
  for (const [stack, [x, z]] of [
    [70, 24],
    [90, 24],
    [70, -24],
    [90, -24],
  ].entries()) {
    for (let layer = 0; layer < 3; layer++)
      for (const side of [-1, 1]) {
        const d = object(
          `mountain-stack-${stack}-${layer}-${side}`,
          "log",
          [4, 0.8, 0.8],
          7,
          2,
        );
        d.x = x + (layer % 2 ? side * 0.6 : 0);
        d.z = z + (layer % 2 ? 0 : side * 0.6);
        d.yaw = ((layer % 2) * Math.PI) / 2;
        d.stackY = layer * 0.8;
        add(d);
      }
  }
  const place = (d: GrowthObject, region = MOUNTAIN_SPACES[d.area].bounds) => {
    const s = MOUNTAIN_SPACES[d.area],
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
        touches(x, z, r + 0.05, MOUNTAIN_SPACES[d.area - 1].bounds)
      )
        continue;
      if (MOUNTAIN_WALLS.some((w) => touches(x, z, r + 0.025, w))) continue;
      if (
        corridors.some(
          (c) =>
            c.area === d.area &&
            routeDistance(x, z, c.points) <
              r + c.foot + (c.kind === "truck" ? 2.5 : 0.12),
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
  // Animals return to their burrow and feeding patch; trucks stop along the logging road.
  for (const [index, route] of MOUNTAIN_ROUTES.entries()) {
    const count = route.count,
      points = corridors[index].points,
      truck = route.kind === "truck";
    for (let i = 0; i < count; i++) {
      const side =
          points.length === 2 ? 0 : Math.floor((i * points.length) / count),
        t =
          points.length === 2
            ? (i + 0.5) / count
            : (i * points.length) / count - side,
        a = points[side],
        b = points[(side + 1) % points.length];
      const d = object(
        `mountain-${route.kind}-${index}-${i}`,
        route.kind,
        [...route.size],
        MOUNTAIN_SPACES[route.area].level,
        route.area,
      );
      d.x = a.x + (b.x - a.x) * t;
      d.z = a.z + (b.z - a.z) * t;
      d.value = truck ? 256 : 16;
      d.behavior = truck ? "route" : "work";
      d.speedMultiplier = truck ? 2.2 : 0.85;
      d.route =
        points.length === 2
          ? points
          : [
              { x: d.x, z: d.z },
              ...Array.from(
                { length: points.length },
                (_, j) => points[(side + 1 + j) % points.length],
              ),
            ];
      d.stationStop = truck ? 1 : undefined;
      add(d);
    }
  }
  for (const [area, count] of [
    [1, 12],
    [2, 40],
    [3, 36],
  ] as const)
    for (let i = 0; i < count; i++) {
      const kind: MountainKind =
        area === 1
          ? (["stool", "firewood", "lantern"] as const)[i % 3]
          : area === 2
            ? (["log", "stump", "cabin", "logRack"] as const)[i % 4]
            : (["pine", "oak", "rock", "fern"] as const)[i % 4];
      const base = area === 1 ? 0.9 : area === 2 ? 4 : 12;
      const d = object(
        `mountain-scenery-${area}-${i}`,
        kind,
        sizeFor(kind, base),
        MOUNTAIN_SPACES[area].level,
        area,
      );
      d.value = area === 1 ? 16 : area === 2 ? 4096 : 65536;
      add(place(d));
    }
  const centres = [-1200, -720, -240, 240, 720, 1200];
  for (let column = 0; column < 6; column++)
    for (let row = 0; row < 6; row++) {
      const cx = centres[column] + (random() - 0.5) * 100,
        cz = centres[row] + (random() - 0.5) * 100;
      const region = {
        minX: cx - 200,
        maxX: cx + 200,
        minZ: cz - 200,
        maxZ: cz + 200,
      };
      if (
        touches(centres[column], centres[row], 200, MOUNTAIN_SPACES[3].bounds)
      )
        continue;
      for (let i = 0; i < 8; i++) {
        const kind: MountainKind = (
          [
            "pine",
            "oak",
            "pine",
            "ancientTree",
            "oak",
            "pine",
            "rock",
            "fern",
          ] as const
        )[i];
        const base = i < 6 ? 35 + random() * 25 : i === 6 ? 18 : 12;
        const d = object(
          `mountain-grove-${column}-${row}-${i}`,
          kind,
          sizeFor(kind, base),
          11,
          4,
        );
        d.value = i < 6 ? 4 ** 10 : 4 ** 8;
        d.yaw = 0;
        const p = place(d, region);
        p.yaw = 0;
        add(p);
      }
    }
  return placed.sort((a, b) => a.area - b.area || a.level - b.level);
}
