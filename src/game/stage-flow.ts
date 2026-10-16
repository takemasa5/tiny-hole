import { STAGE_IDS, type StageId } from "./stage";

export const STAGE_TRANSITION_DELAY = 3000;

export function nextStageId(stageId: StageId): StageId {
  return STAGE_IDS[(STAGE_IDS.indexOf(stageId) + 1) % STAGE_IDS.length];
}
