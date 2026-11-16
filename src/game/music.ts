import type { StageId } from "./stage";

type MusicVoice = "bass" | "keys" | "lead" | "bell";
export interface MusicNote {
  midi: number;
  duration: number;
  gain: number;
  voice: MusicVoice;
}
export interface MusicStyle {
  title: string;
  tempo: number;
  roots: readonly number[];
  minor: boolean;
  mellow: boolean;
}

// Original phrases and arrangements; no melody or lyrics from an existing song.
export const MUSIC_STYLES: Record<StageId, MusicStyle> = {
  plaza: {
    title: "ごきげんホール・パレード",
    tempo: 126,
    roots: [48, 45, 50, 55, 48, 45, 53, 55],
    minor: false,
    mellow: false,
  },
  mountain: {
    title: "木漏れ日のピクニック",
    tempo: 108,
    roots: [41, 45, 46, 48, 43, 48, 41, 48],
    minor: false,
    mellow: true,
  },
  america: {
    title: "ミッドナイト・ダイナー",
    tempo: 128,
    roots: [38, 45, 47, 43, 38, 42, 43, 45],
    minor: false,
    mellow: false,
  },
  egypt: {
    title: "砂漠のネオン・ラウンジ",
    tempo: 112,
    roots: [38, 46, 43, 45, 38, 43, 46, 45],
    minor: true,
    mellow: true,
  },
  harbor: {
    title: "波止場のブラス・ステップ",
    tempo: 118,
    roots: [34, 41, 43, 39, 34, 43, 39, 41],
    minor: false,
    mellow: false,
  },
  toys: {
    title: "夜ふかしのおもちゃ楽団",
    tempo: 100,
    roots: [38, 43, 36, 41, 46, 40, 45, 45],
    minor: true,
    mellow: true,
  },
  office: {
    title: "定時すぎのエレベーター",
    tempo: 104,
    roots: [40, 45, 38, 47, 40, 43, 45, 47],
    minor: true,
    mellow: true,
  },
  hell: {
    title: "鬼たちのハイカラ行進曲",
    tempo: 138,
    roots: [36, 44, 41, 43, 36, 39, 41, 43],
    minor: true,
    mellow: false,
  },
};
const PHRASE = [
  7, 9, 4, -1, 2, 4, 7, 4, 9, 7, 2, -1, 4, 2, 0, 2, 7, 12, 9, 7, 4, 2, 4, -1, 9,
  7, 4, 2, 0, -1, 2, 7,
];
const LOUNGE_PHRASE = [
  7, -1, 3, 2, 5, 3, 2, -1, 10, 7, 5, 3, 2, -1, 0, 2, 7, 10, 12, 10, 5, -1, 3,
  2, 7, 5, 3, -1, 2, 1, 0, -1,
];

export function musicNotes(stage: StageId, step: number): MusicNote[] {
  const style = MUSIC_STYLES[stage];
  const bar = Math.floor(step / 8);
  const beat = step % 8;
  const root = style.roots[bar % style.roots.length];
  const duration = 60 / style.tempo;
  const notes: MusicNote[] = [];
  if (beat % 2 === 0)
    notes.push({
      midi: root + [0, 7, 12, 7][beat / 2],
      duration: duration * 0.42,
      gain: 0.19,
      voice: "bass",
    });
  if ([0, 3, 6].includes(beat)) {
    for (const interval of [0, style.minor ? 3 : 4, 7, 10])
      notes.push({
        midi: root + 24 + interval,
        duration: duration * (style.mellow ? 0.85 : 0.4),
        gain: 0.05,
        voice: "keys",
      });
  }
  if (beat % 2 === 0) {
    const phrase = style.mellow ? LOUNGE_PHRASE : PHRASE;
    const degree = phrase[(bar * 4 + beat / 2) % phrase.length];
    if (degree >= 0)
      notes.push({
        midi: root + (style.mellow ? 12 : 24) + degree,
        duration: duration * (style.mellow ? 0.82 : 0.62),
        gain: style.mellow ? 0.13 : 0.09,
        voice: "lead",
      });
  }
  if (stage === "toys" && [1, 5, 7].includes(beat))
    notes.push({
      midi: root + 36 + (beat === 7 ? 7 : 0),
      duration: 0.14,
      gain: 0.045,
      voice: "bell",
    });
  return notes;
}

export class GameMusic {
  private output: GainNode;
  private noise: AudioBuffer;
  private timer?: ReturnType<typeof setInterval>;
  private voices = new Set<{
    source: AudioScheduledSourceNode;
    disconnect: () => void;
  }>();
  private next = 0;
  private step = 0;
  private bars = 0;
  private starts = 0;
  private enabled = true;
  private disposed = false;
  private notesScheduled = 0;

