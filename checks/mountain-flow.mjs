import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { format } from "prettier";
const directory =
  process.env.HOLE_REPORT_DIR || "reports/mountain-stage-2026-11-09/flow";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
if (process.env.HOLE_SEED) {
  const seed = Number(process.env.HOLE_SEED);
  assert(Number.isInteger(seed) && seed >= 0 && seed < 4294967296);
  await page.addInitScript((seed) => {
    Math.random = () => seed / 4294967296;
  }, seed);
}
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
let clearedSnapshot;
const snapshot = async () => {
  const state = await page.evaluate(() => window.__hole.snapshot());
  const result = { ...state, world: state.mountainWorld };
  if (state.stageId === "mountain" && state.cleared && !clearedSnapshot) {
    clearedSnapshot = result;
    await page.screenshot({ path: `${directory}/clear.png` });
  }
  return result;
};
const report = {
  browser: await browser.version(),
  errors,
  levels: [],
  entered: [],
  iPhone: "未実施",
  WebKit: "未実施",
};
function plan(state, target) {
  const radius = state.hole.radius,
    pad = radius * 0.05;
  const rects = state.world.walls.map((w) => ({
    minX: w.minX - radius - pad,
    maxX: w.maxX + radius + pad,
    minZ: w.minZ - radius - pad,
    maxZ: w.maxZ + radius + pad,
  }));
  const bounds = state.world.spaces[state.openedArea].bounds;
  const point = { x: target.x, z: target.z };
  for (let pass = 0; pass < 3; pass++)
    for (const b of rects) {
      if (
        point.x > b.minX &&
        point.x < b.maxX &&
        point.z > b.minZ &&
        point.z < b.maxZ
      ) {
        if (b.maxX - b.minX < b.maxZ - b.minZ)
          point.x =
            point.x < (b.minX + b.maxX) / 2 ? b.minX - pad : b.maxX + pad;
        else
          point.z =
            point.z < (b.minZ + b.maxZ) / 2 ? b.minZ - pad : b.maxZ + pad;
      }
    }
  const inside = (p) =>
    p.x >= bounds.minX + radius &&
    p.x <= bounds.maxX - radius &&
    p.z >= bounds.minZ + radius &&
    p.z <= bounds.maxZ - radius;
  if (!inside(point)) return null;
  function blocked(a, b) {
    return rects.some((bounds) => {
      // A real input may stop at the wall, inside the planner's extra clearance.
      // Let it leave that margin while still testing against the physical wall.
      const atMargin =
        a.x > bounds.minX &&
        a.x < bounds.maxX &&
        a.z > bounds.minZ &&
        a.z < bounds.maxZ;
      const inset = atMargin ? pad + radius * 0.00001 : 0;
      const r = {
        minX: bounds.minX + inset,
        maxX: bounds.maxX - inset,
        minZ: bounds.minZ + inset,
        maxZ: bounds.maxZ - inset,
      };
      let low = 0,
        high = 1;
      for (const [axis, min, max] of [
        ["x", r.minX, r.maxX],
        ["z", r.minZ, r.maxZ],
      ]) {
        const delta = b[axis] - a[axis];
        if (Math.abs(delta) < 1e-10) {
          if (a[axis] <= min || a[axis] >= max) return false;
        } else {
          let t0 = (min - a[axis]) / delta,
            t1 = (max - a[axis]) / delta;
          if (t0 > t1) [t0, t1] = [t1, t0];
          low = Math.max(low, t0);
          high = Math.min(high, t1);
          if (low >= high - 1e-10) return false;
        }
      }
      return high > 0 && low < 1;
    });
  }
  const start = { x: state.hole.x, z: state.hole.z };
  const actual = { ...start };
  for (let pass = 0; pass < 3; pass++)
    for (const b of rects) {
      if (
        start.x > b.minX &&
        start.x < b.maxX &&
        start.z > b.minZ &&
        start.z < b.maxZ
      ) {
        const clear = radius * 0.3;
        if (b.maxX - b.minX < b.maxZ - b.minZ)
          start.x =
            start.x < (b.minX + b.maxX) / 2 ? b.minX - clear : b.maxX + clear;
        else
          start.z =
            start.z < (b.minZ + b.maxZ) / 2 ? b.minZ - clear : b.maxZ + clear;
      }
    }
  const escape =
    Math.hypot(start.x - actual.x, start.z - actual.z) > radius * 0.01
      ? [start]
      : [];
  if (!blocked(start, point)) return [...escape, point];
  const offset = radius * 0.25;
  const nodes = [start, point];
  for (const r of rects)
    for (const x of [r.minX - offset, r.maxX + offset])
      for (const z of [r.minZ - offset, r.maxZ + offset]) {
        const p = { x, z };
        if (
          inside(p) &&
          !rects.some(
            (b) => x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ,
          )
        )
          nodes.push(p);
      }
  const costs = nodes.map(() => Infinity),
    parents = [],
    done = new Set();
  costs[0] = 0;
  for (let step = 0; step < nodes.length; step++) {
    let index = -1;
    for (let i = 0; i < nodes.length; i++)
      if (
        !done.has(i) &&
        Number.isFinite(costs[i]) &&
        (index < 0 || costs[i] < costs[index])
      )
        index = i;
    if (index < 0) return null;
    if (index === 1) {
      const path = [];
      for (let i = 1; i !== 0; i = parents[i]) path.unshift(nodes[i]);
      return [...escape, ...path];
    }
    done.add(index);
    for (let i = 1; i < nodes.length; i++)
      if (!done.has(i) && !blocked(nodes[index], nodes[i])) {
        const cost =
          costs[index] +
          Math.hypot(nodes[index].x - nodes[i].x, nodes[index].z - nodes[i].z);
        if (cost < costs[i]) {
          costs[i] = cost;
          parents[i] = index;
        }
      }
  }
  return null;
}
function location(s) {
  const p = s.hole;
  return s.world.spaces.find(
    (a) =>
      p.x >= a.bounds.minX &&
      p.x <= a.bounds.maxX &&
      p.z >= a.bounds.minZ &&
      p.z <= a.bounds.maxZ,
  )?.id;
}
try {
  await page.goto(process.env.HOLE_URL || "http://127.0.0.1:5178/");
  await page.waitForFunction(() => window.__hole);
  await page
    .getByRole("combobox", { name: "ステージ", exact: true })
    .selectOption("mountain");
  await page.waitForFunction(
    () => window.__hole?.snapshot().stageId === "mountain",
  );
  await page.waitForTimeout(500);
  const initial = await snapshot();
  report.seed = initial.seed;
  report.source = await page.evaluate(async (seed) => {
    const { createGrowthStage } = await import("/src/game/growth-stage.ts");
    const ds = createGrowthStage(seed, "mountain");
    return {
      total: ds.length,
      kinds: [...new Set(ds.map((d) => d.mountainKind))],
      stock: ds.filter((d) => d.id.startsWith("growth-")).length,
      moving: ds.filter((d) => d.route).length,
      groves: new Set(
        ds
          .filter((d) => d.id.startsWith("mountain-grove-"))
          .map((d) => d.id.split("-").slice(2, 4).join("-")),
      ).size,
      stackedLogs: ds.filter((d) => d.id.startsWith("mountain-stack-")).length,
    };
  }, initial.seed);

  assert(initial.objects.some((d) => d.id === "goal" && d.visible));
  await page.screenshot({ path: `${directory}/start.png` });
  const held = new Set();
  const steer = async (dx, dz) => {
    const desired = new Set();
    const length = Math.hypot(dx, dz);
    if (length > 0.0001) {
      if (Math.abs(dx) > length * 0.32)
        desired.add(dx > 0 ? "ArrowRight" : "ArrowLeft");
      if (Math.abs(dz) > length * 0.32)
        desired.add(dz > 0 ? "ArrowDown" : "ArrowUp");
    }
    for (const key of held)
      if (!desired.has(key)) {
        await page.keyboard.up(key);
        held.delete(key);
      }
    for (const key of desired)
      if (!held.has(key)) {
        await page.keyboard.down(key);
        held.add(key);
      }
  };
  const skipUntil = new Map();
  const seen = new Set(),
    start = Date.now();
  let targetId,
    stalled = 0,
    lastDistance = Infinity;
  for (let attempt = 0; attempt < 7000; attempt++) {
    let s = await snapshot();
    if ((s.stageId !== "mountain" && clearedSnapshot) || s.cleared) break;
    if (!seen.has(s.level)) {
      seen.add(s.level);
      targetId = undefined;
      report.levels.push({
        level: s.level,
        area: s.openedArea,
        space: s.world.label,
        score: s.score,
        bodies: s.rigidBodies,
        colliders: s.colliders,
        drawCalls: s.drawCalls,
        frame: s.frameMilliseconds,
      });
      console.log(JSON.stringify(report.levels.at(-1)));
      await page.screenshot({ path: `${directory}/level-${s.level}.png` });
    }
    await page.waitForFunction(
      () => {
        const s = window.__hole.snapshot();
        return (
          s.stageId !== "mountain" ||
          s.mountainWorld.doors.every(
            (d) => d.requiredLevel > s.level || d.open,
          )
        );
      },
      null,
      { timeout: 3000 },
    );
    s = await snapshot();
    if (s.cleared || s.stageId !== "mountain") break;
    const locationId = location(s);
    if (!report.entered.includes(locationId)) {
      report.entered.push(locationId);
      await page.screenshot({ path: `${directory}/entered-${locationId}.png` });
    }
    report.fleeing ??= [];
    for (const d of s.objects.filter(
      (d) => d.motion === "fleeing" && d.mountainKind,
    ))
      if (!report.fleeing.includes(d.mountainKind))
        report.fleeing.push(d.mountainKind);
    report.activity ??= [];
    for (const d of s.objects.filter(
      (d) =>
        d.behaviorActive &&
        (d.motion === "waiting" ||
          Math.hypot(d.velocity.x, d.velocity.z) > 0.01) &&
        ["tanuki", "deer", "fox", "truck"].includes(d.mountainKind),
    )) {
      const key = `${d.mountainKind}:${d.motion}`;
      if (!report.activity.includes(key)) report.activity.push(key);
    }
    const candidates = s.objects.filter(
      (d) =>
        (skipUntil.get(d.id) ?? 0) < Date.now() &&
        d.detailed &&
        (d.id === "goal" || d.id.startsWith("growth-")) &&
        d.level <= s.level &&
        d.collisionFootprint < s.hole.radius * 0.98,
    );
    candidates.sort(
      (a, b) =>
        (b.id === "goal") - (a.id === "goal") ||
        b.level - a.level ||
        Math.hypot(a.position.x - s.hole.x, a.position.z - s.hole.z) -
          Math.hypot(b.position.x - s.hole.x, b.position.z - s.hole.z),
    );
    let selected = candidates.find((d) => d.id === targetId),
      path;
    if (selected) path = plan(s, selected.position);
    if (!path) {
      for (const d of candidates) {
        const p = plan(s, d.position);
        if (p) {
          selected = d;
          path = p;
          break;
        }
      }
    }
    if (!selected || !path) {
      await page.waitForTimeout(150);
      continue;
    }
    if (selected.id !== targetId) {
      targetId = selected.id;
      stalled = 0;
      lastDistance = Infinity;
    }
    const distance = Math.hypot(
      selected.position.x - s.hole.x,
      selected.position.z - s.hole.z,
    );
    if (distance >= lastDistance - s.hole.radius * 0.02) stalled++;
    else stalled = Math.max(0, stalled - 1);
    lastDistance = distance;
    let point = path[0];
    if (path.length === 1 && selected.motion !== "falling") {
      const lead = Math.min(0.6, distance / (s.hole.radius * 7));
      const intercept = {
        x: selected.position.x + selected.velocity.x * lead,
        z: selected.position.z + selected.velocity.z * lead,
      };
      const predicted = plan(s, intercept);
      if (predicted) point = predicted[0];
    }
    if (stalled > 70) {
      skipUntil.set(targetId, Date.now() + 5000);
      targetId = undefined;
      stalled = 0;
      await page.waitForTimeout(100);
      continue;
    }
    const dx = point.x - s.hole.x,
      dz = point.z - s.hole.z;
    await steer(dx, dz);
    await page.waitForTimeout(90);
    if (attempt % 50 === 0) {
      const live = await snapshot();
      await writeFile(
        `${directory}/live.json`,
        JSON.stringify({
          level: live.level,
          score: live.score,
          hole: live.hole,
          goal: live.objects.find((d) => d.id === "goal"),
          target: selected.id,
          targetPosition: selected.position,
          targetMotion: selected.motion,
          distance,
          attempt,
          stageId: live.stageId,
        }),
      );
      console.log(
        JSON.stringify({
          progress: live.level,
          score: live.score,
          target: selected.id,
          distance,
        }),
      );
    }
    if (Date.now() - start > 720000) throw new Error("12分でクリアできません");
  }
  await steer(0, 0);
  const final = clearedSnapshot ?? (await snapshot());
  assert(final.cleared, `未クリア ${final.stageId} L${final.level}`);
  report.final = {
    level: final.level,
    score: final.score,
    cleared: final.cleared,
    collected: final.collectedIds.length,
    moving: final.collectedMoving,
  };
  assert(
    report.activity?.includes("tanuki:working"),
    "巣と餌場を往復するたぬきが未確認",
  );
  assert(
    report.activity?.includes("truck:driving"),
    "丸太トラックの走行が未確認",
  );
  await page.waitForFunction(
    () => window.__hole?.snapshot().stageId === "america",
    null,
    { timeout: 6500 },
  );
  report.autoTransition = "america";
  for (const id of ["roots", "camp", "lumberyard", "deepForest", "sanctuary"])
    assert(report.entered.includes(id), `${id}未通過`);
  assert.deepEqual(errors, []);
} catch (error) {
  report.failure = error.stack;
  report.lastState = await snapshot().catch(() => null);
  await page.screenshot({ path: `${directory}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await writeFile(
    `${directory}/results.json`,
    await format(JSON.stringify(report), { parser: "json" }),
  );
  await browser.close();
}
