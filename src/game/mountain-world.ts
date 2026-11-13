import { toyWallParts, type ToySpace } from "./toy-world";
export const MOUNTAIN_SPACES: readonly ToySpace[] = [
  {
    id: "roots",
    label: "木の根元の草むら",
    level: 1,
    extent: 2.3,
    bounds: { minX: -1.7, maxX: 1.7, minZ: -1.3, maxZ: 1.3 },
    height: 0.18,
    thickness: 0.045,
    color: "#826648",
    floor: "#a28c66",
    gate: { side: "east", along: 0, width: 1.05, level: 4 },
  },
  {
    id: "camp",
    label: "森のキャンプ場",
    level: 4,
    extent: 30,
    bounds: { minX: -7, maxX: 21, minZ: -12, maxZ: 12 },
    height: 2.4,
    thickness: 0.12,
    color: "#997752",
    floor: "#acac7d",
    gate: { side: "east", along: 0, width: 7, level: 7 },
  },
  {
    id: "lumberyard",
    label: "山里と林業ヤード",
    level: 7,
    extent: 150,
    bounds: { minX: -20, maxX: 120, minZ: -70, maxZ: 70 },
    height: 7,
    thickness: 0.65,
    color: "#92734b",
    floor: "#a9ae7e",
    gate: { side: "east", along: 0, width: 30, level: 9 },
  },
  {
    id: "deepForest",
    label: "深い森",
    level: 9,
    extent: 450,
    bounds: { minX: -60, maxX: 420, minZ: -240, maxZ: 240 },
    height: 22,
    thickness: 2,
    color: "#6d8052",
    floor: "#819b6c",
    gate: { side: "east", along: 0, width: 120, level: 11 },
  },
  {
    id: "sanctuary",
    label: "巨木の聖域",
    level: 11,
    extent: 1600,
    bounds: { minX: -1600, maxX: 1600, minZ: -1600, maxZ: 1600 },
    height: 0,
    thickness: 0,
    color: "#708961",
    floor: "#93aa78",
  },
];
export const MOUNTAIN_WALLS = toyWallParts(MOUNTAIN_SPACES, false);
export function mountainAreaForLevel(level: number) {
  return level < 4 ? 0 : level < 7 ? 1 : level < 9 ? 2 : level < 11 ? 3 : 4;
}
export const MOUNTAIN_ROUTES = [
  {
    area: 1,
    kind: "tanuki",
    size: [0.5, 0.65, 0.8],
    count: 4,
    points: [
      [-3.7, -3.3],
      [3.7, -3.3],
    ],
  },
  {
    area: 2,
    kind: "deer",
    size: [0.8, 1.9, 1.5],
    count: 6,
    points: [
      [-16, -21],
      [30, -21],
    ],
  },
  {
    area: 2,
    kind: "truck",
    size: [6, 3.2, 2.4],
    count: 4,
    points: [
      [55, -40],
      [105, -40],
      [105, 40],
      [55, 40],
    ],
  },
  {
    area: 3,
    kind: "fox",
    size: [0.45, 0.75, 1.2],
    count: 6,
    points: [
      [145, -165],
      [385, -165],
    ],
  },
  {
    area: 3,
    kind: "truck",
    size: [7, 3.5, 2.6],
    count: 4,
    points: [
      [160, -120],
      [370, -120],
      [370, 120],
      [160, 120],
    ],
  },
  {
    area: 4,
    kind: "deer",
    size: [0.8, 1.9, 1.5],
    count: 8,
    points: [
      [850, -250],
      [1350, -250],
    ],
  },
  {
    area: 4,
    kind: "truck",
    size: [7, 3.5, 2.6],
    count: 8,
    points: [
      [-960, -960],
      [960, -960],
      [960, 960],
      [-960, 960],
    ],
  },
] as const;
