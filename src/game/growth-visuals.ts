import * as THREE from "three";
import { objectVisual } from "./visuals";
import { type GrowthObject } from "./growth-stage";
import { BoundaryGuide } from "./boundary-guide";
import { STAGES, type StageId } from "./stage";
import { mountainVisual } from "./mountain-visuals";
import { plazaVisual } from "./plaza-visuals";
import { hellVisual } from "./hell-visuals";
import { egyptVisual } from "./egypt-visuals";
import { toyVisual } from "./toy-visuals";
import { GROUND_PAINT_RENDER_ORDER } from "./ground-geometry";

function box(group: THREE.Group, size: number[], at: number[], color: string) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    new THREE.MeshStandardMaterial({ color, roughness: 0.75 }),
  );
  mesh.position.set(at[0], at[1], at[2]);
  group.add(mesh);
  return mesh;
}

export function growthVisual(
  definition: GrowthObject,
  stageId: StageId,
  preview = false,
) {
  const group = new THREE.Group();
  if (definition.model === "mountain") {
    if (!definition.mountainKind) throw new Error("山の種類がありません。");
    group.add(mountainVisual(definition.mountainKind));
  } else if (definition.model === "plaza") {
    if (!definition.plazaKind) throw new Error("広場の種類がありません。");
    group.add(plazaVisual(definition.plazaKind));
  } else if (definition.model === "hell") {
    if (!definition.hellKind) throw new Error("地獄の種類がありません。");
    group.add(hellVisual(definition.hellKind));
  } else if (definition.model === "egypt") {
    if (!definition.egyptKind) throw new Error("エジプトの種類がありません。");
    group.add(egyptVisual(definition.egyptKind));
  } else if (definition.model === "colossalRobot") {
    const robot = objectVisual("giantRobot", stageId);
    robot.scale.set(1 / 6, 1 / 11, 1 / 6);
    group.add(robot);
  } else if (definition.model === "toy") {
    if (!definition.toyKind) throw new Error("玩具の種類がありません。");
    group.add(toyVisual(definition.toyKind));
  } else if (preview && definition.model === "original") {
    const original = objectVisual(definition.kind, stageId);
    original.scale.setScalar(definition.scale);
    group.add(original);
    group.userData.objectId = definition.id;
    return group;
  } else if (
    preview &&
    !["hero", "monster", "tanker"].includes(definition.model)
  ) {
    box(
      group,
      [0.95, 1, 0.95],
      [0, 0, 0],
      definition.model === "building" ? "#94acb4" : STAGES[stageId].accent,
    );
  } else if (definition.model === "original") {
    const original = objectVisual(definition.kind, stageId);
    original.scale.setScalar(definition.scale);
    group.add(original);
    group.userData.objectId = definition.id;
    return group;
  } else if (definition.model === "depot") {
    // Bands occupy their own sections so no exterior faces compete at any scale.
    const edges = [-0.5, -0.35, -0.25, 0.25, 0.35, 0.5];
    for (let section = 0; section < edges.length - 1; section++) {
      const width = edges[section + 1] - edges[section];
      const x = (edges[section + 1] + edges[section]) / 2;
      const band = section === 1 || section === 3;
      box(group, [width, 0.8, 1], [x, -0.1, 0], band ? "#6f7779" : "#ad8454");
      box(group, [width, 0.2, 1], [x, 0.4, 0], band ? "#6f7779" : "#d6b16c");
    }
  } else if (definition.model === "building") {
    box(group, [1, 0.1, 1], [0, -0.45, 0], "#7c8d94");
    box(group, [0.9, 0.9, 0.9], [0, 0.05, 0], "#a7c4cf");
    const windows = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.12, 0.045, 0.012),
      new THREE.MeshStandardMaterial({ color: "#36566a", roughness: 0.35 }),
      64,
    );
    const dummy = new THREE.Object3D();
    for (let n = 0; n < 64; n++) {
      dummy.position.set(
        ((n % 4) - 1.5) * 0.2,
        Math.floor((n % 32) / 4) * 0.1 - 0.3,
        n < 32 ? 0.457 : -0.457,
      );
      dummy.updateMatrix();
      windows.setMatrixAt(n, dummy.matrix);
    }
    group.add(windows);
  } else if (definition.model === "tanker") {
    const hull = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.36, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: "#bb624b", roughness: 0.8 }),
    );
    hull.position.y = -0.225;
    group.add(hull);
    box(group, [0.83, 0.08, 0.75], [0, 0.09, 0], "#dfc7a1");
    box(group, [0.14, 0.38, 0.6], [-0.3, 0.31, 0], "#f5eee0");
    box(group, [0.15, 0.08, 0.64], [-0.3, 0.43, 0], "#436c7b");
    for (const x of [-0.08, 0.12, 0.32]) {
      box(group, [0.12, 0.12, 0.4], [x, 0.19, 0], "#c9a263");
      box(group, [0.035, 0.04, 0.7], [x, 0.13, 0], "#7e8c91");
    }
  } else if (definition.model === "hero" || definition.model === "monster") {
    const hero = definition.model === "hero";
    const color = hero ? "#d1e2e9" : "#65916b";
    box(group, [0.5, 0.4, 0.48], [0, 0.02, 0], color);
    box(group, [0.42, 0.2, 0.42], [0, 0.4, 0.02], color);
    box(
      group,
      [0.35, 0.05, 0.05],
      [0, 0.42, 0.25],
      hero ? "#fff1a0" : "#ffbf73",
    );
    if (hero) box(group, [0.27, 0.24, 0.03], [0, 0.05, 0.26], "#d76b5b");
    else
      for (const y of [-0.2, 0, 0.2])
        box(group, [0.22, 0.08, 0.2], [0, y, -0.34], "#c2b581");
    for (const side of [-1, 1]) {
      box(group, [0.2, 0.35, 0.32], [side * 0.15, -0.325, 0], color);
      const arm = new THREE.Group();
      arm.name = side === 1 ? "attack-arm" : "other-arm";
      arm.position.set(side * 0.35, 0.17, 0);
      box(arm, [0.16, 0.3, 0.22], [0, -0.15, 0], color);
      group.add(arm);
    }
  } else if (definition.model === "nut") {
    const nut = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.16, 6, 6),
      new THREE.MeshStandardMaterial({
        color: "#a8b9bd",
        metalness: 0.4,
        roughness: 0.5,
      }),
    );
    nut.rotation.x = Math.PI / 2;
    nut.scale.y = 0.95;
    group.add(nut);
  } else if (definition.model === "bone") {
    box(group, [0.6, 0.5, 0.4], [0, 0, 0], "#e6ddc2");
    for (const side of [-1, 1])
      box(group, [0.3, 0.85, 0.8], [side * 0.32, 0, 0], "#f0e6ce");
  } else {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 10, 8),
      new THREE.MeshStandardMaterial({
        color: definition.model === "seed" ? "#9d7049" : "#e4a8a1",
      }),
    );
    group.add(sphere);
    if (definition.model === "seed")
      box(group, [0.7, 0.15, 0.7], [0, 0.4, 0], "#5e7451");
  }
  group.scale.set(...definition.size);
  group.userData.objectId = definition.id;
  return group;
}

