import * as THREE from "three";
import { PLAZA_SPACES, PLAZA_CITY_STREETS, PLAZA_ROUTES } from "./plaza-world";
export function plazaFloorTextures() {
  return PLAZA_SPACES.map((space, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = index === 0 ? 1024 : 512;
    const c = canvas.getContext("2d");
    if (!c) throw new Error("広場の床模様を描けません");
    const n = canvas.width,
      b = space.bounds,
      w = b.maxX - b.minX,
      h = b.maxZ - b.minZ;
    const x = (v: number) => ((v - b.minX) / w) * n,
      z = (v: number) => ((b.maxZ - v) / h) * n;
    c.fillStyle = space.floor;
    c.fillRect(0, 0, n, n);
    if (index === 0) {
      c.fillStyle = "#c7ae81";
      for (let i = 0; i < 250; i++) {
        c.beginPath();
        c.ellipse(
          (i * 137) % n,
          (i * 263) % n,
          2 + (i % 4),
          2,
          0,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
      c.strokeStyle = "#9d805e";
      c.lineWidth = 4;
      for (let i = 0; i < 12; i++) {
        c.beginPath();
        c.moveTo((i * 79) % n, (i * 173) % n);
        c.lineTo(((i * 79) % n) + 60, ((i * 173) % n) + 35);
        c.stroke();
      }
    } else if (index === 1) {
      c.fillStyle = "#b4bf86";
      c.fillRect(n * 0.03, n * 0.04, n * 0.94, n * 0.92);
      c.fillStyle = "#d4ad7b";
      c.fillRect(x(6), z(11), x(19) - x(6), z(-11) - z(11));
    } else if (index === 2) {
      c.fillStyle = "#88a679";
      for (let i = 0; i < 80; i++) {
        c.beginPath();
        c.arc((i * 139) % n, (i * 251) % n, 9, 0, Math.PI * 2);
        c.fill();
      }
      c.strokeStyle = "#ded0ae";
      c.lineWidth = n * 0.06;
      c.strokeRect(n * 0.08, n * 0.1, n * 0.84, n * 0.8);
      c.fillStyle = "#ded0ae";
      c.fillRect(x(20), z(7), x(120) - x(20), z(-7) - z(7));
      c.fillStyle = "#a8c5c4";
      c.beginPath();
      c.ellipse(x(77), z(0), n * 0.055, n * 0.055, 0, 0, Math.PI * 2);
      c.fill();
    } else {
      c.strokeStyle = index === 3 ? "#af9d84" : "#96ac87";
      c.lineWidth = 2;
      for (let i = 0; i < 32; i++) {
        c.beginPath();
        c.moveTo(0, (i * n) / 32);
        c.lineTo(n, (i * n) / 32);
        c.stroke();
      }
      if (index === 4) {
        c.fillStyle = "#788b8e";
        for (const street of PLAZA_CITY_STREETS) {
          c.fillRect(x(street - 14), 0, (28 / w) * n, n);
          c.fillRect(0, z(street + 14), n, (28 / h) * n);
        }
        c.fillStyle = "#d4c9ad";
        c.beginPath();
        c.ellipse(
          x(600),
          z(0),
          (210 / w) * n,
          (210 / h) * n,
          0,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    }
    for (const route of PLAZA_ROUTES.filter((r) => r.area === index)) {
      c.strokeStyle = route.kind === "van" ? "#859193" : "#e2d4b4";
      c.lineWidth = ((route.kind === "van" ? 9 : 1.6) / w) * n;
      c.lineJoin = "round";
      c.beginPath();
      route.points.forEach(([px, pz], i) =>
        i ? c.lineTo(x(px), z(pz)) : c.moveTo(x(px), z(pz)),
      );
      c.closePath();
      c.stroke();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}
