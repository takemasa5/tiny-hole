import "../src/style.css";
import {
  startGame,
  type GameControls,
  type RenderDiagnosticMode,
} from "../src/game/runtime";

if (!import.meta.env.DEV) throw new Error("開発サーバー専用の確認画面です。");
const modes: readonly RenderDiagnosticMode[] = [
  "normal",
  "no-occlusion",
  "precise-depth",
  "no-antialias",
  "plain-floor",
];
const buttons = [
  ...document.querySelectorAll<HTMLButtonElement>("[data-mode]"),
];
const state =
  document.querySelector<HTMLParagraphElement>("#diagnostic-state")!;
const panel = document.querySelector<HTMLDetailsElement>(".diagnostic-panel")!;
const summary = document.querySelector<HTMLElement>("#diagnostic-summary")!;
let canvas = document.querySelector<HTMLCanvasElement>("canvas")!;
let controls: GameControls | undefined;
let disposed = false;
let selectedMode: RenderDiagnosticMode = "normal";
function release() {
  if (!controls) return;
  controls.dispose();
  controls = undefined;
  canvas
    .getContext("webgl2")
    ?.getExtension("WEBGL_lose_context")
    ?.loseContext();
}
const style = document.createElement("style");
style.textContent = `
.diagnostic-panel { position:absolute; top:max(10px,env(safe-area-inset-top)); left:10px; right:10px; padding:10px; border-radius:12px; background:#fffaf2ed; color:#293c50; }
.diagnostic-panel:not([open]) { right:auto; }
.diagnostic-panel summary { min-height:24px; font-size:14px; }
.diagnostic-panel strong { display:block; margin-top:6px; }
.diagnostic-panel p { margin:6px 0; font-size:13px; }
.diagnostic-panel small { display:block; font-size:11px; line-height:1.5; }
.diagnostic-panel a { display:inline-block; margin-top:6px; color:#2758a5; font-size:12px; }
.diagnostic-buttons { display:flex; flex-wrap:wrap; gap:5px; }
.diagnostic-buttons button { min-height:40px; border:1px solid #c5ccda; border-radius:8px; background:#fff; color:#293c50; padding:6px 9px; font-size:13px; }
.diagnostic-buttons button[aria-pressed="true"] { background:#d9e8ff; border-color:#3a69a8; }
`;
document.head.append(style);
async function choose(mode: RenderDiagnosticMode) {
  selectedMode = mode;
  buttons.forEach((button) => {
    button.disabled = true;
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
  });
  release();
  // A WebGL context keeps its original MSAA setting, so each comparison needs a fresh canvas.
  const next = canvas.cloneNode(false) as HTMLCanvasElement;
  delete next.dataset.mode;
  delete next.dataset.error;
  canvas.replaceWith(next);
  canvas = next;
  state.textContent = "準備中…";
  try {
    const controller = await startGame(
      canvas,
      () => {},
      (message) => {
        state.textContent = message;
      },
      false,
      "toys",
      { mode, seed: 42 },
    );
    if (disposed) {
      controller.dispose();
      return;
    }
    controls = controller;
    const label = buttons.find((b) => b.dataset.mode === mode)!.textContent;
    state.textContent = `${label}・同じ配置で比較できます`;
    summary.textContent = `診断1・${label}`;
    panel.open = false;
    canvas.dataset.mode = mode;
  } catch (error) {
    state.textContent = error instanceof Error ? error.message : String(error);
    canvas.dataset.error = "true";
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
}
for (const button of buttons)
  button.addEventListener("click", () => {
    const mode = button.dataset.mode;
    if (modes.includes(mode as RenderDiagnosticMode))
      void choose(mode as RenderDiagnosticMode);
  });
window.addEventListener("pagehide", () => {
  disposed = true;
  release();
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    disposed = false;
    void choose(selectedMode);
  }
});
void choose("normal");
