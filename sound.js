// Synthesized duck "quack" (Web Audio, no sound files needed).
// A quack is a raspy, nasal tone whose pitch jumps up then drops:
// two detuned sawtooth waves -> amplitude "rasp" -> nasal formant filters -> envelope.

export function quack(ac, t, { pitch = 1, dur = 0.24, vol = 0.9 } = {}) {
  const end = t + dur;

  const out = ac.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  out.gain.setValueAtTime(vol, t + dur * 0.45);
  out.gain.exponentialRampToValueAtTime(0.0001, end);
  out.connect(ac.destination);

  // Nasal formants that give the "waak" duck colour
  const f1 = ac.createBiquadFilter();
  f1.type = 'bandpass'; f1.frequency.value = 1000 * pitch; f1.Q.value = 3;
  const f2 = ac.createBiquadFilter();
  f2.type = 'bandpass'; f2.frequency.value = 2400 * pitch; f2.Q.value = 5;
  const f2Gain = ac.createGain(); f2Gain.gain.value = 0.6;
  f1.connect(out);
  f2.connect(f2Gain).connect(out);

  // Raspy throat: fast amplitude wobble
  const rasp = ac.createGain(); rasp.gain.value = 0.7;
  const lfo = ac.createOscillator(); lfo.frequency.value = 55;
  const lfoDepth = ac.createGain(); lfoDepth.gain.value = 0.3;
  lfo.connect(lfoDepth).connect(rasp.gain);
  rasp.connect(f1);
  rasp.connect(f2);

  for (const detune of [0, 18]) {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.detune.value = detune;
    o.frequency.setValueAtTime(420 * pitch, t);
    o.frequency.linearRampToValueAtTime(560 * pitch, t + dur * 0.25);
    o.frequency.exponentialRampToValueAtTime(330 * pitch, end);
    o.connect(rasp);
    o.start(t);
    o.stop(end + 0.05);
  }
  lfo.start(t);
  lfo.stop(end + 0.05);
}

// Schedule `count` quacks on an existing context, starting at time t0.
export function scheduleQuacks(ac, t0, count = 2, opts = {}) {
  for (let i = 0; i < count; i++) quack(ac, t0 + i * 0.3, opts);
  return t0 + count * 0.3 + 0.1;
}

// "Quack quack!" (or a single quack with count = 1)
export function playQuacks(count = 2, opts = {}) {
  try {
    const ac = new AudioContext();
    const endAt = scheduleQuacks(ac, ac.currentTime + 0.05, count, opts);
    setTimeout(() => ac.close(), (endAt - ac.currentTime + 0.3) * 1000);
  } catch { /* audio not available */ }
}
