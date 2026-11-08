import { toyWallParts, type ToySpace } from "./toy-world";

export const HELL_SPACES: readonly ToySpace[] = [
  {
    id: "riverbank",
    label: "賽の河原",
    level: 1,
    extent: 2.3,
    bounds: { minX: -1.7, maxX: 1.7, minZ: -1.3, maxZ: 1.3 },
    height: 0.16,
    thickness: 0.045,
    color: "#8d8581",
    floor: "#b6aea0",
    gate: { side: "east", along: 0, width: 0.9, level: 3 },
  },
  {
    id: "small-oni",
    label: "小鬼の河原",
    level: 3,
    extent: 15,
    bounds: { minX: -15, maxX: 15, minZ: -15, maxZ: 15 },
    height: 2,
    thickness: 0.3,
    color: "#776d70",
    floor: "#9c8580",
    gate: { side: "east", along: 0, width: 4, level: 5 },
  },
  {
    id: "ghosts",
    label: "亡者の道",
    level: 5,
    extent: 75,
    bounds: { minX: -75, maxX: 75, minZ: -75, maxZ: 75 },
    height: 9,
    thickness: 1.2,
    color: "#675b6b",
    floor: "#817783",
    gate: { side: "east", along: 0, width: 14, level: 7 },
  },
  {
    id: "red-oni",
    label: "赤鬼の火の広場",
    level: 7,
    extent: 260,
    bounds: { minX: -260, maxX: 260, minZ: -260, maxZ: 260 },
    height: 32,
    thickness: 4,
    color: "#71535a",
    floor: "#8b6565",
    gate: { side: "east", along: 0, width: 60, level: 9 },
  },
  {
    id: "blue-oni",
    label: "青鬼の大広場",
    level: 9,
    extent: 900,
    bounds: { minX: -900, maxX: 900, minZ: -900, maxZ: 900 },
    height: 120,
    thickness: 12,
    color: "#4d536a",
    floor: "#67657b",
    gate: { side: "east", along: 0, width: 440, level: 12 },
  },
  {
    id: "enma",
    label: "閻魔の大庭",
    level: 12,
    extent: 1600,
    bounds: { minX: -1600, maxX: 1600, minZ: -1600, maxZ: 1600 },
    height: 0,
    thickness: 0,
    color: "#53485e",
    floor: "#665768",
  },
];
export const HELL_WALLS = toyWallParts(HELL_SPACES, false);
export const HELL_ACTOR_KINDS = [
  "smallOni",
  "ghost",
  "redOni",
  "blueOni",
  "enma",
] as const;
export function isHellActor(definition: { hellKind?: string }) {
  return (HELL_ACTOR_KINDS as readonly string[]).includes(
    definition.hellKind ?? "",
  );
}
export function hellAreaForLevel(level: number) {
  return level < 3
    ? 0
    : level < 5
      ? 1
      : level < 7
        ? 2
        : level < 9
          ? 3
          : level < 12
            ? 4
            : 5;
}
