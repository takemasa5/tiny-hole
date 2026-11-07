import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { format } from "prettier";
const directory =
  process.env.HOLE_REPORT_DIR || "reports/shape-collision-2026-11-07/models";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 720 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.HOLE_URL || "http://127.0.0.1:5178/");
  await page.waitForFunction(() => window.__hole);
  const physicsModule = await (
    await page.request.get(
      new URL("/src/game/growth-physics.ts", page.url()).href,
    )
  ).text();
  const rapierUrl = physicsModule.match(/import RAPIER from "([^"]+)"/)[1];
  const result = await page.evaluate(async (rapierUrl) => {
    const { default: R } = await import(rapierUrl);
    const THREE = await import("/node_modules/three/build/three.module.js");
    const { createGrowthStage } = await import("/src/game/growth-stage.ts");
    const { growthVisual } = await import("/src/game/growth-visuals.ts");
    const { growthShapeParts } = await import("/src/game/growth-shape.ts");
    const { createGrowthBody, growthCollisionBounds } =
      await import("/src/game/growth-physics.ts");
    const { createFloor, updateFloor } = await import("/src/game/floor.ts");
    await R.init();
    const toys = createGrowthStage(42, "toys");
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "10000",
      background: "#fff9ed",
    });
    document.body.append(overlay);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(1200, 720);
    renderer.setScissorTest(true);
    renderer.setClearColor("#fff9ed");
    overlay.append(renderer.domElement);
    const models = ["desk", "chair", "floorLamp", "puzzle", "hero", "monster"];
    const summaries = [];
    for (const [index, kind] of models.entries()) {
      const source = toys.find((d) => d.toyKind === kind || d.model === kind);
      const definition = {
        ...source,
        size: [1, 1, 1],
        scale: 1,
        behavior: "still",
      };
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight("#ffffff", "#818675", 2.4));
      const light = new THREE.DirectionalLight("#fff0d8", 3);
      light.position.set(-2, 4, 3);
      scene.add(light);
      scene.add(growthVisual(definition, "toys"));
      const parts = growthShapeParts(definition, "toys");
      for (const { vertices, indices } of parts) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(vertices, 3),
        );
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        scene.add(
          new THREE.LineSegments(
            new THREE.EdgesGeometry(geometry),
            new THREE.LineBasicMaterial({
              color: "#1d6180",
              transparent: true,
              opacity: 0.8,
            }),
          ),
        );
      }
      const camera = new THREE.PerspectiveCamera(36, 400 / 360, 0.1, 20);
      camera.position.set(1.7, 1.15, 2.1);
      camera.lookAt(0, 0, 0);
      const x = (index % 3) * 400,
        y = Math.floor(index / 3) * 360;
      renderer.setViewport(x, 720 - y - 360, 400, 360);
      renderer.setScissor(x, 720 - y - 360, 400, 360);
      renderer.render(scene, camera);
      const caption = document.createElement("div");
      caption.textContent = `${source.label} — ${parts.length} 部品`;
      Object.assign(caption.style, {
        position: "absolute",
        left: `${x}px`,
        top: `${y + 330}px`,
        width: "400px",
        textAlign: "center",
        font: "16px sans-serif",
        color: "#3b4d59",
      });
      overlay.append(caption);
      summaries.push({ kind, parts: parts.length });
    }
    const source = toys.find((d) => d.toyKind === "floorLamp");
    const d = { ...source, size: [1, 3, 1], behavior: "still" };
    const falls = [];
    for (const oldBox of [true, false]) {
      const world = new R.World({ x: 0, y: -9.81, z: 0 });
      try {
        const floor = createFloor(world);
        updateFloor(floor, 0, 0, 0.65, 100);
        const body = oldBox
          ? world.createRigidBody(
              R.RigidBodyDesc.dynamic()
                .setTranslation(0, 1.5005, 0)
                .setCcdEnabled(true),
            )
          : createGrowthBody(
              world,
              d,
              { x: 0, y: 1.5005, z: 0 },
              { x: 0, y: 0, z: 0, w: 1 },
              "toys",
            ).body;
        if (oldBox)
          world.createCollider(R.ColliderDesc.cuboid(0.5, 1.5, 0.5), body);
        for (let i = 0; i < 180; i++) world.step();
        falls.push({
          oldBox,
          position: body.translation(),
          actualTop:
            body.translation().y +
            growthCollisionBounds(d, body.rotation(), "toys").top,
        });
      } finally {
        world.free();
      }
    }
    return { summaries, falls };
  }, rapierUrl);
  await page.screenshot({ path: `${directory}/collider-overlay.png` });
  assert(result.falls.find((r) => r.oldBox).actualTop > 0);
  assert(result.falls.find((r) => !r.oldBox).actualTop < -0.65);
  assert.deepEqual(errors, []);
  await writeFile(
    `${directory}/results.json`,
    await format(
      JSON.stringify({
        browser: await browser.version(),
        fixture:
          "実モデルと部品ごとの当たり判定の重ね描き、および同一の穴で旧箱型が残り修正版が落下する比較。通常ゲームの操作確認とは別。",
        ...result,
        errors,
        iPhone: "未実施",
        WebKit: "未実施",
      }),
      { parser: "json" },
    ),
  );
} finally {
  await browser.close();
}
