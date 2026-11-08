import * as THREE from "three";
import { objectVisual } from "./visuals";
import { egyptianReliefVisual } from "./egyptian-relief";

export type EgyptKind =
  | "seal"
  | "scarab"
  | "muralPerson"
  | "muralBird"
  | "muralBoat"
  | "jar"
  | "chest"
  | "offering"
  | "table"
  | "sarcophagus"
  | "statue"
  | "priest"
  | "column"
  | "obelisk"
  | "shrine"
  | "gateway"
  | "sphinx"
  | "house"
  | "stall"
  | "palm"
  | "temple"
  | "pyramid"
  | "camel"
  | "anubis"
  | "horus"
  | "sobek";
const stone = "#cfaf75",
  blue = "#355c78",
  gold = "#c9a451",
  linen = "#eee1bd",
  ink = "#34332f";
function material(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
}
function box(
  g: THREE.Group,
  size: [number, number, number],
  at: number[],
  color = stone,
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color));
  m.position.set(at[0], at[1], at[2]);
  g.add(m);
  return m;
}
function cylinder(
  g: THREE.Group,
  top: number,
  bottom: number,
  h: number,
  at: number[],
  color = stone,
) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(top, bottom, h, 12),
    material(color),
  );
  m.position.set(at[0], at[1], at[2]);
  g.add(m);
  return m;
}
function sphere(g: THREE.Group, size: number[], at: number[], color: string) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 12, 8),
    material(color),
  );
  m.scale.set(size[0], size[1], size[2]);
  m.position.set(at[0], at[1], at[2]);
  g.add(m);
  return m;
}
function plate(
  g: THREE.Group,
  points: number[][],
  depth: number,
  color: string,
) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  });
  geometry.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(geometry, material(color));
  g.add(m);
  return m;
}
function figure(g: THREE.Group, statue = false) {
  const color = statue ? stone : linen;
  box(g, [0.5, 0.42, 0.3], [0, 0.02, 0], color);
  sphere(g, [0.32, 0.32, 0.3], [0, 0.4, 0], statue ? stone : "#b6814a");
  box(g, [0.38, 0.08, 0.34], [0, 0.52, 0], blue);
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.15, -0.18, 0);
    box(leg, [0.18, 0.32, 0.23], [0, -0.16, 0], color);
    leg.userData.stride = side;
    g.add(leg);
    box(g, [0.12, 0.38, 0.16], [side * 0.32, -0.03, 0], color);
  }
  box(g, [0.24, 0.035, 0.025], [0, 0.04, 0.164], gold);
}
function gateway(g: THREE.Group) {
  for (const side of [-1, 1]) {
    box(g, [0.3, 0.9, 0.8], [side * 0.35, -0.05, 0]);
    box(g, [0.32, 0.06, 0.84], [side * 0.35, 0.43, 0], blue);
    box(g, [0.08, 0.4, 0.018], [side * 0.35, 0.04, 0.408], gold);
  }
  box(g, [0.42, 0.14, 0.65], [0, 0.38, 0]);
}
function god(g: THREE.Group, kind: "anubis" | "horus" | "sobek") {
  const skin =
    kind === "anubis" ? "#303441" : kind === "horus" ? "#b99052" : "#547c68";
  const body = egyptianReliefVisual();
  for (const child of [...body.children]) {
    if (!(child instanceof THREE.Mesh)) continue;
    child.geometry.computeBoundingBox();
    if (child.geometry.boundingBox!.min.y > 0.3) {
      body.remove(child);
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    } else if (
      (child.material as THREE.MeshStandardMaterial).color.getHexString() ===
      "b67b3e"
    ) {
      (child.material as THREE.MeshStandardMaterial).color.set(skin);
    }
  }
  for (const child of body.children) {
    if (
      !(child instanceof THREE.Mesh) ||
      !(child.geometry instanceof THREE.ExtrudeGeometry)
    )
      continue;
    if (child.geometry.parameters.options.depth !== 0.002) continue;
    const box = child.geometry.boundingBox!;
    // Giant-scale painted folds need separation from the cloth to avoid depth fighting.
    child.position.x += Math.sign(box.min.x + box.max.x) * 0.008;
  }
  body.children.slice(1, 3).forEach((leg, i) => {
    leg.userData.stride = i ? 1 : -1;
  });
  body.rotation.y = -Math.PI / 2;
  g.add(body);
  const profile = (points: number[][], color: string, depth = 0.05) =>
    plate(
      g,
      points.map(([forward, y]) => [-forward, y]),
      depth,
      color,
    );
  profile(
    [
      [-0.13, 0.34],
      [0.08, 0.34],
      [0.12, 0.26],
      [-0.1, 0.24],
    ],
    gold,
    0.054,
  );
  if (kind === "anubis") {
    profile(
      [
        [-0.12, 0.32],
        [-0.14, 0.55],
        [-0.16, 0.83],
        [-0.11, 0.8],
        [-0.05, 0.61],
        [0.02, 0.81],
        [0.07, 0.78],
        [0.06, 0.57],
        [0.18, 0.52],
        [0.4, 0.46],
        [0.4, 0.39],
        [0.16, 0.39],
        [0.08, 0.32],
      ],
      skin,
    );
  } else if (kind === "horus") {
    profile(
      [
        [-0.13, 0.32],
        [-0.16, 0.58],
        [0.03, 0.63],
        [0.14, 0.56],
        [0.14, 0.39],
        [0.07, 0.32],
      ],
      blue,
    );
    profile(
      [
        [0.14, 0.5],
        [0.38, 0.46],
        [0.24, 0.35],
        [0.14, 0.39],
      ],
      gold,
    );
    profile(
      Array.from({ length: 16 }, (_, i) => [
        Math.cos((i * Math.PI) / 8) * 0.075 - 0.03,
        Math.sin((i * Math.PI) / 8) * 0.075 + 0.71,
      ]),
      gold,
      0.04,
    );
  } else {
    profile(
      [
        [-0.11, 0.32],
        [-0.15, 0.54],
        [-0.03, 0.6],
        [0.13, 0.56],
        [0.21, 0.51],
        [0.49, 0.48],
        [0.49, 0.38],
        [0.18, 0.38],
        [0.08, 0.32],
      ],
      skin,
    );
  }
  for (const side of [-1, 1]) {
    const eye = profile(
      [
        [0.025, 0.54],
        [0.12, 0.515],
        [0.115, 0.49],
        [0.035, 0.51],
      ],
      kind === "anubis" ? gold : ink,
      0.002,
    );
    eye.position.z = side * 0.036;
    if (kind === "sobek") {
      const jaw = profile(
        [
          [0.2, 0.43],
          [0.46, 0.43],
          [0.46, 0.413],
          [0.2, 0.413],
        ],
        linen,
        0.002,
      );
      jaw.position.z = side * 0.036;
    }
  }
}
export function egyptVisual(kind: EgyptKind) {
  const g = new THREE.Group();
  switch (kind) {
    case "anubis":
    case "horus":
    case "sobek":
      god(g, kind);
      break;
    case "muralPerson": {
      const person = egyptianReliefVisual();
      person.children.slice(1, 3).forEach((leg, i) => {
        leg.userData.stride = i ? 1 : -1;
      });
      person.rotation.y = -Math.PI / 2;
      g.add(person);
      break;
    }
    case "muralBird": {
      plate(
        g,
        [
          [-0.48, -0.22],
          [-0.2, 0.02],
          [0.08, 0.12],
          [0.2, 0.43],
          [0.38, 0.42],
          [0.48, 0.34],
          [0.34, 0.27],
          [0.3, -0.12],
          [0.03, -0.3],
        ],
        0.05,
        blue,
      );
      box(g, [0.04, 0.18, 0.05], [0.02, -0.38, 0], gold);
      box(g, [0.04, 0.18, 0.05], [0.15, -0.38, 0], gold);
      const wing = plate(
        g,
        [
          [-0.2, 0.02],
          [0.17, 0.07],
          [0.02, -0.2],
        ],
        0.025,
        gold,
      );
      wing.position.z = 0.045;
      wing.userData.stride = 1;
      break;
    }
    case "muralBoat":
      plate(
        g,
        [
          [-0.5, -0.1],
          [-0.32, -0.38],
          [0.32, -0.38],
          [0.5, -0.1],
        ],
        0.07,
        "#936b43",
      );
      box(g, [0.035, 0.8, 0.07], [0, 0, 0], gold);
      plate(
        g,
        [
          [0.03, 0.4],
          [0.4, 0.02],
          [0.03, 0.02],
        ],
        0.025,
        linen,
      );
      break;
    case "seal":
      cylinder(g, 0.48, 0.48, 0.35, [0, -0.22, 0]);
      box(g, [0.6, 0.05, 0.09], [0, -0.02, 0], blue);
      box(g, [0.08, 0.05, 0.55], [0, -0.02, 0], blue);
      break;
    case "scarab":
      sphere(g, [0.7, 0.6, 0.85], [0, 0, 0], blue);
      sphere(g, [0.43, 0.38, 0.35], [0, 0.02, 0.45], gold);
      for (const side of [-1, 1])
        for (const z of [-0.25, 0, 0.25])
          box(g, [0.42, 0.08, 0.06], [side * 0.3, -0.18, z], ink);
      break;
    case "jar":
      cylinder(g, 0.16, 0.3, 0.18, [0, 0.41, 0], blue);
      cylinder(g, 0.28, 0.42, 0.45, [0, 0.095, 0]);
      cylinder(g, 0.42, 0.25, 0.37, [0, -0.315, 0]);
      cylinder(g, 0.29, 0.29, 0.055, [0, 0.31, 0], gold);
      break;
    case "chest":
      box(g, [1, 0.65, 0.75], [0, -0.175, 0], "#967346");
      box(g, [1.02, 0.15, 0.77], [0, 0.225, 0], blue);
      for (const x of [-0.3, 0.3])
        box(g, [0.07, 0.65, 0.015], [x, -0.175, 0.385], gold);
      box(g, [0.13, 0.14, 0.04], [0, 0.12, 0.405], gold);
      break;
    case "offering":
      cylinder(g, 0.5, 0.3, 0.16, [0, -0.25, 0], gold);
      for (const x of [-0.23, 0, 0.23])
        sphere(g, [0.27, 0.33, 0.3], [x, 0, 0], "#ba774e");
      break;
    case "table":
      box(g, [1, 0.16, 0.75], [0, 0.42, 0]);
      for (const x of [-0.37, 0.37])
        for (const z of [-0.23, 0.23])
          box(g, [0.13, 0.84, 0.13], [x, -0.08, z]);
      break;
    case "sarcophagus":
      box(g, [1, 0.36, 0.56], [0, -0.32, 0]);
      box(g, [0.96, 0.15, 0.59], [0, -0.065, 0], blue);
      sphere(g, [0.75, 0.3, 0.42], [0.07, 0.1, 0], gold);
      sphere(g, [0.27, 0.28, 0.36], [-0.32, 0.16, 0], gold);
      for (const x of [-0.22, -0.08, 0.06, 0.2, 0.34])
        box(g, [0.035, 0.03, 0.36], [x, 0.235, 0], blue);
      break;
    case "statue":
      figure(g, true);
      box(g, [0.85, 0.15, 0.8], [0, -0.58, 0]);
      break;
    case "priest":
      figure(g);
      break;
    case "column":
      cylinder(g, 0.48, 0.48, 0.08, [0, -0.46, 0]);
      cylinder(g, 0.26, 0.29, 0.76, [0, -0.04, 0]);
      cylinder(g, 0.5, 0.26, 0.16, [0, 0.42, 0], blue);
      cylinder(g, 0.29, 0.29, 0.04, [0, 0.25, 0], gold);
      break;
    case "obelisk": {
      box(g, [0.72, 0.12, 0.72], [0, -0.44, 0]);
      box(g, [0.4, 0.72, 0.4], [0, -0.02, 0]);
      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(Math.SQRT1_2 * 0.4, 0.16, 4).rotateY(
          Math.PI / 4,
        ),
        material(gold),
      );
      cap.position.y = 0.42;
      g.add(cap);
      box(g, [0.06, 0.4, 0.016], [0, -0.01, 0.208], blue);
      break;
    }
    case "gateway":
      gateway(g);
      break;
    case "shrine":
    case "temple":
      box(g, [1, 0.1, 1], [0, -0.45, 0]);
      box(g, [1, 0.15, 1], [0, 0.425, 0]);
      for (const x of [-0.38, 0.38])
        for (const z of [-0.35, 0.35]) cylinder(g, 0.095, 0.11, 0.8, [x, 0, z]);
      box(g, [0.7, 0.65, 0.14], [0, -0.075, -0.38]);
      box(g, [0.86, 0.07, 0.96], [0, 0.315, 0], blue);
      break;
    case "sphinx":
      box(g, [0.82, 0.26, 0.48], [0, -0.25, 0]);
      sphere(g, [0.56, 0.5, 0.48], [0.06, 0.02, 0], stone);
      for (const z of [-0.18, 0.18])
        box(g, [0.48, 0.14, 0.17], [-0.25, -0.4, z]);
      box(g, [0.3, 0.38, 0.37], [-0.24, 0.3, 0], blue);
      sphere(g, [0.23, 0.28, 0.34], [-0.32, 0.3, 0], gold);
      break;
    case "house":
      box(g, [1, 0.8, 0.9], [0, -0.1, 0]);
      box(g, [1.02, 0.12, 0.92], [0, 0.36, 0]);
      box(g, [0.24, 0.55, 0.012], [0.18, -0.225, 0.456], "#775c3f");
      for (const x of [-0.3, 0.3])
        box(g, [0.18, 0.18, 0.015], [x, 0.06, 0.458], blue);
      break;
    case "stall":
      box(g, [0.85, 0.32, 0.5], [0, -0.32, 0], "#a77a4d");
      for (const x of [-0.42, 0.42])
        for (const z of [-0.3, 0.3])
          box(g, [0.06, 1, 0.06], [x, 0, z], "#8b6a43");
      box(g, [1, 0.06, 0.85], [0, 0.47, 0], "#af6352");
      for (const x of [-0.25, 0, 0.25])
        sphere(g, [0.2, 0.23, 0.22], [x, -0.05, 0], gold);
      break;
    case "palm":
      cylinder(g, 0.045, 0.075, 0.9, [0, -0.05, 0], "#98744b");
      for (let i = 0; i < 6; i++) {
        const arm = new THREE.Group();
        arm.position.y = 0.4;
        arm.rotation.y = (i * Math.PI) / 3;
        const leaf = box(arm, [0.12, 0.07, 0.48], [0, 0, 0.2], "#668256");
        leaf.rotation.x = -0.22;
        g.add(arm);
      }
      break;
    case "camel":
      g.add(objectVisual("camel", "egypt"));
      break;
    case "pyramid": {
      const p = new THREE.Mesh(
        new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4),
        material(stone),
      );
      g.add(p);
      break;
    }
  }
  // Fit the real assembled vertices once, including limbs and decorative protrusions.
  g.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(g);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const fitted = new THREE.Group();
  fitted.scale.set(1 / size.x, 1 / size.y, 1 / size.z);
  fitted.position.copy(center).multiply(fitted.scale).negate();
  fitted.add(g);
  const result = new THREE.Group();
  result.add(fitted);
  return result;
}
