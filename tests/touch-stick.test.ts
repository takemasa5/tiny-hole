import { expect, it } from "vitest";
import { isTap, moveGesture, type PointerGesture } from "../src/game/gesture";
import { stickInput } from "../src/game/touch-stick";

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
it("指の揺れでは動かず、スティックを戻すと停止し、タップと混同しない", () => {
  const pointer = gesture();
  moveGesture(pointer, 107, 101);
  expect(stickInput(pointer).strength).toBe(0);
  expect(isTap(pointer, 107, 101, 200)).toBe(true);
  moveGesture(pointer, 148, 100);
  expect(stickInput(pointer).x).toBe(1);
  moveGesture(pointer, 100, 100);
  expect(stickInput(pointer).strength).toBe(0);
  expect(isTap(pointer, 100, 100, 300)).toBe(false);
});
it.each([
  [48, 0, 1, 0],
  [-48, 0, -1, 0],
  [0, 48, 0, 1],
  [0, -48, 0, -1],
])("入力(%s,%s)は対応する方向へ最高速を出す", (dx, dy, x, z) => {
  const pointer = gesture();
  moveGesture(pointer, pointer.startX + dx, pointer.startY + dy);
  const input = stickInput(pointer);
  expect(input.x).toBeCloseTo(x);
  expect(input.z).toBeCloseTo(z);
  expect(input.strength).toBe(1);
});
it("中間の倒し具合で微速になり、指が動かなくても同じ入力を維持する", () => {
  const pointer = gesture();
  moveGesture(pointer, 128, 100);
  const first = stickInput(pointer);
  expect(first.x).toBeCloseTo(0.5);
  for (let frame = 0; frame < 600; frame++)
    expect(stickInput(pointer)).toEqual(first);
});
it.each([
  [36, 36],
  [-80, 40],
  [5, -90],
])(
  "入力(%s,%s)でも加速せず、画面の斜め方向を地面の方向に変換する",
  (dx, dy) => {
    const pointer = gesture();
    moveGesture(pointer, pointer.startX + dx, pointer.startY + dy);
    const input = stickInput(pointer);
    expect(Math.hypot(input.x, input.z)).toBeCloseTo(1);
    expect(Math.hypot(input.knobX, input.knobY)).toBeLessThanOrEqual(48.000001);
    expect((input.z * (7.6 / Math.hypot(7.6, 6.8))) / input.x).toBeCloseTo(
      dy / dx,
    );
  },
);
it("小さく倒したときの感度を抑え、48px以上の入力で最大速度になる", () => {
  const pointer = gesture();
  for (const [distance, strength] of [
    [22, 0.35],
    [36, 0.7],
    [47, 0.975],
    [48, 1],
    [80, 1],
  ]) {
    moveGesture(pointer, pointer.startX + distance, pointer.startY);
    expect(stickInput(pointer).strength).toBeCloseTo(strength);
  }
});