  constructor(
    private context: AudioContext,
    output: AudioNode,
    private stage: StageId,
    private onError: (error: unknown) => void,
  ) {
    this.output = context.createGain();
    this.output.gain.value = 0.35;
    this.output.connect(output);
    this.noise = context.createBuffer(
      1,
      context.sampleRate * 0.3,
      context.sampleRate,
    );
    const channel = this.noise.getChannelData(0);
    let seed = 127;
    for (let i = 0; i < channel.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      channel[i] = seed / 2147483648 - 1;
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) this.start();
    else this.stop();
  }

  start() {
    if (
      !this.enabled ||
      this.disposed ||
      this.timer ||
      this.context.state !== "running"
    )
      return;
    this.next = this.context.currentTime + 0.04;
    this.starts++;
    this.schedule();
    this.timer = setInterval(() => {
      try {
        this.schedule();
      } catch (error) {
        this.stop();
        this.onError(error);
      }
    }, 70);
  }

  private schedule() {
    if (this.context.state !== "running") return;
    const interval = 30 / MUSIC_STYLES[this.stage].tempo;
    if (this.next < this.context.currentTime - 0.2)
      this.next = this.context.currentTime + 0.04;
    while (this.next < this.context.currentTime + 0.18) {
      for (const note of musicNotes(this.stage, this.step))
        this.tone(note, this.next);
      this.drums(this.step, this.next);
      this.next += interval;
      this.step = (this.step + 1) % 128;
      if (this.step % 8 === 0) this.bars++;
    }
  }

  private track(source: AudioScheduledSourceNode, disconnect: () => void) {
    const voice = { source, disconnect };
    this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      disconnect();
    };
  }

  private tone(note: MusicNote, start: number) {
    if (this.voices.size >= 64) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const frequency = 440 * 2 ** ((note.midi - 69) / 12);
    oscillator.type =
      note.voice === "bass"
        ? "triangle"
        : note.voice === "lead"
          ? "sawtooth"
          : "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    filter.type = "lowpass";
    filter.frequency.value =
      note.voice === "bass"
        ? 700
        : note.voice === "lead"
          ? MUSIC_STYLES[this.stage].mellow
            ? 1200
            : 2400
          : 4500;
    filter.Q.value = note.voice === "lead" ? 1.5 : 0.6;
    const attack =
      note.voice === "lead" && MUSIC_STYLES[this.stage].mellow ? 0.055 : 0.008;
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(note.gain, start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
    oscillator.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.output);
    oscillator.start(start);
    oscillator.stop(start + note.duration + 0.01);
    this.notesScheduled++;
    this.track(oscillator, () => {
      oscillator.disconnect();
      filter.disconnect();
      envelope.disconnect();
    });
  }

  private drums(step: number, start: number) {
    if (this.voices.size >= 64) return;
    const beat = step % 8;
    if (beat === 0 || beat === 4) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.frequency.setValueAtTime(105, start);
      oscillator.frequency.exponentialRampToValueAtTime(40, start + 0.13);
      gain.gain.setValueAtTime(0.22, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      oscillator.connect(gain);
      gain.connect(this.output);
      oscillator.start(start);
      oscillator.stop(start + 0.15);
      this.track(oscillator, () => {
        oscillator.disconnect();
        gain.disconnect();
      });
    }
    if (this.voices.size >= 60) return;
    const snare = beat === 2 || beat === 6;
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    const filter = this.context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = snare ? 900 : 6500;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(snare ? 0.085 : beat % 2 ? 0.028 : 0.017, start);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + (snare ? 0.13 : 0.045),
    );
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.output);
    source.start(start, 0, snare ? 0.15 : 0.06);
    this.track(source, () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    });
  }

  duck() {
    const now = this.context.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setTargetAtTime(0.12, now, 0.02);
    this.output.gain.setTargetAtTime(0.35, now + 0.45, 0.15);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    for (const voice of this.voices) {
      voice.source.onended = null;
      voice.source.stop();
      voice.disconnect();
    }
    this.voices.clear();
  }

  snapshot() {
    return {
      enabled: this.enabled,
      source: "synthesized" as const,
      active: !!this.timer,
      title: MUSIC_STYLES[this.stage].title,
      tempo: MUSIC_STYLES[this.stage].tempo,
      voices: this.voices.size,
      bars: this.bars,
      starts: this.starts,
      notesScheduled: this.notesScheduled,
    };
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.output.disconnect();
  }
}
