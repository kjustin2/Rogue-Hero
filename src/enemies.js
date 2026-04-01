// ── Enemies ───────────────────────────────────────────────────────────────────

// ── Chaser ────────────────────────────────────────────────────────────────────
class Chaser {
  constructor(x, y) {
    this.x = x; this.y = y
    this.r = 13; this.hp = 20; this.maxHp = 20
    this.alive = true; this.state = 'idle'; this.type = 'chaser'
    this.attackTimer = 0; this.hitFlash = 0; this.staggerTimer = 0
    this.tellTimer = 0   // pre-attack flash duration
  }

  stagger(duration) { this.staggerTimer = Math.max(this.staggerTimer, duration) }

  update(dt) {
    if (!this.alive) return
    this.attackTimer = Math.max(0, this.attackTimer - dt)
    this.hitFlash    = Math.max(0, this.hitFlash    - dt)
    this.tellTimer   = Math.max(0, this.tellTimer   - dt)
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return }

    const dx = Player.x - this.x, dy = Player.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const spd  = 90 * (0.7 + (Tempo.value / 100) * 0.8)

    if (this.state === 'idle' && dist < 320) this.state = 'chase'

    if (this.state === 'chase') {
      if (dist <= 44) {
        this.state = 'attack'
        this.tellTimer = 0.15   // brief flash before first hit
      } else {
        this.x += (dx / dist) * spd * dt
        this.y += (dy / dist) * spd * dt
        const c = Room.clampToFloor(this.x, this.y, this.r)
        this.x = c.x; this.y = c.y
      }
    }

    if (this.state === 'attack') {
      if (dist > 66) {
        this.state = 'chase'
      } else if (this.attackTimer <= 0) {
        this.attackTimer = 1.0
        this.tellTimer   = 0.15   // flash before each repeat hit
        Player.takeDamage(1)
      }
    }
  }

  takeDamage(amount) {
    if (!this.alive) return false
    this.hp -= amount
    this.hitFlash = 0.1
    if (amount > 0) Effects.spawnNumber(this.x, this.y - 20, amount)
    if (this.hp <= 0) {
      this.alive = false
      Effects.spawnBurst(this.x, this.y, '#dd3333')
      Effects.spawnKillFlash('#dd3333')
      onEnemyDied(2)
      return true
    }
    return false
  }

  draw(ctx) {
    if (!this.alive) return
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    const telling = this.tellTimer > 0
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : (telling ? '#ff6666' : '#cc3333')
    ctx.fill()
    if (telling) {
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 5, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,100,100,0.6)'; ctx.lineWidth = 2; ctx.stroke()
    }
    if (this.staggerTimer > 0) {
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 4, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(100,180,255,0.6)'; ctx.lineWidth = 2; ctx.stroke()
    }
    // Type label
    ctx.fillStyle = this.state === 'chase' || this.state === 'attack' ? '#ff8888' : '#884444'
    ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'
    ctx.fillText('CHS', this.x, this.y - this.r - 4)
    if (this.hp < this.maxHp) {
      ctx.fillStyle = '#222'; ctx.fillRect(this.x - 16, this.y - this.r - 10, 32, 4)
      ctx.fillStyle = '#dd4444'; ctx.fillRect(this.x - 16, this.y - this.r - 10, 32 * (this.hp / this.maxHp), 4)
    }
  }
}

// ── Shooter ───────────────────────────────────────────────────────────────────
class Shooter {
  constructor(x, y) {
    this.x = x; this.y = y
    this.r = 12; this.hp = 14; this.maxHp = 14
    this.alive = true; this.type = 'shooter'
    this.fireTimer = 1.0; this.hitFlash = 0; this.staggerTimer = 0
    this.chargeTime = 0   // fill up before shooting (visual tell)
    this.CHARGE_DUR = 0.4
    this._charging = false
  }

  stagger(duration) { this.staggerTimer = Math.max(this.staggerTimer, duration) }

  update(dt) {
    if (!this.alive) return
    this.hitFlash = Math.max(0, this.hitFlash - dt)
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return }

