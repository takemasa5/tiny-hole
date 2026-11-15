import "../src/style.css";
import { startGame, type GameControls } from "../src/game/runtime";

if (!import.meta.env.DEV) throw new Error("開発サーバー専用の確認画面です。");
const state = document.querySelector<HTMLElement>("#battle-state")!;
const button = document.querySelector<HTMLButtonElement>("#restart")!;
const parameters = new URLSearchParams(location.search);
const seed = Number(parameters.get("seed") ?? 42);
const selectedLevel = Number(parameters.get("level") ?? 10);
if (![9, 10, 11].includes(selectedLevel))
  throw new Error("確認レベルは9・10・11を指定してください。");
const battleLevel = selectedLevel as 9 | 10 | 11;
document.querySelector("#battle-description")!.textContent =
  `実際のおもちゃステージをレベル${battleLevel}から開始する開発用画面です。`;
let canvas = document.querySelector<HTMLCanvasElement>("canvas")!;
let controls: GameControls | undefined;
const style = document.createElement("style");
style.textContent = `
.battle-panel { position:absolute;top:12px;left:12px;max-width:470px;background:#fffaf2ed;border-radius:12px;padding:12px 16px;color:#293c50;font:14px sans-serif; }
.battle-panel p { margin:8px 0; }
.battle-panel button { padding:8px 12px;border:1px solid #adb8ba;border-radius:8px;background:white;cursor:pointer; }
.battle-panel a { margin-left:12px;color:#2758a5; }
`;
document.head.append(style);
async function restart() {
  button.disabled = true;
  controls?.dispose();
  controls = undefined;
  canvas
    .getContext("webgl2")
    ?.getExtension("WEBGL_lose_context")
    ?.loseContext();
  const next = canvas.cloneNode(false) as HTMLCanvasElement;
  canvas.replaceWith(next);
  canvas = next;
  state.textContent = "準備中…";
  try {
    controls = await startGame(
      canvas,
      () => {},
      (message) => {
        state.textContent = message;
      },
      false,
      "toys",
      { mode: "normal", seed, scenario: "toy-battle", battleLevel },
    );
    state.textContent =
      "その場で両腕を交互に振ります。レベル11では穴が近づくと両腕を上げて逃げます。WASD・矢印キーで穴を操作できます。";
  } catch (error) {
    state.textContent =
      error instanceof Error ? error.message : "起動できませんでした。";
    throw error;
  } finally {
    button.disabled = false;
  }
}
button.addEventListener("click", () => {
  void restart();
});
window.addEventListener(
  "pagehide",
  () => {
    controls?.dispose();
  },
  { once: true },
);
void restart();
