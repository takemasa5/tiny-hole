import * as THREE from "three";

type BurstKind = "pickup" | "flee" | "door" | "clear";
const CAPACITY = 384;
const RINGS = 10;
type Particle = {
  active: boolean;
  age: number;
  life: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  gravity: number;
};

export class RewardEffects {
  readonly group = new THREE.Group();
  private reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    .matches;
  private particles: Particle[] = Array.from({ length: CAPACITY }, () => ({
    active: false,
    age: 0,
    life: 1,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    size: 0,
    gravity: 0,
  }));
  private mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private cursor = 0;
  private ringCursor = 0;
  private rings: {
    mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
    age: number;
    life: number;
    radius: number;
  }[];
  private caption: THREE.Sprite;
  private canvas = document.createElement("canvas");
  private captionAge = 2;
  private counts = { pickup: 0, flee: 0, door: 0, clear: 0 };

  constructor() {
    this.mesh = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(1),
      new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
      CAPACITY,
    );
    this.mesh.frustumCulled = false;
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < CAPACITY; i++)
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    this.group.add(this.mesh);
    this.rings = Array.from({ length: RINGS }, () => {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.87, 1, 48),
        new THREE.MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.group.add(mesh);
      return { mesh, age: 1, life: 0.6, radius: 1 };
    });
    this.canvas.width = 512;
    this.canvas.height = 192;
    const map = new THREE.CanvasTexture(this.canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    this.caption = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.caption.visible = false;
    this.caption.renderOrder = 100;
    this.group.add(this.caption);
  }

  emit(
    kind: BurstKind,
    x: number,
    z: number,
    radius: number,
    color: string,
    combo = 1,
    height = 0,
  ) {
    this.counts[kind]++;
    const count = this.reducedMotion
      ? 0
      : kind === "clear"
        ? 160
        : kind === "door"
          ? 52
          : kind === "flee"
            ? 8
            : Math.min(28, 10 + Math.floor(combo / 2));
    for (let i = 0; i < count; i++) {
      const index = this.cursor++ % CAPACITY;
      const angle = i * 2.399963 + this.counts[kind];
      const reach =
        radius * (kind === "flee" ? 0.8 : kind === "clear" ? 5 : 2.8);
      this.particles[index] = {
        active: true,
        age: 0,
        life: 0.5 + (i % 7) * 0.09,
        x,
        y: height + radius * 0.06,
        z,
        vx: Math.cos(angle) * reach,
        vz: Math.sin(angle) * reach,
        vy: radius * (2 + (i % 5) * 0.6),
        size: radius * (kind === "flee" ? 0.075 : 0.055 + (i % 3) * 0.018),
        gravity: radius * 8,
      };
      this.mesh.setColorAt(
        index,
        new THREE.Color(color).lerp(new THREE.Color("#ffffff"), (i % 3) * 0.25),
      );
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    if (kind !== "flee") {
      const ring = this.rings[this.ringCursor++ % RINGS];
      ring.age = 0;
      ring.radius = radius;
      ring.mesh.position.set(x, radius * 0.03, z);
      ring.mesh.material.color.set(color);
    }
    if (kind === "clear" || kind === "door") {
      const context = this.canvas.getContext("2d");
      if (context) {
        const text = kind === "clear" ? "CLEAR!" : "OPEN!";
        context.clearRect(0, 0, 512, 192);
        context.font = "900 78px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.lineWidth = 12;
        context.strokeStyle = "#663368";
        context.strokeText(text, 256, 96);
        context.fillStyle = "#ffffff";
        context.fillText(text, 256, 96);
        this.caption.material.map!.needsUpdate = true;
        this.captionAge = 0;
      }
    }
  }

  update(delta: number, x: number, z: number, radius: number) {
    for (let i = 0; i < CAPACITY; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.age += delta;
      if (p.age >= p.life) {
        p.active = false;
        this.dummy.scale.setScalar(0);
      } else {
        p.x += p.vx * delta;
        p.z += p.vz * delta;
        p.y += p.vy * delta;
        p.vy -= p.gravity * delta;
        this.dummy.position.set(p.x, p.y, p.z);
        this.dummy.rotation.set(p.age * 5, i, p.age * 8);
        this.dummy.scale.setScalar(p.size * (1 - p.age / p.life));
      }
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    for (const ring of this.rings) {
      ring.age += delta;
      ring.mesh.visible = ring.age < ring.life;
      if (!ring.mesh.visible) continue;
      const t = ring.age / ring.life;
      ring.mesh.scale.setScalar(
        ring.radius * (this.reducedMotion ? 1.1 : 0.8 + t * 2),
      );
      ring.mesh.material.opacity = (1 - t) * 0.75;
    }
    this.captionAge += delta;
    this.caption.visible = this.captionAge < 1;
    this.caption.position.set(
      x + radius * 1.15,
      radius * (1.1 + (this.reducedMotion ? 0 : this.captionAge * 0.4)),
      z,
    );
    this.caption.scale.set(radius * 2.4, radius * 0.9, 1);
    this.caption.material.opacity = Math.min(1, (1 - this.captionAge) * 3);
  }

  snapshot() {
    return {
      counts: { ...this.counts },
      activeParticles: this.particles.filter((p) => p.active).length,
      capacity: CAPACITY,
      reducedMotion: this.reducedMotion,
    };
  }
}
