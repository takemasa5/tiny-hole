import * as THREE from "three";
import { MAP_HALF_SIZE, ROADS, type ObjectKind, type StageId } from "./stage";

export function material(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
}
export function box(
  group: THREE.Group,
  size: readonly number[],
  color: string,
  position = [0, 0, 0],
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    material(color),
  );
  mesh.position.set(position[0], position[1], position[2]);
  group.add(mesh);
  return mesh;
}
export function cylinder(
  group: THREE.Group,
  radius: number,
  height: number,
  color: string,
  position: number[],
  rotationX = 0,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 16),
    material(color),
  );
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.x = rotationX;
  group.add(mesh);
  return mesh;
}
function actor(group: THREE.Group, worker: boolean) {
  box(group, [0.36, 0.46, 0.24], worker ? "#eead44" : "#71977b", [0, 0.02, 0]);
  box(group, [0.28, 0.26, 0.28], "#eac39d", [0, 0.39, 0]);
  if (worker) {
    cylinder(group, 0.19, 0.12, "#f5cd55", [0, 0.58, 0]);
    for (const x of [-0.1, 0.1])
      box(group, [0.035, 0.4, 0.025], "#fff2b3", [x, 0.02, 0.13]);
  } else box(group, [0.3, 0.13, 0.3], "#3c6454", [0, 0.585, 0]);
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.1, -0.2, 0);
    box(leg, [0.13, 0.4, 0.14], "#4c686d", [0, -0.2, 0]);
    box(leg, [0.16, 0.05, 0.22], "#35464d", [0, -0.425, 0.025]);
    leg.userData.stride = side;
    group.add(leg);
    const arm = new THREE.Group();
    arm.position.set(side * 0.225, 0.16, 0);
    box(arm, [0.09, 0.37, 0.11], worker ? "#eead44" : "#71977b", [0, -0.18, 0]);
    arm.userData.stride = -side;
    group.add(arm);
    box(group, [0.035, 0.035, 0.02], "#30434b", [side * 0.06, 0.43, 0.145]);
  }
}

