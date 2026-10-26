import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

const scope = "https://game.invalid/tiny-hole/";
const prefix = "tiny-hole:/tiny-hole/:";
const assets = [
  "./",
  "./index.html",
  "./bundle.js",
  "./audio/american-fall.wav",
];

function worker(failDownload = false) {
  const stores = new Map();
  const handlers = new Map();
  const claim = vi.fn(async () => {});
  const skipWaiting = vi.fn(async () => {});
  const fetch = vi.fn(async () => {
    throw new Error("Network is offline");
  });
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async addAll(requests) {
          if (failDownload) throw new Error("An asset failed to download");
          for (const request of requests)
            store.set(request.url, new Response("asset:" + request.url));
        },
        async match(request) {
          return store
            .get(typeof request === "string" ? request : request.url)
            ?.clone();
        },
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name) {
      return stores.delete(name);
    },
  };
  runInNewContext(
    readFileSync(new URL("../src/offline/worker.js", import.meta.url), "utf8"),
    {
      __PRECACHE__: assets,
      __BUILD_ID__: "current",
      caches,
      URL,
      Request,
      fetch,
      self: {
        registration: { scope },
        clients: { claim },
        skipWaiting,
        addEventListener(type, handler) {
          handlers.set(type, handler);
        },
      },
    },
  );
  async function fire(type, properties = {}) {
    let result;
    handlers.get(type)({
      waitUntil(promise) {
        result = promise;
      },
      respondWith(promise) {
        result = promise;
      },
      request: { method: "GET", url: scope, mode: "navigate" },
      ports: [],
      ...properties,
    });
    return result;
  }
  async function ready() {
    let result = false;
    await fire("message", {
      data: { type: "CHECK_OFFLINE_READY" },
      ports: [
        {
          postMessage(data) {
            result = data.ready;
          },
        },
      ],
    });
    return result;
  }
  return { stores, fire, ready, fetch, claim, skipWaiting };
}

it("保存完了後はネット接続なしでHTML・JS・音声を返せる", async () => {
  const app = worker();
  await app.fire("install");
  expect(await app.ready()).toBe(true);
  const navigation = await app.fire("fetch", {
    request: { method: "GET", url: scope + "?saved=1", mode: "navigate" },
  });
  expect(await navigation.text()).toBe("asset:" + scope + "index.html");
  for (const path of ["bundle.js", "audio/american-fall.wav"]) {
    const response = await app.fire("fetch", {
      request: { method: "GET", url: scope + path, mode: "cors" },
    });
    expect(await response.text()).toBe("asset:" + scope + path);
  }
  expect(app.fetch).not.toHaveBeenCalled();
  expect(app.skipWaiting).not.toHaveBeenCalled();
});

it("保存失敗で中途半端な版を残さず、前の版を消さない", async () => {
  const app = worker(true);
  app.stores.set(prefix + "previous", new Map());
  await expect(app.fire("install")).rejects.toThrow("download");
  expect(app.stores.has(prefix + "previous")).toBe(true);
  expect(app.stores.has(prefix + "current")).toBe(false);
});

it("明示的な更新まで待機し、有効化時はこのゲームの古い保存だけ削除する", async () => {
  const app = worker();
  await app.fire("install");
  app.stores.set(prefix + "previous", new Map());
  app.stores.set("tiny-hole:/another-game/:previous", new Map());
  expect(app.skipWaiting).not.toHaveBeenCalled();
  await app.fire("message", { data: { type: "SKIP_WAITING" } });
  expect(app.skipWaiting).toHaveBeenCalledOnce();
  await app.fire("activate");
  expect([...app.stores.keys()]).toEqual([
    prefix + "current",
    "tiny-hole:/another-game/:previous",
  ]);
  expect(app.claim).toHaveBeenCalledOnce();
});

it("必要な保存が欠けたら完了扱いにせず、他サイトの通信とPOSTに干渉しない", async () => {
  const app = worker();
  await app.fire("install");
  app.stores.get(prefix + "current").delete(scope + "audio/american-fall.wav");
  expect(await app.ready()).toBe(false);
  for (const request of [
    { method: "GET", url: "https://other.invalid/", mode: "cors" },
    { method: "POST", url: scope, mode: "cors" },
  ])
    expect(await app.fire("fetch", { request })).toBeUndefined();
});
