import {
  MAP_HALF_SIZE,
  isWalkingKind,
  OBJECT_TYPES,
  objectFootprint,
  type ObjectKind,
} from "./stage";
import { sweeperWaypoint, type ProtectedObstacle } from "./sweeper-path";

export const SWEEPER_RULES = {
  speed: 6.4,
  searchRange: 15,
  density: 12,
  stuckSeconds: 1.5,
} as const;
const PATROL = [
  { x: 8, z: 14 },
  { x: 8, z: -14 },
  { x: -15, z: -14 },
  { x: -15, z: 14 },
];

export interface SweeperTarget {
  id: string;
  kind: ObjectKind;
  x: number;
  z: number;
  y: number;
  falling: boolean;
}
export interface StreetSweeper {
  phase: "patrol" | "approaching" | "pushing" | "falling";
  targetId?: string;
  targetKind?: ObjectKind;
  direction: { x: number; z: number };
  heading: number;
  patrolIndex: number;
  ignoredId?: string;
  lastPosition?: { x: number; z: number };
  stillFor: number;
}

export function createStreetSweeper(): StreetSweeper {
  return {
    phase: "patrol",
    targetId: undefined,
    targetKind: undefined,
    direction: { x: 0, z: 1 },
    heading: 0,
    patrolIndex: 0,
    stillFor: 0,
  };
}

export function canSweep(target: SweeperTarget) {
  return (
    target.id !== "goal" &&
    target.kind !== "streetSweeper" &&
    !target.falling &&
    !isWalkingKind(target.kind) &&
    target.kind !== "smallFactory" &&
    target.kind !== "largeFactory" &&
    target.y < OBJECT_TYPES[target.kind].size[1] / 2 + 0.4
  );
}

function blockedByProtectedObject(
  position: { x: number; z: number },
  target: SweeperTarget | undefined,
  state: StreetSweeper,
  obstacles: readonly ProtectedObstacle[],
  scale: number,
) {
  const sweeperFootprint = objectFootprint("streetSweeper") * scale;
  const near = (
    point: { x: number; z: number },
    footprint: number,
    obstacle: ProtectedObstacle,
  ) =>
    Math.abs(point.x - obstacle.x) <
      obstacle.halfWidth + footprint + 0.3 * scale &&
    Math.abs(point.z - obstacle.z) <
      obstacle.halfDepth + footprint + 0.3 * scale;
  const nearby = obstacles.some(
    (obstacle) =>
      near(position, sweeperFootprint, obstacle) ||
      (!!target && near(target, objectFootprint(target.kind), obstacle)),
  );
  if (!nearby) return false;
  const distance =
    state.phase === "pushing"
      ? 4 * scale
      : -(
          sweeperFootprint +
          (target ? objectFootprint(target.kind) : 0) +
          0.35 * scale
        );
  const destination = target
    ? {
        x: target.x + state.direction.x * distance,
        z: target.z + state.direction.z * distance,
      }
    : {
        x: PATROL[state.patrolIndex].x * scale,
        z: PATROL[state.patrolIndex].z * scale,
      };
  const waypoint = sweeperWaypoint(
    position,
    destination,
    obstacles,
    sweeperFootprint + 0.2 * scale,
  );
  return (
    Math.hypot(waypoint.x - destination.x, waypoint.z - destination.z) >
    0.05 * scale
  );
}

