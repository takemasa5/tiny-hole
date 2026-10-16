import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
const results = [];
const errors = [];
const singleStage = process.argv
  .find((arg) => arg.startsWith("--stage="))
  ?.split("=")[1];
const autoTransition = process.argv.includes("--auto");
const prefix = autoTransition ? "appearance-flow" : "stages";
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (error) => errors.push(error.message));
const snapshot = () => page.evaluate(() => window.__hole.snapshot());
const wait = (ms) => page.waitForTimeout(ms);
async function moveTo(x, z) {
  for (let step = 0; step < 100; step++) {
    const state = await snapshot();
    const boundary = state.mapHalfSize - state.hole.radius;
    const dx = Math.max(-boundary, Math.min(boundary, x)) - state.hole.x;
    const dz = Math.max(-boundary, Math.min(boundary, z)) - state.hole.z;
    const units =
      (state.hole.radius * 2) / (state.aperture[1].x - state.aperture[0].x);
    if (Math.hypot(dx, dz) < Math.max(0.12, units * 9) || state.cleared) return;
    const ratio = Math.min(1, (state.hole.radius * 0.85) / Math.hypot(dx, dz));
    await page.mouse.move(640, 400);
    await page.mouse.down();
    await page.mouse.move(
      640 + (dx * ratio) / units,
      400 + (dz * ratio * (7.6 / Math.hypot(7.6, 6.8))) / units,
      { steps: 5 },
    );
    await wait(190);
    await page.mouse.up();
  }
  throw new Error("通常ドラッグで目的位置に到達できません。");
}

try {
  await page.goto("http://localhost:5173/");
  await page.waitForFunction(() => window.__hole);
  for (const stageId of singleStage
    ? [singleStage]
    : ["mountain", "america", "egypt"]) {
    const start = Date.now();
    const artifact = autoTransition ? `appearance-${stageId}` : stageId;
    await page
      .getByRole("combobox", { name: "ステージ", exact: true })
      .selectOption(stageId);
    await page.waitForFunction(
      (id) => window.__hole?.snapshot().stageId === id,
      stageId,
    );
    await wait(900);
    const initial = await snapshot();
    if (initial.score !== 0 || initial.level !== 1)
      throw new Error("ステージ切替で進行が残っています。");
    const moving = initial.objects.find((object) => object.motion);
    await wait(600);
    const moved = (await snapshot()).objects.find(
      (object) => object.id === moving.id,
    );
    if (
      Math.hypot(
        moved.position.x - moving.position.x,
        moved.position.z - moving.position.z,
      ) < 0.1
    )
      throw new Error(`${stageId}: 歩く物が動きません。`);
    await page.screenshot({ path: `reports/${artifact}-start.png` });
    const observedLevels = [1];
    const tries = new Map();
    for (let attempt = 0; attempt < 120; attempt++) {
      const state = await snapshot();
      if (state.cleared) break;
      const target = state.objects
        .filter(
          (object) =>
            !object.motion &&
            (tries.get(object.id) ?? 0) < 2 &&
            Math.hypot(object.size[0], object.size[2]) / 2 <
              state.hole.radius * 0.95,
        )
        .sort(
          (a, b) =>
            b.value - a.value ||
            Math.hypot(
              a.position.x - state.hole.x,
              a.position.z - state.hole.z,
            ) -
              Math.hypot(
                b.position.x - state.hole.x,
                b.position.z - state.hole.z,
              ),
        )[0];
      if (!target) throw new Error(`${stageId}: 入る物がありません。`);
      tries.set(target.id, (tries.get(target.id) ?? 0) + 1);
      if (target.id === "goal")
        await page.screenshot({ path: `reports/${artifact}-grown.png` });
      await moveTo(target.position.x, target.position.z);
      if (target.id === "goal") {
        await page.waitForFunction(
          () => window.__hole?.snapshot().cleared,
          undefined,
          { timeout: 6000 },
        );
      } else await wait(700);
      const after = await snapshot();
      if (!observedLevels.includes(after.level)) {
        tries.clear();
        observedLevels.push(after.level);
        console.log(`${stageId}: level ${after.level}, score ${after.score}`);
      }
      if (after.rigidBodies !== after.objects.length)
        throw new Error("描画だけの弾が剛体を増やしています。");
    }
    const end = await snapshot();
    if (!end.cleared)
      throw new Error(
        `${stageId}: 120回以内でクリアできませんでした。${end.score}点`,
      );
    await page.screenshot({ path: `reports/${artifact}-clear.png` });
    if (
      Math.abs(
        end.aperture[1].x -
          end.aperture[0].x -
          initial.aperture[1].x +
          initial.aperture[0].x,
      ) > 1
    )
      throw new Error("成長で画面上の穴径が変わっています。");
    if (stageId === "america" && (!end.shotsFired || !end.audio.played.shot))
      throw new Error("アメリカの発砲演出・音が発生しません。");
    let automaticallyAdvancedTo;
    if (autoTransition) {
      const order = ["plaza", "mountain", "america", "egypt"];
      automaticallyAdvancedTo =
        order[(order.indexOf(stageId) + 1) % order.length];
      await page.waitForFunction(
        (id) => window.__hole?.snapshot().stageId === id,
        automaticallyAdvancedTo,
        { timeout: 6000 },
      );
      const next = await snapshot();
      if (
        next.level !== 1 ||
        next.score !== 0 ||
        next.hole.x !== 0 ||
        next.hole.z !== 0
      )
        throw new Error("自動切替で前の進行・入力が残っています。");
      await page
        .getByRole("combobox", { name: "ステージ", exact: true })
        .selectOption(stageId);
    } else await page.getByRole("button", { name: "もう一度遊ぶ" }).click();
    await page.waitForFunction(
      ({ seed, stageId }) =>
        window.__hole?.snapshot().seed !== seed &&
        window.__hole.snapshot().stageId === stageId &&
        window.__hole.snapshot().score === 0,
      { seed: end.seed, stageId },
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await wait(600);
    await page.screenshot({ path: `reports/${artifact}-mobile.png` });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 195, y: 422 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 245, y: 422 }],
    });
    await wait(220);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await wait(200);
    const touch = await snapshot();
    if (touch.hole.x < 0.2 || touch.audio.state !== "running")
      throw new Error("モバイルのドラッグ・初回音が動きません。");
    await cdp.detach();
    results.push({
      stageId,
      seed: initial.seed,
      objects: initial.objects.length,
      normalMouseClear: true,
      finalLevel: end.level,
      observedLevels,
      growthEvents: end.growthEvents,
      shotsFired: end.shotsFired,
      sounds: end.audio.played,
      collectedMoving: end.collectedMoving,
      physicsMilliseconds: end.physicsMilliseconds,
      elapsedSeconds: (Date.now() - start) / 1000,
      restart: !autoTransition,
      restartedByStageSelection: autoTransition,
      automaticallyAdvancedTo,
      chromiumTouch: true,
    });
    await page.setViewportSize({ width: 1280, height: 800 });
  }
  if (errors.length) throw new Error(errors.join("\n"));
  const report = {
    date: "2026-10-15",
    browser: await browser.version(),
    results,
    errors,
    iPhoneSafari: "新ステージは未実施",
  };
  await writeFile(
    `reports/${prefix}-check.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await page.screenshot({ path: "reports/stages-failure.png" });
  const state = await snapshot();
  await writeFile(
    "reports/stages-failure.json",
    JSON.stringify(state, null, 2) + "\n",
  );
  console.error({
    stageId: state.stageId,
    score: state.score,
    level: state.level,
  });
  throw error;
} finally {
  await browser.close();
}