    const dx = Player.x - this.x, dy = Player.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const spd  = 70 * (0.7 + (Tempo.value / 100) * 0.8)

    if (dist < 120) {
      this.x -= (dx / dist) * spd * dt
      this.y -= (dy / dist) * spd * dt
    } else if (dist > 200) {
      this.x += (dx / dist) * spd * 0.5 * dt
      this.y += (dy / dist) * spd * 0.5 * dt
    }
    const c = Room.clampToFloor(this.x, this.y, this.r)
    this.x = c.x; this.y = c.y

    const fireRate = 2.2 * (1.5 - (Tempo.value / 100) * 0.8)
    this.fireTimer -= dt
    if (this.fireTimer <= 0) {
      if (!this._charging) {
        this._charging = true
        this.chargeTime = this.CHARGE_DUR
      }
    }
    if (this._charging) {
      this.chargeTime -= dt
      if (this.chargeTime <= 0) {
        this._charging = false
        this.fireTimer = Math.max(0.5, fireRate)
        this._shoot()
      }
    }
  }

  _shoot() {
    const dx = Player.x - this.x, dy = Player.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 0.1) return
    projectiles.push(new Projectile(this.x, this.y, dx / dist, dy / dist))
  }

  takeDamage(amount) {
    if (!this.alive) return false
    this.hp -= amount
    this.hitFlash = 0.1
    if (amount > 0) Effects.spawnNumber(this.x, this.y - 20, amount)
    if (this.hp <= 0) {
      this.alive = false
      Effects.spawnBurst(this.x, this.y, '#3355cc')
      Effects.spawnKillFlash('#3355cc')
      onEnemyDied(3)
      return true
    }
    return false
  }

  draw(ctx) {
    if (!this.alive) return
    // Charge ring (visual tell before firing)
    if (this._charging) {
      const p = 1 - this.chargeTime / this.CHARGE_DUR
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 6 + p * 4, 0, Math.PI * 2 * p)
      ctx.strokeStyle = `rgba(80,140,255,${(0.4 + p * 0.6).toFixed(2)})`
      ctx.lineWidth = 3; ctx.stroke()
    }
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#3355cc'
    ctx.fill()
    if (this.staggerTimer > 0) {
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 4, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(100,180,255,0.6)'; ctx.lineWidth = 2; ctx.stroke()
    }
    ctx.fillStyle = '#8899ff'
    ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'
    ctx.fillText('SHT', this.x, this.y - this.r - 4)
    if (this.hp < this.maxHp) {
      ctx.fillStyle = '#222'; ctx.fillRect(this.x - 16, this.y - this.r - 10, 32, 4)
      ctx.fillStyle = '#4477dd'; ctx.fillRect(this.x - 16, this.y - this.r - 10, 32 * (this.hp / this.maxHp), 4)
    }
  }
}

// ── Shield Drone ──────────────────────────────────────────────────────────────
class ShieldDrone {
  constructor(x, y) {
    this.x = x; this.y = y
    this.r = 14; this.hp = 28; this.maxHp = 28
    this.alive = true; this.type = 'shielddrone'
    this.hitFlash = 0; this.staggerTimer = 0
    this._attackTimer = 1.5
    this._angle = Math.random() * Math.PI * 2
    this._wasShielded = true
  }

  stagger(duration) { this.staggerTimer = Math.max(this.staggerTimer, duration) }

  update(dt) {
    if (!this.alive) return
    this.hitFlash     = Math.max(0, this.hitFlash     - dt)
    this._attackTimer = Math.max(0, this._attackTimer - dt)
    this._angle += dt * 2.5
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return }

    const dx = Player.x - this.x, dy = Player.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const spd  = 70 * (0.7 + (Tempo.value / 100) * 0.8)

    if (dist > 70) {
      this.x += (dx / dist) * spd * dt
      this.y += (dy / dist) * spd * dt
    }
    const c = Room.clampToFloor(this.x, this.y, this.r)
    this.x = c.x; this.y = c.y

    if (dist < this.r + Player.r + 2 && this._attackTimer <= 0) {
      this._attackTimer = 1.4
      Player.takeDamage(1)
    }

