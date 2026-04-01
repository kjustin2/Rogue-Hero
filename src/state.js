// ── Shared constants ──────────────────────────────────────────────────────────
const CANVAS_W  = 1280
const CANVAS_H  = 720
const CELL_SIZE = 64
const WALL      = 64
const FLOOR_X1  = WALL
const FLOOR_Y1  = WALL
const FLOOR_X2  = CANVAS_W - WALL   // 1216
const FLOOR_Y2  = CANVAS_H - WALL   // 656

// ── Class display data ────────────────────────────────────────────────────────
const CLASS_DATA = {
  berserker: {
    name: 'BERSERKER',
    color: '#cc4444',
    bgColor: '#2a1212',
    stats: { hp: 2, speed: 3, power: 5, tempoGain: 4 },   // 1-5 scale for display
    passive: 'Crash resets to 70 — ride the spike',
    description: 'Live dangerously. Tempo multiplies your damage.',
  },
  shadow: {
    name: 'SHADOW',
    color: '#9944cc',
    bgColor: '#180e28',
    stats: { hp: 2, speed: 5, power: 3, tempoGain: 3 },
    passive: 'Critical-state kills briefly slow time',
    description: 'Fast and precise. Perfect dodges feed your power.',
  },
  warden: {
    name: 'WARDEN',
    color: '#44aa44',
    bgColor: '#0e1e0e',
    stats: { hp: 5, speed: 1, power: 3, tempoGain: 1 },
    passive: 'Taking damage builds +10 Tempo',
    description: 'Punish-resistant tank. Pain becomes fuel.',
  },
}

// ── Item definitions ──────────────────────────────────────────────────────────
const ITEM_POOL = [
  { id: 'metronome',      name: 'Metronome',      rarity: 'common',   desc: 'Tempo decays 3× faster — easier zone control' },
  { id: 'resonance',      name: 'Resonance',      rarity: 'uncommon', desc: 'At exactly 50 Tempo (±5), your damage is doubled' },
  { id: 'runaway',        name: 'Runaway',        rarity: 'uncommon', desc: 'Tempo no longer decays from Hot — ride it forever' },
  { id: 'iron_pulse',     name: 'Iron Pulse',     rarity: 'common',   desc: 'Max HP +2, restore 2 HP' },
  { id: 'cold_fury',      name: 'Cold Fury',      rarity: 'common',   desc: 'At Cold Tempo, dash deals contact damage' },
  { id: 'surge_coil',     name: 'Surge Coil',     rarity: 'uncommon', desc: 'Crash burst radius +60%' },
  { id: 'echo',           name: 'Echo',           rarity: 'uncommon', desc: 'On Tempo Crash, your last attack repeats at half damage' },
  { id: 'precision',      name: 'Precision',      rarity: 'common',   desc: 'Perfect Dodge slow-mo lasts twice as long' },
  { id: 'glass_heart',    name: 'Glass Heart',    rarity: 'rare',     desc: 'Start each room at 90 Tempo — Critical from first swing' },
  { id: 'tempo_tap',      name: 'Tempo Tap',      rarity: 'uncommon', desc: 'Dodging raises Tempo +5 (not −5) — dodge to build power' },
  { id: 'sustained',      name: 'Sustained',      rarity: 'uncommon', desc: 'Killing an enemy stops Tempo decay for 2 seconds' },
  { id: 'last_rites',     name: 'Last Rites',     rarity: 'rare',     desc: 'On death: auto-crash if Tempo ≥ 50, then die in a blaze' },
  { id: 'cold_blood',     name: 'Cold Blood',     rarity: 'common',   desc: 'Kills while Cold restore 1 HP (once per room)' },
  { id: 'deadweight',     name: 'Deadweight',     rarity: 'common',   desc: '+3 Max HP, −10% speed. Pure tank.' },
  { id: 'volatile_soles', name: 'Volatile Soles', rarity: 'uncommon', desc: 'Crash burst radius +60% — bigger explosions' },
]

// ── Level-up option pool ──────────────────────────────────────────────────────
const LEVEL_UP_POOL = [
  { id: 'hp_up',      label: '+1 Max HP',           apply() { RunState.maxHp += 1; RunState.hp = Math.min(RunState.hp + 1, RunState.maxHp) } },
  { id: 'power_up',   label: '+12% Power',           apply() { RunState.power = +(RunState.power * 1.12).toFixed(3) } },
  { id: 'speed_up',   label: '+15% Speed',           apply() { RunState.speed = Math.round(RunState.speed * 1.15) } },
  { id: 'tempo_gain', label: '+20% Tempo Gain',      apply() { RunState.tempoGain = +(RunState.tempoGain * 1.2).toFixed(3) } },
  { id: 'combo_ext',  label: 'Combo Window +0.25s',  apply() { if (typeof Player !== 'undefined') Player.COMBO_WINDOW = +(Player.COMBO_WINDOW + 0.25).toFixed(2) } },
  { id: 'dodge_cd',   label: 'Dodge CD −0.1s',       apply() { if (typeof Player !== 'undefined') Player.DODGE_CD = Math.max(0.3, +(Player.DODGE_CD - 0.1).toFixed(2)) } },
]

