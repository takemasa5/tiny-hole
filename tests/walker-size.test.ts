import { expect, it } from "vitest";
import {
  STAGE_IDS,
  STAGES,
  walkingKindsForStage,
  type StageDefinition,
} from "../src/game/stage";
import { objectCollisionFootprint } from "../src/game/object-shape";
import {
  createWalker,
  walkerVelocity,
  WALK_SPEED,
  RUN_SPEED,
} from "../src/game/walker";

const cases = STAGE_IDS.flatMap((stageId) =>
  walkingKindsForStage(stageId).map((kind) => ({ stageId, kind })),
);

it.each(cases)(
  "$stageIdの$kindは飲み込めない穴では通常歩行し、入る穴だけから逃げる",
  ({ stageId, kind }) => {
    const footprint = objectCollisionFootprint(kind, {
      x: 0,
      y: 0,
      z: 0,
      w: 1,
    });
    const position = { x: footprint + 1, z: 0 };
    const stage: StageDefinition = STAGES[stageId];
    const speeds = stage.moving.speeds;
    const walker = createWalker(0, () => 0.5);
    const velocity = walkerVelocity(
      walker,
      position,
      { x: 0, z: 0, radius: footprint * 0.75 },
      footprint,
      1 / 60,
      () => 0.5,
      50,
      speeds,
    );
    expect(walker.mode).toBe("walking");
    expect(walker.heading).toBe(0);
    expect(velocity.x).toBe(0);
    expect(velocity.z).toBeCloseTo(speeds?.walk ?? WALK_SPEED);
    const fleeing = walkerVelocity(
      walker,
      position,
      { x: 0, z: 0, radius: footprint * 1.3 },
      footprint,
      1 / 60,
      () => 0.5,
      50,
      speeds,
    );
    expect(walker.mode).toBe("fleeing");
    expect(fleeing.x).toBeCloseTo(speeds?.run ?? RUN_SPEED);
    expect(fleeing.z).toBeCloseTo(0);
  },
);

it("逃走中でも穴に入らない大きさなら通常歩行へ戻す", () => {
  const walker = createWalker(0, () => 0.5);
  walker.mode = "fleeing";
  const velocity = walkerVelocity(
    walker,
    { x: 1, z: 0 },
    { x: 0, z: 0, radius: 0.08 },
    0.35,
    1 / 60,
    () => 0.5,
  );
  expect(walker.mode).toBe("walking");
  expect(Math.hypot(velocity.x, velocity.z)).toBeCloseTo(WALK_SPEED);
});

it("穴と同じ半径では逃げず、縁より内側に収まる大きさから逃げる", () => {
  const walker = createWalker(0, () => 0.5);
  walkerVelocity(
    walker,
    { x: 1, z: 0 },
    { x: 0, z: 0, radius: 0.35 },
    0.35,
    1 / 60,
    () => 0.5,
  );
  expect(walker.mode).toBe("walking");
  walkerVelocity(
    walker,
    { x: 1, z: 0 },
    { x: 0, z: 0, radius: 0.36 },
    0.35,
    1 / 60,
    () => 0.5,
  );
  expect(walker.mode).toBe("fleeing");
});
