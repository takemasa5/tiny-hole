import * as THREE from "three";
import {
  districtSpaces,
  DISTRICT_STREETS,
  type DistrictProfile,
} from "./district-world";
export function districtFloorTextures(profile: DistrictProfile) {
  return districtSpaces(profile).map((space, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = index === 0 ? 1024 : 512;
    const c = canvas.getContext("2d");
    if (!c) throw new Error("テーマの床を描けません");
    const n = canvas.width,
      b = space.bounds,
      w = b.maxX - b.minX,
      h = b.maxZ - b.minZ,
      x = (v: number) => ((v - b.minX) / w) * n,
      z = (v: number) => ((b.maxZ - v) / h) * n;
    c.fillStyle = space.floor;
    c.fillRect(0, 0, n, n);
    if (index === 0) {
      if (profile.stageId === "america")
        for (let y = 0; y < 16; y++)
          for (let xx = 0; xx < 16; xx++) {
            c.fillStyle = (xx + y) % 2 ? "#ce8b7a" : "#e9cba4";
            c.fillRect((xx * n) / 16, (y * n) / 16, n / 16, n / 16);
          }
      else {
        c.strokeStyle = profile.stageId === "harbor" ? "#788e9a" : "#b4b8ac";
        c.lineWidth = 5;
        for (let i = 0; i < 8; i++)
          c.strokeRect(n * 0.04, (n * (i + 0.2)) / 8, n * 0.92, n * 0.05);
      }
    } else if (index === 1) {
      if (profile.stageId === "america")
        for (let y = 0; y < 24; y++)
          for (let xx = 0; xx < 28; xx++) {
            c.fillStyle = (xx + y) % 2 ? "#9faaa6" : "#eee3c9";
            c.fillRect((xx * n) / 28, (y * n) / 24, n / 28, n / 24);
          }
      else {
        c.strokeStyle = "#a1a89d";
        c.lineWidth = 2;
        for (let i = 0; i < 24; i++) {
          c.beginPath();
          c.moveTo(0, (i * n) / 24);
          c.lineTo(n, (i * n) / 24);
          c.stroke();
        }
      }
    } else if (index === 2 || index === 3) {
      c.strokeStyle =
        profile.stageId === "office" && index === 2 ? "#a7b0ab" : "#e7d9aa";
      c.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        c.beginPath();
        c.moveTo(n * 0.05, (i * n) / 14);
        c.lineTo(n * 0.22, (i * n) / 14);
        c.stroke();
      }
      if (profile.stageId === "office" && index === 2) {
        c.fillStyle = "#d8c9ab";
        c.fillRect(x(25), z(-30), x(115) - x(25), z(-65) - z(-30));
      }
    } else {
      c.fillStyle = "#7d9097";
      for (const street of DISTRICT_STREETS) {
        c.fillRect(x(street - 14), 0, (28 / w) * n, n);
        c.fillRect(0, z(street + 14), n, (28 / h) * n);
      }
      c.fillStyle = profile.stageId === "harbor" ? "#bec5b8" : "#d8d3bd";
      c.beginPath();
      c.ellipse(x(600), z(0), (210 / w) * n, (210 / h) * n, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#7ba8b4";
      for (const water of profile.water)
        c.fillRect(
          x(water.minX),
          z(water.maxZ),
          ((water.maxX - water.minX) / w) * n,
          ((water.maxZ - water.minZ) / h) * n,
        );
      if (profile.stageId !== "office") {
        c.fillStyle = "#7ba8b4";
        c.fillRect(x(1445), 0, n - x(1445), n);
      }
    }
    for (const route of profile.routes.filter((r) => r.area === index)) {
      c.strokeStyle = route.driving ? "#7a898e" : "#ded5bb";
      c.lineWidth = ((route.driving ? 12 : 1.4) / w) * n;
      c.beginPath();
      route.points.forEach(([px, pz], i) =>
        i ? c.lineTo(x(px), z(pz)) : c.moveTo(x(px), z(pz)),
      );
      if (route.points.length > 2) c.closePath();
      c.stroke();
      if (route.queue) {
        c.strokeStyle = "#f1dfb4";
        c.lineWidth = 2;
        c.setLineDash([8, 8]);
        c.stroke();
        c.setLineDash([]);
      }
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  });
}
