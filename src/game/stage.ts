export const LEVELS = [
  { radius: 0.9, threshold: 0 },
  { radius: 1.15, threshold: 8 },
  { radius: 1.45, threshold: 32 },
  { radius: 1.85, threshold: 120 },
  { radius: 2.3, threshold: 320 },
  { radius: 2.85, threshold: 720 },
  { radius: 3.6, threshold: 1500 },
  { radius: 5.1, threshold: 2700 },
] as const;

export interface GrowthLevel {
  radius: number;
  threshold: number;
}
const OFFICE_LEVELS: readonly GrowthLevel[] = LEVELS.map((level, index) => ({
  radius: [0.08, 0.12, 0.2, 0.28, 0.42, 0.62, 0.9, 1.6][index],
  threshold: level.threshold,
}));

export function levelsForStage(stageId: StageId): readonly GrowthLevel[] {
  if (!isStageId(stageId)) throw new Error("ステージが見つかりません。");
  return stageId === "office" ? OFFICE_LEVELS : LEVELS;
}

export const MAP_HALF_SIZE = 50;
export function mapHalfSizeForStage(stageId: StageId): number {
  if (!isStageId(stageId)) throw new Error("ステージが見つかりません。");
  return MAP_HALF_SIZE * stageScaleForStage(stageId);
}
export function stageScaleForStage(stageId: StageId) {
  return stageId === "office" ? 0.2 : 1;
}
export const STATIONERY_SITE_IDS = ["stationeryA", "stationeryB"] as const;
export const STATIONERY_RETIREMENT_LEVEL = 6;
export type StationerySiteId = (typeof STATIONERY_SITE_IDS)[number];
export type SupplySiteId = "food" | "depot" | StationerySiteId;
export interface SupplySite {
  id: SupplySiteId;
  label: string;
  x: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  outputX: number;
  outputZ: number;
  scale: number;
  profile?: "stationery";
}

export function supplySiteCollectionLevel(site: Pick<SupplySite, "profile">) {
  return site.profile === "stationery" ? STATIONERY_RETIREMENT_LEVEL : 8;
}

export function supplySiteSuppliesAtLevel(
  site: Pick<SupplySite, "profile">,
  level: number,
) {
  return site.profile !== "stationery" || level < STATIONERY_RETIREMENT_LEVEL;
}
const SUPPLY_SITE_SHAPES = [
  { id: "food", label: "工場A", width: 4, height: 2.8, depth: 2.6 },
  { id: "depot", label: "工場B", width: 4.5, height: 3.5, depth: 4 },
] as const;

export const MOVING_OBJECTS = { kind: "person", count: 24 } as const;
export const COLLECTION_Y = -1.2;
export const PHYSICS_STEP = 1 / 60;

