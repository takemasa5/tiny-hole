import * as THREE from "three";

const DURATION = 1.15;
const PARTICLES = 28;

export class GrowthEffect {
  readonly group = new THREE.Group();
  private rings: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[];
  private particles: THREE.InstancedMesh;
  private matrix = new THREE.Object3D();
  private age = DURATION;
  private triggers = 0;
  private reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    .matches;

  constructor() {
    this.rings = ["#ffd36b", "#8ae8ff"].map((color) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.04, 1.13, 64),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      this.group.add(ring);
      return ring;
    });
    this.particles = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.055),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
      PARTICLES,
    );
    for (let index = 0; index < PARTICLES; index++)
      this.particles.setColorAt(
        index,
        new THREE.Color(index % 2 ? "#fff2b1" : "#ffc65c"),
      );
    this.particles.frustumCulled = false;
    this.group.add(this.particles);
    this.group.visible = false;
  }

  trigger() {
    this.age = 0;
    this.triggers++;
  }

  update(delta: number, x: number, z: number, radius: number) {
    this.age += delta;
    this.group.visible = this.age < DURATION;
    if (!this.group.visible) return;
    const progress = this.age / DURATION;
    this.group.position.set(x, 0.06, z);
    this.group.scale.setScalar(radius);
    this.rings.forEach((ring, index) => {
      ring.position.y = index * 0.01;
      ring.scale.setScalar(
        this.reducedMotion ? 1.1 : 1 + progress * (0.65 + index * 0.5),
      );
      ring.material.opacity = (1 - progress) * (index ? 0.65 : 0.95);
    });
    this.particles.visible = !this.reducedMotion;
    (this.particles.material as THREE.MeshBasicMaterial).opacity = 1 - progress;
    for (let index = 0; index < PARTICLES; index++) {
      const angle = (index / PARTICLES) * Math.PI * 2;
      const reach = 1.1 + progress * (0.4 + (index % 3) * 0.25);
      this.matrix.position.set(
        Math.cos(angle) * reach,
        Math.sin(progress * Math.PI) * (0.35 + (index % 4) * 0.1),
        Math.sin(angle) * reach,
      );
      this.matrix.rotation.set(
        progress * 4,
        angle + progress * 3,
        progress * 2,
      );
      this.matrix.scale.setScalar(1 + Math.sin(progress * Math.PI) * 0.6);
      this.matrix.updateMatrix();
      this.particles.setMatrixAt(index, this.matrix.matrix);
    }
    this.particles.instanceMatrix.needsUpdate = true;
  }

  snapshot() {
    return {
      active: this.group.visible,
      triggers: this.triggers,
      age: this.age,
    };
  }
}
