export interface Point {
  x: number;
  z: number;
}
export interface ProtectedObstacle extends Point {
  halfWidth: number;
  halfDepth: number;
}
interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function inside(point: Point, bounds: Bounds) {
  return (
    point.x > bounds.minX &&
    point.x < bounds.maxX &&
    point.z > bounds.minZ &&
    point.z < bounds.maxZ
  );
}

function crosses(start: Point, end: Point, bounds: Bounds) {
  let enter = 0,
    leave = 1;
  for (const [position, direction, minimum, maximum] of [
    [start.x, end.x - start.x, bounds.minX, bounds.maxX],
    [start.z, end.z - start.z, bounds.minZ, bounds.maxZ],
  ]) {
    if (Math.abs(direction) < 0.000001) {
      if (position < minimum || position > maximum) return false;
      continue;
    }
    const first = (minimum - position) / direction,
      second = (maximum - position) / direction;
    enter = Math.max(enter, Math.min(first, second));
    leave = Math.min(leave, Math.max(first, second));
    if (enter > leave) return false;
  }
  return leave > 0.00001 && enter < 0.99999;
}

function escapePoint(point: Point, bounds: Bounds): Point {
  const exits = [
    { x: bounds.minX - 0.15, z: point.z },
    { x: bounds.maxX + 0.15, z: point.z },
    { x: point.x, z: bounds.minZ - 0.15 },
    { x: point.x, z: bounds.maxZ + 0.15 },
  ];
  return exits.sort(
    (a, b) =>
      Math.hypot(a.x - point.x, a.z - point.z) -
      Math.hypot(b.x - point.x, b.z - point.z),
  )[0];
}

export function sweeperWaypoint(
  start: Point,
  destination: Point,
  obstacles: readonly ProtectedObstacle[],
  clearance: number,
): Point {
  const bounds = obstacles.map((obstacle) => ({
    minX: obstacle.x - obstacle.halfWidth - clearance,
    maxX: obstacle.x + obstacle.halfWidth + clearance,
    minZ: obstacle.z - obstacle.halfDepth - clearance,
    maxZ: obstacle.z + obstacle.halfDepth + clearance,
  }));
  const containingStart = bounds.find((box) => inside(start, box));
  if (containingStart) return escapePoint(start, containingStart);
  let goal = destination;
  for (const box of bounds)
    if (inside(goal, box)) goal = escapePoint(goal, box);
  if (!bounds.some((box) => crosses(start, goal, box))) return goal;
  const corners = bounds
    .flatMap((box) => [
      { x: box.minX - 0.15, z: box.minZ - 0.15 },
      { x: box.minX - 0.15, z: box.maxZ + 0.15 },
      { x: box.maxX + 0.15, z: box.minZ - 0.15 },
      { x: box.maxX + 0.15, z: box.maxZ + 0.15 },
    ])
    .filter((point) => !bounds.some((box) => inside(point, box)));
  const points = [start, goal, ...corners];
  const distance = points.map(() => Infinity),
    previous = points.map(() => -1),
    visited = new Set<number>();
  distance[0] = 0;
  for (let step = 0; step < points.length; step++) {
    let current = -1;
    for (let index = 0; index < points.length; index++)
      if (
        !visited.has(index) &&
        (current < 0 || distance[index] < distance[current])
      )
        current = index;
    if (current < 0 || !Number.isFinite(distance[current])) break;
    if (current === 1) {
      let first = 1;
      while (previous[first] > 0) first = previous[first];
      return points[first];
    }
    visited.add(current);
    for (let next = 0; next < points.length; next++) {
      if (
        visited.has(next) ||
        bounds.some((box) => crosses(points[current], points[next], box))
      )
        continue;
      const cost =
        distance[current] +
        Math.hypot(
          points[next].x - points[current].x,
          points[next].z - points[current].z,
        );
      if (cost < distance[next]) {
        distance[next] = cost;
        previous[next] = current;
      }
    }
  }
  return start;
}