    // Shield just broke — play visual
    const nowShielded = Tempo.value < 70
    if (this._wasShielded && !nowShielded) {
      Effects.spawnBurst(this.x, this.y, '#bb88ff')
    }
    this._wasShielded = nowShielded
  }

  takeDamage(amount) {
    if (!this.alive) return false
    if (Tempo.value < 70) { this.hitFlash = 0.07; return false }
    this.hp -= amount
    this.hitFlash = 0.1
    if (amount > 0) Effects.spawnNumber(this.x, this.y - 20, amount)
    if (this.hp <= 0) {
      this.alive = false
      Effects.spawnBurst(this.x, this.y, '#8844ff')
      Effects.spawnKillFlash('#8844ff')
      onEnemyDied(4)
      return true
    }
    return false
  }

  draw(ctx) {
    if (!this.alive) return
    const shielded = Tempo.value < 70
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#8844ff'
    ctx.fill()

    if (shielded) {
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this._angle)
      ctx.beginPath(); ctx.arc(0, 0, this.r + 8, 0, Math.PI * 1.4)
      ctx.strokeStyle = '#bb88ff'; ctx.lineWidth = 3; ctx.stroke()
      ctx.rotate(Math.PI)
      ctx.beginPath(); ctx.arc(0, 0, this.r + 8, 0, Math.PI * 1.4)
      ctx.stroke(); ctx.restore()
    }

    // Label shows lock icon when shielded
    ctx.fillStyle = shielded ? '#cc99ff' : '#9966cc'
    ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'
    ctx.fillText(shielded ? 'SHD🔒' : 'SHD', this.x, this.y - this.r - 4)

    if (this.hp < this.maxHp) {
      ctx.fillStyle = '#222'; ctx.fillRect(this.x - 16, this.y - this.r - 10, 32, 4)
      ctx.fillStyle = shielded ? '#8844ff' : '#aa66ff'
      ctx.fillRect(this.x - 16, this.y - this.r - 10, 32 * (this.hp / this.maxHp), 4)
    }
  }
}

// ── Tempo Vampire ─────────────────────────────────────────────────────────────
class TempoVampire {
  constructor(x, y) {
    this.x = x; this.y = y
    this.r = 13; this.hp = 18; this.maxHp = 18
    this.alive = true; this.state = 'idle'; this.type = 'tempovampire'
    this.attackTimer = 0; this.hitFlash = 0; this.staggerTimer = 0
    this.tellTimer = 0
  }

  stagger(duration) { this.staggerTimer = Math.max(this.staggerTimer, duration) }

  update(dt) {
    if (!this.alive) return
    this.attackTimer = Math.max(0, this.attackTimer - dt)
    this.hitFlash    = Math.max(0, this.hitFlash    - dt)
    this.tellTimer   = Math.max(0, this.tellTimer   - dt)
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return }

    const dx = Player.x - this.x, dy = Player.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const spd  = 105 * (0.7 + (Tempo.value / 100) * 0.8)

    if (this.state === 'idle' && dist < 320) this.state = 'chase'

    if (this.state === 'chase') {
      if (dist <= 44) { this.state = 'attack'; this.tellTimer = 0.2 }
      else {
        this.x += (dx / dist) * spd * dt; this.y += (dy / dist) * spd * dt
        const c = Room.clampToFloor(this.x, this.y, this.r)
        this.x = c.x; this.y = c.y
      }
    }

