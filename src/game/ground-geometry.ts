import * as THREE from "three";
import { MAP_HALF_SIZE } from "./stage";

// Paint is a background layer, so it must never overwrite solid objects via a depth comparison.
export const BASE_GROUND_RENDER_ORDER = -1000;
export const GROUND_PAINT_RENDER_ORDER = -100;

export function writeGroundGeometry(
  geometry: THREE.BufferGeometry,
  vertices: Float32Array,
  indices: Uint32Array,
  mapHalfSize = MAP_HALF_SIZE,
) {
  const position = geometry.getAttribute("position") as
    THREE.BufferAttribute | undefined;
  if (position) {
    position.array.set(vertices);
    position.needsUpdate = true;
  } else {
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(new Float32Array((vertices.length / 3) * 2), 2),
    );
  }
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
  for (let index = 0; index < vertices.length / 3; index++) {
    uv.setXY(
      index,
      (vertices[index * 3] + mapHalfSize) / (mapHalfSize * 2),
      1 - (vertices[index * 3 + 2] + mapHalfSize) / (mapHalfSize * 2),
    );
  }
  // Keep the same attributes so movement doesn't orphan buffers owned by WebGL.
  uv.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}
