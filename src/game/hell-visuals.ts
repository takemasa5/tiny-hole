import * as THREE from "three";
export type HellKind =
  | "pebble"
  | "cairn"
  | "smallOni"
  | "ghost"
  | "redOni"
  | "blueOni"
  | "enma"
  | "lantern"
  | "torii"
  | "statue"
  | "cauldron"
  | "needleRock"
  | "palace";
const gold = "#e2b454",
  ink = "#34323d",
  stone = "#87818a",
  cream = "#f3e4c7";
function mat(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
}
function box(g: THREE.Group, size: number[], at: number[], color: string) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    mat(color),
  );
  m.position.set(at[0], at[1], at[2]);
  g.add(m);
  return m;
}
function cylinder(
  g: THREE.Group,
  top: number,
  bottom: number,
  height: number,
  at: number[],
  color: string,
  segments = 10,
) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(top, bottom, height, segments),
    mat(color),
  );
  m.position.set(at[0], at[1], at[2]);
  g.add(m);
  return m;
}
function cone(
  g: THREE.Group,
  radius: number,
  height: number,
  at: number[],
  color: string,
  segments = 8,
) {
  const m = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, segments),
    mat(color),
  );
  m.position.set(at[0], at[1], at[2]);
  g.add(m);
  return m;
}
function pebble(g: THREE.Group, at: number[], size: number[]) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), mat(stone));
  m.position.set(at[0], at[1], at[2]);
  m.scale.set(size[0], size[1], size[2]);
  g.add(m);
}
// Flat painted rectangles add facial detail without adding invisible supporting volumes.
function paint(
  g: THREE.Group,
  z: number,
  rectangles: [number, number, number, number, string][],
) {
  const vertices: number[] = [],
    colors: number[] = [];
  for (const [x, y, w, h, color] of rectangles) {
    const c = new THREE.Color(color);
    for (const [dx, dy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, -1],
      [1, 1],
      [-1, 1],
    ]) {
      vertices.push(x + (dx * w) / 2, y + (dy * h) / 2, z);
      colors.push(c.r, c.g, c.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    }),
  );
  g.add(m);
}
function actor(g: THREE.Group, kind: HellKind) {
  const ghost = kind === "ghost",
    enma = kind === "enma";
  const skin = ghost
    ? "#d5d5c9"
    : kind === "redOni" || enma
      ? "#c85950"
      : kind === "smallOni"
        ? "#6e91bf"
        : "#527caf";
  box(
    g,
    [0.48, 0.36, 0.3],
    [0, 0, 0],
    ghost ? "#e8e5d6" : enma ? "#775480" : skin,
  );
  box(g, [0.5, 0.4, 0.38], [0, 0.36, 0], skin);
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.14, -0.2, 0);
    leg.userData.stride = side;
    box(
      leg,
      [0.15, 0.3, 0.18],
      [0, -0.15, 0],
      ghost ? "#e8e5d6" : enma ? "#775480" : skin,
    );
    box(leg, [0.19, 0.07, 0.28], [0, -0.32, 0.035], enma ? ink : skin);
    g.add(leg);
    const arm = new THREE.Group();
    arm.position.set(side * 0.32, 0.11, 0);
    arm.userData.stride = -side;
    box(
      arm,
      [0.12, 0.35, 0.15],
      [0, -0.16, 0],
      ghost ? "#e8e5d6" : enma ? "#775480" : skin,
    );
    g.add(arm);
  }
  box(
    g,
    [0.51, 0.15, 0.33],
    [0, -0.2, 0],
    ghost ? "#e8e5d6" : enma ? "#775480" : gold,
  );
  paint(g, 0.192, [
    [-0.1, 0.39, 0.11, 0.065, cream],
    [0.1, 0.39, 0.11, 0.065, cream],
    [-0.1, 0.4, 0.035, 0.055, ink],
    [0.1, 0.4, 0.035, 0.055, ink],
    [-0.11, 0.47, 0.15, 0.035, ink],
    [0.11, 0.47, 0.15, 0.035, ink],
    [0, 0.24, 0.2, 0.06, ink],
    [0, 0.265, 0.15, 0.024, cream],
  ]);
  if (ghost) {
    box(g, [0.52, 0.08, 0.39], [0, 0.57, -0.005], ink);
    cone(g, 0.14, 0.18, [0, 0.64, 0.01], cream, 4);
    paint(g, 0.152, [
      [-0.045, 0, 0.035, 0.29, ink],
      [0.045, 0, 0.035, 0.29, cream],
    ]);
  } else if (enma) {
    box(g, [0.6, 0.24, 0.43], [0, 0.68, 0], ink);
    box(g, [0.72, 0.05, 0.48], [0, 0.55, 0], ink);
    paint(g, 0.217, [
      [0, 0.69, 0.03, 0.2, gold],
      [0, 0.77, 0.22, 0.025, gold],
      [0, 0.69, 0.18, 0.025, gold],
      [0, 0.6, 0.24, 0.025, gold],
    ]);
    box(g, [0.51, 0.05, 0.34], [0, -0.1, 0], gold);
    box(g, [0.08, 0.5, 0.05], [0.4, 0.04, 0.13], gold);
    cone(g, 0.1, 0.19, [0, 0.13, 0.19], ink, 4).rotation.z = Math.PI;
  } else {
    for (const side of [-1, 1])
      cone(g, 0.055, 0.18, [side * 0.13, 0.63, 0], gold);
    paint(g, 0.167, [
      [-0.12, -0.2, 0.04, 0.13, ink],
      [0.02, -0.2, 0.04, 0.13, ink],
      [0.16, -0.2, 0.04, 0.13, ink],
    ]);
    cylinder(g, 0.035, 0.035, 0.52, [0.39, -0.04, 0.12], ink);
    cylinder(g, 0.075, 0.075, 0.27, [0.39, 0.15, 0.12], stone, 6);
  }
}
export function hellVisual(kind: HellKind) {
  const g = new THREE.Group();
  if (["smallOni", "ghost", "redOni", "blueOni", "enma"].includes(kind))
    actor(g, kind);
  else if (kind === "pebble") pebble(g, [0, 0, 0], [1, 0.55, 0.8]);
  else if (kind === "cairn") {
    pebble(g, [0, -0.32, 0], [1, 0.35, 0.8]);
    pebble(g, [0, -0.02, 0], [0.7, 0.32, 0.6]);
    pebble(g, [0, 0.26, 0], [0.43, 0.3, 0.4]);
  } else if (kind === "torii") {
    for (const side of [-1, 1]) {
      box(g, [0.12, 0.9, 0.13], [side * 0.42, -0.05, 0], "#aa514d");
      box(g, [0.22, 0.08, 0.24], [side * 0.42, -0.46, 0], stone);
    }
    box(g, [1.15, 0.1, 0.22], [0, 0.45, 0], ink);
    box(g, [1.03, 0.08, 0.14], [0, 0.27, 0], "#c26550");
  } else if (kind === "lantern") {
    cylinder(g, 0.2, 0.25, 0.14, [0, -0.43, 0], stone);
    box(g, [0.12, 0.55, 0.12], [0, -0.1, 0], stone);
    box(g, [0.38, 0.25, 0.32], [0, 0.28, 0], "#e7ac55");
    cone(g, 0.35, 0.18, [0, 0.49, 0], ink, 4);
  } else if (kind === "statue") {
    cylinder(g, 0.3, 0.4, 0.13, [0, -0.43, 0], stone);
    cone(g, 0.27, 0.6, [0, -0.1, 0], stone);
    box(g, [0.33, 0.3, 0.3], [0, 0.3, 0], stone);
    box(g, [0.26, 0.14, 0.025], [0, -0.07, 0.245], "#b4655e");
  } else if (kind === "cauldron") {
    cylinder(g, 0.32, 0.32, 0.12, [0, -0.4, 0], ink);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const wall = box(
        g,
        [0.07, 0.65, 0.19],
        [Math.sin(a) * 0.34, -0.07, Math.cos(a) * 0.34],
        stone,
      );
      wall.rotation.y = a;
    }
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.05, 6, 12),
      mat(ink),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.255;
    g.add(rim);
  } else if (kind === "needleRock") {
    for (const [x, z, h] of [
      [0, 0, 1],
      [-0.3, 0.15, 0.65],
      [0.3, 0.18, 0.8],
      [0, -0.3, 0.7],
    ])
      cone(g, 0.24, h, [x, h / 2 - 0.5, z], stone, 5);
  } else if (kind === "palace") {
    box(g, [1, 0.1, 0.8], [0, -0.45, 0], stone);
    for (const x of [-0.4, 0, 0.4])
      for (const z of [-0.3, 0.3])
        box(g, [0.08, 0.68, 0.08], [x, -0.06, z], "#a65351");
    box(g, [0.9, 0.6, 0.1], [0, -0.1, -0.28], "#77515e");
    const roof = cone(g, 0.74, 0.3, [0, 0.4, 0], ink, 4);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.75;
    box(g, [1.1, 0.07, 0.85], [0, 0.24, 0], gold);
  }
  g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g),
    size = b.getSize(new THREE.Vector3()),
    centre = b.getCenter(new THREE.Vector3());
  const fit = new THREE.Group();
  fit.scale.set(1 / size.x, 1 / size.y, 1 / size.z);
  fit.position.copy(centre).multiply(fit.scale).negate();
  fit.add(g);
  const result = new THREE.Group();
  result.add(fit);
  return result;
}
