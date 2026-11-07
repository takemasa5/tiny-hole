import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { format } from "prettier";

const directory = "reports/sweeper-commitment-2026-10-30/" + Date.now();
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const report = {
  directory,
  browser: await browser.version(),
  errors,
  iPhoneSafari: "未実施",
  WebKit: "未実施",
};
try {
  await page.goto("http://localhost:5173/");
  await page.waitForFunction(() => window.__hole);
  await page
    .getByRole("combobox", { name: "ステージ", exact: true })
    .selectOption("america");
  await page.waitForFunction(
    () =>
      window.__hole?.snapshot().stageId === "america" &&
      window.__hole.snapshot().objects.find((object) => object.enemy)?.enemy
        .phase === "pushing",
  );
  const result = await page.evaluate(async () => {
    const initial = window.__hole.snapshot();
    const enemy = initial.objects.find((object) => object.enemy);
    const id = enemy.enemy.targetId;
    const direction = enemy.enemy.direction;
    const samples = [];
    const deadline = performance.now() + 45000;
    let nextSample = 0;
    while (performance.now() < deadline) {
      const now = await new Promise(requestAnimationFrame);
      if (now < nextSample) continue;
      nextSample = now + 80;
      const state = window.__hole.snapshot();
      const target = state.objects.find((object) => object.id === id);
      if (!target)
        return {
          seed: initial.seed,
          id,
          direction,
          samples,
          lost: state.lost,
          score: state.score,
          targetRemoved: true,
        };
      const sweeper = state.objects.find((object) => object.enemy);
      samples.push({
        id: sweeper?.enemy.targetId,
        phase: sweeper?.enemy.phase,
        direction: sweeper?.enemy.direction,
        target: target.position,
      });
      if (sweeper?.enemy.targetId !== id)
        return {
          seed: initial.seed,
          id,
          direction,
          samples,
          targetRemoved: false,
        };
    }
    return { seed: initial.seed, id, direction, samples, targetRemoved: false };
  });
  report.observation = result;
  assert(result.samples.length > 5);
  assert(
    result.targetRemoved,
    "押し出す前に対象を変えたか、場外に到達しませんでした。",
  );
  assert(result.lost > 0);
  assert.equal(result.score, 0);
  for (const sample of result.samples) {
    assert.equal(sample.id, result.id);
    assert.equal(sample.phase, "pushing");
    assert.deepEqual(sample.direction, result.direction);
  }
  assert.deepEqual(errors, []);
  report.completed = true;
} catch (error) {
  report.failure = error.stack;
  report.snapshot = await page
    .evaluate(() => window.__hole?.snapshot())
    .catch(() => null);
  await page.screenshot({ path: directory + "/failure.png" }).catch(() => {});
  throw error;
} finally {
  await writeFile(
    directory + "/results.json",
    await format(JSON.stringify(report), { parser: "json" }),
  );
  console.log(
    JSON.stringify(
      {
        directory,
        completed: report.completed,
        failure: report.failure,
        samples: report.observation?.samples.length,
        lost: report.observation?.lost,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
