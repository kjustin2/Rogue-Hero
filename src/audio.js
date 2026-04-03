import { events } from './EventBus.js';

export class AudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.tempoHumGain = null;
    this.tempoHumOsc = null;
    this.tempoVal = 50;

    events.on('ZONE_TRANSITION', () => this.zoneTransition());
    events.on('PLAY_SOUND', (name) => {
      if (this[name]) this[name]();
    });
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.tempoHumOsc = this.ctx.createOscillator();
      this.tempoHumGain = this.ctx.createGain();
      this.tempoHumOsc.type = 'sine';
      this.tempoHumOsc.frequency.value = 80;
      this.tempoHumGain.gain.value = 0;
      this.tempoHumOsc.connect(this.tempoHumGain);
      this.tempoHumGain.connect(this.ctx.destination);
      this.tempoHumOsc.start();
    } catch (e) {}
  }

  updateTempoHum(tempoValue, isPlaying) {
    this.tempoVal = tempoValue;
    if (!this.ctx || !this.tempoHumGain || !this.tempoHumOsc) return;
    try {
      const gs = isPlaying ? 1 : 0;
      this.tempoHumOsc.frequency.setTargetAtTime(60 + (tempoValue / 100) * 60, this.ctx.currentTime, 0.1);
      this.tempoHumGain.gain.setTargetAtTime(gs * (0.03 + (tempoValue / 100) * 0.05), this.ctx.currentTime, 0.2);
    } catch (e) {}
  }

  _tone(freq, type, dur, vol, attack) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + (attack || 0.01));
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + dur + 0.05);
    } catch (e) {}
  }

  _noise(dur, vol, freq) {
    if (!this.ctx) return;
    try {
      const bufSize = Math.floor(this.ctx.sampleRate * dur);
      const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq || 1000;
      filter.Q.value = 0.5;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      src.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
      src.start(); src.stop(this.ctx.currentTime + dur);
    } catch (e) {}
  }

  _tFreq(base) {
    const t = this.tempoVal;
    if (t >= 90) return base * 1.5;
    if (t >= 70) return base * 1.25;
    if (t < 30) return base * 0.8;
    return base;
  }

  hit() { this._tone(this._tFreq(300), 'square', 0.08, 0.18); this._noise(0.04, 0.1, 1500); }
  heavyHit() { this._tone(this._tFreq(120), 'sawtooth', 0.22, 0.28); this._noise(0.15, 0.2, 400); }
  miss() { this._tone(180, 'sine', 0.14, 0.06); }
  kill() { this._tone(this._tFreq(520), 'sine', 0.15, 0.22); this._tone(this._tFreq(740), 'sine', 0.1, 0.1, 0.03); }
  dodge() { this._tone(this._tFreq(380), 'sine', 0.09, 0.07); }
  perfect() { this._tone(820, 'sine', 0.32, 0.18); this._tone(1250, 'sine', 0.22, 0.12, 0.04); }
  playerHit() { this._noise(0.2, 0.35, 300); this._tone(140, 'sawtooth', 0.22, 0.22); }
  crash() {
    this._noise(0.42, 0.55, 180);
    this._tone(75, 'sawtooth', 0.55, 0.45);
    this._tone(38, 'sine', 0.85, 0.32);
  }
  zoneTransition() {
    this._tone(this._tFreq(660), 'sine', 0.12, 0.1);
    this._tone(this._tFreq(880), 'sine', 0.08, 0.06, 0.02);
  }
}
