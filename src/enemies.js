// ── Enemies ───────────────────────────────────────────────────────────────────

class Chaser {
  constructor(x, y) {
    this.x = x; this.y = y
    this.r = 13; this.hp = 20; this.maxHp = 20
    this.alive = true; this.state = 'idle'
    this.attackTimer = 0; this.hitFlash = 0
  }

  update(dt) {
    if (!this.alive) return
    this.attackTimer = Math.max(0, this.attackTimer - dt)
    this.hitFlash    = Math.max(0, this.hitFlash    - dt)

    const dx = Player.x - this.x, dy = Player.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const spd  = 90 * (0.7 + (Tempo.value / 100) * 0.8)

    if (this.state === 'idle' && dist < 320) this.state = 'chase'

    if (this.state === 'chase') {
      if (dist <= 44) {
        this.state = 'attack'
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
        Player.takeDamage(1)
      }
    }
  }

  takeDamage(amount) {
    if (!this.alive) return false
    this.hp -= amount
    this.hitFlash = 0.1
    Effects.spawnNumber(this.x, this.y - 20, amount)
    if (this.hp <= 0) {
      this.alive = false
      Effects.spawnBurst(this.x, this.y, '#dd3333')
      RunState.addXP(2)
      return true
    }
    return false
  }

  draw(ctx) {
    if (!this.alive) return
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#cc3333'
    ctx.fill()
    if (this.hp < this.maxHp) {
      ctx.fillStyle = '#222'
      ctx.fillRect(this.x - 16, this.y - this.r - 9, 32, 4)
      ctx.fillStyle = '#dd4444'
      ctx.fillRect(this.x - 16, this.y - this.r - 9, 32 * (this.hp / this.maxHp), 4)
    }
  }
}

class Shooter {
  constructor(x, y) {
    this.x = x; this.y = y
    this.r = 12; this.hp = 14; this.maxHp = 14
    this.alive = true; this.fireTimer = 1.0; this.hitFlash = 0
  }

  update(dt) {
    if (!this.alive) return
    this.hitFlash = Math.max(0, this.hitFlash - dt)

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
      this.fireTimer = fireRate
      this._shoot()
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
    Effects.spawnNumber(this.x, this.y - 20, amount)
    if (this.hp <= 0) {
      this.alive = false
      Effects.spawnBurst(this.x, this.y, '#3355cc')
      RunState.addXP(3)
      return true
    }
    return false
  }

  draw(ctx) {
    if (!this.alive) return
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#3355cc'
    ctx.fill()
    if (this.hp < this.maxHp) {
      ctx.fillStyle = '#222'
      ctx.fillRect(this.x - 16, this.y - this.r - 9, 32, 4)
      ctx.fillStyle = '#4477dd'
      ctx.fillRect(this.x - 16, this.y - this.r - 9, 32 * (this.hp / this.maxHp), 4)
    }
  }
}

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
