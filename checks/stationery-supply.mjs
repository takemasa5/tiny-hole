import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { format } from "prettier";

const directory =
  "reports/supply-collision-2026-10-31/stationery-" + Date.now();
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const snapshot = () => page.evaluate(() => window.__hole.snapshot());
const report = {
  directory,
  browser: await browser.version(),
  errors,
  iPhoneSafari: "未実施",
  WebKit: "未実施",
};

async function moveTo(x, z, id) {
  let held = [];
  try {
    for (let attempt = 0; attempt < 400; attempt++) {
      const state = await snapshot();
      if (id) {
        const target = state.objects.find((o) => o.id === id);
        if (!target || state.collectedIds.includes(id)) return;
        x = target.position.x;
        z = target.position.z;
      }
      const dx = x - state.hole.x,
        dz = z - state.hole.z;
      if (!id && Math.hypot(dx, dz) < 0.03) return;
      const next = [];
      if (Math.abs(dx) > 0.01) next.push(dx > 0 ? "ArrowRight" : "ArrowLeft");
      if (Math.abs(dz) > 0.01) next.push(dz > 0 ? "ArrowDown" : "ArrowUp");
      for (const key of held.filter((k) => !next.includes(k)))
        await page.keyboard.up(key);
      for (const key of next.filter((k) => !held.includes(k)))
        await page.keyboard.down(key);
      held = next;
      await page.waitForTimeout(60);
    }
    throw new Error("通常のキー操作で対象に到達しません。" + id);
  } finally {
    for (const key of held) await page.keyboard.up(key);
  }
}

try {
  await page.goto(process.env.HOLE_URL || "http://localhost:5173/");
  await page.waitForFunction(() => window.__hole);
  await page
    .getByRole("combobox", { name: "ステージ", exact: true })
    .selectOption("office");
  await page.waitForFunction(
    () => window.__hole?.snapshot().stageId === "office",
  );
  const initial = await snapshot();
  report.seed = initial.seed;
  report.sites = initial.supplySites;
  const mini = initial.supplySites.filter((s) => s.profile === "stationery");
  assert.equal(initial.factories.length, 4);
  assert.equal(mini.length, 2);
  for (const site of mini)
    assert(Math.abs(site.width - initial.supplySites[0].width / 4) < 0.00001);
  const seen = new Map();
  while ((await snapshot()).supply.elapsed < 12) {
    const state = await snapshot();
    for (const object of state.objects.filter((o) =>
      o.sourceId?.startsWith("stationery"),
    )) {
      assert.equal(object.kind, "eraser");
      if (!seen.has(object.id))
        seen.set(object.id, {
          id: object.id,
          siteId: object.sourceId,
          firstSeenTick: state.supply.elapsed,
        });
    }
    await page.waitForTimeout(80);
  }
  const state = await snapshot();
  for (const object of state.objects.filter((o) =>
    o.sourceId?.startsWith("stationery"),
  ))
    if (!seen.has(object.id))
      seen.set(object.id, {
        id: object.id,
        siteId: object.sourceId,
        firstSeenTick: state.supply.elapsed,
      });
  report.emissions = [...seen.values()];
  for (const site of mini) {
    const ticks = report.emissions
      .filter((o) => o.siteId === site.id)
      .map((o) => o.firstSeenTick);
    assert.equal(ticks.length, 6);
    ticks.forEach((tick, index) =>
      assert(Math.abs(tick - (index + 1) * 2) < 0.01),
    );
  }
  const site = mini[0];
  await moveTo(site.x, (site.z + site.outputZ) / 2);
  await page.screenshot({ path: directory + "/small-factory.png" });
  const collected = [];
  for (let attempt = 0; attempt < 50 && collected.length < 8; attempt++) {
    const current = await snapshot();
    const sources = new Set(collected.map((o) => o.sourceId));
    const candidates = current.objects.filter(
      (o) =>
        o.sourceId?.startsWith("stationery") &&
        o.kind === "eraser" &&
        !o.launch &&
        !collected.some((c) => c.id === o.id),
    );
    candidates.sort(
      (a, b) =>
        Number(sources.has(a.sourceId)) - Number(sources.has(b.sourceId)) ||
        Math.hypot(
          a.position.x - current.hole.x,
          a.position.z - current.hole.z,
        ) -
          Math.hypot(
            b.position.x - current.hole.x,
            b.position.z - current.hole.z,
          ),
    );
    const target = candidates[0];
    if (!target) {
      await page.waitForTimeout(2200);
      continue;
    }
    await moveTo(target.position.x, target.position.z, target.id);
    await page.waitForFunction(
      (id) => window.__hole.snapshot().collectedIds.includes(id),
      target.id,
      { timeout: 10000 },
    );
    collected.push({
      id: target.id,
      sourceId: target.sourceId,
      kind: target.kind,
    });
  }
  assert.equal(collected.length, 8);
  assert.equal(new Set(collected.map((o) => o.sourceId)).size, 2);
  const after = await snapshot();
  assert(after.level >= 2);
  assert.equal(
    after.rigidBodies,
    after.objects.length + after.factories.length,
  );
  assert.deepEqual(errors, []);
  Object.assign(report, {
    completed: true,
    collected,
    level: after.level,
    score: after.score,
  });
  await page.screenshot({ path: directory + "/growth.png" });
} catch (error) {
  report.failure = error.stack;
  report.snapshot = await snapshot().catch(() => null);
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
        level: report.level,
        score: report.score,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
