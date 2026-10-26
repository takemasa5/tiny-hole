import { useEffect, useRef, useState } from "react";
import { prepareOffline, type OfflineState } from "./register";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
}

export function OfflinePanel() {
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<ReturnType<typeof prepareOffline> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [installError, setInstallError] = useState("");
  const [state, setState] = useState<OfflineState>({
    status: "saving",
    message: "オフライン用に保存中…",
    updateAvailable: false,
  });
  useEffect(() => {
    controller.current = prepareOffline(setState);
    return () => controller.current?.dispose();
  }, [attempt]);
  useEffect(() => {
    const capture = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallPrompt);
    };
    const installed = () => setInstall(null);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  return (
    <div className="offline-entry">
      <button
        className={`offline-status offline-${state.status}`}
        onClick={() => dialog.current?.showModal()}
        aria-label="オフライン保存の案内"
      >
        <span data-testid="offline-status" data-state={state.status}>
          {state.message}
        </span>
        {state.updateAvailable && "・新版あり"}
      </button>
      <dialog
        ref={dialog}
        className="offline-help"
        aria-labelledby="offline-title"
      >
        <h2 id="offline-title">どこでも、ひと飲み。</h2>
        <p role="status">{state.message}</p>
        <p>
          「オフライン準備完了」と表示されたら、サーバーに接続せず、4ステージと効果音で遊べます。
        </p>
        <p>
          <strong>iPhone</strong>
          <br />
          Safariの共有メニューから「ホーム画面に追加」を選び、追加したアイコンから開いて準備完了を確認してください。
        </p>
        <p>
          <strong>PC</strong>
          <br />
          ブラウザの「アプリをインストール」または「Dockに追加」で保存できます。
        </p>
        <p className="offline-note">
          初回の保存には通信が必要です。端末の空き容量不足や保存データの削除で、再保存が必要になる場合があります。プレイの途中経過は保存されません。
        </p>
        {state.status === "failed" && (
          <button
            onClick={() => {
              setState({
                status: "saving",
                message: "オフライン用に保存中…",
                updateAvailable: false,
              });
              setAttempt((value) => value + 1);
            }}
          >
            保存を再試行
          </button>
        )}
        {state.status === "ready" && install && (
          <button
            onClick={async () => {
              try {
                await install.prompt();
                setInstall(null);
              } catch {
                setInstallError("ブラウザのメニューから保存してください。");
              }
            }}
          >
            この端末にアプリを保存
          </button>
        )}
        {installError && <p role="status">{installError}</p>}
        {state.updateAvailable && (
          <>
            <p>
              新しい版を保存済みです。更新するとゲームは最初から始まります。
            </p>
            <button onClick={() => controller.current?.update()}>
              新版に更新して再起動
            </button>
          </>
        )}
        <button
          className="offline-close"
          onClick={() => dialog.current?.close()}
        >
          閉じて遊ぶ
        </button>
      </dialog>
    </div>
  );
}
