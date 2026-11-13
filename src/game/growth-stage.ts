import {
  OBJECT_TYPES,
  STAGES,
  isStageId,
  seededRandom,
  type ObjectKind,
  type StageId,
} from "./stage";
import { createToyStage, type ToyKind } from "./toy-stage";
import { createMountainStage } from "./mountain-stage";
import { MOUNTAIN_SPACES, mountainAreaForLevel } from "./mountain-world";
import type { MountainKind } from "./mountain-visuals";
import { createPlazaStage } from "./plaza-stage";
import { PLAZA_SPACES, plazaAreaForLevel } from "./plaza-world";
import type { PlazaKind } from "./plaza-visuals";
import { createHellStage } from "./hell-stage";
import { HELL_SPACES, hellAreaForLevel, isHellActor } from "./hell-world";
import type { HellKind } from "./hell-visuals";
import { createEgyptStage } from "./egypt-stage";
import { EGYPT_SPACES, egyptAreaForLevel } from "./egypt-world";
import type { EgyptKind } from "./egypt-visuals";
import { TOY_SPACES, toyAreaForLevel, clampToyDestination } from "./toy-world";

export const GROWTH_RADII = [
  0.08, 0.14, 0.25, 0.45, 0.8, 1.5, 3, 6, 12, 24, 48, 160,
] as const;
export const GROWTH_LEVELS = GROWTH_RADII.map((radius, index) => ({
  radius,
  threshold: index === 0 ? 0 : 4 * (4 ** index - 1),
}));
export const GROWTH_AREAS = [
  { level: 1, extent: 2.4, label: "足元の世界" },
  { level: 4, extent: 18, label: "仕事と暮らし" },
  { level: 7, extent: 180, label: "街と設備" },
  { level: 10, extent: 1600, label: "巨大な世界" },
] as const;
export type GrowthModel =
  | "mountain"
  | "plaza"
  | "hell"
  | "egypt"
  | "colossalRobot"
  | "toy"
  | "original"
  | "building"
  | "tanker"
  | "hero"
  | "monster"
  | "nut"
  | "seed"
  | "bone"
  | "bead"
  | "depot";
export type GrowthBehavior =
  "still" | "work" | "route" | "train" | "march" | "battle" | "moored";
export interface GrowthObject {
  id: string;
  kind: ObjectKind;
  label: string;
  model: GrowthModel;
  size: [number, number, number];
  scale: number;
  level: number;
  area: number;
  value: number;
  x: number;
  z: number;
  yaw: number;
  behavior: GrowthBehavior;
  route?: { x: number; z: number }[];
  partnerId?: string;
  sourceLevel?: number;
  toyKind?: ToyKind;
  egyptKind?: EgyptKind;
  hellKind?: HellKind;
  plazaKind?: PlazaKind;
  mountainKind?: MountainKind;
  stationStop?: number;
  speedMultiplier?: number;
  stackY?: number;
}

