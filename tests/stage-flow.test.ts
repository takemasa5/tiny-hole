import { expect, it } from "vitest";
import { nextStageId, STAGE_TRANSITION_DELAY } from "../src/game/stage-flow";

it("全8ステージを追加順で巡回し、約3秒後に進む", () => {
  expect(
    [
      "plaza",
      "mountain",
      "america",
      "egypt",
      "harbor",
      "toys",
      "office",
      "hell",
    ].map((id) => nextStageId(id as Parameters<typeof nextStageId>[0])),
  ).toEqual([
    "mountain",
    "america",
    "egypt",
    "harbor",
    "toys",
    "office",
    "hell",
    "plaza",
  ]);
  expect(STAGE_TRANSITION_DELAY).toBe(3000);
});
