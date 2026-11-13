import * as THREE from "three";
import { objectVisual } from "./visuals";
import { plazaVisual } from "./plaza-visuals";
import { furnitureVisual } from "./furniture-visuals";
import { districtItem, type DistrictKind } from "./district-catalog";
const cream = "#e8dfc9",
  ink = "#526473",
  red = "#ba655b",
  steel = "#97a8aa",
  wood = "#bd9568";
function mat(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
}
function box(g: THREE.Group, s: number[], p: number[], color: string) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), mat(color));
  m.position.set(p[0], p[1], p[2]);
  g.add(m);
  return m;
}
function cylinder(
  g: THREE.Group,
  t: number,
  b: number,
  h: number,
  p: number[],
  color: string,
  n = 12,
) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(t, b, h, n), mat(color));
  m.position.set(p[0], p[1], p[2]);
  g.add(m);
  return m;
}
function ball(g: THREE.Group, s: number[], p: number[], color: string) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), mat(color));
  m.scale.set(s[0], s[1], s[2]);
  m.position.set(p[0], p[1], p[2]);
  g.add(m);
  return m;
}
function ring(
  g: THREE.Group,
  r: number,
  t: number,
  p: number[],
  color: string,
  flat = true,
) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 6, 12), mat(color));
  if (flat) m.rotation.x = Math.PI / 2;
  m.position.set(p[0], p[1], p[2]);
  g.add(m);
  return m;
}
function paint(g: THREE.Group, panels: number[][], z: number, color: string) {
  const v: number[] = [];
  for (const [x, y, w, h] of panels)
    for (const [dx, dy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, -1],
      [1, 1],
      [-1, 1],
    ])
      v.push(x + (dx * w) / 2, y + (dy * h) / 2, z);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  geo.computeVertexNormals();
  g.add(
    new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2,
      }),
    ),
  );
}
function cup(g: THREE.Group, color: string, handle = false) {
  cylinder(g, 0.32, 0.32, 0.08, [0, -0.4, 0], color);
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5;
    const m = box(
      g,
      [0.21, 0.7, 0.05],
      [Math.sin(a) * 0.32, -0.01, Math.cos(a) * 0.32],
      color,
    );
    m.rotation.y = a;
  }
  if (handle) ring(g, 0.2, 0.045, [0.4, 0, 0], color, false);
}
function ship(g: THREE.Group, tanker: boolean) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, -0.24);
  shape.lineTo(0.32, -0.24);
  shape.lineTo(0.55, 0);
  shape.lineTo(0.32, 0.24);
  shape.lineTo(-0.5, 0.24);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.24,
    bevelEnabled: false,
  })
    .rotateX(-Math.PI / 2)
    .translate(0, -0.4, 0);
  g.add(new THREE.Mesh(geo, mat("#a65e50")));
  box(g, [0.82, 0.04, 0.44], [-0.04, -0.15, 0], ink);
  box(g, [0.22, 0.38, 0.4], [-0.32, 0.05, 0], cream);
  box(g, [0.27, 0.06, 0.45], [-0.32, 0.27, 0], steel);
  if (tanker) {
    for (const x of [-0.08, 0.16, 0.35])
      cylinder(g, 0.1, 0.1, 0.2, [x, -0.03, 0], "#b9c6b8");
    const pipe = cylinder(g, 0.018, 0.018, 0.72, [0.06, 0.09, 0.14], red);
    pipe.rotation.z = Math.PI / 2;
    box(g, [0.06, 0.25, 0.08], [-0.37, 0.43, 0], ink);
  } else box(g, [0.35, 0.12, 0.33], [0.1, -0.07, 0], "#6e9ea7");
}
export function districtVisual(kind: DistrictKind) {
  const g = new THREE.Group(),
    item = districtItem(kind);
  if (item.original)
    g.add(
      objectVisual(
        item.original,
        kind === "dockWorker"
          ? "harbor"
          : kind === "officeWorker"
            ? "office"
            : "america",
      ),
    );
  else if (item.plaza) g.add(plazaVisual(item.plaza));
  else if (item.furniture) {
    const f = furnitureVisual(item.furniture);
    if (!f) throw new Error(`${kind}の家具がありません`);
    if (kind === "booth")
      f.traverse((o) => {
        if (
          o instanceof THREE.Mesh &&
          o.material instanceof THREE.MeshStandardMaterial
        )
          o.material.color.set(red);
      });
    g.add(f);
  } else if (kind === "crumb") ball(g, [1, 0.45, 0.7], [0, 0, 0], "#c99d64");
  else if (kind === "fries") box(g, [1, 0.16, 0.18], [0, 0, 0], "#e7c469");
  else if (kind === "wrapper") {
    for (let i = 0; i < 3; i++) {
      const p = box(
        g,
        [0.42, 0.025, 0.72],
        [(i - 1) * 0.3, Math.abs(i - 1) * 0.045, 0],
        i % 2 ? cream : "#dca99a",
      );
      p.rotation.z = (i - 1) * 0.2;
    }
  } else if (kind === "cap") cup(g, steel);
  else if (kind === "mug") cup(g, cream, true);
  else if (kind === "ketchup") {
    cylinder(g, 0.17, 0.23, 0.7, [0, -0.08, 0], red);
    cylinder(g, 0.09, 0.13, 0.18, [0, 0.35, 0], cream);
  } else if (kind === "griddle") {
    box(g, [1, 0.75, 0.7], [0, -0.12, 0], steel);
    box(g, [1.05, 0.06, 0.75], [0, 0.3, 0], ink);
    for (const x of [-0.3, 0, 0.3])
      cylinder(g, 0.04, 0.04, 0.04, [x, 0.05, 0.36], red).rotation.x =
        Math.PI / 2;
  } else if (kind === "trafficCone") {
    box(g, [0.8, 0.08, 0.8], [0, -0.44, 0], ink);
    cylinder(g, 0.05, 0.3, 0.85, [0, 0.02, 0], "#d99055", 8);
  } else if (kind === "diner") {
    box(g, [1, 0.65, 0.7], [0, -0.13, 0], cream);
    box(g, [1.08, 0.13, 0.8], [0, 0.26, 0], red);
    box(g, [1.1, 0.06, 0.84], [0, 0.37, 0], steel);
    paint(
      g,
      [
        [-0.32, -0.06, 0.22, 0.32],
        [0, -0.06, 0.22, 0.32],
        [0.32, -0.06, 0.22, 0.32],
      ],
      0.351,
      "#79a0ad",
    );
    box(g, [0.5, 0.15, 0.06], [0, 0.49, 0.1], red);
  } else if (kind === "construction") {
    for (const x of [-0.4, 0.4])
      for (const z of [-0.3, 0.3]) box(g, [0.08, 1, 0.08], [x, 0, z], steel);
    for (const y of [-0.43, 0, 0.45]) {
      for (const z of [-0.3, 0.3]) box(g, [0.9, 0.07, 0.08], [0, y, z], red);
      for (const x of [-0.4, 0.4]) box(g, [0.08, 0.07, 0.7], [x, y, 0], steel);
    }
  } else if (kind === "liberty") {
    box(g, [1, 0.08, 0.9], [0, -0.46, 0], "#cbbd9b");
    box(g, [0.74, 0.15, 0.66], [0, -0.35, 0], "#dfd2b0");
    cylinder(g, 0.14, 0.3, 0.61, [0, 0.02, 0], "#79aa91", 8);
    ball(g, [0.23, 0.2, 0.23], [0, 0.43, 0], "#79aa91");
    box(g, [0.08, 0.53, 0.09], [0.22, 0.5, 0], "#79aa91");
    cylinder(g, 0.08, 0.04, 0.1, [0.22, 0.82, 0], "#bd9958");
    ball(g, [0.12, 0.22, 0.12], [0.22, 0.96, 0], "#e7b55b");
    const arm = box(g, [0.08, 0.3, 0.09], [-0.2, 0.21, 0.08], "#79aa91");
    arm.rotation.z = -0.4;
    box(g, [0.2, 0.25, 0.05], [-0.22, 0.13, 0.12], "#639d87");
    for (let i = -2; i <= 2; i++) {
      const ray = box(
        g,
        [0.025, 0.15, 0.025],
        [i * 0.045, 0.57 - Math.abs(i) * 0.02, 0],
        "#639d87",
      );
      ray.rotation.z = -i * 0.3;
    }
  } else if (kind === "boat" || kind === "tanker") ship(g, kind === "tanker");
  else if (kind === "washer" || kind === "tape")
    ring(
      g,
      0.35,
      kind === "tape" ? 0.13 : 0.07,
      [0, 0, 0],
      kind === "tape" ? "#d8c69b" : steel,
    );
  else if (kind === "nut") {
    const s = new THREE.Shape();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const x = Math.cos(a) * 0.5,
        y = Math.sin(a) * 0.5;
      if (i) s.lineTo(x, y);
      else s.moveTo(x, y);
    }
    s.closePath();
    const h = new THREE.Path();
    h.absarc(0, 0, 0.2, 0, Math.PI * 2, true);
    s.holes.push(h);
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: 0.3,
      bevelEnabled: false,
      curveSegments: 4,
    }).rotateX(Math.PI / 2);
    g.add(new THREE.Mesh(geo, mat(steel)));
  } else if (kind === "bolt") {
    const shaft = cylinder(g, 0.07, 0.07, 0.8, [0, 0, 0], steel, 8);
    shaft.rotation.z = Math.PI / 2;
    cylinder(g, 0.2, 0.2, 0.14, [-0.42, 0, 0], steel, 6).rotation.z =
      Math.PI / 2;
  } else if (kind === "wrench") {
    box(g, [0.75, 0.07, 0.15], [-0.08, 0, 0], steel);
    for (const z of [-0.17, 0.17])
      box(g, [0.3, 0.07, 0.1], [0.35, 0, z], steel);
    box(g, [0.08, 0.07, 0.3], [0.22, 0, 0], steel);
  } else if (kind === "screwdriver") {
    const s = cylinder(g, 0.035, 0.035, 0.75, [0.12, 0, 0], steel, 8);
    s.rotation.z = Math.PI / 2;
    box(g, [0.4, 0.15, 0.15], [-0.4, 0, 0], red);
  } else if (kind === "rope")
    for (let i = 0; i < 3; i++)
      ring(g, 0.32 + i * 0.04, 0.035, [0, i * 0.06, 0], wood);
  else if (kind === "pallet") {
    for (const x of [-0.35, 0, 0.35])
      box(g, [0.13, 0.2, 0.65], [x, -0.1, 0], wood);
    for (const z of [-0.3, -0.1, 0.1, 0.3])
      box(g, [1, 0.08, 0.12], [0, 0.04, z], wood);
  } else if (kind === "forklift") {
    box(g, [0.65, 0.3, 0.55], [-0.15, -0.13, 0], "#d5ae55");
    for (const z of [-0.24, 0.24]) {
      box(g, [0.06, 0.95, 0.06], [0.16, 0.15, z], ink);
      box(g, [0.65, 0.05, 0.06], [0.37, -0.22, z], ink);
    }
    box(g, [0.55, 0.06, 0.7], [-0.12, 0.62, 0], "#d5ae55");
    for (const x of [-0.36, 0.15])
      for (const z of [-0.3, 0.3])
        cylinder(g, 0.15, 0.15, 0.1, [x, -0.32, z], ink).rotation.x =
          Math.PI / 2;
  } else if (kind === "warehouse") {
    box(g, [1, 0.7, 0.8], [0, -0.12, 0], "#b9c7c5");
    for (const side of [-1, 1]) {
      const roof = box(
        g,
        [0.65, 0.06, 0.95],
        [side * 0.25, 0.35, 0],
        "#7092a7",
      );
      roof.rotation.z = -side * 0.4;
    }
    paint(g, [[0, -0.2, 0.5, 0.5]], 0.401, ink);
  } else if (kind === "crane") {
    for (const x of [-0.38, 0.38])
      for (const z of [-0.3, 0.3])
        box(g, [0.1, 0.9, 0.1], [x, -0.05, z], "#d6a15b");
    box(g, [1, 0.12, 0.8], [0, 0.44, 0], "#d6a15b");
    box(g, [0.12, 0.14, 1.45], [0, 0.56, 0.3], "#d6a15b");
  } else if (kind === "clip") {
    const m = ring(g, 0.3, 0.035, [0, 0, 0], steel);
    m.scale.x = 1.7;
  } else if (kind === "pushpin") {
    cylinder(g, 0.04, 0.03, 0.6, [0, -0.1, 0], steel, 8);
    cylinder(g, 0.25, 0.2, 0.13, [0, 0.26, 0], red);
  } else if (kind === "keyboard") {
    box(g, [1, 0.1, 0.4], [0, 0, 0], ink);
    for (let i = 0; i < 4; i++)
      box(g, [0.87, 0.025, 0.05], [0, 0.06, (i - 1.5) * 0.08], cream);
  } else if (kind === "monitor") {
    box(g, [0.9, 0.6, 0.06], [0, 0.15, 0], ink);
    box(g, [0.08, 0.35, 0.08], [0, -0.25, 0], steel);
    box(g, [0.5, 0.05, 0.3], [0, -0.45, 0], steel);
    paint(g, [[0, 0.15, 0.8, 0.5]], 0.031, "#8baeb8");
  } else if (kind === "cart") {
    box(g, [1, 0.1, 0.6], [0, -0.2, 0], steel);
    for (const z of [-0.25, 0.25])
      box(g, [0.06, 0.7, 0.06], [-0.4, 0.1, z], ink);
    for (const x of [-0.35, 0.35])
      for (const z of [-0.28, 0.28])
        cylinder(g, 0.1, 0.1, 0.07, [x, -0.33, z], ink).rotation.x =
          Math.PI / 2;
    box(g, [0.55, 0.4, 0.4], [0.1, 0.05, 0], wood);
  } else if (kind === "meetingRoom") {
    const table = furnitureVisual("table")!;
    table.scale.set(0.8, 0.55, 0.6);
    table.position.y = -0.15;
    g.add(table);
    for (const x of [-0.42, 0.42]) {
      const c = furnitureVisual("chair")!;
      c.scale.set(0.2, 0.7, 0.2);
      c.position.x = x;
      g.add(c);
    }
  } else if (kind === "headOffice") {
    box(g, [1, 0.07, 0.9], [0, -0.465, 0], steel);
    for (const x of [-0.4, 0, 0.4])
      box(g, [0.08, 0.23, 0.08], [x, -0.315, 0.3], steel);
    box(g, [0.92, 0.79, 0.72], [0, 0.105, -0.02], "#9cb6bd");
    box(g, [1, 0.04, 0.86], [0, -0.25, 0], cream);
    box(g, [0.96, 0.03, 0.76], [0, 0.515, -0.02], steel);
    const panels: number[][] = [];
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 5; x++)
        panels.push([(x - 2) * 0.17, y * 0.085 - 0.22, 0.11, 0.05]);
    paint(g, panels, 0.341, "#507a90");
  } else throw new Error(`${kind}のモデルがありません`);
  g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g),
    size = b.getSize(new THREE.Vector3()),
    centre = b.getCenter(new THREE.Vector3());
  if (Math.min(size.x, size.y, size.z) <= 0)
    throw new Error(`${kind}のモデルが空です`);
  const fit = new THREE.Group();
  fit.scale.set(1 / size.x, 1 / size.y, 1 / size.z);
  fit.position.copy(centre).multiply(fit.scale).negate();
  fit.add(g);
  const result = new THREE.Group();
  result.add(fit);
  return result;
}