export function expansionObjectVisual(
  kind: ObjectKind,
): THREE.Group | undefined {
  const group = new THREE.Group();
  switch (kind) {
    case "buoy": {
      cylinder(group, 0.275, 0.45, "#f0e9d4", [0, -0.1, 0]);
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 0.2, 16),
        material("#dc7253"),
      );
      tip.position.y = 0.225;
      group.add(tip);
      break;
    }
    case "barrel": {
      cylinder(group, 0.57, 1.3, "#a47a52", [0, 0, 0]);
      for (const y of [-0.43, 0.43]) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.56, 0.035, 6, 16),
          material("#536069"),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        group.add(ring);
      }
      break;
    }
    case "cargoCrate": {
      box(group, [1.6, 1.4, 1.6], "#c99761");
      for (const side of [-1, 1]) {
        for (const y of [-0.65, 0.65])
          box(group, [1.7, 0.14, 0.12], "#8b6847", [0, y, side * 0.79]);
        for (const x of [-0.77, 0.77])
          box(group, [0.14, 1.5, 0.14], "#a37a50", [x, 0, side * 0.77]);
        box(group, [1.6, 0.12, 0.1], "#9c754d", [0, 0, side * 0.8]).rotation.z =
          Math.PI / 5;
      }
      break;
    }
    case "timber":
      box(group, [2.5, 0.25, 0.45], "#b18a61");
      for (const x of [-1.24, 1.24])
        box(group, [0.02, 0.25, 0.45], "#d8b789", [x, 0, 0]);
      break;
    case "dinghy": {
      const hull = cylinder(group, 1, 0.6, "#719eb4", [0, -0.2, 0]);
      hull.scale.set(1.35, 1, 0.675);
      const deck = cylinder(group, 0.87, 0.05, "#efe3bc", [0, 0.115, 0]);
      deck.scale.set(1.35, 1, 0.675);
      for (const x of [-0.55, 0.55])
        box(group, [0.23, 0.14, 1.05], "#ba9469", [x, 0.2, 0]);
      box(group, [0.1, 0.6, 0.45], "#b78b60", [-1.05, 0.2, 0]);
      break;
    }
    case "container":
      box(group, [3.5, 3, 3.5], "#bd7859");
      for (const side of [-1, 1]) {
        for (let x = -1.5; x <= 1.5; x += 0.3)
          box(group, [0.055, 2.8, 0.07], "#d9936e", [x, 0, side * 1.7]);
        box(group, [0.04, 2.7, 0.06], "#dce0d4", [1.73, 0, side * 0.7]);
      }
      break;
    case "dockWorker":
      actor(group, true);
      break;
    case "toySoldier":
      actor(group, false);
      break;
    case "harborCrane": {
      box(group, [6, 0.8, 6], "#687e86", [0, -6.1, 0]);
      for (const x of [-2.5, 2.5])
        for (const z of [-2.5, 2.5])
          box(group, [0.6, 9, 0.6], "#e1b34f", [x, -1.2, z]);
      for (const z of [-2.5, 2.5])
        box(group, [6, 0.7, 0.65], "#e8bd58", [0, 3.65, z]);
      box(group, [0.6, 0.6, 6], "#dca244", [0, 4, 0]);
      box(group, [1.8, 1.2, 1.8], "#527e97", [0, 4.9, 0]);
      for (const x of [-0.7, 0.7])
        box(group, [0.25, 2, 0.25], "#ddae48", [x, 5.5, 0]);
      cylinder(group, 0.045, 3.3, "#3e535b", [1, 1.8, 0.8]);
      const hook = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.08, 6, 16, Math.PI * 1.5),
        material("#485c65"),
      );
      hook.position.set(1, -0.1, 0.8);
      group.add(hook);
      break;
    }
    case "toyBlock":
      box(group, [0.65, 0.65, 0.65], "#e88c7c");
      box(group, [0.3, 0.3, 0.012], "#f6d779", [0, 0, 0.319]);
      break;
    case "toyBall":
      for (const [index, color] of [
        "#84b7d4",
        "#f0c858",
        "#e98f7e",
        "#8bbc9c",
      ].entries())
        group.add(
          new THREE.Mesh(
            new THREE.SphereGeometry(
              0.5,
              8,
              12,
              (index * Math.PI) / 2,
              Math.PI / 2,
            ),
            material(color),
          ),
        );
      break;
    case "toyTrain": {
      box(group, [1.8, 0.35, 0.65], "#699780", [0, -0.15, 0]);
      box(group, [0.55, 0.4, 0.6], "#dda35b", [-0.5, 0.2, 0]);
      const boiler = cylinder(group, 0.24, 0.95, "#81b397", [0.2, 0.06, 0]);
      boiler.rotation.z = Math.PI / 2;
      cylinder(group, 0.12, 0.2, "#758b8f", [0.4, 0.35, 0]);
      for (const x of [-0.65, 0, 0.65])
        for (const z of [-0.28, 0.28])
          cylinder(group, 0.14, 0.08, "#526975", [x, -0.3, z], Math.PI / 2);
      break;
    }
    case "toyCar":
      box(group, [2.2, 0.35, 1.15], "#efbf57", [0, -0.15, 0]);
      box(group, [1.2, 0.45, 1.05], "#91bccc", [0, 0.2, 0]);
      for (const x of [-0.65, 0.65])
        for (const z of [-0.52, 0.52])
          cylinder(group, 0.25, 0.15, "#5d7687", [x, -0.25, z], Math.PI / 2);
      break;
    case "toyTower":
      for (const [index, color] of ["#9dbdcf", "#e9b55e", "#ae9ccb"].entries())
        box(group, [1.7, 0.8, 1.7], color, [0, -0.8 + index * 0.8, 0]);
      break;
    case "toyHouse": {
      box(group, [3.5, 2.7, 3.5], "#97c4c1", [0, -0.65, 0]);
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(3.5 / Math.SQRT2, 1.3, 4),
        material("#e19585"),
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 1.35;
      group.add(roof);
      box(group, [0.65, 1.5, 0.06], "#f1cb7a", [0, -1.25, 1.71]);
      for (const x of [-0.95, 0.95])
        box(group, [0.6, 0.6, 0.04], "#ecf3de", [x, -0.1, 1.72]);
      break;
    }
    case "giantRobot": {
      for (const side of [-1, 1]) {
        box(group, [2, 0.9, 3], "#607e9c", [side * 1.5, -5.05, 0.3]);
        box(group, [1.3, 3, 1.4], "#93b6d2", [side * 1.4, -3.3, 0]);
        box(group, [0.85, 3.6, 1.1], "#9ebed4", [side * 2.5, -0.2, 0]);
        box(group, [1, 1, 1.3], "#ce9a73", [side * 2.5, -2.2, 0.05]);
        box(group, [0.45, 0.35, 0.05], "#f9e29d", [side * 0.7, 2.7, 1.215]);
      }
      box(group, [3.6, 3, 2.3], "#81a7c6", [0, -0.4, 0]);
      box(group, [2, 1, 0.08], "#eab16d", [0, -0.1, 1.18]);
      box(group, [2.8, 2.3, 2.4], "#a7c7dc", [0, 2.45, 0]);
      cylinder(group, 0.075, 1.6, "#5e7e99", [0, 4.5, 0]);
      const antenna = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 10, 8),
        material("#d99580"),
      );
      antenna.position.y = 5.3;
      group.add(antenna);
      break;
    }
    default:
      return undefined;
  }
  return group;
}

export function drawExpansionGround(
  context: CanvasRenderingContext2D,
  stageId: StageId,
) {
  if (stageId !== "harbor" && stageId !== "toys") return false;
  const harbor = stageId === "harbor";
  context.fillStyle = harbor ? "#bbc7cb" : "#f2e4c3";
  context.fillRect(0, 0, 1024, 1024);
  for (let x = 0; x < 1024; x += 64)
    for (let y = 0; y < 1024; y += 64) {
      context.fillStyle = harbor
        ? "#aebdc2"
        : ["#eadab6", "#e7dcc5"][((x + y) / 64) % 2];
      context.fillRect(x + 2, y + 2, 60, 60);
    }
  const pixel = (value: number) =>
    ((value + MAP_HALF_SIZE) / (MAP_HALF_SIZE * 2)) * 1024;
  for (const road of ROADS) {
    const edge = pixel(road.position - road.width / 2),
      width = (road.width / (MAP_HALF_SIZE * 2)) * 1024;
    context.fillStyle = harbor ? "#778f99" : "#b3b7c9";
    if (road.axis === "x") context.fillRect(0, edge, 1024, width);
    else context.fillRect(edge, 0, width, 1024);
    context.strokeStyle = harbor ? "#f2d676" : "#f6f1df";
    context.lineWidth = 3;
    context.setLineDash([14, 14]);
    context.beginPath();
    if (road.axis === "x") {
      context.moveTo(0, pixel(road.position));
      context.lineTo(1024, pixel(road.position));
    } else {
      context.moveTo(pixel(road.position), 0);
      context.lineTo(pixel(road.position), 1024);
    }
    context.stroke();
  }
  context.setLineDash([]);
  return true;
}
