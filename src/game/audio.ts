/** Ambiance sonore procédurale (WebAudio) : pas de fichiers à télécharger. */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let started = false;
let timers: number[] = [];

function noiseBuffer(c: AudioContext, seconds = 2) {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function loopNoise(c: AudioContext, dest: AudioNode, freq: number, gain: number, q = 0.7) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 3);
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(dest);
  src.start();
  return { g, filter };
}

function pluck(
  c: AudioContext,
  dest: AudioNode,
  freq: number,
  when: number,
  dur = 0.5,
  gain = 0.06,
) {
  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(gain, when + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g).connect(dest);
  osc.start(when);
  osc.stop(when + dur + 0.05);
}

function gull(c: AudioContext, dest: AudioNode) {
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 1600;
  osc.frequency.setValueAtTime(900 + Math.random() * 300, now);
  osc.frequency.linearRampToValueAtTime(1500, now + 0.12);
  osc.frequency.linearRampToValueAtTime(800, now + 0.3);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.05, now + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  osc.connect(f).connect(g).connect(dest);
  osc.start(now);
  osc.stop(now + 0.45);
}

function hammer(c: AudioContext, dest: AudioNode) {
  const now = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 0.2);
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 320;
  const g = c.createGain();
  g.gain.setValueAtTime(0.09, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  src.connect(f).connect(g).connect(dest);
  src.start(now);
}

const SCALE = [196, 220, 233, 262, 294, 330, 349, 392];

export const audio = {
  init() {
    if (started || typeof window === "undefined") return;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
    started = true;

    // Vagues, foule, vent
    loopNoise(ctx, master, 320, 0.05, 0.4);
    const waves = loopNoise(ctx, master, 180, 0.05, 0.6);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(waves.g.gain);
    lfo.start();
    loopNoise(ctx, master, 700, 0.018, 0.8); // murmure de foule
    loopNoise(ctx, master, 1200, 0.012, 0.5); // vent

    // Mouettes, marteaux et musique discrète
    timers.push(
      window.setInterval(() => ctx && master && Math.random() < 0.6 && gull(ctx, master), 5200),
      window.setInterval(() => ctx && master && Math.random() < 0.7 && hammer(ctx, master), 2600),
      window.setInterval(() => {
        if (!ctx || !master) return;
        const t = ctx.currentTime;
        for (let i = 0; i < 4; i++) {
          const n = SCALE[Math.floor(Math.random() * SCALE.length)];
          pluck(ctx, master, n, t + i * 0.42);
          if (i % 2 === 0) pluck(ctx, master, n / 2, t + i * 0.42, 0.8, 0.03);
        }
      }, 7000),
    );
  },
  resume() {
    void ctx?.resume();
  },
  setMuted(m: boolean) {
    if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.7, ctx.currentTime, 0.1);
  },
  blip(freq = 440) {
    if (!ctx || !master) return;
    pluck(ctx, master, freq, ctx.currentTime, 0.25, 0.08);
  },
  dispose() {
    timers.forEach((t) => clearInterval(t));
    timers = [];
    void ctx?.close();
    ctx = null;
    master = null;
    started = false;
  },
};
