import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

await mkdir("reports", { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (error) => errors.push(error.message));
const snapshot = () => page.evaluate(() => window.__hole.snapshot());
const wait = (milliseconds) => page.waitForTimeout(milliseconds);
const startedAt = Date.now();
const observations = [];
const smoke = process.argv.includes("--smoke");
const artifactPrefix = process.argv.includes("--improved")
  ? "improved"
  : process.argv.includes("--street")
    ? "street"
    : "prototype";

try {
  await page.goto("http://localhost:5173");
  await page.waitForFunction(() => window.__hole, { timeout: 15000 });
  await wait(1000);
  const initial = await snapshot();
  await page.screenshot({ path: `reports/${artifactPrefix}-desktop.png` });
  const initialDiameter = initial.aperture[1].x - initial.aperture[0].x;

  async function moveTo(x, z) {
    for (let step = 0; step < 100; step++) {
      const state = await snapshot();
      const boundary = state.mapHalfSize - state.hole.radius;
      const dx = Math.max(-boundary, Math.min(boundary, x)) - state.hole.x;
      const dz = Math.max(-boundary, Math.min(boundary, z)) - state.hole.z;
      const units =
        (state.hole.radius * 2) / (state.aperture[1].x - state.aperture[0].x);
      // A new drag needs to exceed the 8px tap slop; exact sub-slop centring isn't required to swallow.
      if (Math.hypot(dx, dz) < Math.max(0.12, units * 9) || state.cleared)
        return;
      const ratio = Math.min(
        1,
        (state.hole.radius * 0.85) / Math.hypot(dx, dz),
      );
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
    throw new Error("通常ドラッグで目的位置に移動できませんでした。");
  }

  let lastLevel = 1;
  for (let attempt = 0; attempt < (smoke ? 1 : 110); attempt++) {
    const state = await snapshot();
    if (state.cleared) break;
    const fitting = state.objects
      .filter((object) => {
        const dimensions = {
          parcel: [0.65, 0.65],
          bench: [1.9, 0.45],
          planter: [1.1, 1.1],
          kiosk: [1.7, 1.7],
          house: [3.5, 3.5],
          monument: [6, 6],
          person: [0.55, 0.45],
        }[object.kind];
        return Math.hypot(...dimensions) / 2 < state.hole.radius * 0.95;
      })
      .sort((a, b) => {
        const values = {
          parcel: 1,
          bench: 2,
          planter: 5,
          kiosk: 22,
          house: 178,
          monument: 1700,
          person: 2,
        };
        return (
          values[b.kind] - values[a.kind] ||
          Math.hypot(a.position.x - state.hole.x, a.position.z - state.hole.z) -
            Math.hypot(b.position.x - state.hole.x, b.position.z - state.hole.z)
        );
      });
    const target = fitting[0];
    if (!target)
      throw new Error(`レベル${state.level}で飲み込める物がありません。`);
    await moveTo(target.position.x, target.position.z);
    await wait(target.kind === "monument" ? 2500 : 950);
    const after = await snapshot();
    if (target.kind === "monument" && !after.cleared) {
      const visibleGoal = after.objects.find((object) => object.id === "goal");
      await page.mouse.click(visibleGoal.screen.x, visibleGoal.screen.y);
      await wait(2500);
    }
    if (after.level !== lastLevel) {
      console.log(
        `Level ${after.level}: score ${after.score}, remaining ${after.objects.length}`,
      );
      observations.push({
        level: after.level,
        score: after.score,
        holeDiameter: after.aperture[1].x - after.aperture[0].x,
        physicsMilliseconds: after.physicsMilliseconds,
        floorMilliseconds: after.floorMilliseconds,
        activeBodies: after.activeBodies,
      });
      lastLevel = after.level;
    }
  }
  const result = await snapshot();
  if (!smoke && !result.cleared)
    throw new Error(
      `通常操作でクリアできませんでした。レベル${result.level}、${result.score}点。`,
    );
  if (!smoke) {
    await page.getByRole("heading", { name: "広場を、ひと飲み。" }).waitFor();
    await page.screenshot({ path: `reports/${artifactPrefix}-clear.png` });
  } else if (result.score <= 0)
    throw new Error("最終版で通常ドラッグによる回収ができませんでした。");
  if (
    Math.abs(result.aperture[1].x - result.aperture[0].x - initialDiameter) > 1
  )
    throw new Error("成長で画面上の穴径が変わりました。");

  await page
    .getByRole("button", { name: smoke ? "最初から遊ぶ" : "もう一度遊ぶ" })
    .click();
  await page.waitForFunction(() => window.__hole?.snapshot().score === 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await wait(600);
  const mobileInitial = await snapshot();
  if (mobileInitial.audio.state !== "locked")
    throw new Error("再開直後、タッチ操作前に音が有効です。");
  await page.screenshot({ path: `reports/${artifactPrefix}-mobile.png` });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 195, y: 422 }],
  });
  for (let step = 1; step <= 6; step++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 195 + step * 8, y: 422 }],
    });
    await wait(40);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await wait(300);
  const mobileAfter = await snapshot();
  if (mobileAfter.audio.state !== "running")
    throw new Error("最初のタッチで効果音が有効になりません。");
  if (mobileAfter.hole.x <= mobileInitial.hole.x + 0.2)
    throw new Error("タッチドラッグで穴が動きません。");
  await wait(300);
  const released = await snapshot();
  if (
    Math.hypot(
      released.hole.x - mobileAfter.hole.x,
      released.hole.z - mobileAfter.hole.z,
    ) > 0.01
  )
    throw new Error("指を離した後に穴が動き続けました。");
  if (errors.length) throw new Error(errors.join("\n"));
  const report = {
    date: "2026-10-14",
    browser: await browser.version(),
    seed: initial.seed,
    generatedObjects: initial.objects.length,
    elapsedSeconds: (Date.now() - startedAt) / 1000,
    desktopClear: smoke ? "全体プレイはbrowser-check.jsonを参照" : true,
    finalLevel: result.level,
    growthEvents: result.growthEvents,
    sounds: result.audio,
    mouseDrag: true,
    holeDiameterStable: smoke ? "成長全段階はbrowser-check.jsonを参照" : true,
    mouseCollection: result.score > 0,
    restart: true,
    mobileViewport: "390x844",
    chromiumTouchDrag: true,
    touchReleaseStops: true,
    audioUnlockedByFirstTouch: true,
    iPhoneSafari: "未実施",
    observations,
    errors,
  };
  await writeFile(
    artifactPrefix === "improved"
      ? "reports/improved-clear-check.json"
      : artifactPrefix === "street"
        ? "reports/street-clear-check.json"
        : smoke
          ? "reports/browser-smoke.json"
          : "reports/browser-check.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
