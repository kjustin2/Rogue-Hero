// ── Shared constants ──────────────────────────────────────────────────────────
const CANVAS_W  = 1280
const CANVAS_H  = 720
const CELL_SIZE = 64
const WALL      = 64
const FLOOR_X1  = WALL
const FLOOR_Y1  = WALL
const FLOOR_X2  = CANVAS_W - WALL   // 1216
const FLOOR_Y2  = CANVAS_H - WALL   // 656

// ── Item definitions ──────────────────────────────────────────────────────────
const ITEM_POOL = [
  { id: 'volatile_soles', name: 'Volatile Soles', desc: 'Pressure radius +50%' },
  { id: 'metronome',      name: 'Metronome',      desc: 'Tempo decays 2x faster' },
  { id: 'anchor_stone',   name: 'Anchor Stone',   desc: 'Pressure builds 1.5x faster' },
  { id: 'iron_pulse',     name: 'Iron Pulse',     desc: 'Max HP +2, restore 2 HP' },
  { id: 'cold_blood',     name: 'Cold Blood',     desc: 'Kills at COLD restore 1 HP' },
  { id: 'surge_coil',     name: 'Surge Coil',     desc: 'Tempo Crash resets to 60' },
]

// ── RunState ──────────────────────────────────────────────────────────────────
const RunState = {
  hp: 6, maxHp: 6,
  speed: 200, power: 1.0,
  tempoGain: 1.0, pressureRadius: 64,
  xp: 0, level: 1, xpToNext: 10,
  floor: 1, room: 0,
  items: [],
  chosenClass: 'berserker',

  startRun(classId) {
    this.chosenClass = classId
    this.items = []
    this.xp = 0; this.level = 1; this.xpToNext = 10
    this.floor = 1; this.room = 0
    this._applyClass(classId)
  },

  _applyClass(id) {
    switch (id) {
      case 'berserker':
        this.maxHp = 5;  this.hp = 5;  this.speed = 190
        this.power = 1.2; this.tempoGain = 1.3; this.pressureRadius = 56; break
      case 'shadow':
        this.maxHp = 5;  this.hp = 5;  this.speed = 240
        this.power = 1.0; this.tempoGain = 1.0; this.pressureRadius = 80; break
      case 'warden':
        this.maxHp = 9;  this.hp = 9;  this.speed = 160
        this.power = 0.9; this.tempoGain = 0.7; this.pressureRadius = 64; break
      default:
        this.maxHp = 6;  this.hp = 6;  this.speed = 200
        this.power = 1.0; this.tempoGain = 1.0; this.pressureRadius = 64
    }
  },

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount)
    if (this.hp <= 0) gameState = 'dead'
  },

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount)
  },

  addXP(amount) {
    this.xp += amount
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext
      this.level++
      this.xpToNext = 10 + this.level * 5
    }
  },

  addItem(itemId) {
    this.items.push(itemId)
    switch (itemId) {
      case 'volatile_soles': this.pressureRadius *= 1.5; break
      case 'iron_pulse':     this.maxHp += 2; this.hp = Math.min(this.hp + 2, this.maxHp); break
      case 'surge_coil':     Tempo.crashReset = 60; break
    }
  }
}