    if (this.state === 'attack') {
      if (dist > 66) {
        this.state = 'chase'
      } else if (this.attackTimer <= 0) {
        this.attackTimer = 1.2
        this.tellTimer   = 0.2
        Player.takeDamage(1)
        Tempo.onDrained()
        Effects.spawnTempoSuck(this.x, this.y)
        if (typeof Audio !== 'undefined') Audio.drain()
      }
    }
  }

  takeDamage(amount) {
    if (!this.alive) return false
    this.hp -= amount
    this.hitFlash = 0.1
    if (amount > 0) Effects.spawnNumber(this.x, this.y - 20, amount)
    if (this.hp <= 0) {
      this.alive = false
      Effects.spawnBurst(this.x, this.y, '#cc44aa')
      Effects.spawnKillFlash('#cc44aa')
      onEnemyDied(3)
      return true
    }
    return false
  }

  draw(ctx) {
    if (!this.alive) return
    const telling = this.tellTimer > 0
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : (telling ? '#ff88cc' : '#cc44aa')
    ctx.fill()
    if (telling) {
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 5, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(220,80,180,0.7)'; ctx.lineWidth = 2; ctx.stroke()
    }
    if (this.staggerTimer > 0) {
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 4, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(100,180,255,0.6)'; ctx.lineWidth = 2; ctx.stroke()
    }
    ctx.fillStyle = this.state !== 'idle' ? '#ff88cc' : '#884466'
    ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'
    ctx.fillText('VMP', this.x, this.y - this.r - 4)
    if (this.hp < this.maxHp) {
      ctx.fillStyle = '#222'; ctx.fillRect(this.x - 16, this.y - this.r - 10, 32, 4)
      ctx.fillStyle = '#dd55bb'; ctx.fillRect(this.x - 16, this.y - this.r - 10, 32 * (this.hp / this.maxHp), 4)
    }
  }
}

// ── Berserker ─────────────────────────────────────────────────────────────────
class Berserker {
  constructor(x, y) {
    this.x = x; this.y = y
    this.r = 16; this.hp = 35; this.maxHp = 35
    this.alive = true; this.state = 'idle'; this.type = 'berserker'
    this.attackTimer = 0; this.hitFlash = 0; this.staggerTimer = 0
  }

  stagger(duration) { this.staggerTimer = Math.max(this.staggerTimer, duration) }

  _speed() {
    const hpFrac = this.hp / this.maxHp
    const base   = 70 * (0.7 + (Tempo.value / 100) * 0.8)
    const rage   = hpFrac > 0.5 ? 1.0 : (1.0 + (0.5 - hpFrac) * 3.0)  // up to 2.5x
    return base * rage
  }

  update(dt) {
    if (!this.alive) return
    this.attackTimer = Math.max(0, this.attackTimer - dt)
    this.hitFlash    = Math.max(0, this.hitFlash    - dt)
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return }

    const dx = Player.x - this.x, dy = Player.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const spd = this._speed()

    if (this.state === 'idle' && dist < 350) this.state = 'chase'

    if (this.state === 'chase') {
      if (dist <= this.r + Player.r + 4) {
        this.state = 'attack'
      } else {
        this.x += (dx / dist) * spd * dt; this.y += (dy / dist) * spd * dt
        const c = Room.clampToFloor(this.x, this.y, this.r)
        this.x = c.x; this.y = c.y
      }
    }
    if (this.state === 'attack') {
      if (dist > this.r + Player.r + 20) {
        this.state = 'chase'
      } else if (this.attackTimer <= 0) {
        this.attackTimer = 0.8
        Player.takeDamage(2)
      }
    }
  }

  takeDamage(amount) {
    if (!this.alive) return false
    this.hp -= amount
    this.hitFlash = 0.1
    if (amount > 0) Effects.spawnNumber(this.x, this.y - 22, amount)
    if (this.hp <= 0) {
      this.alive = false
      Effects.spawnBurst(this.x, this.y, '#ff6600')
      Effects.spawnKillFlash('#ff6600')
      onEnemyDied(5)
      return true
    }
    return false
  }

  draw(ctx) {
    if (!this.alive) return
    const enraged = this.hp / this.maxHp <= 0.5
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : (enraged ? '#ff4400' : '#cc6600')
    ctx.fill()
    if (enraged) {
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 5, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,100,0,0.55)'; ctx.lineWidth = 3; ctx.stroke()
    }
    if (this.staggerTimer > 0) {
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 4, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(100,180,255,0.6)'; ctx.lineWidth = 2; ctx.stroke()
    }
    ctx.fillStyle = enraged ? '#ff8800' : '#cc8800'
    ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'
    ctx.fillText('BSK', this.x, this.y - this.r - 4)
    if (this.hp < this.maxHp) {
      ctx.fillStyle = '#222'; ctx.fillRect(this.x - 16, this.y - this.r - 10, 32, 4)
      ctx.fillStyle = enraged ? '#ff4400' : '#cc6600'
      ctx.fillRect(this.x - 16, this.y - this.r - 10, 32 * (this.hp / this.maxHp), 4)
    }
  }
}

