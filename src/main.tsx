import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { startGame, type GameControls, type GameStatus } from "./game/runtime";
import { STAGES, STAGE_IDS, isStageId, type StageId } from "./game/stage";
import "./style.css";
import { nextStageId, STAGE_TRANSITION_DELAY } from "./game/stage-flow";
import { OfflinePanel } from "./offline/OfflinePanel";
import { goalForGrowth } from "./game/growth-stage";

function App() {
  const shell = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const controls = useRef<GameControls | null>(null);
  const soundPreference = useRef(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [stageId, setStageId] = useState<StageId>("plaza");
  const stage = STAGES[stageId];
  const goalLabel = goalForGrowth(stageId).label;
  const [session, setSession] = useState(0);
  const [status, setStatus] = useState<GameStatus | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = shell.current;
    if (!element) return;
    const abort = new AbortController();
    const suppressBrowserGesture = (event: Event) => event.preventDefault();
    // Native selection and callouts can interrupt a game drag, including through HUD text.
    for (const type of ["selectstart", "contextmenu", "dragstart"])
      element.addEventListener(type, suppressBrowserGesture, {
        signal: abort.signal,
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    let cancelled = false;
    let dispose: (() => void) | undefined;
    setStatus(null);
    setError("");
    if (canvas.current)
      startGame(
        canvas.current,
        (next) => {
          if (!cancelled) setStatus(next);
        },
        (message) => {
          if (!cancelled) setError(message);
        },
        soundPreference.current,
        stageId,
      )
        .then((controller) => {
          if (cancelled) controller.dispose();
          else {
            controls.current = controller;
            dispose = controller.dispose;
          }
        })
        .catch((cause: unknown) => {
          if (!cancelled)
            setError(
              cause instanceof Error
                ? cause.message
                : "ゲームを読み込めませんでした。",
            );
        });
    return () => {
      cancelled = true;
      controls.current = null;
      dispose?.();
    };
  }, [session, stageId]);
  useEffect(() => {
    if (!status?.cleared || error) return;
    const timeout = window.setTimeout(
      () => setStageId(nextStageId(stageId)),
      STAGE_TRANSITION_DELAY,
    );
    return () => window.clearTimeout(timeout);
  }, [status?.cleared, stageId, session, error]);
  return (
    <main ref={shell} className="game-shell">
      <canvas
        ref={canvas}
        aria-label="ドラッグ・WASD・矢印キーで穴を動かす3Dゲーム"
      />
      <header className="play-header">
        <section className="stage-controls">
          <select
            aria-label="ステージ"
            value={stageId}
            onChange={(event) => {
              const value = event.target.value;
              if (isStageId(value)) setStageId(value);
              event.target.blur();
            }}
          >
            {STAGE_IDS.map((id) => (
              <option key={id} value={id}>
                {STAGES[id].menuLabel}
              </option>
            ))}
          </select>
          <p className="goal-label">
            <span aria-hidden="true">◇</span> 目標：{goalLabel}
          </p>
        </section>
        <details className="game-options">
          <summary aria-label="メニュー">⋯</summary>
          <div className="options-panel">
            <button
              aria-label={soundEnabled ? "効果音を消す" : "効果音をつける"}
              aria-pressed={soundEnabled}
              onClick={() => {
                const enabled = !soundPreference.current;
                soundPreference.current = enabled;
                setSoundEnabled(enabled);
                controls.current?.setSoundEnabled(enabled);
              }}
            >
              {soundEnabled ? "音 ON" : "音 OFF"}
            </button>
            <button
              aria-label="最初から遊ぶ"
              onClick={() => setSession((value) => value + 1)}
            >
              最初から遊ぶ
            </button>
            <OfflinePanel />
          </div>
        </details>
      </header>
      {status?.boundaryHint && (
        <p className="boundary-notice" role="status">
          {status.boundaryHint}
        </p>
      )}
      {status?.audioError && (
        <p className="audio-notice" role="status">
          {status.audioError}
        </p>
      )}
      {(!status || error) && (
        <div className="loading-overlay" role={error ? "alert" : "status"}>
          <div>
            <span className="loading-hole" />
            <h2>
              {error
                ? "読み込みを確認してください"
                : stage.menuLabel + "を準備しています"}
            </h2>
            <p>{error || "もう少しで、世界をひと飲み。"}</p>
            {error && (
              <button onClick={() => setSession((value) => value + 1)}>
                もう一度読み込む
              </button>
            )}
          </div>
        </div>
      )}
      {status?.cleared && (
        <div className="clear-overlay">
          <section className="clear-card">
            <div className="clear-mark">◇</div>
            <h2>
              {stageId === "office"
                ? "本社ビルまで、ひと飲み。"
                : stageId === "harbor"
                  ? "タンカーまで、ひと飲み。"
                  : stage.clearTitle}
            </h2>
            <p>{goalLabel}まで飲み込みました！</p>
            <select
              aria-label="クリア後のステージ"
              value={stageId}
              onChange={(event) => {
                const value = event.target.value;
                if (isStageId(value)) setStageId(value);
              }}
            >
              {STAGE_IDS.map((id) => (
                <option key={id} value={id}>
                  {STAGES[id].menuLabel}
                </option>
              ))}
            </select>
            <button onClick={() => setSession((value) => value + 1)}>
              もう一度遊ぶ
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
