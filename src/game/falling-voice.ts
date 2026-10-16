export const AMERICAN_VOICE_URL = `${import.meta.env.BASE_URL}audio/american-fall.wav`;

export function fallingVoiceEnvelope(
  context: BaseAudioContext,
  output: AudioNode,
  duration: number,
  peak: number,
) {
  const start = context.currentTime;
  const envelope = context.createGain();
  const gain = envelope.gain;
  gain.setValueAtTime(0.0001, start);
  gain.exponentialRampToValueAtTime(
    peak,
    start + Math.min(0.025, duration * 0.1),
  );
  gain.exponentialRampToValueAtTime(peak * 0.8, start + duration * 0.2);
  gain.exponentialRampToValueAtTime(peak * 0.3, start + duration * 0.55);
  gain.exponentialRampToValueAtTime(peak * 0.05, start + duration * 0.85);
  gain.exponentialRampToValueAtTime(0.0001, start + duration);
  envelope.connect(output);
  return envelope;
}

export function scheduleAmericanCry(
  context: BaseAudioContext,
  output: AudioNode,
  buffer: AudioBuffer,
) {
  // Exclude the synthesizer's silent padding so distance follows the spoken words.
  const samples = buffer.getChannelData(0);
  let first = 0,
    last = samples.length - 1;
  while (first < last && Math.abs(samples[first]) < 0.001) first++;
  while (last > first && Math.abs(samples[last]) < 0.001) last--;
  const offset = Math.max(0, first / buffer.sampleRate - 0.05);
  const end = Math.min(buffer.duration, (last + 1) / buffer.sampleRate + 0.08);
  const duration = end - offset;
  if (duration < 0.1) throw new Error("英語の声の音声が空です。");
  const source = context.createBufferSource();
  source.buffer = buffer;
  const envelope = americanVoiceEnvelope(context, output, duration);
  source.connect(envelope);
  source.start(context.currentTime, offset, duration);
  return {
    source,
    duration,
    disconnect() {
      source.disconnect();
      envelope.disconnect();
    },
  };
}

export function americanVoiceEnvelope(
  context: BaseAudioContext,
  output: AudioNode,
  duration: number,
) {
  const start = context.currentTime;
  const envelope = context.createGain();
  const gain = envelope.gain;
  gain.setValueAtTime(0.0001, start);
  gain.exponentialRampToValueAtTime(
    0.75,
    start + Math.min(0.015, duration * 0.08),
  );
  // Keep both words audible before receding; the final consonants carry meaning.
  gain.setValueAtTime(0.75, start + duration * 0.5);
  gain.exponentialRampToValueAtTime(0.55, start + duration * 0.7);
  gain.exponentialRampToValueAtTime(0.2, start + duration * 0.9);
  gain.exponentialRampToValueAtTime(0.0001, start + duration);
  envelope.connect(output);
  return envelope;
}
