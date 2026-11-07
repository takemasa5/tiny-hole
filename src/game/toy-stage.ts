import { OBJECT_TYPES, type ObjectKind } from "./stage";
import type { GrowthObject } from "./growth-stage";
import {
  TOY_SPACES,
  TOY_CITY_ROADS,
  TOY_CITY_COLUMNS,
  TOY_CITY_ROWS,
  toyAreaForLevel,
  insideToyRect,
  toyWallParts,
  type ToyRect,
} from "./toy-world";
import type { FurnitureKind } from "./furniture-visuals";

export type ToyKind =
  | FurnitureKind
  | "button"
  | "puzzle"
  | "brick"
  | "dice"
  | "miniCar"
  | "windupRobot"
  | "teddy"
  | "rockingHorse"
  | "doll"
  | "garage"
  | "station"
  | "bus"
  | "truck"
  | "clockTower"
  | "apartment"
  | "factory"
  | "radioTower"
  | "powerPlant"
  | "hangar"
  | "cityHall"
  | "filmCamera";

interface ToyRecipe {
  label: string;
  kind: ObjectKind;
  toyKind?: ToyKind;
  size?: [number, number, number];
}
const toy = (
  toyKind: ToyKind,
  label: string,
  size: [number, number, number],
): ToyRecipe => ({ toyKind, label, size, kind: "toyBlock" });
const original = (
  kind: ObjectKind,
  label: string = OBJECT_TYPES[kind].label,
): ToyRecipe => ({ kind, label });

const SHELVES: readonly ToyRecipe[][] = [
  [
    toy("button", "ボタン", [0.55, 0.15, 0.55]),
    toy("puzzle", "パズルのピース", [0.75, 0.12, 0.65]),
    original("toyBall", "ビー玉"),
  ],
  [
    toy("brick", "小さなブロック", [0.85, 0.4, 0.5]),
    toy("dice", "サイコロ", [0.5, 0.5, 0.5]),
    toy("miniCar", "ミニカー", [1.05, 0.45, 0.55]),
  ],
  [
    toy("windupRobot", "ぜんまいロボット", [0.65, 1, 0.55]),
    original("toyTrain", "手のひらの汽車"),
    original("toyBall", "ゴムボール"),
  ],
  [
    toy("teddy", "くまのぬいぐるみ", [0.8, 1.05, 0.65]),
    toy("rockingHorse", "木馬", [1.1, 0.85, 0.5]),
    original("toySoldier"),
  ],
  [
    toy("doll", "着せ替え人形", [0.65, 1.1, 0.5]),
    toy("bookStack", "絵本", [0.9, 0.35, 0.7]),
    toy("miniCar", "床に置いた車", [1, 0.4, 0.5]),
  ],
  [
    toy("teddy", "大きなぬいぐるみ", [0.8, 1.1, 0.6]),
    toy("brick", "積み木", [0.8, 0.6, 0.8]),
    original("toyTower", "積み木の塔"),
    original("toyHouse", "おもちゃの家"),
    original("toyBall", "大きなボール"),
  ],
  [
    toy("chair", "椅子", [0.9, 1.3, 0.9]),
    toy("cushion", "クッション", [1, 0.5, 1]),
    toy("mug", "マグカップ", [0.6, 0.8, 0.6]),
  ],
  [
    toy("bookStack", "本の束", [0.7, 0.3, 0.5]),
    toy("floorLamp", "フロアライト", [0.5, 1.7, 0.5]),
    toy("table", "小さなテーブル", [1.3, 0.7, 1]),
    toy("chair", "リビングの椅子", [0.7, 1, 0.7]),
    toy("shoeRack", "靴箱", [1, 1.5, 0.7]),
    toy("cushion", "大きなクッション", [0.8, 0.4, 0.8]),
    toy("bookStack", "本の束", [0.7, 0.3, 0.5]),
    toy("floorLamp", "フロアライト", [0.5, 1.7, 0.5]),
    toy("bookStack", "本の束", [0.7, 0.3, 0.5]),
    toy("chair", "リビングの椅子", [0.7, 1, 0.7]),
    toy("cushion", "大きなクッション", [0.8, 0.4, 0.8]),
    toy("bookStack", "本の束", [0.7, 0.3, 0.5]),
  ],
  [
    toy("bin", "街のごみ箱", [0.6, 0.8, 0.6]),
    toy("streetLamp", "街灯", [0.4, 2.5, 0.4]),
    toy("vendingMachine", "自動販売機", [0.7, 1.5, 0.6]),
  ],
  [
    original("car", "乗用車"),
    toy("garage", "ガレージ", [1.1, 0.9, 1]),
    toy("bus", "路線バス", [1.3, 0.6, 0.6]),
  ],
  [
    toy("apartment", "街の高層ビル", [1, 3.5, 1]),
    toy("home", "街の住宅", [1.2, 0.9, 1.2]),
    toy("cityHall", "市庁舎", [1.1, 1.4, 1]),
    toy("radioTower", "電波塔", [0.75, 4, 0.75]),
  ],
];
const ROAD = [
  { x: 15, z: 8 },
  { x: 29, z: 8 },
  { x: 29, z: 16 },
  { x: 15, z: 16 },
];
const RAIL = [
  { x: 3, z: 19 },
  { x: 21, z: 19 },
  { x: 21, z: 29 },
  { x: 3, z: 29 },
];
const CITY_ROAD = [
  { x: 160, z: 10 },
  { x: 310, z: 10 },
  { x: 310, z: 180 },
  { x: 160, z: 180 },
];
const CITY_BLOCK_STOCK = [
  { level: 11, recipe: toy("home", "街の住宅", [1.2, 0.9, 1.2]) },
  { level: 11, recipe: toy("apartment", "街の高層ビル", [1, 3.5, 1]) },
  { level: 11, recipe: toy("cityHall", "街の公共施設", [1.1, 1.4, 1]) },
  { level: 11, recipe: toy("radioTower", "街の電波塔", [0.75, 4, 0.75]) },
  { level: 10, recipe: toy("garage", "街のガレージ", [1.1, 0.9, 1]) },
  { level: 10, recipe: toy("home", "街の小さな住宅", [1.2, 0.9, 1.2]) },
  { level: 9, recipe: toy("streetLamp", "街灯", [0.4, 2.5, 0.4]) },
  { level: 9, recipe: toy("streetLamp", "街灯", [0.4, 2.5, 0.4]) },
  { level: 9, recipe: toy("bin", "街のごみ箱", [0.6, 0.8, 0.6]) },
  { level: 9, recipe: toy("vendingMachine", "自動販売機", [0.7, 1.5, 0.6]) },
];
const CITY_TRAFFIC_ROUTES = [
  [-1200, -400, -800, -400],
  [-1200, -400, 440, 840],
  [720, 1300, -800, -400],
  [720, 1300, 840, 1240],
  [320, 720, 440, 840],
].map(([west, east, north, south]) => [
  { x: west, z: north },
  { x: east, z: north },
  { x: east, z: south },
  { x: west, z: south },
]);

