import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { format } from "prettier";
import { gameControl } from "./ui.mjs";
const directory =
  process.env.HOLE_REPORT_DIR || "reports/hell-stage-2026-11-08/mobile";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const snapshot = () => page.evaluate(() => window.__hole.snapshot());
const result = {
  browser: await browser.version(),
  viewport: "390x844",
  errors,
  iPhone: "未実施",
  WebKit: "未実施",
};
try {
  await page.goto(process.env.HOLE_URL || "http://127.0.0.1:5176/");
  await page.waitForFunction(() => window.__hole);
  await page
    .getByRole("combobox", { name: "ステージ", exact: true })
    .selectOption("hell");
  await page.waitForFunction(
    () => window.__hole?.snapshot().stageId === "hell",
  );
  const first = await snapshot();
  const touch = await context.newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 195, y: 430, id: 1 }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 250, y: 430, id: 1 }],
  });
  await page.waitForTimeout(300);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const moved = await snapshot();
  assert(
    Math.hypot(moved.hole.x - first.hole.x, moved.hole.z - first.hole.z) >
      first.hole.radius * 0.1,
  );
  await page.waitForTimeout(550);
  const stopped = await snapshot();
  assert(
    Math.hypot(stopped.hole.x - moved.hole.x, stopped.hole.z - moved.hole.z) <
      stopped.hole.radius * 0.04,
  );
  result.touchMovesAndStops = true;
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(4000);
  await page.keyboard.up("ArrowRight");
  const edge = await snapshot();
  assert(
    edge.hole.x + edge.hole.radius <=
      edge.hellWorld.spaces[0].bounds.maxX + 0.001,
  );
  assert.equal(edge.hellWorld.doors[0].open, false);
  const notice = page.locator(".boundary-notice");
  await notice.waitFor({ state: "visible" });
  const style = await notice.evaluate((element) => ({
    text: element.textContent,
    font: parseFloat(getComputedStyle(element).fontSize),
  }));
  const bounds = await notice.boundingBox();
  assert(style.font >= 16);
  assert(style.text.includes("レベル3"));
  assert(bounds.x >= 0 && bounds.x + bounds.width <= 391);
  result.gate = { ...style, bounds, blocks: true };
  await page.screenshot({ path: `${directory}/closed-box.png` });
  await (await gameControl(page, "最初から遊ぶ")).click();
  await page.waitForFunction(
    (seed) => window.__hole?.snapshot().seed !== seed,
    edge.seed,
  );
  const restarted = await snapshot();
  assert.equal(restarted.level, 1);
  assert.equal(restarted.hellWorld.openedArea, 0);
  result.restart = true;
  await page
    .getByRole("combobox", { name: "ステージ", exact: true })
    .selectOption("office");
  await page.waitForFunction(
    () => window.__hole?.snapshot().stageId === "office",
  );
  result.stageSwitch = true;
  assert.deepEqual(errors, []);
} catch (error) {
  result.failure = error.stack;
  await page.screenshot({ path: `${directory}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await writeFile(
    `${directory}/results.json`,
    await format(JSON.stringify(result), { parser: "json" }),
  );
  await browser.close();
}
