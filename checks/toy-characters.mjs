import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const directory = "reports/toy-characters-2026-11-14";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1080 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.HOLE_URL || "http://127.0.0.1:5176/");
  await page.waitForFunction(() => window.__hole);
  const models = await page.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const { createGrowthStage } = await import("/src/game/growth-stage.ts");
    const { growthVisual } = await import("/src/game/growth-visuals.ts");
    const { disposeScene } = await import("/src/game/visuals.ts");
    const definitions = createGrowthStage(42, "toys");
    const overlay = document.createElement("section");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:10000;background:#f5f0e6;color:#344a52;padding:28px 36px;box-sizing:border-box;font:16px sans-serif";
    overlay.innerHTML =
      '<div style="font-size:13px;letter-spacing:3px;color:#6c7c78">TOY CITY / CHARACTER DESIGN</div><h1 style="font-size:29px;margin:8px 0 18px">特撮ヒーローと怪獣</h1><div class="views" style="display:grid;grid-template-columns:1fr 1fr;gap:18px"></div>';
    document.body.append(overlay);
    const results = [];
    for (const [id, label, angle] of [
      ["hero", "ヒーロー · 正面", [1.5, 0.65, 3.2]],
      ["monster", "怪獣 · 正面", [2.1, 0.9, 3.3]],
      ["hero", "ヒーロー · 背面", [-1.5, 0.65, -3.2]],
      ["monster", "怪獣 · 側面", [3.4, 0.75, 0.6]],
    ]) {
      const definition = definitions.find((d) => d.id === id);
      const model = growthVisual(
        { ...definition, size: definition.size.map((n) => n / 220) },
        "toys",
      );
      const card = document.createElement("div");
      card.style.cssText =
        "border-radius:16px;overflow:hidden;background:#e7e8dd";
      const title = document.createElement("div");
      title.textContent = label;
      title.style.cssText = "padding:14px 20px;font-size:17px;font-weight:600";
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: true,
      });
      renderer.setSize(595, 405);
      renderer.setClearColor("#e7e8dd");
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight("#fff8e9", "#889a91", 2.1));
      const light = new THREE.DirectionalLight("#fff6e2", 2.8);
      light.position.set(-3, 5, 4);
      scene.add(light, model);
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const extent = 0.65;
      const aspect = 595 / 405;
      const camera = new THREE.OrthographicCamera(
        -extent * aspect,
        extent * aspect,
        extent,
        -extent,
        0.01,
        20,
      );
      camera.position.copy(center).add(new THREE.Vector3(...angle));
      camera.lookAt(center);
      renderer.render(scene, camera);
      const image = document.createElement("img");
      image.src = renderer.domElement.toDataURL();
      image.style.cssText =
        "display:block;width:100%;height:405px;object-fit:contain";
      card.append(title, image);
      overlay.querySelector(".views").append(card);
      const arm = model.getObjectByName("attack-arm");
      if (!arm) throw new Error(`${id}: 攻撃の関節がありません`);
      const fist = arm.getObjectByName(
        id === "hero" ? "fist-right" : "hand-right",
      );
      const before = fist.getWorldPosition(new THREE.Vector3());
      arm.rotation.x = -1;
      model.updateMatrixWorld(true);
      const moved = fist.getWorldPosition(new THREE.Vector3());
      arm.rotation.x = 0;
      model.updateMatrixWorld(true);
      const restored = fist.getWorldPosition(new THREE.Vector3());
      const meshes = [];
      model.traverse((obj) => {
        if (obj.isMesh) meshes.push(obj);
      });
      results.push({
        id,
        label,
        dimensions: definition.size,
        parts: meshes.length,
        allBoxGeometry: meshes.every(
          (mesh) => mesh.geometry.type === "BoxGeometry",
        ),
        attackMoves: before.distanceTo(moved) > 0.01,
        attackRestores: before.distanceTo(restored) < 1e-8,
      });
      disposeScene(scene);
      renderer.dispose();
    }
    await Promise.all(
      [...overlay.querySelectorAll("img")].map((img) => img.decode()),
    );
    return results;
  });
  for (const model of models) {
    assert(model.allBoxGeometry);
    assert(model.attackMoves);
    assert(model.attackRestores);
  }
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${directory}/game-models.png` });
  await writeFile(
    `${directory}/models.json`,
    JSON.stringify(
      {
        browser: await browser.version(),
        fixture:
          "実モデルを並べた描画・関節の確認。通常ゲームの操作確認とは別。",
        models,
        errors,
        WebKit: "未実施",
        iPhone: "未実施",
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
