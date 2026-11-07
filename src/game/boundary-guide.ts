import * as THREE from "three";
import { GROWTH_AREAS, GROWTH_LEVELS } from "./growth-stage";

/** Barriers belong to the ground; only the screen hint follows the player. */
export class BoundaryGuide {
  readonly group = new THREE.Group();
  private posts = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.15, 0.65, 8),
    new THREE.MeshStandardMaterial({ color: "#ed7640" }),
    512,
  );
  private bands = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.075, 0.105, 0.13, 8),
    new THREE.MeshStandardMaterial({ color: "#fff5db" }),
    512,
  );
  private bases = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.38, 0.05, 0.38),
    new THREE.MeshStandardMaterial({ color: "#514c49" }),
    512,
  );
  private rails = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 0.16, 0.08),
    new THREE.MeshStandardMaterial({ color: "#fff3d7" }),
    512,
  );
  private matrix = new THREE.Object3D();
  private area = -1;
  private level = 0;
  private label = "";
  private radius = 0;

  constructor() {
    for (const mesh of [this.posts, this.bands, this.bases, this.rails]) {
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
  }

  update(hole: { x: number; z: number; radius: number }, area: number) {
    this.group.visible = area < GROWTH_AREAS.length - 1;
    if (!this.group.visible) return;
    const extent = GROWTH_AREAS[area].extent;
    this.radius = hole.radius;
    if (area !== this.area) {
      this.area = area;
      this.level = GROWTH_AREAS[area + 1].level;
      this.label = `この先はレベル${this.level}で進めます`;
      this.placeBarriers(area);
    }
    const distance = extent - Math.max(Math.abs(hole.x), Math.abs(hole.z));
    this.hintVisible = distance < hole.radius * 4;
  }

  private placeBarriers(area: number) {
    const scale = GROWTH_LEVELS[GROWTH_AREAS[area].level - 1].radius;
    const extent = GROWTH_AREAS[area].extent + scale * 0.25;
    const segments = Math.ceil((extent * 2) / (scale * 1.2));
    const spacing = (extent * 2) / segments;
    let index = 0;
    for (const side of [
      { axis: "x", value: extent },
      { axis: "x", value: -extent },
      { axis: "z", value: extent },
      { axis: "z", value: -extent },
    ]) {
      for (let segment = 0; segment < segments; segment++) {
        const along = -extent + spacing * segment;
        const x = side.axis === "x" ? side.value : along;
        const z = side.axis === "z" ? side.value : along;
        this.matrix.rotation.set(0, 0, 0);
        this.matrix.scale.setScalar(scale);
        for (const [mesh, height] of [
          [this.posts, 0.325],
          [this.bands, 0.32],
          [this.bases, 0.025],
        ] as const) {
          this.matrix.position.set(x, height * scale, z);
          this.matrix.updateMatrix();
          mesh.setMatrixAt(index, this.matrix.matrix);
        }
        this.matrix.position.set(
          side.axis === "x" ? side.value : along + spacing / 2,
          scale * 0.42,
          side.axis === "z" ? side.value : along + spacing / 2,
        );
        this.matrix.rotation.y = side.axis === "x" ? Math.PI / 2 : 0;
        this.matrix.scale.set(spacing, scale, scale);
        this.matrix.updateMatrix();
        this.rails.setMatrixAt(index, this.matrix.matrix);
        this.rails.setColorAt(
          index,
          new THREE.Color(segment % 2 ? "#f1e9d5" : "#c95f49"),
        );
        index++;
      }
    }
    for (const mesh of [this.posts, this.bands, this.bases, this.rails]) {
      mesh.count = index;
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.rails.instanceColor) this.rails.instanceColor.needsUpdate = true;
  }

  private hintVisible = false;

  snapshot() {
    const anchors = Array.from({ length: this.area < 0 ? 0 : 4 }, (_, side) => {
      const matrix = new THREE.Matrix4();
      this.posts.getMatrixAt(side * (this.posts.count / 4), matrix);
      return {
        x: matrix.elements[12],
        y: matrix.elements[13],
        z: matrix.elements[14],
      };
    });
    return {
      visible: this.group.visible && this.hintVisible,
      label: this.label,
      level: this.level,
      posts: this.posts.count,
      radius: this.radius,
      anchors,
    };
  }
}
