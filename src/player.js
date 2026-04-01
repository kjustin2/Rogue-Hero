// ── Player ────────────────────────────────────────────────────────────────────
const Player = {
  x: 200, y: 360,
  r: 16,
  vx: 0, vy: 0,
  hp: 0, maxHp: 0,
  alive: true,
  invincible: 0,
  ACCEL:    2000,
  FRICTION: 1800,
  BASE_SPEED: 280,

  // Dodge
  dodging:       false,
  dodgeTimer:    0,
  dodgeDirX:     0,
  dodgeDirY:     0,
  DODGE_SPEED:   520,
  DODGE_DUR:     0.18,
  dodgeCooldown: 0,
  DODGE_CD:      0.55,
  trailTimer:    0,

  // Combo attack (left click)
  comboCount:     0,
  comboTimer:     0,
  COMBO_WINDOW:   0.65,
  ATTACK_CD:      0.22,
  attackCooldown: 0,

  // Heavy attack (right click)
  isCharging:    false,
  chargeTimer:   0,
  CHARGE_DUR:    0.28,
  heavyCooldown: 0,
  HEAVY_CD:      0.7,

  // For echo item
  _lastDmg: 0,

  init() {
    this.x = 200; this.y = 360
    this.vx = 0;  this.vy = 0
    this.hp = RunState.maxHp; this.maxHp = RunState.maxHp
    this.alive = true; this.invincible = 0
    this.dodging = false; this.dodgeTimer = 0; this.dodgeCooldown = 0
    this.attackCooldown = 0; this.comboCount = 0; this.comboTimer = 0
    this.isCharging = false; this.chargeTimer = 0; this.heavyCooldown = 0
    // glass_heart: enter room at Critical
    if (RunState.items.includes('glass_heart')) Tempo.value = 90
  },

  update(dt) {
    if (!this.alive) return

    this.invincible     = Math.max(0, this.invincible     - dt)
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)
    this.dodgeCooldown  = Math.max(0, this.dodgeCooldown  - dt)
    this.heavyCooldown  = Math.max(0, this.heavyCooldown  - dt)

    if (this.comboTimer > 0) {
      this.comboTimer -= dt
      if (this.comboTimer <= 0) this.comboCount = 0
    }

    if (this.isCharging) {
      this.chargeTimer -= dt
      if (this.chargeTimer <= 0) { this.isCharging = false; this._fireHeavy() }
    }

    if (mouseClicked && this.attackCooldown <= 0 && !this.dodging && !this.isCharging) {
      this._tryComboAttack()
    }

    if (rightClicked && this.heavyCooldown <= 0 && !this.dodging && !this.isCharging) {
      this.isCharging = true; this.chargeTimer = this.CHARGE_DUR; rightClicked = false
    }

    // Dodge (Space) — disabled at Critical
    if (!this.dodging && keys.has(' ') && this.dodgeCooldown <= 0 && Tempo.value < 90) {
      const mx = (keys.has('a') || keys.has('arrowleft'))  ? -1 : (keys.has('d') || keys.has('arrowright')) ?  1 : 0
      const my = (keys.has('w') || keys.has('arrowup'))    ? -1 : (keys.has('s') || keys.has('arrowdown'))  ?  1 : 0
      let ddx = mx, ddy = my
      if (ddx === 0 && ddy === 0) { ddx = mouseX - this.x; ddy = mouseY - this.y }
      const dl = Math.sqrt(ddx * ddx + ddy * ddy)
      if (dl > 0.1) {
        this.dodgeDirX = ddx / dl; this.dodgeDirY = ddy / dl
        this.dodging = true; this.dodgeTimer = this.DODGE_DUR
        this.dodgeCooldown = this.DODGE_CD; this.invincible = this.DODGE_DUR
        this.trailTimer = 0
        if (this._isPerfectDodgeMoment()) {
          const dur = RunState.items.includes('precision') ? 0.8 : 0.4
          slowMoTimer = dur; slowMoScale = 0.2
          Tempo.onPerfectDodge()
          Effects.spawnPerfectDodge(this.x, this.y)
          RunState.runStats.perfectDodges++
          if (typeof Audio !== 'undefined') Audio.perfect()
        } else {
          Tempo.onDodge()
          if (typeof Audio !== 'undefined') Audio.dodge()
        }
        if (typeof UI !== 'undefined') UI.controlsDiscovered.add('dodge')
      }
    }

    // Movement
    const speed = RunState.speed * Tempo.speedMultiplier()

    if (this.dodging) {
      this.dodgeTimer -= dt; this.trailTimer -= dt
      if (this.trailTimer <= 0) { Effects.spawnTrail(this.x, this.y); this.trailTimer = 0.04 }
      this.x += this.dodgeDirX * this.DODGE_SPEED * dt
      this.y += this.dodgeDirY * this.DODGE_SPEED * dt

      const doDashDmg = Tempo.value >= 70 || (RunState.items.includes('cold_fury') && Tempo.value < 30)
      if (doDashDmg) {
        for (const e of enemies) {
          if (!e.alive) continue
          const dx = e.x - this.x, dy = e.y - this.y
          if (dx * dx + dy * dy < (this.r + e.r + 6) * (this.r + e.r + 6)) {
            const dmg = Math.round(RunState.power * Tempo.damageMultiplier() * 0.7)
            e.takeDamage(dmg)
          }
        }
      }

      if (this.dodgeTimer <= 0) {
        this.dodging = false
        this.vx = this.dodgeDirX * speed * 0.4
        this.vy = this.dodgeDirY * speed * 0.4
      }
    } else {
      let ix = 0, iy = 0
      if (keys.has('a') || keys.has('arrowleft'))  ix -= 1
      if (keys.has('d') || keys.has('arrowright')) ix += 1
      if (keys.has('w') || keys.has('arrowup'))    iy -= 1
      if (keys.has('s') || keys.has('arrowdown'))  iy += 1

      if (ix !== 0 || iy !== 0) {
        if (typeof UI !== 'undefined') UI.controlsDiscovered.add('move')
        const il = Math.sqrt(ix * ix + iy * iy)
        ix /= il; iy /= il
        this.vx += ix * this.ACCEL * dt; this.vy += iy * this.ACCEL * dt
        const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy)
        if (spd > speed) { this.vx = (this.vx / spd) * speed; this.vy = (this.vy / spd) * speed }
      } else {
        const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy)
        const friction = Math.min(spd, this.FRICTION * dt)
        if (spd > 0) { this.vx -= (this.vx / spd) * friction; this.vy -= (this.vy / spd) * friction }
      }
      this.x += this.vx * dt; this.y += this.vy * dt
    }

    const c = Room.clampToFloor(this.x, this.y, this.r)
    this.x = c.x; this.y = c.y
  },

  _tryComboAttack() {
    const RANGE = 85
    if (typeof UI !== 'undefined') UI.controlsDiscovered.add('attack')

    if (Tempo.value >= 90) { this._tryPierceAttack(RANGE); return }

    let nearest = null, nearestDist = Infinity
    for (const e of enemies) {
      if (!e.alive) continue
      const dx = e.x - this.x, dy = e.y - this.y
      const d  = Math.sqrt(dx * dx + dy * dy)
      if (d < RANGE + e.r && d < nearestDist) { nearest = e; nearestDist = d }
    }
    if (!nearest) return

    this.attackCooldown = this.ATTACK_CD
    this.comboCount++; this.comboTimer = this.COMBO_WINDOW

    const isFinisher = this.comboCount >= 3
    let dmg = Math.round(RunState.power * Tempo.damageMultiplier() * (isFinisher ? 1.8 : 1.0))
    if (RunState.items.includes('resonance') && Math.abs(Tempo.value - 50) <= 5) dmg *= 2

    const killed = nearest.takeDamage(dmg)
    this._lastDmg = dmg

    if (Tempo.value < 30 && nearest.alive) nearest.stagger(0.25)

    hitStopTimer = isFinisher ? 0.1 : 0.06
    Tempo.onComboHit(isFinisher ? 3 : this.comboCount)
    if (killed) {
      Tempo.onKill()
      // Shadow passive: kills at Critical trigger brief slow-mo
      if (RunState.chosenClass === 'shadow' && Tempo.value >= 90) {
        slowMoTimer = 0.18; slowMoScale = 0.12
      }
    }

    if (typeof Audio !== 'undefined') Audio.hit()

    if (isFinisher) {
      Effects.spawnComboFinish(nearest.x, nearest.y)
      this.comboCount = 0; this.comboTimer = 0
      this.attackCooldown = this.ATTACK_CD * 1.4
    }
  },

  _tryPierceAttack(range) {
    const adx = mouseX - this.x, ady = mouseY - this.y
    const al  = Math.sqrt(adx * adx + ady * ady)
    if (al < 1) return
    this.attackCooldown = this.ATTACK_CD
    let anyHit = false
    for (const e of enemies) {
      if (!e.alive) continue
      const dx = e.x - this.x, dy = e.y - this.y
      const d  = Math.sqrt(dx * dx + dy * dy)
      if (d > range + e.r) continue
      const dot = (dx / d) * (adx / al) + (dy / d) * (ady / al)
      if (dot < Math.cos(Math.PI * 0.39)) continue
      let dmg = Math.round(RunState.power * Tempo.damageMultiplier())
      if (RunState.items.includes('resonance') && Math.abs(Tempo.value - 50) <= 5) dmg *= 2
      const killed = e.takeDamage(dmg)
      this._lastDmg = dmg; anyHit = true
      if (killed) Tempo.onKill()
    }
    if (anyHit) { hitStopTimer = 0.08; Tempo.onComboHit(1); if (typeof Audio !== 'undefined') Audio.hit() }
  },

  _fireHeavy() {
    this.heavyCooldown = this.HEAVY_CD
    if (typeof UI !== 'undefined') UI.controlsDiscovered.add('heavy')
    const RANGE = 95
    let nearest = null, nearestDist = Infinity
    for (const e of enemies) {
      if (!e.alive) continue
      const dx = e.x - this.x, dy = e.y - this.y
      const d  = Math.sqrt(dx * dx + dy * dy)
      if (d < RANGE + e.r && d < nearestDist) { nearest = e; nearestDist = d }
    }

    if (!nearest) {
      Tempo.onHeavyMiss()
      if (typeof Audio !== 'undefined') Audio.miss()
      return
    }

    let dmg = Math.round(RunState.power * Tempo.damageMultiplier() * 2.5)
    if (RunState.items.includes('resonance') && Math.abs(Tempo.value - 50) <= 5) dmg *= 2

    const killed = nearest.takeDamage(dmg)
    this._lastDmg = dmg

    if (Tempo.value < 30 && nearest.alive) nearest.stagger(0.5)

    hitStopTimer = 0.14
    shakeIntensity = Math.max(shakeIntensity, 0.3); shakeDuration = 0.15; shakeElapsed = 0

    Tempo.onHeavyHit()
    if (killed) Tempo.onKill()
    if (typeof Audio !== 'undefined') Audio.heavyHit()
  },

  _isPerfectDodgeMoment() {
    for (const p of projectiles) {
      if (!p.alive) continue
      const dx = this.x - p.x, dy = this.y - p.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 100) continue
      const dot = (dx / dist) * p.dx + (dy / dist) * p.dy
      if (dot > 0.5) return true
    }
    for (const e of enemies) {
      if (!e.alive) continue
      if (e.type !== 'chaser' && e.type !== 'tempovampire') continue
      const dx = e.x - this.x, dy = e.y - this.y
      if (Math.sqrt(dx * dx + dy * dy) < 58 && e.state === 'attack') return true
    }
    return false
  },

  _echoAttack() {
    if (!this._lastDmg) return
    const dmg = Math.max(1, Math.round(this._lastDmg * 0.5))
    for (const e of enemies) {
      if (!e.alive) continue
      const dx = e.x - this.x, dy = e.y - this.y
      if (dx * dx + dy * dy < (85 + e.r) * (85 + e.r)) e.takeDamage(dmg)
    }
  },

  takeDamage(amount) {
    if (!this.alive || this.invincible > 0) return
    if (typeof Audio !== 'undefined') Audio.playerHit()

    // Critical state: one hit = instant death
    if (Tempo.value >= 90) {
      // Last Rites item: one final crash before death
      if (RunState.items.includes('last_rites') && !RunState._lastRitesUsed) {
        RunState._lastRitesUsed = true
        if (Tempo.value >= 50) Tempo.manualCrash(this.x, this.y)
      }
      RunState.hp = 0; this.alive = false; gameState = 'dead'; return
    }

    // Warden passive: taking damage builds Tempo
    if (RunState.chosenClass === 'warden') Tempo._add(10)

    RunState.takeDamage(amount)
    this.hp = RunState.hp; this.maxHp = RunState.maxHp
    shakeIntensity = Math.max(shakeIntensity, 0.45); shakeDuration = 0.2; shakeElapsed = 0
    this.invincible = 0.5

    if (RunState.hp <= 0) {
      // Last Rites: one final crash before death
      if (RunState.items.includes('last_rites') && !RunState._lastRitesUsed) {
        RunState._lastRitesUsed = true
        if (Tempo.value >= 50) Tempo.manualCrash(this.x, this.y)
      }
      this.alive = false; gameState = 'dead'
    }
  },

  draw(ctx) {
    if (!this.alive) return
    if (this.invincible > 0 && Math.floor(this.invincible / 0.08) % 2 === 0) return

    if (this.isCharging) {
      const progress = 1 - this.chargeTimer / this.CHARGE_DUR
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 5 + progress * 10, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(255,200,0,${progress.toFixed(2)})`; ctx.lineWidth = 2; ctx.stroke()
    }

    const col = Tempo.stateColor()
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    ctx.fillStyle = col; ctx.fill()

    // Combo dots
    if (this.comboCount > 0) {
      for (let i = 0; i < this.comboCount; i++) {
        ctx.beginPath(); ctx.arc(this.x - 6 + i * 7, this.y - this.r - 10, 3, 0, Math.PI * 2)
        ctx.fillStyle = col; ctx.fill()
      }
    }

    // Direction indicator toward mouse
    const adx = mouseX - this.x, ady = mouseY - this.y
    const al  = Math.sqrt(adx * adx + ady * ady)
    if (al > 1) {
      ctx.beginPath()
      ctx.moveTo(this.x + (adx / al) * (this.r + 2), this.y + (ady / al) * (this.r + 2))
      ctx.lineTo(this.x + (adx / al) * (this.r + 10), this.y + (ady / al) * (this.r + 10))
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke()
    }
  },
}