export class GrowthScenery {
  readonly group = new THREE.Group();
  private hole = { value: new THREE.Vector2() };
  private radius = { value: 0.08 };
  private boundary = new BoundaryGuide();

  constructor(definitions: GrowthObject[], stageId: StageId) {
    const roadColor =
      stageId === "mountain"
        ? "#b5a77a"
        : stageId === "egypt"
          ? "#c0a06c"
          : stageId === "hell"
            ? "#625d65"
            : "#687d86";
    const material = new THREE.MeshStandardMaterial({
      color: roadColor,
      roughness: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.holeCentre = this.hole;
      shader.uniforms.holeRadius = this.radius;
      shader.vertexShader =
        "varying vec2 worldXZ;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n worldXZ = (modelMatrix * vec4(position, 1.0)).xz;",
        );
      shader.fragmentShader =
        "varying vec2 worldXZ; uniform vec2 holeCentre; uniform float holeRadius;\n" +
        shader.fragmentShader.replace(
          "#include <clipping_planes_fragment>",
          "#include <clipping_planes_fragment>\n if (distance(worldXZ, holeCentre) < holeRadius) discard;",
        );
    };
    const routes = new Map<string, GrowthObject>();
    for (const definition of definitions)
      if (
        stageId !== "mountain" &&
        stageId !== "plaza" &&
        stageId !== "egypt" &&
        stageId !== "hell" &&
        definition.route &&
        (stageId !== "toys" || ["route", "train"].includes(definition.behavior))
      )
        routes.set(JSON.stringify(definition.route), definition);
    const tint = (color: string) => {
      const painted = material.clone();
      painted.color.set(color);
      painted.onBeforeCompile = material.onBeforeCompile;
      return painted;
    };
    const patch = (
      width: number,
      depth: number,
      x: number,
      z: number,
      angle: number,
      paint: THREE.Material,
      order = 2,
    ) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), paint);
      mesh.rotation.set(-Math.PI / 2, 0, -angle);
      mesh.position.set(x, 0.001, z);
      mesh.renderOrder = GROUND_PAINT_RENDER_ORDER + order + 20;
      this.group.add(mesh);
      return mesh;
    };
    const sleeperPaint = tint("#c39c79");
    const railPaint = tint("#596a74");
    const markingPaint = tint("#f5e8c9");
    for (const definition of routes.values()) {
      const route = definition.route!;
      const width = Math.max(definition.size[0], definition.size[2]) * 1.5;
      for (let i = 0; i < route.length; i++) {
        const a = route[i],
          b = route[(i + 1) % route.length];
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        const angle = Math.atan2(b.z - a.z, b.x - a.x);
        const x = (a.x + b.x) / 2,
          z = (a.z + b.z) / 2;
        if (stageId === "toys" && definition.behavior === "train") {
          for (let tie = 0; tie < 12; tie++) {
            const t = (tie + 0.5) / 12;
            patch(
              width * 0.1,
              width * 0.8,
              a.x + (b.x - a.x) * t,
              a.z + (b.z - a.z) * t,
              angle,
              sleeperPaint,
            );
          }
          for (const side of [-1, 1])
            patch(
              length,
              width * 0.055,
              x - Math.sin(angle) * width * 0.23 * side,
              z + Math.cos(angle) * width * 0.23 * side,
              angle,
              railPaint,
              3,
            );
        } else {
          patch(length, width, x, z, angle, material);
          if (stageId === "toys")
            for (let dash = 0; dash < 5; dash++) {
              const t = (dash + 0.5) / 5;
              patch(
                length / 12,
                width * 0.035,
                a.x + (b.x - a.x) * t,
                a.z + (b.z - a.z) * t,
                angle,
                markingPaint,
                3,
              );
            }
        }
      }
    }
    if (stageId === "harbor") {
      const water = material.clone();
      water.color.set("#78aab6");
      water.onBeforeCompile = material.onBeforeCompile;
      const basin = new THREE.Mesh(new THREE.PlaneGeometry(600, 450), water);
      basin.rotation.x = -Math.PI / 2;
      basin.position.set(1000, 0.0008, 700);
      basin.renderOrder = GROUND_PAINT_RENDER_ORDER + 1;
      this.group.add(basin);
      const quay = new THREE.Mesh(new THREE.PlaneGeometry(600, 40), material);
      quay.rotation.x = -Math.PI / 2;
      quay.position.set(1000, 0.001, 450);
      quay.renderOrder = GROUND_PAINT_RENDER_ORDER + 2;
      this.group.add(quay);
    }
    if (!["toys", "hell", "plaza", "mountain"].includes(stageId))
      this.group.add(this.boundary.group);
  }

  update(hole: { x: number; z: number; radius: number }, area: number) {
    this.hole.value.set(hole.x, hole.z);
    this.radius.value = hole.radius;
    this.boundary.update(hole, area);
  }

  boundarySnapshot() {
    return this.boundary.snapshot();
  }
}
