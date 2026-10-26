export interface OfflineState {
  status: "saving" | "ready" | "failed" | "unavailable";
  message: string;
  updateAvailable: boolean;
}

function saved(worker: ServiceWorker): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error("保存状態の確認がタイムアウトしました。"));
    }, 8000);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout);
      channel.port1.close();
      resolve(event.data?.ready === true);
    };
    worker.postMessage({ type: "CHECK_OFFLINE_READY" }, [channel.port2]);
  });
}

export function prepareOffline(onChange: (state: OfflineState) => void) {
  let disposed = false;
  let registration: ServiceWorkerRegistration | undefined;
  let updating = false;
  let state: OfflineState = {
    status: "saving",
    message: "オフライン用に保存中…",
    updateAvailable: false,
  };
  const abort = new AbortController();
  const publish = (next: Omit<OfflineState, "updateAvailable">) => {
    state = { ...next, updateAvailable: !!registration?.waiting };
    if (!disposed) onChange(state);
  };
  const failed = () =>
    publish({
      status: "failed",
      message: "保存できませんでした。通信を確認して再試行してください。",
    });
  async function check() {
    const worker = registration?.active;
    if (!worker) return;
    try {
      if (await saved(worker))
        publish({ status: "ready", message: "オフライン準備完了" });
      else failed();
    } catch {
      failed();
    }
  }
  function watch(worker: ServiceWorker) {
    const changed = () => {
      if (worker.state === "activated") void check();
      if (worker.state === "installed" && registration?.active) publish(state);
      if (worker.state === "redundant" && !registration?.active) failed();
    };
    worker.addEventListener("statechange", changed, { signal: abort.signal });
    changed();
  }
  async function start() {
    if (!import.meta.env.PROD) {
      publish({
        status: "unavailable",
        message: "オフライン保存は公開版で利用できます",
      });
      return;
    }
    if (!window.isSecureContext) {
      publish({
        status: "unavailable",
        message: "保存にはHTTPSで開く必要があります",
      });
      return;
    }
    if (!("serviceWorker" in navigator)) {
      publish({
        status: "unavailable",
        message: "このブラウザはオフライン保存に対応していません",
      });
      return;
    }
    try {
      registration = await navigator.serviceWorker.register(
        new URL("sw.js", new URL(import.meta.env.BASE_URL, document.baseURI)),
        { scope: import.meta.env.BASE_URL, updateViaCache: "none" },
      );
      if (disposed) return;
      registration.addEventListener(
        "updatefound",
        () => {
          if (registration?.installing) watch(registration.installing);
        },
        { signal: abort.signal },
      );
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
          if (updating) window.location.reload();
          else void check();
        },
        { signal: abort.signal },
      );
      if (registration.installing) watch(registration.installing);
      if (registration.active) await check();
    } catch {
      if (!disposed) failed();
    }
  }
  void start();
  return {
    update() {
      if (!registration?.waiting) return;
      updating = true;
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    },
    dispose() {
      disposed = true;
      abort.abort();
    },
  };
}
