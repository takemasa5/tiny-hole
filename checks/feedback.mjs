import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { format } from "prettier";
const directory = process.env.HOLE_REPORT_DIR || "reports/feedback-2026-11-06";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const results = {
  browser: await browser.version(),
  errors,
  gates: [],
  iPhone: "未実施",
  WebKit: "未実施",
};
const snapshot = () => page.evaluate(() => window.__hole.snapshot());
async function moveTo(x, z) {
  for (let step = 0; step < 65; step++) {
    const state = await snapshot(),
      view = page.viewportSize();
    const limit = state.playableHalfSize - state.hole.radius;
    const dx = Math.max(-limit, Math.min(limit, x)) - state.hole.x,
      dz = Math.max(-limit, Math.min(limit, z)) - state.hole.z;
    const units =
      (state.hole.radius * 2) / (state.aperture[1].x - state.aperture[0].x);
    if (Math.hypot(dx, dz) < Math.max(state.hole.radius * 0.15, units * 10))
      return;
    const ratio = Math.min(1, (state.hole.radius * 3) / Math.hypot(dx, dz));
    const cx = view.width / 2,
      cy = view.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 15, cy);
    await page.mouse.move(
      cx + (dx * ratio) / units,
      cy + (dz * ratio * (7.6 / Math.hypot(7.6, 6.8))) / units,
      { steps: 2 },
    );
    await page.waitForTimeout(220);
    await page.mouse.up();
  }
  throw new Error(`移動できません: ${x}, ${z}`);
}
try {
  await page.goto(process.env.HOLE_URL || "http://127.0.0.1:5176/");
  await page.waitForFunction(() => window.__hole);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page
      .getByRole("combobox", { name: "ステージ", exact: true })
      .selectOption("office");
    await page.waitForFunction(
      () => window.__hole?.snapshot().stageId === "office",
    );
    const fixedAnchors = (await snapshot()).boundaryGuide.anchors;
    for (const [side, x, z] of [
      ["left", -2.32, 0],
      ["top", -2.32, -2.32],
      ["right", 2.32, -2.32],
      ["bottom", 2.32, 2.32],
    ]) {
      await moveTo(x, z);
      const keys = [];
      if (Math.abs(x) > 2) keys.push(x > 0 ? "ArrowRight" : "ArrowLeft");
      if (Math.abs(z) > 2) keys.push(z > 0 ? "ArrowDown" : "ArrowUp");
      for (const key of keys) await page.keyboard.down(key);
      await page.waitForTimeout(250);
      for (const key of keys) await page.keyboard.up(key);
      const state = await snapshot();
      const notice = page.locator(".boundary-notice");
      await notice.waitFor({ state: "visible" });
      const style = await notice.evaluate((element) => ({
        font: parseFloat(getComputedStyle(element).fontSize),
        text: element.textContent,
      }));
      const bounds = await notice.boundingBox();
      assert(style.font >= 16);
      assert(style.text.includes("レベル4"));
      assert(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
      assert(state.boundaryGuide.posts > 0);
      assert.deepEqual(state.boundaryGuide.anchors, fixedAnchors);
      assert(
        Math.max(Math.abs(state.hole.x), Math.abs(state.hole.z)) +
          state.hole.radius <=
          state.playableHalfSize + 0.01,
      );
      results.gates.push({
        width,
        side,
        ...style,
        bounds,
        cones: state.boundaryGuide.posts,
      });
      if (side === "left")
        await page.screenshot({ path: `${directory}/gate-${width}.png` });
    }
    await page
      .getByRole("combobox", { name: "ステージ", exact: true })
      .selectOption("plaza");
    await page.waitForFunction(
      () => window.__hole?.snapshot().stageId === "plaza",
    );
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page
    .getByRole("combobox", { name: "ステージ", exact: true })
    .selectOption("mountain");
  await page.waitForFunction(
    () => window.__hole?.snapshot().stageId === "mountain",
  );
  for (
    let attempt = 0;
    attempt < 40 && (await snapshot()).level === 1;
    attempt++
  ) {
    const state = await snapshot();
    const target = state.objects
      .filter(
        (object) =>
          object.level === 1 && object.detailed && !object.sourceLevel,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.position.x - state.hole.x, a.position.z - state.hole.z) -
          Math.hypot(b.position.x - state.hole.x, b.position.z - state.hole.z),
      )[0];
    assert(target);
    await moveTo(target.position.x, target.position.z);
    await page.waitForTimeout(350);
  }
  assert.equal((await snapshot()).level, 2);
  const initial = (await snapshot()).objects.find(
    (object) => object.id === "landmark",
  );
  assert(initial.level > (await snapshot()).level);
  let maximumTilt = 0,
    tilted;
  for (const [dx, dz] of [
    [0.06, 0],
    [-0.06, 0],
    [0, 0.06],
    [0, -0.06],
  ]) {
    await moveTo(initial.position.x + dx, initial.position.z + dz);
    for (let frame = 0; frame < 6; frame++) {
      await page.waitForTimeout(200);
      const state = await snapshot();
      const object = state.objects.find((object) => object.id === "landmark");
      assert(object, "大きな木が消えました");
      const tilt = Math.hypot(object.rotation.x, object.rotation.z);
      if (tilt > maximumTilt) {
        maximumTilt = tilt;
        tilted = { hole: state.hole, object };
      }
    }
    if (maximumTilt > 0.05) break;
  }
  results.physics = { maximumTilt, ...tilted };
  assert(maximumTilt > 0.05, "次レベルの木が傾きません");
  await page.screenshot({ path: `${directory}/tree-tilt.png` });
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