// ── Projectile ────────────────────────────────────────────────────────────────
class Projectile {
  constructor(x, y, dx, dy) {
    this.x = x; this.y = y
    this.dx = dx; this.dy = dy
    this.speed = 260; this.r = 5
    this.alive = true; this.life = 3.0
  }

  update(dt) {
    if (!this.alive) return
    this.life -= dt
    if (this.life <= 0) { this.alive = false; return }
    this.x += this.dx * this.speed * dt
    this.y += this.dy * this.speed * dt
    if (this.x < FLOOR_X1 || this.x > FLOOR_X2 || this.y < FLOOR_Y1 || this.y > FLOOR_Y2) {
      this.alive = false; return
    }
    // Also die on pillars
    for (const p of Room.pillars) {
      if (this.x >= p.x && this.x <= p.x + p.w && this.y >= p.y && this.y <= p.y + p.h) {
        this.alive = false; return
      }
    }
    const dx = this.x - Player.x, dy = this.y - Player.y
    if (dx * dx + dy * dy < (this.r + Player.r) * (this.r + Player.r)) {
      Player.takeDamage(1)
      this.alive = false
    }
  }

  draw(ctx) {
    if (!this.alive) return
    ctx.fillStyle = '#ff8800'
    ctx.fillRect(this.x - this.r, this.y - this.r, this.r * 2, this.r * 2)
  }
}

// ── TheBrawler (Floor 1 Boss) ─────────────────────────────────────────────────
class TheBrawler {
  constructor(x, y) {
    this.x = x; this.y = y
    this.r = 30; this.hp = 80; this.maxHp = 80
    this.alive = true; this.type = 'brawler'
    this.hitFlash = 0; this.staggerTimer = 0
    this.attackTimer = 0
    this.dashTimer   = 4.5
    this.dashActive  = false
    this.dashDirX    = 0; this.dashDirY = 0
    this.dashDur     = 0
    this.hasSplit    = false
  }

  stagger(duration) { this.staggerTimer = Math.max(this.staggerTimer, duration) }

  update(dt) {
    if (!this.alive) return
    this.hitFlash    = Math.max(0, this.hitFlash    - dt)
    this.attackTimer = Math.max(0, this.attackTimer - dt)
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return }

    // Phase 2 split at 50% HP
    if (!this.hasSplit && this.hp <= this.maxHp * 0.5) {
      this.hasSplit = true
      this._splitPhase()
      return
    }

    const dx = Player.x - this.x, dy = Player.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    // Dash every 4.5s
    this.dashTimer -= dt
    if (this.dashTimer <= 0 && !this.dashActive) {
      this.dashTimer = 4.5
      this._startDash()
    }

