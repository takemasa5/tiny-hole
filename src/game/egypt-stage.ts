import type { GrowthObject } from "./growth-stage";
import type { EgyptKind } from "./egypt-visuals";
import {
  EGYPT_SPACES,
  EGYPT_WALLS,
  EGYPT_ROADS,
  EGYPT_STREETS_X,
  EGYPT_STREETS_Z,
  egyptAreaForLevel,
} from "./egypt-world";
import { insideToyRect, type ToyRect } from "./toy-world";

type Recipe = [EgyptKind, string, [number, number, number]];
const STOCK: Recipe[][] = [
  [
    ["seal", "壁画の印章", [0.07, 0.025, 0.06]],
    ["scarab", "小さなスカラベ", [0.075, 0.03, 0.05]],
  ],
  [
    ["muralBird", "壁画の鳥", [0.15, 0.2, 0.025]],
    ["muralPerson", "壁画の人", [0.11, 0.24, 0.025]],
    ["scarab", "スカラベ", [0.16, 0.06, 0.12]],
  ],
  [
    ["muralBoat", "壁画の船", [0.32, 0.22, 0.04]],
    ["muralPerson", "供物を運ぶ壁画の人", [0.18, 0.4, 0.025]],
    ["muralBird", "壁画の大きな鳥", [0.22, 0.3, 0.03]],
  ],
  [
    ["jar", "彩色の壺", [0.45, 0.65, 0.45]],
    ["offering", "供物の皿", [0.65, 0.25, 0.4]],
    ["chest", "墓の小箱", [0.6, 0.45, 0.45]],
  ],
  [
    ["chest", "王家の宝箱", [1, 0.7, 0.8]],
    ["jar", "大きな壺", [0.9, 1.4, 0.9]],
    ["table", "供物台", [1.1, 0.8, 0.7]],
  ],
  [
    ["sarcophagus", "王の石棺", [2.4, 1.1, 0.9]],
    ["statue", "守護神の像", [0.8, 2.5, 0.8]],
    ["table", "石の供物台", [2, 1.1, 1.4]],
  ],
  [
    ["statue", "神殿の石像", [3, 8, 3]],
    ["obelisk", "オベリスク", [2.6, 10, 2.6]],
    ["column", "彩色の石柱", [3.5, 9, 3.5]],
  ],
  [
    ["shrine", "小神殿", [7, 7.5, 6]],
    ["gateway", "神殿の門", [7.5, 10, 6]],
    ["sphinx", "スフィンクス像", [8, 5, 5]],
  ],
  [
    ["stall", "市場の露店", [12, 8, 10]],
    ["house", "日干し煉瓦の家", [13, 12, 11]],
    ["palm", "ナツメヤシ", [8, 20, 8]],
  ],
  [
    ["house", "街の大きな家", [26, 19, 20]],
    ["gateway", "街の門", [28, 28, 24]],
    ["shrine", "街の礼拝堂", [30, 26, 28]],
  ],
  [
    ["temple", "列柱神殿", [54, 40, 50]],
    ["pyramid", "小ピラミッド", [55, 48, 55]],
    ["obelisk", "大オベリスク", [28, 90, 28]],
  ],
];
const STORY_ROUTES = [
  [
    { x: -0.95, z: -0.65 },
    { x: 0.95, z: -0.65 },
    { x: 0.95, z: -0.36 },
    { x: -0.95, z: -0.36 },
  ],
  [
    { x: -0.95, z: 0.35 },
    { x: 0.95, z: 0.35 },
    { x: 0.95, z: 0.65 },
    { x: -0.95, z: 0.65 },
  ],
];
const PRIEST_ROUTE = [
  { x: 3, z: 2 },
  { x: 11, z: 2 },
  { x: 11, z: 4 },
  { x: 3, z: 4 },
];
const GODS: {
  kind: "anubis" | "horus" | "sobek";
  label: string;
  size: [number, number, number];
  level: number;
  route: { x: number; z: number }[];
}[] = [
  {
    kind: "anubis",
    label: "巨大なアヌビス神",
    size: [48, 180, 3],
    level: 11,
    route: [
      { x: 320, z: 160 },
      { x: 760, z: 160 },
      { x: 760, z: 620 },
      { x: 320, z: 620 },
    ],
  },
  {
    kind: "horus",
    label: "巨大なホルス神",
    size: [56, 220, 3.6],
    level: 11,
    route: [
      { x: 760, z: -320 },
      { x: 1300, z: -320 },
      { x: 1300, z: 160 },
      { x: 760, z: 160 },
    ],
  },
  {
    kind: "sobek",
    label: "巨大なセベク神",
    size: [80, 260, 4.2],
    level: 12,
    route: [
      { x: -400, z: 160 },
      { x: -400, z: 620 },
      { x: 320, z: 620 },
      { x: 320, z: 160 },
    ],
  },
];
class EgyptPlacementError extends Error {}
function foot(d: GrowthObject) {
  return Math.hypot(d.size[0], d.size[2]) / 2;
}
function nearRect(p: { x: number; z: number }, r: number, b: ToyRect) {
  return (
    Math.hypot(
      Math.max(0, b.minX - p.x, p.x - b.maxX),
      Math.max(0, b.minZ - p.z, p.z - b.maxZ),
    ) < r
  );
}
function routeDistance(
  p: { x: number; z: number },
  route: { x: number; z: number }[],
) {
  return Math.min(
    ...route.map((a, i) => {
      const b = route[(i + 1) % route.length];
      return Math.hypot(
        p.x - Math.max(Math.min(a.x, b.x), Math.min(Math.max(a.x, b.x), p.x)),
        p.z - Math.max(Math.min(a.z, b.z), Math.min(Math.max(a.z, b.z), p.z)),
      );
    }),
  );
}
function object(
  base: GrowthObject,
  recipe: Recipe,
  level = base.level,
): GrowthObject {
  return {
    ...base,
    model: "egypt",
    egyptKind: recipe[0],
    label: recipe[1],
    size: [...recipe[2]],
    scale: 1,
    level,
    area: egyptAreaForLevel(level),
    value: 4 ** (level - 1),
    behavior: "still",
    route: undefined,
    yaw: 0,
  };
}
function createEgyptLayout(
  definitions: GrowthObject[],
  random: () => number,
): GrowthObject[] {
  const placed: GrowthObject[] = [];
  const template = definitions[0];
  const goal = definitions.find((d) => d.id === "goal")!;
  placed.push({
    ...goal,
    model: "egypt",
    egyptKind: "pyramid",
    area: 3,
    x: 170,
    z: -100,
    scale: 1,
  });
  placed.push({
    ...object(template, ["sarcophagus", "黄金の王棺", [2.4, 1.1, 1]], 6),
    id: "landmark",
    area: 1,
    x: 8,
    z: -4,
  });
  for (const [i, p] of [
    { x: -3, z: -5 },
    { x: -3, z: 5 },
    { x: 12, z: -5 },
    { x: 12, z: 5 },
  ].entries())
    placed.push({
      ...object(template, ["column", "墓の列柱", [1.7, 7, 1.7]], 7),
      id: `egypt-column-${i}`,
      area: 1,
      ...p,
    });
  for (const god of GODS)
    placed.push({
      ...object(template, [god.kind, god.label, god.size], god.level),
      id: `egypt-god-${god.kind}`,
      ...god.route[0],
      area: 3,
      behavior: "work",
      route: god.route,
      speedMultiplier: 0.45,
    });
  const place = (d: GrowthObject, bounds?: ToyRect) => {
    const area = d.area;
    const b =
      bounds ??
      (area === 3
        ? d.level <= 9
          ? { minX: 95, maxX: 300, minZ: -150, maxZ: 140 }
          : d.level === 10
            ? { minX: 350, maxX: 700, minZ: -150, maxZ: 560 }
            : { minX: 800, maxX: 1300, minZ: -800, maxZ: 500 }
        : area === 1 && d.level === 4 && !d.sourceLevel
          ? { minX: 2.3, maxX: 14, minZ: -7, maxZ: 7 }
          : EGYPT_SPACES[area].bounds);
    const r = foot(d),
      margin = r + EGYPT_SPACES[area].thickness + 0.02;
    for (let attempt = 0; attempt < 4000; attempt++) {
      const p = {
        x: b.minX + margin + random() * (b.maxX - b.minX - 2 * margin),
        z: b.minZ + margin + random() * (b.maxZ - b.minZ - 2 * margin),
      };
      if (!insideToyRect(p, b, margin)) continue;
      if (area === 0 && Math.hypot(p.x, p.z) < r + 0.13) continue;
      const starter =
        !d.sourceLevel && d.level === 1 && Number(d.id.split("-")[2]) < 8;
      if (
        area === 0 &&
        !starter &&
        nearRect(p, r + 0.02, {
          minX: -0.5,
          maxX: 0.5,
          minZ: -0.25,
          maxZ: 0.25,
        })
      )
        continue;
      if (area > 0 && nearRect(p, r + 0.06, EGYPT_SPACES[area - 1].bounds))
        continue;
      if (EGYPT_WALLS.some((w) => nearRect(p, r + 0.025, w))) continue;
      if (
        area === 0 &&
        STORY_ROUTES.some((route) => routeDistance(p, route) < r + 0.09)
      )
        continue;
      if (area === 1 && routeDistance(p, PRIEST_ROUTE) < r + 0.42) continue;
      if (
        area === 3 &&
        EGYPT_ROADS.some((road) =>
          nearRect(p, r + 0.5, {
            minX: road.x - road.width / 2,
            maxX: road.x + road.width / 2,
            minZ: road.z - road.depth / 2,
            maxZ: road.z + road.depth / 2,
          }),
        )
      )
        continue;
      if (
        area === 3 &&
        GODS.some(
          (god) =>
            routeDistance(p, god.route) <
            r + Math.hypot(god.size[0], god.size[2]) / 2 + 4,
        )
      )
        continue;
      if (
        placed.some(
          (other) =>
            Math.hypot(p.x - other.x, p.z - other.z) < r + foot(other) + 0.015,
        )
      )
        continue;
      let yaw = 0;
      if (area >= 1) yaw = (Math.round(random() * 3) * Math.PI) / 2;
      return { ...d, ...p, yaw };
    }
    throw new EgyptPlacementError(
      `${d.label}を${EGYPT_SPACES[area].label}に配置できません。`,
    );
  };
  // Reserve the supply chests and larger props before filling the mural with tiny objects.
  const sources = definitions
    .filter((d) => d.sourceLevel)
    .sort((a, b) => foot(b) - foot(a));
  for (const source of sources) {
    const level = source.sourceLevel!;
    placed.push(
      place({
        ...source,
        model: "egypt",
        egyptKind: "chest",
        label: "供物の補充箱",
        area: egyptAreaForLevel(level),
        route: undefined,
      }),
    );
  }
  const stock = definitions
    .filter((d) => d.id.startsWith("growth-"))
    .map((base) => {
      const number = Number(base.id.split("-")[2]);
      const recipe =
        STOCK[base.level - 1][number % STOCK[base.level - 1].length];
      return object(base, recipe);
    })
    .sort((a, b) => foot(b) - foot(a));
  for (const d of stock) {
    const number = Number(d.id.split("-")[2]);
    if ([2, 3].includes(d.level) && number < 4) {
      const route = STORY_ROUTES[d.level - 2];
      placed.push({
        ...d,
        ...route[number],
        behavior: "march",
        route,
        speedMultiplier: 1.3,
      });
    } else
      placed.push(
        place(
          d,
          d.level === 1 && number < 8
            ? { minX: -0.5, maxX: 0.5, minZ: -0.25, maxZ: 0.25 }
            : undefined,
        ),
      );
  }
  for (let column = 0; column < EGYPT_STREETS_X.length - 1; column++)
    for (let row = 0; row < EGYPT_STREETS_Z.length - 1; row++) {
      const recipes: [number, Recipe][] = [
        [11, ["house", "街区の大きな邸宅", [50, 30, 44]]],
        [11, ["temple", "街区の神殿", [54, 40, 50]]],
        [11, ["obelisk", "街区のオベリスク", [28, 90, 28]]],
        [10, STOCK[9][0]],
        [10, STOCK[9][2]],
        [10, STOCK[9][1]],
        [9, STOCK[8][0]],
        [9, STOCK[8][2]],
      ];
      const bounds = {
        minX: EGYPT_STREETS_X[column],
        maxX: EGYPT_STREETS_X[column + 1],
        minZ: EGYPT_STREETS_Z[row],
        maxZ: EGYPT_STREETS_Z[row + 1],
      };
      for (const [i, [level, recipe]] of recipes.entries())
        placed.push(
          place(
            {
              ...object(template, recipe, level),
              id: `egypt-city-${column}-${row}-${i}`,
            },
            bounds,
          ),
        );
    }
  for (let i = 0; i < 4; i++)
    placed.push({
      ...object(template, ["priest", "墓の神官", [0.55, 1.8, 0.4]], 6),
      id: `egypt-priest-${i}`,
      ...PRIEST_ROUTE[i],
      area: 1,
      behavior: "work",
      route: PRIEST_ROUTE,
    });
  for (const [loop, [west, east, north, south]] of [
    [320, 760, -320, 160],
    [-1200, -800, -760, -320],
    [760, 1300, 620, 1160],
  ].entries()) {
    const route = [
      { x: west, z: north },
      { x: east, z: north },
      { x: east, z: south },
      { x: west, z: south },
    ];
    for (let i = 0; i < 4; i++)
      placed.push({
        ...object(template, ["priest", "街を行く神官", [0.65, 1.8, 0.45]], 6),
        id: `egypt-procession-${loop}-${i}`,
        area: 3,
        ...route[i],
        behavior: "march",
        route,
        speedMultiplier: 2.5,
      });
  }
  for (const [loop, [west, east, north, south]] of [
    [320, 760, -320, 160],
    [-1200, -800, -760, -320],
    [760, 1300, 620, 1160],
  ].entries()) {
    const route = [
      { x: west + 5, z: north + 5 },
      { x: east + 5, z: north + 5 },
      { x: east + 5, z: south + 5 },
      { x: west + 5, z: south + 5 },
    ];
    for (let i = 0; i < 4; i++)
      placed.push({
        ...object(template, ["camel", "荷を運ぶラクダ", [1.8, 2.3, 1]], 6),
        id: `egypt-caravan-${loop}-${i}`,
        area: 3,
        ...route[i],
        behavior: "work",
        route,
        speedMultiplier: 2.5,
      });
  }
  return placed.sort((a, b) => a.area - b.area || a.level - b.level);
}

export function createEgyptStage(
  definitions: GrowthObject[],
  random: () => number,
): GrowthObject[] {
  let last: EgyptPlacementError | undefined;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return createEgyptLayout(definitions, random);
    } catch (error) {
      if (!(error instanceof EgyptPlacementError)) throw error;
      last = error;
    }
  }
  throw last!;
}
