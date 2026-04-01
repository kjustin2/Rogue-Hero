// ── Floor / Room data ─────────────────────────────────────────────────────────

const PILLAR_CONFIGS = {
  open: [],
  pillars: [
    { x: 276, y: 172, w: 48, h: 48 },
    { x: 940, y: 172, w: 48, h: 48 },
    { x: 276, y: 488, w: 48, h: 48 },
    { x: 940, y: 488, w: 48, h: 48 },
    { x: 608, y: 312, w: 48, h: 48 },
  ],
}

const FloorData = [
  // ── Floor 0: THE PIT ────────────────────────────────────────────────────────
  {
    name: 'THE PIT',
    subtitle: 'Learn the basics',
    color: '#4488cc',
    decayMult: 1.0,
    gainMult:  1.0,
    modifier: 'Normal rules',
    rooms: [
      { layout: 'open', enemies: [
        { type: 'chaser',  x: 880, y: 220 },
        { type: 'chaser',  x: 820, y: 520 },
      ]},
      { layout: 'open', enemies: [
        { type: 'chaser',  x: 820, y: 200 },
        { type: 'shooter', x: 700, y: 380 },
        { type: 'shooter', x: 980, y: 480 },
      ]},
      { layout: 'pillars', enemies: [
        { type: 'chaser',  x: 720, y: 200 },
        { type: 'chaser',  x: 980, y: 350 },
        { type: 'shooter', x: 620, y: 310 },
        { type: 'shooter', x: 1060, y: 480 },
      ]},
      { layout: 'open', boss: true, enemies: [
        { type: 'brawler', x: 960, y: 360 },
      ]},
    ],
  },

  // ── Floor 1: THE CLOCKWORK ───────────────────────────────────────────────────
  {
    name: 'THE CLOCKWORK',
    subtitle: 'Tempo lingers — danger sticks',
    color: '#cc8844',
    decayMult: 0.6,
    gainMult:  1.0,
    modifier: 'Slow Tempo decay',
    rooms: [
      { layout: 'open', enemies: [
        { type: 'chaser',       x: 840, y: 200 },
        { type: 'tempovampire', x: 960, y: 500 },
        { type: 'shooter',      x: 660, y: 300 },
      ]},
      { layout: 'pillars', enemies: [
        { type: 'shielddrone',  x: 800, y: 220 },
        { type: 'shielddrone',  x: 920, y: 500 },
        { type: 'shooter',      x: 1020, y: 360 },
      ]},
      { layout: 'open', enemies: [
        { type: 'chaser',       x: 760, y: 180 },
        { type: 'chaser',       x: 860, y: 540 },
        { type: 'tempovampire', x: 1020, y: 360 },
        { type: 'shooter',      x: 660, y: 310 },
      ]},
      { layout: 'pillars', enemies: [
        { type: 'shielddrone',  x: 820, y: 220 },
        { type: 'shielddrone',  x: 960, y: 500 },
        { type: 'chaser',       x: 700, y: 360 },
        { type: 'chaser',       x: 1060, y: 360 },
      ]},
      { layout: 'open', boss: true, enemies: [
        { type: 'conductor', x: 960, y: 360 },
      ]},
    ],
  },

  // ── Floor 2: THE ABYSS ───────────────────────────────────────────────────────
  {
    name: 'THE ABYSS',
    subtitle: 'Tempo spikes hard — keep control',
    color: '#9944cc',
    decayMult: 1.0,
    gainMult:  1.4,
    modifier: '+40% Tempo gain',
    rooms: [
      { layout: 'open', enemies: [
        { type: 'chaser',       x: 800, y: 200 },
        { type: 'chaser',       x: 900, y: 500 },
        { type: 'chaser',       x: 760, y: 360 },
        { type: 'tempovampire', x: 1060, y: 300 },
        { type: 'shooter',      x: 660, y: 420 },
      ]},
      { layout: 'pillars', enemies: [
        { type: 'shielddrone',  x: 800, y: 220 },
        { type: 'shielddrone',  x: 960, y: 500 },
        { type: 'shooter',      x: 1020, y: 360 },
        { type: 'shooter',      x: 700, y: 300 },
        { type: 'chaser',       x: 860, y: 400 },
      ]},
      { layout: 'open', enemies: [
        { type: 'tempovampire', x: 860, y: 200 },
        { type: 'shielddrone',  x: 800, y: 460 },
        { type: 'chaser',       x: 700, y: 300 },
        { type: 'chaser',       x: 980, y: 460 },
        { type: 'shooter',      x: 620, y: 400 },
      ]},
      { layout: 'pillars', enemies: [
        { type: 'berserker',    x: 840, y: 240 },
        { type: 'berserker',    x: 860, y: 500 },
        { type: 'shooter',      x: 1060, y: 360 },
        { type: 'tempovampire', x: 700, y: 360 },
      ]},
      { layout: 'open', enemies: [
        { type: 'tempovampire', x: 840, y: 200 },
        { type: 'tempovampire', x: 960, y: 500 },
        { type: 'shielddrone',  x: 800, y: 360 },
        { type: 'shielddrone',  x: 1000, y: 360 },
        { type: 'berserker',    x: 1100, y: 360 },
      ]},
      { layout: 'open', boss: true, enemies: [
        { type: 'theecho', x: 960, y: 360 },
      ]},
    ],
  },
]

