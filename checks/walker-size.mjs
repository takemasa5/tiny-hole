import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { format } from "prettier";

const directory =
  "reports/factory-retirement-walker-2026-10-31/walkers-" + Date.now();
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const report = {
  directory,
  browser: await browser.version(),
  stages: [],
  errors,
  iPhoneSafari: "未実施",
  WebKit: "未実施",
};
try {
  await page.goto(process.env.HOLE_URL || "http://localhost:5173/");
  await page.waitForFunction(() => window.__hole);
  const ids = await page
    .locator("select[aria-label=ステージ] option")
    .evaluateAll((options) => options.map((option) => option.value));
  for (const id of ids) {
    await page
      .getByRole("combobox", { name: "ステージ", exact: true })
      .selectOption(id);
    await page.waitForFunction(
      (id) => window.__hole?.snapshot().stageId === id,
      id,
    );
    const sample = await page.evaluate(async () => {
      const tooLargeWalking = new Set(),
        nearbyTooLarge = new Set(),
        edibleFleeing = new Set(),
        failures = [];
      let state;
      for (let frame = 0; frame < 30; frame++) {
        await new Promise(requestAnimationFrame);
        state = window.__hole.snapshot();
        for (const object of state.objects.filter(
          (o) => o.motion && !o.launch && o.motion !== "falling",
        )) {
          const radius =
            object.collisionFootprint ??
            Math.hypot(object.size[0], object.size[2]) / 2;
          if (radius >= state.hole.radius) {
            if (object.motion === "fleeing")
              failures.push({
                id: object.id,
                kind: object.kind,
                radius,
                holeRadius: state.hole.radius,
              });
            if (object.motion === "walking") {
              tooLargeWalking.add(object.id);
              if (
                Math.hypot(
                  object.position.x - state.hole.x,
                  object.position.z - state.hole.z,
                ) <
                state.hole.radius + 3.2
              )
                nearbyTooLarge.add(object.id);
            }
          } else if (object.motion === "fleeing") edibleFleeing.add(object.id);
        }
      }
      return {
        stageId: state.stageId,
        seed: state.seed,
        holeRadius: state.hole.radius,
        tooLargeWalking: [...tooLargeWalking],
        nearbyTooLarge: [...nearbyTooLarge],
        edibleFleeing: [...edibleFleeing],
        failures,
      };
    });
    assert.deepEqual(sample.failures, []);
    report.stages.push(sample);
  }
  assert(
    report.stages.find((s) => s.stageId === "office").tooLargeWalking.length >
      0,
  );
  assert(
    report.stages.find((s) => s.stageId === "hell").tooLargeWalking.length > 0,
  );
  assert(report.stages.some((s) => s.nearbyTooLarge.length > 0));
  assert.deepEqual(errors, []);
  report.completed = true;
} catch (error) {
  report.failure = error.stack;
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
        stages: report.stages.map((s) => ({
          stageId: s.stageId,
          tooLargeWalking: s.tooLargeWalking.length,
          nearbyTooLarge: s.nearbyTooLarge.length,
          edibleFleeing: s.edibleFleeing.length,
        })),
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
