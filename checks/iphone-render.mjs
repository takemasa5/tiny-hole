import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { format } from "prettier";
const directory =
  process.env.HOLE_REPORT_DIR || "reports/iphone-diagnostic-2026-11-07/browser";
await mkdir(directory, { recursive: true });
const base = process.env.HOLE_URL || "http://127.0.0.1:5178/";
const browser = await chromium.launch({ headless: true, channel: "chromium" }),
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
  }),
  page = await context.newPage();
const report = {
  browser: await browser.version(),
  viewport: "390x844 DPR2",
  errors: [],
  modes: [],
  iPhone: "未実施",
  WebKit: "未実施",
};
page.on("pageerror", (e) => report.errors.push(e.message));
const snapshot = () => page.evaluate(() => window.__hole.snapshot());
try {
  await page.goto(new URL("checks/iphone-render.html", base).href);
  await page.waitForFunction(
    () => document.querySelector("canvas")?.dataset.mode === "normal",
  );
  for (const mode of [
    "normal",
    "no-occlusion",
    "precise-depth",
    "no-antialias",
    "plain-floor",
    "normal",
  ]) {
    await page.locator("summary").click();
    for (const button of await page.locator("button[data-mode]").all()) {
      const b = await button.boundingBox();
      assert(b.x >= 0 && b.x + b.width <= 390 && b.y + b.height <= 844);
    }
    await page.locator(`button[data-mode="${mode}"]`).click();
    await page.waitForFunction(
      (mode) => document.querySelector("canvas")?.dataset.mode === mode,
      mode,
    );
    await page.waitForTimeout(180);
    const s = await snapshot(),
      attrs = await page
        .locator("canvas")
        .evaluate((canvas) =>
          canvas.getContext("webgl2").getContextAttributes(),
        );
    assert.equal(s.seed, 42);
    assert.equal(s.stageId, "toys");
    assert.equal(s.level, 1);
    assert.equal(s.renderDiagnostics.mode, mode);
    assert.equal(attrs.antialias, mode !== "no-antialias");
    assert.equal(s.occlusionRendering.samples === 0, mode === "no-antialias");
    assert.equal(
      s.renderDiagnostics.cameraNear,
      s.hole.radius * (mode === "precise-depth" ? 0.4 : 0.015),
    );
    assert.equal(
      await page.locator("details").evaluate((panel) => panel.open),
      false,
    );
    report.modes.push({
      mode,
      seed: s.seed,
      level: s.level,
      renderDiagnostics: s.renderDiagnostics,
      occlusionRendering: s.occlusionRendering,
      antialias: attrs.antialias,
    });
    await page.screenshot({ path: `${directory}/${mode}.png` });
    if (mode === "no-occlusion") {
      const cdp = await context.newCDPSession(page),
        before = s.hole;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: 195, y: 520 }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: 235, y: 550 }],
      });
      await page.waitForTimeout(100);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      const after = await snapshot();
      assert(after.hole.x > before.x);
      assert.deepEqual(after.occlusion, []);
      await page.waitForTimeout(180);
      assert.deepEqual((await snapshot()).hole, after.hole);
      report.touchMovesAndStops = true;
    }
  }
  await page.goto(base);
  await page.waitForFunction(() => window.__hole);
  const normal = await snapshot();
  assert.equal(normal.renderDiagnostics.mode, "normal");
  assert(normal.occlusionRendering.samples > 0);
  report.defaultGameUnchanged = {
    mode: normal.renderDiagnostics.mode,
    occlusionRendering: normal.occlusionRendering,
  };
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify(report));
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  await writeFile(
    `${directory}/results.json`,
    await format(JSON.stringify(report), { parser: "json" }),
  );
  await browser.close();
}