const CENTRES = [
  [0.4, 0],
  [0.9, -0.9],
  [1, 1],
  [4, 0],
  [6, -5],
  [10, 8],
  [35, 0],
  [55, -50],
  [100, 95],
  [280, 0],
  [450, -350],
] as const;
const CATALOGUES: Record<StageId, readonly (readonly ObjectKind[])[]> = {
  plaza: [
    ["eraser"],
    ["pencil"],
    ["stapler", "documents"],
    ["parcel", "planter"],
    ["bench", "planter"],
    ["person", "kiosk"],
    ["car", "kiosk"],
    ["house", "kiosk"],
    ["house"],
    ["house"],
    ["house"],
  ],
  mountain: [
    ["eraser"],
    ["pencil"],
    ["flower", "stone"],
    ["flower", "firewood"],
    ["tanuki", "shrub"],
    ["log", "sapling"],
    ["tree", "sapling"],
    ["tree", "house"],
    ["tree", "house"],
    ["tree"],
    ["greatTree"],
  ],
  america: [
    ["eraser"],
    ["pencil"],
    ["burgerBox", "burger"],
    ["burgerBox", "hotdog"],
    ["tire", "burger"],
    ["american", "kiosk"],
    ["car", "kiosk"],
    ["house", "kiosk"],
    ["house"],
    ["house"],
    ["house"],
  ],
  egypt: [
    ["eraser"],
    ["pencil"],
    ["stone", "columnBlock"],
    ["stone", "columnBlock"],
    ["stone", "columnBlock"],
    ["egyptian", "camel"],
    ["column", "camel"],
    ["column", "pyramid"],
    ["pyramid", "column"],
    ["pyramid", "column"],
    ["pyramid"],
  ],
  harbor: [
    ["eraser"],
    ["pencil"],
    ["buoy", "cargoCrate"],
    ["buoy", "timber"],
    ["barrel", "cargoCrate"],
    ["dockWorker", "cargoCrate"],
    ["car", "container"],
    ["dinghy", "container"],
    ["house", "harborCrane"],
    ["house", "harborCrane"],
    ["house", "harborCrane"],
  ],
  toys: [
    ["eraser"],
    ["pencil"],
    ["toyBlock", "toyBall"],
    ["toyBlock", "toyTrain"],
    ["toyBall", "toyCar"],
    ["toySoldier", "toyTower"],
    ["toyCar", "toyTrain"],
    ["toyHouse", "toyTower"],
    ["toyHouse", "toyTower"],
    ["toyHouse"],
    ["toyHouse"],
  ],
  office: [
    ["eraser"],
    ["pencil"],
    ["stapler", "documents"],
    ["documents", "stapler"],
    ["officeChair", "documents"],
    ["officeWorker", "officeDesk", "copier"],
    ["filingCabinet", "president"],
    ["car", "house"],
    ["house"],
    ["house"],
    ["house"],
  ],
  hell: [
    ["eraser"],
    ["pencil"],
    ["skull", "stone"],
    ["skull", "stone"],
    ["hungryGhost", "skull"],
    ["oni", "hellStatue"],
    ["ironCauldron", "giantOni"],
    ["spikedPillar", "giantOni"],
    ["spikedPillar", "hellStatue"],
    ["spikedPillar", "ironCauldron"],
    ["giantOni", "hellStatue"],
  ],
};
const WORKERS: readonly ObjectKind[] = [
  "person",
  "american",
  "egyptian",
  "dockWorker",
  "officeWorker",
  "tanuki",
  "camel",
  "toySoldier",
  "oni",
  "giantOni",
  "hungryGhost",
  "skull",
];

export function areasForStage(stageId: StageId) {
  return stageId === "mountain"
    ? MOUNTAIN_SPACES
    : stageId === "plaza"
      ? PLAZA_SPACES
      : stageId === "toys"
        ? TOY_SPACES
        : stageId === "egypt"
          ? EGYPT_SPACES
          : stageId === "hell"
            ? HELL_SPACES
            : GROWTH_AREAS;
}

export function areaForLevel(level: number, stageId: StageId = "plaza") {
  if (stageId === "mountain") return mountainAreaForLevel(level);
  if (stageId === "plaza") return plazaAreaForLevel(level);
  if (stageId === "toys") return toyAreaForLevel(level);
  if (stageId === "egypt") return egyptAreaForLevel(level);
  if (stageId === "hell") return hellAreaForLevel(level);
  return Math.min(3, Math.max(0, Math.floor((level - 1) / 3)));
}

export function goalForGrowth(stageId: StageId): {
  kind: ObjectKind;
  model: GrowthModel;
  label: string;
  size: [number, number, number];
} {
  if (!isStageId(stageId)) throw new Error("ステージが見つかりません。");
  if (stageId === "mountain")
    return {
      kind: "greatTree",
      model: "mountain",
      label: "森の大樹",
      size: [200, 680, 200],
    };
  if (stageId === "plaza")
    return {
      kind: "monument",
      model: "plaza",
      label: "巨大な記念塔",
      size: [190, 540, 190],
    };
  if (stageId === "hell")
    return {
      kind: "enma",
      model: "hell",
      label: "逃げる閻魔大王",
      size: [180, 450, 145],
    };
  if (stageId === "harbor")
    return {
      kind: "dinghy",
      model: "tanker",
      label: "タンカー",
      size: [220, 35, 48],
    };
  if (stageId === "office")
    return {
      kind: "house",
      model: "building",
      label: "本社ビル",
      size: [100, 220, 95],
    };
  const kind = STAGES[stageId].goal;
  const multiplier = stageId === "egypt" ? 30 : 16;
  return {
    kind,
    model: "original",
    label: OBJECT_TYPES[kind].label,
    size: OBJECT_TYPES[kind].size.map((n) => n * multiplier) as [
      number,
      number,
      number,
    ],
  };
}

