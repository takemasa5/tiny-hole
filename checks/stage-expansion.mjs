import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { format } from "prettier";
import { gameControl } from "./ui.mjs";

const collisionTrial = process.argv.includes("--collision-fit");
const reportRoot =
  process.argv.find((arg) => arg.startsWith("--report-dir="))?.split("=")[1] ||
  "reports/additional-stages-2026-10-31";
const directory =
  reportRoot + "/" + new Date().toISOString().replaceAll(":", "-");
await mkdir(directory, { recursive: true });
const selected = process.argv
  .filter((arg) => arg.startsWith("--stage="))
  .map((arg) => arg.split("=")[1]);
const ids = [...selected];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const snapshot = () => page.evaluate(() => window.__hole.snapshot());
const wait = (ms) => page.waitForTimeout(ms);
const results = {
  mode: collisionTrial ? "collision-fit" : "stage-flow",
  directory,
  browser: await browser.version(),
  errors,
  stages: [],
  iPhoneSafari: "未実施",
  WebKit: "未実施",
};

function projectedRadius(object) {
  if (Number.isFinite(object.collisionFootprint))
    return object.collisionFootprint;
  const { x, y, z, w } = object.rotation;
  const [width, height, depth] = object.size;
  let radius = 0;
  for (const a of [-width / 2, width / 2])
    for (const b of [-height / 2, height / 2])
      for (const c of [-depth / 2, depth / 2]) {
        const px =
          (1 - 2 * (y * y + z * z)) * a +
          2 * (x * y - w * z) * b +
          2 * (x * z + w * y) * c;
        const pz =
          2 * (x * z - w * y) * a +
          2 * (y * z + w * x) * b +
          (1 - 2 * (x * x + y * y)) * c;
        radius = Math.max(radius, Math.hypot(px, pz));
      }
  return radius;
}

async function interceptWalker(objectId) {
  let held = [];
  try {
    for (let attempt = 0; attempt < 300; attempt++) {
      const state = await snapshot();
      const target = state.objects.find((object) => object.id === objectId);
      if (!target || state.cleared) return;
      if (target.motion === "falling")
        return moveTo(target.position.x, target.position.z, objectId);
      const dx = target.position.x - state.hole.x;
      const dz = target.position.z - state.hole.z;
      const tolerance = Math.max(
        0.005,
        (state.hole.radius - projectedRadius(target)) * 0.25,
      );
      const next = [];
      if (Math.abs(dx) > tolerance)
        next.push(dx > 0 ? "ArrowRight" : "ArrowLeft");
      if (Math.abs(dz) > tolerance) next.push(dz > 0 ? "ArrowDown" : "ArrowUp");
      for (const key of held.filter((key) => !next.includes(key)))
        await page.keyboard.up(key);
      for (const key of next.filter((key) => !held.includes(key)))
        await page.keyboard.down(key);
      held = next;
      await wait(60);
    }
    throw new Error("キー操作で歩く物を追えません。対象: " + objectId);
  } finally {
    for (const key of held) await page.keyboard.up(key);
  }
}

async function moveTo(x, z, objectId) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const state = await snapshot();
    let arrivalTolerance = Math.min(0.1, state.hole.radius * 0.03);
    if (objectId) {
      const target = [...state.objects, ...state.factories].find(
        (object) => object.id === objectId,
      );
      if (!target) return;
      if (target.motion && target.motion !== "falling")
        return interceptWalker(objectId);
      if (
        target.id !== "goal" &&
        target.rotation &&
        projectedRadius(target) >= state.hole.radius * 0.99
      )
        return;
      if (target.rotation)
        arrivalTolerance = Math.min(
          0.1,
          Math.max(0.001, (state.hole.radius - projectedRadius(target)) * 0.4),
        );
      const lead = target.motion ? 0.15 : 0.3;
      x = target.position.x + (target.velocity?.x || 0) * lead;
      z = target.position.z + (target.velocity?.z || 0) * lead;
    }
    const boundary = state.mapHalfSize - state.hole.radius;
    const dx = Math.max(-boundary, Math.min(boundary, x)) - state.hole.x;
    const dz = Math.max(-boundary, Math.min(boundary, z)) - state.hole.z;
    const units =
      (state.hole.radius * 2) / (state.aperture[1].x - state.aperture[0].x);
    if (Math.hypot(dx, dz) < arrivalTolerance || state.cleared) return;
    const ratio = Math.min(1, (state.hole.radius * 3) / Math.hypot(dx, dz));
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
  throw new Error("通常ドラッグで目的地に着きません。対象: " + objectId);
}

