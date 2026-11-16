import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { gameControl } from "./ui.mjs";
const directory = process.env.HOLE_REPORT_DIR || "reports/toy-music-2026-11-16";
await mkdir(directory, { recursive: true });
const url = process.env.HOLE_URL || "http://localhost:5176";
const browser = await chromium.launch({ headless: true, channel: "chromium" });
const report = {
  browser: await browser.version(),
  errors: [],
  iPhone: "未実施",
  WebKit: "未実施",
};
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (error) => report.errors.push(error.message));
await page.addInitScript(() => {
  window.__fileSources = [];
  const start = AudioBufferSourceNode.prototype.start;
  const stop = AudioBufferSourceNode.prototype.stop;
  AudioBufferSourceNode.prototype.start = function (...args) {
    if (this.buffer?.duration > 170) {
      const analyzer = this.context.createAnalyser();
      this.connect(analyzer);
      window.__fileSources.push({
        source: this,
        analyzer,
        offset: args[1],
        stopped: false,
      });
    }
    return start.apply(this, args);
  };
  AudioBufferSourceNode.prototype.stop = function (...args) {
    const record = window.__fileSources.find(
      (record) => record.source === this,
    );
    if (record) record.stopped = true;
    return stop.apply(this, args);
  };
});
const snapshot = () => page.evaluate(() => window.__hole.snapshot().audio);
const playing = () =>
  page.waitForFunction(() => window.__hole.snapshot().audio.music.active);