// ── Room ───────────────────────────────────────────────────────────────────────
const Room = {
  index:      0,
  cleared:    false,
  exitOpen:   false,
  isBossRoom: false,
  pillars:    [],

  loadFloorRoom(floorIdx, roomIdx) {
    this.index      = roomIdx
    this.cleared    = false
    this.exitOpen   = false
    this.isBossRoom = false

    const floorCfg = FloorData[floorIdx]
    const roomCfg  = floorCfg.rooms[roomIdx]

    // Apply floor modifiers
    RunState.currentFloor  = floorIdx
    RunState.roomInFloor   = roomIdx
    RunState.isBossRoom    = !!roomCfg.boss
    RunState.floorDecayMult = floorCfg.decayMult
    RunState.floorGainMult  = floorCfg.gainMult
    this.isBossRoom         = !!roomCfg.boss

    RunState.coldBloodUsedThisRoom = false

    // Pillars for this layout
    this.pillars = (PILLAR_CONFIGS[roomCfg.layout] || []).map(p => ({ ...p }))

    enemies     = []
    projectiles = []

    for (const s of roomCfg.enemies) {
      switch (s.type) {
        case 'chaser':       enemies.push(new Chaser(s.x, s.y));        break
        case 'shooter':      enemies.push(new Shooter(s.x, s.y));       break
        case 'shielddrone':  enemies.push(new ShieldDrone(s.x, s.y));   break
        case 'tempovampire': enemies.push(new TempoVampire(s.x, s.y));  break
        case 'berserker':    enemies.push(new Berserker(s.x, s.y));     break
        case 'brawler':      enemies.push(new TheBrawler(s.x, s.y));    break
        case 'conductor':    enemies.push(new TheConductor(s.x, s.y));  break
        case 'theecho':      enemies.push(new TheEcho(s.x, s.y));       break
      }
    }
  },

  checkClear() {
    if (this.cleared || gameState !== 'playing') return
    if (enemies.length === 0) return
    if (!enemies.every(e => !e.alive)) return

    this.cleared = true
    RunState.runStats.roomsCleared++

    // Brief kill slow-mo on room clear
    slowMoTimer = 0.35
    slowMoScale = 0.12

    Effects.spawnRoomClear()
    if (typeof Audio !== 'undefined') Audio.roomClear()

    if (this.isBossRoom) {
      // Boss room: auto-advance to floor complete / win after delay
      setTimeout(() => {
        if (typeof openFloorComplete === 'function') openFloorComplete()
      }, 1400)
    } else {
      this.exitOpen = true
    }
  },

  clampToFloor(x, y, r) {
    let nx = Math.max(FLOOR_X1 + r, Math.min(FLOOR_X2 - r, x))
    let ny = Math.max(FLOOR_Y1 + r, Math.min(FLOOR_Y2 - r, y))
    // Pillar collision — push entity out of any overlapping pillar
    for (const p of this.pillars) {
      const closestX = Math.max(p.x, Math.min(nx, p.x + p.w))
      const closestY = Math.max(p.y, Math.min(ny, p.y + p.h))
      const ddx = nx - closestX
      const ddy = ny - closestY
      const dist2 = ddx * ddx + ddy * ddy
      if (dist2 < r * r && dist2 > 0) {
        const dist = Math.sqrt(dist2)
        nx += (ddx / dist) * (r - dist)
        ny += (ddy / dist) * (r - dist)
      } else if (dist2 === 0) {
        // Exactly on corner — push out diagonally
        nx += r; ny += r
      }
    }
    return { x: nx, y: ny }
  },

  draw(ctx) {
    // Outer wall
    ctx.fillStyle = '#3a3a4a'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    // Floor
    ctx.fillStyle = '#1e1e26'
    ctx.fillRect(FLOOR_X1, FLOOR_Y1, FLOOR_X2 - FLOOR_X1, FLOOR_Y2 - FLOOR_Y1)

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 1
    for (let x = FLOOR_X1; x <= FLOOR_X2; x += CELL_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, FLOOR_Y1); ctx.lineTo(x, FLOOR_Y2); ctx.stroke()
    }
    for (let y = FLOOR_Y1; y <= FLOOR_Y2; y += CELL_SIZE) {
      ctx.beginPath(); ctx.moveTo(FLOOR_X1, y); ctx.lineTo(FLOOR_X2, y); ctx.stroke()
    }

    // Pillars
    for (const p of this.pillars) {
      ctx.fillStyle = '#2c2c3c'
      ctx.fillRect(p.x, p.y, p.w, p.h)
      ctx.strokeStyle = '#4a4a5e'
      ctx.lineWidth = 2
      ctx.strokeRect(p.x, p.y, p.w, p.h)
      // Inner shadow
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'
      ctx.lineWidth = 1
      ctx.strokeRect(p.x + 3, p.y + 3, p.w - 6, p.h - 6)
    }

    // Exit door
    if (!this.isBossRoom) {
      ctx.fillStyle = this.exitOpen ? '#33dd66' : '#444455'
      ctx.fillRect(FLOOR_X2 - 4, CANVAS_H / 2 - 40, 8, 80)
      if (this.exitOpen) {
        ctx.fillStyle = 'rgba(51,221,102,0.18)'
        ctx.fillRect(FLOOR_X2 - 22, CANVAS_H / 2 - 40, 26, 80)
        // Exit arrow
        ctx.fillStyle = '#33dd66'
        ctx.font = 'bold 11px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('▶', FLOOR_X2 - 10, CANVAS_H / 2 + 4)
      }
    }
  },
}
