export interface ToyRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
export interface ToySpace {
  id: string;
  label: string;
  level: number;
  extent: number;
  bounds: ToyRect;
  height: number;
  thickness: number;
  color: string;
  floor: string;
  gate?: {
    side: "east" | "south";
    along: number;
    width: number;
    level: number;
  };
}
export interface ToyWall extends ToyRect {
  id: string;
  space: number;
  height: number;
  color: string;
  door: boolean;
}
export const TOY_SPACES: readonly ToySpace[] = [
  {
    id: "notions",
    label: "小物箱",
    level: 1,
    extent: 0.85,
    bounds: { minX: -0.75, maxX: 0.75, minZ: -0.55, maxZ: 0.55 },
    height: 0.27,
    thickness: 0.035,
    color: "#d1a77f",
    floor: "#d7b48e",
    gate: { side: "east", along: 0, width: 1.1, level: 3 },
  },
  {
    id: "chest",
    label: "おもちゃ箱",
    level: 3,
    extent: 3.5,
    bounds: { minX: -3.3, maxX: 3.3, minZ: -2.6, maxZ: 2.6 },
    height: 1.3,
    thickness: 0.14,
    color: "#659d9c",
    floor: "#d4b793",
    gate: { side: "south", along: 0, width: 2.7, level: 5 },
  },
  {
    id: "bedroom",
    label: "子供部屋",
    level: 5,
    extent: 36,
    bounds: { minX: -4.4, maxX: 31.6, minZ: -4, maxZ: 32 },
    height: 22,
    thickness: 0.35,
    color: "#a9bacb",
    floor: "#cfa77c",
    gate: { side: "east", along: 23, width: 8.5, level: 7 },
  },
  {
    id: "house",
    label: "家の中",
    level: 7,
    extent: 110,
    bounds: { minX: -25, maxX: 95, minZ: -25, maxZ: 105 },
    height: 24,
    thickness: 1,
    color: "#e4d3af",
    floor: "#d7b58c",
    gate: { side: "east", along: 80, width: 33, level: 9 },
  },
  {
    id: "city",
    label: "街",
    level: 9,
    extent: 1600,
    bounds: { minX: -1600, maxX: 1600, minZ: -1600, maxZ: 1600 },
    height: 0,
    thickness: 0,
    color: "#a8b3ad",
    floor: "#a8be9c",
  },
];

