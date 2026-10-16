import { beforeAll, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { isTap, moveGesture, type PointerGesture } from "../src/game/gesture";
import { standTarget } from "../src/game/target";
import { Progress, type PlacedObject } from "../src/game/stage";
import { isMovementKey, keyboardDirection } from "../src/game/keyboard";

it("WASDと矢印は同じ方向、斜めと同方向の重複は加速せず、逆方向は相殺する", () => {
  expect(isMovementKey("ArrowUp")).toBe(true);
  expect(isMovementKey("Space")).toBe(false);
  expect(keyboardDirection(new Set(["KeyW"]))).toEqual({ x: 0, z: -1 });
  expect(keyboardDirection(new Set(["ArrowRight"]))).toEqual({ x: 1, z: 0 });
  expect(keyboardDirection(new Set(["KeyD", "ArrowRight"]))).toEqual({
    x: 1,
    z: 0,
  });
  expect(keyboardDirection(new Set(["KeyW", "KeyS"]))).toEqual({ x: 0, z: 0 });
  const diagonal = keyboardDirection(new Set(["KeyW", "KeyD"]));
  expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(1);
  expect(keyboardDirection(new Set())).toEqual({ x: 0, z: 0 });
});

beforeAll(async () => {
  await RAPIER.init();
});

function gesture(): PointerGesture {
  return {
    id: 1,
    startX: 100,
    startY: 100,
    x: 100,
    y: 100,
    dragging: false,
    startedAt: 0,
  };
}

it("タップの小さな揺れでは穴を動かさず、長押しやドラッグ帰還をタップにしない", () => {
  const tap = gesture();
  expect(moveGesture(tap, 104, 102)).toEqual({ dx: 0, dy: 0 });
  expect(isTap(tap, 104, 102, 200)).toBe(true);
  expect(isTap(tap, 104, 102, 700)).toBe(false);
  expect(moveGesture(tap, 120, 100)).toEqual({ dx: 20, dy: 0 });
  moveGesture(tap, 100, 100);
  expect(isTap(tap, 100, 100, 300)).toBe(false);
});

it("目標物だけを現在位置で直立させ、速度を止めても成長量は変えない", () => {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(4, 3, -5),
  );
  world.createCollider(RAPIER.ColliderDesc.cuboid(3, 6.5, 3), body);
  body.setRotation(
    { x: Math.sin(Math.PI / 4), y: 0, z: 0, w: Math.cos(Math.PI / 4) },
    true,
  );
  body.setLinvel({ x: 3, y: -2, z: 1 }, true);
  body.setAngvel({ x: 1, y: 2, z: 3 }, true);
  const definition: PlacedObject = {
    id: "goal",
    kind: "monument",
    x: -8,
    z: -17,
    y: 6.52,
    yaw: Math.PI / 2,
  };
  const progress = new Progress();
  progress.collect({ id: "parcel", kind: "parcel" });
  expect(standTarget(body, definition, progress.cleared)).toBe(true);
  expect(body.translation().x).toBe(4);
  expect(body.translation().y).toBeCloseTo(6.52);
  expect(body.translation().z).toBe(-5);
  expect(body.rotation().x).toBe(0);
  expect(body.rotation().z).toBe(0);
  expect(body.linvel()).toEqual({ x: 0, y: 0, z: 0 });
  expect(body.angvel()).toEqual({ x: 0, y: 0, z: 0 });
  expect(progress.score).toBe(1);
  expect(progress.cleared).toBe(false);
  expect(
    standTarget(body, { ...definition, id: "house", kind: "house" }, false),
  ).toBe(false);
  expect(standTarget(body, definition, true)).toBe(false);
  expect(standTarget(body, definition, false, 2)).toBe(true);
  expect(body.translation().y).toBeCloseTo(8.52);
  world.free();
});
