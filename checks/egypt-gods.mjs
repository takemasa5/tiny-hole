import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { format } from "prettier";
const directory =
  process.env.HOLE_REPORT_DIR || "reports/egypt-gods-2026-11-08/models";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const report = {
  browser: await browser.version(),
  fixture:
    "実モデルと行動関数を使う独立した描画・行動検査。通常プレイの通し検査とは別。",
  errors: [],
  iPhone: "今回の追加後は未実施",
  WebKit: "未実施",
};
page.on("pageerror", (e) => report.errors.push(e.message));
try {
  await page.route("**/gods-fixture", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<!doctype html><style>body{margin:0;background:#fff1cc}canvas{display:block}</style><canvas></canvas>",
    }),
  );
  await page.goto(
    `${process.env.HOLE_URL || "http://127.0.0.1:5178"}/gods-fixture`,
  );
  report.models = await page.evaluate(async () => {
    const source = await (await fetch("/src/game/toy-world-scene.ts")).text();
    const THREE = await import(
      source.match(/from\s+["']([^"']+three[^"']*)["']/)[1]
    );
    const { createGrowthStage } = await import("/src/game/growth-stage.ts");
    const { growthVisual } = await import("/src/game/growth-visuals.ts");
    const { createThemeMotion, themeVelocity } =
      await import("/src/game/theme-behavior.ts");
    const { disposeScene } = await import("/src/game/visuals.ts");
    const renderer = new THREE.WebGLRenderer({
      canvas: document.querySelector("canvas"),
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(1280, 800);
    renderer.setClearColor("#fff1cc");
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#ffffff", "#8c795a", 2.4));
    const sun = new THREE.DirectionalLight("#fff0d8", 3);
    sun.position.set(-150, 300, 250);
    scene.add(sun);
    const definitions = createGrowthStage(42, "egypt").filter((d) =>
      d.id.startsWith("egypt-god-"),
    );
    const rows = [];
    definitions.forEach((d, index) => {
      const mesh = growthVisual(d, "egypt");
      mesh.position.set((index - 1) * 155, d.size[1] / 2, 0);
      mesh.rotation.y = -0.28;
      scene.add(mesh);
      const motion = createThemeMotion(d);
      const small = themeVelocity(
        d,
        motion,
        d,
        { x: d.x - 80, z: d.z, radius: 24 },
        1 / 60,
      );
      const before = motion.phase;
      const flee = themeVelocity(
        d,
        motion,
        d,
        { x: d.x - 80, z: d.z, radius: d.level === 12 ? 160 : 48 },
        1 / 60,
      );
      rows.push({
        id: d.id,
        kind: d.egyptKind,
        size: d.size,
        normalPhase: before,
        smallVelocity: small,
        escapePhase: motion.phase,
        fleeVelocity: flee,
      });
    });
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 400),
      new THREE.MeshStandardMaterial({ color: "#e4c58a" }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    scene.add(floor);
    const camera = new THREE.PerspectiveCamera(40, 1280 / 800, 1, 2500);
    camera.position.set(100, 230, 770);
    camera.lookAt(0, 125, 0);
    renderer.render(scene, camera);
    const image = renderer.domElement.toDataURL();
    disposeScene(scene);
    renderer.dispose();
    return { rows, image };
  });
  await writeFile(
    `${directory}/gods.png`,
    Buffer.from(report.models.image.split(",")[1], "base64"),
  );
  delete report.models.image;
  assert.equal(report.models.rows.length, 3);
  for (const row of report.models.rows) {
    assert.equal(row.normalPhase, "working");
    assert.equal(row.escapePhase, "fleeing");
    assert(row.fleeVelocity.x > 0);
  }
  report.pyramidView = await page.evaluate(async () => {
    const source = await (await fetch("/src/game/toy-world-scene.ts")).text();
    const THREE = await import(
      source.match(/from\s+["']([^"']+three[^"']*)["']/)[1]
    );
    const RAPIER = (
      await import(source.match(/import RAPIER from\s+["']([^"']+)["']/)[1])
    ).default;
    const { NestedWorldScene } = await import("/src/game/toy-world-scene.ts");
    const { EGYPT_SPACES, EGYPT_WALLS, EGYPT_ROADS } =
      await import("/src/game/egypt-world.ts");
    const { egyptFloorTextures } = await import("/src/game/egypt-floor.ts");
    const { growthVisual } = await import("/src/game/growth-visuals.ts");
    const { createGrowthStage } = await import("/src/game/growth-stage.ts");
    const { disposeScene } = await import("/src/game/visuals.ts");
    await RAPIER.init();
    const renderer = new THREE.WebGLRenderer({
      canvas: document.querySelector("canvas"),
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(1280, 800);
    renderer.setClearColor("#fffde5");
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#ffffff", "#858c7c", 2.4));
    const sun = new THREE.DirectionalLight("#fff0d8", 3);
    sun.position.set(-15, 30, 20);
    scene.add(sun);
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const room = new NestedWorldScene(world, new Set(), {
      spaces: EGYPT_SPACES,
      walls: EGYPT_WALLS,
      roads: EGYPT_ROADS,
      style: "egypt",
      floorTextures: egyptFloorTextures(),
    });
    scene.add(room.group);
    room.update(8, 2, { x: 60, z: -15, radius: 6 }, 0);
    const d = createGrowthStage(42, "egypt").find((d) => d.id === "goal");
    const mesh = growthVisual(d, "egypt");
    scene.add(mesh);
    const camera = new THREE.PerspectiveCamera(44, 1280 / 800, 0.09, 16000);
    camera.position.set(60, 7.6 * 6, -15 + 6.8 * 6);
    camera.lookAt(60, 0, -15);
    const gl = renderer.getContext();
    const read = () => {
      const pixels = new Uint8Array(1280 * 800 * 4);
      gl.readPixels(0, 0, 1280, 800, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    mesh.visible = false;
    renderer.render(scene, camera);
    const base = read();
    const rows = [];
    mesh.visible = true;
    for (const position of [
      { id: "north", x: 25, z: -135 },
      { id: "east", x: 170, z: -100 },
    ]) {
      mesh.position.set(position.x, 90, position.z);
      renderer.render(scene, camera);
      const pixels = read();
      let changed = 0;
      for (let i = 0; i < pixels.length; i += 4)
        if (
          Math.abs(pixels[i] - base[i]) +
            Math.abs(pixels[i + 1] - base[i + 1]) +
            Math.abs(pixels[i + 2] - base[i + 2]) >
          15
        )
          changed++;
      rows.push({
        ...position,
        actual: position.x === d.x && position.z === d.z,
        visiblePixels: changed,
        image: renderer.domElement.toDataURL(),
      });
    }
    room.update(9, 3, { x: 95, z: 20, radius: 12 }, 1);
    for (const layout of [
      { id: "desktop", width: 1280, height: 800 },
      { id: "portrait", width: 390, height: 844 },
    ]) {
      renderer.setSize(layout.width, layout.height);
      camera.aspect = layout.width / layout.height;
      camera.near = 12 * 0.015;
      const scale =
        (12 * layout.height) / Math.min(layout.width, layout.height);
      camera.position.set(95, 7.6 * scale, 20 + 6.8 * scale);
      camera.lookAt(95, 0, 20);
      camera.updateProjectionMatrix();
      const readExit = () => {
        const pixels = new Uint8Array(layout.width * layout.height * 4);
        gl.readPixels(
          0,
          0,
          layout.width,
          layout.height,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
        return pixels;
      };
      mesh.visible = false;
      renderer.render(scene, camera);
      const exitBase = readExit();
      mesh.visible = true;
      for (const position of [
        { id: "current", x: d.x, z: d.z },
        { id: "alternate", x: 110, z: -135 },
      ]) {
        mesh.position.set(position.x, 90, position.z);
        renderer.render(scene, camera);
        const pixels = readExit();
        let changed = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (
            Math.abs(pixels[i] - exitBase[i]) +
              Math.abs(pixels[i + 1] - exitBase[i + 1]) +
              Math.abs(pixels[i + 2] - exitBase[i + 2]) >
            15
          )
            changed++;
        rows.push({
          id: `exit-${layout.id}-${position.id}`,
          x: position.x,
          z: position.z,
          level: 9,
          width: layout.width,
          height: layout.height,
          visiblePixels: changed,
          image: renderer.domElement.toDataURL(),
        });
      }
    }
    disposeScene(scene);
    world.free();
    renderer.dispose();
    return rows;
  });
  for (const row of report.pyramidView) {
    await writeFile(
      `${directory}/pyramid-${row.id}.png`,
      Buffer.from(row.image.split(",")[1], "base64"),
    );
    delete row.image;
  }
  assert(report.pyramidView.find((r) => r.id === "east").visiblePixels > 3000);
  for (const row of report.pyramidView.filter((r) => r.id.endsWith("-current")))
    assert(row.visiblePixels > 3000, `${row.id}からピラミッドが見えません`);
  assert.deepEqual(report.errors, []);
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
