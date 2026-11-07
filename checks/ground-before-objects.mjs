import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { format } from "prettier";
const directory =
  process.env.HOLE_REPORT_DIR || "reports/iphone-video-2026-11-07/ground-after";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" }),
  page = await browser.newPage({
    viewport: { width: 390, height: 784 },
    deviceScaleFactor: 2,
  });
const result = {
  browser: await browser.version(),
  fixture:
    "実際の床を使う描画確認。街の床だけの深度判定を止め、床が通過する場合を意図的に模擬。iPhoneの内部挙動の再現とは別。",
  errors: [],
  iPhoneAfterFix: "未実施",
  WebKit: "未実施",
};
page.on("pageerror", (e) => result.errors.push(e.message));
try {
  await page.route("**/ground-fixture", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<!doctype html><style>body{margin:0}</style><canvas></canvas>",
    }),
  );
  await page.goto(
    `${process.env.HOLE_URL || "http://127.0.0.1:5178"}/ground-fixture`,
  );
  const data = await page.evaluate(async () => {
    const source = await (await fetch("/src/game/toy-world-scene.ts")).text(),
      threeURL = source.match(/from\s+["']([^"']+three[^"']*)["']/)[1],
      rapierURL = source.match(/import RAPIER from\s+["']([^"']+)["']/)[1];
    const THREE = await import(threeURL),
      RAPIER = (await import(rapierURL)).default,
      { ToyWorldScene } = await import("/src/game/toy-world-scene.ts"),
      groundModule = await import("/src/game/ground-geometry.ts"),
      { floorShape } = await import("/src/game/floor.ts");
    await RAPIER.init();
    const renderer = new THREE.WebGLRenderer({
      canvas: document.querySelector("canvas"),
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(2);
    renderer.setSize(390, 784);
    renderer.setClearColor("#fffde5");
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#ffffff", "#858c7c", 2.4));
    const sun = new THREE.DirectionalLight("#fff0d8", 3);
    sun.position.set(-15, 30, 20);
    scene.add(sun);
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }),
      room = new ToyWorldScene(world, new Set()),
      hole = { x: 0, z: 0, radius: 0.08 };
    scene.add(room.group);
    room.update(1, 0, hole, 0);
    const shape = floorShape(0, 0, hole.radius, 3.4),
      geometry = new THREE.BufferGeometry();
    groundModule.writeGroundGeometry(
      geometry,
      shape.vertices,
      shape.indices,
      1600,
    );
    const base = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: "#fffde5",
        side: THREE.DoubleSide,
      }),
    );
    base.renderOrder = groundModule.BASE_GROUND_RENDER_ORDER ?? 0;
    scene.add(base);
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.15, 0.1),
      new THREE.MeshBasicMaterial({ color: "#0055ff" }),
    );
    cube.position.set(-0.16, 0.075, 0);
    scene.add(cube);
    const abyss = new THREE.Mesh(
      new THREE.CylinderGeometry(hole.radius, hole.radius, 0.5, 64, 1, true),
      new THREE.MeshBasicMaterial({ color: "#1c2433", side: THREE.BackSide }),
    );
    abyss.position.y = -0.25;
    scene.add(abyss);
    const camera = new THREE.PerspectiveCamera(44, 390 / 784, 0.0012, 16000),
      scale = (0.08 * 784) / 390;
    camera.position.set(0, 7.6 * scale, 6.8 * scale);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    scene.updateMatrixWorld(true);
    const gl = renderer.getContext(),
      pixels = new Uint8Array(780 * 1568 * 4),
      city = room.group.getObjectByName("city-floor"),
      originalDepth = city.material.depthTest;
    function draw() {
      renderer.render(scene, camera);
      gl.readPixels(0, 0, 780, 1568, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let blue = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (pixels[i] < 50 && pixels[i + 1] < 150 && pixels[i + 2] > 180)
          blue++;
      return { blue, image: renderer.domElement.toDataURL() };
    }
    const normal = draw();
    city.material.depthTest = false;
    const fault = draw();
    cube.position.y = -0.12;
    scene.updateMatrixWorld(true);
    const below = draw();
    const record = {
      normalBlue: normal.blue,
      depthBypassBlue: fault.blue,
      belowGroundBlue: below.blue,
      cityOrder: city.renderOrder,
      cubeOrder: cube.renderOrder,
      baseOrder: base.renderOrder,
      normalDepthTest: originalDepth,
      normal: normal.image,
      fault: fault.image,
      below: below.image,
    };
    scene.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
    world.free();
    renderer.dispose();
    return record;
  });
  const { normal, fault, below, ...record } = data;
  result.measurement = record;
  for (const [label, url] of Object.entries({ normal, fault, below }))
    await writeFile(
      `${directory}/${label}.png`,
      Buffer.from(url.split(",")[1], "base64"),
    );
  assert(record.normalBlue > 200);
  if (process.argv.includes("--baseline"))
    assert(record.depthBypassBlue < record.normalBlue * 0.05);
  else {
    assert(record.depthBypassBlue >= record.normalBlue * 0.95);
    assert.equal(record.belowGroundBlue, 0);
    assert(record.cityOrder < record.cubeOrder);
    assert(record.baseOrder < record.cityOrder);
  }
  assert.deepEqual(result.errors, []);
  console.log(JSON.stringify(result));
} catch (error) {
  result.failure = error.stack;
  throw error;
} finally {
  await writeFile(
    `${directory}/results.json`,
    await format(JSON.stringify(result), { parser: "json" }),
  );
  await browser.close();
}
