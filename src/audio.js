// ── Audio ─────────────────────────────────────────────────────────────────────
// Web Audio API procedural sound system. Zero audio files — all synthesized.
const Audio = (() => {
  let ctx = null
  let tempoHumGain = null
  let tempoHumOsc  = null

  function init() {
    if (ctx) return
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
      tempoHumOsc  = ctx.createOscillator()
      tempoHumGain = ctx.createGain()
      tempoHumOsc.type = 'sine'
      tempoHumOsc.frequency.value = 80
      tempoHumGain.gain.value = 0
      tempoHumOsc.connect(tempoHumGain)
      tempoHumGain.connect(ctx.destination)
      tempoHumOsc.start()
    } catch(e) {}
  }

  function _tone(freq, type, dur, vol, attack) {
    if (!ctx) return
    try {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type || 'square'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + (attack || 0.01))
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + dur + 0.05)
    } catch(e) {}
  }

  function _noise(dur, vol, freq) {
    if (!ctx) return
    try {
      const bufSize = Math.floor(ctx.sampleRate * dur)
      const buffer  = ctx.createBuffer(1, bufSize, ctx.sampleRate)
      const data    = buffer.getChannelData(0)
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1)
      const src    = ctx.createBufferSource()
      src.buffer   = buffer
      const filter = ctx.createBiquadFilter()
      filter.type  = 'bandpass'
      filter.frequency.value = freq || 1000
      filter.Q.value = 0.5
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(vol, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
      src.start(); src.stop(ctx.currentTime + dur)
    } catch(e) {}
  }

  function _tFreq(base) {
    const t = (typeof Tempo !== 'undefined') ? Tempo.value : 50
    if (t >= 90) return base * 1.5
    if (t >= 70) return base * 1.25
    if (t <  30) return base * 0.8
    return base
  }

  return {
    init,

    updateTempoHum() {
      if (!ctx || !tempoHumGain || !tempoHumOsc) return
      try {
        const t = (typeof Tempo !== 'undefined') ? Tempo.value : 50
        const gs = (typeof gameState !== 'undefined' && gameState === 'playing') ? 1 : 0
        tempoHumOsc.frequency.setTargetAtTime(60 + (t / 100) * 60, ctx.currentTime, 0.1)
        tempoHumGain.gain.setTargetAtTime(gs * (0.03 + (t / 100) * 0.05), ctx.currentTime, 0.2)
      } catch(e) {}
    },

    hit()       { _tone(_tFreq(300), 'square',   0.08, 0.18);  _noise(0.04, 0.1, 1500) },
    heavyHit()  { _tone(_tFreq(120), 'sawtooth', 0.22, 0.28);  _noise(0.15, 0.2, 400) },
    miss()      { _tone(180, 'sine',     0.14, 0.06) },
    kill()      { _tone(_tFreq(520), 'sine', 0.15, 0.22); _tone(_tFreq(740), 'sine', 0.1, 0.1, 0.03) },
    dodge()     { _tone(_tFreq(380), 'sine', 0.09, 0.07) },
    perfect()   { _tone(820, 'sine', 0.32, 0.18); _tone(1250, 'sine', 0.22, 0.12, 0.04) },
    playerHit() { _noise(0.2, 0.35, 300); _tone(140, 'sawtooth', 0.22, 0.22) },
    drain()     { _tone(290, 'sine', 0.32, 0.16); _tone(240, 'sine', 0.4, 0.1, 0.06) },
    levelUp()   {
      [380, 480, 580, 780].forEach((f, i) => setTimeout(() => _tone(f, 'sine', 0.22, 0.18), i * 75))
    },
    roomClear() {
      [440, 550, 660].forEach((f, i) => setTimeout(() => _tone(f, 'triangle', 0.32, 0.22), i * 90))
    },
    bossPhase() { _noise(0.28, 0.42, 100); _tone(55, 'sawtooth', 0.65, 0.38) },
    crash() {
      _noise(0.42, 0.55, 180)
      _tone(75, 'sawtooth', 0.55, 0.45)
      _tone(38, 'sine', 0.85, 0.32)
    },
  }
})()
