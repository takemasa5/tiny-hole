import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { format } from "prettier";
const directory =
  process.env.HOLE_REPORT_DIR || "reports/egypt-stage-2026-11-07/flow";
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
  const result = { ...state, world: state.egyptWorld };
  if (state.stageId === "egypt" && state.cleared && !clearedSnapshot) {
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
async function moveTo(point, plannedLevel) {
  const level = plannedLevel ?? (await snapshot()).level;
  for (let attempt = 0; attempt < 100; attempt++) {
    const s = await snapshot();
    if (s.stageId !== "egypt" && clearedSnapshot) return;
    if (s.cleared || s.level !== level) return;
    const dx = point.x - s.hole.x,
      dz = point.z - s.hole.z;
    const units = (s.hole.radius * 2) / (s.aperture[1].x - s.aperture[0].x);
    if (Math.hypot(dx, dz) < Math.max(s.hole.radius * 0.08, units * 11)) return;
    const ratio = Math.min(1, (s.hole.radius * 2.8) / Math.hypot(dx, dz));
    await page.mouse.move(640, 400);
    await page.mouse.down();
    await page.mouse.move(655, 400);
    await page.mouse.move(
      640 + (dx * ratio) / units,
      400 + (dz * ratio * (7.6 / Math.hypot(7.6, 6.8))) / units,
      { steps: 2 },
    );
    await page.waitForTimeout(240);
    await page.mouse.up();
    const at = await snapshot();
    for (const god of at.objects.filter(
      (d) => d.id.startsWith("egypt-god-") && d.motion === "fleeing",
    )) {
      report.godsFleeing ??= [];
      if (!report.godsFleeing.includes(god.id)) report.godsFleeing.push(god.id);
    }
    const id = location(at);
    if (!report.entered.includes(id)) {
      report.entered.push(id);
      await page.screenshot({ path: `${directory}/entered-${id}.png` });
    }
  }
  throw new Error(`移動できません: ${JSON.stringify(point)}`);
}
try {
  await page.goto(process.env.HOLE_URL || "http://127.0.0.1:5176/");
  await page.waitForFunction(() => window.__hole);
  await page
    .getByRole("combobox", { name: "ステージ", exact: true })
    .selectOption("egypt");
  await page.waitForFunction(
    () => window.__hole?.snapshot().stageId === "egypt",
  );
  await page.waitForTimeout(500);
  const first = await snapshot(),
    diameter = first.aperture[1].x - first.aperture[0].x;
  assert.equal(first.level, 1);
  assert.equal(first.score, 0);
  report.seed = first.seed;
  report.initialBodies = first.rigidBodies;
  assert(
    first.objects.some((d) => d.id === "goal" && d.visible),
    "開始時に最終目標がありません",
  );
  await page.screenshot({ path: `${directory}/01-notions.png` });
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(1800);
  await page.keyboard.up("ArrowRight");
  const stopped = await snapshot();
  assert(
    stopped.hole.x + stopped.hole.radius <=
      stopped.world.spaces[0].bounds.maxX + 0.001,
  );
  assert(!stopped.world.doors[0].open);
  report.closedMuralBorderBlocks = true;
  const seen = new Set();
  const tries = new Map();
  const start = Date.now();
  for (let attempt = 0; attempt < 280; attempt++) {
    let s = await snapshot();
    if (s.stageId !== "egypt" && clearedSnapshot) break;
    if (!seen.has(s.level)) {
      seen.add(s.level);
      tries.clear();
      assert(Math.abs(s.aperture[1].x - s.aperture[0].x - diameter) < 0.1);
      const row = {
        level: s.level,
        area: s.openedArea,
        space: s.world.label,
        bodies: s.rigidBodies,
        colliders: s.colliders,
        drawCalls: s.drawCalls,
        triangles: s.triangles,
        physicsMilliseconds: s.physicsMilliseconds,
        occlusionMilliseconds: s.occlusionMilliseconds,
        frame: s.frameMilliseconds,
        score: s.score,
      };
      report.levels.push(row);
      console.log(JSON.stringify(row));
      await page.screenshot({ path: `${directory}/level-${s.level}.png` });
      // Gate pivots take time to open; plan only after their physical colliders clear.
      await page.waitForFunction(
        () => {
          const state = window.__hole.snapshot();
          return state.egyptWorld.doors.every(
            (door) => door.requiredLevel > state.level || door.open,
          );
        },
        null,
        { timeout: 2500 },
      );
      if ([6, 8, 9, 11].includes(s.level)) {
        const target =
          s.level === 6
            ? { x: 7, z: 3 }
            : s.level === 8
              ? { x: 60, z: -15 }
              : s.level === 9
                ? { x: 95, z: 20 }
                : { x: 470, z: -100 };
        const path = plan(await snapshot(), target);
        assert(path, `L${s.level}の確認地点へ進めません`);
        for (const point of path) await moveTo(point, s.level);
        const before = await snapshot();
        await page.waitForTimeout(3000);
        const after = await snapshot();
        if (s.level === 6) {
          report.peopleMove = before.objects
            .filter((o) => o.behavior === "work" && o.area === 1)
            .some((o) =>
              after.objects.some(
                (later) =>
                  later.id === o.id &&
                  Math.hypot(
                    later.position.x - o.position.x,
                    later.position.z - o.position.z,
                  ) > 0.1,
              ),
            );
          assert(report.peopleMove, "神官の移動を確認できません");
        }

        if (s.level === 9) {
          const goal = after.objects.find((d) => d.id === "goal");
          assert(goal?.visible, "神殿出口直後にピラミッドが表示されていません");
          report.pyramidAfterExit = {
            hole: after.hole,
            goal: goal.position,
            visible: goal.visible,
            detailed: goal.detailed,
            motion: goal.motion,
          };
          report.cityPeopleMove = before.objects
            .filter((o) => o.area === 3 && o.behavior !== "still")
            .some((o) =>
              after.objects.some(
                (later) =>
                  later.id === o.id &&
                  Math.hypot(
                    later.position.x - o.position.x,
                    later.position.z - o.position.z,
                  ) > 0.1,
              ),
            );
          report.cityPeopleMoveNearExit = report.cityPeopleMove;
        }
        if (s.level === 8) {
          const goal = after.objects.find((d) => d.id === "goal");
          assert.equal(goal.x, 170);
          assert.equal(goal.z, -100);
          assert(goal.visible);
          report.pyramidAtTemple = {
            hole: after.hole,
            goal: goal.position,
            size: goal.size,
            visible: goal.visible,
          };
        }
        if (s.level === 11 && process.env.HOLE_GODS) {
          report.godsMoving = after.objects
            .filter(
              (d) =>
                d.id.startsWith("egypt-god-") &&
                before.objects.some(
                  (old) =>
                    old.id === d.id &&
                    Math.hypot(
                      old.position.x - d.position.x,
                      old.position.z - d.position.z,
                    ) > 1,
                ),
            )
            .map((d) => d.id);
          assert(
            report.godsMoving.length > 0,
            "巨大な神の巡回を確認できません",
          );
          for (
            let attempt = 0;
            attempt < 8 && !report.godsFleeing?.length;
            attempt++
          ) {
            const current = await snapshot();
            const god = current.objects.find(
              (d) => d.id === "egypt-god-anubis" && d.motion !== "falling",
            );
            if (!god || current.level !== 11) break;
            const approach = plan(current, {
              x: god.position.x - current.hole.radius * 1.9,
              z: god.position.z,
            });
            if (!approach) continue;
            for (const point of approach) await moveTo(point, current.level);
          }
        }
        if (s.level === 11)
          report.giants = after.objects
            .filter(
              (o) =>
                ["goal", "landmark"].includes(o.id) || o.egyptKind === "column",
            )
            .map((o) => ({ id: o.id, size: o.size, phase: o.motion }));
        await page.screenshot({ path: `${directory}/detail-${s.level}.png` });
      }
    }
    // Inspection routes move the hole; subsequent paths must use its current position.
    const refreshed = await snapshot();
    if (refreshed.level !== s.level) continue;
    s = refreshed;
    if (s.level === 12 && process.env.HOLE_CITY_TOUR && !report.cityTour) {
      report.cityTour = [];
      for (const target of [
        { id: "northwest", x: -850, z: -850 },
        { id: "southwest", x: -850, z: 850 },
        { id: "northeast", x: 850, z: -850 },
      ]) {
        const path = plan(await snapshot(), target);
        assert(path, `街の${target.id}への経路がありません`);
        for (const point of path) await moveTo(point, s.level);
        const before = await snapshot();
        await page.waitForTimeout(1800);
        const at = await snapshot();
        const movingTraffic = at.objects.filter(
          (d) =>
            d.id.startsWith("egypt-procession-") &&
            before.objects.some(
              (earlier) =>
                earlier.id === d.id &&
                Math.hypot(
                  d.position.x - earlier.position.x,
                  d.position.z - earlier.position.z,
                ) > 1,
            ),
        ).length;

        const buildings = at.objects.filter(
          (d) =>
            d.id.startsWith("egypt-city-") &&
            d.level >= 10 &&
            d.visible &&
            d.screen.x >= 0 &&
            d.screen.x <= 1280 &&
            d.screen.y >= 0 &&
            d.screen.y <= 800,
        );
        assert(
          buildings.length >= 15,
          `${target.id}の街に見えている建物が足りません: ${buildings.length}`,
        );
        report.cityTour.push({
          id: target.id,
          hole: at.hole,
          buildingsOnScreen: buildings.length,
          movingTraffic,
          physicalCityObjects: at.objects.filter(
            (d) => d.id.startsWith("egypt-city-") && d.physical,
          ).length,
          remainingCityObjects: at.objects.filter((d) =>
            d.id.startsWith("egypt-city-"),
          ).length,
          bodies: at.rigidBodies,
          colliders: at.colliders,
          drawCalls: at.drawCalls,
          frame: at.frameMilliseconds,
        });
        await page.screenshot({ path: `${directory}/city-${target.id}.png` });
      }
      s = await snapshot();
    }
    if (s.cleared) break;
    const candidates = s.objects.filter(
      (o) =>
        o.detailed &&
        !o.sourceLevel &&
        o.level <= s.level &&
        ["still", "moored"].includes(o.behavior) &&
        o.collisionFootprint < s.hole.radius * 0.92 &&
        (tries.get(o.id) ?? 0) < 2,
    );
    candidates.sort(
      (a, b) =>
        (b.id === "goal") - (a.id === "goal") ||
        b.value - a.value ||
        Math.hypot(a.position.x - s.hole.x, a.position.z - s.hole.z) -
          Math.hypot(b.position.x - s.hole.x, b.position.z - s.hole.z),
    );
    let selected, path;
    for (const target of candidates) {
      path = plan(s, target.position);
      if (path) {
        selected = target;
        break;
      }
    }
    if (!selected) {
      await page.waitForTimeout(250);
      continue;
    }
    for (const point of path) {
      await moveTo(point, s.level);
      if ((await snapshot()).level !== s.level) break;
    }
    await page.waitForTimeout(selected.id === "goal" ? 2500 : 350);
    if (!(await snapshot()).collectedIds.includes(selected.id))
      tries.set(selected.id, (tries.get(selected.id) ?? 0) + 1);
    if (Date.now() - start > 600000) throw new Error("10分以内に完了しません");
  }
  const final = clearedSnapshot ?? (await snapshot());
  assert(final.cleared, `未クリア L${final.level}`);
  if (process.env.HOLE_GODS)
    assert(report.godsFleeing?.length > 0, "巨大な神の逃走を確認できません");
  assert.equal(final.openedArea, 3);
  assert.equal(final.world.doors.length, 3);
  assert(final.world.doors.every((door) => door.open));
  for (const id of ["mural", "tomb", "temple", "city"])
    assert(report.entered.includes(id), `${id}に入りませんでした`);
  report.final = {
    level: final.level,
    score: final.score,
    cleared: final.cleared,
    bodies: final.rigidBodies,
    collected: final.collectedIds.length,
    doors: final.world.doors,
  };
  if (!clearedSnapshot)
    await page.screenshot({ path: `${directory}/clear.png` });
  await page.waitForFunction(
    () => window.__hole?.snapshot().stageId === "harbor",
    null,
    { timeout: 6500 },
  );
  report.autoTransition = "harbor";
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
