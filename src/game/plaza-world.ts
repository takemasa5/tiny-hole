import { toyWallParts, type ToySpace } from "./toy-world";

export const PLAZA_SPACES: readonly ToySpace[] = [
  {
    id: "flowerbed",
    label: "花壇の足元",
    level: 1,
    extent: 2.3,
    bounds: { minX: -1.7, maxX: 1.7, minZ: -1.3, maxZ: 1.3 },
    height: 0.16,
    thickness: 0.045,
    color: "#b97e61",
    floor: "#af9570",
    gate: { side: "east", along: 0, width: 1.05, level: 4 },
  },
  {
    id: "playground",
    label: "公園の遊び場",
    level: 4,
    extent: 30,
    bounds: { minX: -7, maxX: 21, minZ: -12, maxZ: 12 },
    height: 2.4,
    thickness: 0.12,
    color: "#66917a",
    floor: "#dbc69c",
    gate: { side: "east", along: 0, width: 7, level: 7 },
  },
  {
    id: "park",
    label: "公園全体",
    level: 7,
    extent: 150,
    bounds: { minX: -20, maxX: 120, minZ: -70, maxZ: 70 },
    height: 7,
    thickness: 0.65,
    color: "#64876d",
    floor: "#9fb581",
    gate: { side: "east", along: 0, width: 30, level: 9 },
  },
  {
    id: "shopping",
    label: "公園前の商店街",
    level: 9,
    extent: 450,
    bounds: { minX: -60, maxX: 420, minZ: -240, maxZ: 240 },
    height: 22,
    thickness: 2,
    color: "#b8ab90",
    floor: "#c9b9a0",
    gate: { side: "east", along: 0, width: 120, level: 11 },
  },
  {
    id: "memorial",
    label: "記念広場と街",
    level: 11,
    extent: 1600,
    bounds: { minX: -1600, maxX: 1600, minZ: -1600, maxZ: 1600 },
    height: 0,
    thickness: 0,
    color: "#acbaa0",
    floor: "#a8ba91",
  },
];
export const PLAZA_WALLS = toyWallParts(PLAZA_SPACES, false);
export function plazaAreaForLevel(level: number) {
  return level < 4 ? 0 : level < 7 ? 1 : level < 9 ? 2 : level < 11 ? 3 : 4;
}
export const PLAZA_CITY_STREETS = [-1440, -960, -480, 0, 480, 960, 1440];
export const PLAZA_ROUTES = [
  {
    area: 1,
    kind: "person",
    size: [0.55, 1.8, 0.45],
    points: [
      [-3.7, -3.3],
      [3.7, -3.3],
      [3.7, 3.3],
      [-3.7, 3.3],
    ],
  },
  {
    area: 2,
    kind: "person",
    size: [0.55, 1.8, 0.45],
    points: [
      [-16, -21],
      [30, -21],
      [30, 21],
      [-16, 21],
    ],
  },
  {
    area: 2,
    kind: "van",
    size: [2.8, 2.3, 1.4],
    points: [
      [55, -40],
      [105, -40],
      [105, 40],
      [55, 40],
    ],
  },
  {
    area: 3,
    kind: "person",
    size: [0.55, 1.8, 0.45],
    points: [
      [145, -165],
      [385, -165],
      [385, 165],
      [145, 165],
    ],
  },
  {
    area: 3,
    kind: "van",
    size: [4.8, 3.2, 2.1],
    points: [
      [160, -120],
      [370, -120],
      [370, 120],
      [160, 120],
    ],
  },
  {
    area: 4,
    kind: "van",
    size: [4.8, 3.2, 2.1],
    points: [
      [-960, -960],
      [960, -960],
      [960, 960],
      [-960, 960],
    ],
  },
] as const;
