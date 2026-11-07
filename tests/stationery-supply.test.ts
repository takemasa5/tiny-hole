import { beforeAll, expect, it } from "vitest";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  STAGE_IDS,
  STATIONERY_SITE_IDS,
  createSupplySites,
  levelsForStage,
  levelForScore,
  OBJECT_TYPES,
  createStage,
  objectFootprint,
} from "../src/game/stage";
import {
  createObjectSupply,
  supplyRequest,
  finishSupplyAttempt,
  randomStationeryKind,
  STATIONERY_KINDS,
  findSupplyPlacement,
  supplyLaunch,
  supplyMouth,
} from "../src/game/object-supply";
import {
  createSupplyFactory,
  releaseSupplyFactory,
  supplyFactoryTop,
} from "../src/game/supply-factory";
import { createFloor, updateFloor } from "../src/game/floor";
import { disposeScene } from "../src/game/visuals";

beforeAll(async () => {
  await RAPIER.init();
});

it("小型工場は会社だけに2か所追加し、通常工場の4分の1の寸法にする", () => {
  for (const id of STAGE_IDS) {
    const sites = createSupplySites(42, id);
    expect(sites).toHaveLength(id === "office" ? 4 : 2);
    expect(sites.filter((s) => s.profile === "stationery")).toHaveLength(
      id === "office" ? 2 : 0,
    );
  }
  const sites = createSupplySites(42, "office");
  for (const site of sites.filter((s) => s.profile)) {
    expect(site.width).toBeCloseTo(sites[0].width / 4);
    expect(site.height).toBeCloseTo(sites[0].height / 4);
    expect(site.depth).toBeCloseTo(sites[0].depth / 4);
    expect(Math.hypot(site.x, site.z)).toBeGreaterThanOrEqual(1.2);
    expect(Math.hypot(site.x, site.z)).toBeLessThan(3);
  }
});

it("小型工場は各2秒おきに供給し、通常工場の8秒・12秒の供給も続ける", () => {
  const state = createObjectSupply(42, "office");
  const stock = createStage(42, "office").map((object) => ({
    ...object,
    footprint: objectFootprint(object.kind, "office"),
    falling: false,
  }));
  const times: Record<string, number[]> = {
    food: [],
    depot: [],
    stationeryA: [],
    stationeryB: [],
  };
  for (let second = 1; second <= 12; second++) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const request = supplyRequest(
        state,
        3,
        120,
        stock,
        attempt === 0 ? 1 : 0,
      );
      if (!request) break;
      times[request.siteId].push(second);
      if (request.siteId.startsWith("stationery"))
        expect(STATIONERY_KINDS).toContain(request.kind);
      finishSupplyAttempt(state, request.siteId, true);
    }
  }
  expect(times.food).toEqual([8]);
  expect(times.depot).toEqual([12]);
  for (const id of STATIONERY_SITE_IDS)
    expect(times[id]).toEqual([2, 4, 6, 8, 10, 12]);
});

it("小型工場の候補は小物4種だけで、倒れても現在の穴へ収まる", () => {
  const state = createObjectSupply(42, "office");
  const levels = levelsForStage("office");
  for (const level of levels) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const kind = randomStationeryKind(state, level.radius);
      expect(STATIONERY_KINDS).toContain(kind);
      expect(Math.hypot(...OBJECT_TYPES[kind].size) / 2).toBeLessThan(
        level.radius * 0.99,
      );
      if (level.radius === 0.08) expect(kind).toBe("eraser");
    }
  }
  expect(
    new Set(
      Array.from({ length: 100 }, () => randomStationeryKind(state, 1.6)),
    ),
  ).toEqual(new Set(STATIONERY_KINDS));
});

