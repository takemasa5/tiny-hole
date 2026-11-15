import type { GrowthObject } from "./growth-stage";
import type { SoundNote } from "./sound";
import type { DistrictKind } from "./district-catalog";

export type ObjectMaterial =
  | "paper"
  | "wood"
  | "metal"
  | "glass"
  | "soft"
  | "stone"
  | "toy"
  | "vehicle"
  | "living";
export type ObjectVoice =
  "human" | "hero" | "monster" | "robot" | "animal" | "ghost" | "demon";
export type FeedbackObject = Pick<
  GrowthObject,
  "id" | "model" | "kind" | "size" | "level" | "label"
> &
  Partial<
    Pick<
      GrowthObject,
      | "toyKind"
      | "districtKind"
      | "mountainKind"
      | "plazaKind"
      | "egyptKind"
      | "hellKind"
    >
  >;

const DISTRICT_MATERIALS: Record<DistrictKind, ObjectMaterial> = {
  crumb: "soft",
  fries: "soft",
  wrapper: "paper",
  cap: "metal",
  burger: "soft",
  hotdog: "soft",
  mug: "glass",
  ketchup: "soft",
  stool: "wood",
  booth: "soft",
  dinerTable: "wood",
  griddle: "metal",
  counter: "wood",
  fridge: "metal",
  customer: "living",
  car: "vehicle",
  deliveryVan: "vehicle",
  trafficCone: "toy",
  tire: "soft",
  diner: "stone",
  shop: "stone",
  apartment: "stone",
  skyscraper: "stone",
  palm: "wood",
  lamp: "metal",
  construction: "metal",
  liberty: "metal",
  boat: "vehicle",
  nut: "metal",
  bolt: "metal",
  washer: "metal",
  wrench: "metal",
  screwdriver: "metal",
  rope: "soft",
  buoy: "soft",
  crate: "wood",
  barrel: "wood",
  pallet: "wood",
  workbench: "wood",
  forklift: "vehicle",
  container: "metal",
  warehouse: "stone",
  crane: "metal",
  hoistLoad: "wood",
  dockWorker: "living",
  tanker: "vehicle",
  clip: "metal",
  pushpin: "metal",
  eraser: "soft",
  pencil: "wood",
  stapler: "metal",
  documents: "paper",
  tape: "soft",
  keyboard: "toy",
  monitor: "toy",
  officeChair: "metal",
  desk: "wood",
  cabinet: "metal",
  copier: "metal",
  meetingTable: "wood",
  sofa: "soft",
  officeWorker: "living",
  meetingRoom: "wood",
  officeAnnex: "stone",
  officeTower: "stone",
  headOffice: "stone",
  cart: "vehicle",
};

