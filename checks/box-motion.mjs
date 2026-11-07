import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { format } from "prettier";
const directory =
  process.env.HOLE_REPORT_DIR || "reports/box-stability-2026-11-07/final";
await mkdir(directory, { recursive: true });
const axis = process.env.HOLE_MOTION_AXIS === "z" ? "z" : "x";
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const result = {
  browser: await browser.version(),
  fixture:
    "実ゲームを通常のキー入力で移動。120Hz相当のsetTimeout描画コールバックはタイミング検証用であり、実機の表示更新率の検証ではない。",
  iPhone: "未実施",
  WebKit: "未実施",
  errors: [],
  cases: [],
};
try {
  for (const hz of [60, 120]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      hasTouch: true,
    });
    page.on("pageerror", (e) => result.errors.push(e.message));
    await page.addInitScript(
      ({ hz }) => {
        Math.random = () => 42 / 4294967296;
        window.__boxFrames = [];
        window.__recordBox = false;
        window.requestAnimationFrame = (callback) =>
          window.setTimeout(() => {
            const time = performance.now();
            callback(time);
            if (window.__recordBox && window.__hole) {
              const s = window.__hole.snapshot();
              window.__boxFrames.push({
                time,
                physical: s.hole,
                render: s.renderHole ?? s.hole,
                level: s.level,
                frames: s.toyWorld?.frames,
                occlusion: s.occlusion,
                aperture: s.aperture,
              });
            }
          }, 1000 / hz);
        window.cancelAnimationFrame = window.clearTimeout;
      },
      { hz },
    );
    await page.goto(process.env.HOLE_URL || "http://127.0.0.1:5178/");
    await page.waitForFunction(() => window.__hole);
    await page
      .getByRole("combobox", { name: "ステージ", exact: true })
      .selectOption("toys");
    await page.waitForFunction(
      () => window.__hole.snapshot().stageId === "toys",
    );
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      window.__boxFrames = [];
      window.__recordBox = true;
    });
    const key = axis === "x" ? "ArrowRight" : "ArrowDown";
    await page.keyboard.down(key);
    await page.waitForTimeout(320);
    await page.keyboard.up(key);
    const moving = await page.evaluate(() => {
      window.__recordBox = false;
      return window.__boxFrames;
    });
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      window.__boxFrames = [];
      window.__recordBox = true;
    });
    await page.waitForTimeout(200);
    const stopped = await page.evaluate(() => {
      window.__recordBox = false;
      return window.__boxFrames;
    });
    const state = await page.evaluate(() => window.__hole.snapshot());
    const samples = moving.slice(2, -2).filter((s) => s.level === 1),
      segments = samples.slice(1).map((s, i) => ({
        elapsed: (s.time - samples[i].time) / 1000,
        physical: s.physical[axis] - samples[i].physical[axis],
        render: s.render[axis] - samples[i].render[axis],
      }));
    assert(samples.length >= 5);
    const held = segments.filter((s) => Math.abs(s.render) < 1e-8).length,
      physicalHeld = segments.filter((s) => Math.abs(s.physical) < 1e-8).length;
    const speed = segments
        .filter((s) => s.elapsed > 0)
        .map((s) => s.render / s.elapsed),
      mean = speed.reduce((a, b) => a + b, 0) / speed.length,
      variation =
        Math.sqrt(
          speed.reduce((a, b) => a + (b - mean) ** 2, 0) / speed.length,
        ) / Math.abs(mean);
    const data = {
      hz,
      axis,
      level: state.level,
      samples: samples.length,
      repeatedPhysicalFrames: physicalHeld,
      repeatedRenderedFrames: held,
      renderSpeedVariation: variation,
      stationaryRenderDrift: Math.max(
        ...stopped.map((s) =>
          Math.hypot(
            s.render.x - stopped[0].render.x,
            s.render.z - stopped[0].render.z,
          ),
        ),
      ),
      frames: state.toyWorld.frames,
      apertureCenterError: Math.max(
        ...moving.map((s) =>
          Math.hypot(
            (s.aperture[0].x + s.aperture[1].x) / 2 - 195,
            (s.aperture[0].y + s.aperture[1].y) / 2 - 422,
          ),
        ),
      ),
      rawMoving: moving,
      rawStopped: stopped,
    };
    await page.screenshot({ path: `${directory}/${hz}-box.png` });
    result.cases.push(data);
    if (!process.argv.includes("--baseline")) {
      assert(held <= 1, JSON.stringify({ hz, held, variation }));
      assert(variation < 0.15, JSON.stringify({ hz, held, variation }));
      assert.equal(data.stationaryRenderDrift, 0);
      assert(!data.frames[0].falling);
      assert(data.apertureCenterError < 0.001);
      for (const s of moving) {
        assert(
          Math.hypot(s.render.x - s.physical.x, s.render.z - s.physical.z) <=
            (s.physical.radius * 7) / 60 + 1e-8,
        );
        assert.deepEqual(s.frames[0].position, { x: 0, y: 0, z: 0 });
      }
    }
    await page.close();
  }
  assert.deepEqual(result.errors, []);
  console.log(
    JSON.stringify(
      result.cases.map(({ rawMoving, rawStopped, ...rest }) => rest),
    ),
  );
} catch (error) {
  result.failure = error.stack;
  throw error;
} finally {
  await writeFile(
    `${directory}/results.json`,
    await format(JSON.stringify(result), { parser: "json" }),
  );
  await browser.close();
}
