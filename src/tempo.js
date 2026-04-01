// ── Tempo ─────────────────────────────────────────────────────────────────────
// Central resource: raised by attacking/killing, lowered by dodging,
// decays toward REST. Crashes at 100 — brief stagger, resets to crashReset.
const Tempo = {
  value: 50,
  crashReset: 50,
  isCrashed: false,
  REST: 50,
  DECAY_RATE: 8,

  update(dt) {
    if (this.isCrashed) return
    const metronome = RunState.items.includes('metronome') ? 2 : 1
    const dir = this.REST - this.value
    if (Math.abs(dir) < 0.1) return
    this.value += Math.sign(dir) * this.DECAY_RATE * metronome * dt
    this.value = Math.max(0, Math.min(100, this.value))
  },

  onAttack() { if (!this.isCrashed) this._add(5  * RunState.tempoGain) },
  onKill()   { if (!this.isCrashed) this._add(10 * RunState.tempoGain) },
  onDodge()  { if (!this.isCrashed) this._add(-15) },

  _add(amount) {
    this.value = Math.max(0, Math.min(100, this.value + amount))
    if (this.value >= 100) this._crash()
  },

  _crash() {
    this.isCrashed = true
    this.value = this.crashReset
    hitStopTimer   = 0.2
    shakeIntensity = 0.8
    shakeDuration  = 0.3
    shakeElapsed   = 0
    // Unfreeze after real 300ms (hitStop doesn't pause setTimeout)
    setTimeout(() => { this.isCrashed = false }, 300)
  },

  damageMultiplier() {
    if (this.value < 30) return 0.7
    if (this.value < 70) return 1.0
    if (this.value < 90) return 1.3
    return 1.6
  },

  stateName() {
    if (this.value < 30) return 'COLD'
    if (this.value < 70) return 'FLOWING'
    if (this.value < 90) return 'HOT'
    return 'CRITICAL'
  },

  stateColor() {
    if (this.value < 30) return '#4488ff'
    if (this.value < 70) return '#44ff88'
    if (this.value < 90) return '#ff8800'
    return '#ff3333'
  },

  barColor() {
    if (this.value < 30) return '#2255cc'
    if (this.value < 70) return '#22aa55'
    if (this.value < 90) return '#cc6600'
    return '#cc1111'
  }
}