function loopAt(x: number, z: number, radius: number) {
  return [
    { x: x - radius, z: z - radius },
    { x: x + radius, z: z - radius },
    { x: x + radius, z: z + radius },
    { x: x - radius, z: z + radius },
  ];
}

export function createGrowthStage(
  seed: number,
  stageId: StageId,
): GrowthObject[] {
  if (!isStageId(stageId)) throw new Error("ステージが見つかりません。");
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error("配置シードが不正です。");
  const random = seededRandom(seed);
  const definitions: GrowthObject[] = [];
  for (let index = 0; index < 11; index++) {
    const radius = GROWTH_RADII[index];
    const [cx, cz] = CENTRES[index];
    const kinds = CATALOGUES[stageId][index];
    for (let number = 0; number < 24; number++) {
      const kind = kinds[number % kinds.length];
      const base = OBJECT_TYPES[kind];
      let scale = (radius * 1.35) / Math.hypot(...base.size);
      if (index < 8) scale = Math.min(1, scale);
      let model: GrowthModel = "original";
      let label: string = base.label;
      let size = base.size.map((n) => n * scale) as [number, number, number];
      if (index < 2 && stageId !== "office" && stageId !== "plaza") {
        model =
          stageId === "mountain"
            ? "seed"
            : stageId === "hell"
              ? "bone"
              : stageId === "harbor" || stageId === "america"
                ? "nut"
                : "bead";
        label = {
          seed: "木の実",
          bone: "小さな骨",
          nut: "ナット",
          bead: "ビーズ",
        }[model];
        size = index === 0 ? [0.045, 0.022, 0.04] : [0.13, 0.05, 0.09];
      }
      if (index >= 8 && kind === "house") {
        model = "building";
        label = stageId === "harbor" ? "港の倉庫" : "ビル";
        size = [radius * 0.85, radius * 1.05, radius * 0.8];
      }
      let behavior: GrowthBehavior = "still";
      if (index >= 4 && WORKERS.includes(kind) && number < 4)
        behavior =
          kind === "toySoldier" || kind === "hungryGhost" ? "march" : "work";
      if ((kind === "car" || kind === "toyCar") && number < 4)
        behavior = "route";
      if (kind === "toyTrain" && number < 4) behavior = "train";
      if (kind === "dinghy") behavior = "moored";
      const route = ["route", "train", "march", "work"].includes(behavior)
        ? loopAt(cx, cz - radius * 6.8, radius * 2.2)
        : undefined;
      const point = route?.[number % route.length];
      definitions.push({
        id: `growth-${index + 1}-${number}`,
        kind,
        label,
        model,
        size,
        scale,
        level: index + 1,
        area: areaForLevel(index + 1),
        value: 4 ** index,
        x: point?.x ?? cx + ((number % 6) - 2.5) * radius * 1.6,
        z: point?.z ?? cz + (Math.floor(number / 6) - 1.5) * radius * 1.6,
        yaw: route ? 0 : random() * Math.PI * 2,
        behavior,
        route,
      });
    }
    definitions.push({
      id: `stock-${index + 1}`,
      kind: "cargoCrate",
      model: "depot",
      label: "補充箱",
      size: [radius * 1.8, radius * 0.65, radius * 1.5],
      scale: 1,
      level: index + 2,
      area: areaForLevel(index + 1),
      value: 4 ** index,
      sourceLevel: index + 1,
      x: cx - radius * 7,
      z: cz,
      yaw: 0,
      behavior: "still",
    });
  }
  const landmarkKind =
    stageId === "office"
      ? "officeDesk"
      : stageId === "mountain"
        ? "tree"
        : "kiosk";
  const landmarkScale =
    stageId === "office" ? 1 : stageId === "mountain" ? 0.25 : 0.5;
  definitions.push({
    id: "landmark",
    kind: landmarkKind,
    model: "original",
    label: OBJECT_TYPES[landmarkKind].label,
    size: OBJECT_TYPES[landmarkKind].size.map((n) => n * landmarkScale) as [
      number,
      number,
      number,
    ],
    scale: landmarkScale,
    level: 6,
    area: 0,
    value: 4 ** 5,
    x: -1.1,
    z: -0.55,
    yaw: 0,
    behavior: "still",
  });
  if (stageId === "toys") {
    for (const [model, side] of [
      ["hero", -1],
      ["monster", 1],
    ] as const)
      definitions.push({
        id: model,
        kind: "giantRobot",
        model,
        label: model === "hero" ? "巨大ヒーロー" : "怪獣",
        size: [18, 45, 16],
        scale: 1,
        level: 11,
        area: 3,
        value: 4 ** 10,
        x: 300 + side * 20,
        z: -140,
        yaw: side < 0 ? Math.PI / 2 : -Math.PI / 2,
        behavior: "battle",
        partnerId: model === "hero" ? "monster" : "hero",
      });
  }
  const goal = goalForGrowth(stageId);
  definitions.push({
    ...goal,
    id: "goal",
    level: 12,
    area: 3,
    value: 4 ** 11,
    x: 1000,
    z: 700,
    yaw: 0,
    behavior: stageId === "harbor" ? "moored" : "still",
    scale:
      goal.model === "original"
        ? goal.size[0] / OBJECT_TYPES[goal.kind].size[0]
        : 1,
  });
  return stageId === "mountain"
    ? createMountainStage(definitions, random)
    : stageId === "plaza"
      ? createPlazaStage(definitions, random)
      : stageId === "toys"
        ? createToyStage(definitions, GROWTH_RADII, random)
        : stageId === "egypt"
          ? createEgyptStage(definitions, random)
          : stageId === "hell"
            ? createHellStage(definitions, random)
            : definitions;
}

