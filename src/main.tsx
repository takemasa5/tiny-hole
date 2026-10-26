import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { startGame, type GameControls, type GameStatus } from "./game/runtime";
import {
  LEVELS,
  STAGES,
  STAGE_IDS,
  OBJECT_TYPES,
  isStageId,
  type StageId,
} from "./game/stage";
import "./style.css";
import { nextStageId, STAGE_TRANSITION_DELAY } from "./game/stage-flow";
import { OfflinePanel } from "./offline/OfflinePanel";

function App() {
  const shell = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const controls = useRef<GameControls | null>(null);
  const soundPreference = useRef(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [stageId, setStageId] = useState<StageId>("plaza");
  const stage = STAGES[stageId];
  const goalLabel = OBJECT_TYPES[stage.goal].label;
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
  const level = status?.level ?? 1;
  const current = LEVELS[level - 1];
  const next = LEVELS[level];
  const completion =
    next && status
      ? Math.min(
          100,
          ((status.score - current.threshold) /
            (next.threshold - current.threshold)) *
            100,
        )
      : status
        ? 100
        : 0;
  return (
    <main ref={shell} className="game-shell">
      <canvas
        ref={canvas}
        aria-label="ドラッグ・WASD・矢印キーで穴を動かす3Dゲーム"
      />
      <header className="topbar">
        <div className="brand">
          HOLE<span>小さな穴、大きな世界。</span>
          <OfflinePanel />
        </div>
        <div className="topbar-actions">
          <button
            className="sound-toggle"
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
            className="restart"
            onClick={() => setSession((value) => value + 1)}
            aria-label="最初から遊ぶ"
          >
            ↻
          </button>
        </div>
      </header>
      <section className="stage-card">
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
        <h1>{stage.name}</h1>
        <p>
          <span className="goal-symbol">◇</span> 目標：{goalLabel}を飲み込む
        </p>
        <p>{goalLabel}をタップすると置き直せます</p>
      </section>
      {status?.lastObject && (
        <div className="pickup" key={status.collected}>
          {status.lastObject}を飲み込んだ <span>＋</span>
        </div>
      )}
      {!!status?.growthEvents && (
        <div
          className="level-up"
          key={`${stageId}-${session}-${status.growthEvents}`}
          role="status"
        >
          <small>LEVEL UP!</small>
          <strong>LEVEL {level.toString().padStart(2, "0")}</strong>
          <span>もっと大きな物を、ひと飲み！</span>
        </div>
      )}
      {status?.audioError && (
        <p className="audio-notice" role="status">
          {status.audioError}
        </p>
      )}
      <footer className="bottom-ui">
        {!status?.moved && (
          <p className="hint">
            <span>↔</span> ドラッグして、穴を動かそう
            <small className="keyboard-hint">
              WASD / 矢印キーでも移動できます
            </small>
          </p>
        )}
        <div
          className={`growth-card${level > 1 ? " growth-celebrate" : ""}`}
          key={`${stageId}-${session}-${level}`}
        >
          <div className="level-badge">
            <small>LEVEL / {LEVELS.length}</small>
            <strong data-testid="level">
              {level.toString().padStart(2, "0")}
            </strong>
          </div>
          <div className="growth-info">
            <div className="growth-label">
              <span>{next ? "次の大きさへ" : "大きな物も、ひと飲み。"}</span>
              <span>{status?.collected ?? 0} 個</span>
            </div>
            <div className="progress-track">
              <div style={{ width: `${completion}%` }} />
            </div>
            <small>
              {next
                ? `あと ${Math.max(0, next.threshold - (status?.score ?? 0))} ポイント`
                : `${goalLabel}を探そう`}
              <span>時間制限なし</span>
            </small>
          </div>
        </div>
      </footer>
      {(!status || error) && (
        <div className="loading-overlay" role={error ? "alert" : "status"}>
          <div>
            <span className="loading-hole" />
            <h2>
              {error
                ? "読み込みを確認してください"
                : `${stage.menuLabel}を準備しています`}
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
            <div className="eyebrow">STAGE COMPLETE</div>
            <div className="clear-mark">◇</div>
            <h2>{stage.clearTitle}</h2>
            <p>{goalLabel}まで飲み込みました！</p>
            <p>
              約3秒後に「{STAGES[nextStageId(stageId)].menuLabel}」へ進みます
            </p>
            <div className="clear-count">
              {status.collected}
              <span>個のオブジェクト</span>
            </div>
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
              もう一度遊ぶ <span>↗</span>
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