export const ROADS = [
  { axis: "z", position: -1, width: 4.5 },
  { axis: "x", position: -2, width: 4.5 },
] as const;
export function roadsForStage(stageId: StageId) {
  const scale = stageScaleForStage(stageId);
  return ROADS.map((road) => ({
    ...road,
    position: road.position * scale,
    width: road.width * scale,
  }));
}

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
  car: {
    size: [2.6, 1.1, 1.35],
    value: 32,
    color: "#e98059",
    label: "車",
  },
  streetSweeper: {
    size: [3.2, 1.8, 2.8],
    value: 80,
    color: "#e7b64c",
    label: "清掃車",
  },
  smallFactory: {
    size: [4.2, 5.01, 2.86],
    value: 178,
    color: "#57a995",
    label: "工場A",
  },
  largeFactory: {
    size: [4.7, 5.71, 4.26],
    value: 178,
    color: "#8a9da9",
    label: "工場B",
  },
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
  buoy: { size: [0.55, 0.65, 0.55], value: 1, color: "#eb8057", label: "浮き" },
  barrel: { size: [1.2, 1.3, 1.2], value: 5, color: "#9c7350", label: "樽" },
  cargoCrate: {
    size: [1.7, 1.5, 1.7],
    value: 22,
    color: "#c99761",
    label: "港の木箱",
  },
  timber: {
    size: [2.5, 0.25, 0.45],
    value: 8,
    color: "#b18a61",
    label: "長い木材",
  },
  dinghy: { size: [2.7, 1, 1.35], value: 32, color: "#74a4bb", label: "小舟" },
  container: {
    size: [3.5, 3, 3.5],
    value: 178,
    color: "#d47a57",
    label: "コンテナ",
  },
  dockWorker: {
    size: [0.55, 1.3, 0.45],
    value: 2,
    color: "#eeb34d",
    label: "港の作業員",
  },
  harborCrane: {
    size: [6, 13, 6],
    value: 1700,
    color: "#e0b048",
    label: "巨大クレーン",
  },
  toyBlock: {
    size: [0.65, 0.65, 0.65],
    value: 1,
    color: "#ed8c7d",
    label: "積み木",
  },
  toyBall: { size: [1, 1, 1], value: 5, color: "#88b4d8", label: "ボール" },
  toyTrain: {
    size: [1.8, 0.9, 0.65],
    value: 8,
    color: "#81ad93",
    label: "おもちゃの汽車",
  },
  toyCar: {
    size: [2.2, 1, 1.2],
    value: 22,
    color: "#edc45b",
    label: "おもちゃの車",
  },
  toyTower: {
    size: [1.7, 2.4, 1.7],
    value: 22,
    color: "#a999ce",
    label: "積み木の塔",
  },
  toyHouse: {
    size: [3.5, 4, 3.5],
    value: 178,
    color: "#9ec5c3",
    label: "おもちゃの家",
  },
  toySoldier: {
    size: [0.55, 1.3, 0.45],
    value: 2,
    color: "#8caa8b",
    label: "おもちゃの兵隊",
  },
  giantRobot: {
    size: [6, 11, 6],
    value: 1700,
    color: "#82a9cd",
    label: "巨大ロボット",
  },
  eraser: {
    size: [0.04, 0.02, 0.025],
    value: 1,
    color: "#ecb6b7",
    label: "消しゴム",
  },
  pencil: {
    size: [0.18, 0.015, 0.015],
    value: 1,
    color: "#d6aa51",
    label: "鉛筆",
  },
  stapler: {
    size: [0.14, 0.06, 0.06],
    value: 3,
    color: "#80a0b5",
    label: "ホチキス",
  },
  documents: {
    size: [0.3, 0.03, 0.22],
    value: 8,
    color: "#f1e9d7",
    label: "書類の束",
  },
  officeChair: {
    size: [0.55, 1, 0.55],
    value: 22,
    color: "#6d88a2",
    label: "事務椅子",
  },
  filingCabinet: {
    size: [1, 2, 0.45],
    value: 85,
    color: "#b9c4c7",
    label: "書類棚",
  },
  officeDesk: {
    size: [1.4, 0.75, 0.7],
    value: 178,
    color: "#bc9c76",
    label: "机",
  },
  copier: {
    size: [0.9, 1.2, 0.9],
    value: 178,
    color: "#c8cfce",
    label: "コピー機",
  },
  officeWorker: {
    size: [0.55, 1.3, 0.45],
    value: 2,
    color: "#7c94ad",
    label: "社員",
  },
  president: {
    size: [2.3, 1.8, 1.4],
    value: 1700,
    color: "#556b83",
    label: "社長",
  },
  skull: {
    size: [0.55, 0.65, 0.5],
    value: 1,
    color: "#e4ddc1",
    label: "歩くドクロ",
  },
  hungryGhost: {
    size: [0.7, 1.3, 0.55],
    value: 5,
    color: "#b8c3c7",
    label: "亡者",
  },
  oni: { size: [1.6, 2.2, 1.2], value: 22, color: "#bd685d", label: "鬼" },
  giantOni: {
    size: [3.5, 4, 3.5],
    value: 178,
    color: "#667faf",
    label: "大鬼",
  },
  hellStatue: {
    size: [1.6, 2.2, 1.6],
    value: 22,
    color: "#88908c",
    label: "地獄の石像",
  },
  ironCauldron: {
    size: [2.3, 2.1, 2.3],
    value: 85,
    color: "#535865",
    label: "鉄の釜",
  },
  spikedPillar: {
    size: [3.5, 4.5, 3.5],
    value: 178,
    color: "#84787a",
    label: "針の岩山",
  },
  enma: { size: [6, 10, 6], value: 1700, color: "#a64b49", label: "閻魔大王" },
} as const;

