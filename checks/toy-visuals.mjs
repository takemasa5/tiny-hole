import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { format } from "prettier";
const directory =
  process.env.HOLE_REPORT_DIR || "reports/toy-trial-2026-11-06/models";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1250 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.HOLE_URL || "http://127.0.0.1:5176/");
  await page.waitForFunction(() => window.__hole);
  const models = await page.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const { createGrowthStage } = await import("/src/game/growth-stage.ts");
    const { growthVisual } = await import("/src/game/growth-visuals.ts");
    const { objectVisual } = await import("/src/game/visuals.ts");
    const definitions = createGrowthStage(42, "toys");
    const normalized = (d) => ({
      ...d,
      size: d.size.map((value) => value / Math.max(...d.size)),
    });
    const seen = new Set();
    const models = definitions
      .filter((d) => d.toyKind && !seen.has(d.toyKind) && seen.add(d.toyKind))
      .map((d) => ({
        label: d.label,
        mesh: growthVisual(normalized(d), "toys"),
      }));
    for (const id of ["hero", "monster", "goal"]) {
      const d = definitions.find((o) => o.id === id);
      models.push({
        label: d.label,
        mesh: growthVisual(normalized(d), "toys"),
      });
    }
    models.push({
      label: "補充箱：上面と帯",
      mesh: growthVisual(
        normalized(definitions.find((d) => d.sourceLevel === 1)),
        "toys",
      ),
    });
    const soldier = objectVisual("toySoldier");
    soldier.scale.setScalar(0.7);
    models.push({ label: "兵隊：帽子と顔", mesh: soldier });
    const height = Math.ceil(models.length / 5) * 250;
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "10000",
      background: "#fff9ed",
      pointerEvents: "none",
    });
    document.body.append(overlay);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(1440, height);
    renderer.setScissorTest(true);
    renderer.setClearColor("#fff9ed");
    overlay.append(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(36, 288 / 250, 0.1, 20);
    camera.position.set(1.8, 1.6, 2.1);
    camera.lookAt(0, 0, 0);
    models.forEach(({ label, mesh }, index) => {
      const x = (index % 5) * 288,
        y = Math.floor(index / 5) * 250;
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight("#ffffff", "#858c7c", 2.4));
      const light = new THREE.DirectionalLight("#fff0d8", 3);
      light.position.set(-2, 4, 3);
      scene.add(light, mesh);
      renderer.setViewport(x, height - y - 250, 288, 250);
      renderer.setScissor(x, height - y - 250, 288, 250);
      renderer.render(scene, camera);
      const caption = document.createElement("div");
      caption.textContent = label;
      Object.assign(caption.style, {
        position: "absolute",
        left: `${x}px`,
        top: `${y + 220}px`,
        width: "288px",
        textAlign: "center",
        font: "14px sans-serif",
        color: "#3b4d59",
      });
      overlay.append(caption);
    });
    return {
      labels: models.map((m) => m.label),
      height,
      expected: seen.size + 5,
    };
  });
  await page.setViewportSize({ width: 1440, height: models.height });
  await page.screenshot({ path: `${directory}/gallery.png` });
  assert.equal(models.labels.length, models.expected);
  assert.deepEqual(errors, []);
  await writeFile(
    `${directory}/results.json`,
    await format(
      JSON.stringify({
        browser: await browser.version(),
        fixture:
          "個々の実モデルを並べた描画確認。ゲームの配置・操作確認とは別。",
        models: models.labels,
        errors,
      }),
      { parser: "json" },
    ),
  );
} finally {
  await browser.close();
}