// ── Shared kill callback — called by every enemy on death ─────────────────────
function onEnemyDied(xpAmount) {
  RunState.addXP(xpAmount || 0)
  RunState.runStats.kills++
  const tv = Math.round(typeof Tempo !== 'undefined' ? Tempo.value : 0)
  if (tv > RunState.runStats.highestTempo) RunState.runStats.highestTempo = tv

  // Sustained: stop decay for 2s
  if (RunState.items.includes('sustained')) RunState.sustainedTimer = 2.0

  // Cold Blood: heal once per room on Cold-state kill
  if (typeof Tempo !== 'undefined' && Tempo.value < 30 &&
      RunState.items.includes('cold_blood') && !RunState.coldBloodUsedThisRoom) {
    RunState.coldBloodUsedThisRoom = true
    RunState.heal(1)
    if (typeof Player !== 'undefined') Player.hp = RunState.hp
  }

  if (typeof Audio !== 'undefined') Audio.kill()
}

// ── RunState ──────────────────────────────────────────────────────────────────
const RunState = {
  hp: 6, maxHp: 6,
  speed: 200, power: 1.0, tempoGain: 1.0,
  xp: 0, level: 1, xpToNext: 10,

  currentFloor:  0,
  roomInFloor:   0,
  isBossRoom:    false,
  floorDecayMult: 1.0,
  floorGainMult:  1.0,

  items: [],
  chosenClass: 'berserker',

  // Per-run runtime state
  sustainedTimer:       0,
  coldBloodUsedThisRoom: false,
  _lastRitesUsed:       false,

  // Level-up
  pendingLevelUp: false,
  levelUpChoices: [],

  // Run statistics (displayed on death/win)
  runStats: {
    kills: 0, crashes: 0, perfectDodges: 0,
    highestTempo: 0, roomsCleared: 0,
  },

  startRun(classId) {
    this.chosenClass = classId
    this.items       = []
    this.xp = 0; this.level = 1; this.xpToNext = 10
    this.currentFloor = 0; this.roomInFloor = 0; this.isBossRoom = false
    this.floorDecayMult = 1.0; this.floorGainMult = 1.0
    this.sustainedTimer = 0
    this.coldBloodUsedThisRoom = false
    this._lastRitesUsed = false
    this.pendingLevelUp = false; this.levelUpChoices = []
    this.runStats = { kills: 0, crashes: 0, perfectDodges: 0, highestTempo: 0, roomsCleared: 0 }
    this._applyClass(classId)
  },

  _applyClass(id) {
    switch (id) {
      case 'berserker': this.maxHp = 5;  this.hp = 5;  this.speed = 190; this.power = 1.2; this.tempoGain = 1.3; break
      case 'shadow':    this.maxHp = 5;  this.hp = 5;  this.speed = 240; this.power = 1.0; this.tempoGain = 1.0; break
      case 'warden':    this.maxHp = 9;  this.hp = 9;  this.speed = 160; this.power = 0.9; this.tempoGain = 0.7; break
      default:          this.maxHp = 6;  this.hp = 6;  this.speed = 200; this.power = 1.0; this.tempoGain = 1.0
    }
  },

  takeDamage(amount) { this.hp = Math.max(0, this.hp - amount) },
  heal(amount)       { this.hp = Math.min(this.maxHp, this.hp + amount) },

  addXP(amount) {
    this.xp += amount
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext
      this.level++
      this.xpToNext = 10 + this.level * 5
      this._triggerLevelUp()
    }
  },

  _triggerLevelUp() {
    this.pendingLevelUp = true
    const pool = [...LEVEL_UP_POOL]
    this.levelUpChoices = []
    for (let i = 0; i < 2 && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length)
      this.levelUpChoices.push(pool.splice(idx, 1)[0])
    }
    if (typeof Audio !== 'undefined') Audio.levelUp()
  },

  addItem(itemId) {
    this.items.push(itemId)
    // Recompute crash radius from all radius-boosting items
    if (typeof Tempo !== 'undefined') {
      Tempo.manualCrashRadiusBonus = 1.0
      if (this.items.includes('surge_coil'))     Tempo.manualCrashRadiusBonus *= 1.6
      if (this.items.includes('volatile_soles')) Tempo.manualCrashRadiusBonus *= 1.6
    }
    switch (itemId) {
      case 'iron_pulse': this.maxHp += 2; this.hp = Math.min(this.hp + 2, this.maxHp); break
      case 'deadweight': this.maxHp += 3; this.hp = Math.min(this.hp + 3, this.maxHp); this.speed = Math.round(this.speed * 0.9); break
    }
  },
}