export type ObjectKind = keyof typeof OBJECT_TYPES;
export type StageId =
  | "plaza"
  | "mountain"
  | "america"
  | "egypt"
  | "harbor"
  | "toys"
  | "office"
  | "hell";
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
  placement: "roadside" | "groves" | "temple" | "hell";
  groups: readonly PlacementGroup[];
  moving: {
    kind: ObjectKind;
    count: number;
    armed?: boolean;
    additionalKinds?: readonly ObjectKind[];
    speeds?: { walk: number; run: number };
  };
  groundColor: string;
  backgroundColor: string;
  accent: string;
}

export const STAGES = {
  plaza: {
    name: "花壇から広がる広場",
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
      { kind: "house", count: 16, stacked: 0, layers: 1 },
      { kind: "car", count: 18, stacked: 0, layers: 1 },
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
  harbor: {
    name: "荷物がいっぱいの港",
    menuLabel: "港",
    goal: "harborCrane",
    clearTitle: "クレーンまで、ひと飲み。",
    placement: "roadside",
    groups: [
      { kind: "container", count: 14, stacked: 0, layers: 1 },
      { kind: "dinghy", count: 16, stacked: 0, layers: 1 },
      { kind: "cargoCrate", count: 24, stacked: 4, layers: 3 },
      { kind: "timber", count: 20, stacked: 0, layers: 1 },
      { kind: "barrel", count: 40, stacked: 0, layers: 1 },
      { kind: "buoy", count: 140, stacked: 0, layers: 1 },
    ],
    moving: { kind: "dockWorker", count: 24 },
    groundColor: "#bbc7cb",
    backgroundColor: "#86b9cd",
    accent: "#cc9b3a",
  },
  toys: {
    name: "積み木とおもちゃの街",
    menuLabel: "おもちゃ",
    goal: "giantRobot",
    clearTitle: "ロボットまで、ひと飲み。",
    placement: "roadside",
    groups: [
      { kind: "toyHouse", count: 14, stacked: 0, layers: 1 },
      { kind: "toyTower", count: 24, stacked: 0, layers: 1 },
      { kind: "toyCar", count: 24, stacked: 0, layers: 1 },
      { kind: "toyTrain", count: 24, stacked: 0, layers: 1 },
      { kind: "toyBall", count: 60, stacked: 0, layers: 1 },
      { kind: "toyBlock", count: 36, stacked: 8, layers: 20 },
    ],
    moving: { kind: "toySoldier", count: 24 },
    groundColor: "#f2e4c3",
    backgroundColor: "#d6e6f0",
    accent: "#9474b7",
  },
  office: {
    name: "小さな穴と大きな会社",
    menuLabel: "会社",
    goal: "president",
    clearTitle: "社長の席まで、ひと飲み。",
    placement: "roadside",
    groups: [
      { kind: "officeDesk", count: 12, stacked: 0, layers: 1 },
      { kind: "copier", count: 8, stacked: 0, layers: 1 },
      { kind: "filingCabinet", count: 12, stacked: 0, layers: 1 },
      { kind: "officeChair", count: 24, stacked: 0, layers: 1 },
      { kind: "documents", count: 8, stacked: 8, layers: 10 },
      { kind: "stapler", count: 20, stacked: 0, layers: 1 },
      { kind: "pencil", count: 50, stacked: 0, layers: 1 },
      { kind: "eraser", count: 50, stacked: 0, layers: 1 },
    ],
    moving: { kind: "officeWorker", count: 16 },
    groundColor: "#d1d0c9",
    backgroundColor: "#dce4e4",
    accent: "#6380a2",
  },
  hell: {
    name: "追いかけっこの地獄",
    menuLabel: "地獄",
    goal: "enma",
    clearTitle: "閻魔大王まで、ひと飲み。",
    placement: "hell",
    groups: [
      { kind: "giantOni", count: 14, stacked: 0, layers: 1 },
      { kind: "spikedPillar", count: 6, stacked: 0, layers: 1 },
      { kind: "ironCauldron", count: 8, stacked: 0, layers: 1 },
      { kind: "hellStatue", count: 6, stacked: 0, layers: 1 },
      { kind: "oni", count: 28, stacked: 0, layers: 1 },
      { kind: "hungryGhost", count: 52, stacked: 0, layers: 1 },
      { kind: "skull", count: 80, stacked: 0, layers: 1 },
    ],
    moving: {
      kind: "hungryGhost",
      count: 0,
      additionalKinds: ["skull", "oni", "giantOni"],
      speeds: { walk: 0.8, run: 1.6 },
    },
    groundColor: "#6c626c",
    backgroundColor: "#423d52",
    accent: "#a77cdb",
  },
} as const satisfies Record<StageId, StageDefinition>;

export const STAGE_IDS = Object.keys(STAGES) as StageId[];

export function isStageId(value: string): value is StageId {
  return Object.hasOwn(STAGES, value);
}
export function isHuman(kind: ObjectKind) {
  return [
    "person",
    "american",
    "egyptian",
    "dockWorker",
    "officeWorker",
    "hungryGhost",
  ].includes(kind);
}
export function walkingKindsForStage(stageId: StageId): readonly ObjectKind[] {
  const moving: StageDefinition["moving"] = STAGES[stageId].moving;
  return [moving.kind, ...(moving.additionalKinds ?? [])];
}
export function isWalkingKind(kind: ObjectKind) {
  return STAGE_IDS.some((stageId) =>
    walkingKindsForStage(stageId).includes(kind),
  );
}
export function objectSizeForStage(kind: ObjectKind, stageId: StageId) {
  const scale = kind === "streetSweeper" ? stageScaleForStage(stageId) : 1;
  return OBJECT_TYPES[kind].size.map((value) => value * scale);
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
export function createSupplySites(
  seed: number,
  stageId: StageId,
): SupplySite[] {
  const scale = stageScaleForStage(stageId);
  const halfSize = mapHalfSizeForStage(stageId);
  const roads = roadsForStage(stageId);
  const random = seededRandom(seed ^ 0x435107);
  const stage = STAGES[stageId];
  const clusters = placementClusters(seed, stage.placement);
  const sites: SupplySite[] = [];
  for (const template of SUPPLY_SITE_SHAPES) {
    const shape = {
      ...template,
      width: template.width * scale,
      height: template.height * scale,
      depth: template.depth * scale,
    };
    let placed = false;
    const footprint = Math.hypot(shape.width, shape.depth) / 2;
    for (let attempt = 0; attempt < 2000; attempt++) {
      const road = roads[Math.floor(random() * roads.length)];
      const side = random() < 0.5 ? -1 : 1;
      const along = (random() * 2 - 1) * (halfSize - 12 * scale);
      const across =
        road.position +
        side *
          (road.width / 2 + footprint + 0.4 * scale + random() * 7 * scale);
      const center = clusters.length
        ? clusters[Math.floor(random() * clusters.length)]
        : undefined;
      const x = center
        ? center.x + (random() * 2 - 1) * 7
        : road.axis === "x"
          ? along
          : across;
      const z = center
        ? center.z + (random() * 2 - 1) * 7
        : road.axis === "z"
          ? along
          : across;
      const outputX = x,
        outputZ = z + 7 * scale;
      if (
        Math.max(Math.abs(x), Math.abs(z)) + footprint + 0.5 * scale >=
          halfSize ||
        Math.max(Math.abs(outputX), Math.abs(outputZ)) + 4 * scale >=
          halfSize ||
        Math.hypot(x, z) <
          footprint + levelsForStage(stageId)[0].radius + 0.5 * scale ||
        Math.hypot(outputX, outputZ) <
          4 * scale + levelsForStage(stageId)[0].radius
      )
        continue;
      if (
        stageId === "office" &&
        (Math.hypot(x, z) < 1.8 || Math.hypot(outputX, outputZ) < 1.8)
      )
        continue;
      if (
        stage.placement === "roadside" &&
        roads.some(
          (other) =>
            Math.abs((other.axis === "x" ? z : x) - other.position) <
            other.width / 2 + footprint + 0.2 * scale,
        )
      )
        continue;
      if (
        sites.some((other) => Math.hypot(x - other.x, z - other.z) < 16 * scale)
      )
        continue;
      sites.push({ ...shape, x, z, outputX, outputZ, scale });
      placed = true;
      break;
    }
    if (!placed)
      throw new Error("工場を配置できませんでした。配置シード: " + seed);
  }
  if (stageId === "office") {
    const miniScale = scale / 4;
    for (const id of STATIONERY_SITE_IDS) {
      const width = 4 * miniScale,
        height = 2.8 * miniScale,
        depth = 2.6 * miniScale;
      const footprint = Math.hypot(width, depth) / 2;
      let placed = false;
      for (let attempt = 0; attempt < 2000; attempt++) {
        const road = roads[Math.floor(random() * roads.length)];
        const along = (random() * 2 - 1) * 2.4;
        const across =
          road.position +
          (random() < 0.5 ? -1 : 1) *
            (road.width / 2 + footprint + 0.08 + random() * 0.25);
        const x = road.axis === "x" ? along : across;
        const z = road.axis === "z" ? along : across;
        const outputX = x,
          outputZ = z + 0.65;
        if (Math.hypot(x, z) < 1.2 || Math.hypot(outputX, outputZ) < 1.4)
          continue;
        if (
          sites.some((other) => {
            const otherFootprint = Math.hypot(other.width, other.depth) / 2;
            return (
              Math.hypot(x - other.x, z - other.z) <
                footprint + otherFootprint + 0.3 ||
              Math.hypot(outputX - other.x, outputZ - other.z) <
                otherFootprint + 0.35 ||
              Math.hypot(x - other.outputX, z - other.outputZ) <
                footprint + 0.35 ||
              Math.hypot(outputX - other.outputX, outputZ - other.outputZ) < 0.5
            );
          })
        )
          continue;
        sites.push({
          id,
          label: id === "stationeryA" ? "小型工場A" : "小型工場B",
          width,
          height,
          depth,
          x,
          z,
          outputX,
          outputZ,
          scale: miniScale,
          profile: "stationery",
        });
        placed = true;
        break;
      }
      if (!placed)
        throw new Error("小型工場を配置できませんでした。配置シード: " + seed);
    }
  }
  return sites;
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
  sourceId?: SupplySiteId;
}

export function levelForScore(
  score: number,
  levels: readonly GrowthLevel[] = LEVELS,
): number {
  let level = 0;
  while (level + 1 < levels.length && score >= levels[level + 1].threshold)
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

export function objectFootprint(
  kind: ObjectKind,
  stageId: StageId = "plaza",
): number {
  const [width, , depth] = objectSizeForStage(kind, stageId);
  return Math.hypot(width, depth) / 2;
}

export function createStage(
  seed = Math.floor(Math.random() * 4294967296),
  stageId: StageId = "plaza",
): PlacedObject[] {
  if (!isStageId(stageId)) throw new Error("ステージが見つかりません。");
  const stage: StageDefinition = STAGES[stageId];
  const scale = stageScaleForStage(stageId);
  const roads = roadsForStage(stageId);
  const mapHalfSize = mapHalfSizeForStage(stageId);
  const random = seededRandom(seed);
  const clusters = placementClusters(seed, stage.placement);
  const objects: PlacedObject[] =
    stageId === "office"
      ? [
          ...Array.from({ length: 8 }, (_, index) => ({
            id: "eraser-" + index,
            kind: "eraser" as const,
            x: 0.355 + (index % 2) * 0.11,
            z: 0.17 + Math.floor(index / 2) * 0.12,
            y: 0.014,
            yaw: 0,
          })),
          ...Array.from({ length: 2 }, (_, index) => ({
            id: "pencil-" + index,
            kind: "pencil" as const,
            x: 0.7,
            z: 0.25 + index * 0.3,
            y: 0.0115,
            yaw: 0,
          })),
        ]
      : [];
  // Tiny stationery must be discoverable from the office's close starting camera.
  const sites = objects.map((object) => ({
    x: object.x,
    z: object.z,
    footprint: objectFootprint(object.kind, stageId),
  }));
  for (const site of createSupplySites(seed, stageId)) {
    sites.push({
      x: site.x,
      z: site.z,
      footprint: Math.hypot(site.width, site.depth) / 2,
    });
    sites.push({
      x: site.outputX,
      z: site.outputZ,
      footprint: site.profile === "stationery" ? 0.25 : 3.2 * scale,
    });
  }
  const groups: readonly PlacementGroup[] = [
    { kind: stage.goal, count: 1, stacked: 0, layers: 1 },
    { kind: "streetSweeper", count: 1, stacked: 0, layers: 1 },
    ...stage.groups,
    { ...stage.moving, stacked: 0, layers: 1 },
  ];
  for (const group of groups) {
    for (let index = 0; index < group.count; index++) {
      if (
        stageId === "office" &&
        ((group.kind === "eraser" && index < 8) ||
          (group.kind === "pencil" && index < 2))
      )
        continue;
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
            : objectFootprint(group.kind, stageId);
        const road = roads[Math.floor(random() * roads.length)];
        const side = random() < 0.5 ? -1 : 1;
        const along =
          (random() * 2 - 1) * (mapHalfSize - footprint - 0.5 * scale);
        const across =
          road.position +
          side *
            (road.width / 2 + footprint + 0.4 * scale + random() * 7 * scale);
        let x = road.axis === "x" ? along : across;
        let z = road.axis === "z" ? along : across;
        const officeWorker =
          stageId === "office" && group.kind === "officeWorker";
        if (officeWorker) {
          // Staff start in the aisles; the narrow office shelves leave them no room roadside.
          x = road.axis === "x" ? along : road.position;
          z = road.axis === "z" ? along : road.position;
        }
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
          Math.abs(x) + footprint >= mapHalfSize ||
          Math.abs(z) + footprint >= mapHalfSize
        )
          continue;
        if (
          Math.hypot(x, z) <
          levelsForStage(stageId)[0].radius + footprint + 0.2 * scale
        )
          continue;
        if (
          stage.placement === "roadside" &&
          !officeWorker &&
          roads.some(
            (other) =>
              Math.abs((other.axis === "x" ? z : x) - other.position) <
              other.width / 2 + footprint + 0.2 * scale,
          )
        )
          continue;
        if (
          sites.some(
            (other) =>
              Math.hypot(x - other.x, z - other.z) <
              footprint + other.footprint + 0.2 * scale,
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
        const height = objectSizeForStage(group.kind, stageId)[1];
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
              y: height / 2 + 0.02 * scale + layer * (height + 0.025 * scale),
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
  private readonly levels: readonly GrowthLevel[];

  constructor(stageId: StageId = "plaza") {
    this.levels = levelsForStage(stageId);
  }

  collect(object: Pick<PlacedObject, "id" | "kind">): boolean {
    if (this.collected.has(object.id) || this.cleared) return false;
    this.collected.add(object.id);
    this.score += OBJECT_TYPES[object.kind].value;
    this.level = levelForScore(this.score, this.levels);
    if (object.id === "goal") this.cleared = true;
    return true;
  }
}
