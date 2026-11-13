import type { ObjectKind } from "./stage";
import type { PlazaKind } from "./plaza-visuals";
import type { FurnitureKind } from "./furniture-visuals";
export interface DistrictItem {
  label: string;
  original?: ObjectKind;
  plaza?: PlazaKind;
  furniture?: FurnitureKind;
  height?: number;
  actor?: boolean;
  vehicle?: boolean;
}
const CATALOG = {
  crumb: { label: "パンくず", height: 0.3 },
  fries: { label: "ポテト", height: 0.2 },
  wrapper: { label: "包み紙", height: 0.1 },
  cap: { label: "瓶の王冠", height: 0.25 },
  burger: { label: "ハンバーガー", original: "burger" },
  hotdog: { label: "ホットドッグ", original: "hotdog", height: 0.5 },
  mug: { label: "マグカップ" },
  ketchup: { label: "ケチャップ", height: 1.7 },
  stool: { label: "ダイナーの椅子", furniture: "chair", height: 1.4 },
  booth: { label: "赤いボックス席", furniture: "sofa" },
  dinerTable: { label: "ダイナーのテーブル", furniture: "table" },
  griddle: { label: "鉄板コンロ" },
  counter: { label: "カウンター", furniture: "counter" },
  fridge: { label: "冷蔵庫", furniture: "fridge", height: 2 },
  customer: {
    label: "買い物をする人",
    plaza: "person",
    actor: true,
    height: 2,
  },
  car: { label: "車", original: "car", vehicle: true, height: 0.7 },
  deliveryVan: { label: "配達車", plaza: "van", vehicle: true },
  trafficCone: { label: "三角コーン" },
  tire: { label: "タイヤ", original: "tire", height: 0.35 },
  diner: { label: "ダイナーの店", height: 1.4 },
  shop: { label: "店舗", plaza: "shop", height: 1.8 },
  apartment: { label: "街のビル", plaza: "apartment", height: 3 },
  skyscraper: { label: "高層ビル", plaza: "apartment", height: 4.5 },
  palm: { label: "街路樹", plaza: "tree", height: 2.5 },
  lamp: { label: "街灯", plaza: "lamp", height: 3 },
  construction: { label: "工事現場の鉄骨", height: 2 },
  liberty: { label: "自由の女神", height: 3 },
  boat: { label: "停泊する小舟", height: 0.6 },
  nut: { label: "ナット", height: 0.4 },
  bolt: { label: "ボルト", height: 0.3 },
  washer: { label: "ワッシャー", height: 0.15 },
  wrench: { label: "スパナ", height: 0.2 },
  screwdriver: { label: "ドライバー", height: 0.2 },
  rope: { label: "ロープ", height: 0.3 },
  buoy: { label: "浮き", original: "buoy" },
  crate: { label: "荷物の木箱", original: "cargoCrate" },
  barrel: { label: "樽", original: "barrel" },
  pallet: { label: "パレット", height: 0.35 },
  workbench: { label: "作業台", furniture: "table" },
  forklift: { label: "フォークリフト", vehicle: true, height: 1.4 },
  container: { label: "コンテナ", original: "container" },
  warehouse: { label: "倉庫", height: 1.5 },
  crane: { label: "荷役クレーン", height: 3 },
  hoistLoad: { label: "クレーンの吊り荷", original: "cargoCrate" },
  dockWorker: {
    label: "港の作業員",
    original: "dockWorker",
    actor: true,
    height: 2,
  },
  tanker: { label: "タンカー", height: 0.5 },
  clip: { label: "クリップ", height: 0.15 },
  pushpin: { label: "画鋲", height: 0.7 },
  eraser: { label: "消しゴム", original: "eraser", height: 0.5 },
  pencil: { label: "鉛筆", original: "pencil", height: 0.15 },
  stapler: { label: "ホチキス", original: "stapler" },
  documents: { label: "書類", original: "documents", height: 0.2 },
  tape: { label: "セロハンテープ", height: 0.35 },
  keyboard: { label: "キーボード", height: 0.15 },
  monitor: { label: "モニター", height: 1.3 },
  officeChair: { label: "事務椅子", original: "officeChair", height: 1.6 },
  desk: { label: "机", original: "officeDesk" },
  cabinet: { label: "書類棚", original: "filingCabinet", height: 2.5 },
  copier: { label: "複合機", original: "copier", height: 1.5 },
  meetingTable: { label: "会議卓", furniture: "table", height: 0.6 },
  sofa: { label: "応接ソファ", furniture: "sofa" },
  officeWorker: {
    label: "社員",
    original: "officeWorker",
    actor: true,
    height: 2,
  },
  meetingRoom: { label: "会議室の設備", height: 1.4 },
  officeAnnex: { label: "別館", plaza: "shop", height: 1.4 },
  officeTower: { label: "オフィスビル", plaza: "apartment", height: 3.5 },
  headOffice: { label: "巨大な本社ビル", height: 3.5 },
  cart: { label: "搬入台車", vehicle: true, height: 0.8 },
} as const satisfies Record<string, DistrictItem>;
export type DistrictKind = keyof typeof CATALOG;
export function districtItem(kind: DistrictKind): DistrictItem {
  return CATALOG[kind];
}
