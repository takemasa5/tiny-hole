import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { gameControl } from "./ui.mjs";
const directory =
  process.env.HOLE_REPORT_DIR || "reports/audio-effects-2026-11-15";
const url = process.env.HOLE_URL || "http://localhost:5176";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const report = {
  browser: await browser.version(),
  errors: [],
  music: [],
  WebKit: "未実施",
  iPhone: "未実施",
};
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (e) => report.errors.push(e.message));
const snapshot = () => page.evaluate(() => window.__hole.snapshot());
try {
  await page.goto(url);
  await page.waitForFunction(() => window.__hole);
  assert.equal((await snapshot()).audio.state, "locked");
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => window.__hole.snapshot().audio.music.active);
  assert((await snapshot()).audio.music.notesScheduled > 0);
  await (await gameControl(page, "BGMを消す")).click();
  assert.equal((await snapshot()).audio.music.active, false);
  assert.equal((await snapshot()).audio.enabled, true);
  await (await gameControl(page, "最初から遊ぶ")).click();
  await page.waitForFunction(
    () => window.__hole.snapshot().audio.state === "locked",
  );
  assert.equal((await snapshot()).audio.music.enabled, false);
  await (await gameControl(page, "BGMをつける")).click();
  await page.waitForFunction(() => window.__hole.snapshot().audio.music.active);
  await (await gameControl(page, "効果音を消す")).click();
  await page.waitForTimeout(100);
  let state = await snapshot();
  assert.equal(state.audio.music.active, false);
  assert.equal(state.audio.music.voices, 0);
  assert.equal(state.audio.voices, 0);
  await (await gameControl(page, "効果音をつける")).click();
  await page.waitForFunction(() => window.__hole.snapshot().audio.music.active);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(100);
  assert.equal((await snapshot()).audio.music.active, false);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(() => window.__hole.snapshot().audio.music.active);
  report.controls = {
    firstGesture: true,
    independentBGM: true,
    musicPreferenceSurvivesRestart: true,
    allMuteStopsSources: true,
    syntheticVisibilityPauseResume: true,
  };
  await page.goto(`${url}/checks/audio-effects.html`);
  await page.waitForFunction(() => window.__audioTrial);
  for (const stage of [
    "plaza",
    "mountain",
    "america",
    "egypt",
    "harbor",
    "toys",
    "office",
    "hell",
  ]) {
    await page.locator("#stage").selectOption(stage);
    await page.getByRole("button", { name: "BGMを再生", exact: true }).click();
    await page.waitForTimeout(1200);
    const audio = await page.evaluate(() => window.__audioTrial.snapshot());
    assert.equal(audio.error, "");
    assert(
      audio.music.active &&
        (audio.music.source === "file"
          ? audio.music.loaded && audio.music.duration > 0
          : audio.music.notesScheduled > 0) &&
        audio.music.voices <= 64,
    );
    report.music.push({ stage, ...audio.music });
  }
  for (const label of [
    "紙の回収",
    "木の回収",
    "金属の回収",
    "ガラスの回収",
    "石・建物の回収",
    "ヒーローの逃げ声",
    "怪獣の逃げ声",
    "人の逃げ声",
    "動物の鳴き声",
    "ロボットの声",
    "鬼の声",
    "亡者の声",
    "ドアが開く",
    "成長",
    "クリア",
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.waitForTimeout(1100);
  }
  report.audition = await page.evaluate(() => window.__audioTrial.snapshot());
  assert.equal(report.audition.played.flee, 7);
  assert.equal(report.audition.played.doorOpen, 1);
  assert.equal(Object.keys(report.audition.materials).length, 5);
  await page.screenshot({ path: `${directory}/audition.png` });
  report.offlineVoices = await page.evaluate(async () => {
    const { scheduleCharacterVoice } =
      await import("/src/game/character-voice.ts");
    const result = [];
    for (const kind of [
      "human",
      "hero",
      "monster",
      "robot",
      "animal",
      "ghost",
      "demon",
    ]) {
      const context = new OfflineAudioContext(1, 44100 * 2, 44100);
      scheduleCharacterVoice(context, context.destination, kind, 42);
      const buffer = await context.startRendering();
      const samples = buffer.getChannelData(0);
      let peak = 0,
        energy = 0,
        tail = 0;
      for (const sample of samples) {
        peak = Math.max(peak, Math.abs(sample));
        energy += sample * sample;
      }
      for (const sample of samples.slice(-4410))
        tail = Math.max(tail, Math.abs(sample));
      result.push({
        kind,
        peak,
        rms: Math.sqrt(energy / samples.length),
        tail,
        finite: samples.every(Number.isFinite),
      });
    }
    return result;
  });
  for (const voice of report.offlineVoices)
    assert(
      voice.finite &&
        voice.rms > 0.0005 &&
        voice.peak < 1 &&
        voice.tail < 0.00001,
      JSON.stringify(voice),
    );
  await page.goto(`${url}/checks/toy-battle.html?level=11&sound=on`);
  await page.waitForFunction(
    () =>
      window.__hole
        ?.snapshot()
        .objects.filter((o) => ["hero", "monster"].includes(o.id) && o.physical)
        .length === 2,
  );
  await page.waitForTimeout(500);
  await page.keyboard.down("ArrowUp");
  try {
    await page.waitForFunction(
      () => window.__hole.snapshot().audio.played.flee >= 2,
      null,
      { timeout: 4000 },
    );
  } finally {
    await page.keyboard.up("ArrowUp");
  }
  state = await snapshot();
  assert(state.rewardEffects.counts.flee >= 2);
  assert(
    state.objects
      .filter((o) => ["hero", "monster"].includes(o.id))
      .every((o) => o.motion === "fleeing"),
  );
  report.realToyFlee = { audio: state.audio, effects: state.rewardEffects };
  await page.screenshot({ path: `${directory}/toy-flee.png` });
  report.particlePool = await page.evaluate(async () => {
    const { RewardEffects } = await import("/src/game/reward-effects.ts");
    const { disposeScene } = await import("/src/game/visuals.ts");
    const effect = new RewardEffects();
    for (let i = 0; i < 100; i++) effect.emit("clear", 0, 0, 1, "#ffffff");
    const active = effect.snapshot();
    effect.update(2, 0, 0, 1);
    const expired = effect.snapshot();
    disposeScene(effect.group);
    return { active, expired };
  });
  assert.equal(report.particlePool.active.activeParticles, 384);
  assert.equal(report.particlePool.expired.activeParticles, 0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  report.reducedMotion = await page.evaluate(async () => {
    const { RewardEffects } = await import("/src/game/reward-effects.ts");
    const { disposeScene } = await import("/src/game/visuals.ts");
    const effect = new RewardEffects();
    effect.emit("clear", 0, 0, 1, "#ffffff");
    effect.update(0.1, 0, 0, 1);
    const state = effect.snapshot();
    disposeScene(effect.group);
    return state;
  });
  assert(
    report.reducedMotion.reducedMotion &&
      report.reducedMotion.activeParticles === 0,
  );
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.failure = error.stack;
  await page.screenshot({ path: `${directory}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await writeFile(
    `${directory}/results.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