export function isEgyptGod(definition: Pick<GrowthObject, "egyptKind">) {
  return ["anubis", "horus", "sobek"].includes(definition.egyptKind ?? "");
}

export function footprintOf(definition: Pick<GrowthObject, "size">) {
  return Math.hypot(definition.size[0], definition.size[2]) / 2;
}

export function canRetire(
  definition: GrowthObject,
  level: number,
  distance: number,
  radius: number,
  protectedObject: boolean,
) {
  return (
    !protectedObject &&
    definition.id !== "goal" &&
    definition.level <= level - (definition.model === "hell" ? 5 : 6) &&
    Math.hypot(...definition.size) / radius <
      (definition.model === "hell" ? 0.035 : 0.025) &&
    (definition.model === "hell" || distance > radius * 8)
  );
}

export function clampToArea(
  point: { x: number; z: number },
  area: number,
  radius: number,
  stageId: StageId = "plaza",
) {
  if (stageId === "mountain")
    return clampToyDestination(point, area, radius, MOUNTAIN_SPACES);
  if (stageId === "plaza")
    return clampToyDestination(point, area, radius, PLAZA_SPACES);
  if (stageId === "toys") return clampToyDestination(point, area, radius);
  if (stageId === "egypt")
    return clampToyDestination(point, area, radius, EGYPT_SPACES);
  if (stageId === "hell")
    return clampToyDestination(point, area, radius, HELL_SPACES);
  const limit = Math.max(0, GROWTH_AREAS[area].extent - radius);
  return {
    x: Math.max(-limit, Math.min(limit, point.x)),
    z: Math.max(-limit, Math.min(limit, point.z)),
  };
}

export function growthObjectExit(
  enteredHole: boolean,
  top: number,
  radius: number,
): "collected" | "lost" | undefined {
  if (top >= -Math.max(0.06, radius * 0.35)) return undefined;
  return enteredHole ? "collected" : "lost";
}

export class GrowthProgress {
  score = 0;
  level = 1;
  cleared = false;
  readonly collected = new Set<string>();
  constructor(private stageId: StageId = "plaza") {}

  collect(
    definition: Pick<GrowthObject, "id" | "value"> &
      Partial<Pick<GrowthObject, "hellKind">>,
  ) {
    if (this.cleared || this.collected.has(definition.id)) return false;
    if (
      !definition.id ||
      !Number.isFinite(definition.value) ||
      definition.value <= 0
    )
      throw new Error("成長ポイントが不正です。");
    this.collected.add(definition.id);
    const credit =
      this.stageId === "hell" && !isHellActor(definition)
        ? Math.max(
            0,
            Math.min(definition.value, GROWTH_LEVELS[2].threshold - this.score),
          )
        : definition.value;
    this.score += credit;
    while (
      this.level < GROWTH_LEVELS.length &&
      this.score >= GROWTH_LEVELS[this.level].threshold
    )
      this.level++;
    if (definition.id === "goal") this.cleared = true;
    return true;
  }
}
