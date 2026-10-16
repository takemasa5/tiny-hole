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
  const defaults = await page.evaluate(() => {
    const elements = [
      ".game-shell",
      "canvas",
      ".brand span",
      ".stage-card h1",
      ".growth-label span",
      ".sound-toggle",
    ];
    const selection = elements.map((selector) => ({
      selector,
      userSelect: getComputedStyle(document.querySelector(selector)).userSelect,
    }));
    const cancelled = ["selectstart", "contextmenu", "dragstart"].map(
      (type) =>
        !document
          .querySelector(".stage-card h1")
          .dispatchEvent(new Event(type, { bubbles: true, cancelable: true })),
    );
    const outside = document.createElement("div");
    document.body.append(outside);
    const outsideAllowed = outside.dispatchEvent(
      new Event("selectstart", { bubbles: true, cancelable: true }),
    );
    outside.remove();
    return { selection, cancelled, outsideAllowed };
  });
  if (
    defaults.selection.some((item) => item.userSelect !== "none") ||
    defaults.cancelled.some((cancelled) => !cancelled) ||
    !defaults.outsideAllowed
  )
    throw new Error(
      "ゲーム内の選択抑止が効かないか、ゲーム外へ影響しています。",
    );

  const cdp = await page.context().newCDPSession(page);
  for (const selector of [".stage-card h1", ".growth-label span"]) {
    const bounds = await page.locator(selector).first().boundingBox();
    const x = Math.min(270, bounds.x + bounds.width / 2);
    const y = bounds.y + bounds.height / 2;
    const before = await snapshot();
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await page.waitForTimeout(1000);
    for (let step = 1; step <= 5; step++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + step * 10, y }],
      });
      await page.waitForTimeout(40);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await page.waitForTimeout(100);
    const after = await snapshot();
    if (after.hole.x <= before.hole.x + 0.15)
      throw new Error("長押し後のドラッグで穴が動きません。");
    if (await page.evaluate(() => window.getSelection()?.toString()))
      throw new Error("文字が選択されています。");
    await page.waitForTimeout(150);
    const stopped = await snapshot();
    if (
      Math.hypot(stopped.hole.x - after.hole.x, stopped.hole.z - after.hole.z) >
      0.01
    )
      throw new Error("指を離した後も移動しています。");
    if (after.audio.state !== "running")
      throw new Error("タッチで効果音が有効になりません。");
  }
  await page.getByRole("button", { name: "効果音を消す" }).tap();
  if ((await snapshot()).audio.enabled)
    throw new Error("音ボタンをタップできません。");
  const beforeRestart = await snapshot();
  await page.getByRole("button", { name: "最初から遊ぶ" }).tap();
  await page.waitForFunction((previousSeed) => {
    const state = window.__hole?.snapshot();
    return (
      state &&
      state.seed !== previousSeed &&
      state.score === 0 &&
      state.growthEvents === 0
    );
  }, beforeRestart.seed);
  await page.waitForTimeout(300);
  if ((await snapshot()).audio.enabled)
    throw new Error("音OFFでの再開ができません。");

  const goal = (await snapshot()).objects.find(
    (object) => object.id === "goal",
  );
  const held = new Set();
  async function steer(keys) {
    for (const key of held)
      if (!keys.has(key)) {
        await page.keyboard.up(key);
        held.delete(key);
      }
    for (const key of keys)
      if (!held.has(key)) {
        await page.keyboard.down(key);
        held.add(key);
      }
  }
  for (let step = 0; step < 100; step++) {
    const state = await snapshot();
    const dx = goal.position.x + 2 - state.hole.x;
    const dz = goal.position.z + 3.5 - state.hole.z;
    if (Math.hypot(dx, dz) < 0.4) break;
    const keys = new Set();
    if (Math.abs(dx) > Math.abs(dz) * 0.414) keys.add(dx > 0 ? "d" : "a");
    if (Math.abs(dz) > Math.abs(dx) * 0.414) keys.add(dz > 0 ? "s" : "w");
    await steer(keys);
    await page.waitForTimeout(50);
  }
  await steer(new Set());
  await page.waitForTimeout(150);
  const beforeTap = await snapshot();
  const target = beforeTap.objects.find((object) => object.id === "goal");
  await page.touchscreen.tap(target.screen.x, target.screen.y);
  if ((await snapshot()).resets !== beforeTap.resets + 1)
    throw new Error("目標物をタップして置き直せません。");
  if (errors.length) throw new Error(errors.join("\n"));
  await mkdir("reports", { recursive: true });
  const report = {
    date: "2026-10-15",
    browser: await browser.version(),
    viewport: "390x844",
    computedSelection: defaults.selection,
    syntheticDefaultEventsCancelled: defaults.cancelled,
    suppressionScopedToGame: defaults.outsideAllowed,
    longPressThenTouchDrag: true,
    noSelectedText: true,
    touchReleaseStops: true,
    touchUnlocksAudio: true,
    soundAndRestartButtons: true,
    goalTouchReset: true,
    iPhoneSafari: "未実施",
    errors,
  };
  await writeFile(
    "reports/selection-check.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
