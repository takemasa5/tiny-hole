export interface PointerGesture {
  id: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  dragging: boolean;
  startedAt: number;
}

export function moveGesture(gesture: PointerGesture, x: number, y: number) {
  let dx = 0;
  let dy = 0;
  if (gesture.dragging) {
    dx = x - gesture.x;
    dy = y - gesture.y;
  } else if (Math.hypot(x - gesture.startX, y - gesture.startY) > 8) {
    gesture.dragging = true;
    dx = x - gesture.startX;
    dy = y - gesture.startY;
  }
  gesture.x = x;
  gesture.y = y;
  return { dx, dy };
}

export function isTap(
  gesture: PointerGesture,
  x: number,
  y: number,
  now: number,
) {
  return (
    !gesture.dragging &&
    Math.hypot(x - gesture.startX, y - gesture.startY) <= 8 &&
    now - gesture.startedAt <= 500
  );
}
