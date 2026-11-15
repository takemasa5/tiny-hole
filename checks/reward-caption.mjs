import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ headless: true, channel: "chromium" });
try {
  const page = await browser.newPage();
  await page.goto(process.env.HOLE_URL || "http://localhost:5176/");
  await page.waitForFunction(() => window.__hole);
  const result = await page.evaluate(async () => {
    const { RewardEffects } = await import("/src/game/reward-effects.ts");
    const { disposeScene } = await import("/src/game/visuals.ts");
    const effect = new RewardEffects();
    const caption = effect.group.children.find((object) => object.isSprite);
    const texts = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      texts.push(text);
      return original.call(this, text, ...args);
    };
    try {
      for (const combo of [1, 3, 30, 300]) {
        effect.emit("pickup", 0, 0, 1, "#ffee33", combo);
        effect.update(0.02, 0, 0, 1);
        if (caption.visible) throw new Error("回収時に文字が表示されます。");
      }
      const pickup = { ...effect.snapshot(), texts: [...texts] };
      effect.emit("door", 0, 0, 1, "#ffffff");
      effect.update(0.02, 0, 0, 1);
      const doorVisible = caption.visible;
      effect.emit("clear", 0, 0, 1, "#ffffff");
      effect.update(0.02, 0, 0, 1);
      return {
        pickup,
        doorVisible,
        clearVisible: caption.visible,
        texts: [...texts],
      };
    } finally {
      CanvasRenderingContext2D.prototype.fillText = original;
      disposeScene(effect.group);
    }
  });
  assert(result.pickup.activeParticles > 0);
  assert.deepEqual(result.pickup.texts, []);
  assert(result.doorVisible && result.clearVisible);
  assert.deepEqual(result.texts, ["OPEN!", "CLEAR!"]);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
