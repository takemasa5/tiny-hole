import { schedulePersonCry } from "./person-cry";
import { AMERICAN_VOICE_URL, scheduleAmericanCry } from "./falling-voice";

type ToneEvent = "pickup" | "growth" | "clear" | "shot" | "tanukiCry";
export type SoundEvent = ToneEvent | "personCry" | "americanCry";

export interface SoundNote {
  frequency: number;
  endFrequency: number;
  delay: number;
  duration: number;
  gain: number;
  type: OscillatorType;
}

export function soundNotes(event: ToneEvent, level: number): SoundNote[] {
  if (event === "tanukiCry")
    return [
      {
        frequency: 920,
        endFrequency: 400,
        delay: 0,
        duration: 0.5,
        gain: 0.14,
        type: "sine",
      },
      {
        frequency: 1460,
        endFrequency: 700,
        delay: 0.05,
        duration: 0.4,
        gain: 0.035,
        type: "triangle",
      },
    ];
  if (event === "shot")
    return [
      {
        frequency: 180,
        endFrequency: 55,
        delay: 0,
        duration: 0.055,
        gain: 0.035,
        type: "triangle",
      },
    ];
  if (event === "pickup")
    return [
      {
        frequency: 420 + level * 25,
        endFrequency: 160 + level * 12,
        delay: 0,
        duration: 0.12,
        gain: 0.12,
        type: "sine",
      },
    ];
  const frequencies =
    event === "growth"
      ? [523.25, 659.25, 783.99, 1046.5]
      : [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
  return frequencies.map((frequency, index) => ({
    frequency,
    endFrequency: frequency,
    delay: index * 0.075,
    duration: event === "growth" ? 0.28 : 0.45,
    gain: 0.075,
    type: "triangle",
  }));
}

export function scheduleNote(
  context: BaseAudioContext,
  output: AudioNode,
  note: SoundNote,
) {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  const start = context.currentTime + note.delay;
  oscillator.type = note.type;
  oscillator.frequency.setValueAtTime(note.frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(
    note.endFrequency,
    start + note.duration,
  );
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(note.gain, start + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
  oscillator.connect(envelope);
  envelope.connect(output);
  oscillator.start(start);
  oscillator.stop(start + note.duration + 0.015);
  return { oscillator, envelope };
}

export class GameSounds {
  private context?: AudioContext;
  private master?: GainNode;
  private voices = new Set<AudioScheduledSourceNode>();
  private lastShot = -Infinity;
  private lastPickup = -Infinity;
  private lastPersonCry = -Infinity;
  private lastAmericanCry = -Infinity;
  private americanBuffer?: AudioBuffer;
  private americanLoad?: Promise<AudioBuffer | undefined>;
  private voiceEpoch = 0;
  private lastTanukiCry = -Infinity;
  private disposed = false;
  private paused = false;
  private error = "";
  private played = {
    pickup: 0,
    growth: 0,
    clear: 0,
    personCry: 0,
    americanCry: 0,
    shot: 0,
    tanukiCry: 0,
  };

  constructor(
    private enabled: boolean,
    private onError: (message: string) => void,
    private usesAmericanVoice = false,
  ) {}

  private report(error: unknown) {
    console.warn("効果音を再生できませんでした。", error);
    this.error = "音を再生できません。音ボタンで再試行できます。";
    if (!this.disposed) this.onError(this.error);
  }

  unlock() {
    if (this.disposed || this.paused || !this.enabled) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = 0.65;
        const compressor = this.context.createDynamicsCompressor();
        this.master.connect(compressor);
        compressor.connect(this.context.destination);
      }
      if (this.usesAmericanVoice) void this.loadAmericanVoice();
      if (this.context.state !== "running")
        void this.context
          .resume()
          .then(() => {
            if (!this.disposed) {
              this.error = "";
              this.onError("");
            }
          })
          .catch((error: unknown) => this.report(error));
      else if (this.error) {
        this.error = "";
        this.onError("");
      }
    } catch (error) {
      this.report(error);
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        enabled ? 0.65 : 0,
        this.context.currentTime,
        0.015,
      );
    if (enabled) this.unlock();
    else this.stopVoices();
  }

  play(event: SoundEvent, level: number) {
    if (
      !this.enabled ||
      this.paused ||
      this.context?.state !== "running" ||
      !this.master
    )
      return;
    if (event === "pickup" && this.context.currentTime - this.lastPickup < 0.09)
      return;
    if (
      event === "personCry" &&
      this.context.currentTime - this.lastPersonCry < 0.18
    )
      return;
    if (event === "shot" && this.context.currentTime - this.lastShot < 0.12)
      return;
    if (
      event === "americanCry" &&
      this.context.currentTime - this.lastAmericanCry < 0.18
    )
      return;
    if (
      event === "tanukiCry" &&
      this.context.currentTime - this.lastTanukiCry < 0.18
    )
      return;
    try {
      if (event === "americanCry") {
        this.lastAmericanCry = this.context.currentTime;
        void this.playAmericanCry();
        return;
      }
      if (event === "shot") this.lastShot = this.context.currentTime;
      if (event === "tanukiCry") this.lastTanukiCry = this.context.currentTime;
      if (event === "personCry") {
        if (this.voices.size >= 24) return;
        const voice = schedulePersonCry(this.context, this.master);
        this.trackVoice(voice.oscillator, voice.disconnect);
        this.lastPersonCry = this.context.currentTime;
        this.played.personCry++;
        return;
      }
      if (event === "pickup") this.lastPickup = this.context.currentTime;
      for (const note of soundNotes(event, level)) {
        if (this.voices.size >= 24) break;
        const { oscillator, envelope } = scheduleNote(
          this.context,
          this.master,
          note,
        );
        this.trackVoice(oscillator, () => {
          oscillator.disconnect();
          envelope.disconnect();
        });
      }
      this.played[event]++;
    } catch (error) {
      this.report(error);
    }
  }

  private loadAmericanVoice(): Promise<AudioBuffer | undefined> {
    if (this.americanBuffer) return Promise.resolve(this.americanBuffer);
    if (this.americanLoad) return this.americanLoad;
    const context = this.context;
    if (!context) return Promise.resolve(undefined);
    this.americanLoad = fetch(AMERICAN_VOICE_URL)
      .then((response) => {
        if (!response.ok)
          throw new Error(`英語の声を読み込めませんでした: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        if (this.disposed) return undefined;
        this.americanBuffer = buffer;
        return buffer;
      })
      .catch((error: unknown) => {
        this.americanLoad = undefined;
        if (!this.disposed) this.report(error);
        return undefined;
      });
    return this.americanLoad;
  }

  private async playAmericanCry() {
    const context = this.context;
    const master = this.master;
    const epoch = this.voiceEpoch;
    const buffer = await this.loadAmericanVoice();
    if (
      !context ||
      !master ||
      !buffer ||
      epoch !== this.voiceEpoch ||
      this.disposed ||
      !this.enabled ||
      this.paused ||
      context.state !== "running" ||
      this.voices.size >= 24
    )
      return;
    try {
      const voice = scheduleAmericanCry(context, master, buffer);
      this.trackVoice(voice.source, voice.disconnect);
      this.played.americanCry++;
    } catch (error) {
      this.report(error);
    }
  }

  private trackVoice(
    oscillator: AudioScheduledSourceNode,
    disconnect: () => void,
  ) {
    this.voices.add(oscillator);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
      disconnect();
    };
  }

  private stopVoices() {
    this.voiceEpoch++;
    this.voices.forEach((voice) => voice.stop());
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) {
      this.stopVoices();
      if (this.context?.state === "running")
        void this.context
          .suspend()
          .catch((error: unknown) => this.report(error));
    }
  }

  snapshot() {
    return {
      enabled: this.enabled,
      state: this.context?.state ?? "locked",
      voices: this.voices.size,
      error: this.error,
      played: { ...this.played },
    };
  }

  dispose() {
    this.disposed = true;
    this.stopVoices();
    if (this.context)
      void this.context.close().catch((error: unknown) => this.report(error));
  }
}
