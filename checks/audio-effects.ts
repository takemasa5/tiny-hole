import { GameSounds } from "../src/game/sound";
import { MUSIC_STYLES } from "../src/game/music";
import { createGrowthStage } from "../src/game/growth-stage";
import { STAGE_IDS, STAGES, type StageId } from "../src/game/stage";
import type { FeedbackObject } from "../src/game/object-feedback";
if (!import.meta.env.DEV) throw new Error("開発サーバー専用の確認画面です。");
const style = document.createElement("style");
style.textContent =
  "body{font:17px system-ui;background:#faf1df;color:#263745;margin:0;padding:24px}main{max-width:860px;margin:auto}button,select{font:inherit;padding:12px;margin:6px;border:1px solid #b5c1c6;border-radius:10px;background:white;cursor:pointer}a{color:#205ca1}#effects{display:flex;flex-wrap:wrap}h2{margin-top:32px}#state{min-height:50px}";
document.head.append(style);
const select = document.querySelector<HTMLSelectElement>("#stage")!;
const state = document.querySelector<HTMLElement>("#state")!;
const container = document.querySelector("#effects")!;
let stage: StageId = "toys";
let sounds: GameSounds;
function reset() {
  sounds?.dispose();
  sounds = new GameSounds(
    true,
    (message) => {
      if (message) state.textContent = message;
    },
    stage === "america",
    stage,
  );
  state.textContent = `${MUSIC_STYLES[stage].title} · ${MUSIC_STYLES[stage].tempo} BPM`;
}
for (const id of STAGE_IDS) {
  const option = document.createElement("option");
  option.value = id;
  option.textContent = STAGES[id].menuLabel;
  select.append(option);
}
select.value = stage;
select.addEventListener("change", () => {
  stage = select.value as StageId;
  reset();
});
document.querySelector("#start")!.addEventListener("click", () => {
  sounds.setEnabled(true);
  sounds.setMusicEnabled(true);
});
document.querySelector("#stop")!.addEventListener("click", () => {
  sounds.setEnabled(false);
});
function button(label: string, run: () => void) {
  const element = document.createElement("button");
  element.textContent = label;
  element.addEventListener("click", () => {
    sounds.setMusicEnabled(false);
    sounds.setEnabled(true);
    requestAnimationFrame(run);
  });
  container.append(element);
}
const toys = createGrowthStage(42, "toys");
const sample = toys[0];
for (const [label, tag] of [
  ["紙の回収", "paper"],
  ["木の回収", "wood"],
  ["金属の回収", "metal"],
  ["ガラスの回収", "glass"],
  ["石・建物の回収", "stone"],
]) {
  const object: FeedbackObject = {
    ...sample,
    model: "original",
    kind: "house",
    toyKind: undefined,
    label: tag,
  };
  button(label, () => {
    sounds.playObject("pickup", object);
  });
}
for (const id of ["hero", "monster"]) {
  const object = toys.find((o) => o.id === id)!;
  button(id === "hero" ? "ヒーローの逃げ声" : "怪獣の逃げ声", () => {
    sounds.playObject("flee", object);
  });
}
for (const [label, tag] of [
  ["人の逃げ声", "person"],
  ["動物の鳴き声", "tanuki"],
  ["ロボットの声", "giantRobot"],
  ["鬼の声", "oni"],
  ["亡者の声", "hungryGhost"],
] as const) {
  const object: FeedbackObject = {
    ...sample,
    id: tag,
    model: "original",
    kind: tag,
    toyKind: undefined,
    label: tag,
  };
  button(label, () => {
    sounds.playObject("flee", object);
  });
}
button("連続回収", () => {
  sounds.playObject("pickup", sample, 9);
});
button("ドアが開く", () => {
  sounds.play("doorOpen", 5);
});
button("成長", () => {
  sounds.play("growth", 5);
});
button("クリア", () => {
  sounds.play("clear", 12);
});
reset();
Object.assign(window, { __audioTrial: { snapshot: () => sounds.snapshot() } });
document.addEventListener("visibilitychange", () =>
  sounds.setPaused(document.hidden),
);
window.addEventListener("pagehide", () => sounds.dispose(), { once: true });
