import * as THREE from "three";
import { EGYPT_SPACES } from "./egypt-world";

function bird(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  c.fillStyle = "#355d76";
  c.beginPath();
  c.moveTo(-0.5, 0.2);
  c.lineTo(-0.1, -0.1);
  c.lineTo(0.12, -0.12);
  c.lineTo(0.18, -0.45);
  c.lineTo(0.4, -0.4);
  c.lineTo(0.45, -0.25);
  c.lineTo(0.28, -0.22);
  c.lineTo(0.25, 0.15);
  c.lineTo(-0.12, 0.3);
  c.closePath();
  c.fill();
  c.strokeStyle = "#8d673c";
  c.lineWidth = 0.035;
  c.beginPath();
  c.moveTo(0, 0.2);
  c.lineTo(0, 0.48);
  c.moveTo(0.2, 0.15);
  c.lineTo(0.2, 0.48);
  c.stroke();
  c.restore();
}
function papyrus(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.strokeStyle = "#65805c";
  c.fillStyle = "#65805c";
  c.lineWidth = 3;
  for (let i = -1; i <= 1; i++) {
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + i * s * 0.2, y - s * 0.6);
    c.stroke();
    c.beginPath();
    c.ellipse(
      x + i * s * 0.2,
      y - s * 0.65,
      s * 0.15,
      s * 0.09,
      0,
      Math.PI,
      2 * Math.PI,
    );
    c.fill();
  }
}
export function egyptFloorTextures() {
  return EGYPT_SPACES.map((space, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const c = canvas.getContext("2d");
    if (!c) throw new Error("エジプトの床模様を描けません。");
    c.fillStyle = space.floor;
    c.fillRect(0, 0, 1024, 1024);
    if (index === 0) {
      c.strokeStyle = "#966b42";
      c.lineWidth = 22;
      c.strokeRect(18, 18, 988, 988);
      c.strokeStyle = "#365f76";
      c.lineWidth = 7;
      c.strokeRect(42, 42, 940, 940);
      for (let n = 0; n < 32; n++) {
        c.fillStyle = n % 2 ? "#af684d" : "#cfaa52";
        c.fillRect(52 + n * 28, 58, 20, 14);
        c.fillRect(52 + n * 28, 952, 20, 14);
      }
      for (const y of [300, 680]) {
        c.strokeStyle = "#ad8050";
        c.lineWidth = 6;
        c.beginPath();
        c.moveTo(70, y);
        c.lineTo(954, y);
        c.stroke();
      }
      c.strokeStyle = "#6f9b9c";
      c.lineWidth = 52;
      c.beginPath();
      c.moveTo(65, 800);
      c.bezierCurveTo(320, 740, 620, 865, 960, 790);
      c.stroke();
      for (let i = 0; i < 7; i++) {
        bird(c, 130 + i * 115, 220, 95);
        papyrus(c, 130 + i * 118, 645, 115);
      }
      c.fillStyle = "#c58c4d";
      c.beginPath();
      c.arc(520, 460, 76, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#ad6c42";
      c.lineWidth = 5;
      for (let i = 0; i < 14; i++) {
        const a = (i * Math.PI) / 7;
        c.beginPath();
        c.moveTo(520 + Math.cos(a) * 90, 460 + Math.sin(a) * 90);
        c.lineTo(520 + Math.cos(a) * 130, 460 + Math.sin(a) * 130);
        c.stroke();
      }
    } else if (index < 3) {
      c.strokeStyle = index === 1 ? "#bba272" : "#c4ac80";
      c.lineWidth = 2;
      const steps = index === 1 ? 12 : 24;
      for (let i = 0; i <= steps; i++) {
        const p = (i * 1024) / steps;
        c.beginPath();
        c.moveTo(p, 0);
        c.lineTo(p, 1024);
        c.moveTo(0, p);
        c.lineTo(1024, p);
        c.stroke();
      }
      c.strokeStyle = "#a27c4b";
      c.lineWidth = 14;
      c.strokeRect(12, 12, 1000, 1000);
      c.strokeStyle = "#496b7c";
      c.lineWidth = 6;
      c.strokeRect(30, 30, 964, 964);
      for (let i = 0; i < 12; i++) bird(c, 60 + i * 80, 72, 45);
    } else {
      c.strokeStyle = "#cfb17d";
      c.lineWidth = 2;
      for (let i = 0; i < 32; i++) {
        const p = i * 32;
        c.beginPath();
        c.moveTo(p, 0);
        c.lineTo(p, 1024);
        c.moveTo(0, p);
        c.lineTo(1024, p);
        c.stroke();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.name = `egypt-${space.id}-paint`;
    return texture;
  });
}
