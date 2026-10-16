import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const kind =
  process.argv.find((arg) => arg.startsWith("--kind="))?.split("=")[1] ??
  "person";
const stageId = {
  person: "plaza",
  egyptian: "egypt",
  american: "america",
  tanuki: "mountain",
}[kind];
if (!stageId)
  throw new Error(
    "--kind はperson・egyptian・american・tanukiから選んでください。",
  );
const soundEvent =
  kind === "tanuki"
    ? "tanukiCry"
    : kind === "american"
      ? "americanCry"
      : "personCry";
const artifact =
  kind === "tanuki"
    ? "tanuki-cry"
    : kind === "american"
      ? "american-fall-clear"
      : `person-cry-receding-${kind}`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:5173/");
  await page.waitForFunction(() => window.__hole);
  if (stageId !== "plaza") {
    await page
      .getByRole("combobox", { name: "ステージ", exact: true })
      .selectOption(stageId);
    await page.waitForFunction(
      (id) => window.__hole?.snapshot().stageId === id,
      stageId,
    );
  }
  await page.waitForTimeout(500);
  const snapshot = () => page.evaluate(() => window.__hole.snapshot());
  const initial = await snapshot();
  let audioLoadFailureRecovered;
  if (kind === "american") {
    await page.route("**/audio/american-fall.wav", (route) =>
      route.fulfill({ status: 404, body: "test missing audio" }),
    );
    await page.keyboard.press("ArrowRight", { delay: 50 });
    await page.waitForFunction(() => !!window.__hole?.snapshot().audio.error);
    await page.unroute("**/audio/american-fall.wav");
    await page.getByRole("button", { name: "効果音を消す" }).click();
    await page.getByRole("button", { name: "効果音をつける" }).click();
    await page.waitForFunction(
      () => window.__hole?.snapshot().audio.error === "",
    );
    audioLoadFailureRecovered = true;
  }

  async function catchActor() {
    const start = await snapshot();
    const target = start.objects
      .filter((object) => object.kind === kind && object.motion !== "falling")
      .sort(
        (a, b) =>
          Math.hypot(a.position.x - start.hole.x, a.position.z - start.hole.z) -
          Math.hypot(b.position.x - start.hole.x, b.position.z - start.hole.z),
      )[0];
    if (!target) throw new Error(`追いかける${kind}がいません。`);
    const held = new Set();
    async function steer(keys) {
      for (const key of held)
        if (!keys.has(key)) {
          await page.keyboard.up(key);
          held.delete(key);
        }
      for (const key of keys)
        if (!held.has(key)) {
          await page.keyboard.down(key);
          held.add(key);
        }
    }
    for (let step = 0; step < 80; step++) {
      const state = await snapshot();
      const person = state.objects.find((object) => object.id === target.id);
      if (!person) {
        await steer(new Set());
        return target.id;
      }
      // Follow horizontal momentum until the entire body is below the floor.
      if (person.top < -0.15) {
        await steer(new Set());
        await page.waitForTimeout(200);
        continue;
      }
      const dx = person.position.x + person.velocity.x * 0.08 - state.hole.x;
      const dz = person.position.z + person.velocity.z * 0.08 - state.hole.z;
      const keys = new Set();
      if (Math.abs(dx) > Math.abs(dz) * 0.414) keys.add(dx > 0 ? "d" : "a");
      if (Math.abs(dz) > Math.abs(dx) * 0.414) keys.add(dz > 0 ? "s" : "w");
      await steer(keys);
      await page.waitForTimeout(70);
    }
    await steer(new Set());
    const failed = await snapshot();
    throw new Error(
      `通常操作で人を飲み込めませんでした。${JSON.stringify({
        seed: failed.seed,
        hole: failed.hole,
        target: failed.objects.find((object) => object.id === target.id),
        audio: failed.audio,
      })}`,
    );
  }

  const firstActor = await catchActor();
  const audible = await snapshot();
  if (audible.audio.played[soundEvent] < 1 || audible.collectedMoving < 1)
    throw new Error("対象の落下と声の再生を確認できませんでした。");
  if (kind === "tanuki" && audible.audio.played.personCry !== 0)
    throw new Error("たぬきに人の声が鳴っています。");
  if (kind === "american" && audible.audio.played.personCry !== 0)
    throw new Error("アメリカの人に「あー」が鳴っています。");
  await page.waitForTimeout(1900);
  // American gunfire continues; observe a quiet interval after the voice has ended.
  await page.waitForFunction(
    () => window.__hole?.snapshot().audio.voices === 0,
    undefined,
    { timeout: 1200 },
  );
  await page.getByRole("button", { name: "効果音を消す" }).click();
  const beforeMute = await snapshot();
  const mutedActor = await catchActor();
  const muted = await snapshot();
  if (
    muted.audio.played[soundEvent] !== beforeMute.audio.played[soundEvent] ||
    muted.collectedMoving <= beforeMute.collectedMoving
  )
    throw new Error("音OFFで人の声が再生されるか、回収ができません。");

  const waveform = await page.evaluate(async (event) => {
    const { schedulePersonCry, PERSON_CRY_DURATION } =
      await import("/src/game/person-cry.ts");
    const { soundNotes, scheduleNote } = await import("/src/game/sound.ts");
    const {
      scheduleAmericanCry,
      AMERICAN_VOICE_URL,
      fallingVoiceEnvelope,
      americanVoiceEnvelope,
    } = await import("/src/game/falling-voice.ts");
    const durationLimit =
      event === "americanCry"
        ? 2
        : event === "tanukiCry"
          ? 0.5
          : PERSON_CRY_DURATION;
    const context = new OfflineAudioContext(
      1,
      Math.ceil((durationLimit + 0.3) * 48000),
      48000,
    );
    const master = context.createGain();
    master.gain.value = 0.65;
    const compressor = context.createDynamicsCompressor();
    master.connect(compressor);
    compressor.connect(context.destination);
    let duration = durationLimit;
    const voices =
      event === "americanCry"
        ? await (async () => {
            const response = await fetch(AMERICAN_VOICE_URL);
            if (!response.ok) throw new Error("英語の声を読めません。");
            const speech = await context.decodeAudioData(
              await response.arrayBuffer(),
            );
            const voice = scheduleAmericanCry(context, master, speech);
            duration = voice.duration;
            return [voice];
          })()
        : event === "tanukiCry"
          ? soundNotes(event, 1).map((note) => {
              const voice = scheduleNote(context, master, note);
              return {
                disconnect() {
                  voice.oscillator.disconnect();
                  voice.envelope.disconnect();
                },
              };
            })
          : [schedulePersonCry(context, master)];
    const buffer = await context.startRendering();
    voices.forEach((voice) => voice.disconnect());
    const samples = buffer.getChannelData(0);
    let energy = 0;
    let peak = 0;
    let tail = 0;
    let sustainedEnergy = 0,
      sustainedSamples = 0;
    let earlyEnergy = 0,
      earlySamples = 0,
      lateEnergy = 0,
      lateSamples = 0;
    samples.forEach((value, index) => {
      energy += value * value;
      peak = Math.max(peak, Math.abs(value));
      if (index > 48000 * (duration + 0.08))
        tail = Math.max(tail, Math.abs(value));
      if (index > 48000 * 0.6 && index < 48000 * 1.3) {
        sustainedEnergy += value * value;
        sustainedSamples++;
      }
      if (index > 48000 * duration * 0.15 && index < 48000 * duration * 0.35) {
        earlyEnergy += value * value;
        earlySamples++;
      }
      if (index > 48000 * duration * 0.65 && index < 48000 * duration * 0.82) {
        lateEnergy += value * value;
        lateSamples++;
      }
    });
    const reference = new OfflineAudioContext(1, 48000 * 2, 48000);
    const envelope =
      event === "americanCry"
        ? americanVoiceEnvelope(reference, reference.destination, 1.6)
        : fallingVoiceEnvelope(reference, reference.destination, 1.6, 0.9);
    const tone = reference.createOscillator();
    tone.frequency.value = 440;
    tone.connect(envelope);
    tone.start();
    tone.stop(1.6);
    const referenceSamples = (await reference.startRendering()).getChannelData(
      0,
    );
    const rms = (from, to) => {
      const segment = referenceSamples.slice(
        Math.round(from * 48000),
        Math.round(to * 48000),
      );
      return Math.sqrt(
        segment.reduce((sum, value) => sum + value * value, 0) / segment.length,
      );
    };
    const distanceRatio = rms(1.0, 1.3) / rms(0.15, 0.4);
    tone.disconnect();
    envelope.disconnect();
    return {
      samples: Array.from(samples),
      rms: Math.sqrt(energy / samples.length),
      peak,
      tail,
      duration,
      earlyRms: Math.sqrt(earlyEnergy / Math.max(1, earlySamples)),
      lateRms: Math.sqrt(lateEnergy / Math.max(1, lateSamples)),
      distanceRatio,
      sustainedRms: Math.sqrt(sustainedEnergy / Math.max(1, sustainedSamples)),
    };
  }, soundEvent);
  if (waveform.rms < 0.001 || waveform.peak >= 1 || waveform.tail > 0.001)
    throw new Error("声が無音、振幅過大、または終了後に音が残っています。");
  if (soundEvent === "personCry" && waveform.sustainedRms < 0.001)
    throw new Error("長い母音の途中が無音です。");
  if (waveform.distanceRatio > (kind === "american" ? 0.85 : 0.35))
    throw new Error("落下音の後半が十分に減衰していません。");
  if (soundEvent === "personCry" && waveform.lateRms >= waveform.earlyRms * 0.6)
    throw new Error("声の後半の音量が下がっていません。");
  await mkdir("reports", { recursive: true });
  const wav = Buffer.alloc(44 + waveform.samples.length * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(48000, 24);
  wav.writeUInt32LE(96000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  waveform.samples.forEach((value, index) =>
    wav.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, value)) * 32767),
      44 + index * 2,
    ),
  );
  await writeFile(`reports/${artifact}.wav`, wav);
  if (errors.length) throw new Error(errors.join("\n"));
  const report = {
    date: "2026-10-15",
    browser: await browser.version(),
    seed: initial.seed,
    kind,
    soundEvent,
    audioLoadFailureRecovered,
    firstActor,
    mutedActor,
    cryOnFall: true,
    mutedActorStillCollected: true,
    muteSuppressesCry: true,
    voicesReleased: true,
    cryCount: audible.audio.played[soundEvent],
    waveform: {
      duration: waveform.duration,
      earlyRms: waveform.earlyRms,
      lateRms: waveform.lateRms,
      distanceRatio: waveform.distanceRatio,
      sustainedRms: waveform.sustainedRms,
      rms: waveform.rms,
      peak: waveform.peak,
      tail: waveform.tail,
    },
    iPhoneSafari: "未実施",
    errors,
  };
  await writeFile(
    `reports/${artifact}-check.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