export function toyAreaForLevel(level: number) {
  let area = 0;
  for (let index = 1; index < TOY_SPACES.length; index++)
    if (level >= TOY_SPACES[index].level) area = index;
  return area;
}
export function insideToyRect(
  point: { x: number; z: number },
  rect: ToyRect,
  margin = 0,
) {
  return (
    point.x >= rect.minX + margin &&
    point.x <= rect.maxX - margin &&
    point.z >= rect.minZ + margin &&
    point.z <= rect.maxZ - margin
  );
}
export function toyWallParts(): ToyWall[] {
  const walls: ToyWall[] = [];
  TOY_SPACES.forEach((space, index) => {
    if (!space.height) return;
    const b = space.bounds,
      t = space.thickness;
    const add = (id: string, rect: ToyRect, door = false) => {
      if (rect.maxX - rect.minX < 0.00001 || rect.maxZ - rect.minZ < 0.00001)
        return;
      walls.push({
        ...rect,
        id: `${space.id}-${id}`,
        space: index,
        height: space.height,
        color: door ? "#aa7953" : space.color,
        door,
      });
    };
    for (const side of ["west", "east", "north", "south"] as const) {
      const vertical = side === "west" || side === "east";
      const at =
        side === "west"
          ? b.minX
          : side === "east"
            ? b.maxX
            : side === "north"
              ? b.minZ
              : b.maxZ;
      const start = vertical ? b.minZ : b.minX,
        end = vertical ? b.maxZ : b.maxX;
      const rect = (a: number, z: number): ToyRect =>
        vertical
          ? { minX: at - t / 2, maxX: at + t / 2, minZ: a, maxZ: z }
          : { minX: a, maxX: z, minZ: at - t / 2, maxZ: at + t / 2 };
      if (space.gate?.side === side) {
        const low = space.gate.along - space.gate.width / 2,
          high = space.gate.along + space.gate.width / 2;
        add(`${side}-a`, rect(start, low));
        add(`${side}-b`, rect(high, end));
        add("door", rect(low, high), true);
      } else add(side, rect(start, end));
    }
  });
  // The bedroom is one preserved room of the larger house; these form kitchen/living/entry spaces.
  for (const [id, x1, x2, z1, z2] of [
    ["kitchen-a", 38, 54, 35, 35.7],
    ["kitchen-b", 83, 95, 35, 35.7],
    ["entry-a", 36, 56, 87, 87.7],
  ] as const)
    walls.push({
      id,
      minX: x1,
      maxX: x2,
      minZ: z1,
      maxZ: z2,
      space: 3,
      height: 12,
      color: "#e4d3af",
      door: false,
    });
  return walls;
}
export function toySpaceFootprint(space: ToySpace) {
  return (
    Math.hypot(
      space.bounds.maxX - space.bounds.minX,
      space.bounds.maxZ - space.bounds.minZ,
    ) / 2
  );
}
export function toyBlockingWalls(
  openedArea: number,
  radius: number,
  openDoors = new Set(
    TOY_SPACES.slice(0, openedArea).map((s) => `${s.id}-door`),
  ),
) {
  return toyWallParts().filter((wall) => {
    const space = TOY_SPACES[wall.space];
    if (radius > toySpaceFootprint(space)) return false;
    if (
      space.gate &&
      openDoors.has(`${space.id}-door`) &&
      radius * 2 > space.gate.width
    )
      return false;
    return !wall.door || !openDoors.has(wall.id);
  });
}
export function clampToyDestination(
  point: { x: number; z: number },
  area: number,
  radius: number,
) {
  const b = TOY_SPACES[area].bounds;
  return {
    x: Math.max(b.minX + radius, Math.min(b.maxX - radius, point.x)),
    z: Math.max(b.minZ + radius, Math.min(b.maxZ - radius, point.z)),
  };
}
export function constrainToyStep(
  previous: { x: number; z: number },
  next: { x: number; z: number },
  radius: number,
  walls: readonly ToyWall[],
) {
  const point = { ...next };
  // A fixed physics step moves less than a radius, preventing tunnelling through thin walls.
  for (let pass = 0; pass < 3; pass++)
    for (const wall of walls) {
      const x = Math.max(wall.minX, Math.min(wall.maxX, point.x));
      const z = Math.max(wall.minZ, Math.min(wall.maxZ, point.z));
      const dx = point.x - x,
        dz = point.z - z,
        distance = Math.hypot(dx, dz);
      if (distance >= radius) continue;
      if (distance > 0.000001) {
        point.x = x + (dx / distance) * radius;
        point.z = z + (dz / distance) * radius;
      } else if (wall.maxX - wall.minX < wall.maxZ - wall.minZ) {
        point.x =
          previous.x < (wall.minX + wall.maxX) / 2
            ? wall.minX - radius
            : wall.maxX + radius;
      } else
        point.z =
          previous.z < (wall.minZ + wall.maxZ) / 2
            ? wall.minZ - radius
            : wall.maxZ + radius;
    }
  return point;
}

export const TOY_CITY_COLUMNS = [-1200, -800, -400, 320, 720, 1300] as const;
export const TOY_CITY_ROWS = [-1200, -800, -400, 80, 440, 840, 1240] as const;
export const TOY_CITY_ROADS = [
  ...TOY_CITY_COLUMNS.map((x) => ({ x, z: 0, width: 24, depth: 2800 })),
  ...TOY_CITY_ROWS.filter((z) => z !== 80).map((z) => ({
    x: 0,
    z,
    width: 2800,
    depth: 24,
  })),
  // Leave the original house off the road; its entrance meets the east section.
  { x: -735, z: 80, width: 1330, depth: 24 },
  { x: 750, z: 80, width: 1300, depth: 24 },
];
