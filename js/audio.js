'use strict';
/* Dead Mobile – Audio: Web-Audio-Synth, Soundeffekte (SFX), Verfolgungsmusik */
/* ================= Audio (Web Audio, alles synthetisch) ================= */
const A = {
  c: null, m: null, sfx: null, mus: null, nb: null, on: true, vol: 1,
  init() {
    if (this.c) { if (this.c.state !== 'running') this.c.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
      const c = this.c = new AC();
      this.m = c.createGain(); this.m.gain.value = this.on ? 1 : 0;
      const comp = c.createDynamicsCompressor(); this.m.connect(comp); comp.connect(c.destination);
      this.sfx = c.createGain(); this.sfx.gain.value = .85; this.sfx.connect(this.m);
      this.mus = c.createGain(); this.mus.gain.value = 0; this.mus.connect(this.m);
      const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.nb = b;
      const src = c.createBufferSource(); src.buffer = b; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 360;
      const g = c.createGain(); g.gain.value = .045; src.connect(f); f.connect(g); g.connect(this.m); src.start();
      const lfo = c.createOscillator(); lfo.frequency.value = .07; const lg = c.createGain(); lg.gain.value = 160; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
      if (c.state !== 'running') c.resume();
    } catch (e) { this.c = null; }
  },
  set(on) { this.on = on; if (this.m) this.m.gain.setTargetAtTime(on ? 1 : 0, this.c.currentTime, .05); },
  tone(type, f0, f1, dur, vol, at = 0, dest) {
    const c = this.c; if (!c) return; const t = c.currentTime + at;
    if (!dest) { vol *= this.vol; if (vol < .004) return; }
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(.02, dur * .2)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + .05);
  },
  noise(dur, vol, type, f0, f1, q = 1, at = 0, dest) {
    const c = this.c; if (!c) return; const t = c.currentTime + at;
    if (!dest) { vol *= this.vol; if (vol < .004) return; }
    const s = c.createBufferSource(); s.buffer = this.nb;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(.015, dur * .2)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfx); s.start(t, Math.random() * 1.5); s.stop(t + dur + .05);
  },
};
/* Team: Geräusche aus der Welt werden mit der Entfernung zum Betrachter leiser (voll bis CFG.hearNear, stumm ab
   CFG.hearFar; min = Mindestlautstärke für Meldungen, die alle hören sollen). Solo/Tutorial: unverändert laut. */
