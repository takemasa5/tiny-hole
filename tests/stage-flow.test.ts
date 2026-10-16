import { expect, it } from "vitest";
import { nextStageId, STAGE_TRANSITION_DELAY } from "../src/game/stage-flow";

it("広場・山・アメリカ・エジプトの順で巡回し、約3秒後に進む", () => {
  expect(
    ["plaza", "mountain", "america", "egypt"].map((id) =>
      nextStageId(id as Parameters<typeof nextStageId>[0]),
    ),
  ).toEqual(["mountain", "america", "egypt", "plaza"]);
  expect(STAGE_TRANSITION_DELAY).toBe(3000);
});
