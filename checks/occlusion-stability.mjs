import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { format } from "prettier";
const directory =
  process.env.HOLE_REPORT_DIR || "reports/occlusion-stability-2026-11-06/final";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const results = {
  browser: await browser.version(),
  fixture:
    "実際の透過処理で交差する部品を描く比較用シーン。ゲームやiPhone実機の検証とは別。",
  iPhone: "未実施",
  WebKit: "未実施",
  cases: [],
  errors: [],
};
try {
  for (const [width, height, dpr] of [
    [800, 600, 1],
    [390, 844, 2],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: dpr,
    });
    page.on("pageerror", (e) => results.errors.push(e.message));
    await page.route("**/occlusion-fixture", (r) =>
      r.fulfill({
        contentType: "text/html",
        body: "<!doctype html><style>body{margin:0}</style><canvas></canvas>",
      }),
    );
    await page.goto(
      `${process.env.HOLE_URL || "http://127.0.0.1:5178"}/occlusion-fixture`,
    );
    const result = await page.evaluate(
      async ({ width, height, dpr }) => {
        const text = await (await fetch("/src/game/occlusion.ts")).text();
        const threeUrl = text.match(/from\s+["']([^"']+three[^"']*)["']/)[1];
        const THREE = await import(threeUrl),
          { HoleOcclusion } = await import("/src/game/occlusion.ts");
        const renderer = new THREE.WebGLRenderer({
          canvas: document.querySelector("canvas"),
          antialias: true,
          preserveDrawingBuffer: true,
        });
        renderer.setPixelRatio(dpr);
        renderer.setSize(width, height);
        renderer.setClearColor("#303030");
        const gl = renderer.getContext(),
          samples = gl.getParameter(gl.SAMPLES);
        const scene = new THREE.Scene(),
          camera = new THREE.PerspectiveCamera(44, width / height, 0.01, 100);
        const group = new THREE.Group();
        group.userData.objectId = "intersecting-parts";
        for (const [x, angle, color] of [
          [-0.1, 0.32, "#ff6040"],
          [0.1, -0.32, "#4080ff"],
        ]) {
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(2, 2, 0.15),
            new THREE.MeshBasicMaterial({ color }),
          );
          mesh.position.set(x, 2, 2.5);
          mesh.rotation.y = angle;
          group.add(mesh);
        }
        scene.add(group);
        scene.updateMatrixWorld(true);
        const occlusion = new HoleOcclusion(samples);
        const pixels = [];
        function draw(x) {
          camera.position.set(x, 4, 5);
          camera.lookAt(0, 0, 0);
          camera.updateMatrixWorld();
          occlusion.update(
            camera,
            { x: 0, z: 0, radius: 0.1 },
            [{ object: group, footprint: 2 }],
            0.3,
          );
          renderer.render(scene, camera);
          const data = new Uint8Array(80 * 80 * 4);
          gl.readPixels(
            Math.floor((width * dpr) / 2 + 30 * dpr),
            Math.floor((height * dpr) / 2 - 40 * dpr),
            80,
            80,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            data,
          );
          pixels.push(data);
        }
        draw(-0.015);
        const opacity = occlusion.snapshot();
        draw(0.015);
        let changed = 0,
          totalDelta = 0;
        for (let i = 0; i < pixels[0].length; i += 4) {
          let diff = 0;
          for (let c = 0; c < 3; c++)
            diff += Math.abs(pixels[0][i + c] - pixels[1][i + c]);
          if (diff > 18) changed++;
          totalDelta += diff / 3;
        }
        const image = renderer.domElement.toDataURL();
        const data = {
          viewport: `${width}x${height}`,
          dpr,
          samples,
          opacity,
          changedFraction: changed / (80 * 80),
          meanChannelDelta: totalDelta / (80 * 80),
          image,
        };
        occlusion.dispose();
        scene.traverse((o) => {
          if (o.isMesh) {
            o.geometry.dispose();
            o.material.dispose();
          }
        });
        renderer.dispose();
        return data;
      },
      { width, height, dpr },
    );
    const { image, ...record } = result;
    await writeFile(
      `${directory}/${width}-fixture.png`,
      Buffer.from(image.split(",")[1], "base64"),
    );
    results.cases.push(record);
    await page.close();
  }
  assert.deepEqual(results.errors, []);
  if (!process.argv.includes("--baseline"))
    for (const c of results.cases) {
      assert(c.samples >= 4);
      assert(c.changedFraction < 0.02, JSON.stringify(c));
    }
  console.log(JSON.stringify(results));
} finally {
  await writeFile(
    `${directory}/results.json`,
    await format(JSON.stringify(results), { parser: "json" }),
  );
  await browser.close();
}
