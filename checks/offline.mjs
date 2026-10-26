import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  cp,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { chromium } from "@playwright/test";
import { buildOffline } from "../scripts/build-offline.mjs";

async function resources(directory) {
  const files = new Map();
  async function visit(path, prefix = "") {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const name = prefix + entry.name;
      if (entry.isDirectory()) await visit(join(path, entry.name), name + "/");
      else files.set(name, await readFile(join(path, entry.name)));
    }
  }
  await visit(directory);
  return files;
}

async function serve(files, missingAudio = false) {
  const state = { files, missingAudio };
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const path =
      pathname === "/tiny-hole/"
        ? "index.html"
        : pathname.slice("/tiny-hole/".length);
    const body =
      pathname.startsWith("/tiny-hole/") &&
      !(state.missingAudio && path === "audio/american-fall.wav") &&
      state.files.get(path);
    if (!body) {
      response.writeHead(404).end();
      return;
    }
    const type =
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".webmanifest": "application/manifest+json",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".wav": "audio/wav",
      }[extname(path)] || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store",
    });
    response.end(body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let closed = false;
  return {
    state,
    url: `http://127.0.0.1:${server.address().port}/tiny-hole/`,
    async close() {
      if (closed) return;
      closed = true;
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

const browser = await chromium.launch({ headless: true });
const fixture = await mkdtemp(join(tmpdir(), "hole-offline-"));
const servers = [];
const errors = [];
const report = { date: "2026-10-26", iPhoneSafari: "未実施", WebKit: "未実施" };
async function ready(page) {
  await page
    .locator('[data-testid="offline-status"][data-state="ready"]')
    .waitFor({ timeout: 20000 });
  await page.locator(".loading-overlay").waitFor({ state: "hidden" });
}
try {
  const initialFiles = await resources("dist");
  const server = await serve(initialFiles);
  servers.push(server);
  assert.equal((await fetch(server.url)).status, 200);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    hasTouch: true,
  });
  await context.addInitScript(() => {
    window.__offlineAudio = { decodes: 0, tones: 0 };
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      async decodeAudioData(data) {
        const result = await super.decodeAudioData(data);
        window.__offlineAudio.decodes++;
        return result;
      }
      createOscillator() {
        const oscillator = super.createOscillator();
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (...args) => {
          window.__offlineAudio.tones++;
          start(...args);
        };
        return oscillator;
      }
    };
  });
  context.on("page", (page) =>
    page.on("pageerror", (error) => errors.push(error.message)),
  );
  const page = await context.newPage();
  await page.goto(server.url);
  await ready(page);
  const originalTitle = await page.title();
  report.initialCache = await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open(
      names.find((name) => name.startsWith("tiny-hole:")),
    );
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  });
  assert(report.initialCache.includes("/tiny-hole/audio/american-fall.wav"));
  const manifest = JSON.parse(
    initialFiles.get("manifest.webmanifest").toString(),
  );
  assert.equal(manifest.display, "standalone");
  for (const icon of manifest.icons) assert(initialFiles.has(icon.src));
  report.manifestAndIcons = true;

  await cp("dist", fixture, { recursive: true });
  const nextTitle = originalTitle + " [更新確認]";
  await writeFile(
    join(fixture, "index.html"),
    initialFiles.get("index.html").toString().replace(originalTitle, nextTitle),
  );
  await buildOffline(fixture);
  server.state.files = await resources(fixture);
  await page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistration()).update(),
  );
  await page.getByRole("button", { name: "オフライン保存の案内" }).click();
  await page
    .getByRole("button", { name: "新版に更新して再起動" })
    .waitFor({ timeout: 20000 });
  assert.equal(await page.title(), originalTitle);
  await page.getByRole("button", { name: "新版に更新して再起動" }).click();
  await page.waitForFunction((title) => document.title === title, nextTitle);
  await ready(page);
  assert.equal(
    (await page.evaluate(() => caches.keys())).filter((name) =>
      name.startsWith("tiny-hole:"),
    ).length,
    1,
  );
  report.updateWaitsForPlayerAndReplacesCache = true;

  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.clearBrowserCache");
  await page.close();
  await server.close();
  await context.setOffline(true);
  const offlinePage = await context.newPage();
  await offlinePage.setViewportSize({ width: 390, height: 844 });
  const fromWorker = [];
  offlinePage.on("response", (response) => {
    if (response.fromServiceWorker())
      fromWorker.push(new URL(response.url()).pathname);
  });
  const navigation = await offlinePage.goto(server.url + "?saved=1");
  assert(navigation.fromServiceWorker());
  await ready(offlinePage);
  assert.equal(await offlinePage.title(), nextTitle);
  report.serverStoppedAndHttpCacheCleared = true;
  report.coldOfflineLaunch = true;
  report.stages = [];
  for (const [id, title] of [
    ["plaza", "はじまりの広場"],
    ["mountain", "花咲く山の森"],
    ["america", "アメリカの街"],
    ["egypt", "エジプトの砂漠"],
  ]) {
    await offlinePage
      .getByRole("combobox", { name: "ステージ", exact: true })
      .selectOption(id);
    await offlinePage
      .getByRole("heading", { name: title, exact: true })
      .waitFor();
    await offlinePage.locator(".loading-overlay").waitFor({ state: "hidden" });
    await offlinePage.keyboard.down("ArrowRight");
    await offlinePage.waitForTimeout(350);
    await offlinePage.keyboard.up("ArrowRight");
    await offlinePage.locator(".hint").waitFor({ state: "hidden" });
    if (id === "america")
      await offlinePage.waitForFunction(
        () =>
          window.__offlineAudio.decodes > 0 && window.__offlineAudio.tones > 0,
        undefined,
        { timeout: 5000 },
      );
    assert.equal(await offlinePage.locator(".audio-notice").count(), 0);
    report.stages.push(id);
  }
  const touch = await context.newCDPSession(offlinePage);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 195, y: 420 }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 245, y: 460 }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await offlinePage
    .getByRole("button", { name: "オフライン保存の案内" })
    .click();
  await offlinePage.screenshot({ path: "reports/offline-mobile.png" });
  await offlinePage.getByRole("button", { name: "閉じて遊ぶ" }).click();
  await offlinePage.getByRole("button", { name: "最初から遊ぶ" }).click();
  await offlinePage.locator(".loading-overlay").waitFor({ state: "hidden" });
  await offlinePage.screenshot({ path: "reports/offline-game.png" });
  report.audio = await offlinePage.evaluate(() => window.__offlineAudio);
  report.resourcesFromServiceWorker = [...new Set(fromWorker)];
  assert(report.audio.decodes > 0);
  assert(report.audio.tones > 0);
  assert(
    report.resourcesFromServiceWorker.includes(
      "/tiny-hole/audio/american-fall.wav",
    ),
  );

  const recoveryServer = await serve(initialFiles, true);
  servers.push(recoveryServer);
  const recoveryContext = await browser.newContext();
  const recovery = await recoveryContext.newPage();
  recovery.on("pageerror", (error) => errors.push(error.message));
  await recovery.goto(recoveryServer.url);
  await recovery
    .locator('[data-testid="offline-status"][data-state="failed"]')
    .waitFor({ timeout: 20000 });
  await recovery.getByRole("button", { name: "オフライン保存の案内" }).click();
  recoveryServer.state.missingAudio = false;
  await recovery.getByRole("button", { name: "保存を再試行" }).click();
  await ready(recovery);
  report.incompleteDownloadRejectedAndRetrySucceeds = true;
  report.browser = await browser.version();
  report.errors = errors;
  assert.deepEqual(errors, []);
  await writeFile(
    "reports/offline-check.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await writeFile(
    "reports/offline-failure.json",
    JSON.stringify({ ...report, error: String(error), errors }, null, 2) + "\n",
  );
  throw error;
} finally {
  await browser.close();
  for (const server of servers) await server.close();
  await rm(fixture, { recursive: true, force: true });
}
