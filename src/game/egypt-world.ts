import { toyWallParts, type ToySpace } from "./toy-world";

export const EGYPT_SPACES: readonly ToySpace[] = [
  {
    id: "mural",
    label: "壁画の物語",
    level: 1,
    extent: 2.3,
    bounds: { minX: -1.7, maxX: 1.7, minZ: -1.3, maxZ: 1.3 },
    height: 0.12,
    thickness: 0.045,
    color: "#b8894c",
    floor: "#e6c78e",
    gate: { side: "east", along: 0, width: 1.05, level: 4 },
  },
  {
    id: "tomb",
    label: "王家の墓",
    level: 4,
    extent: 30,
    bounds: { minX: -8, maxX: 23, minZ: -13, maxZ: 13 },
    height: 8,
    thickness: 0.45,
    color: "#c0a06b",
    floor: "#d6bd8b",
    gate: { side: "east", along: 0, width: 8, level: 7 },
  },
  {
    id: "temple",
    label: "神殿",
    level: 7,
    extent: 80,
    bounds: { minX: -18, maxX: 70, minZ: -28, maxZ: 58 },
    height: 18,
    thickness: 1.5,
    color: "#c8ac76",
    floor: "#e4ce9e",
    gate: { side: "east", along: 20, width: 30, level: 9 },
  },
  {
    id: "city",
    label: "神殿の街とピラミッド",
    level: 9,
    extent: 1600,
    bounds: { minX: -1600, maxX: 1600, minZ: -1600, maxZ: 1600 },
    height: 0,
    thickness: 0,
    color: "#cdae75",
    floor: "#e1c38b",
  },
];
export function egyptAreaForLevel(level: number) {
  return level < 4 ? 0 : level < 7 ? 1 : level < 9 ? 2 : 3;
}
export const EGYPT_WALLS = toyWallParts(EGYPT_SPACES, false);
export const EGYPT_STREETS_X = [-1200, -800, -400, 320, 760, 1300];
export const EGYPT_STREETS_Z = [-1200, -760, -320, 160, 620, 1160];
export const EGYPT_ROADS = [
  ...EGYPT_STREETS_X.map((x) => ({ x, z: 0, width: 18, depth: 2800 })),
  ...EGYPT_STREETS_Z.map((z) => ({ x: 0, z, width: 2800, depth: 18 })),
  { x: 195, z: 20, width: 250, depth: 18 },
];
