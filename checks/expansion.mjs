import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:5173/");
  await page.waitForFunction(() => window.__hole);
  await page.waitForTimeout(1600);
  await mkdir("reports", { recursive: true });
  let growthFrame;
  const fleeingIds = new Set();
  const snapshot = async () => {
    const state = await page.evaluate(() => window.__hole.snapshot());
    state.objects
      .filter((object) => object.motion === "fleeing")
      .forEach((object) => fleeingIds.add(object.id));
    if (state.growthEffect.active && !growthFrame) {
      growthFrame = {
        level: state.level,
        age: state.growthEffect.age,
        holeDiameter: state.aperture[1].x - state.aperture[0].x,
      };
      await page.screenshot({ path: "reports/improved-growth.png" });
    }
    return state;
  };
  const initial = await snapshot();
  if (initial.objects.length !== 559)
    throw new Error("生成数が559個ではありません。");
  const initialPeople = initial.objects.filter(
    (object) => object.kind === "person",
  );
  if (initialPeople.length !== 24) throw new Error("人が24人ではありません。");
  if (initial.audio.state !== "locked")
    throw new Error("操作前に音を初期化しています。");
  const keyResults = [];
  for (const [key, axis, sign] of [
    ["w", "z", -1],
    ["s", "z", 1],
    ["a", "x", -1],
    ["d", "x", 1],
    ["ArrowUp", "z", -1],
    ["ArrowDown", "z", 1],
    ["ArrowLeft", "x", -1],
    ["ArrowRight", "x", 1],
  ]) {
    const before = await snapshot();
    await page.keyboard.down(key);
    await page.waitForTimeout(120);
    await page.keyboard.up(key);
    const after = await snapshot();
    if ((after.hole[axis] - before.hole[axis]) * sign < 0.15)
      throw new Error(`${key}で正しい方向へ移動しません。`);
    await page.waitForTimeout(150);
    const stopped = await snapshot();
    if (
      Math.hypot(stopped.hole.x - after.hole.x, stopped.hole.z - after.hole.z) >
      0.01
    )
      throw new Error(`${key}を離しても動き続けます。`);
    keyResults.push(key);
  }
  await page.keyboard.down("d");
  await page.waitForTimeout(100);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const blurred = await snapshot();
  await page.waitForTimeout(200);
  const blurStopped = await snapshot();
  if (
    Math.hypot(
      blurStopped.hole.x - blurred.hole.x,
      blurStopped.hole.z - blurred.hole.z,
    ) > 0.01
  )
    throw new Error("blur後もキー移動が続きます。");
  await page.keyboard.up("d");
  console.log("WASD・矢印8キー、キー解放、blurイベントによる停止を確認");
  const walked = await snapshot();
  if (
    !walked.objects.some((object) => {
      const before = initialPeople.find((person) => person.id === object.id);
      return (
        before &&
        Math.hypot(
          object.position.x - before.position.x,
          object.position.z - before.position.z,
        ) > 0.4
      );
    })
  )
    throw new Error("人が歩いていません。");
  if (walked.audio.state !== "running")
    throw new Error("キー操作で音が有効になりません。");
  await page.getByRole("button", { name: "効果音を消す" }).click();
  if ((await snapshot()).audio.enabled)
    throw new Error("効果音をOFFにできません。");
  await page.getByRole("button", { name: "効果音をつける" }).click();
  await page.waitForFunction(
    () => window.__hole.snapshot().audio.state === "running",
  );
  if (!(await snapshot()).audio.enabled)
    throw new Error("効果音をONに戻せません。");

  async function dragToward(state, x, z, faster = false) {
    const dx = x - state.hole.x;
    const dz = z - state.hole.z;
    const viewport = page.viewportSize();
    const units =
      (state.hole.radius * 2) / (state.aperture[1].x - state.aperture[0].x);
    const scale = Math.min(
      1,
      (state.hole.radius * (faster ? 1.7 : 0.85)) /
        Math.max(0.001, Math.hypot(dx, dz)),
    );
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      viewport.width / 2 + (dx * scale) / units,
      viewport.height / 2 + (dz * scale * 7.6) / Math.hypot(7.6, 6.8) / units,
      { steps: 5 },
    );
    await page.waitForTimeout(200);
    await page.mouse.up();
  }
  const chased = walked.objects
    .filter((object) => object.kind === "person")
    .sort(
      (a, b) =>
        Math.hypot(a.position.x - walked.hole.x, a.position.z - walked.hole.z) -
        Math.hypot(b.position.x - walked.hole.x, b.position.z - walked.hole.z),
    )[0];
  for (let step = 0; step < 60; step++) {
    const state = await snapshot();
    const person = state.objects.find((object) => object.id === chased.id);
    if (!person) break;
    if (person.motion === "falling") await page.waitForTimeout(200);
    else await dragToward(state, person.position.x, person.position.z, true);
  }
  const caught = await snapshot();
  if (
    !fleeingIds.has(chased.id) ||
    caught.objects.some((object) => object.id === chased.id) ||
    caught.collectedMoving < 1
  )
    throw new Error("通常ドラッグで人の逃走と回収を確認できませんでした。");
  console.log("人の歩行、逃走、追いかけての落下・回収、音ON/OFFを確認");
  async function moveTo(x, z) {
    for (let step = 0; step < 120; step++) {
      const state = await snapshot();
      const dx = x - state.hole.x;
      const dz = z - state.hole.z;
      const units =
        (state.hole.radius * 2) / (state.aperture[1].x - state.aperture[0].x);
      if (Math.hypot(dx, dz) < Math.max(0.12, units * 9)) return;
      await dragToward(state, x, z);
    }
    throw new Error("ドラッグで目的位置に到達できませんでした。");
  }
  const stack = caught.objects
    .filter((object) => object.stackLevel === 0)
    .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
  await moveTo(stack.x, stack.z);
  await page.waitForTimeout(3000);
  const swallowed = await snapshot();
  if (swallowed.objects.some((object) => object.stackId === stack.stackId))
    throw new Error("20段積みをまとめて飲み込めませんでした。");
  if (swallowed.score < initial.score + 20)
    throw new Error("積み上げのポイントが加算されませんでした。");
  const ordinary = swallowed.objects.find(
    (object) =>
      object.id !== "goal" &&
      object.screen.x > 350 &&
      object.screen.x < 1200 &&
      object.screen.y > 230 &&
      object.screen.y < 600,
  );
  if (!ordinary)
    throw new Error("通常物へのタップ確認位置を見つけられませんでした。");
  await page.mouse.click(ordinary.screen.x, ordinary.screen.y);
  const ordinaryTapped = await snapshot();
  if (ordinaryTapped.resets !== swallowed.resets)
    throw new Error("通常物へのタップで置き直しが発生しました。");
  const goal = ordinaryTapped.objects.find((object) => object.id === "goal");
  await moveTo(goal.position.x + 2.5, goal.position.z + 2.5);
  const beforeReset = await snapshot();
  const target = beforeReset.objects.find((object) => object.id === "goal");
  await page.mouse.click(target.screen.x, target.screen.y);
  const afterReset = await snapshot();
  if (afterReset.resets !== beforeReset.resets + 1)
    throw new Error("目標物へのマウスタップで置き直せませんでした。");
  if (afterReset.score !== beforeReset.score)
    throw new Error("置き直しで成長量が変わりました。");
  const stood = afterReset.objects.find((object) => object.id === "goal");
  if (
    Math.hypot(
      stood.position.x - target.position.x,
      stood.position.z - target.position.z,
    ) > 0.02
  )
    throw new Error("置き直しで水平位置が変わりました。");
  if (Math.abs(stood.rotation.x) + Math.abs(stood.rotation.z) > 0.02)
    throw new Error("目標物が直立していません。");
  await page.mouse.move(stood.screen.x, stood.screen.y);
  await page.mouse.down();
  await page.mouse.move(stood.screen.x + 40, stood.screen.y, { steps: 5 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  if ((await snapshot()).resets !== afterReset.resets)
    throw new Error("目標物からのドラッグをタップと誤判定しました。");
  if (
    !growthFrame ||
    swallowed.growthEvents < 1 ||
    swallowed.audio.played.growth < 1 ||
    swallowed.audio.played.pickup < 1
  )
    throw new Error(
      "成長の光・粒子と成長音・飲み込み音を確認できませんでした。",
    );
  if (
    Math.abs(
      growthFrame.holeDiameter -
        (initial.aperture[1].x - initial.aperture[0].x),
    ) > 1
  )
    throw new Error("成長演出中に画面上の穴の径が変わりました。");
  await page.screenshot({ path: "reports/improved-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const touchBefore = await snapshot();
  const touchGoal = touchBefore.objects.find((object) => object.id === "goal");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: touchGoal.screen.x, y: touchGoal.screen.y }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const touchAfter = await snapshot();
  if (touchAfter.resets !== touchBefore.resets + 1)
    throw new Error("目標物へのタッチタップで置き直せませんでした。");
  await page.screenshot({ path: "reports/improved-mobile.png" });
  const waveform = await page.evaluate(async () => {
    const { soundNotes, scheduleNote } = await import("/src/game/sound.ts");
    const measurements = {};
    for (const event of ["pickup", "growth", "clear"]) {
      const context = new OfflineAudioContext(1, 48000, 48000);
      soundNotes(event, 4).forEach((note) =>
        scheduleNote(context, context.destination, note),
      );
      const buffer = await context.startRendering();
      const samples = buffer.getChannelData(0);
      let energy = 0;
      let peak = 0;
      for (const value of samples) {
        energy += value * value;
        peak = Math.max(peak, Math.abs(value));
      }
      measurements[event] = { rms: Math.sqrt(energy / samples.length), peak };
    }
    return measurements;
  });
  if (
    Object.values(waveform).some((value) => value.rms < 0.001 || value.peak > 1)
  )
    throw new Error("効果音が無音、または振幅が過大です。");
  const performanceSample = await page.evaluate(async () => {
    const samples = [];
    let previous = performance.now();
    for (let index = 0; index < 120; index++) {
      const now = await new Promise((resolve) =>
        requestAnimationFrame(resolve),
      );
      const state = window.__hole.snapshot();
      samples.push({
        frameMs: now - previous,
        physicsMs: state.physicsMilliseconds,
        floorMs: state.floorMilliseconds,
        activeBodies: state.activeBodies,
      });
      previous = now;
    }
    return {
      frames: samples.length,
      averageFrameMs:
        samples.reduce((sum, item) => sum + item.frameMs, 0) / samples.length,
      maxFrameMs: Math.max(...samples.map((item) => item.frameMs)),
      maxPhysicsMs: Math.max(...samples.map((item) => item.physicsMs)),
      maxActiveBodies: Math.max(...samples.map((item) => item.activeBodies)),
    };
  });
  if (errors.length) throw new Error(errors.join("\n"));
  const report = {
    date: "2026-10-14",
    browser: await browser.version(),
    seed: initial.seed,
    generatedObjects: initial.objects.length,
    mapAreaRatio: (initial.mapHalfSize * 2) ** 2 / 56 ** 2,
    movingPeople: initialPeople.length,
    chasedPerson: chased.id,
    walkingAndFleeing: true,
    movingPersonSwallowed: true,
    collectedMoving: caught.collectedMoving,
    audioUnlockedByKeyboard: true,
    muteToggle: true,
    waveform,
    growthFrame,
    growthSounds: swallowed.audio.played,
    keyboardKeys: keyResults,
    keyboardReleaseStops: true,
    blurEventStopsKeyboard: true,
    stackLayers: 20,
    stackGroup: stack.stackId,
    stackSwallowed: true,
    ordinaryTapIgnored: true,
    mouseTargetReset: true,
    touchTargetReset: true,
    dragDoesNotReset: true,
    resetKeepsScoreAndHorizontalPosition: true,
    performanceSample,
    iPhoneSafari: "未実施",
    errors,
  };
  await writeFile(
    "reports/improvements-check.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
