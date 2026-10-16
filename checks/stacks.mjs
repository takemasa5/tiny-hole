import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
const results = [];
page.on("pageerror", (error) => errors.push(error.message));
const snapshot = () => page.evaluate(() => window.__hole.snapshot());
const wait = (ms) => page.waitForTimeout(ms);

async function moveTo(x, z) {
  for (let step = 0; step < 100; step++) {
    const state = await snapshot();
    const dx = x - state.hole.x;
    const dz = z - state.hole.z;
    const units =
      (state.hole.radius * 2) / (state.aperture[1].x - state.aperture[0].x);
    if (Math.hypot(dx, dz) < Math.max(0.12, units * 9)) return;
    const ratio = Math.min(1, (state.hole.radius * 0.85) / Math.hypot(dx, dz));
    await page.mouse.move(640, 400);
    await page.mouse.down();
    await page.mouse.move(
      640 + (dx * ratio) / units,
      400 + (dz * ratio * (7.6 / Math.hypot(7.6, 6.8))) / units,
      { steps: 5 },
    );
    await wait(190);
    await page.mouse.up();
  }
  throw new Error("通常ドラッグで目的位置に到達できません。");
}

async function ensureLogRadius() {
  for (let attempt = 0; attempt < 12; attempt++) {
    const state = await snapshot();
    if (state.hole.radius >= 1.45) return;
    const flower = state.objects
      .filter((object) => object.kind === "flower")
      .sort(
        (a, b) =>
          Math.hypot(a.position.x - state.hole.x, a.position.z - state.hole.z) -
          Math.hypot(b.position.x - state.hole.x, b.position.z - state.hole.z),
      )[0];
    if (!flower) break;
    await moveTo(flower.position.x, flower.position.z);
    await wait(500);
  }
  throw new Error("丸太の山を覆う大きさまで成長できません。");
}

async function inspectPile(stageId, kind) {
  if (kind === "log") await ensureLogRadius();
  const state = await snapshot();
  const target = state.objects
    .filter((object) => object.kind === kind && object.stackLevel === 0)
    .sort(
      (a, b) =>
        Math.hypot(a.position.x - state.hole.x, a.position.z - state.hole.z) -
        Math.hypot(b.position.x - state.hole.x, b.position.z - state.hole.z),
    )[0];
  if (!target) throw new Error(`${kind}: 積み上げがありません。`);
  const members = state.objects.filter(
    (object) => object.stackId === target.stackId,
  );
  const base = members.filter((object) => object.stackLevel === 0);
  const center = {
    x: base.reduce((n, o) => n + o.position.x / base.length, 0),
    z: base.reduce((n, o) => n + o.position.z / base.length, 0),
  };
  await moveTo(
    center.x + state.hole.radius * 2.2,
    center.z + state.hole.radius * 2.2,
  );
  await page.screenshot({ path: `reports/stack-${kind}-before.png` });
  await moveTo(center.x, center.z);
  await wait(3000);
  const after = await snapshot();
  const remaining = new Set(after.objects.map((object) => object.id));
  const collected = members.filter((object) => !remaining.has(object.id));
  if (collected.length < 2)
    throw new Error(`${kind}: 積み上げを複数飲み込めませんでした。`);
  if (after.rigidBodies !== after.objects.length)
    throw new Error(`${kind}: 回収後の剛体数が一致しません。`);
  await page.screenshot({ path: `reports/stack-${kind}-after.png` });
  const result = {
    stageId,
    kind,
    stackId: target.stackId,
    before: members.length,
    collected: collected.length,
    level: after.level,
    score: after.score,
    rigidBodies: after.rigidBodies,
  };
  results.push(result);
  console.log(JSON.stringify(result));
}

async function modelGallery() {
  // Render production placement and models separately; the game state stays read-only.
  await page.evaluate(async () => {
    const THREE = await import("/node_modules/.vite/deps/three.js");
    const { createStage } = await import("/src/game/stage.ts");
    const { objectVisual, disposeScene } = await import("/src/game/visuals.ts");
    const gallery = document.createElement("section");
    gallery.style.cssText =
      "position:fixed;inset:0;z-index:100;background:#f4f1e8;display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:16px;font:18px sans-serif;box-sizing:border-box";
    document.body.append(gallery);
    for (const [kind, stage, label, background] of [
      ["firewood", "mountain", "薪の束 / 20段", "#dbe8d1"],
      ["log", "mountain", "丸太 / 6段・各2本", "#dbe8d1"],
      ["burgerBox", "america", "紙箱 / 20段", "#e5ece9"],
      ["tire", "america", "タイヤ / 6段", "#e5ece9"],
    ]) {
      const card = document.createElement("div");
      card.style.cssText =
        "display:flex;flex-direction:column;background:white;border-radius:16px;overflow:hidden;min-height:0";
      const title = document.createElement("strong");
      title.textContent = label;
      title.style.cssText = "padding:16px;font-size:17px";
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
      const objects = createStage(42, stage).filter(
        (object) => object.kind === kind,
      );
      const pile = objects.filter(
        (object) => object.stackId === objects[0].stackId,
      );
      for (const object of pile) {
        const model = objectVisual(kind, stage);
        model.position.set(
          object.x - objects[0].x,
          object.y,
          object.z - objects[0].z,
        );
        model.rotation.y = object.yaw;
        scene.add(model);
      }
      const bounds = new THREE.Box3().setFromObject(scene);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const aspect = canvas.clientWidth / canvas.clientHeight;
      const extent = Math.max(
        size.y * 0.65,
        (Math.hypot(size.x, size.z) / aspect) * 0.68,
      );
      const camera = new THREE.OrthographicCamera(
        -extent * aspect,
        extent * aspect,
        extent,
        -extent,
        0.01,
        100,
      );
      camera.position.copy(center).add(new THREE.Vector3(8, 5, 12));
      camera.lookAt(center);
      renderer.render(scene, camera);
      const picture = document.createElement("img");
      picture.src = canvas.toDataURL();
      picture.style.cssText =
        "width:100%;flex:1;min-height:0;object-fit:contain";
      canvas.replaceWith(picture);
      disposeScene(scene);
      renderer.dispose();
    }
  });
  await page.screenshot({ path: "reports/stack-models-preview.png" });
}

try {
  await page.goto("http://localhost:5173/");
  await page.waitForFunction(() => window.__hole);
  for (const [stageId, count, kinds] of [
    ["mountain", 459, ["firewood", "log"]],
    ["america", 429, ["burgerBox", "tire"]],
  ]) {
    await page
      .getByRole("combobox", { name: "ステージ", exact: true })
      .selectOption(stageId);
    await page.waitForFunction(
      (id) => window.__hole?.snapshot().stageId === id,
      stageId,
    );
    const initial = await snapshot();
    if (initial.objects.length !== count)
      throw new Error(`${stageId}: 初期個数が違います。`);
    for (const kind of kinds) await inspectPile(stageId, kind);
  }
  await modelGallery();
  if (errors.length) throw new Error(errors.join("\n"));
  await writeFile(
    "reports/stacks-check.json",
    JSON.stringify(
      {
        date: "2026-10-15",
        browser: await browser.version(),
        input: "normal mouse drag; snapshot read-only",
        results,
        errors,
        iPhoneSafari: "未実施",
        WebKit: "未実施",
      },
      null,
      2,
    ) + "\n",
  );
} catch (error) {
  await writeFile(
    "reports/stacks-failure.json",
    JSON.stringify({ error: String(error), results, errors }, null, 2) + "\n",
  );
  await page.screenshot({ path: "reports/stacks-failure.png" });
  throw error;
} finally {
  await browser.close();
}
