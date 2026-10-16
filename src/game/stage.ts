export const LEVELS = [
  { radius: 0.9, threshold: 0 },
  { radius: 1.15, threshold: 8 },
  { radius: 1.45, threshold: 24 },
  { radius: 1.85, threshold: 65 },
  { radius: 2.3, threshold: 135 },
  { radius: 2.85, threshold: 280 },
  { radius: 3.6, threshold: 600 },
  { radius: 5.1, threshold: 1300 },
] as const;

export const MAP_HALF_SIZE = 28 * Math.sqrt(1.5);
export const MOVING_OBJECTS = { kind: "person", count: 24 } as const;
export const COLLECTION_Y = -1.2;
export const PHYSICS_STEP = 1 / 60;

export const ROADS = [
  { axis: "z", position: -1, width: 4.5 },
  { axis: "x", position: -2, width: 4.5 },
] as const;

export const PLACEMENT_GROUPS = [
  { kind: "house", count: 12, stacked: 0, layers: 1 },
  { kind: "kiosk", count: 18, stacked: 0, layers: 1 },
  { kind: "bench", count: 24, stacked: 0, layers: 1 },
  { kind: "planter", count: 40, stacked: 0, layers: 1 },
  { kind: "parcel", count: 60, stacked: 20, layers: 20 },
] as const;

export const OBJECT_TYPES = {
  parcel: {
    size: [0.65, 0.65, 0.65],
    value: 1,
    color: "#e9ac68",
    label: "小箱",
  },
  bench: {
    size: [1.9, 0.45, 0.45],
    value: 2,
    color: "#aa6b4b",
    label: "ベンチ",
  },
  planter: {
    size: [1.1, 1.1, 1.1],
    value: 5,
    color: "#80a886",
    label: "植木鉢",
  },
  kiosk: { size: [1.7, 2.1, 1.7], value: 22, color: "#e69987", label: "売店" },
  house: { size: [3.5, 4, 3.5], value: 178, color: "#aec5d5", label: "家" },
  monument: {
    size: [6, 13, 6],
    value: 1700,
    color: "#ede0be",
    label: "記念塔",
  },
  person: {
    size: [0.55, 1.3, 0.45],
    value: 2,
    color: "#df8257",
    label: "人",
  },
  flower: { size: [0.5, 0.55, 0.5], value: 1, color: "#f8cb68", label: "花" },
  firewood: {
    size: [0.7, 0.34, 0.5],
    value: 1,
    color: "#93613d",
    label: "薪の束",
  },
  log: { size: [1.8, 0.46, 0.46], value: 5, color: "#805538", label: "丸太" },
  shrub: { size: [1.1, 1.1, 1.1], value: 5, color: "#699a59", label: "低木" },
  sapling: {
    size: [1.7, 2.5, 1.7],
    value: 22,
    color: "#81ac69",
    label: "若木",
  },
  tree: { size: [3.5, 6.5, 3.5], value: 178, color: "#4d8150", label: "木" },
  greatTree: {
    size: [6, 13, 6],
    value: 1700,
    color: "#376944",
    label: "森の大樹",
  },
  tanuki: {
    size: [0.5, 0.65, 0.8],
    value: 1,
    color: "#a17d59",
    label: "たぬき",
  },
  burger: {
    size: [0.8, 0.65, 0.8],
    value: 2,
    color: "#e9ac59",
    label: "ハンバーガー",
  },
  hotdog: {
    size: [1.1, 0.45, 0.45],
    value: 1,
    color: "#dc9654",
    label: "ホットドッグ",
  },
  burgerBox: {
    size: [0.6, 0.25, 0.6],
    value: 1,
    color: "#e9bd75",
    label: "ハンバーガーの紙箱",
  },
  tire: { size: [1, 0.32, 1], value: 3, color: "#343940", label: "タイヤ" },
  american: {
    size: [0.55, 1.3, 0.45],
    value: 2,
    color: "#6a9abd",
    label: "アメリカの人",
  },
  liberty: {
    size: [6, 13, 6],
    value: 1700,
    color: "#72b6a0",
    label: "自由の女神",
  },
  stone: {
    size: [0.65, 0.65, 0.65],
    value: 1,
    color: "#d4b88d",
    label: "神殿の石",
  },
  columnBlock: {
    size: [1.3, 1.3, 1.3],
    value: 8,
    color: "#d2b48a",
    label: "石のブロック",
  },
  column: { size: [2.3, 5, 2.3], value: 85, color: "#e2c99d", label: "石柱" },
  camel: { size: [1.8, 2.3, 1], value: 16, color: "#ba935f", label: "ラクダ" },
  egyptian: {
    size: [0.06, 1.3, 0.45],
    value: 2,
    color: "#f0e2c1",
    label: "エジプトの人",
  },
  pyramid: {
    size: [6, 6, 6],
    value: 300,
    color: "#d5b075",
    label: "ピラミッド",
  },
} as const;

