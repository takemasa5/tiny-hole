import * as THREE from "three";
import type { GrowthObject } from "./growth-stage";
/** The cable's moving end and the collider share this position. */
export function hoistFrame(
  crane: GrowthObject,
  position: { x: number; y: number; z: number },
  rotation: { x: number; y: number; z: number; w: number },
  loadHeight: number,
  time: number,
) {
  const anchor = new THREE.Vector3(
    0,
    crane.size[1] * 0.43,
    crane.size[2] * 0.43,
  )
    .applyQuaternion(
      new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
    )
    .add(new THREE.Vector3(position.x, position.y, position.z));
  const distance = crane.size[1] * (0.42 + 0.13 * Math.sin(time * 0.7));
  return {
    anchor,
    load: anchor
      .clone()
      .add(new THREE.Vector3(0, -distance - loadHeight / 2, 0)),
  };
}
export class HoistCable {
  readonly line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]),
    new THREE.LineBasicMaterial({ color: "#475b67" }),
  );
  constructor() {
    this.line.frustumCulled = false;
  }
  update(anchor: THREE.Vector3, load: THREE.Vector3, height: number) {
    const points = this.line.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    points.setXYZ(0, anchor.x, anchor.y, anchor.z);
    points.setXYZ(1, load.x, load.y + height / 2, load.z);
    points.needsUpdate = true;
  }
}
