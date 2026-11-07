import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { type SupplySite, supplySiteCollectionLevel } from "./stage";
import { supplySiteVisual } from "./america-visuals";
import { supplyMouth } from "./object-supply";

export function createSupplyFactory(world: RAPIER.World, site: SupplySite) {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(site.x, 0, site.z)
      .setCcdEnabled(true),
  );
  const mouth = supplyMouth(site);
  const colliders = [
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        site.width / 2,
        site.height / 2,
        site.depth / 2,
      ).setTranslation(0, site.height / 2, 0),
      body,
    ),
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(
        1.1 * site.scale,
        0.9 * site.scale,
      ).setTranslation(mouth.x - site.x, mouth.y - 1.1 * site.scale, 0),
      body,
    ),
  ];
  return {
    site,
    definition: {
      id: `factory-${site.id}`,
      kind:
        site.id === "depot"
          ? ("largeFactory" as const)
          : ("smallFactory" as const),
    },
    body,
    colliders,
    mesh: supplySiteVisual(site),
    falling: false,
  };
}

export type SupplyFactory = ReturnType<typeof createSupplyFactory>;

export function releaseSupplyFactory(
  factory: SupplyFactory,
  level: number,
  hole: { x: number; z: number; radius: number },
) {
  if (factory.falling || level < supplySiteCollectionLevel(factory.site))
    return false;
  const position = factory.body.translation();
  const footprint = Math.hypot(factory.site.width, factory.site.depth) / 2;
  if (
    Math.hypot(position.x - hole.x, position.z - hole.z) + footprint >=
    hole.radius
  )
    return false;
  // Keep the base anchored until the hole fully covers its foundation.
  factory.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
  factory.falling = true;
  return true;
}

export function supplyFactoryTop(factory: SupplyFactory) {
  factory.mesh.position.copy(factory.body.translation());
  factory.mesh.quaternion.copy(factory.body.rotation());
  return new THREE.Box3().setFromObject(factory.mesh).max.y;
}
