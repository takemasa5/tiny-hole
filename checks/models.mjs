import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 940 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto("http://localhost:5173/");
  await page.waitForFunction(() => window.__hole);
  // Inspect production models in a separate gallery; no game state is changed.
  await page.evaluate(async () => {
    const THREE = await import("/node_modules/.vite/deps/three.js");
    const { objectVisual, disposeScene } = await import("/src/game/visuals.ts");
    const gallery = document.createElement("section");
    gallery.style.cssText =
      "position:fixed;inset:0;z-index:100;background:#f4f1e8;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(2,minmax(0,1fr));gap:18px;padding:18px;font:18px sans-serif;color:#34414e;box-sizing:border-box";
    document.body.append(gallery);
    for (const [kind, stage, label, background] of [
      ["american", "america", "アメリカの人", "#e5ece9"],
      ["house", "america", "アメリカの家", "#e5ece9"],
      ["egyptian", "egypt", "エジプトの人", "#f1dfbc"],
      ["tanuki", "mountain", "たぬき", "#dbe8d1"],
    ]) {
      const card = document.createElement("div");
      card.style.cssText =
        "display:flex;flex-direction:column;background:white;border-radius:18px;overflow:hidden;min-height:0";
      const title = document.createElement("strong");
      title.textContent = label;
      title.style.cssText = "padding:14px 18px";
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "width:100%;flex:1;min-height:0";
      card.append(title, canvas);
      gallery.append(card);
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      renderer.setClearColor(background);
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight("#ffffff", "#877c69", 2.5));
      const light = new THREE.DirectionalLight("#fff6df", 2.5);
      light.position.set(-3, 6, 7);
      scene.add(light);
      const model = objectVisual(kind, stage);
      scene.add(model);
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const extent = Math.max(size.x, size.y, size.z) * 0.72;
      const aspect = canvas.clientWidth / canvas.clientHeight;
      const camera = new THREE.OrthographicCamera(
        -extent * aspect,
        extent * aspect,
        extent,
        -extent,
        0.01,
        100,
      );
      camera.position
        .copy(center)
        .add(
          kind === "egyptian"
            ? new THREE.Vector3(-extent * 2.8, extent * 0.4, extent * 0.8)
            : new THREE.Vector3(extent * 0.8, extent * 0.55, extent * 2.8),
        );
      camera.lookAt(center);
      renderer.render(scene, camera);
      // Preserve rendered pixels for the screenshot after freeing the temporary GPU resources.
      const picture = document.createElement("img");
      picture.src = canvas.toDataURL();
      picture.style.cssText =
        "width:100%;flex:1;min-height:0;object-fit:contain";
      canvas.replaceWith(picture);
      disposeScene(scene);
      renderer.dispose();
    }
  });
  await page.screenshot({ path: "reports/stage-models-preview.png" });
  if (errors.length) throw new Error(errors.join("\n"));
  await writeFile(
    "reports/models-check.json",
    JSON.stringify(
      {
        date: "2026-10-15",
        browser: await browser.version(),
        productionModelsRendered: [
          "american",
          "house/america",
          "egyptian",
          "tanuki",
        ],
        errors,
        iPhoneSafari: "未実施",
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
