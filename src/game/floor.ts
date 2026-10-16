import RAPIER from "@dimforge/rapier3d-compat";

export const FLOOR_SEGMENTS = 64;

// One connected surface keeps the support at the rim while leaving the aperture empty.
export function floorShape(x: number, z: number, radius: number) {
  const vertices = new Float32Array(FLOOR_SEGMENTS * 6);
  const indices = new Uint32Array(FLOOR_SEGMENTS * 6);
  for (let index = 0; index < FLOOR_SEGMENTS; index++) {
    const angle = (index / FLOOR_SEGMENTS) * Math.PI * 2;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    vertices.set(
      [
        x + cosine * radius,
        0,
        z + sine * radius,
        x + cosine * 120,
        0,
        z + sine * 120,
      ],
      index * 6,
    );
    const inner = index * 2;
    const outer = inner + 1;
    const nextInner = ((index + 1) % FLOOR_SEGMENTS) * 2;
    const nextOuter = nextInner + 1;
    indices.set(
      [inner, nextInner, outer, outer, nextInner, nextOuter],
      index * 6,
    );
  }
  return { vertices, indices };
}

export function createFloor(world: RAPIER.World) {
  const { vertices, indices } = floorShape(0, 0, 0.9);
  return world.createCollider(
    RAPIER.ColliderDesc.trimesh(vertices, indices).setFriction(0.65),
  );
}

export function updateFloor(
  collider: RAPIER.Collider,
  x: number,
  z: number,
  radius: number,
) {
  const shape = floorShape(x, z, radius);
  collider.setShape(new RAPIER.TriMesh(shape.vertices, shape.indices));
  return shape;
}

export function topOfBox(
  positionY: number,
  rotation: { x: number; y: number; z: number; w: number },
  size: readonly number[],
) {
  const { x, y, z, w } = rotation;
  return (
    positionY +
    (Math.abs(2 * (x * y + w * z)) * size[0]) / 2 +
    (Math.abs(1 - 2 * (x * x + z * z)) * size[1]) / 2 +
    (Math.abs(2 * (y * z - w * x)) * size[2]) / 2
  );
}
