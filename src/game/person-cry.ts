import { fallingVoiceEnvelope } from "./falling-voice";

export const PERSON_CRY_DURATION = 1.6;

// Keep the long vowel and playful pitch as the falling voice recedes.
export function schedulePersonCry(
  context: BaseAudioContext,
  output: AudioNode,
) {
  const start = context.currentTime;
  const duration = PERSON_CRY_DURATION;
  const oscillator = context.createOscillator();
  const harmonics = new Float32Array(33);
  for (let index = 1; index < harmonics.length; index++)
    harmonics[index] = 1 / index ** 1.15;
  oscillator.setPeriodicWave(
    context.createPeriodicWave(new Float32Array(33), harmonics),
  );
  oscillator.frequency.setValueAtTime(300, start);
  oscillator.frequency.exponentialRampToValueAtTime(390, start + 0.07);
  oscillator.frequency.exponentialRampToValueAtTime(330, start + 0.25);
  oscillator.frequency.exponentialRampToValueAtTime(
    315,
    start + duration - 0.25,
  );
  oscillator.frequency.exponentialRampToValueAtTime(285, start + duration);

  const envelope = fallingVoiceEnvelope(context, output, duration, 0.9);

  const filters = [
    { frequency: 800, weight: 1, q: 5 },
    { frequency: 1200, weight: 0.75, q: 7 },
    { frequency: 2700, weight: 0.22, q: 9 },
  ].map(({ frequency, weight, q }) => {
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = context.createGain();
    gain.gain.value = weight;
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(envelope);
    return { filter, gain };
  });

  const vibrato = context.createOscillator();
  const vibratoGain = context.createGain();
  vibrato.frequency.value = 6;
  vibratoGain.gain.value = 4;
  vibrato.connect(vibratoGain);
  vibratoGain.connect(oscillator.frequency);
  vibrato.start(start);
  vibrato.stop(start + duration);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);

  return {
    oscillator,
    disconnect() {
      vibrato.stop();
      vibrato.disconnect();
      vibratoGain.disconnect();
      oscillator.disconnect();
      envelope.disconnect();
      filters.forEach(({ filter, gain }) => {
        filter.disconnect();
        gain.disconnect();
      });
    },
  };
}