export function objectFeedback(object: FeedbackObject) {
  const kind =
    object.toyKind ??
    object.districtKind ??
    object.mountainKind ??
    object.plazaKind ??
    object.egyptKind ??
    object.hellKind ??
    object.model;
  const tag = `${kind} ${object.kind} ${object.label}`.toLowerCase();
  const voiceTag = `${kind} ${object.kind}`.toLowerCase();
  let material: ObjectMaterial = "toy";
  let voice: ObjectVoice | undefined;
  if (object.model === "hero") voice = "hero";
  else if (object.model === "monster" || /sphinx|sobek|怪獣/.test(voiceTag))
    voice = "monster";
  else if (/robot|ロボット/.test(voiceTag)) voice = "robot";
  else if (/ghost|亡者/.test(voiceTag)) voice = "ghost";
  else if (/smalloni|redoni|blueoni|enma|\boni\b|anubis|horus/.test(voiceTag))
    voice = "demon";
  else if (
    /tanuki|fox|deer|camel|bird|たぬき|鹿|きつね|ラクダ|鳥/.test(voiceTag)
  )
    voice = "animal";
  else if (
    /person|american|egyptian|worker|employee|president|priest|doll|soldier|人形|人間|社員|社長|神官|兵隊/.test(
      tag,
    )
  )
    voice = "human";
  if (voice) material = voice === "robot" ? "metal" : "living";
  else if (
    /paper|documents|book|note|burgerbox|carton|紙|本|ノート|書類|段ボール/.test(
      tag,
    )
  )
    material = "paper";
  else if (
    /truck|\b(?:mini)?car\b|bus|van|train|tanker|bike|車|バス|汽車|タンカー/.test(
      tag,
    )
  )
    material = "vehicle";
  else if (
    /glass|jar|bead|bottle|cup|marble|ガラス|ビー玉|瓶|コップ|つぼ/.test(tag)
  )
    material = "glass";
  else if (
    /log|wood|twig|stump|pine|oak|tree\b|chair|desk|table|bench|pencil|chest|crate|鳥居|木|丸太|枝|椅子|机|積み木/.test(
      tag,
    )
  )
    material = "wood";
  else if (
    /metal|nut|stapler|crane|container|kettle|lamp|can|tower|machine|トレー|金属|釘|ボルト|コンテナ|クレーン|工場|電波塔/.test(
      tag,
    )
  )
    material = "metal";
  else if (
    /stone|rock|pebble|pyramid|column|building|house|apartment|palace|hall|石|岩|家|ビル|庁|神殿|建物/.test(
      tag,
    )
  )
    material = "stone";
  else if (
    /leaf|flower|petal|fern|mushroom|teddy|sofa|bed|burger|food|草|花|葉|ぬいぐるみ|パン|食/.test(
      tag,
    )
  )
    material = "soft";
  if (!voice && object.districtKind)
    material = DISTRICT_MATERIALS[object.districtKind];
  const colors: Record<ObjectMaterial, string> = {
    paper: "#ffdb8f",
    wood: "#ffaf64",
    metal: "#a3e8ff",
    glass: "#77fff2",
    soft: "#ffb7da",
    stone: "#c6b8ff",
    toy: "#ffd45f",
    vehicle: "#ff9875",
    living: "#ffdbf5",
  };
  return { material, voice, color: colors[material] };
}

export function objectPickupNotes(
  object: FeedbackObject,
  combo: number,
): SoundNote[] {
  const { material } = objectFeedback(object);
  const base: Record<ObjectMaterial, number> = {
    paper: 580,
    wood: 310,
    metal: 840,
    glass: 1230,
    soft: 230,
    stone: 135,
    toy: 720,
    vehicle: 175,
    living: 460,
  };
  const size = Math.max(1, ...object.size);
  const pitch = Math.max(0.5, 1 - Math.log10(size) * 0.13);
  const frequency = base[material] * pitch;
  const tones: SoundNote[] = [
    {
      frequency,
      endFrequency:
        frequency * (material === "glass" || material === "metal" ? 0.85 : 0.4),
      duration: material === "glass" ? 0.3 : material === "stone" ? 0.22 : 0.15,
      delay: 0,
      gain: material === "stone" ? 0.15 : 0.095,
      type: ["metal", "toy", "wood"].includes(material) ? "triangle" : "sine",
    },
  ];
  if (["glass", "metal", "toy"].includes(material))
    tones.push({
      frequency: frequency * 1.5,
      endFrequency: frequency * 1.48,
      duration: 0.22,
      delay: 0.025,
      gain: 0.045,
      type: "sine",
    });
  if (combo >= 3) {
    const reward =
      523.25 * 2 ** ([0, 4, 7, 9, 12][Math.min(4, Math.floor(combo / 3))] / 12);
    tones.push({
      frequency: reward,
      endFrequency: reward,
      delay: 0.04,
      duration: 0.17,
      gain: 0.055,
      type: "triangle",
    });
  }
  return tones;
}

export class PickupCombo {
  private last = -Infinity;
  private count = 0;

  collect(now: number, amount = 1) {
    this.count = now - this.last <= 2.2 ? this.count + amount : amount;
    this.last = now;
    return this.count;
  }

  value(now: number) {
    return now - this.last <= 2.2 ? this.count : 0;
  }
}
