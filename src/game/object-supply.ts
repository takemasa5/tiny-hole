import {
  MAP_HALF_SIZE,
  createSupplySites,
  STAGES,
  seededRandom,
  mapHalfSizeForStage,
  stageScaleForStage,
  isWalkingKind,
  type StageId,
  type SupplySite,
  OBJECT_TYPES,
  levelsForStage,
  objectFootprint,
  type ObjectKind,
  type PlacedObject,
  type SupplySiteId,
  STATIONERY_SITE_IDS,
  type StationerySiteId,
  supplySiteSuppliesAtLevel,
} from "./stage";

export const SUPPLY_RULES = {
  foodInterval: 8,
  depotInterval: 12,
  recoveryInterval: 2,
  stationeryInterval: 2,
  maxObjects: 480,
  maxPerSite: 8,
  flightSeconds: 0.9,
  flightGravityScale: 4,
} as const;
export interface SupplyObject {
  id: string;
  kind: ObjectKind;
  x: number;
  z: number;
  footprint: number;
  sourceId?: SupplySiteId;
  falling: boolean;
}
export interface ObjectSupply {
  stageId: StageId;
  sites: SupplySite[];
  random: () => number;
  maxObjects: number;
  elapsed: number;
  serial: number;
  foodAt: number;
  depotAt: number;
  recoveryAt: number;
  stationeryAt: Record<StationerySiteId, number>;
  spawned: number;
  spawnedBySite: Record<SupplySiteId, number>;
}
export function createObjectSupply(
  seed = 0,
  stageId: StageId = "america",
): ObjectSupply {
  const stage = STAGES[stageId];
  const initialCount =
    2 +
    stage.moving.count +
    stage.groups.reduce(
      (count, group) =>
        count +
        group.count +
        group.stacked *
          (group.layers *
            ("stackLayout" in group && group.stackLayout === "crib" ? 2 : 1) -
            1),
      0,
    );
  return {
    stageId,
    sites: createSupplySites(seed, stageId),
    random: seededRandom(seed ^ 0x75448c),
    maxObjects: Math.max(SUPPLY_RULES.maxObjects, initialCount + 28),
    elapsed: 0,
    serial: 0,
    foodAt: 8,
    depotAt: 12,
    recoveryAt: 2,
    stationeryAt: { stationeryA: 2, stationeryB: 2 },
    spawned: 0,
    spawnedBySite: { food: 0, depot: 0, stationeryA: 0, stationeryB: 0 },
  };
}

export function randomSupplyKind(
  state: ObjectSupply,
  radius?: number,
): ObjectKind {
  const candidates = STAGES[state.stageId].groups
    .map(({ kind }) => kind)
    .filter(
      (kind) => radius === undefined || objectFootprint(kind) < radius * 0.99,
    );
  if (!candidates.length)
    throw new Error("供給できるオブジェクトがありません。");
  return candidates[Math.floor(state.random() * candidates.length)];
}

export const STATIONERY_KINDS: readonly ObjectKind[] = [
  "eraser",
  "pencil",
  "stapler",
  "documents",
];

export function randomStationeryKind(
  state: ObjectSupply,
  radius: number,
): ObjectKind {
  // A tumbling small item must still fit, so replacement stock stays usable after landing.
  const candidates = STATIONERY_KINDS.filter(
    (kind) => Math.hypot(...OBJECT_TYPES[kind].size) / 2 < radius * 0.99,
  );
  if (!candidates.length) throw new Error("供給できる小物がありません。");
  return candidates[Math.floor(state.random() * candidates.length)];
}

export function availableGrowth(
  objects: readonly SupplyObject[],
  radius: number,
  mapHalfSize = MAP_HALF_SIZE,
) {
  return objects
    .filter(
      (object) =>
        object.id !== "goal" &&
        object.kind !== "streetSweeper" &&
        !object.falling &&
        object.footprint < radius * 0.99 &&
        Math.max(Math.abs(object.x), Math.abs(object.z)) + object.footprint <
          mapHalfSize,
    )
    .reduce((sum, object) => sum + OBJECT_TYPES[object.kind].value, 0);
}

