import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { gameControl } from "./ui.mjs";
const directory =
  process.env.HOLE_REPORT_DIR || "reports/audio-effects-2026-11-15";
const browser = await chromium.launch({ headless: true, channel: "chromium" });
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.HOLE_URL || "http://localhost:5176");
  await page.waitForFunction(() => window.__hole);
  assert.equal(
    await page.evaluate(() => window.__hole.snapshot().audio.state),
    "locked",
  );
  await page.touchscreen.tap(195, 422);
  await page.waitForFunction(() => window.__hole.snapshot().audio.music.active);
  await (await gameControl(page, "BGMを消す")).tap();
  await page
    .getByRole("combobox", { name: "ステージ", exact: true })
    .selectOption("toys");
  await page.waitForFunction(() => window.__hole.snapshot().stageId === "toys");
  await page.touchscreen.tap(195, 422);
  let audio = await page.evaluate(() => window.__hole.snapshot().audio);
  assert.equal(audio.music.enabled, false);
  assert.equal(audio.music.active, false);
  await (await gameControl(page, "BGMをつける")).tap();
  await page.waitForFunction(() => window.__hole.snapshot().audio.music.active);
  await page.screenshot({ path: `${directory}/mobile-menu.png` });
  audio = await page.evaluate(() => window.__hole.snapshot().audio);
  assert.deepEqual(errors, []);
  const report = {
    browser: await browser.version(),
    viewport: "390x844",
    firstTouchStartsMusic: true,
    musicPreferenceSurvivesStageChange: true,
    buttonsWorkWithTouch: true,
    audio,
    errors,
    iPhone: "未実施",
    WebKit: "未実施",
  };
  await writeFile(
    `${directory}/mobile.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