    if (this.dashActive) {
      this.dashDur -= dt
      this.x += this.dashDirX * 600 * dt
      this.y += this.dashDirY * 600 * dt
      const c = Room.clampToFloor(this.x, this.y, this.r)
      this.x = c.x; this.y = c.y
      if (this.dashDur <= 0) this.dashActive = false
      if (dist < this.r + Player.r + 4 && this.attackTimer <= 0) {
        this.attackTimer = 0.5; Player.takeDamage(2)
      }
    } else {
      const spd = 135 * (0.7 + (Tempo.value / 100) * 0.8)
      if (dist > this.r + Player.r) {
        this.x += (dx / dist) * spd * dt; this.y += (dy / dist) * spd * dt
        const c = Room.clampToFloor(this.x, this.y, this.r)
        this.x = c.x; this.y = c.y
      } else if (this.attackTimer <= 0) {
        this.attackTimer = 0.9; Player.takeDamage(1)
      }
    }
  }

  _startDash() {
    const dx = Player.x - this.x, dy = Player.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 1) return
    this.dashDirX   = dx / dist; this.dashDirY = dy / dist
    this.dashActive = true; this.dashDur = 0.3
    this.hitFlash   = 0.25   // brief white tell
  }

  _splitPhase() {
    this.alive = false
    enemies.push(new Chaser(this.x - 35, this.y))
    enemies.push(new Chaser(this.x + 35, this.y))
    Effects.spawnBurst(this.x, this.y, '#ff4400')
    Effects.spawnCrashBurst(this.x, this.y, 65)
    if (typeof Audio !== 'undefined') Audio.bossPhase()
  }

  takeDamage(amount) {
    if (!this.alive) return false
    this.hp -= amount
    this.hitFlash = 0.08
    if (amount > 0) Effects.spawnNumber(this.x, this.y - 36, amount)
    if (this.hp <= 0) {
      this.alive = false
      Effects.spawnBurst(this.x, this.y, '#ff2200')
      Effects.spawnCrashBurst(this.x, this.y, 85)
      onEnemyDied(10)
      return true
    }
    return false
  }

  draw(ctx) {
    if (!this.alive) return
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#cc2200'
    ctx.fill()
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 4, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,80,0,0.45)'; ctx.lineWidth = 3; ctx.stroke()
    ctx.fillStyle = '#ff4400'
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'
    ctx.fillText('BRAWLER', this.x, this.y - this.r - 12)
    ctx.fillStyle = '#222'; ctx.fillRect(this.x - 28, this.y - this.r - 10, 56, 5)
    ctx.fillStyle = '#ff4400'; ctx.fillRect(this.x - 28, this.y - this.r - 10, 56 * Math.max(0, this.hp / this.maxHp), 5)
  }
}

// ── TheConductor (Floor 2 Boss) ───────────────────────────────────────────────
class TheConductor {
  constructor(x, y) {
    this.x = x; this.y = y
    this.r = 28; this.hp = 120; this.maxHp = 120
    this.alive = true; this.type = 'conductor'
    this.hitFlash = 0; this.staggerTimer = 0
    this.fireTimer  = 3.0
    this.droneTimer = 20.0
    this.phase = 1
    this._angle = 0
  }

  stagger(duration) { this.staggerTimer = Math.max(this.staggerTimer, duration) }

  _isImmune() { return enemies.some(e => e !== this && e.alive && e.type === 'shielddrone') }

