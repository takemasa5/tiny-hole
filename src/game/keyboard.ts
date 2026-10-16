const MOVEMENT_KEYS = new Set([
  "KeyW",
  "ArrowUp",
  "KeyS",
  "ArrowDown",
  "KeyA",
  "ArrowLeft",
  "KeyD",
  "ArrowRight",
]);

export function isMovementKey(code: string) {
  return MOVEMENT_KEYS.has(code);
}

export function keyboardDirection(keys: ReadonlySet<string>) {
  const left = keys.has("KeyA") || keys.has("ArrowLeft");
  const right = keys.has("KeyD") || keys.has("ArrowRight");
  const up = keys.has("KeyW") || keys.has("ArrowUp");
  const down = keys.has("KeyS") || keys.has("ArrowDown");
  const x = Number(right) - Number(left);
  const z = Number(down) - Number(up);
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
}
