import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { format } from "prettier";
const directory =
  process.env.HOLE_REPORT_DIR || "reports/level-one-flash-2026-11-07/final";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" }),
  report = {
    browser: await browser.version(),
    fixture:
      "実際の箱・透過処理を使う描画用の比較シーン。通常プレイ・iPhone実機とは別。",
    iPhone: "未実施",
    WebKit: "未実施",
    errors: [],
    cases: [],
  };
try {
  for (const [level, radius, z] of [
    [1, 0.08, 0.4],
    [2, 0.14, 0.39],
  ]) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    page.on("pageerror", (e) => report.errors.push(e.message));
    await page.route("**/container-fixture", (r) =>
      r.fulfill({
        contentType: "text/html",
        body: "<!doctype html><style>body{margin:0}</style><canvas></canvas>",
      }),
    );
    await page.goto(
      `${process.env.HOLE_URL || "http://127.0.0.1:5178"}/container-fixture`,
    );
    const result = await page.evaluate(
      async ({ level, radius, z }) => {
        const source = await (await fetch("/src/game/occlusion.ts")).text(),
          threeUrl = source.match(/from\s+["']([^"']+three[^"']*)["']/)[1];
        const worldSource = await (
            await fetch("/src/game/toy-world-scene.ts")
          ).text(),
          rapierUrl = worldSource.match(
            /import RAPIER from\s+["']([^"']+)["']/,
          )[1];
        const THREE = await import(threeUrl),
          RAPIER = (await import(rapierUrl)).default,
          { ToyWorldScene } = await import("/src/game/toy-world-scene.ts"),
          { HoleOcclusion } = await import("/src/game/occlusion.ts");
        await RAPIER.init();
        const renderer = new THREE.WebGLRenderer({
          canvas: document.querySelector("canvas"),
          antialias: true,
          preserveDrawingBuffer: true,
        });
        renderer.setPixelRatio(2);
        renderer.setSize(390, 844);
        renderer.setClearColor("#fffde5");
        const gl = renderer.getContext(),
          samples = gl.getParameter(gl.SAMPLES),
          scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight("#ffffff", "#858c7c", 2.4));
        const sun = new THREE.DirectionalLight("#fff0d8", 3);
        sun.position.set(-15, 30, 20);
        scene.add(sun);
        const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }),
          room = new ToyWorldScene(world, new Set()),
          hole = { x: 0, z, radius };
        scene.add(room.group);
        room.update(level, 0, hole, 0);
        const bottom = new THREE.Mesh(
          new THREE.CircleGeometry(radius, 64),
          new THREE.MeshBasicMaterial({ color: "#17202e" }),
        );
        bottom.rotation.x = -Math.PI / 2;
        bottom.position.set(0, -0.1, z);
        scene.add(bottom);
        const camera = new THREE.PerspectiveCamera(
            44,
            390 / 844,
            radius * 0.015,
            16000,
          ),
          scale = (radius * 844) / 390;
        camera.position.set(0, 7.6 * scale, z + 6.8 * scale);
        camera.lookAt(0, 0, z);
        camera.updateMatrixWorld();
        scene.updateMatrixWorld(true);
        const frame = room.occluders()[0].object,
          meshes = [];
        frame.traverse((o) => {
          if (o.isMesh) meshes.push(o);
        });
        const originals = new Map(meshes.map((m) => [m, m.material]));
        const front = frame.children.find(
            (m) =>
              m.isMesh &&
              Math.abs(m.position.z - 0.55) < 1e-6 &&
              m.position.y === 0.135,
          ),
          back = frame.children.find(
            (m) =>
              m.isMesh &&
              Math.abs(m.position.z + 0.55) < 1e-6 &&
              m.position.y === 0.135,
          ),
          lidGroup = frame.children.find(
            (o) => o.isGroup && o.position.y === 0.27,
          ),
          lid = lidGroup.children.find((m) => m.isMesh);
        const occlusion = new HoleOcclusion(samples);
        renderer.render(scene, camera);
        const opaque = renderer.domElement.toDataURL();
        for (let i = 0; i < 20; i++) {
          occlusion.update(camera, hole, room.occluders(), 1 / 60);
          renderer.render(scene, camera);
        }
        const faded = renderer.domElement.toDataURL(),
          result = {
            level,
            radius,
            viewport: "390x844 DPR2",
            samples,
            mode: occlusion.mode,
            occlusion: occlusion.snapshot(),
            frontChanged: front.material !== originals.get(front),
            backChanged: back.material !== originals.get(back),
            lidChanged: lid.material !== originals.get(lid),
            opaque,
            faded,
          };
        occlusion.dispose();
        room.group.traverse((o) => {
          if (o.isMesh) {
            o.geometry.dispose();
            if (Array.isArray(o.material))
              o.material.forEach((m) => m.dispose());
            else o.material.dispose();
          }
        });
        bottom.geometry.dispose();
        bottom.material.dispose();
        world.free();
        renderer.dispose();
        return result;
      },
      { level, radius, z },
    );
    const { opaque, faded, ...record } = result;
    report.cases.push(record);
    await writeFile(
      `${directory}/level-${level}-opaque.png`,
      Buffer.from(opaque.split(",")[1], "base64"),
    );
    await writeFile(
      `${directory}/level-${level}-faded.png`,
      Buffer.from(faded.split(",")[1], "base64"),
    );
    await page.close();
    if (!process.argv.includes("--baseline")) {
      assert.equal(record.backChanged, false);
      assert.equal(record.lidChanged, false);
      assert.equal(record.frontChanged, level === 1);
    }
  }
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify(report));
} catch (error) {
  report.failure = error.stack;
  throw error;
} finally {
  await writeFile(
    `${directory}/results.json`,
    await format(JSON.stringify(report), { parser: "json" }),
  );
  await browser.close();
}
