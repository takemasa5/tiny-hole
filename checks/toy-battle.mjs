import assert from "node:assert/strict";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const directory =
  process.env.HOLE_REPORT_DIR || "reports/toy-battle-motion-2026-11-14";
await mkdir(`${directory}/video`, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const report = {
  browser: await browser.version(),
  fixture:
    "実際のおもちゃステージを開発用の初期状態と固定カメラで開始。通常の進行操作による到達とは別。",
  errors: [],
  standing: [],
  motion: [],
  WebKit: "未実施",
  iPhone: "未実施",
};
const url = process.env.HOLE_URL || "http://localhost:5176";
const snapshot = (page) =>
  page.evaluate(() => {
    const state = window.__hole.snapshot();
    return {
      level: state.level,
      hole: state.hole,
      giants: state.objects.filter((o) => ["hero", "monster"].includes(o.id)),
    };
  });
function checkStanding(state) {
  assert.equal(state.giants.length, 2);
  for (const o of state.giants) {
    assert(o.physical, `${o.id}: 剛体がありません`);
    assert.equal(o.motion, "fighting", `${o.id}: ${o.motion}`);
    assert(Math.hypot(o.rotation.x, o.rotation.z) < 0.01, `${o.id}: 転倒`);
  }
}
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (error) => report.errors.push(error.message));
  for (const level of [9, 10, 11]) {
    for (const seed of [1, 7, 42]) {
      await page.goto(
        `${url}/checks/toy-battle.html?level=${level}&seed=${seed}`,
      );
      await page.waitForFunction(
        () =>
          window.__hole
            ?.snapshot()
            .objects.filter(
              (o) => ["hero", "monster"].includes(o.id) && o.physical,
            ).length === 2,
      );
      for (let frame = 0; frame < 4; frame++) {
        checkStanding(await snapshot(page));
        await page.waitForTimeout(500);
      }
      const state = await snapshot(page);
      checkStanding(state);
      report.standing.push({
        level,
        seed,
        actors: state.giants.map((o) => ({
          id: o.id,
          motion: o.motion,
          bottom: o.bottom,
          rotation: o.rotation,
        })),
      });
    }
  }
  await page.close();

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: `${directory}/video`,
      size: { width: 1440, height: 900 },
    },
  });
  const filmed = await context.newPage();
  filmed.on("pageerror", (error) => report.errors.push(error.message));
  const video = filmed.video();
  await filmed.goto(`${url}/checks/toy-battle.html`);
  await filmed.waitForFunction(() =>
    window.__hole
      ?.snapshot()
      .objects.some((o) => o.id === "hero" && o.physical),
  );
  for (let frame = 0; frame < 80; frame++) {
    const state = await snapshot(filmed);
    checkStanding(state);
    report.motion.push({
      time: state.giants[0].battleTime,
      actors: state.giants.map((o) => ({
        id: o.id,
        position: o.position,
        rotation: o.rotation,
        arm: o.battleArmAngle,
        otherArm: o.battleOtherArmAngle,
        phase: o.motion,
      })),
    });
    if (state.giants[0].battleTime >= 12.2) break;
    await filmed.waitForTimeout(250);
  }
  assert(report.motion.at(-1).time >= 12, "12秒の対戦を確認できません");
  for (const id of ["hero", "monster"]) {
    const samples = report.motion.map((frame) =>
      frame.actors.find((o) => o.id === id),
    );
    const angles = samples.map((o) => o.arm);
    const otherAngles = samples.map((o) => o.otherArm);
    assert(Math.max(...angles) - Math.min(...angles) > 1);
    assert(Math.max(...otherAngles) - Math.min(...otherAngles) > 1);
    assert(samples.some((o) => o.arm > o.otherArm + 0.5));
    assert(samples.some((o) => o.arm < o.otherArm - 0.5));
    assert(
      samples.every(
        (o) =>
          Math.hypot(
            o.position.x - samples[0].position.x,
            o.position.z - samples[0].position.z,
          ) < 1,
      ),
    );
    assert(
      samples.every(
        (o) =>
          Math.abs(
            o.rotation.x * samples[0].rotation.x +
              o.rotation.y * samples[0].rotation.y +
              o.rotation.z * samples[0].rotation.z +
              o.rotation.w * samples[0].rotation.w,
          ) > 0.995,
      ),
    );
  }
  await filmed.screenshot({ path: `${directory}/battle.png` });

  // Film a real key-driven approach as well as the stationary two-arm fight.
  await filmed.goto(`${url}/checks/toy-battle.html?level=11`);
  await filmed.waitForFunction(
    () =>
      window.__hole
        ?.snapshot()
        .objects.filter((o) => ["hero", "monster"].includes(o.id) && o.physical)
        .length === 2,
  );
  await filmed.waitForTimeout(500);
  const before = await snapshot(filmed);
  const raised = new Set();
  await filmed.keyboard.down("ArrowUp");
  let escaped;
  try {
    for (let frame = 0; frame < 30; frame++) {
      await filmed.waitForTimeout(50);
      const state = await snapshot(filmed);
      for (const o of state.giants) {
        assert.notEqual(o.motion, "falling");
        if (o.motion === "fleeing") {
          assert(o.battleArmAngle < -2.8, `${o.id}: 右腕が上がりません`);
          assert(o.battleOtherArmAngle < -2.8, `${o.id}: 左腕が上がりません`);
          raised.add(o.id);
        }
      }
      if (raised.size === 2) {
        escaped = state;
        break;
      }
    }
  } finally {
    await filmed.keyboard.up("ArrowUp");
  }
  assert(escaped, "2体が両腕を上げて回避しません");
  report.approach = {
    before: before.hole,
    after: escaped.hole,
    actors: escaped.giants.map((o) => ({
      id: o.id,
      motion: o.motion,
      rightArm: o.battleArmAngle,
      leftArm: o.battleOtherArmAngle,
    })),
  };
  await filmed.screenshot({ path: `${directory}/approach.png` });
  await filmed.waitForTimeout(1200);
  await context.close();
  await rename(await video.path(), `${directory}/battle.webm`);
  report.video = "battle.webm";
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  await writeFile(
    `${directory}/results.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}
