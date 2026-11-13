import type { StageId } from "./stage";
import type { DistrictKind } from "./district-catalog";
import { toyWallParts, type ToySpace, type ToyRect } from "./toy-world";
export type DistrictStageId = "america" | "harbor" | "office";
export interface DistrictRoute {
  area: number;
  kind: DistrictKind;
  size: [number, number, number];
  count: number;
  points: [number, number][];
  driving?: boolean;
  queue?: boolean;
}
export interface DistrictLandmark {
  kind: DistrictKind;
  size: [number, number, number];
  area: number;
  x: number;
  z: number;
  level: number;
}
export interface DistrictProfile {
  stageId: DistrictStageId;
  ids: string[];
  labels: string[];
  floors: string[];
  walls: string[];
  heights: number[];
  gateLabels: string[];
  stock: DistrictKind[][];
  landmarks: DistrictLandmark[];
  routes: DistrictRoute[];
  extras: DistrictKind[][];
  skyline: DistrictKind[];
  water: ToyRect[];
  goal: { kind: DistrictKind; size: [number, number, number] };
}
const america: DistrictProfile = {
  stageId: "america",
  ids: ["takeout", "diner", "parking", "suburbs", "waterfront"],
  labels: [
    "持ち帰り用の紙箱",
    "ダイナー店内",
    "ダイナーの駐車場",
    "郊外の商業地区",
    "湾岸都市と自由の女神",
  ],
  floors: ["#d8b988", "#e5d6bd", "#929a96", "#b2bb9f", "#a7bb9a"],
  walls: ["#bb865a", "#c4907c", "#a3b2a1", "#a9ac9a", "#8daba4"],
  heights: [0.18, 8, 5, 18, 0],
  gateLabels: [
    "紙箱の側面",
    "ダイナーのドア",
    "駐車場のゲート",
    "湾岸都市の門",
  ],
  stock: [
    ["crumb", "fries", "wrapper"],
    ["cap", "fries", "wrapper"],
    ["burger", "hotdog", "mug"],
    ["mug", "ketchup", "stool"],
    ["booth", "dinerTable", "fridge"],
    ["counter", "griddle", "booth"],
    ["car", "tire", "trafficCone"],
    ["car", "deliveryVan", "diner"],
    ["diner", "shop", "construction"],
    ["shop", "apartment", "palm"],
    ["skyscraper", "apartment", "construction"],
  ],
  landmarks: [
    {
      kind: "burger",
      size: [0.6, 0.45, 0.6],
      area: 0,
      x: -1.1,
      z: 0.7,
      level: 3,
    },
    {
      kind: "mug",
      size: [0.55, 0.65, 0.55],
      area: 0,
      x: -1.1,
      z: -0.7,
      level: 3,
    },
    { kind: "booth", size: [3.8, 2.4, 1.7], area: 1, x: 11, z: -7, level: 6 },
    { kind: "counter", size: [5, 3, 2.3], area: 1, x: 12, z: 7, level: 6 },
    { kind: "diner", size: [15, 10, 13], area: 2, x: 77, z: 0, level: 8 },
    { kind: "lamp", size: [3, 16, 3], area: 2, x: 75, z: -53, level: 8 },
    { kind: "shop", size: [28, 38, 24], area: 3, x: 250, z: -80, level: 10 },
    {
      kind: "construction",
      size: [32, 50, 30],
      area: 3,
      x: 310,
      z: 80,
      level: 10,
    },
    { kind: "boat", size: [35, 15, 14], area: 4, x: 850, z: 0, level: 11 },
  ],
  routes: [
    {
      area: 1,
      kind: "customer",
      size: [0.55, 1.8, 0.45],
      count: 6,
      points: [
        [-3.7, -3.3],
        [3.7, -3.3],
      ],
    },
    {
      area: 2,
      kind: "car",
      size: [4.5, 1.7, 2],
      count: 6,
      points: [
        [55, -40],
        [105, -40],
        [105, 40],
        [55, 40],
      ],
      driving: true,
      queue: true,
    },
    {
      area: 2,
      kind: "customer",
      size: [0.55, 1.8, 0.45],
      count: 8,
      points: [
        [-16, -21],
        [30, -21],
      ],
    },
    {
      area: 3,
      kind: "deliveryVan",
      size: [5, 3, 2.2],
      count: 4,
      points: [
        [160, -120],
        [370, -120],
        [370, 120],
        [160, 120],
      ],
      driving: true,
    },
    {
      area: 3,
      kind: "customer",
      size: [0.55, 1.8, 0.45],
      count: 10,
      points: [
        [145, -165],
        [385, -165],
      ],
    },
    {
      area: 4,
      kind: "car",
      size: [4.5, 1.7, 2],
      count: 12,
      points: [
        [-960, -960],
        [960, -960],
        [960, 960],
        [-960, 960],
      ],
      driving: true,
    },
  ],
  extras: [
    ["stool", "mug", "booth", "dinerTable"],
    ["car", "tire", "trafficCone", "lamp"],
    ["shop", "diner", "construction", "palm"],
  ],
  skyline: [
    "apartment",
    "skyscraper",
    "shop",
    "apartment",
    "palm",
    "palm",
    "lamp",
    "construction",
  ],
  water: [{ minX: 760, maxX: 940, minZ: -180, maxZ: 180 }],
  goal: { kind: "liberty", size: [180, 500, 160] },
};
export const DISTRICT_PROFILES: Partial<
  Record<DistrictStageId, DistrictProfile>
> = { america };
export function districtProfile(stageId: StageId): DistrictProfile | undefined {
  return DISTRICT_PROFILES[stageId as DistrictStageId];
}
export function districtAreaForLevel(level: number) {
  return level < 4 ? 0 : level < 7 ? 1 : level < 9 ? 2 : level < 11 ? 3 : 4;
}
export function districtSpaces(profile: DistrictProfile): readonly ToySpace[] {
  const bounds: ToyRect[] = [
    { minX: -1.7, maxX: 1.7, minZ: -1.3, maxZ: 1.3 },
    { minX: -7, maxX: 21, minZ: -12, maxZ: 12 },
    { minX: -20, maxX: 120, minZ: -70, maxZ: 70 },
    { minX: -60, maxX: 420, minZ: -240, maxZ: 240 },
    { minX: -1600, maxX: 1600, minZ: -1600, maxZ: 1600 },
  ];
  return bounds.map((b, i) => ({
    id: profile.ids[i],
    label: profile.labels[i],
    level: [1, 4, 7, 9, 11][i],
    extent: [2.3, 30, 150, 450, 1600][i],
    bounds: b,
    height: profile.heights[i],
    thickness: [0.045, 0.12, 0.65, 2, 0][i],
    color: profile.walls[i],
    floor: profile.floors[i],
    gate:
      i < 4
        ? {
            side: "east" as const,
            along: 0,
            width: [1.05, 7, 30, 120][i],
            level: [4, 7, 9, 11][i],
          }
        : undefined,
  }));
}
export function districtWalls(profile: DistrictProfile) {
  return toyWallParts(districtSpaces(profile), false);
}
export const DISTRICT_STREETS = [-1440, -960, -480, 0, 480, 960, 1440];