export type ObjectKind = keyof typeof OBJECT_TYPES;
export type StageId = "plaza" | "mountain" | "america" | "egypt";
export interface PlacementGroup {
  kind: ObjectKind;
  count: number;
  stacked: number;
  layers: number;
  stackLayout?: "crib";
}
export interface StageDefinition {
  name: string;
  menuLabel: string;
  goal: ObjectKind;
  clearTitle: string;
  placement: "roadside" | "groves" | "temple";
  groups: readonly PlacementGroup[];
  moving: { kind: ObjectKind; count: number; armed?: boolean };
  groundColor: string;
  backgroundColor: string;
  accent: string;
}

export const STAGES = {
  plaza: {
    name: "はじまりの広場",
    menuLabel: "広場",
    goal: "monument",
    clearTitle: "広場を、ひと飲み。",
    placement: "roadside",
    groups: PLACEMENT_GROUPS,
    moving: MOVING_OBJECTS,
    groundColor: "#e8e3d7",
    backgroundColor: "#e8e3d7",
    accent: "#487bdf",
  },
  mountain: {
    name: "花咲く山の森",
    menuLabel: "山",
    goal: "greatTree",
    clearTitle: "大樹まで、ひと飲み。",
    placement: "groves",
    groups: [
      { kind: "tree", count: 12, stacked: 0, layers: 1 },
      { kind: "sapling", count: 24, stacked: 0, layers: 1 },
      { kind: "log", count: 4, stacked: 4, layers: 6, stackLayout: "crib" },
      { kind: "firewood", count: 4, stacked: 4, layers: 20 },
      { kind: "shrub", count: 50, stacked: 0, layers: 1 },
      { kind: "flower", count: 220, stacked: 0, layers: 1 },
    ],
    moving: { kind: "tanuki", count: 24 },
    groundColor: "#b5cd83",
    backgroundColor: "#c7dfdf",
    accent: "#418572",
  },
  america: {
    name: "アメリカの街",
    menuLabel: "アメリカ",
    goal: "liberty",
    clearTitle: "自由の女神を、ひと飲み。",
    placement: "roadside",
    groups: [
      { kind: "house", count: 12, stacked: 0, layers: 1 },
      { kind: "kiosk", count: 16, stacked: 0, layers: 1 },
      { kind: "tire", count: 6, stacked: 6, layers: 6 },
      { kind: "burgerBox", count: 4, stacked: 4, layers: 20 },
      { kind: "burger", count: 160, stacked: 0, layers: 1 },
      { kind: "hotdog", count: 100, stacked: 0, layers: 1 },
    ],
    moving: { kind: "american", count: 24, armed: true },
    groundColor: "#d8ded7",
    backgroundColor: "#d4e7ed",
    accent: "#c36758",
  },
  egypt: {
    name: "エジプトの砂漠",
    menuLabel: "エジプト",
    goal: "pyramid",
    clearTitle: "ピラミッドを、ひと飲み。",
    placement: "temple",
    groups: [
      { kind: "house", count: 10, stacked: 0, layers: 1 },
      { kind: "column", count: 18, stacked: 0, layers: 1 },
      { kind: "camel", count: 18, stacked: 0, layers: 1 },
      { kind: "columnBlock", count: 42, stacked: 12, layers: 4 },
      { kind: "stone", count: 120, stacked: 0, layers: 1 },
    ],
    moving: { kind: "egyptian", count: 24 },
    groundColor: "#ecd09a",
    backgroundColor: "#f1dcb0",
    accent: "#ad8047",
  },
} as const satisfies Record<StageId, StageDefinition>;

export const STAGE_IDS = Object.keys(STAGES) as StageId[];
export function isStageId(value: string): value is StageId {
  return Object.hasOwn(STAGES, value);
}
export function isHuman(kind: ObjectKind) {
  return kind === "person" || kind === "american" || kind === "egyptian";
}

export function placementClusters(
  seed: number,
  placement: StageDefinition["placement"],
) {
  if (placement === "roadside") return [];
  const random = seededRandom(seed ^ 0x13a5c7);
  return Array.from({ length: placement === "groves" ? 7 : 4 }, () => ({
    x: (random() * 2 - 1) * MAP_HALF_SIZE * 0.7,
    z: (random() * 2 - 1) * MAP_HALF_SIZE * 0.7,
  }));
}
export interface PlacedObject {
  id: string;
  kind: ObjectKind;
  x: number;
  z: number;
  y: number;
  yaw: number;
  stackId?: string;
  stackLevel?: number;
}

export function levelForScore(score: number): number {
  let level = 0;
  while (level + 1 < LEVELS.length && score >= LEVELS[level + 1].threshold)
    level++;
  return level;
}

export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function objectFootprint(kind: ObjectKind): number {
  const [width, , depth] = OBJECT_TYPES[kind].size;
  return Math.hypot(width, depth) / 2;
}