try {
  await page.goto(process.env.HOLE_URL || "http://localhost:5173/");
  await page.waitForFunction(() => window.__hole);
  const order = await page
    .locator("select[aria-label=ステージ] option")
    .evaluateAll((options) => options.map((option) => option.value));
  if (!ids.length) ids.push(...order);
  for (const stageId of ids) {
    await page
      .getByRole("combobox", { name: "ステージ", exact: true })
      .selectOption(stageId);
    await page.waitForFunction(
      (id) => window.__hole?.snapshot().stageId === id,
      stageId,
    );
    if ((await page.locator(".game-options").getAttribute("open")) !== null)
      await page.getByLabel("メニュー", { exact: true }).click();
    const initial = await snapshot();
    const factoryCount = stageId === "office" ? 4 : 2;
    const fittedKinds =
      stageId === "mountain"
        ? ["sapling", "tree"]
        : ["spikedPillar", "giantOni"];
    const record = {
      stageId,
      seed: initial.seed,
      factorySites: initial.supplySites,
      levels: [1],
      emittedKinds: [],
      collisionFit: [],
      stationeryCollectedLevels: {},
    };
    results.stages.push(record);
    assert.equal(initial.mapHalfSize, stageId === "office" ? 10 : 50);
    assert.equal(initial.levels[7].threshold, 2700);
    assert.equal(initial.factories.length, factoryCount);
    assert.equal(initial.objects.filter((o) => o.enemy).length, 1);
    assert.equal(initial.rigidBodies, initial.objects.length + factoryCount);
    await page.screenshot({ path: directory + "/" + stageId + "-start.png" });
    if (stageId === "office") assert.equal(initial.hole.radius, 0.08);
    if (stageId === "hell")
      assert(
        initial.objects.filter((o) => o.motion).length /
          (initial.objects.length + initial.factories.length) >
          0.8,
      );
    const pool = new Set(
      initial.objects
        .filter(
          (o) =>
            o.id !== "goal" && (!o.motion || stageId === "hell") && !o.enemy,
        )
        .map((o) => o.kind),
    );
    const emitted = new Set();
    const stationerySupply = new Map();
    const tooLargeWalking = new Set();
    const edibleFleeing = new Set();
    const observe = (state) => {
      for (const object of state.objects.filter((o) => o.motion && !o.launch)) {
        if (object.motion === "fleeing") {
          assert(
            projectedRadius(object) < state.hole.radius + 0.00001,
            "入らない大きさの物が逃げています。" + object.kind,
          );
          edibleFleeing.add(object.kind);
        }
        if (
          object.motion === "walking" &&
          projectedRadius(object) >= state.hole.radius
        )
          tooLargeWalking.add(object.kind);
      }
      if (stageId === "office")
        for (const id of ["factory-stationeryA", "factory-stationeryB"])
          if (
            state.collectedIds.includes(id) &&
            record.stationeryCollectedLevels[id] === undefined
          )
            record.stationeryCollectedLevels[id] = state.level;
      for (const object of state.objects.filter((o) => o.sourceId)) {
        assert(pool.has(object.kind));
        emitted.add(object.kind);
        if (object.sourceId.startsWith("stationery")) {
          assert(
            ["eraser", "pencil", "stapler", "documents"].includes(object.kind),
          );
          if (!stationerySupply.has(object.sourceId))
            stationerySupply.set(object.sourceId, new Set());
          stationerySupply.get(object.sourceId).add(object.kind);
        }
      }
      assert.equal(
        state.rigidBodies,
        state.objects.length + state.factories.length,
      );
      assert(state.objects.length <= state.supply.maxObjects);
      if (state.level < (stageId === "office" ? 6 : 8))
        assert.equal(state.factories.length, factoryCount);
      if (stageId === "office" && state.level < 8)
        assert.equal(
          state.factories.filter((f) => ["food", "depot"].includes(f.siteId))
            .length,
          2,
        );
    };
    await page.waitForFunction(
      () =>
        window.__hole.snapshot().objects.some((o) => o.launch?.elapsed < 0.12),
      undefined,
      { timeout: 20000 },
    );
    const born = await snapshot();
    observe(born);
    const flight = born.objects.find((o) => o.launch?.elapsed < 0.18);
    assert(flight);
    assert.equal(flight.launch.duration, 0.9);
    const samples = await page.evaluate(async (id) => {
      const samples = [];
      for (let index = 0; index < 70; index++) {
        await new Promise(requestAnimationFrame);
        const object = window.__hole
          .snapshot()
          .objects.find((o) => o.id === id);
        if (!object) break;
        samples.push({
          position: object.position,
          velocity: object.velocity,
          inFlight: !!object.launch,
        });
      }
      return samples;
    }, flight.id);
    assert(samples.some((o) => o.velocity.y > 0));
    assert(samples.some((o) => o.velocity.y < 0));
    assert(samples.some((o) => !o.inFlight));
    record.emission = {
      kind: flight.kind,
      sourceId: flight.sourceId,
      duration: flight.launch.duration,
      highestY: Math.max(...samples.map((o) => o.position.y)),
      landed: samples.find((o) => !o.inFlight)?.position,
    };
    const tries = new Map();
    const seenLevels = new Set([1]);
    const started = Date.now();
    for (let attempt = 0; attempt < 250; attempt++) {
      const state = await snapshot();
      observe(state);
      if (attempt % 10 === 0)
        console.log(
          stageId +
            ": attempt " +
            attempt +
            ", level " +
            state.level +
            ", score " +
            state.score,
        );
      if (state.cleared) break;
      if (
        stageId === "office" &&
        state.level >= 6 &&
        !record.stationeryStopped
      ) {
        const counts = state.supply.spawnedBySite;
        await page.waitForFunction(
          (elapsed) => window.__hole.snapshot().supply.elapsed >= elapsed + 4,
          state.supply.elapsed,
          { timeout: 30000 },
        );
        const after = await snapshot();
        for (const id of ["stationeryA", "stationeryB"])
          assert.equal(after.supply.spawnedBySite[id], counts[id]);
        for (const factory of after.factories.filter((f) =>
          f.siteId.startsWith("stationery"),
        ))
          assert.equal(factory.supplyEnabled, false);
        record.stationeryStopped = {
          observedLevel: state.level,
          before: counts,
          after: after.supply.spawnedBySite,
        };
        await page.screenshot({
          path: directory + "/office-stationery-stopped.png",
        });
        continue;
      }
      const factory = state.factories.find(
        (f) => f.falling || state.level >= f.collectionLevel,
      );
      if (factory) {
        if (!factory.falling)
          await moveTo(factory.position.x, factory.position.z, factory.id);
        await page.waitForFunction(
          (id) => !window.__hole.snapshot().factories.some((o) => o.id === id),
          factory.id,
          { timeout: 30000 },
        );
        const after = await snapshot();
        assert(
          !after.factories.some((o) => o.id === factory.id),
          "工場を飲み込めません。",
        );
        await page.screenshot({
          path:
            directory +
            "/" +
            stageId +
            "-factory-" +
            after.collectedFactories +
            ".png",
        });
        if (!after.factories.length) {
          const spawned = after.supply.spawned;
          await wait(13000);
          assert.equal((await snapshot()).supply.spawned, spawned);
          record.supplyStopped = true;
        }
        continue;
      }
      const candidates = state.objects.filter(
        (o) =>
          !o.launch &&
          Math.max(Math.abs(o.position.x), Math.abs(o.position.z)) +
            projectedRadius(o) <
            state.mapHalfSize &&
          (tries.get(o.id) || 0) < 3 &&
          (o.id === "goal"
            ? Math.hypot(o.size[0], o.size[2]) / 2
            : projectedRadius(o)) <
            state.hole.radius * 0.99 &&
          (!o.enemy ||
            (state.level === 8 &&
              Math.max(Math.abs(o.position.x), Math.abs(o.position.z)) <
                state.mapHalfSize - 2 * (stageId === "office" ? 0.2 : 1))),
      );
      const priority = (object) => {
        const stack = object.stackId
          ? candidates.filter((o) => o.stackId === object.stackId).length
          : 1;
        const distance = Math.hypot(
          object.position.x - state.hole.x,
          object.position.z - state.hole.z,
        );
        return object.enemy
          ? 100000
          : object.id === "goal"
            ? 10000
            : (object.value * stack) /
              (stageId === "office" && state.level <= 3
                ? Math.max(state.hole.radius, distance)
                : 1);
      };
      const target = candidates.sort(
        (a, b) =>
          priority(b) - priority(a) ||
          Math.hypot(a.position.x - state.hole.x, a.position.z - state.hole.z) -
            Math.hypot(
              b.position.x - state.hole.x,
              b.position.z - state.hole.z,
            ),
      )[0];
      if (!target && state.factories.length) {
        await wait(2200);
        continue;
      }
      assert(target, "回収対象がありません。" + stageId + ":" + state.level);
      tries.set(target.id, (tries.get(target.id) || 0) + 1);
      await moveTo(target.position.x, target.position.z, target.id);
      if (target.id === "goal")
        await page.waitForFunction(
          () => window.__hole.snapshot().cleared,
          undefined,
          { timeout: 30000 },
        );
      else {
        try {
          await page.waitForFunction(
            (id) => {
              const object = window.__hole
                .snapshot()
                .objects.find((o) => o.id === id);
              return !object || object.top < -0.15;
            },
            target.id,
            { timeout: 6000 },
          );
        } catch (error) {
          if (error.name !== "TimeoutError") throw error;
        }
      }
      const after = await snapshot();
      if (
        collisionTrial &&
        fittedKinds.includes(target.kind) &&
        !record.collisionFit.some((item) => item.kind === target.kind) &&
        (after.objects.some((object) => object.id === target.id) ||
          after.collectedIds.includes(target.id))
      ) {
        await page.waitForFunction(
          (id) => window.__hole.snapshot().collectedIds.includes(id),
          target.id,
          { timeout: 20000 },
        );
        if (!record.collisionFit.some((item) => item.kind === target.kind))
          record.collisionFit.push({
            kind: target.kind,
            id: target.id,
            holeRadius: state.hole.radius,
            collisionFootprint: projectedRadius(target),
            boxFootprint: Math.hypot(target.size[0], target.size[2]) / 2,
          });
        if (
          fittedKinds.every((kind) =>
            record.collisionFit.some((item) => item.kind === kind),
          )
        )
          break;
      }
      if (!seenLevels.has(after.level)) {
        seenLevels.add(after.level);
        tries.clear();
        record.levels = [...seenLevels];
        console.log(
          stageId + ": level " + after.level + ", score " + after.score,
        );
        if (after.level >= 5)
          await page.screenshot({
            path: directory + "/" + stageId + "-level-" + after.level + ".png",
          });
      }
    }
    const end = await snapshot();
    observe(end);
    if (collisionTrial) {
      assert(
        fittedKinds.every((kind) =>
          record.collisionFit.some((item) => item.kind === kind),
        ),
      );
      record.score = end.score;
      record.level = end.level;
      record.emittedKinds = [...emitted];
      await page.screenshot({
        path: directory + "/" + stageId + "-collision-fit.png",
      });
      console.log(
        stageId + ": collision fit verified " + fittedKinds.join(", "),
      );
      continue;
    }
    assert(end.cleared);
    assert.equal(end.level, 8);
    assert.equal(end.collectedEnemies, 1);
    assert.equal(end.collectedFactories, factoryCount);
    assert.equal(end.factories.length, 0);
    assert(emitted.size > 1);
    record.emittedKinds = [...emitted];
    if (stageId === "office") {
      assert(stationerySupply.has("stationeryA"));
      assert(stationerySupply.has("stationeryB"));
      record.stationerySupply = Object.fromEntries(
        [...stationerySupply].map(([id, kinds]) => [id, [...kinds]]),
      );
      assert(record.stationeryStopped);
      for (const id of ["factory-stationeryA", "factory-stationeryB"])
        assert(record.stationeryCollectedLevels[id] <= 7);
    }
    record.tooLargeWalking = [...tooLargeWalking];
    record.edibleFleeing = [...edibleFleeing];
    Object.assign(record, {
      cleared: true,
      elapsedSeconds: (Date.now() - started) / 1000,
      score: end.score,
      supplied: end.supply.spawned,
      lost: end.lost,
      collectedEnemies: end.collectedEnemies,
      collectedFactories: end.collectedFactories,
    });
    await page.screenshot({ path: directory + "/" + stageId + "-clear.png" });
    const next = order[(order.indexOf(stageId) + 1) % order.length];
    await page.waitForFunction(
      (id) => window.__hole?.snapshot().stageId === id,
      next,
      { timeout: 6000 },
    );
    record.autoTransition = true;
    await page
      .getByRole("combobox", { name: "ステージ", exact: true })
      .selectOption(stageId);
    await page.waitForFunction(
      (id) => window.__hole?.snapshot().stageId === id,
      stageId,
    );
    const restarted = await snapshot();
    assert.equal(restarted.factories.length, factoryCount);
    assert.equal(restarted.collectedFactories, 0);
    assert.equal(restarted.score, 0);
    assert.notDeepEqual(restarted.supplySites, initial.supplySites);
    record.randomRestart = true;
    await page.setViewportSize({ width: 390, height: 844 });
    await wait(300);
    const cdp = await page.context().newCDPSession(page);
    const before = await snapshot();
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 195, y: 422 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 245, y: 422 }],
    });
    await wait(250);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    const moved = await snapshot();
    await wait(250);
    const stopped = await snapshot();
    assert(moved.hole.x > before.hole.x + before.hole.radius * 0.1);
    assert(
      Math.hypot(moved.hole.x - stopped.hole.x, moved.hole.z - stopped.hole.z) <
        0.05,
    );
    await cdp.detach();
    await page.screenshot({ path: directory + "/" + stageId + "-mobile.png" });
    record.chromiumTouch = true;
    await page.setViewportSize({ width: 1280, height: 800 });
    await (await gameControl(page, "最初から遊ぶ")).click();
    await page.waitForFunction(
      (seed) => window.__hole?.snapshot().seed !== seed,
      restarted.seed,
    );
    assert.equal((await snapshot()).supply.spawned, 0);
    record.menuRestart = true;
    console.log(
      stageId +
        ": completed, factories " +
        factoryCount +
        ", supplied " +
        record.supplied,
    );
    await writeFile(
      directory + "/results.json",
      await format(JSON.stringify(results), { parser: "json" }),
    );
  }
  assert.deepEqual(errors, []);
  results.completed = true;
} catch (error) {
  results.failure = error.stack;
  results.snapshot = await snapshot().catch(() => null);
  await page.screenshot({ path: directory + "/failure.png" }).catch(() => {});
  throw error;
} finally {
  await writeFile(
    directory + "/results.json",
    await format(JSON.stringify(results), { parser: "json" }),
  );
  console.log(
    JSON.stringify(
      {
        directory,
        completed: results.completed,
        failure: results.failure,
        stages: results.stages.map(({ stageId, cleared, score, supplied }) => ({
          stageId,
          cleared,
          score,
          supplied,
        })),
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
