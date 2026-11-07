import {
  COLLECTION_Y,
  OBJECT_TYPES,
  objectFootprint,
  type PlacedObject,
} from "./stage";

export function isObjectOutside(
  position: { x: number; z: number },
  kind: PlacedObject["kind"],
  mapHalfSize: number,
) {
  return (
    Math.max(Math.abs(position.x), Math.abs(position.z)) >
    mapHalfSize + objectFootprint(kind)
  );
}

export function objectExit(
  object: Pick<PlacedObject, "id" | "kind">,
  position: { x: number; z: number },
  top: number,
  mapHalfSize: number,
  enteredHole: boolean,
): "collected" | "lost" | undefined {
  if (top < COLLECTION_Y) return enteredHole ? "collected" : "lost";
  if (
    !enteredHole &&
    object.id !== "goal" &&
    object.kind !== "streetSweeper" &&
    isObjectOutside(position, object.kind, mapHalfSize)
  )
    return "lost";
  return undefined;
}

export function horizontalFootprint(
  kind: PlacedObject["kind"],
  rotation: { x: number; y: number; z: number; w: number },
) {
  const [width, height, depth] = OBJECT_TYPES[kind].size;
  const { x, y, z, w } = rotation;
  const halfX =
    (Math.abs(1 - 2 * (y * y + z * z)) * width +
      Math.abs(2 * (x * y - w * z)) * height +
      Math.abs(2 * (x * z + w * y)) * depth) /
    2;
  const halfZ =
    (Math.abs(2 * (x * z - w * y)) * width +
      Math.abs(2 * (y * z + w * x)) * height +
      Math.abs(1 - 2 * (x * x + y * y)) * depth) /
    2;
  return Math.hypot(halfX, halfZ);
}
