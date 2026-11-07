import { expect, it } from "vitest";
import {
  STAGES,
  STAGE_IDS,
  levelsForStage,
  mapHalfSizeForStage,
  roadsForStage,
  stageScaleForStage,
  isWalkingKind,
  createStage,
  createSupplySites,
  objectFootprint,
  placementClusters,
  seededRandom,
  OBJECT_TYPES,
} from "../src/game/stage";
import {
  createObjectSupply,
  randomSupplyKind,
  supplyRequest,
  finishSupplyAttempt,
  findSupplyPlacement,
  supplyLaunch,
} from "../src/game/object-supply";
import { canSweep, createStreetSweeper } from "../src/game/street-sweeper";

it.each(STAGE_IDS)(
  "%s: 工場を再現可能なランダム配置とし、物・穴・境界から離す",
  (stageId) => {
    const levels = levelsForStage(stageId);
    const scale = stageScaleForStage(stageId);
    const positions = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const sites = createSupplySites(seed, stageId);
      expect(sites).toEqual(createSupplySites(seed, stageId));
      positions.add(JSON.stringify(sites));
      const objects = createStage(seed, stageId);
      expect(
        objects.filter(({ kind }) => kind === "streetSweeper"),
      ).toHaveLength(1);
      for (const site of sites) {
        const footprint = Math.hypot(site.width, site.depth) / 2;
        expect(
          Math.max(Math.abs(site.x), Math.abs(site.z)) + footprint,
        ).toBeLessThan(mapHalfSizeForStage(stageId));
        expect(Math.hypot(site.x, site.z)).toBeGreaterThan(
          footprint + levels[0].radius,
        );
        for (const object of objects) {
          expect(
            Math.hypot(site.x - object.x, site.z - object.z),
          ).toBeGreaterThan(footprint + objectFootprint(object.kind, stageId));
        }
        if (STAGES[stageId].placement === "roadside") {
          expect(
            roadsForStage(stageId).some((road) => {
              const distance =
                Math.abs(
                  (road.axis === "x" ? site.z : site.x) - road.position,
                ) -
                road.width / 2 -
                footprint;
              return distance >= 0.39 * scale && distance <= 7.41 * scale;
            }),
          ).toBe(true);
        } else {
          expect(
            placementClusters(seed, STAGES[stageId].placement).some(
              (center) =>
                Math.max(
                  Math.abs(center.x - site.x),
                  Math.abs(center.z - site.z),
                ) <= 7,
            ),
          ).toBe(true);
        }
      }
    }
    expect(positions.size).toBe(30);
  },
);

it.each(STAGE_IDS)(
  "%s: 両工場がそのステージの全種類からランダム供給し、初期個数でも供給できる",
  (stageId) => {
    const levels = levelsForStage(stageId);
    const state = createObjectSupply(42, stageId);
    const kinds = new Set<string>(
      STAGES[stageId].groups.map(({ kind }) => kind),
    );
    const seen = new Set<string>();
    const stock = createStage(42, stageId).map((object) => ({
      ...object,
      footprint: objectFootprint(object.kind, stageId),
      falling: false,
    }));
    expect(state.maxObjects).toBeGreaterThanOrEqual(stock.length + 16);
    for (let index = 0; index < 200; index++) {
      const request = supplyRequest(state, 7, 2700, stock, 12)!;
      expect(request).toBeDefined();
      expect(kinds.has(request.kind)).toBe(true);
      seen.add(request.kind);
      finishSupplyAttempt(state, request.siteId, true);
    }
    expect(seen).toEqual(kinds);
    const random = seededRandom(53);
    state.random = random;
    const kind = randomSupplyKind(state);
    const supplied = findSupplyPlacement(state, "food", kind, stock, {
      x: 0,
      z: 0,
      radius: levels[0].radius,
    });
    expect(supplied).toBeDefined();
    expect(supplyLaunch(supplied!, state.sites).duration).toBe(0.9);
  },
);

it.each(STAGE_IDS)(
  "%s: 成長在庫が空でも、飲み込める候補からランダム補充して全段階へ進める",
  (stageId) => {
    const levels = levelsForStage(stageId);
    for (let level = 0; level < 7; level++) {
      const state = createObjectSupply(42, stageId);
      let score: number = levels[level].threshold;
      for (
        let attempt = 0;
        score < levels[level + 1].threshold && attempt < 300;
        attempt++
      ) {
        const request = supplyRequest(state, level, score, [], 2)!;
        expect(request.recovery).toBe(true);
        expect(objectFootprint(request.kind)).toBeLessThan(
          levels[level].radius * 0.99,
        );
        score += OBJECT_TYPES[request.kind].value;
        finishSupplyAttempt(state, request.siteId, true);
      }
      expect(score).toBeGreaterThanOrEqual(levels[level + 1].threshold);
    }
  },
);

it("清掃車は初期対象を固定せず、全ステージの通常物を押す", () => {
  expect(createStreetSweeper().targetId).toBeUndefined();
  for (const stageId of STAGE_IDS) {
    for (const { kind } of STAGES[stageId].groups)
      expect(
        canSweep({
          id: "prop",
          kind,
          x: 0,
          z: 0,
          y: OBJECT_TYPES[kind].size[1] / 2,
          falling: false,
        }),
      ).toBe(!isWalkingKind(kind));
    expect(
      canSweep({
        id: "goal",
        kind: STAGES[stageId].goal,
        x: 0,
        z: 0,
        y: 0,
        falling: false,
      }),
    ).toBe(false);
  }
});