export const TOY_FURNITURE = [
  {
    id: "track-station",
    kind: "station",
    label: "線路の駅",
    size: [2.1, 1.4, 1.4],
    x: 24,
    z: 29,
    level: 6,
  },
  {
    id: "bed",
    kind: "bed",
    label: "青いベッド",
    size: [8, 3.5, 10],
    x: 2,
    z: 12,
    level: 9,
  },
  {
    id: "desk",
    kind: "desk",
    label: "黄色い机",
    size: [11, 7, 5],
    x: 20,
    z: 0,
    level: 9,
  },
  {
    id: "desk-chair",
    kind: "chair",
    label: "机の椅子",
    size: [4, 6, 4],
    x: 22,
    z: 5,
    level: 7,
  },
  {
    id: "wardrobe",
    kind: "wardrobe",
    label: "子供部屋の棚",
    size: [5, 11, 4],
    x: 28,
    z: 3,
    level: 8,
  },
  {
    id: "kitchen-counter",
    kind: "counter",
    label: "キッチンのカウンター",
    size: [25, 8, 8],
    x: 60,
    z: -15,
    level: 10,
  },
  {
    id: "kitchen-fridge",
    kind: "fridge",
    label: "キッチンの冷蔵庫",
    size: [8, 16, 7],
    x: 85,
    z: -12,
    level: 8,
  },
  {
    id: "dining-table",
    kind: "table",
    label: "ダイニングテーブル",
    size: [13, 8, 10],
    x: 65,
    z: 12,
    level: 9,
  },
  {
    id: "living-sofa",
    kind: "sofa",
    label: "リビングのソファ",
    size: [25, 10, 10],
    x: 60,
    z: 60,
    level: 10,
  },
  {
    id: "coffee-table",
    kind: "table",
    label: "リビングのテーブル",
    size: [10, 5, 8],
    x: 64,
    z: 77,
    level: 9,
  },
  {
    id: "entry-shoes",
    kind: "shoeRack",
    label: "玄関の靴箱",
    size: [10, 12, 5],
    x: 86,
    z: 98,
    level: 8,
  },
] as const;
function recipeObject(d: GrowthObject, recipe: ToyRecipe, radius: number) {
  const scale =
    (radius * 1.25) /
    Math.hypot(
      OBJECT_TYPES[recipe.kind].size[0],
      OBJECT_TYPES[recipe.kind].size[2],
    );
  return {
    ...d,
    kind: recipe.kind,
    model: recipe.toyKind ? ("toy" as const) : ("original" as const),
    toyKind: recipe.toyKind,
    label: recipe.label,
    scale,
    size: (recipe.size
      ? recipe.size.map((n) => n * radius)
      : OBJECT_TYPES[recipe.kind].size.map((n) => n * scale)) as [
      number,
      number,
      number,
    ],
  };
}
function overlaps(
  point: { x: number; z: number },
  footprint: number,
  rect: ToyRect,
) {
  return insideToyRect(point, rect, -footprint);
}
class ToyPlacementError extends Error {}