it("初期在庫を全て失っても小型工場で家具の段階まで成長し、その後は通常工場で続けられる", () => {
  const state = createObjectSupply(42, "office");
  let score = 0;
  const seen = new Set([0]);
  for (let second = 1; second < 1800 && score < 720; second++) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const level = levelForScore(score, levelsForStage("office"));
      const request = supplyRequest(
        state,
        level,
        score,
        [],
        attempt === 0 ? 1 : 0,
        STATIONERY_SITE_IDS,
      );
      if (!request) break;
      expect(STATIONERY_SITE_IDS).toContain(request.siteId);
      score += OBJECT_TYPES[request.kind].value;
      finishSupplyAttempt(state, request.siteId, true);
      seen.add(levelForScore(score, levelsForStage("office")));
    }
  }
  expect(score).toBeGreaterThanOrEqual(720);
  expect([...seen]).toEqual([0, 1, 2, 3, 4, 5]);
  const stopped = { ...state.spawnedBySite };
  expect(
    supplyRequest(state, 5, score, [], 100, STATIONERY_SITE_IDS),
  ).toBeUndefined();
  for (let attempt = 0; attempt < 300 && score < 2700; attempt++) {
    const level = levelForScore(score, levelsForStage("office"));
    const request = supplyRequest(state, level, score, [], 2)!;
    expect(["food", "depot"]).toContain(request.siteId);
    score += OBJECT_TYPES[request.kind].value;
    finishSupplyAttempt(state, request.siteId, true);
    seen.add(levelForScore(score, levelsForStage("office")));
  }
  expect(state.spawnedBySite.stationeryA).toBe(stopped.stationeryA);
  expect(state.spawnedBySite.stationeryB).toBe(stopped.stationeryB);
  expect(score).toBeGreaterThanOrEqual(2700);
  expect([...seen]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  expect(supplyRequest(state, 7, score, [], 100, [])).toBeUndefined();
});

it("小物供給にも各拠点8個とマップ全体の上限を適用する", () => {
  const state = createObjectSupply(42, "office");
  const stock = Array.from({ length: 8 }, (_, index) => ({
    id: "item" + index,
    kind: "eraser" as const,
    x: 8,
    z: 8,
    footprint: 0.03,
    falling: false,
    sourceId: "stationeryA" as const,
  }));
  expect(
    findSupplyPlacement(state, "stationeryA", "eraser", stock, {
      x: 0,
      z: 0,
      radius: 0.08,
    }),
  ).toBeUndefined();
  expect(
    findSupplyPlacement(
      state,
      "stationeryB",
      "eraser",
      Array.from({ length: state.maxObjects }, (_, index) => ({
        ...stock[0],
        id: "full" + index,
      })),
      { x: 0, z: 0, radius: 0.08 },
    ),
  ).toBeUndefined();
});

it.each(STATIONERY_SITE_IDS)(
  "%sはレベル6で供給停止し、穴が覆うまで固定されたままで回収できる",
  (id) => {
    const state = createObjectSupply(42, "office");
    const site = state.sites.find((s) => s.id === id)!;
    const definition = findSupplyPlacement(state, id, "eraser", [], {
      x: 0,
      z: 0,
      radius: 0.08,
    })!;
    expect(definition).toBeDefined();
    const launch = supplyLaunch(definition, state.sites);
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const floor = createFloor(world);
    const radius = levelsForStage("office")[5].radius;
    updateFloor(floor, site.x, site.z, radius, 36);
    const factory = createSupplyFactory(world, site);
    const mouth = factory.mesh
      .getObjectByName("supply-mouth")!
      .getWorldPosition(new THREE.Vector3());
    expect(mouth.x).toBeCloseTo(supplyMouth(site).x);
    expect(mouth.y).toBeCloseTo(supplyMouth(site).y + 0.005 * site.scale, 4);
    expect(launch.duration).toBe(0.9);
    expect(launch.velocity.y).toBeGreaterThan(0);
    const endY =
      launch.position.y +
      launch.velocity.y * launch.duration -
      0.5 * 9.81 * launch.gravityScale * launch.duration ** 2;
    expect(endY).toBeCloseTo(definition.y, 6);
    const hole = { x: site.x, z: site.z, radius };
    expect(releaseSupplyFactory(factory, 5, hole)).toBe(false);
    expect(supplyRequest(state, 5, 720, [], 100, [id])).toBeUndefined();
    expect(releaseSupplyFactory(factory, 6, { ...hole, x: site.x + 2 })).toBe(
      false,
    );
    expect(factory.body.isFixed()).toBe(true);
    expect(releaseSupplyFactory(factory, 6, hole)).toBe(true);
    for (let step = 0; step < 120; step++) world.step();
    expect(supplyFactoryTop(factory)).toBeLessThan(-1.2);
    disposeScene(factory.mesh);
    world.free();
  },
);
