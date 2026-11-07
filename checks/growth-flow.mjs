import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { format } from "prettier";

const directory =
  process.env.HOLE_REPORT_DIR || "reports/scale-growth-2026-11-06";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  channel: process.env.HOLE_BROWSER_CHANNEL || "chromium",
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
const snapshot = () => page.evaluate(() => window.__hole.snapshot());
const selected = process.argv
  .filter((arg) => arg.startsWith("--stage="))
  .map((arg) => arg.slice(8));
const stages = selected.length
  ? selected
  : [
      "harbor",
      "toys",
      "office",
      "plaza",
      "mountain",
      "america",
      "egypt",
      "hell",
    ];
const results = {
  browser: await browser.version(),
  channel: process.env.HOLE_BROWSER_CHANNEL || "chromium",
  errors,
  stages: [],
  WebKit: "未実施",
  iPhone: "未実施",
};
let held = [];
async function release() {
  for (const key of held) await page.keyboard.up(key);
  held = [];
}
async function moveTo(x, z, id) {
  await release();
  for (let attempt = 0; attempt < 90; attempt++) {
    const state = await snapshot();
    const target = id
      ? state.objects.find((object) => object.id === id)
      : undefined;
    if (id && !target) return;
    if (target) {
      x = target.position.x;
      z = target.position.z;
    }
    const dx = x - state.hole.x,
      dz = z - state.hole.z;
    const units =
      (state.hole.radius * 2) / (state.aperture[1].x - state.aperture[0].x);
    if (
      Math.hypot(dx, dz) < Math.max(state.hole.radius * 0.08, units * 11) ||
      state.cleared
    )
      return;
    const ratio = Math.min(1, (state.hole.radius * 3) / Math.hypot(dx, dz));
    await page.mouse.move(640, 400);
    await page.mouse.down();
    await page.mouse.move(655, 400);
    await page.mouse.move(
      640 + (dx * ratio) / units,
      400 + (dz * ratio * (7.6 / Math.hypot(7.6, 6.8))) / units,
      { steps: 2 },
    );
    await page.waitForTimeout(
      Math.max(
        75,
        Math.min(
          260,
          ((Math.hypot(dx, dz) * ratio) / (state.hole.radius * 7)) * 1100,
        ),
      ),
    );
    await page.mouse.up();
  }
  throw new Error(`移動できません: ${id ?? [x, z]}`);
}

