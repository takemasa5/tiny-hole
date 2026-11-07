import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { format } from "prettier";
import { gameControl } from "./ui.mjs";

const directory = "reports/factory-sweeper-ui-2026-10-30/details-" + Date.now();
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const snapshot = () => page.evaluate(() => window.__hole.snapshot());
const wait = (ms) => page.waitForTimeout(ms);
const report = {
  directory,
  browser: await browser.version(),
  errors,
  iPhoneSafari: "未実施",
  WebKit: "未実施",
};

async function moveTo(x, z) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const state = await snapshot();
    const dx = x - state.hole.x,
      dz = z - state.hole.z;
    if (Math.hypot(dx, dz) < 0.15) return;
    const units =
      (state.hole.radius * 2) / (state.aperture[1].x - state.aperture[0].x);
    const ratio = Math.min(1, (state.hole.radius * 0.85) / Math.hypot(dx, dz));
    await page.mouse.move(640, 400);
    await page.mouse.down();
    if (
      Math.hypot(
        (dx * ratio) / units,
        (dz * ratio * (7.6 / Math.hypot(7.6, 6.8))) / units,
      ) <= 9
    )
      await page.mouse.move(653, 400);
    await page.mouse.move(
      640 + (dx * ratio) / units,
      400 + (dz * ratio * (7.6 / Math.hypot(7.6, 6.8))) / units,
      { steps: 2 },
    );
    await wait(150);
    await page.mouse.up();
  }
  throw new Error("通常ドラッグで到達できません。");
}

try {
  await page.goto("http://localhost:5173/");
  await page.waitForFunction(() => window.__hole);
  await page
    .getByRole("combobox", { name: "ステージ", exact: true })
    .selectOption("america");
  await page.waitForFunction(
    () => window.__hole?.snapshot().stageId === "america",
  );
  const initial = await snapshot();
  report.seed = initial.seed;
  const tries = new Map();
  for (
    let attempt = 0;
    attempt < 60 && (await snapshot()).level < 3;
    attempt++
  ) {
    const state = await snapshot();
    const target = state.objects
      .filter(
        (object) =>
          !object.motion &&
          !object.enemy &&
          !object.launch &&
          (tries.get(object.id) || 0) < 3 &&
          Math.hypot(object.size[0], object.size[2]) / 2 <
            state.hole.radius * 0.99,
      )
      .sort(
        (a, b) =>
          b.value - a.value ||
          Math.hypot(a.position.x - state.hole.x, a.position.z - state.hole.z) -
            Math.hypot(
              b.position.x - state.hole.x,
              b.position.z - state.hole.z,
            ),
      )[0];
    assert(target);
    tries.set(target.id, (tries.get(target.id) || 0) + 1);
    await moveTo(target.position.x, target.position.z);
    await wait(700);
  }
  assert((await snapshot()).level >= 3);
  for (let count = 0; count < 3; count++) {
    const state = await snapshot();
    const stock = state.objects
      .filter(
        (object) =>
          object.sourceId === "food" &&
          !object.launch &&
          Math.hypot(object.size[0], object.size[2]) / 2 <
            state.hole.radius * 0.99,
      )
      .sort(
        (a, b) =>
          Math.hypot(a.position.x - state.hole.x, a.position.z - state.hole.z) -
          Math.hypot(b.position.x - state.hole.x, b.position.z - state.hole.z),
      )[0];
    if (!stock) break;
    await moveTo(stock.position.x, stock.position.z);
    await wait(700);
  }
  const factory = (await snapshot()).supplySites.find(
    (site) => site.id === "food",
  );
  await moveTo(factory.x + 2, factory.z - 4);
  await page.waitForFunction(
    () =>
      window.__hole
        .snapshot()
        .objects.some(
          (object) =>
            object.sourceId === "food" && object.launch?.elapsed < 0.12,
        ),
    undefined,
    { timeout: 20000 },
  );
  const born = await snapshot();
  const flight = born.objects.find(
    (object) => object.sourceId === "food" && object.launch?.elapsed < 0.18,
  );
  assert(flight);
  const site = born.supplySites.find((candidate) => candidate.id === "food");
  assert(Math.abs(flight.position.x - (site.x - site.width * 0.25)) < 0.8);
  assert(flight.position.y > site.height + 2.2);
  assert(flight.velocity.y > 0);
  await page.screenshot({ path: directory + "/emission.png" });
  const samples = await page.evaluate(async (id) => {
    const samples = [];
    for (let index = 0; index < 130; index++) {
      await new Promise(requestAnimationFrame);
      const object = window.__hole
        .snapshot()
        .objects.find((candidate) => candidate.id === id);
      if (!object) break;
      samples.push({
        position: object.position,
        velocity: object.velocity,
        inFlight: !!object.launch,
      });
    }
    return samples;
  }, flight.id);
  assert(samples.some((sample) => sample.position.y > flight.position.y + 0.3));
  assert(samples.some((sample) => sample.velocity.y < 0));
  assert(samples.some((sample) => !sample.inFlight));
  report.emission = {
    id: flight.id,
    initial: flight.position,
    velocity: flight.velocity,
    target: flight.launch.target,
    highestY: Math.max(...samples.map((sample) => sample.position.y)),
    landed: samples.find((sample) => !sample.inFlight)?.position,
  };
  await page.screenshot({ path: directory + "/landed.png" });
  await (await gameControl(page, "効果音を消す")).click();
  assert.equal((await snapshot()).audio.enabled, false);
  await (await gameControl(page, "効果音をつける")).click();
  assert.equal((await snapshot()).audio.enabled, true);
  await (await gameControl(page, "オフライン保存の案内")).click();
  assert(await page.getByRole("dialog").isVisible());
  await page.getByRole("button", { name: "閉じて遊ぶ" }).click();
  await (await gameControl(page, "最初から遊ぶ")).click();
  await page.waitForFunction(
    (seed) =>
      window.__hole?.snapshot().seed !== seed &&
      window.__hole.snapshot().score === 0,
    initial.seed,
  );
  if ((await page.locator(".game-options").getAttribute("open")) !== null)
    await page.getByLabel("メニュー", { exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await wait(300);
  const layout = await page.evaluate(() => ({
    headerBottom: document.querySelector(".play-header").getBoundingClientRect()
      .bottom,
    obsolete: document.querySelectorAll(
      ".district-guide,.growth-card,.level-up,.pickup,.hint,.district-label,.brand",
    ).length,
    menuOpen: document.querySelector(".game-options").open,
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert(layout.headerBottom < 100);
  assert.equal(layout.obsolete, 0);
  assert.equal(layout.menuOpen, false);
  assert.equal(layout.width, layout.scrollWidth);
  await page.screenshot({ path: directory + "/mobile.png" });
  report.minimalUI = layout;
  report.menuControls = true;
  report.restart = true;
  assert.deepEqual(errors, []);
  report.completed = true;
} catch (error) {
  report.failure = error.stack;
  report.snapshot = await snapshot().catch(() => null);
  await page.screenshot({ path: directory + "/failure.png" }).catch(() => {});
  throw error;
} finally {
  await writeFile(
    directory + "/results.json",
    await format(JSON.stringify(report), { parser: "json" }),
  );
  console.log(
    JSON.stringify(
      report.completed ? report : { directory, failure: report.failure },
      null,
      2,
    ),
  );
  await browser.close();
}