  update(dt) {
    if (!this.alive) return
    this.hitFlash = Math.max(0, this.hitFlash - dt)
    this._angle += dt * 1.5
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return }

    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2
      if (typeof Audio !== 'undefined') Audio.bossPhase()
    }

    const dx = Player.x - this.x, dy = Player.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const spd  = 50 * (0.7 + (Tempo.value / 100) * 0.5)

    if (dist < 180) {
      this.x -= (dx / dist) * spd * dt; this.y -= (dy / dist) * spd * dt
    } else if (dist > 280) {
      this.x += (dx / dist) * spd * 0.5 * dt; this.y += (dy / dist) * spd * 0.5 * dt
    }
    const c = Room.clampToFloor(this.x, this.y, this.r)
    this.x = c.x; this.y = c.y

    const baseRate = this.phase === 2 ? 1.8 : 2.8
    const fireRate = Math.max(0.45, baseRate * (1.5 - (Tempo.value / 100) * 0.6))
    this.fireTimer -= dt
    if (this.fireTimer <= 0) {
      this.fireTimer = fireRate
      this._shoot()
    }

    const droneRate = this.phase === 2 ? 12.0 : 20.0
    this.droneTimer -= dt
    if (this.droneTimer <= 0) {
      this.droneTimer = droneRate
      const drones = enemies.filter(e => e.alive && e.type === 'shielddrone')
      if (drones.length < 2) {
        const angle  = Math.random() * Math.PI * 2
        const spawnX = this.x + Math.cos(angle) * 90
        const spawnY = this.y + Math.sin(angle) * 90
        const nc     = Room.clampToFloor(spawnX, spawnY, 14)
        enemies.push(new ShieldDrone(nc.x, nc.y))
      }
    }
  }

  _shoot() {
    const shots = this.phase === 2 ? 5 : 3
    const adx = Player.x - this.x, ady = Player.y - this.y
    const baseAngle = Math.atan2(ady, adx)
    const spread = 0.45
    for (let i = 0; i < shots; i++) {
      const angle = baseAngle + (i - (shots - 1) / 2) * spread
      projectiles.push(new Projectile(this.x, this.y, Math.cos(angle), Math.sin(angle)))
    }
  }

  takeDamage(amount) {
    if (!this.alive) return false
    if (this._isImmune()) { this.hitFlash = 0.05; return false }
    this.hp -= amount
    this.hitFlash = 0.08
    if (amount > 0) Effects.spawnNumber(this.x, this.y - 34, amount)
    if (this.hp <= 0) {
      this.alive = false
      Effects.spawnBurst(this.x, this.y, '#aa44ff')
      Effects.spawnCrashBurst(this.x, this.y, 95)
      onEnemyDied(15)
      return true
    }
    return false
  }

  draw(ctx) {
    if (!this.alive) return
    const immune = this._isImmune()
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : (immune ? '#665588' : '#9944cc')
    ctx.fill()
    if (immune) {
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this._angle)
      for (let i = 0; i < 3; i++) {
        ctx.rotate(Math.PI * 2 / 3)
        ctx.beginPath(); ctx.arc(0, 0, this.r + 11, 0, Math.PI * 0.75)
        ctx.strokeStyle = '#cc88ff'; ctx.lineWidth = 3; ctx.stroke()
      }
      ctx.restore()
    }
    ctx.fillStyle = immune ? '#cc88ff' : '#aa44ff'
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'
    ctx.fillText(immune ? 'CONDUCTOR [IMMUNE]' : 'CONDUCTOR', this.x, this.y - this.r - 12)
    ctx.fillStyle = '#222'; ctx.fillRect(this.x - 28, this.y - this.r - 10, 56, 5)
    ctx.fillStyle = '#aa44ff'; ctx.fillRect(this.x - 28, this.y - this.r - 10, 56 * Math.max(0, this.hp / this.maxHp), 5)
  }
}

// ── TheEcho (Final Boss — Floor 3) ────────────────────────────────────────────
class TheEcho {
  constructor(x, y) {
    this.x = x; this.y = y
    this.r = 38; this.hp = 200; this.maxHp = 200
    this.alive = true; this.type = 'theecho'
    this.hitFlash = 0; this.staggerTimer = 0
    this.attackTimer = 0
    this.fireTimer   = 2.2
    this.phase = 1
    this.bossTempoVal = 0
    this.spawnTimer  = 15.0
    this._angle = 0
    this._dying = false
  }

  stagger(duration) { this.staggerTimer = Math.max(this.staggerTimer, duration) }

  update(dt) {
    if (!this.alive || this._dying) return
    this.hitFlash    = Math.max(0, this.hitFlash    - dt)
    this.attackTimer = Math.max(0, this.attackTimer - dt)
    this._angle += dt

    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return }

    if (this.phase === 1 && this.hp <= this.maxHp * 0.66) {
      this.phase = 2; if (typeof Audio !== 'undefined') Audio.bossPhase()
    }
    if (this.phase === 2 && this.hp <= this.maxHp * 0.33) {
      this.phase = 3; if (typeof Audio !== 'undefined') Audio.bossPhase()
    }

    const dx = Player.x - this.x, dy = Player.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const spd  = (this.phase >= 2 ? 110 : 75) * (0.7 + (Tempo.value / 100) * 0.8)

    if (dist > this.r + Player.r + 8) {
      this.x += (dx / dist) * spd * dt; this.y += (dy / dist) * spd * dt
    } else if (this.attackTimer <= 0) {
      this.attackTimer = 1.0; Player.takeDamage(1)
    }
    const c = Room.clampToFloor(this.x, this.y, this.r)
    this.x = c.x; this.y = c.y

    // Fire pattern
    const fireRate = this.phase >= 3 ? 1.1 : (this.phase === 2 ? 1.5 : 2.0)
    this.fireTimer -= dt
    if (this.fireTimer <= 0) {
      this.fireTimer = fireRate; this._shoot()
    }

