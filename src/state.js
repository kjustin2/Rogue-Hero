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
  { id: 'metronome',   name: 'Metronome',   desc: 'Tempo decays 3× faster — easier zone control' },
  { id: 'resonance',   name: 'Resonance',   desc: 'At exactly 50 Tempo (±5), your damage is doubled' },
  { id: 'runaway',     name: 'Runaway',     desc: 'Tempo no longer decays from Hot — ride it forever' },
  { id: 'iron_pulse',  name: 'Iron Pulse',  desc: 'Max HP +2, restore 2 HP' },
  { id: 'cold_fury',   name: 'Cold Fury',   desc: 'At Cold Tempo, dash deals damage on contact' },
  { id: 'surge_coil',  name: 'Surge Coil',  desc: 'Manual Crash radius +60%' },
  { id: 'echo',        name: 'Echo',        desc: 'On Tempo Crash, your last attack repeats at half damage' },
  { id: 'precision',   name: 'Precision',   desc: 'Perfect Dodge slow-mo lasts twice as long' },
  { id: 'glass_heart', name: 'Glass Heart', desc: 'Start each room at 90 Tempo — Critical from first swing' },
]

// ── RunState ──────────────────────────────────────────────────────────────────
const RunState = {
  hp: 6, maxHp: 6,
  speed: 200, power: 1.0,
  tempoGain: 1.0,
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
        this.power = 1.2; this.tempoGain = 1.3; break
      case 'shadow':
        this.maxHp = 5;  this.hp = 5;  this.speed = 240
        this.power = 1.0; this.tempoGain = 1.0; break
      case 'warden':
        this.maxHp = 9;  this.hp = 9;  this.speed = 160
        this.power = 0.9; this.tempoGain = 0.7; break
      default:
        this.maxHp = 6;  this.hp = 6;  this.speed = 200
        this.power = 1.0; this.tempoGain = 1.0
    }
  },

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount)
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
      case 'iron_pulse':  this.maxHp += 2; this.hp = Math.min(this.hp + 2, this.maxHp); break
      case 'surge_coil':  Tempo.manualCrashRadiusBonus = 1.6; break
    }
  }
}
