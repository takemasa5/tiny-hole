import * as THREE from "three";

type Point = [number, number];

// The painted figure lies in the YZ plane, faces +Z, and has a real thin edge along X.
function plate(
  group: THREE.Group,
  points: Point[],
  color: string,
  depth = 0.04,
  centerX = 0,
) {
  const shape = new THREE.Shape();
  points.forEach(([forward, height], index) => {
    if (index === 0) shape.moveTo(forward, height);
    else shape.lineTo(forward, height);
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  });
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(centerX + depth / 2, 0, 0);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 1 }),
  );
  group.add(mesh);
  return mesh;
}

export function egyptianReliefVisual() {
  const group = new THREE.Group();
  const skin = "#b67b3e",
    ink = "#332b22",
    linen = "#f4e8c6";
  plate(
    group,
    [
      [-0.12, 0.32],
      [0.08, 0.32],
      [0.1, 0.02],
      [-0.11, -0.03],
    ],
    skin,
  ).name = "torso";
  plate(
    group,
    [
      [-0.1, 0.05],
      [-0.11, -0.2],
      [-0.21, -0.59],
      [-0.21, -0.645],
      [-0.1, -0.645],
      [-0.1, -0.62],
      [-0.16, -0.6],
      [-0.04, -0.25],
      [0.01, -0.04],
    ],
    skin,
  );
  plate(
    group,
    [
      [0.01, 0.01],
      [0.07, -0.24],
      [0.15, -0.6],
      [0.13, -0.64],
      [0.225, -0.64],
      [0.225, -0.61],
      [0.19, -0.59],
      [0.12, -0.19],
      [0.08, 0.04],
    ],
    skin,
  );
  plate(
    group,
    [
      [-0.11, 0.28],
      [-0.18, 0.12],
      [-0.205, -0.09],
      [-0.17, -0.13],
      [-0.145, -0.1],
      [-0.16, 0.1],
      [-0.055, 0.25],
    ],
    skin,
  );
  plate(
    group,
    [
      [0.03, 0.29],
      [0.14, 0.13],
      [0.18, 0.15],
      [0.195, 0.29],
      [0.22, 0.29],
      [0.22, 0.11],
      [0.14, 0.07],
      [-0.01, 0.23],
    ],
    skin,
  );
  plate(
    group,
    [
      [-0.13, 0.64],
      [0.04, 0.64],
      [0.12, 0.56],
      [0.1, 0.33],
      [-0.14, 0.32],
    ],
    ink,
    0.05,
  );
  plate(
    group,
    [
      [0.015, 0.57],
      [0.11, 0.55],
      [0.12, 0.51],
      [0.17, 0.48],
      [0.13, 0.46],
      [0.15, 0.43],
      [0.1, 0.41],
      [0.07, 0.33],
      [0.01, 0.32],
    ],
    skin,
    0.052,
  );
  plate(
    group,
    [
      [-0.1, 0.01],
      [0.09, 0.01],
      [0.16, -0.25],
      [-0.17, -0.25],
    ],
    linen,
    0.052,
  );
  for (const side of [-1, 1]) {
    plate(
      group,
      [
        [0.045, 0.517],
        [0.113, 0.512],
        [0.112, 0.495],
        [0.045, 0.499],
      ],
      ink,
      0.002,
      side * 0.028,
    );
    plate(
      group,
      [
        [0.061, 0.511],
        [0.102, 0.508],
        [0.091, 0.503],
        [0.061, 0.506],
      ],
      linen,
      0.002,
      side * 0.029,
    );
    plate(
      group,
      [
        [-0.11, 0.02],
        [0.095, 0.02],
        [0.1, -0.015],
        [-0.115, -0.015],
      ],
      "#b89b53",
      0.002,
      side * 0.028,
    );
    for (const forward of [-0.07, -0.025, 0.02, 0.065]) {
      plate(
        group,
        [
          [forward, -0.015],
          [forward + 0.007, -0.015],
          [forward * 1.7 + 0.007, -0.235],
          [forward * 1.7, -0.235],
        ],
        "#b9a57b",
        0.002,
        side * 0.028,
      );
    }
  }
  return group;
}
