import * as THREE from "three";

export interface OcclusionTarget {
  object: THREE.Object3D;
  footprint: number;
  fadeSurfaces?: boolean;
}

interface FadedObject {
  opacity: number;
  lastBlocked: number;
  parts: {
    mesh: THREE.Mesh;
    original: THREE.Material | THREE.Material[];
    faded: THREE.Material | THREE.Material[];
  }[];
  materials: { original: THREE.Material; faded: THREE.Material }[];
}

/** Fade occluders without changing shared materials or their colliders. */
export class HoleOcclusion {
  private faded = new Map<THREE.Object3D, FadedObject>();
  private prepared = new Map<THREE.Object3D, FadedObject>();
  private raycaster = new THREE.Raycaster();
  private box = new THREE.Box3();
  private target = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private time = 0;
  readonly mode: "coverage" | "blend";

  constructor(samples = 0) {
    this.mode = samples >= 2 ? "coverage" : "blend";
  }

  update(
    camera: THREE.Camera,
    hole: { x: number; z: number; radius: number },
    objects: readonly OcclusionTarget[],
    delta: number,
  ) {
    this.time += delta;
    const blocked = new Set<THREE.Object3D>();
    const rays = Array.from({ length: 9 }, (_, index) => {
      const angle = (index / 8) * Math.PI * 2;
      this.target.set(
        hole.x + (index === 8 ? 0 : Math.cos(angle) * hole.radius),
        hole.radius * 0.02,
        hole.z + (index === 8 ? 0 : Math.sin(angle) * hole.radius),
      );
      const distance = camera.position.distanceTo(this.target);
      return {
        ray: new THREE.Ray(
          camera.position.clone(),
          this.direction
            .subVectors(this.target, camera.position)
            .normalize()
            .clone(),
        ),
        distance,
      };
    });
    for (const { object, footprint, fadeSurfaces } of objects) {
      if (!object.visible) continue;
      if (footprint <= hole.radius) {
        this.remove(object);
        continue;
      }
      this.box.setFromObject(object);
      // Enclosures must not fade their far walls and lid when only a near wall hides the hole.
      const surfaces = new Set<THREE.Object3D>();
      // One covered point or an enclosing bounding box does not hide the whole aperture.
      const coversHole = rays.every(({ ray, distance }) => {
        const hit = ray.intersectBox(this.box, this.target);
        if (!hit || camera.position.distanceTo(hit) >= distance) return false;
        this.raycaster.ray.copy(ray);
        this.raycaster.near = 0;
        this.raycaster.far = distance - hole.radius * 0.01;
        const hits = this.raycaster.intersectObject(object, true);
        if (fadeSurfaces) for (const hit of hits) surfaces.add(hit.object);
        return hits.length > 0;
      });
      if (coversHole)
        for (const target of fadeSurfaces ? surfaces : [object])
          blocked.add(target);
    }
    for (const object of blocked) {
      if (!this.faded.has(object)) {
        const state = this.prepared.get(object) ?? this.cloneMaterials(object);
        for (const part of state.parts) part.mesh.material = part.faded;
        this.prepared.set(object, state);
        this.faded.set(object, state);
      }
      this.faded.get(object)!.lastBlocked = this.time;
    }
    for (const [object, state] of this.faded) {
      const target = this.time - state.lastBlocked <= 0.12 ? 0.25 : 1;
      state.opacity +=
        Math.sign(target - state.opacity) *
        Math.min(Math.abs(target - state.opacity), delta / 0.2);
      for (const { original, faded } of state.materials)
        faded.opacity = original.opacity * state.opacity;
      if (state.opacity >= 1) this.restore(object, state);
    }
  }

  private cloneMaterials(object: THREE.Object3D): FadedObject {
    const state: FadedObject = {
      opacity: 1,
      lastBlocked: this.time,
      parts: [],
      materials: [],
    };
    const clones = new Map<THREE.Material, THREE.Material>();
    const clone = (original: THREE.Material) => {
      let faded = clones.get(original);
      if (!faded) {
        faded = original.clone();
        // MSAA coverage keeps depth testing between furniture parts, without transparent sorting.
        const coverage = this.mode === "coverage" && !original.transparent;
        faded.alphaToCoverage = coverage;
        faded.transparent = !coverage;
        faded.depthWrite = coverage;
        clones.set(original, faded);
        state.materials.push({ original, faded });
      }
      return faded;
    };
    object.traverse((part) => {
      if (!(part instanceof THREE.Mesh)) return;
      const faded = Array.isArray(part.material)
        ? part.material.map(clone)
        : clone(part.material);
      state.parts.push({ mesh: part, original: part.material, faded });
    });
    return state;
  }

  private restore(object: THREE.Object3D, state: FadedObject) {
    for (const { mesh, original } of state.parts) mesh.material = original;
    state.opacity = 1;
    this.faded.delete(object);
  }

  remove(object: THREE.Object3D) {
    object.traverse((part) => {
      const state = this.prepared.get(part);
      if (!state) return;
      this.restore(part, state);
      // Surface fades belong to the enclosing object and must be released with it.
      for (const { faded } of state.materials) faded.dispose();
      this.prepared.delete(part);
    });
  }

  snapshot() {
    return [...this.faded].map(([object, state]) => ({
      id: object.userData.objectId as string,
      opacity: state.opacity,
      surface: object.name || undefined,
    }));
  }

  dispose() {
    for (const object of this.prepared.keys()) this.remove(object);
  }
}