function createToyLayout(
  definitions: GrowthObject[],
  radii: readonly number[],
  random: () => number,
): GrowthObject[] {
  const placed: GrowthObject[] = [];
  const walls = toyWallParts();
  let booksOnCounter = 0;
  const furniture = TOY_FURNITURE.map((item) => ({
    id: `room-${item.id}`,
    kind: "toyBlock" as const,
    model: "toy" as const,
    toyKind: item.kind,
    label: item.label,
    size: [...item.size] as [number, number, number],
    scale: 1,
    level: item.level,
    area: item.x < 32 ? 2 : 3,
    value: 4 ** (item.level - 1),
    x: item.x,
    z: item.z,
    yaw: item.id === "entry-shoes" ? Math.PI : 0,
    behavior: "still" as const,
  }));
  const forbiddenFurniture = furniture.map((d) => ({
    minX: d.x - d.size[0] / 2,
    maxX: d.x + d.size[0] / 2,
    minZ: d.z - d.size[2] / 2,
    maxZ: d.z + d.size[2] / 2,
  }));
  const place = (d: GrowthObject, sourceArea = d.area, bounds?: ToyRect) => {
    let b =
      bounds ??
      (sourceArea === 4
        ? d.level <= 9
          ? { minX: 135, maxX: 295, minZ: 30, maxZ: 155 }
          : d.level === 10
            ? { minX: 340, maxX: 700, minZ: -130, maxZ: 200 }
            : { minX: 740, maxX: 1250, minZ: -450, maxZ: 200 }
        : TOY_SPACES[sourceArea].bounds);
    if (sourceArea === 3 && !d.sourceLevel) {
      b =
        ["mug", "chair"].includes(d.toyKind ?? "") && d.level === 7
          ? { minX: 40, maxX: 92, minZ: -22, maxZ: 32 }
          : d.toyKind === "shoeRack"
            ? { minX: 45, maxX: 92, minZ: 89, maxZ: 104 }
            : { minX: 40, maxX: 92, minZ: 40, maxZ: 83 };
    }
    const foot = Math.hypot(d.size[0], d.size[2]) / 2;
    const margin = foot + TOY_SPACES[sourceArea].thickness + 0.03;
    for (let attempt = 0; attempt < 3000; attempt++) {
      const point = {
        x: b.minX + margin + random() * (b.maxX - b.minX - margin * 2),
        z: b.minZ + margin + random() * (b.maxZ - b.minZ - margin * 2),
      };
      if (sourceArea === 0 && Math.hypot(point.x, point.z) < foot + 0.13)
        continue;
      if (
        sourceArea > 0 &&
        overlaps(point, foot + 0.05, TOY_SPACES[sourceArea - 1].bounds)
      )
        continue;
      if (forbiddenFurniture.some((rect) => overlaps(point, foot + 0.05, rect)))
        continue;
      if (walls.some((rect) => overlaps(point, foot + 0.03, rect))) continue;
      if (
        sourceArea === 4 &&
        TOY_CITY_ROADS.some((road) =>
          overlaps(point, foot + 0.5, {
            minX: road.x - road.width / 2,
            maxX: road.x + road.width / 2,
            minZ: road.z - road.depth / 2,
            maxZ: road.z + road.depth / 2,
          }),
        )
      )
        continue;

      const touching = placed.filter(
        (other) =>
          Math.hypot(point.x - other.x, point.z - other.z) <
          foot + Math.hypot(other.size[0], other.size[2]) / 2 + 0.015,
      );
      if (touching.length && (sourceArea >= 2 || d.sourceLevel)) continue;
      const stackY = Math.max(
        0,
        ...touching.map((other) => (other.stackY ?? 0) + other.size[1] + 0.002),
      );
      if (
        stackY + d.size[1] > TOY_SPACES[sourceArea].height * 0.9 &&
        sourceArea < 2
      )
        continue;
      const routes =
        sourceArea === 2
          ? [ROAD, RAIL]
          : sourceArea === 4
            ? [CITY_ROAD, ...CITY_TRAFFIC_ROUTES]
            : [];
      if (
        routes.some((route) =>
          route.some((a, i) => {
            const c = route[(i + 1) % route.length];
            const x = Math.max(
              Math.min(a.x, c.x),
              Math.min(Math.max(a.x, c.x), point.x),
            );
            const z = Math.max(
              Math.min(a.z, c.z),
              Math.min(Math.max(a.z, c.z), point.z),
            );
            return (
              Math.hypot(point.x - x, point.z - z) <
              foot + (sourceArea === 4 ? 18 : 1.9)
            );
          }),
        )
      )
        continue;
      let yaw = d.yaw;
      if (sourceArea === 3 && d.toyKind === "chair") {
        const target = d.level === 7 ? { x: 65, z: 12 } : { x: 64, z: 77 };
        yaw = Math.atan2(target.x - point.x, target.z - point.z);
      } else if (sourceArea === 3 && d.toyKind === "shoeRack") yaw = Math.PI;
      else if (sourceArea === 4) {
        const road = [...TOY_CITY_ROADS].sort(
          (a, b) =>
            Math.hypot(
              Math.max(0, Math.abs(a.x - point.x) - a.width / 2),
              Math.max(0, Math.abs(a.z - point.z) - a.depth / 2),
            ) -
            Math.hypot(
              Math.max(0, Math.abs(b.x - point.x) - b.width / 2),
              Math.max(0, Math.abs(b.z - point.z) - b.depth / 2),
            ),
        )[0];
        yaw =
          road.width > road.depth
            ? road.z > point.z
              ? 0
              : Math.PI
            : road.x > point.x
              ? Math.PI / 2
              : -Math.PI / 2;
      }
      return { ...d, ...point, stackY, yaw };
    }
    throw new ToyPlacementError(
      `${d.label}を${TOY_SPACES[sourceArea].label}に配置できません。`,
    );
  };
  const priority = (d: GrowthObject) => {
    if (!d.id.startsWith("growth-")) return -10000;
    if (d.level < 5) return d.level;
    const number = Number(d.id.split("-")[2]);
    const shelf = SHELVES[d.level - 1];
    const sized = recipeObject(
      d,
      shelf[number % shelf.length],
      radii[d.level - 1],
    );
    return -1000 - Math.hypot(sized.size[0], sized.size[2]);
  };
  // Reserve large furnishings first, then scatter small props into the remaining space.
  for (const template of [
    ...definitions.filter((d) => d.sourceLevel),
    ...definitions
      .filter((d) => !d.sourceLevel)
      .sort((a, b) => priority(a) - priority(b)),
  ]) {
    if (template.id === "landmark") continue;
    if (template.id === "goal") {
      placed.push({
        ...template,
        model: "colossalRobot",
        size: [196, 700, 196],
        scale: 1,
        area: 4,
        x: 1100,
        z: 420,
      });
      continue;
    }
    if (template.id === "hero" || template.id === "monster") {
      const hero = template.id === "hero";
      placed.push({
        ...template,
        size: hero ? [48, 180, 42] : [56, 220, 48],
        area: 4,
        x: hero ? 470 : 590,
        z: hero ? -320 : -390,
        level: 11,
        yaw: hero ? Math.PI * 0.65 : -Math.PI * 0.35,
      });
      continue;
    }
    const sourceArea = toyAreaForLevel(template.sourceLevel ?? template.level);
    if (template.sourceLevel) {
      const d = place(
        {
          ...template,
          label:
            sourceArea < 2
              ? "予備の小物箱"
              : sourceArea < 4
                ? "収納かご"
                : "配送の荷物",
          area: sourceArea,
          route: undefined,
        },
        sourceArea,
      );
      placed.push(d);
      continue;
    }
    const number = Number(template.id.split("-")[2]);
    const radius = radii[template.level - 1];
    const shelf = SHELVES[template.level - 1];
    const recipe = shelf[number % shelf.length];
    let d: GrowthObject = {
      ...recipeObject(template, recipe, radius),
      area: sourceArea,
      behavior: "still",
      route: undefined,
      stationStop: undefined,
      yaw: random() * Math.PI * 2,
    };
    const moving = number < 4 && [5, 6, 9].includes(template.level);
    if (moving) {
      const train = template.level === 6;
      const route = train ? RAIL : template.level === 5 ? ROAD : CITY_ROAD;
      d = train
        ? recipeObject(d, original("toyTrain", "床の線路を走る機関車"), 1.2)
        : sourceArea === 4
          ? recipeObject(d, original("car", "街を走る車"), 20)
          : {
              ...d,
              model: "toy",
              toyKind: "miniCar",
              label: "床の道路を走る車",
              size: [1.6, 0.75, 0.85],
            };
      d = {
        ...d,
        route,
        ...route[number],
        yaw: 0,
        behavior: train ? "train" : "route",
        speedMultiplier: sourceArea === 2 ? 6 : 2.5,
        stationStop: train ? 2 : undefined,
      };
      placed.push(d);
      continue;
    }
    if (d.area === 3 && d.toyKind === "bookStack") {
      const index = booksOnCounter++;
      placed.push({
        ...d,
        x: 52 + (index % 4) * 6,
        z: -15,
        stackY: 8 + Math.floor(index / 4) * (d.size[1] + 0.002),
        yaw: (random() - 0.5) * 0.12,
      });
    } else placed.push(place(d));
  }
  // Keep the original entry stock, then populate every surrounding street block.
  const cityTemplate = definitions.find((d) => d.id === "growth-9-0")!;
  for (let column = 0; column < TOY_CITY_COLUMNS.length - 1; column++)
    for (let row = 0; row < TOY_CITY_ROWS.length - 1; row++) {
      const bounds = {
        minX: TOY_CITY_COLUMNS[column],
        maxX: TOY_CITY_COLUMNS[column + 1],
        minZ: TOY_CITY_ROWS[row],
        maxZ: TOY_CITY_ROWS[row + 1],
      };
      for (const [index, stock] of CITY_BLOCK_STOCK.entries()) {
        const object = recipeObject(
          {
            ...cityTemplate,
            id: `city-block-${column}-${row}-${index}`,
            level: stock.level,
            area: 4,
            value: 4 ** (stock.level - 1),
            behavior: "still",
            route: undefined,
          },
          stock.recipe,
          radii[stock.level - 1],
        );
        placed.push(place(object, 4, bounds));
      }
    }
  for (const [loop, route] of CITY_TRAFFIC_ROUTES.entries())
    for (const [index, point] of route.entries()) {
      const bus = index % 2 === 1;
      const object = recipeObject(
        {
          ...cityTemplate,
          id: `city-traffic-${loop}-${index}`,
          level: 10,
          area: 4,
          value: 4 ** 9,
          behavior: "route",
          route,
          ...point,
          yaw: 0,
          speedMultiplier: 2.5,
        },
        bus
          ? toy("bus", "街を巡る路線バス", [1.3, 0.6, 0.6])
          : original("car", "街を走る車"),
        bus ? 24 : 20,
      );
      placed.push(object);
    }
  return [...placed, ...furniture];
}

export function createToyStage(
  definitions: GrowthObject[],
  radii: readonly number[],
  random: () => number,
): GrowthObject[] {
  let lastError: ToyPlacementError | undefined;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return createToyLayout(definitions, radii, random);
    } catch (error) {
      if (!(error instanceof ToyPlacementError)) throw error;
      lastError = error;
    }
  }
  throw lastError!;
}
