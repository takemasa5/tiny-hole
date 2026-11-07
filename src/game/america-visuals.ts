import * as THREE from "three";
import { type SupplySite, type ObjectKind } from "./stage";
import { supplyMouth } from "./object-supply";

function box(
  group: THREE.Group,
  size: [number, number, number],
  color: string,
  position: [number, number, number],
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
  );
  mesh.position.set(...position);
  group.add(mesh);
}

export function americaObjectVisual(kind: ObjectKind): THREE.Group | undefined {
  const group = new THREE.Group();
  if (kind === "car") {
    box(group, [2.6, 0.42, 1.35], "#e98059", [0, -0.08, 0]);
    box(group, [1.3, 0.46, 1.15], "#e98059", [-0.15, 0.32, 0]);
    for (const side of [-1, 1]) {
      box(group, [1.05, 0.28, 0.025], "#abcad5", [-0.15, 0.34, side * 0.58]);
      for (const end of [-1, 1])
        box(group, [0.42, 0.4, 0.18], "#343940", [
          end * 0.82,
          -0.35,
          side * 0.57,
        ]);
      box(group, [0.025, 0.18, 0.26], "#fff0b1", [1.295, -0.03, side * 0.4]);
    }
  } else if (kind === "streetSweeper") {
    box(group, [2.8, 0.55, 2.3], "#535a5d", [0, -0.35, -0.15]);
    box(group, [2.4, 0.7, 1.4], "#e7b64c", [0, 0.2, -0.45]);
    box(group, [1.7, 0.55, 1.2], "#f1d58a", [0, 0.625, -0.25]);
    box(group, [1.5, 0.35, 0.04], "#304853", [0, 0.62, 0.37]);
    box(group, [3.2, 0.65, 0.35], "#ed9145", [0, -0.4, 1.225]);
    for (const side of [-1, 1]) {
      box(group, [0.23, 0.15, 0.05], "#fff0b1", [
        side * 0.8,
        -0.05,
        1.405 - 0.04,
      ]);
      for (const end of [-1, 1])
        box(group, [0.3, 0.5, 0.55], "#343940", [
          side * 1.35,
          -0.65,
          end * 0.75,
        ]);
    }
  } else return undefined;
  return group;
}

export function supplySiteVisual(site: SupplySite): THREE.Group {
  if (site.scale !== 1) {
    const mesh = supplySiteVisual({
      ...site,
      scale: 1,
      x: 0,
      z: 0,
      width: site.width / site.scale,
      height: site.height / site.scale,
      depth: site.depth / site.scale,
    });
    mesh.scale.setScalar(site.scale);
    mesh.position.set(site.x, 0, site.z);
    return mesh;
  }
  const group = new THREE.Group();
  group.name = `supply-${site.id}`;
  group.position.set(site.x, 0, site.z);
  box(
    group,
    [site.width, site.height - 0.35, site.depth],
    site.profile === "stationery"
      ? "#88b5d4"
      : site.id === "food"
        ? "#57a995"
        : "#8a9da9",
    [0, site.height / 2 - 0.15, 0],
  );
  box(
    group,
    [site.width + 0.2, 0.25, site.depth + 0.2],
    site.profile === "stationery" ? "#d0e7ee" : "#f0d27b",
    [0, site.height - 0.125, 0],
  );
  box(group, [site.width * 0.6, site.height * 0.45, 0.08], "#324d58", [
    0,
    site.height * 0.5,
    site.depth / 2 + 0.05,
  ]);
  const mouth = supplyMouth(site);
  const chimney = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.85, 2.2, 16),
    new THREE.MeshStandardMaterial({ color: "#b36e54", roughness: 0.9 }),
  );
  chimney.position.set(mouth.x - site.x, site.height + 1.1, 0);
  group.add(chimney);
  const lip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 0.18, 16),
    new THREE.MeshStandardMaterial({ color: "#555f68" }),
  );
  lip.position.set(mouth.x - site.x, mouth.y - 0.09, 0);
  group.add(lip);
  const opening = new THREE.Mesh(
    new THREE.CircleGeometry(0.72, 16),
    new THREE.MeshBasicMaterial({ color: "#202b35" }),
  );
  opening.rotation.x = -Math.PI / 2;
  opening.name = "supply-mouth";
  opening.position.set(mouth.x - site.x, mouth.y + 0.005, 0);
  group.add(opening);
  for (const side of [-1, 1]) {
    box(group, [0.65, 0.5, 0.06], "#acd4d5", [
      side * site.width * 0.3,
      site.height * 0.7,
      site.depth / 2 + 0.1,
    ]);
  }
  return group;
}
