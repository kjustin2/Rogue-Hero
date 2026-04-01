// ── Player ────────────────────────────────────────────────────────────────────
const Player = {
  x: 200, y: 360,
  r: 16,
  vx: 0, vy: 0,
  hp: 0, maxHp: 0,
  alive: true,
  invincible: 0,       // seconds remaining
  ACCEL:   2000,
  FRICTION: 1800,
  SPEED:    280,

  // Dodge state
  dodging:      false,
  dodgeTimer:   0,
  dodgeDirX:    0,
  dodgeDirY:    0,
  DODGE_SPEED:  520,
  DODGE_DUR:    0.18,
  dodgeCooldown: 0,
  DODGE_CD:     0.55,
  trailTimer:   0,

  // Attack
  attackCooldown: 0,
  ATTACK_CD:      0.25,

  init() {
    this.x = 200; this.y = 360
    this.vx = 0;  this.vy = 0
    this.hp = RunState.maxHp
    this.maxHp = RunState.maxHp
    this.alive = true
    this.invincible = 0
    this.dodging = false
    this.dodgeTimer = 0
    this.dodgeCooldown = 0
    this.attackCooldown = 0
    // Enter starting cell
    this._lastCell = Pressure._cell(this.x, this.y)
    Pressure.enterCell(this.x, this.y)
  },

  update(dt) {
    if (!this.alive) return

    this.invincible    = Math.max(0, this.invincible    - dt)
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)
    this.dodgeCooldown  = Math.max(0, this.dodgeCooldown  - dt)

    // ── Attack ────────────────────────────────────────────────────────────────
    if (mouseClicked && this.attackCooldown <= 0 && !this.dodging) {
      this._tryAttack()
    }

    // ── Dodge (Space) ─────────────────────────────────────────────────────────
    if (!this.dodging && keys.has(' ') && this.dodgeCooldown <= 0) {
      const mx = (keys.has('a') || keys.has('arrowleft'))  ? -1
               : (keys.has('d') || keys.has('arrowright')) ?  1 : 0
      const my = (keys.has('w') || keys.has('arrowup'))    ? -1
               : (keys.has('s') || keys.has('arrowdown'))  ?  1 : 0
      // Dodge toward mouse if standing still
      let ddx = mx, ddy = my
      if (ddx === 0 && ddy === 0) {
        ddx = mouseX - this.x
        ddy = mouseY - this.y
      }
      const dl = Math.sqrt(ddx * ddx + ddy * ddy)
      if (dl > 0.1) {
        this.dodgeDirX = ddx / dl
        this.dodgeDirY = ddy / dl
        this.dodging = true
        this.dodgeTimer = this.DODGE_DUR
        this.dodgeCooldown = this.DODGE_CD
        this.invincible = this.DODGE_DUR
        this.trailTimer = 0
        Tempo.onDodge()
      }
    }

    // ── Movement ──────────────────────────────────────────────────────────────
    if (this.dodging) {
      this.dodgeTimer -= dt
      this.trailTimer -= dt
      if (this.trailTimer <= 0) {
        Effects.spawnTrail(this.x, this.y)
        this.trailTimer = 0.04
      }
      this.x += this.dodgeDirX * this.DODGE_SPEED * dt
      this.y += this.dodgeDirY * this.DODGE_SPEED * dt
      if (this.dodgeTimer <= 0) {
        this.dodging = false
        this.vx = this.dodgeDirX * this.SPEED * 0.4
        this.vy = this.dodgeDirY * this.SPEED * 0.4
      }
    } else {
      let ix = 0, iy = 0
      if (keys.has('a') || keys.has('arrowleft'))  ix -= 1
      if (keys.has('d') || keys.has('arrowright')) ix += 1
      if (keys.has('w') || keys.has('arrowup'))    iy -= 1
      if (keys.has('s') || keys.has('arrowdown'))  iy += 1

      if (ix !== 0 || iy !== 0) {
        const il = Math.sqrt(ix * ix + iy * iy)
        ix /= il; iy /= il
        this.vx += ix * this.ACCEL * dt
        this.vy += iy * this.ACCEL * dt
        const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy)
        if (spd > this.SPEED) {
          this.vx = (this.vx / spd) * this.SPEED
          this.vy = (this.vy / spd) * this.SPEED
        }
      } else {
        const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy)
        const friction = Math.min(spd, this.FRICTION * dt)
        if (spd > 0) {
          this.vx -= (this.vx / spd) * friction
          this.vy -= (this.vy / spd) * friction
        }
      }

      this.x += this.vx * dt
      this.y += this.vy * dt
    }

    // Clamp to floor
    const c = Room.clampToFloor(this.x, this.y, this.r)
    this.x = c.x; this.y = c.y

    // ── Pressure cell tracking ─────────────────────────────────────────────
    const newCell = Pressure._cell(this.x, this.y)
    if (this._lastCell &&
        (newCell.col !== this._lastCell.col || newCell.row !== this._lastCell.row)) {
      Pressure.exitCell(
        this._lastCell.col * CELL_SIZE + CELL_SIZE / 2,
        this._lastCell.row * CELL_SIZE + CELL_SIZE / 2
      )
      Pressure.enterCell(this.x, this.y)
      this._lastCell = newCell
    }
  },

  _tryAttack() {
    // Find nearest enemy within range
    const RANGE = 80
    let nearest = null
    let nearestDist = Infinity
    for (const e of enemies) {
      if (!e.alive) continue
      const dx = e.x - this.x, dy = e.y - this.y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < RANGE + e.r && d < nearestDist) {
        nearest = e
        nearestDist = d
      }
    }
    if (!nearest) return

    this.attackCooldown = this.ATTACK_CD
    const dmg = Math.round(RunState.power * Tempo.damageMultiplier())
    const killed = nearest.takeDamage(dmg)
    hitStopTimer = 0.06
    Tempo.onAttack()
    if (killed) Tempo.onKill()
  },

  takeDamage(amount) {
    if (!this.alive || this.invincible > 0) return
    RunState.takeDamage(amount)
    this.hp = RunState.hp
    this.maxHp = RunState.maxHp
    shakeIntensity = Math.max(shakeIntensity, 0.45)
    shakeDuration  = 0.2
    shakeElapsed   = 0
    this.invincible = 0.5
    if (RunState.hp <= 0) {
      this.alive = false
      gameState = 'dead'
    }
  },

  draw(ctx) {
    if (!this.alive) return
    // Flash white when invincible (blink)
    if (this.invincible > 0 && Math.floor(this.invincible / 0.08) % 2 === 0) return

    const col = Tempo.stateColor()
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    ctx.fillStyle = col
    ctx.fill()

    // Direction indicator (toward mouse)
    const adx = mouseX - this.x, ady = mouseY - this.y
    const al = Math.sqrt(adx * adx + ady * ady)
    if (al > 1) {
      ctx.beginPath()
      ctx.moveTo(this.x + (adx / al) * (this.r + 2), this.y + (ady / al) * (this.r + 2))
      ctx.lineTo(this.x + (adx / al) * (this.r + 9), this.y + (ady / al) * (this.r + 9))
      ctx.strokeStyle = col
      ctx.lineWidth = 3
      ctx.stroke()
    }
  }
}
