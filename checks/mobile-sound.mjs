import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:5173/");
  await page.waitForFunction(() => window.__hole);
  await page.waitForTimeout(600);
  const snapshot = () => page.evaluate(() => window.__hole.snapshot());
  const initial = await snapshot();
  if (initial.audio.state !== "locked")
    throw new Error("操作前に音を初期化しています。");
  const stack = initial.objects
    .filter((object) => object.stackLevel === 0)
    .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
  const cdp = await page.context().newCDPSession(page);
  let growth;
  for (let step = 0; step < 70; step++) {
    const state = await snapshot();
    if (state.growthEffect.active) {
      growth = state;
      break;
    }
    const target = state.objects.find((object) => object.id === stack.id);
    const dx = (target?.position.x ?? stack.x) - state.hole.x;
    const dz = (target?.position.z ?? stack.z) - state.hole.z;
    const units =
      (state.hole.radius * 2) / (state.aperture[1].x - state.aperture[0].x);
    if (Math.hypot(dx, dz) < units * 9) {
      await page.waitForTimeout(100);
      continue;
    }
    const scale = Math.min(1, (state.hole.radius * 0.65) / Math.hypot(dx, dz));
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 195, y: 422 }],
    });
    for (let move = 1; move <= 4; move++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: 195 + (((dx * scale) / units) * move) / 4,
            y:
              422 +
              (((dz * scale * 7.6) / Math.hypot(7.6, 6.8) / units) * move) / 4,
          },
        ],
      });
    await page.waitForTimeout(150);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  }
  if (
    !growth ||
    growth.audio.state !== "running" ||
    growth.audio.played.growth < 1
  )
    throw new Error("初回タッチによる音の有効化と成長を確認できませんでした。");
  await mkdir("reports", { recursive: true });
  await page.screenshot({ path: "reports/improved-mobile-growth.png" });
  await page.getByRole("button", { name: "効果音を消す" }).tap();
  await page.getByRole("button", { name: "最初から遊ぶ" }).tap();
  await page.waitForFunction(() => window.__hole?.snapshot().score === 0);
  const mutedRestart = await snapshot();
  if (mutedRestart.audio.enabled || mutedRestart.audio.state !== "locked")
    throw new Error("再開で音OFFの選択が失われました。");
  await page.getByRole("button", { name: "効果音をつける" }).tap();
  await page.waitForFunction(
    () => window.__hole.snapshot().audio.state === "running",
  );
  if (!(await snapshot()).audio.enabled)
    throw new Error("音をONに戻せません。");
  if (errors.length) throw new Error(errors.join("\n"));
  const report = {
    date: "2026-10-14",
    browser: await browser.version(),
    viewport: "390x844",
    seed: initial.seed,
    firstTouchUnlocksAudio: true,
    touchCollectionAndGrowth: true,
    growthLevel: growth.level,
    growthAge: growth.growthEffect.age,
    sounds: growth.audio.played,
    mutePersistsAcrossRestart: true,
    audioResumesFromButton: true,
    iPhoneSafari: "未実施",
    errors,
  };
  await writeFile(
    "reports/mobile-sound-check.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
