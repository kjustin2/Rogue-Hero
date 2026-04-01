// ── Room ──────────────────────────────────────────────────────────────────────
const roomConfigs = [
  { enemies: [
    { type: 'chaser',       x: 900, y: 220 },
    { type: 'chaser',       x: 800, y: 540 },
    { type: 'shooter',      x: 720, y: 380 },
  ]},
  { enemies: [
    { type: 'chaser',       x: 850, y: 200 },
    { type: 'tempovampire', x: 950, y: 500 },
    { type: 'shooter',      x: 640, y: 300 },
    { type: 'shielddrone',  x: 780, y: 460 },
  ]},
  { enemies: [
    { type: 'chaser',       x: 700, y: 200 },
    { type: 'tempovampire', x: 960, y: 360 },
    { type: 'shielddrone',  x: 820, y: 520 },
    { type: 'shooter',      x: 600, y: 310 },
    { type: 'shielddrone',  x: 1010, y: 440 },
  ]},
]

const Room = {
  index:    0,
  cleared:  false,
  exitOpen: false,

  load(index) {
    this.index    = index
    this.cleared  = false
    this.exitOpen = false
    RunState.room = index + 1
    enemies     = []
    projectiles = []
    const cfg = roomConfigs[index % roomConfigs.length]
    for (const s of cfg.enemies) {
      switch (s.type) {
        case 'chaser':       enemies.push(new Chaser(s.x, s.y));       break
        case 'shooter':      enemies.push(new Shooter(s.x, s.y));      break
        case 'shielddrone':  enemies.push(new ShieldDrone(s.x, s.y));  break
        case 'tempovampire': enemies.push(new TempoVampire(s.x, s.y)); break
      }
    }
  },

  checkClear() {
    if (this.cleared || gameState !== 'playing') return
    if (enemies.length > 0 && enemies.every(e => !e.alive)) {
      this.cleared  = true
      this.exitOpen = true
    }
  },

  clampToFloor(x, y, r) {
    return {
      x: Math.max(FLOOR_X1 + r, Math.min(FLOOR_X2 - r, x)),
      y: Math.max(FLOOR_Y1 + r, Math.min(FLOOR_Y2 - r, y)),
    }
  },

  draw(ctx) {
    ctx.fillStyle = '#3a3a4a'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    ctx.fillStyle = '#1e1e26'
    ctx.fillRect(FLOOR_X1, FLOOR_Y1, FLOOR_X2 - FLOOR_X1, FLOOR_Y2 - FLOOR_Y1)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    for (let x = FLOOR_X1; x <= FLOOR_X2; x += CELL_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, FLOOR_Y1); ctx.lineTo(x, FLOOR_Y2); ctx.stroke()
    }
    for (let y = FLOOR_Y1; y <= FLOOR_Y2; y += CELL_SIZE) {
      ctx.beginPath(); ctx.moveTo(FLOOR_X1, y); ctx.lineTo(FLOOR_X2, y); ctx.stroke()
    }
    ctx.fillStyle = this.exitOpen ? '#33dd66' : '#444455'
    ctx.fillRect(FLOOR_X2 - 4, CANVAS_H / 2 - 40, 8, 80)
    if (this.exitOpen) {
      ctx.fillStyle = 'rgba(51,221,102,0.15)'
      ctx.fillRect(FLOOR_X2 - 20, CANVAS_H / 2 - 40, 24, 80)
    }
  }
}
