import type { GrowthObject } from "./growth-stage";
import type { HellKind } from "./hell-visuals";
import { HELL_SPACES, HELL_WALLS, hellAreaForLevel } from "./hell-world";
import { insideToyRect } from "./toy-world";
const RADII = [0.08, 0.14, 0.25, 0.45, 0.8, 1.5, 3, 6, 12, 24, 48, 160];
function footprint(d: GrowthObject) {
  return Math.hypot(d.size[0], d.size[2]) / 2;
}
function touches(
  x: number,
  z: number,
  r: number,
  b: { minX: number; maxX: number; minZ: number; maxZ: number },
) {
  return (
    Math.hypot(
      Math.max(0, b.minX - x, x - b.maxX),
      Math.max(0, b.minZ - z, z - b.maxZ),
    ) < r
  );
}
class PlacementError extends Error {}
export function createHellStage(
  definitions: GrowthObject[],
  random: () => number,
) {
  let last: PlacementError | undefined;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return layout(definitions, random);
    } catch (e) {
      if (!(e instanceof PlacementError)) throw e;
      last = e;
    }
  }
  throw last!;
}
function layout(definitions: GrowthObject[], random: () => number) {
  const template = definitions[0],
    placed: GrowthObject[] = [];
  const object = (
    id: string,
    kind: HellKind,
    size: [number, number, number],
    level: number,
    area = hellAreaForLevel(level),
  ): GrowthObject => ({
    ...template,
    id,
    kind:
      kind === "enma"
        ? "enma"
        : kind === "ghost"
          ? "hungryGhost"
          : kind.includes("Oni")
            ? "oni"
            : "stone",
    model: "hell",
    hellKind: kind,
    label: (
      {
        pebble: "賽の小石",
        cairn: "積み石",
        smallOni: "小鬼",
        ghost: "亡者",
        redOni: "赤鬼",
        blueOni: "青鬼",
        enma: "逃げる閻魔大王",
        lantern: "石灯籠",
        torii: "地獄の鳥居",
        statue: "地蔵",
        cauldron: "地獄の釜",
        needleRock: "針の岩山",
        palace: "閻魔の御殿",
      } satisfies Record<HellKind, string>
    )[kind],
    size,
    level,
    area,
    scale: 1,
    value: 1,
    x: 0,
    z: 0,
    yaw: 0,
    behavior: "still",
    sourceLevel: undefined,
    route: undefined,
  });
  const goal = object("goal", "enma", [180, 450, 145], 12);
  goal.value = 4 ** 11;
  goal.x = 1140;
  goal.z = -220;
  goal.behavior = "work";
  goal.route = [
    { x: 1140, z: -220 },
    { x: 1380, z: -220 },
    { x: 1380, z: 280 },
    { x: 1100, z: 280 },
    { x: 1100, z: -220 },
  ];
  placed.push(goal);
  const corridors = [
    { route: goal.route, foot: footprint(goal), radius: RADII[11] },
  ];
  // Landmarks stay at the same scale and position while the hole grows past them.
  for (let i = 0; i < 5; i++) {
    const s = HELL_SPACES[i],
      gate = s.gate!,
      r = RADII[gate.level - 1];
    const d = object(
      `hell-landmark-${i}`,
      "torii",
      [gate.width * 1.5, r * 6, r * 0.7],
      gate.level,
      i + 1,
    );
    d.x = s.bounds.maxX + s.thickness / 2 + d.size[2] / 2 + 0.03;
    d.z = 0;
    d.yaw = Math.PI / 2;
    placed.push(d);
  }
  const palace = object("hell-palace", "palace", [280, 190, 220], 12, 5);
  palace.x = 1220;
  palace.z = -900;
  placed.push(palace);
  const place = (d: GrowthObject) => {
    const s = HELL_SPACES[d.area],
      b = s.bounds,
      r = footprint(d),
      margin = r + s.thickness + 0.025;
    for (let tries = 0; tries < 6000; tries++) {
      const x = b.minX + margin + random() * (b.maxX - b.minX - 2 * margin),
        z = b.minZ + margin + random() * (b.maxZ - b.minZ - 2 * margin);
      if (!insideToyRect({ x, z }, b, margin)) continue;
      if (d.area === 0 && Math.hypot(x, z) < r + 0.13) continue;
      if (d.area > 0 && touches(x, z, r + 0.05, HELL_SPACES[d.area - 1].bounds))
        continue;
      if (HELL_WALLS.some((w) => touches(x, z, r + 0.025, w))) continue;
      if (
        corridors.some(
          (o) =>
            routeDistance({ x, z }, o.route) < r + o.foot + o.radius * 0.25,
        )
      )
        continue;
      if (
        placed.some(
          (o) => Math.hypot(x - o.x, z - o.z) < r + footprint(o) + 0.02,
        )
      )
        continue;
      return { ...d, x, z, yaw: random() * Math.PI * 2 };
    }
    throw new PlacementError(`${d.label}を${s.label}へ配置できません`);
  };
  for (let level = 11; level >= 1; level--) {
    const r = RADII[level - 1],
      area = hellAreaForLevel(level),
      kind: HellKind =
        level <= 2
          ? "pebble"
          : level <= 4
            ? "smallOni"
            : level <= 6
              ? "ghost"
              : level <= 8
                ? "redOni"
                : "blueOni";
    for (let i = 0; i < (level <= 2 ? 24 : 16); i++) {
      const size: [number, number, number] =
        level <= 2
          ? [r * 0.85, r * 0.32, r * 0.65]
          : [r * 0.9, r * 2.2, r * 0.65];
      let d = object(`growth-${level}-${i}`, kind, size, level, area);
      d.value = 4 ** (level - 1) * (level <= 2 ? 1 : 3);
      if (level <= 2) d = place(d);
      else {
        const inner = HELL_SPACES[area - 1].bounds,
          q = footprint(d),
          gap = r * 4.5 + q + 0.15;
        const corners = [
          { x: inner.maxX + gap, z: inner.minZ - gap },
          { x: inner.maxX + gap, z: inner.maxZ + gap },
          { x: inner.minX - gap, z: inner.maxZ + gap },
          { x: inner.minX - gap, z: inner.minZ - gap },
        ];
        const side = Math.floor(i / 4),
          t = (i % 4) / 4,
          a = corners[side],
          b = corners[(side + 1) % 4];
        d.x = a.x + (b.x - a.x) * t;
        d.z = a.z + (b.z - a.z) * t;
        d.yaw = random() * Math.PI * 2;
        d.behavior = "work";
        d.route = [
          { x: d.x, z: d.z },
          ...Array.from({ length: 4 }, (_, j) => corners[(side + 1 + j) % 4]),
        ];
        if (i === 0) corridors.push({ route: corners, foot: q, radius: r });
      }
      placed.push(d);
    }
  }
  for (const [area, count] of [
    [0, 5],
    [1, 8],
    [2, 12],
    [3, 20],
    [4, 55],
    [5, 80],
  ] as const) {
    for (let i = 0; i < count; i++) {
      const level = HELL_SPACES[area].level,
        base =
          area === 0
            ? 0.11
            : area === 1
              ? 0.7
              : area === 2
                ? 3
                : area === 3
                  ? 12
                  : area === 4
                    ? 55
                    : 90;
      const kind: HellKind =
        area === 0
          ? "cairn"
          : (
              [
                "lantern",
                "torii",
                "statue",
                "cauldron",
                "needleRock",
                "palace",
              ] as const
            )[i % 6];
      const d = object(
        `hell-scenery-${area}-${i}`,
        kind,
        [base, base * (kind === "lantern" ? 2 : 1.4), base * 0.8],
        level,
        area,
      );
      placed.push(place(d));
    }
  }
  return placed.sort((a, b) => a.area - b.area || a.level - b.level);
}

function routeDistance(
  p: { x: number; z: number },
  route: { x: number; z: number }[],
) {
  return Math.min(
    ...route.map((a, i) => {
      const b = route[(i + 1) % route.length];
      const dx = b.x - a.x,
        dz = b.z - a.z,
        t = Math.max(
          0,
          Math.min(
            1,
            ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1),
          ),
        );
      return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
    }),
  );
}
