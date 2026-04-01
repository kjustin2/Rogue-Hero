// ── Pressure Grid ─────────────────────────────────────────────────────────────
// Cells build pressure while occupied. Instant shockwave on exit.
const Pressure = {
  grid: {},        // "col,row" -> 0.0–1.0
  occupied: {},    // "col,row" -> true
  playerCell: null,
  BUILD_RATE:    2.2,
  LEAK_RATE:     0.4,
  DAMAGE_BASE:  12,

  get buildMult() { return RunState.items.includes('anchor_stone') ? 1.5 : 1.0 },

  init() {
    this.grid = {}
    this.occupied = {}
    this.playerCell = null
    for (let col = 1; col <= 17; col++)
      for (let row = 1; row <= 9; row++)
        this.grid[`${col},${row}`] = 0
  },

  update(dt) {
    for (const key in this.grid) {
      if (this.occupied[key]) {
        this.grid[key] = Math.min(1, this.grid[key] + this.BUILD_RATE * this.buildMult * dt)
      } else {
        this.grid[key] = Math.max(0, this.grid[key] - this.LEAK_RATE * dt)
      }
    }
  },

  enterCell(x, y) {
    const { col, row } = this._cell(x, y)
    this.occupied[`${col},${row}`] = true
    this.playerCell = { col, row }
  },

  exitCell(x, y) {
    const { col, row } = this._cell(x, y)
    const key = `${col},${row}`
    delete this.occupied[key]
    const p = this.grid[key] || 0
    if (p > 0.05) {
      this._releaseShockwave(col, row, p)
      this.grid[key] = 0
    }
  },

  _releaseShockwave(col, row, pressure) {
    const wx = col * CELL_SIZE + CELL_SIZE / 2
    const wy = row * CELL_SIZE + CELL_SIZE / 2
    const radius = RunState.pressureRadius * (0.5 + pressure * 0.5)
    const damage = Math.round(this.DAMAGE_BASE * pressure * RunState.power * Tempo.damageMultiplier())

    Effects.spawnRing(wx, wy, radius, pressure)
    shakeIntensity = Math.max(shakeIntensity, pressure * 0.6)
    shakeDuration  = 0.18
    shakeElapsed   = 0

    for (const e of enemies) {
      if (!e.alive) continue
      const dx = e.x - wx, dy = e.y - wy
      if (dx * dx + dy * dy <= radius * radius) e.takeDamage(damage)
    }
  },

  _cell(x, y) {
    return { col: Math.floor(x / CELL_SIZE), row: Math.floor(y / CELL_SIZE) }
  },

  draw(ctx) {
    for (const key in this.grid) {
      const p = this.grid[key]
      if (p < 0.05) continue
      const [col, row] = key.split(',').map(Number)
      const rx = col * CELL_SIZE, ry = row * CELL_SIZE
      const isPlayer = this.playerCell &&
                       this.playerCell.col === col &&
                       this.playerCell.row === row
      ctx.save()
      if (isPlayer) {
        ctx.fillStyle = `rgba(255, 235, 77, ${(p * 0.65).toFixed(2)})`
      } else {
        const g = Math.round((0.3 + p * 0.4) * 255)
        ctx.fillStyle = `rgba(255, ${g}, 26, ${(p * 0.45).toFixed(2)})`
      }
      ctx.fillRect(rx, ry, CELL_SIZE, CELL_SIZE)
      if (p > 0.7) {
        ctx.strokeStyle = `rgba(255, 217, 51, ${(p * 0.9).toFixed(2)})`
        ctx.lineWidth = 2
        ctx.strokeRect(rx + 1, ry + 1, CELL_SIZE - 2, CELL_SIZE - 2)
      }
      ctx.restore()
    }
  }
}