    // Phase 2+: Boss Tempo bar
    if (this.phase >= 2) {
      const riseRate = this.phase >= 3 ? 35 : 20
      this.bossTempoVal += riseRate * dt
      if (this.bossTempoVal >= 100) {
        this.bossTempoVal = 45
        // Boss crash — damages player if in range
        const cr = 90
        const pdx = Player.x - this.x, pdy = Player.y - this.y
        if (pdx * pdx + pdy * pdy < (cr + Player.r) * (cr + Player.r)) Player.takeDamage(1)
        Effects.spawnCrashBurst(this.x, this.y, cr)
        if (typeof Audio !== 'undefined') Audio.crash()
      }
    }

    // Phase 3: spawn enemies periodically
    if (this.phase >= 3) {
      this.spawnTimer -= dt
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 14.0; this._spawnEnemy()
      }
    }
  }

  _shoot() {
    const adx = Player.x - this.x, ady = Player.y - this.y
    const baseAngle = Math.atan2(ady, adx)
    const shots  = this.phase >= 3 ? 4 : (this.phase === 2 ? 3 : 2)
    const spread = 0.32
    for (let i = 0; i < shots; i++) {
      const angle = baseAngle + (i - (shots - 1) / 2) * spread
      projectiles.push(new Projectile(this.x, this.y, Math.cos(angle), Math.sin(angle)))
    }
  }

  _spawnEnemy() {
    const types = [Chaser, Shooter, TempoVampire]
    const T = types[Math.floor(Math.random() * types.length)]
    const sx = FLOOR_X1 + 100 + Math.random() * (FLOOR_X2 - FLOOR_X1 - 200)
    const sy = FLOOR_Y1 + 80  + Math.random() * (FLOOR_Y2 - FLOOR_Y1 - 160)
    enemies.push(new T(sx, sy))
  }

  takeDamage(amount) {
    if (!this.alive) return false
    this.hp -= amount
    this.hitFlash = 0.08
    if (amount > 0) Effects.spawnNumber(this.x, this.y - 48, amount)
    if (this.hp <= 0 && !this._dying) {
      this._dying = true
      this.alive = false
      Effects.spawnBurst(this.x, this.y, '#cc44cc')
      Effects.spawnCrashBurst(this.x, this.y, 130)
      onEnemyDied(20)
      return true
    }
    return false
  }

  draw(ctx) {
    if (!this.alive) return
    // Pulse ring
    const pr = this.r + 7 + Math.sin(this._angle * 3) * 4
    ctx.beginPath(); ctx.arc(this.x, this.y, Math.max(0, pr), 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(180,80,220,0.38)'; ctx.lineWidth = 3; ctx.stroke()

    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#7722aa'
    ctx.fill()

    // Boss Tempo bar (phase 2+)
    if (this.phase >= 2) {
      const bw = 64, bh = 6
      const bx = this.x - bw / 2, by = this.y - this.r - 22
      ctx.fillStyle = '#222'; ctx.fillRect(bx, by, bw, bh)
      const bCol = this.bossTempoVal >= 90 ? '#ff3333' : (this.bossTempoVal >= 70 ? '#ff8800' : '#aa44cc')
      ctx.fillStyle = bCol; ctx.fillRect(bx, by, bw * (this.bossTempoVal / 100), bh)
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '7px monospace'; ctx.textAlign = 'center'
      ctx.fillText('BOSS TEMPO', this.x, by - 1)
    }

    ctx.fillStyle = '#cc66ff'
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'
    ctx.fillText('THE ECHO', this.x, this.y - this.r - (this.phase >= 2 ? 30 : 12))
    ctx.fillStyle = '#222'; ctx.fillRect(this.x - 32, this.y - this.r - 12 + (this.phase >= 2 ? -18 : 0), 64, 5)
    ctx.fillStyle = '#cc44cc'
    ctx.fillRect(this.x - 32, this.y - this.r - 12 + (this.phase >= 2 ? -18 : 0), 64 * Math.max(0, this.hp / this.maxHp), 5)
  }
}
