import { afterEach, describe, expect, it, vi } from "vitest";
import { RecordedMusic } from "../src/game/recorded-music";

function fixture() {
  const voices: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    loop: boolean;
  }[] = [];
  const context = {
    state: "running",
    currentTime: 0,
    createGain: () => ({
      gain: {
        value: 0,
        cancelScheduledValues: vi.fn(),
        setTargetAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    decodeAudioData: vi.fn().mockResolvedValue({ duration: 10 }),
    createBufferSource: () => {
      const voice = {
        buffer: undefined,
        loop: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      voices.push(voice);
      return voice;
    },
  };
  const onError = vi.fn();
  const music = new RecordedMusic(
    context as unknown as AudioContext,
    {} as AudioNode,
    onError,
  );
  return { context, voices, onError, music };
}
const response = () => new Response(new ArrayBuffer(8));
afterEach(() => vi.unstubAllGlobals());

describe("提供されたBGMの再生", () => {
  it("繰り返しONでも重複再生せず、停止・再開は曲の続きから行う", async () => {
    const fetch = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetch);
    const { music, context, voices } = fixture();
    music.start();
    music.start();
    await vi.waitFor(() => expect(music.snapshot().active).toBe(true));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(voices).toHaveLength(1);
    expect(voices[0].loop).toBe(true);
    context.currentTime = 13;
    expect(music.snapshot().position).toBe(3);
    music.stop();
    context.currentTime = 20;
    expect(music.snapshot().position).toBe(3);
    expect(voices[0].stop).toHaveBeenCalledTimes(1);
    music.start();
    expect(voices[1].start).toHaveBeenCalledWith(20, 3);
    expect(fetch).toHaveBeenCalledTimes(1);
    music.dispose();
  });
  it("読み込み中に全音を止めると、完了後も勝手に再生しない", async () => {
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const { music, voices } = fixture();
    music.start();
    music.stop();
    finish(response());
    await vi.waitFor(() => expect(music.snapshot().loaded).toBe(true));
    expect(voices).toHaveLength(0);
    expect(music.snapshot().active).toBe(false);
    music.setEnabled(true);
    expect(voices).toHaveLength(1);
    music.dispose();
  });
  it("ステージ変更で破棄した後にデコードが完了しても再生しない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
    const { music, context, voices, onError } = fixture();
    let finish!: (buffer: AudioBuffer) => void;
    context.decodeAudioData.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    music.start();
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalled());
    music.dispose();
    finish({ duration: 10 } as AudioBuffer);
    await vi.waitFor(() => expect(music.snapshot().loading).toBe(false));
    expect(voices).toHaveLength(0);
    expect(onError).not.toHaveBeenCalled();
    expect(music.snapshot().loaded).toBe(false);
  });
  it("読み込みの失敗を通知し、再操作で読み直せる", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(response()),
    );
    const { music, onError } = fixture();
    music.start();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(music.snapshot().loading).toBe(false));
    expect(music.snapshot().active).toBe(false);
    music.start();
    await vi.waitFor(() => expect(music.snapshot().active).toBe(true));
    music.dispose();
  });
});
