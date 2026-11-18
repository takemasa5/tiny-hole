import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { gameControl } from "./ui.mjs";
const directory =
  process.env.HOLE_REPORT_DIR || "reports/mobile-stick-2026-11-18/input";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const page = await context.newPage();
await page.routeWebSocket(/.*/, (socket) => {
  const server = socket.connectToServer();
  server.onMessage((message) => {
    if (
      !["update", "full-reload", "prune"].includes(
        JSON.parse(message.toString()).type,
      )
    )
      socket.send(message);
  });
});
await page.addInitScript(() => {
  Math.random = () => 42 / 4294967296;
  window.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType === "touch")
        window.__lastTouchPointer = event.pointerId;
    },
    true,
  );
});
const report = {
  browser: await browser.version(),
  viewport: "390x844",
  errors: [],
  iPhone: "未実施",
  WebKit: "未実施",
};
page.on("pageerror", (error) => report.errors.push(error.message));
const touch = await context.newCDPSession(page);
const snapshot = () => page.evaluate(() => window.__hole.snapshot());
const at = (x, y, id = 1) => ({ x, y, id });
const send = (type, points) =>
  touch.send("Input.dispatchTouchEvent", { type, touchPoints: points });
const distance = (a, b) => Math.hypot(a.hole.x - b.hole.x, a.hole.z - b.hole.z);
async function start() {
  await send("touchStart", [at(100, 700)]);
}
async function move(x, y) {
  await send("touchMove", [at(x, y)]);
}
async function stop() {
  await send("touchEnd", []);
}
async function menu() {
  if (!(await page.locator(".options-panel").isVisible()))
    await page.getByLabel("メニュー", { exact: true }).tap();
}
async function closeMenu() {
  if (await page.locator(".options-panel").isVisible())
    await page.getByLabel("メニュー", { exact: true }).tap();
}
async function mode(value) {
  await menu();
  await page
    .getByRole("combobox", { name: "タッチ操作", exact: true })
    .selectOption(value);
  await closeMenu();
}
try {
  await page.goto(process.env.HOLE_URL || "http://localhost:5176/");
  await page.waitForFunction(() => window.__hole);
  await page
    .getByRole("combobox", { name: "ステージ", exact: true })
    .selectOption("hell");
  await page.waitForFunction(() => window.__hole.snapshot().stageId === "hell");
  assert.equal((await snapshot()).input.touchControlMode, "stick");
  const origin = await snapshot();
  await start();
  await move(105, 701);
  await page.waitForTimeout(150);
  assert(distance(await snapshot(), origin) < origin.hole.radius * 0.01);
  assert.equal(await page.locator(".touch-stick").isVisible(), false);
  await move(136, 700);
  await page.waitForFunction(
    () => window.__hole.snapshot().input.stick?.strength === 0.7,
  );
  assert.equal((await snapshot()).input.stick.strength, 0.7);
  assert.equal(await page.locator(".touch-stick.at-full-speed").count(), 0);
  const stickSize = await page.locator(".touch-stick").boundingBox();
  assert.equal(stickSize.width, 96);
  assert.equal(stickSize.height, 96);
  await move(147, 700);
  await page.waitForFunction(
    () => window.__hole.snapshot().input.stick?.strength === 0.975,
  );
  assert.equal(await page.locator(".touch-stick.at-full-speed").count(), 0);
  await move(148, 700);
  await page.waitForFunction(
    () => window.__hole.snapshot().input.stick?.strength === 1,
  );
  assert.equal((await snapshot()).input.stick.strength, 1);
  assert(await page.locator(".touch-stick.at-full-speed").isVisible());
  report.sensitivity = {
    diameter: stickSize.width,
    speedAt36px: 0.7,
    fullSpeedAt: 48,
  };
  await move(154, 700);
  await page.waitForTimeout(100);
  const a = await snapshot();
  await page.waitForFunction(
    (x) => window.__hole.snapshot().hole.x > x + 0.04,
    a.hole.x,
  );
  const b = await snapshot();
  await page.waitForFunction(
    (x) => window.__hole.snapshot().hole.x > x + 0.04,
    b.hole.x,
  );
  const c = await snapshot();
  report.stationaryFingerKeepsMoving = [a, b, c].map((state) => ({
    hole: state.hole,
    input: state.input,
  }));
  assert(b.hole.x > a.hole.x);
  assert(c.hole.x > b.hole.x);
  assert.equal(c.input.stick.strength, 1);
  assert(await page.locator(".touch-stick.at-full-speed").isVisible());
  await page.screenshot({ path: `${directory}/holding.png` });
  report.stationaryFingerKeepsMoving = [a, b, c].map((state) => ({
    hole: state.hole,
    input: state.input,
  }));
  await move(100, 700);
  await page.waitForTimeout(50);
  const centered = await snapshot();
  await page.waitForTimeout(150);
  assert(distance(await snapshot(), centered) < centered.hole.radius * 0.01);
  await move(100, 748);
  await page.waitForFunction(
    ({ z, radius }) => window.__hole.snapshot().hole.z > z + radius * 0.2,
    centered.hole,
  );
  const down = await snapshot();
  assert(down.hole.z > centered.hole.z + centered.hole.radius * 0.2);
  await move(100, 652);
  await page.waitForFunction(
    ({ z, radius }) => window.__hole.snapshot().hole.z < z - radius * 0.2,
    down.hole,
  );
  const up = await snapshot();
  assert(up.hole.z < down.hole.z - down.hole.radius * 0.2);
  await stop();
  const released = await snapshot();
  await page.waitForTimeout(150);
  assert(distance(await snapshot(), released) < released.hole.radius * 0.01);
  assert.equal(await page.locator(".touch-stick").isVisible(), false);
  report.centerReleaseAndDirection = true;

  await start();
  await move(64, 700);
  await page.waitForTimeout(70);
  await send("touchStart", [at(64, 700), at(280, 650, 2)]);
  await send("touchMove", [at(64, 700)]);
  assert((await snapshot()).input.stickActive);
  await send("touchCancel", []);
  await page.waitForTimeout(50);
  assert.equal((await snapshot()).input.stickActive, false);
  report.secondFingerDoesNotCancelFirst = true;
  report.pointerCancelStops = true;

  await start();
  await move(136, 700);
  await page.evaluate(() =>
    document
      .querySelector("canvas")
      .releasePointerCapture(window.__lastTouchPointer),
  );
  await move(137, 700);
  await page.waitForTimeout(50);
  assert.equal((await snapshot()).input.stickActive, false);
  await stop();
  report.lostCaptureStops = true;

  await start();
  await move(136, 700);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal((await snapshot()).input.stickActive, false);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await stop();
  report.syntheticVisibilityStops = true;
  await start();
  await move(136, 700);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  assert.equal((await snapshot()).input.stickActive, false);
  await stop();
  report.syntheticBlurStops = true;

  await start();
  await move(136, 700);
  await page.getByLabel("メニュー", { exact: true }).click();
  assert.equal((await snapshot()).input.stickActive, false);
  await stop();
  report.openingMenuStops = true;
  await page.screenshot({ path: `${directory}/menu.png` });
  await page
    .getByRole("combobox", { name: "タッチ操作", exact: true })
    .selectOption("drag");
  await (await gameControl(page, "最初から遊ぶ")).tap();
  await page.waitForFunction(
    () =>
      window.__hole.snapshot().score === 0 &&
      window.__hole.snapshot().input.touchControlMode === "drag",
  );
  await closeMenu();
  await start();
  await move(142, 700);
  await page.waitForTimeout(350);
  const drag = await snapshot();
  await page.waitForTimeout(200);
  assert(distance(await snapshot(), drag) < drag.hole.radius * 0.01);
  assert.equal(await page.locator(".touch-stick").isVisible(), false);
  await stop();
  report.legacyDragAndRestartPreference = true;
  await mode("stick");
  await page
    .getByRole("combobox", { name: "ステージ", exact: true })
    .selectOption("plaza");
  await page.waitForFunction(
    () => window.__hole.snapshot().stageId === "plaza",
  );
  assert.equal((await snapshot()).input.touchControlMode, "stick");
  assert.equal((await snapshot()).input.stickActive, false);
  assert.equal(await page.locator(".touch-stick").count(), 1);
  const keyOrigin = await snapshot();
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(180);
  await page.keyboard.up("ArrowRight");
  assert(distance(await snapshot(), keyOrigin) > keyOrigin.hole.radius * 0.5);
  assert.equal(await page.locator(".touch-stick").isVisible(), false);
  await page.mouse.move(100, 700);
  await page.mouse.down();
  await page.mouse.move(140, 700);
  await page.waitForTimeout(250);
  const mouse = await snapshot();
  await page.waitForTimeout(180);
  assert(distance(await snapshot(), mouse) < mouse.hole.radius * 0.01);
  assert.equal((await snapshot()).input.stickActive, false);
  await page.mouse.up();
  report.stageChangeKeyboardAndMouse = true;
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.failure = String(error);
  report.last = await snapshot().catch(() => null);
  await page.screenshot({ path: `${directory}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await writeFile(
    `${directory}/results.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
