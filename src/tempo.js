// ── Tempo ─────────────────────────────────────────────────────────────────────
// The only resource. Everything reads from and writes to this one bar.
const Tempo = {
  value: 50,
  isCrashed: false,
  REST: 50,
  DECAY_RATE: 8,
  manualCrashRadiusBonus: 1.0,

  // Crash reset value depends on class (Berserker resets higher)
  crashResetValue() {
    return RunState.chosenClass === 'berserker' ? 70 : 45
  },

  update(dt) {
    // Sustained item: suppress decay while active
    if (RunState.sustainedTimer > 0) {
      RunState.sustainedTimer = Math.max(0, RunState.sustainedTimer - dt)
      return
    }
    if (this.isCrashed) return

    const metronome   = RunState.items.includes('metronome') ? 3 : 1
    const floorMult   = RunState.floorDecayMult || 1.0

    // Runaway: no decay from Hot
    if (RunState.items.includes('runaway') && this.value >= 70 && this.value < 100) return

    const dir = this.REST - this.value
    if (Math.abs(dir) < 0.1) return
    this.value += Math.sign(dir) * this.DECAY_RATE * metronome * floorMult * dt
    this.value = Math.max(0, Math.min(100, this.value))
  },

  // ── Callbacks ────────────────────────────────────────────────────────────────
  onComboHit(hitNum) {
    if (this.isCrashed) return
    const gain = hitNum === 3 ? 15 : 4
    this._add(gain * RunState.tempoGain)
  },
  onKill()         { if (!this.isCrashed) this._add(10 * RunState.tempoGain) },
  onDodge()        {
    if (this.isCrashed) return
    if (RunState.items.includes('tempo_tap')) this._add(5)
    else this._add(-5)
  },
  onPerfectDodge() { if (!this.isCrashed) this._add(10) },
  onHeavyHit()     { if (!this.isCrashed) this._add(20 * RunState.tempoGain) },
  onHeavyMiss()    { if (!this.isCrashed) this._add(8  * RunState.tempoGain) },
  onDrained()      { if (!this.isCrashed) this._add(-20) },

  // ── Manual crash (F key at 85+) ──────────────────────────────────────────────
  manualCrash(px, py) {
    if (this.isCrashed || this.value < 85) return false
    const radius = 120 * this.manualCrashRadiusBonus
    const dmg    = Math.round(RunState.power * this.damageMultiplier() * 2.5)
    for (const e of enemies) {
      if (!e.alive) continue
      const dx = e.x - px, dy = e.y - py
      if (dx * dx + dy * dy < (radius + e.r) * (radius + e.r)) e.takeDamage(dmg)
    }
    Effects.spawnCrashBurst(px, py, radius)
    RunState.runStats.crashes++
    if (typeof Audio !== 'undefined') Audio.crash()
    this._doCrash(0.15, 0.25, 0.7)
    return true
  },

  _add(amount) {
    // Apply floor gain multiplier only to positive changes
    if (amount > 0) amount *= (RunState.floorGainMult || 1.0)
    this.value = Math.max(0, Math.min(100, this.value + amount))
    if (this.value >= 100) this._triggerAccidentalCrash()
  },

  _triggerAccidentalCrash() {
    if (RunState.items.includes('echo') && typeof Player !== 'undefined') {
      Player._echoAttack()
    }
    const radius = 80 * this.manualCrashRadiusBonus
    const dmg    = Math.round(RunState.power * this.damageMultiplier() * 1.5)
    if (typeof Player !== 'undefined') {
      for (const e of enemies) {
        if (!e.alive) continue
        const dx = e.x - Player.x, dy = e.y - Player.y
        if (dx * dx + dy * dy < (radius + e.r) * (radius + e.r)) e.takeDamage(dmg)
      }
      Effects.spawnCrashBurst(Player.x, Player.y, radius)
    }
    RunState.runStats.crashes++
    if (typeof Audio !== 'undefined') Audio.crash()
    this._doCrash(0.2, 0.3, 0.8)
  },

  _doCrash(hitStopDur, shakeDur, shakeIntens) {
    this.isCrashed = true
    this.value     = this.crashResetValue()
    hitStopTimer   = hitStopDur
    shakeIntensity = shakeIntens
    shakeDuration  = shakeDur
    shakeElapsed   = 0
    setTimeout(() => { this.isCrashed = false }, shakeDur * 1000 + 50)
  },

  // ── Multipliers ──────────────────────────────────────────────────────────────
  damageMultiplier() {
    if (this.value < 30) return 0.7
    if (this.value < 70) return 1.0
    if (this.value < 90) return 1.3
    return 1.8
  },

  speedMultiplier() {
    if (this.value >= 90) return 1.0
    if (this.value >= 70) return 1.2
    if (this.value <  30) return 0.9
    return 1.0
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
  },
}
