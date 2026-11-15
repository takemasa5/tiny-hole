import * as THREE from "three";
import models from "./models/toy-characters.json";
import type { ThemeMotion } from "./theme-behavior";

type CharacterPart = {
  name: string;
  size: number[];
  at: number[];
  color: string;
  pivot?: string;
};

export function toyCharacterVisual(
  kind: "hero" | "monster",
  size: readonly number[] = [1, 1, 1],
) {
  const model = models[kind];
  const group = new THREE.Group();
  const pivots = new Map<string, THREE.Group>();
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  for (const { name, at } of model.pivots) {
    // Cancel the body's unequal axis scales before rotating an arm in real units.
    const shoulder = new THREE.Group();
    shoulder.position.set(at[0], at[1], at[2]);
    shoulder.scale.set(1 / size[0], 1 / size[1], 1 / size[2]);
    const pivot = new THREE.Group();
    pivot.name = name;
    const parts = new THREE.Group();
    parts.scale.set(size[0], size[1], size[2]);
    pivot.add(parts);
    shoulder.add(pivot);
    group.add(shoulder);
    pivots.set(name, parts);
  }
  for (const part of model.parts as CharacterPart[]) {
    let material = materials.get(part.color);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color: part.color,
        roughness: 0.75,
      });
      materials.set(part.color, material);
    }
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(part.size[0], part.size[1], part.size[2]),
      material,
    );
    mesh.name = part.name;
    mesh.position.set(part.at[0], part.at[1], part.at[2]);
    const parent = part.pivot ? pivots.get(part.pivot) : group;
    if (!parent) throw new Error(`玩具の関節がありません: ${part.pivot}`);
    parent.add(mesh);
  }
  return group;
}

export function animateToyCharacter(
  group: THREE.Group,
  motion: Pick<ThemeMotion, "phase" | "time">,
  falling: boolean,
) {
  for (const [name, side] of [
    ["attack-arm", 1],
    ["other-arm", -1],
  ] as const) {
    const arm = group.getObjectByName(name);
    if (!arm) continue;
    if (!falling && motion.phase === "fighting") {
      const phase = motion.time * 6 + (side === 1 ? 0 : Math.PI);
      arm.rotation.set(-1.55 + Math.sin(phase) * 0.7, 0, -side * 0.12);
    } else if (!falling && motion.phase === "fleeing") {
      arm.rotation.set(
        -Math.PI + Math.sin(motion.time * 10) * 0.1,
        0,
        side * 0.22,
      );
    } else {
      arm.rotation.set(0, 0, 0);
    }
  }
}
