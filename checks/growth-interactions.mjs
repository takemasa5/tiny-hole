import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { format } from "prettier";
import { gameControl } from "./ui.mjs";
const directory =
  process.env.HOLE_REPORT_DIR || "reports/scale-growth-2026-11-06/interactions";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const snapshot = () => page.evaluate(() => window.__hole.snapshot());
const results = {
  browser: await browser.version(),
  errors,
  iPhone: "未実施",
  WebKit: "未実施",
};
async function dragTo(x, z) {
  for (let i = 0; i < 25; i++) {
    const s = await snapshot(),
      dx = x - s.hole.x,
      dz = z - s.hole.z;
    if (Math.hypot(dx, dz) < s.hole.radius * 0.08) return;
    const units = (2 * s.hole.radius) / (s.aperture[1].x - s.aperture[0].x);
    const ratio = Math.min(1, (s.hole.radius * 2.5) / Math.hypot(dx, dz));
    await page.mouse.move(640, 400);
    await page.mouse.down();
    await page.mouse.move(655, 400);
    await page.mouse.move(
      640 + (dx * ratio) / units,
      400 + (dz * ratio * (7.6 / Math.hypot(7.6, 6.8))) / units,
      { steps: 2 },
    );
    await page.waitForTimeout(320);
    await page.mouse.up();
  }
  throw new Error("ドラッグで机の後ろに移動できません");
}
try {
  await page.goto(process.env.HOLE_URL || "http://127.0.0.1:5173/");
  await page.waitForFunction(() => window.__hole);
  await page
    .getByRole("combobox", { name: "ステージ", exact: true })
    .selectOption("office");
  await page.waitForFunction(
    () => window.__hole?.snapshot().stageId === "office",
  );
  for (
    let attempt = 0;
    attempt < 30 && (await snapshot()).level === 1;
    attempt++
  ) {
    const state = await snapshot();
    const target = state.objects
      .filter((o) => o.kind === "eraser" && o.level === 1 && o.detailed)
      .sort(
        (a, b) =>
          Math.hypot(a.position.x - state.hole.x, a.position.z - state.hole.z) -
          Math.hypot(b.position.x - state.hole.x, b.position.z - state.hole.z),
      )[0];
    assert(target);
    await dragTo(target.position.x, target.position.z);
    await page.waitForTimeout(350);
  }
  assert.equal((await snapshot()).level, 2);
  await dragTo(-1.1, -1);
  await page.waitForTimeout(400);
  const obscured = await snapshot();
  assert(
    obscured.occlusion.some((o) => o.id === "landmark" && o.opacity < 0.5),
  );
  await page.screenshot({ path: `${directory}/office-behind-desk.png` });
  results.deskOcclusion = obscured.occlusion;
  results.occlusionRendering = obscured.occlusionRendering;
  await dragTo(0, -1.4);
  await page.waitForTimeout(500);
  assert(!(await snapshot()).occlusion.some((o) => o.id === "landmark"));
  results.occlusionRestored = true;
  const stopped = (await snapshot()).hole;
  await page.waitForTimeout(200);
  assert.deepEqual((await snapshot()).hole, stopped);
  results.dragReleaseStops = true;
  await page.keyboard.down("ArrowLeft");
  await page.waitForFunction(
    () => {
      const s = window.__hole.snapshot();
      return s.hole.x < -s.playableHalfSize + s.hole.radius + 0.01;
    },
    undefined,
    { timeout: 12000 },
  );
  await page.keyboard.up("ArrowLeft");
  const boundary = await snapshot();
  assert(
    Math.abs(boundary.hole.x) + boundary.hole.radius <=
      boundary.playableHalfSize + 0.00001,
  );
  assert(
    Math.abs(
      boundary.hole.x + boundary.hole.radius - boundary.playableHalfSize,
    ) > 0.1,
  );
  results.closedGateBlocks = true;
  await (await gameControl(page, "最初から遊ぶ")).click();
  await page.waitForFunction(() => window.__hole?.snapshot().hole.x === 0);
  assert.equal((await snapshot()).collectedIds.length, 0);
  results.restartResets = true;
  await page.getByLabel("メニュー", { exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  const initial = await snapshot();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 195, y: 430 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: 245, y: 470 }],
  });
  await page.waitForTimeout(350);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const touched = await snapshot();
  assert(touched.hole.x > initial.hole.x);
  assert(touched.hole.z > initial.hole.z);
  await page.waitForTimeout(200);
  assert.deepEqual((await snapshot()).hole, touched.hole);
  assert.equal(touched.audio.state, "running");
  results.touch390 = { moved: true, releaseStops: true, audioUnlocked: true };
  await page.screenshot({ path: `${directory}/office-mobile.png` });
  assert.deepEqual(errors, []);
} catch (error) {
  results.failure = error.stack;
  results.lastState = await snapshot().catch(() => null);
  await page.screenshot({ path: `${directory}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await writeFile(
    `${directory}/results.json`,
    await format(JSON.stringify(results), { parser: "json" }),
  );
  await browser.close();
}
