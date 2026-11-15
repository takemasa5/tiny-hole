import type { ObjectVoice } from "./object-feedback";

export function scheduleCharacterVoice(
  context: BaseAudioContext,
  output: AudioNode,
  kind: ObjectVoice,
  variation: number,
) {
  const start = context.currentTime;
  const profile = {
    human: { pitch: 250, duration: 0.68, formants: [760, 1150, 2600] },
    hero: { pitch: 190, duration: 0.85, formants: [650, 1050, 2400] },
    monster: { pitch: 72, duration: 1.1, formants: [280, 520, 1100] },
    robot: { pitch: 160, duration: 0.64, formants: [600, 1400, 2200] },
    animal: { pitch: 690, duration: 0.42, formants: [1200, 2200, 3100] },
    ghost: { pitch: 370, duration: 0.9, formants: [430, 900, 2300] },
    demon: { pitch: 115, duration: 0.95, formants: [540, 980, 2000] },
  }[kind];
  const duration = profile.duration;
  const pitch = profile.pitch * (0.9 + (variation % 5) * 0.045);
  const oscillator = context.createOscillator();
  oscillator.type =
    kind === "robot" ? "square" : kind === "animal" ? "triangle" : "sawtooth";
  oscillator.frequency.setValueAtTime(pitch * 0.8, start);
  oscillator.frequency.exponentialRampToValueAtTime(pitch * 1.45, start + 0.12);
  oscillator.frequency.exponentialRampToValueAtTime(
    pitch * (kind === "monster" ? 0.55 : 0.95),
    start + duration,
  );
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(
    kind === "monster" ? 0.16 : 0.1,
    start + 0.045,
  );
  envelope.gain.exponentialRampToValueAtTime(0.06, start + duration * 0.65);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  envelope.connect(output);
  const nodes: AudioNode[] = [envelope];
  profile.formants.forEach((frequency, index) => {
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = index === 0 ? 4 : 7;
    const gain = context.createGain();
    gain.gain.value = [0.9, 0.55, 0.15][index];
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(envelope);
    nodes.push(filter, gain);
  });
  const vibrato = context.createOscillator();
  const vibratoGain = context.createGain();
  vibrato.frequency.value = kind === "robot" ? 24 : kind === "monster" ? 14 : 7;
  vibratoGain.gain.value = pitch * (kind === "robot" ? 0.12 : 0.045);
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
      nodes.forEach((node) => node.disconnect());
    },
  };
}