export function supplyRequest(
  state: ObjectSupply,
  level: number,
  score: number,
  objects: readonly SupplyObject[],
  delta: number,
  activeSites: readonly SupplySiteId[] = state.sites.map(({ id }) => id),
): { siteId: SupplySiteId; kind: ObjectKind; recovery: boolean } | undefined {
  state.elapsed += delta;
  const enabledSites = activeSites.filter((id) => {
    const site = state.sites.find((candidate) => candidate.id === id);
    return site && supplySiteSuppliesAtLevel(site, level + 1);
  });
  const levels = levelsForStage(state.stageId);
  const next = levels[level + 1];
  const shortage =
    !!next &&
    score +
      availableGrowth(
        objects,
        levels[level].radius,
        mapHalfSizeForStage(state.stageId),
      ) <
      next.threshold;
  if (
    enabledSites.includes("depot") &&
    shortage &&
    state.elapsed >= state.recoveryAt
  )
    return {
      siteId: "depot",
      kind: randomSupplyKind(state, levels[level].radius),
      recovery: true,
    };
  const scheduled: { siteId: SupplySiteId; at: number }[] = [
    { siteId: "food", at: state.foodAt },
    { siteId: "depot", at: state.depotAt },
    ...STATIONERY_SITE_IDS.map((siteId) => ({
      siteId,
      at: state.stationeryAt[siteId],
    })),
  ];
  const due = scheduled
    .filter(
      ({ siteId, at }) => enabledSites.includes(siteId) && state.elapsed >= at,
    )
    .sort((a, b) => a.at - b.at)[0];
  if (!due) return undefined;
  const small = due.siteId !== "food" && due.siteId !== "depot";
  return {
    siteId: due.siteId,
    kind: small
      ? randomStationeryKind(state, levels[level].radius)
      : randomSupplyKind(state),
    recovery: false,
  };
}

export function finishSupplyAttempt(
  state: ObjectSupply,
  siteId: SupplySiteId,
  spawned: boolean,
) {
  if (siteId === "food")
    state.foodAt = state.elapsed + (spawned ? SUPPLY_RULES.foodInterval : 1);
  else if (siteId === "depot")
    state.depotAt = state.elapsed + (spawned ? SUPPLY_RULES.depotInterval : 1);
  else
    state.stationeryAt[siteId] =
      state.elapsed + (spawned ? SUPPLY_RULES.stationeryInterval : 1);
  state.recoveryAt = state.elapsed + SUPPLY_RULES.recoveryInterval;
  if (spawned) {
    state.spawned++;
    state.spawnedBySite[siteId]++;
  }
}

export function findSupplyPlacement(
  state: ObjectSupply,
  siteId: SupplySiteId,
  kind: ObjectKind,
  objects: readonly SupplyObject[],
  hole: { x: number; z: number; radius: number },
): PlacedObject | undefined {
  if (
    objects.length >= state.maxObjects ||
    objects.filter((object) => object.sourceId === siteId).length >=
      SUPPLY_RULES.maxPerSite
  )
    return undefined;
  const site = state.sites.find((candidate) => candidate.id === siteId)!;
  const scale = stageScaleForStage(state.stageId);
  const mapHalfSize = mapHalfSizeForStage(state.stageId);
  const footprint = objectFootprint(kind);
  for (let index = 0; index < 40; index++) {
    const angle = index * 2.3999632297;
    const spread = index === 0 ? 0 : (1.7 + Math.sqrt(index) * 1.1) * scale;
    const x = site.outputX + Math.cos(angle) * spread;
    const z = site.outputZ + Math.sin(angle) * spread;
    if (Math.max(Math.abs(x), Math.abs(z)) + footprint >= mapHalfSize) continue;
    if (
      Math.hypot(x - hole.x, z - hole.z) <
      hole.radius + footprint + 0.4 * scale
    )
      continue;
    if (
      state.sites.some(
        (fixture) =>
          Math.hypot(x - fixture.x, z - fixture.z) <
          footprint +
            Math.hypot(fixture.width, fixture.depth) / 2 +
            0.25 * scale,
      )
    )
      continue;
    if (
      objects.some(
        (object) =>
          !object.falling &&
          Math.hypot(x - object.x, z - object.z) <
            footprint + object.footprint + 0.25 * scale,
      )
    )
      continue;
    return {
      id: `supply-${siteId}-${state.serial++}`,
      kind,
      x,
      z,
      y: OBJECT_TYPES[kind].size[1] / 2 + 0.02 * scale,
      yaw: isWalkingKind(kind) ? state.random() * Math.PI * 2 : 0,
      sourceId: siteId,
    };
  }
  return undefined;
}

export function supplyMouth(site: SupplySite) {
  return {
    x: site.x - site.width * 0.25,
    y: site.height + 2.2 * site.scale,
    z: site.z,
  };
}

export function supplyLaunch(
  definition: PlacedObject,
  sites: readonly SupplySite[],
) {
  const site = sites.find(({ id }) => id === definition.sourceId);
  if (!site) throw new Error("供給元の工場が見つかりません。");
  const mouth = supplyMouth(site);
  const position = {
    x: mouth.x,
    y: mouth.y + OBJECT_TYPES[definition.kind].size[1] / 2 + 0.05 * site.scale,
    z: mouth.z,
  };
  const duration = SUPPLY_RULES.flightSeconds;
  const gravityScale = SUPPLY_RULES.flightGravityScale * site.scale;
  return {
    position,
    velocity: {
      x: (definition.x - position.x) / duration,
      y:
        (definition.y -
          position.y +
          0.5 * 9.81 * gravityScale * duration * duration) /
        duration,
      z: (definition.z - position.z) / duration,
    },
    duration,
    // Double velocity and quadruple gravity preserve the arc in half the time.
    gravityScale,
    target: { x: definition.x, y: definition.y, z: definition.z },
  };
}
