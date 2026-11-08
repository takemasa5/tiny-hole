import * as THREE from "three";
import { HELL_SPACES } from "./hell-world";
export function hellFloorTextures() {
  return HELL_SPACES.map((space, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = index === 0 ? 1024 : 512;
    const c = canvas.getContext("2d");
    if (!c) throw new Error("地獄の床模様を描けません");
    const n = canvas.width;
    c.fillStyle = space.floor;
    c.fillRect(0, 0, n, n);
    c.strokeStyle =
      index === 0 ? "#8f9794" : index === 3 ? "#b8755d" : "#554e65";
    c.lineWidth = n / 180;
    for (let i = 0; i < 18; i++) {
      const y = ((i + 0.5) * n) / 18;
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(n * 0.22, y + n * 0.025);
      c.lineTo(n * 0.45, y - n * 0.015);
      c.lineTo(n * 0.7, y + n * 0.02);
      c.lineTo(n, y);
      c.stroke();
    }
    if (index === 0) {
      c.fillStyle = "#71969b";
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(n * 0.2, 0);
      c.bezierCurveTo(n * 0.4, n * 0.25, n * 0.03, n * 0.65, n * 0.27, n);
      c.lineTo(0, n);
      c.closePath();
      c.fill();
      c.strokeStyle = "#b5d2d0";
      c.lineWidth = 8;
      for (let i = 0; i < 6; i++) {
        c.beginPath();
        c.moveTo(n * 0.05, (n * (i + 0.5)) / 6);
        c.lineTo(n * 0.15, (n * (i + 0.5)) / 6 + n * 0.015);
        c.stroke();
      }
      c.fillStyle = "#d4c7aa";
      for (let i = 0; i < 70; i++) {
        const x = (((i * 137) % 900) / 1000) * n,
          y = (((i * 263) % 940) / 1000) * n;
        c.beginPath();
        c.ellipse(x, y, n * 0.012, n * 0.006, i, 0, Math.PI * 2);
        c.fill();
      }
    } else {
      c.strokeStyle =
        index === 3 ? "#d37b55" : index === 4 ? "#778db1" : "#b38b80";
      c.lineWidth = n * 0.035;
      c.strokeRect(n * 0.11, n * 0.11, n * 0.78, n * 0.78);
      c.strokeStyle = "#c4a28b";
      c.lineWidth = n * 0.003;
      c.strokeRect(n * 0.08, n * 0.08, n * 0.84, n * 0.84);
      if (index >= 3) {
        c.fillStyle = index === 3 ? "#b8584f" : "#4b455e";
        for (let i = 0; i < 6; i++) {
          c.beginPath();
          c.ellipse(
            n * (0.15 + i * 0.14),
            n * 0.06,
            n * 0.045,
            n * 0.018,
            0,
            0,
            Math.PI * 2,
          );
          c.fill();
        }
      }
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}
