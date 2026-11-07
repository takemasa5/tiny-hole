import * as THREE from "three";
export type FurnitureKind =
  | "bed"
  | "desk"
  | "chair"
  | "sofa"
  | "table"
  | "fridge"
  | "counter"
  | "shoeRack"
  | "wardrobe"
  | "bookStack"
  | "mug"
  | "cushion"
  | "floorLamp"
  | "streetLamp"
  | "bin"
  | "vendingMachine"
  | "home";
export function furnitureVisual(kind: string): THREE.Group | undefined {
  const group = new THREE.Group();
  const box = (
    size: [number, number, number],
    at: [number, number, number],
    color: string,
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      new THREE.MeshStandardMaterial({ color, roughness: 0.82 }),
    );
    mesh.position.set(...at);
    group.add(mesh);
    return mesh;
  };
  const cylinder = (
    radius: number,
    height: number,
    at: [number, number, number],
    color: string,
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 12),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
    );
    mesh.position.set(...at);
    group.add(mesh);
    return mesh;
  };
  const legs = (height: number, top: number, color: string) => {
    for (const x of [-0.42, 0.42])
      for (const z of [-0.42, 0.42])
        box([0.1, height, 0.1], [x, top - height / 2, z], color);
  };
  switch (kind) {
    case "bed":
      box([1, 0.24, 1], [0, -0.18, 0], "#6892b5");
      box([0.94, 0.25, 0.94], [0, 0.065, 0], "#f0e5ce");
      box([0.95, 0.08, 0.65], [0, 0.23, 0.145], "#6f9dcc");
      box([1, 0.7, 0.08], [0, 0.15, -0.46], "#7fabc8");
      box([0.6, 0.13, 0.2], [0, 0.24, -0.3], "#f5eaca");
      legs(0.22, -0.28, "#54788f");
      for (const x of [-0.28, 0, 0.28])
        for (const z of [-0.02, 0.22, 0.4])
          box([0.07, 0.012, 0.07], [x, 0.276, z], "#f5d987");
      break;
    case "desk":
      box([1, 0.12, 1], [0, 0.44, 0], "#e6bc57");
      legs(0.88, 0.38, "#d2a04a");
      box([0.28, 0.5, 0.8], [0.3, 0.13, 0], "#d7ad52");
      for (const y of [-0.02, 0.15, 0.32])
        box([0.12, 0.02, 0.014], [0.3, y, 0.412], "#997542");
      break;
    case "chair":
      box([1, 0.12, 0.95], [0, -0.08, 0], "#dca954");
      legs(0.36, -0.14, "#bc8e4d");
      box([0.92, 0.52, 0.1], [0, 0.24, -0.42], "#e9bb66");
      break;
    case "sofa":
      box([1, 0.35, 0.92], [0, -0.28, 0], "#90aa89");
      box([1, 0.68, 0.2], [0, 0.16, -0.36], "#a8bc98");
      for (const x of [-0.43, 0.43])
        box([0.14, 0.5, 0.9], [x, 0, 0], "#a4b891");
      for (const x of [-0.23, 0.23])
        box([0.38, 0.14, 0.6], [x, -0.03, 0.08], "#becbaa");
      break;
    case "table":
      box([1, 0.15, 1], [0, 0.425, 0], "#ba8956");
      legs(0.85, 0.35, "#9e704a");
      break;
    case "fridge":
      box([1, 1, 0.94], [0, 0, -0.03], "#d8dfdc");
      box([0.96, 0.32, 0.05], [0, 0.33, 0.465], "#edf0e5");
      box([0.96, 0.64, 0.05], [0, -0.17, 0.465], "#edf0e5");
      for (const y of [-0.04, 0.32])
        box([0.045, 0.2, 0.025], [-0.34, y, 0.5 - 0.0125], "#7f939b");
      break;
    case "counter":
      box([1, 0.9, 0.95], [0, -0.05, 0], "#b99972");
      box([1, 0.1, 1], [0, 0.45, 0], "#e9dfc5");
      for (const x of [-0.3, 0.3])
        box([0.06, 0.03, 0.015], [x, 0.2, 0.483], "#6d7d85");
      break;
    case "shoeRack":
    case "wardrobe":
      box(
        [1, 1, 0.95],
        [0, 0, -0.025],
        kind === "wardrobe" ? "#d7b27c" : "#bc9669",
      );
      for (const x of [-0.08, 0.08])
        box([0.035, 0.18, 0.02], [x, 0, 0.485], "#896b4b");
      break;
    case "bookStack":
      for (let index = 0; index < 4; index++)
        box(
          [index % 2 ? 0.9 : 1, 0.25, 0.9],
          [0, -0.375 + index * 0.25, 0],
          ["#c17d6f", "#7193ac", "#b1b184", "#dec385"][index],
        );
      break;
    case "cushion": {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 12, 8),
        new THREE.MeshStandardMaterial({ color: "#e1b98f", roughness: 1 }),
      );
      group.add(mesh);
      break;
    }
    case "mug":
      cylinder(0.38, 1, [-0.08, 0, 0], "#e8cf9b");
      box([0.18, 0.12, 0.18], [0.39, 0.25, 0], "#dfbb7b");
      box([0.18, 0.12, 0.18], [0.39, -0.25, 0], "#dfbb7b");
      box([0.1, 0.6, 0.18], [0.45, 0, 0], "#dfbb7b");
      break;
    case "floorLamp":
    case "streetLamp":
      cylinder(0.45, 0.08, [0, -0.46, 0], "#697d87");
      cylinder(0.04, 0.8, [0, -0.02, 0], "#89999c");
      cylinder(
        kind === "streetLamp" ? 0.3 : 0.46,
        0.18,
        [0, 0.4, 0],
        kind === "streetLamp" ? "#bac7c7" : "#e8cc8c",
      );
      break;
    case "bin":
      cylinder(0.42, 0.85, [0, -0.075, 0], "#729a8d");
      cylinder(0.48, 0.12, [0, 0.41, 0], "#9bb8a4");
      break;
    case "vendingMachine":
      box([1, 1, 1], [0, 0, 0], "#a8bac5");
      box([0.65, 0.5, 0.015], [-0.04, 0.17, 0.49], "#344e66");
      box([0.6, 0.12, 0.015], [-0.04, -0.3, 0.49], "#657f8d");
      break;
    case "home": {
      box([1, 0.75, 0.95], [0, -0.125, 0], "#dfcfaa");
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.SQRT1_2, 0.25, 4).rotateY(Math.PI / 4),
        new THREE.MeshStandardMaterial({ color: "#c68170", roughness: 0.8 }),
      );
      roof.position.y = 0.375;
      group.add(roof);
      box([0.2, 0.45, 0.014], [0, -0.25, 0.485], "#9d7757");
      for (const x of [-0.3, 0.3])
        box([0.2, 0.22, 0.014], [x, 0.02, 0.485], "#82a7ba");
      break;
    }
    default:
      return undefined;
  }
  return group;
}