export function stepStreetSweeper(
  state: StreetSweeper,
  position: { x: number; z: number },
  targets: readonly SweeperTarget[],
  delta: number,
  falling: boolean,
  extraObstacles: readonly ProtectedObstacle[] = [],
  factoryObstacles: readonly ProtectedObstacle[] = [],
  scale = 1,
) {
  const sweeperFootprint = objectFootprint("streetSweeper") * scale;
  const protectedObstacles = [...factoryObstacles, ...extraObstacles];
  if (falling || state.phase === "falling") {
    state.phase = "falling";
    state.targetId = undefined;
    state.targetKind = undefined;
    return { x: 0, z: 0 };
  }
  const speed = state.lastPosition
    ? Math.hypot(
        position.x - state.lastPosition.x,
        position.z - state.lastPosition.z,
      ) / delta
    : Infinity;
  state.stillFor = speed < 0.12 * scale ? state.stillFor + delta : 0;
  state.lastPosition = { ...position };
  // Once selected, a load stays selected even if contact briefly lifts it off the ground.
  let target = targets.find(
    (candidate) => candidate.id === state.targetId && !candidate.falling,
  );
  if (
    state.stillFor >= SWEEPER_RULES.stuckSeconds &&
    blockedByProtectedObject(position, target, state, protectedObstacles, scale)
  ) {
    state.ignoredId = state.targetId;
    state.targetId = undefined;
    state.targetKind = undefined;
    target = undefined;
    state.patrolIndex = (state.patrolIndex + 1) % PATROL.length;
    state.stillFor = 0;
  }
  if (!target) {
    state.targetId = undefined;
    state.targetKind = undefined;
    state.phase = "patrol";
    // Return from the verge before choosing another load, so the vehicle remains interceptable.
    if (
      Math.max(Math.abs(position.x), Math.abs(position.z)) <
      MAP_HALF_SIZE * scale - 8 * scale
    ) {
      target = targets
        .filter(
          (candidate) =>
            canSweep(candidate) &&
            candidate.id !== state.ignoredId &&
            Math.hypot(candidate.x - position.x, candidate.z - position.z) <
              SWEEPER_RULES.searchRange * scale,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - position.x, a.z - position.z) -
            Math.hypot(b.x - position.x, b.z - position.z),
        )[0];
      if (target) {
        state.targetId = target.id;
        state.targetKind = target.kind;
        const directions = [
          { x: 1, z: 0 },
          { x: -1, z: 0 },
          { x: 0, z: 1 },
          { x: 0, z: -1 },
        ];
        const obstacles = protectedObstacles.map((site) => ({
          ...site,
          footprint: Math.hypot(site.halfWidth, site.halfDepth),
        }));
        state.direction = directions.sort((a, b) => {
          const cost = (direction: { x: number; z: number }) => {
            const blocked = obstacles.some(
              (obstacle) =>
                (obstacle.x - target!.x) * direction.x +
                  (obstacle.z - target!.z) * direction.z >
                  0 &&
                Math.abs(
                  (obstacle.x - target!.x) * direction.z -
                    (obstacle.z - target!.z) * direction.x,
                ) <
                  obstacle.footprint + sweeperFootprint + 0.3 * scale,
            );
            return (
              (blocked ? 1000 : 0) +
              MAP_HALF_SIZE * scale -
              target!.x * direction.x -
              target!.z * direction.z
            );
          };
          return cost(a) - cost(b);
        })[0];
        state.phase = "approaching";
      }
    }
  }
  let destination = {
    x: PATROL[state.patrolIndex].x * scale,
    z: PATROL[state.patrolIndex].z * scale,
  };
  if (target) {
    const behind =
      sweeperFootprint + objectFootprint(target.kind) + 0.35 * scale;
    const setup = {
      x: target.x - state.direction.x * behind,
      z: target.z - state.direction.z * behind,
    };
    if (
      state.phase === "approaching" &&
      Math.hypot(setup.x - position.x, setup.z - position.z) < 0.45 * scale
    )
      state.phase = "pushing";
    destination =
      state.phase === "pushing"
        ? {
            x: target.x + state.direction.x * 4 * scale,
            z: target.z + state.direction.z * 4 * scale,
          }
        : setup;
  } else if (
    Math.hypot(destination.x - position.x, destination.z - position.z) < scale
  ) {
    state.patrolIndex = (state.patrolIndex + 1) % PATROL.length;
    destination = {
      x: PATROL[state.patrolIndex].x * scale,
      z: PATROL[state.patrolIndex].z * scale,
    };
  }
  const waypoint = sweeperWaypoint(
    position,
    destination,
    protectedObstacles,
    sweeperFootprint + 0.2 * scale,
  );
  const dx = waypoint.x - position.x,
    dz = waypoint.z - position.z;
  const length = Math.hypot(dx, dz);
  const movementSpeed = Math.min(SWEEPER_RULES.speed * scale, length / delta);
  if (length < 0.001) return { x: 0, z: 0 };
  state.heading = Math.atan2(dx, dz);
  return { x: (dx / length) * movementSpeed, z: (dz / length) * movementSpeed };
}