try {
  await page.goto(url);
  await page.waitForFunction(() => window.__hole);
  await page
    .getByRole("combobox", { name: "ステージ", exact: true })
    .selectOption("toys");
  await page.waitForFunction(() => window.__hole.snapshot().stageId === "toys");
  assert.equal((await snapshot()).state, "locked");
  await page.keyboard.press("ArrowRight");
  await playing();
  const initial = await snapshot();
  assert.equal(initial.music.source, "file");
  assert.equal(initial.music.title, "おもちゃのよふかし");
  assert(initial.music.duration > 177 && initial.music.duration < 179);
  assert(initial.music.loop && initial.music.voices === 1);
  await page.waitForFunction(() => {
    const record = window.__fileSources.at(-1);
    const samples = new Float32Array(record.analyzer.fftSize);
    record.analyzer.getFloatTimeDomainData(samples);
    return samples.some((value) => Math.abs(value) > 0.001);
  });
  report.signal = await page.evaluate(() => {
    const buffer = window.__fileSources.at(-1).source.buffer;
    let peak = 0,
      energy = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      for (const value of buffer.getChannelData(channel)) {
        peak = Math.max(peak, Math.abs(value));
        energy += value * value;
      }
    }
    return {
      duration: buffer.duration,
      channels: buffer.numberOfChannels,
      sampleRate: buffer.sampleRate,
      peak,
      rms: Math.sqrt(energy / buffer.length / buffer.numberOfChannels),
    };
  });
  await page.waitForTimeout(1200);
  await (await gameControl(page, "BGMを消す")).click();
  const stopped = (await snapshot()).music;
  await page.waitForTimeout(500);
  assert.equal((await snapshot()).music.position, stopped.position);
  assert.equal((await snapshot()).music.active, false);
  await (await gameControl(page, "BGMをつける")).click();
  await playing();
  assert((await snapshot()).music.position >= stopped.position);
  assert.equal(
    await page.evaluate(() => window.__fileSources.at(-1).offset),
    stopped.position,
  );
  assert.equal(
    await page.evaluate(
      () => window.__fileSources.filter((record) => !record.stopped).length,
    ),
    1,
  );
  report.pauseResume = {
    stoppedAt: stopped.position,
    resumed: (await snapshot()).music,
  };
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(100);
  assert.equal((await snapshot()).music.active, false);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await playing();
  report.syntheticVisibilityPauseResume = true;
  await (await gameControl(page, "効果音を消す")).click();
  assert.equal((await snapshot()).music.active, false);
  await (await gameControl(page, "効果音をつける")).click();
  await playing();
  report.globalMute = true;
  await page.screenshot({ path: `${directory}/toys.png` });
  await page
    .getByRole("combobox", { name: "ステージ", exact: true })
    .selectOption("plaza");
  await page.waitForFunction(
    () => window.__hole.snapshot().stageId === "plaza",
  );
  assert(
    await page.evaluate(() =>
      window.__fileSources.every((record) => record.stopped),
    ),
  );
  await page.keyboard.press("ArrowRight");
  await playing();
  assert.equal((await snapshot()).music.source, "synthesized");
  report.stageChangeStopsOldTrack = true;
  await page
    .getByRole("combobox", { name: "ステージ", exact: true })
    .selectOption("toys");
  await page.waitForFunction(() => window.__hole.snapshot().stageId === "toys");
  await page.keyboard.press("ArrowRight");
  await playing();
  await (await gameControl(page, "最初から遊ぶ")).click();
  await page.waitForFunction(
    () => window.__hole.snapshot().audio.state === "locked",
  );
  await page.keyboard.press("ArrowRight");
  await playing();
  assert((await snapshot()).music.position < 1);
  report.restartStartsAtBeginning = true;

  // A short decoded excerpt checks looping without waiting for the full song.
  report.shortFixtureLoop = await page.evaluate(async () => {
    const { RecordedMusic } = await import("/src/game/recorded-music.ts");
    const context = new AudioContext();
    await context.resume();
    const decode = context.decodeAudioData.bind(context);
    context.decodeAudioData = async (data) => {
      const decoded = await decode(data);
      const buffer = context.createBuffer(
        1,
        Math.round(context.sampleRate * 0.25),
        context.sampleRate,
      );
      buffer.copyToChannel(
        decoded.getChannelData(0).subarray(0, buffer.length),
        0,
      );
      return buffer;
    };
    const errors = [];
    const music = new RecordedMusic(context, context.destination, (error) =>
      errors.push(String(error)),
    );
    music.start();
    for (let attempt = 0; !music.snapshot().active && attempt < 100; attempt++)
      await new Promise((resolve) => setTimeout(resolve, 30));
    await new Promise((resolve) => setTimeout(resolve, 800));
    const state = music.snapshot();
    music.dispose();
    await context.close();
    return { ...state, errors };
  });
  assert(
    report.shortFixtureLoop.active &&
      report.shortFixtureLoop.starts === 1 &&
      report.shortFixtureLoop.position < 0.25,
  );
  assert.deepEqual(report.shortFixtureLoop.errors, []);

  let intercepted;
  const requested = new Promise((resolve) => {
    intercepted = resolve;
  });
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/audio/toy-night.m4a", async (route) => {
    intercepted();
    await gate;
    await route.continue();
  });
  await page.reload();
  await page.waitForFunction(() => window.__hole);
  await page
    .getByRole("combobox", { name: "ステージ", exact: true })
    .selectOption("toys");
  await page.waitForFunction(() => window.__hole.snapshot().stageId === "toys");
  await page.keyboard.press("ArrowRight");
  await requested;
  await (await gameControl(page, "効果音を消す")).click();
  release();
  await page.waitForFunction(() => window.__hole.snapshot().audio.music.loaded);
  assert.equal((await snapshot()).music.active, false);
  assert.equal((await snapshot()).music.starts, 0);
  await (await gameControl(page, "効果音をつける")).click();
  await playing();
  report.muteDuringLoadPreventsLatePlayback = true;
  report.final = await snapshot();
  const original = await readFile("temp/おもちゃのよふかし.m4a");
  const asset = await readFile("public/audio/toy-night.m4a");
  assert(original.equals(asset));
  report.asset = {
    bytes: asset.length,
    sha256: createHash("sha256").update(asset).digest("hex"),
    originalPreserved: true,
  };
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.failure = String(error);
  await page.screenshot({ path: `${directory}/failure.png` }).catch(() => {});
  throw error;
} finally {
  await writeFile(
    `${directory}/playback.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));
