export const TOY_MUSIC_TITLE = "おもちゃのよふかし";
export const TOY_MUSIC_URL = `${import.meta.env.BASE_URL}audio/toy-night.m4a`;
const VOLUME = 0.12;

export class RecordedMusic {
  private output: GainNode;
  private buffer?: AudioBuffer;
  private source?: AudioBufferSourceNode;
  private loading?: Promise<void>;
  private enabled = true;
  private requested = false;
  private disposed = false;
  private offset = 0;
  private startedAt = 0;
  private starts = 0;

  constructor(
    private context: AudioContext,
    output: AudioNode,
    private onError: (error: unknown) => void,
  ) {
    this.output = context.createGain();
    this.output.gain.value = VOLUME;
    this.output.connect(output);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) this.start();
    else this.stop();
  }

  start() {
    if (!this.enabled || this.disposed || this.context.state !== "running")
      return;
    this.requested = true;
    if (this.source) return;
    if (this.buffer) {
      this.playBuffer();
      return;
    }
    if (this.loading) return;
    this.loading = fetch(TOY_MUSIC_URL)
      .then((response) => {
        if (!response.ok)
          throw new Error(
            `おもちゃのBGMを読み込めませんでした: ${response.status}`,
          );
        return response.arrayBuffer();
      })
      .then((data) =>
        this.disposed ? undefined : this.context.decodeAudioData(data),
      )
      .then((buffer) => {
        if (this.disposed || !buffer) return;
        if (!Number.isFinite(buffer.duration) || buffer.duration <= 0)
          throw new Error("おもちゃのBGMに再生できる音声がありません。");
        this.buffer = buffer;
        if (this.requested && this.enabled && this.context.state === "running")
          this.playBuffer();
      })
      .catch((error: unknown) => {
        if (!this.disposed) this.onError(error);
      })
      .finally(() => {
        this.loading = undefined;
      });
  }

  private playBuffer() {
    if (!this.buffer || this.source) return;
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.loop = true;
    source.connect(this.output);
    source.start(this.context.currentTime, this.offset);
    this.startedAt = this.context.currentTime;
    this.source = source;
    this.starts++;
  }

  private position() {
    if (!this.buffer) return 0;
    return (
      (this.offset +
        (this.source ? this.context.currentTime - this.startedAt : 0)) %
      this.buffer.duration
    );
  }

  stop() {
    this.requested = false;
    this.offset = this.position();
    this.source?.stop();
    this.source?.disconnect();
    this.source = undefined;
  }

  duck() {
    const now = this.context.currentTime;
    this.output.gain.cancelScheduledValues(now);
    this.output.gain.setTargetAtTime(VOLUME * 0.34, now, 0.02);
    this.output.gain.setTargetAtTime(VOLUME, now + 0.45, 0.15);
  }

  snapshot() {
    return {
      enabled: this.enabled,
      active: !!this.source,
      source: "file" as const,
      title: TOY_MUSIC_TITLE,
      tempo: null,
      voices: this.source ? 1 : 0,
      starts: this.starts,
      loaded: !!this.buffer,
      loading: !!this.loading,
      duration: this.buffer?.duration ?? 0,
      position: this.position(),
      loop: true,
      volume: VOLUME,
      url: TOY_MUSIC_URL,
    };
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.buffer = undefined;
    this.output.disconnect();
  }
}