try {
  await page.goto(process.env.HOLE_URL || "http://127.0.0.1:5173/");
  await page.waitForFunction(() => window.__hole);
  for (const stage of stages) {
    if (stage === "toys") {
      const nestedDirectory = `${directory}/toys-nested`;
      await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ["checks/nested-toys.mjs"], {
          env: { ...process.env, HOLE_REPORT_DIR: nestedDirectory },
          stdio: "inherit",
        });
        child.on("error", reject);
        child.on("close", (code) =>
          code === 0
            ? resolve()
            : reject(new Error(`おもちゃの通し確認が終了しました: ${code}`)),
        );
      });
      const checked = JSON.parse(
        await readFile(`${nestedDirectory}/results.json`, "utf8"),
      );
      results.stages.push({
        stage,
        nested: true,
        report: `${nestedDirectory}/results.json`,
        observations: checked.levels,
        final: checked.final,
        autoTransition: checked.autoTransition,
      });
      continue;
    }

    await page
      .getByRole("combobox", { name: "ステージ", exact: true })
      .selectOption(stage);
    await page.waitForFunction(
      (id) => window.__hole?.snapshot().stageId === id,
      stage,
    );
    await page.locator("canvas").click({ position: { x: 640, y: 600 } });
    await page.waitForTimeout(300);
    const initial = await snapshot();
    const diameter = initial.aperture[1].x - initial.aperture[0].x;
    assert.equal(initial.level, 1);
    assert.equal(initial.hole.radius, 0.08);
    assert(initial.pending > 150);
    assert(initial.rigidBodies < 100);
    await page.screenshot({ path: `${directory}/${stage}-initial.png` });

    const observations = [],
      seen = new Set();
    const started = Date.now();
    for (let attempt = 0; attempt < 230; attempt++) {
      const state = await snapshot();
      if (!seen.has(state.level)) {
        assert(
          Math.abs(state.aperture[1].x - state.aperture[0].x - diameter) < 0.1,
        );
        seen.add(state.level);
        observations.push({
          level: state.level,
          area: state.openedArea,
          score: state.score,
          bodies: state.rigidBodies,
          frame: state.frameMilliseconds,
          drawCalls: state.drawCalls,
          retired: state.retiredIds.length,
        });
        console.log(stage, JSON.stringify(observations.at(-1)));

        if ([4, 7, 10, 11, 12].includes(state.level))
          await page.screenshot({
            path: `${directory}/${stage}-level-${state.level}.png`,
          });
      }
      if (state.cleared) break;
      const candidates = state.objects.filter(
        (object) =>
          object.detailed &&
          (object.level <= state.level || object.id === "goal") &&
          (object.id === "goal"
            ? object.collisionFootprint
            : Math.hypot(...object.size) / 2) <
            state.hole.radius * 0.92 &&
          (object.behavior === "still" || object.behavior === "moored") &&
          Math.max(Math.abs(object.position.x), Math.abs(object.position.z)) <
            state.playableHalfSize - state.hole.radius,
      );
      candidates.sort(
        (a, b) =>
          (b.id === "goal") - (a.id === "goal") ||
          b.value - a.value ||
          Math.hypot(a.position.x - state.hole.x, a.position.z - state.hole.z) -
            Math.hypot(
              b.position.x - state.hole.x,
              b.position.z - state.hole.z,
            ),
      );
      const target = candidates[0];
      if (!target) {
        await page.waitForTimeout(300);
        continue;
      }
      await moveTo(target.position.x, target.position.z, target.id);
      await page.waitForTimeout(target.id === "goal" ? 2300 : 280);
      if (Date.now() - started > 900000)
        throw new Error(`${stage}: 15分以内に完了しません`);
    }
    const final = await snapshot();
    assert(final.cleared, `${stage} 未クリア L${final.level}`);
    assert(final.level >= 1 && final.level <= 12);
    assert.equal(final.openedArea, 3);
    assert(
      Math.abs(final.aperture[1].x - final.aperture[0].x - diameter) < 0.1,
    );
    assert(final.rigidBodies < 250);
    results.stages.push({
      stage,
      seed: initial.seed,
      observations,
      final: {
        level: final.level,
        score: final.score,
        collected: final.collectedIds.length,
        retired: final.retiredIds.length,
        bodies: final.rigidBodies,
        frame: final.frameMilliseconds,
      },
      milliseconds: Date.now() - started,
    });
    await page.screenshot({ path: `${directory}/${stage}-clear.png` });
    await writeFile(
      `${directory}/results.json`,
      await format(JSON.stringify(results), { parser: "json" }),
    );
  }
  if (process.argv.includes("--check-transition")) {
    const lastStage = stages.at(-1);
    if (lastStage === "toys")
      results.autoTransition = {
        from: lastStage,
        to: results.stages.at(-1).autoTransition,
      };
    else {
      await page.waitForFunction(
        (id) => window.__hole?.snapshot().stageId !== id,
        lastStage,
        { timeout: 6000 },
      );
      results.autoTransition = {
        from: lastStage,
        to: (await snapshot()).stageId,
      };
    }
  }
  assert.deepEqual(errors, []);
} catch (error) {
  results.failure = error.stack;
  results.lastState = await snapshot().catch(() => null);
  await page.screenshot({ path: `${directory}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await release().catch(() => {});
  await writeFile(
    `${directory}/results.json`,
    await format(JSON.stringify(results), { parser: "json" }),
  );
  await browser.close();
}
