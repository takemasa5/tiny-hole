import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:5173/");
  await page.waitForFunction(() => window.__hole);
  const result = await page.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const { objectVisual, disposeScene } = await import("/src/game/visuals.ts");
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:fixed;inset:0;width:640px;height:480px;z-index:100";
    document.body.appendChild(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(640, 480, false);
    renderer.setClearColor("#e8e3d7");
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#ffffff", "#858c7c", 2.4));
    const light = new THREE.DirectionalLight("#fff0d8", 3);
    light.position.set(-15, 30, 20);
    scene.add(light);
    const camera = new THREE.PerspectiveCamera(44, 640 / 480, 0.08, 800);
    const gl = renderer.getContext();
    const results = [];
    for (const kind of ["house", "kiosk"]) {
      const visual = objectVisual(kind);
      scene.add(visual);
      const body = visual.children[0];
      const roof = visual.children[1];
      const { width, depth } = roof.geometry.parameters;
      const roofTop = roof.position.y + roof.geometry.parameters.height / 2;
      for (const distance of [10, 25, 70]) {
        for (const angle of [0, 0.5, 1.2]) {
          camera.position.set(
            Math.sin(angle) * distance,
            distance * 0.9,
            Math.cos(angle) * distance,
          );
          camera.lookAt(0, 0, 0);
          camera.updateMatrixWorld();
          const pixels = [];
          for (const x of [-0.25, 0, 0.25]) {
            for (const z of [-0.25, 0, 0.25]) {
              const projected = new THREE.Vector3(
                width * x,
                roofTop,
                depth * z,
              ).project(camera);
              pixels.push([
                Math.floor((projected.x + 1) * 320),
                Math.floor((projected.y + 1) * 240),
              ]);
            }
          }
          function sample() {
            renderer.render(scene, camera);
            return pixels.map(([x, y]) => {
              const color = new Uint8Array(4);
              gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, color);
              return [...color];
            });
          }
          body.visible = true;
          const actual = sample();
          body.visible = false;
          const roofOnly = sample();
          body.visible = true;
          const mismatches = actual.filter((color, index) =>
            color.some((value, channel) => value !== roofOnly[index][channel]),
          ).length;
          results.push({
            kind,
            distance,
            angle,
            samples: pixels.length,
            mismatches,
          });
          if (mismatches)
            throw new Error(
              `${kind}: 屋根の色が本体と競合 (${distance}, ${angle})`,
            );
        }
      }
      if (kind === "house") {
        camera.position.set(8, 9, 10);
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
        window.__roofImage = canvas.toDataURL();
      }
      scene.remove(visual);
      disposeScene(visual);
    }
    renderer.dispose();
    canvas.remove();
    return results;
  });
  if (errors.length) throw new Error(errors.join("\n"));
  await mkdir("reports", { recursive: true });
  const image = await page.evaluate(() => window.__roofImage);
  await writeFile(
    "reports/roof-fixed.png",
    Buffer.from(image.split(",")[1], "base64"),
  );
  const report = {
    date: "2026-10-14",
    browser: await browser.version(),
    cases: result,
    errors,
    iPhoneSafariAfterFix: "未確認",
  };
  await writeFile(
    "reports/roof-check.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `屋根描画: ${result.length}条件、${result.reduce((sum, entry) => sum + entry.samples, 0)}点で本体との競合なし。`,
  );
} finally {
  await browser.close();
}