function hear(x, y, fn, min = 0) {
  if (MODE !== 'team' || state !== 'play') return fn();
  const V = viewer(), v = clamp(1 - (hyp(x - V.x, y - V.y) - CFG.hearNear) / (CFG.hearFar - CFG.hearNear), min, 1);
  const old = A.vol; A.vol = old * v * v;
  try { return fn(); } finally { A.vol = old; }
}
const SFX = {
  genHum(p) { A.noise(.16, .1, 'lowpass', 150 + p * 130, 80, 1); A.tone('square', 46 + p * 16, 44, .12, .03); },
  heart(v) { A.tone('sine', 64, 38, .17, .9 * v); A.tone('sine', 56, 34, .15, .6 * v, .17); },
  sting() { A.tone('sawtooth', 1250, 2150, .6, .09); A.tone('sawtooth', 1318, 2240, .6, .07); A.noise(.5, .18, 'bandpass', 3200, 1500, 2); A.tone('sine', 82, 32, 1, .8); },
  whoosh() { A.noise(.24, .35, 'bandpass', 1500, 380, 1.4); },
  hit() { A.noise(.35, .9, 'lowpass', 900, 160, 1); A.tone('sine', 130, 40, .35, .8); A.tone('sawtooth', 700, 420, .5, .08, .05); },
  clang() { [523, 787, 1047, 1398, 1760].forEach((f, i) => A.tone('triangle', f, f * .985, 1.8, .22 / (i + 1))); A.noise(.1, .5, 'highpass', 3000, 3000, 1); },
  scream() { A.tone('sawtooth', 780, 520, 1.2, .12); A.tone('sawtooth', 790, 530, 1.2, .08); A.noise(1, .12, 'bandpass', 1100, 900, 4); },
  bang() { A.noise(.8, 1, 'lowpass', 1800, 110, .8); A.tone('sine', 100, 35, .7, .9); A.noise(.3, .4, 'highpass', 2500, 4000, 1, .05); },
  spark() { A.noise(.22, .5, 'highpass', 3500, 6000, 1); A.noise(.12, .4, 'highpass', 4000, 3000, 1, .12); },
  staticB() { A.noise(.9, .5, 'bandpass', 2300, 1600, .6); A.tone('square', 90, 70, .5, .05); },
  steam() { A.noise(1.2, .6, 'highpass', 1600, 2600, .7); },
  ding() { A.tone('triangle', 1320, 1320, .2, .25); A.tone('sine', 2640, 2640, .14, .07); },
  good() { A.tone('triangle', 880, 880, .09, .2); },
  great() { A.tone('triangle', 1320, 1320, .1, .22); A.tone('triangle', 1760, 1760, .16, .18, .06); },
  done() { A.tone('sawtooth', 110, 220, .8, .1); A.tone('triangle', 440, 440, .5, .14, .3); A.tone('triangle', 660, 660, .7, .11, .42); },
  pallet() { A.noise(.32, .95, 'lowpass', 520, 140, 1); A.tone('sine', 150, 48, .28, .7); },
  crack() { for (let i = 0; i < 4; i++) A.noise(.09, .6, 'bandpass', 900 + i * 320, 600, 2, i * .06); A.tone('sine', 95, 40, .32, .5); },
  vault(f) { A.noise(f ? .22 : .32, f ? .45 : .14, 'bandpass', f ? 950 : 500, 300, 1.2); },
  locker() { A.tone('square', 170, 120, .09, .1); A.noise(.13, .3, 'bandpass', 700, 400, 3); },
  step() { A.noise(.05, .05, 'lowpass', 420, 200, 1); },
  kstep() { A.noise(.07, .08, 'lowpass', 260, 120, 1); },
  siren() { for (let i = 0; i < 8; i++) { const f = i % 2 ? 585 : 440; A.tone('triangle', f, f, .48, .11, i * .5); A.tone('sine', f * 2, f * 2, .48, .025, i * .5); } },
  chirp() { A.tone('square', 1800, 1800, .06, .05); A.tone('square', 2400, 2400, .06, .05, .09); },
  beep(d) { A.tone('square', [900, 1100, 1300, 1000][d], [900, 1100, 1300, 1000][d], .1, .05); },
  kick() { A.noise(.16, .5, 'lowpass', 600, 200, 1); A.tone('square', 90, 60, .12, .12); },
  stun() { A.tone('sine', 320, 110, .55, .25); A.noise(.2, .2, 'bandpass', 600, 300, 2); },
  whiff() { A.noise(.18, .25, 'bandpass', 700, 300, 1); },
  win() { A.tone('triangle', 392, 392, .6, .12); A.tone('triangle', 494, 494, .6, .1, .15); A.tone('triangle', 587, 587, 1.2, .12, .3); },
  gasp() { A.noise(.35, .35, 'bandpass', 1300, 700, 3); A.tone('sawtooth', 420, 300, .3, .05); },
  breath() { A.noise(.45, .06, 'bandpass', 900, 600, 2); A.noise(.4, .05, 'bandpass', 700, 500, 2, .55); },
};
const MUS = { next: 0, beat: 0, lvl: 0 };
function updateMusic() {
  if (!A.c) return;
  const now = A.c.currentTime;
  const want = (state === 'play' && chasedView()) ? 1 : 0;   // Team: nur, wer selbst gejagt wird (bzw. der Killer-Spieler)
  A.mus.gain.setTargetAtTime(want * .5, now, want ? .25 : 1.2);
  MUS.lvl = want ? 1 : Math.max(0, MUS.lvl - 1 / 60 / 3);
  if (MUS.lvl > 0) {
    if (MUS.next < now) MUS.next = now + .05;
    while (MUS.next < now + .15) {
      const at = MUS.next - now, b = MUS.beat;
      const bass = [55, 55, 58.27, 55, 51.91, 55, 58.27, 61.74][b % 8];
      A.tone('triangle', bass * 2, bass * 1.96, .24, .55, at, A.mus);
      if (b % 2 === 0) A.noise(.08, .35, 'lowpass', 180, 80, 1, at, A.mus);
      if (b % 8 === 4) { A.tone('sine', 1174, 1244, 1.3, .06, at, A.mus); A.tone('sine', 1244, 1174, 1.3, .05, at, A.mus); }
      MUS.next += .34; MUS.beat++;
    }
  }
}