export function createStage(
  seed = Math.floor(Math.random() * 4294967296),
  stageId: StageId = "plaza",
): PlacedObject[] {
  if (!isStageId(stageId)) throw new Error("ステージが見つかりません。");
  const stage: StageDefinition = STAGES[stageId];
  const random = seededRandom(seed);
  const clusters = placementClusters(seed, stage.placement);
  const objects: PlacedObject[] = [];
  const sites: { x: number; z: number; footprint: number }[] = [];
  const groups: readonly PlacementGroup[] = [
    { kind: stage.goal, count: 1, stacked: 0, layers: 1 },
    ...stage.groups,
    { ...stage.moving, stacked: 0, layers: 1 },
  ];
  for (const group of groups) {
    for (let index = 0; index < group.count; index++) {
      let placed = false;
      for (let attempt = 0; attempt < 2000; attempt++) {
        // Reserve the entire alternating log pile, including its offsets.
        const footprint =
          group.stackLayout === "crib"
            ? Math.SQRT2 *
              Math.max(
                OBJECT_TYPES[group.kind].size[0] / 2,
                0.45 + OBJECT_TYPES[group.kind].size[2] / 2,
              )
            : objectFootprint(group.kind);
        const road = ROADS[Math.floor(random() * ROADS.length)];
        const side = random() < 0.5 ? -1 : 1;
        const along = (random() * 2 - 1) * (MAP_HALF_SIZE - footprint - 0.5);
        const across =
          road.position +
          side * (road.width / 2 + footprint + 0.4 + random() * 7);
        let x = road.axis === "x" ? along : across;
        let z = road.axis === "z" ? along : across;
        if (stage.placement !== "roadside") {
          const clustered =
            attempt < 1000 &&
            (stage.placement === "groves" ||
              group.kind === "column" ||
              group.kind === "columnBlock");
          const center = clusters[Math.floor(random() * clusters.length)];
          x = clustered
            ? center.x + (random() * 2 - 1) * 7
            : (random() * 2 - 1) * (MAP_HALF_SIZE - footprint - 0.5);
          z = clustered
            ? center.z + (random() * 2 - 1) * 7
            : (random() * 2 - 1) * (MAP_HALF_SIZE - footprint - 0.5);
        }
        if (
          Math.abs(x) + footprint >= MAP_HALF_SIZE ||
          Math.abs(z) + footprint >= MAP_HALF_SIZE
        )
          continue;
        if (Math.hypot(x, z) < LEVELS[0].radius + footprint + 0.2) continue;
        if (
          stage.placement === "roadside" &&
          ROADS.some(
            (other) =>
              Math.abs((other.axis === "x" ? z : x) - other.position) <
              other.width / 2 + footprint + 0.2,
          )
        )
          continue;
        if (
          sites.some(
            (other) =>
              Math.hypot(x - other.x, z - other.z) <
              footprint + other.footprint + 0.2,
          )
        )
          continue;
        const layers = index < group.stacked ? group.layers : 1;
        const yaw =
          group.kind === stage.moving.kind || stage.placement !== "roadside"
            ? random() * Math.PI * 2
            : road.axis === "x"
              ? side > 0
                ? Math.PI
                : 0
              : side > 0
                ? -Math.PI / 2
                : Math.PI / 2;
        const height = OBJECT_TYPES[group.kind].size[1];
        const id =
          group.kind === stage.goal ? "goal" : `${group.kind}-${index}`;
        for (let layer = 0; layer < layers; layer++) {
          const layerYaw =
            yaw +
            (group.stackLayout === "crib" ? ((layer % 2) * Math.PI) / 2 : 0);
          const offsets = group.stackLayout === "crib" ? [-0.45, 0.45] : [0];
          for (const [piece, offset] of offsets.entries())
            objects.push({
              id:
                group.stackLayout === "crib"
                  ? `${id}-layer-${layer}-${piece}`
                  : layer === 0
                    ? id
                    : `${id}-layer-${layer}`,
              kind: group.kind,
              x: x + Math.sin(layerYaw) * offset,
              z: z + Math.cos(layerYaw) * offset,
              y: height / 2 + 0.02 + layer * (height + 0.025),
              yaw: layerYaw,
              ...(layers > 1 ? { stackId: id, stackLevel: layer } : {}),
            });
        }
        sites.push({ x, z, footprint });
        placed = true;
        break;
      }
      if (!placed)
        throw new Error(
          `${group.kind} を配置できませんでした。配置シード: ${seed}`,
        );
    }
  }
  return objects;
}

export class Progress {
  score = 0;
  level = 0;
  cleared = false;
  readonly collected = new Set<string>();

  collect(object: Pick<PlacedObject, "id" | "kind">): boolean {
    if (this.collected.has(object.id) || this.cleared) return false;
    this.collected.add(object.id);
    this.score += OBJECT_TYPES[object.kind].value;
    this.level = levelForScore(this.score);
    if (object.id === "goal") this.cleared = true;
    return true;
  }
}
