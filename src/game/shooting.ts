import * as THREE from "three";

export interface Shooting {
  cooldown: number;
  age: number;
  shots: number;
}
export function createShooting(random: () => number): Shooting {
  return { cooldown: random() * 0.7, age: 1, shots: 0 };
}
export function stepShooting(
  state: Shooting,
  delta: number,
  active: boolean,
  random: () => number,
) {
  state.age += delta;
  if (!active) return false;
  state.cooldown -= delta;
  if (state.cooldown > 0) return false;
  state.cooldown = 0.3 + random() * 0.45;
  state.age = 0;
  state.shots++;
  return true;
}
export function shootingVisual() {
  const group = new THREE.Group();
  group.name = "gunfire";
  const material = new THREE.MeshBasicMaterial({ color: "#ffdd72" });
  const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), material);
  flash.position.set(0.2, 0.04, 0.52);
  const tracer = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, 0.025, 0.3),
    material,
  );
  tracer.position.set(0.2, 0.04, 0.8);
  // Cosmetic light must not intercept taps intended for physical objects.
  flash.raycast = tracer.raycast = () => {};
  group.add(flash, tracer);
  group.visible = false;
  return group;
}
export function animateShooting(
  mesh: THREE.Group,
  state: Shooting,
  active: boolean,
) {
  const effect = mesh.getObjectByName("gunfire");
  if (!effect) return;
  effect.visible = active && state.age < 0.12;
  effect.children[0].visible = state.age < 0.06;
  effect.children[1].position.z = 0.8 + state.age * 20;
}
