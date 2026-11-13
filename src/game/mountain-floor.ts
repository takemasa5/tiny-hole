import * as THREE from "three";
import { MOUNTAIN_SPACES, MOUNTAIN_ROUTES } from "./mountain-world";
export function mountainFloorTextures() {
  return MOUNTAIN_SPACES.map((space, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = index === 0 ? 1024 : 512;
    const c = canvas.getContext("2d");
    if (!c) throw new Error("森の床模様を描けません");
    const n = canvas.width,
      b = space.bounds,
      w = b.maxX - b.minX,
      h = b.maxZ - b.minZ;
    const x = (v: number) => ((v - b.minX) / w) * n,
      z = (v: number) => ((b.maxZ - v) / h) * n;
    c.fillStyle = space.floor;
    c.fillRect(0, 0, n, n);
    for (let i = 0; i < 100; i++) {
      c.fillStyle = i % 3 ? "#889366" : "#b4b181";
      c.beginPath();
      c.ellipse(
        (i * 137) % n,
        (i * 263) % n,
        index ? 10 : 4,
        index ? 7 : 2,
        i * 0.2,
        0,
        Math.PI * 2,
      );
      c.fill();
    }
    if (index === 0) {
      c.strokeStyle = "#7b6549";
      c.lineWidth = 14;
      for (let i = 0; i < 6; i++) {
        c.beginPath();
        c.moveTo(0, (n * (i + 0.5)) / 6);
        c.bezierCurveTo(
          n * 0.15,
          (n * (i + 0.2)) / 6,
          n * 0.3,
          (n * (i + 0.7)) / 6,
          n * 0.42,
          (n * (i + 0.5)) / 6,
        );
        c.stroke();
      }
      c.fillStyle = "#c1a775";
      for (let i = 0; i < 70; i++)
        c.fillRect((i * 197) % n, (i * 109) % n, 5, 3);
    } else if (index === 1) {
      c.fillStyle = "#c6b187";
      c.beginPath();
      c.ellipse(x(11), z(0), n * 0.28, n * 0.4, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#a18c67";
      c.lineWidth = 3;
      c.strokeRect(x(7), z(10), x(19) - x(7), z(-10) - z(10));
    } else if (index === 2) {
      c.fillStyle = "#c0ab80";
      c.fillRect(x(45), z(55), x(114) - x(45), z(-55) - z(55));
      c.strokeStyle = "#9b8b68";
      c.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        c.beginPath();
        c.moveTo(x(48), z(50 - i * 9));
        c.lineTo(x(112), z(50 - i * 9));
        c.stroke();
      }
    } else {
      c.strokeStyle = "#b4bd8a";
      c.lineWidth = n * 0.025;
      c.beginPath();
      c.moveTo(n * 0.05, n * 0.6);
      c.bezierCurveTo(n * 0.3, n * 0.25, n * 0.6, n * 0.8, n * 0.95, n * 0.4);
      c.stroke();
      if (index === 4) {
        c.fillStyle = "#c4c49c";
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
        c.strokeStyle = "#7ca7a1";
        c.lineWidth = n * 0.014;
        c.beginPath();
        c.moveTo(0, n * 0.8);
        c.bezierCurveTo(n * 0.3, n * 0.52, n * 0.5, n * 0.9, n, n * 0.65);
        c.stroke();
      }
    }
    for (const route of MOUNTAIN_ROUTES.filter((r) => r.area === index)) {
      c.strokeStyle = route.kind === "truck" ? "#c8b58f" : "#c0bf91";
      c.lineWidth = ((route.kind === "truck" ? 12 : 1.2) / w) * n;
      c.lineJoin = "round";
      c.lineCap = "round";
      c.beginPath();
      route.points.forEach(([px, pz], i) =>
        i ? c.lineTo(x(px), z(pz)) : c.moveTo(x(px), z(pz)),
      );
      if (route.points.length > 2) c.closePath();
      c.stroke();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}
