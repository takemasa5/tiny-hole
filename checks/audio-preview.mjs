import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const directory =
  process.env.HOLE_REPORT_DIR || "reports/audio-effects-2026-11-15";
const url = process.env.HOLE_URL || "http://localhost:5176";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium" });
try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => console.error(error.message));
  page.setDefaultTimeout(45000);
  await page.addInitScript(() => {
    const connect = AudioNode.prototype.connect;
    const contexts = [];
    AudioNode.prototype.connect = function (...args) {
      if (
        this.context instanceof AudioContext &&
        args[0] === this.context.destination
      ) {
        const sink = this.context.createMediaStreamDestination();
        connect.call(this, sink);
        contexts.push({ context: this.context, sink });
      }
      return connect.apply(this, args);
    };
    window.__recordGeneratedAudio = {
      start() {
        const { sink } = contexts.at(-1);
        const recorder = new MediaRecorder(sink.stream);
        const chunks = [];
        recorder.ondataavailable = (event) => chunks.push(event.data);
        recorder.start();
        this.stop = () =>
          new Promise((resolve) => {
            recorder.onstop = async () => {
              const data = await new Blob(chunks).arrayBuffer();
              const decoder = new AudioContext();
              const buffer = await decoder.decodeAudioData(data);
              await decoder.close();
              const offline = new OfflineAudioContext(
                1,
                Math.ceil(buffer.duration * 22050),
                22050,
              );
              const source = offline.createBufferSource();
              source.buffer = buffer;
              source.connect(offline.destination);
              source.start();
              const mono = (await offline.startRendering()).getChannelData(0);
              const wav = new ArrayBuffer(44 + mono.length * 2);
              const view = new DataView(wav);
              const text = (offset, value) =>
                [...value].forEach((character, i) =>
                  view.setUint8(offset + i, character.charCodeAt(0)),
                );
              text(0, "RIFF");
              view.setUint32(4, wav.byteLength - 8, true);
              text(8, "WAVE");
              text(12, "fmt ");
              view.setUint32(16, 16, true);
              view.setUint16(20, 1, true);
              view.setUint16(22, 1, true);
              view.setUint32(24, 22050, true);
              view.setUint32(28, 44100, true);
              view.setUint16(32, 2, true);
              view.setUint16(34, 16, true);
              text(36, "data");
              view.setUint32(40, mono.length * 2, true);
              let peak = 0,
                energy = 0;
              for (let i = 0; i < mono.length; i++) {
                peak = Math.max(peak, Math.abs(mono[i]));
                energy += mono[i] ** 2;
                view.setInt16(
                  44 + i * 2,
                  Math.round(Math.max(-1, Math.min(1, mono[i])) * 32767),
                  true,
                );
              }
              let binary = "";
              const bytes = new Uint8Array(wav);
              for (let i = 0; i < bytes.length; i += 8192)
                binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
              resolve({
                base64: btoa(binary),
                seconds: mono.length / 22050,
                peak,
                rms: Math.sqrt(energy / mono.length),
              });
            };
            recorder.stop();
          });
      },
    };
  });
  await page.goto(`${url}/checks/audio-effects.html`);
  await page.getByRole("button", { name: "BGMを再生", exact: true }).click();
  await page.waitForFunction(() => window.__audioTrial.snapshot().music.active);
  await page.evaluate(() => window.__recordGeneratedAudio.start());
  await page.waitForTimeout(20000);
  const save = async (name) => {
    const { base64, ...metrics } = await page.evaluate(() =>
      window.__recordGeneratedAudio.stop(),
    );
    await writeFile(`${directory}/${name}.wav`, Buffer.from(base64, "base64"));
    return metrics;
  };
  const report = { music: await save("toy-bgm-preview") };
  await page.getByRole("button", { name: "すべて停止", exact: true }).click();
  await page.evaluate(() => window.__recordGeneratedAudio.start());
  for (const label of [
    "木の回収",
    "金属の回収",
    "ガラスの回収",
    "ヒーローの逃げ声",
    "怪獣の逃げ声",
    "人の逃げ声",
    "ドアが開く",
    "成長",
    "クリア",
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.waitForTimeout(1300);
  }
  report.effects = await save("effects-preview");
  await writeFile(
    `${directory}/audio-metrics.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
