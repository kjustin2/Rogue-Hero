export const CardDefinitions = {
  // ── BASIC ─────────────────────────────────────────────────────
  strike: {
    id: 'strike', name: 'Strike', cost: 1, tempoShift: 10, rarity: 'common',
    damage: 10, range: 90, type: 'melee', color: '#ffffff',
    desc: 'Basic slash. Short range. +10 Tempo.'
  },
  lunge: {
    id: 'lunge', name: 'Lunge', cost: 2, tempoShift: 20, rarity: 'common',
    damage: 18, range: 140, type: 'melee', color: '#ffcc44',
    desc: 'Long reach thrust. +20 Tempo.'
  },
  chill_blade: {
    id: 'chill_blade', name: 'Chill Blade', cost: 1, tempoShift: -15, rarity: 'common',
    damage: 8, range: 90, type: 'melee', color: '#66ccff',
    desc: 'Cool tempo. -15 Tempo.'
  },
  heavy_crash: {
    id: 'heavy_crash', name: 'Heavy Crash', cost: 4, tempoShift: 22, rarity: 'uncommon',
    damage: 35, range: 110, type: 'melee', color: '#ff4444',
    slotWidth: 2,
    desc: 'Devastating blow. +22 Tempo. [2 SLOTS]'
  },

  // ── RANGED / AOE ──────────────────────────────────────────────
  piercing_surge: {
    id: 'piercing_surge', name: 'Surge', cost: 3, tempoShift: 25, rarity: 'uncommon',
    damage: 20, range: 200, type: 'projectile', color: '#44aaff',
    desc: 'Radial wave hits all in range. +25 Tempo.'
  },
  frost_nova: {
    id: 'frost_nova', name: 'Frost Nova', cost: 3, tempoShift: -18, rarity: 'uncommon',
    damage: 5, range: 160, type: 'projectile', color: '#aaeeff',
    desc: 'Stagger ALL nearby enemies 1s. -18 Tempo.'
  },
  arc_slash: {
    id: 'arc_slash', name: 'Arc Slash', cost: 2, tempoShift: 15, rarity: 'common',
    damage: 10, range: 120, type: 'cleave', color: '#ff8844',
    desc: 'Sweeping arc hits ALL nearby. +15 Tempo.'
  },
  chain_lightning: {
    id: 'chain_lightning', name: 'Chain Lightning', cost: 3, tempoShift: 20, rarity: 'rare',
    damage: 8, range: 250, type: 'projectile', color: '#ffff44',
    desc: 'Zaps everything in huge radius. +20 Tempo.',
    bonusCard: true
  },
  thunder_clap: {
    id: 'thunder_clap', name: 'Thunder Clap', cost: 4, tempoShift: 18, rarity: 'rare',
    damage: 15, range: 180, type: 'projectile', color: '#ffdd00',
    slotWidth: 2,
    desc: 'Massive AoE + stagger. +18 Tempo. [2 SLOTS]',
    bonusCard: true
  },

  // ── MOBILITY ──────────────────────────────────────────────────
  dash_strike: {
    id: 'dash_strike', name: 'Dash Strike', cost: 2, tempoShift: 10, rarity: 'common',
    damage: 15, range: 180, type: 'dash', color: '#ffea00',
    desc: 'Teleport to target and slash. +10 Tempo.'
  },
  phantom_step: {
    id: 'phantom_step', name: 'Phantom Step', cost: 1, tempoShift: 5, rarity: 'rare',
    damage: 6, range: 220, type: 'dash', color: '#cc88ff',
    desc: 'Long-range dash, light damage. +5 Tempo.',
    bonusCard: true
  },

  // ── UTILITY / SUSTAIN ─────────────────────────────────────────
  vampire_bite: {
    id: 'vampire_bite', name: 'Vampire Bite', cost: 3, tempoShift: -20, rarity: 'uncommon',
    damage: 12, range: 90, type: 'melee', color: '#cc44cc',
    desc: 'Heal 1 HP on kill. -20 Tempo.'
  },
  shield_bash: {
    id: 'shield_bash', name: 'Shield Bash', cost: 2, tempoShift: -10, rarity: 'common',
    damage: 8, range: 80, type: 'melee', color: '#88aacc',
    desc: 'Stagger target 0.8s. -10 Tempo.'
  },
  blood_pact: {
    id: 'blood_pact', name: 'Blood Pact', cost: 2, tempoShift: 18, rarity: 'rare',
    damage: 22, range: 90, type: 'melee', color: '#ff2266',
    desc: 'Costs 1 HP. Huge damage. +18 Tempo.',
    bonusCard: true
  },
  iron_wall: {
    id: 'iron_wall', name: 'Iron Wall', cost: 3, tempoShift: -15, rarity: 'rare',
    damage: 0, range: 130, type: 'projectile', color: '#aaaacc',
    desc: 'No damage. Stagger ALL nearby 1.5s. -15 Tempo.',
    bonusCard: true
  },

  // ── RANGED SHOTS (fire actual projectiles) ────────────────────
  quick_shot: {
    id: 'quick_shot', name: 'Quick Shot', cost: 1, tempoShift: 8, rarity: 'common',
    damage: 12, range: 600, type: 'shot', color: '#88ffdd',
    desc: 'Fire a fast bolt toward cursor. +8 Tempo.'
  },
  tri_shot: {
    id: 'tri_shot', name: 'Tri-Shot', cost: 2, tempoShift: 18, rarity: 'uncommon',
    damage: 10, range: 500, type: 'shot', color: '#ffcc44',
    desc: 'Fire 3 spread bolts. +18 Tempo.',
    shotCount: 3, shotSpread: 0.25
  },
  power_shot: {
    id: 'power_shot', name: 'Power Shot', cost: 3, tempoShift: 28, rarity: 'uncommon',
    damage: 32, range: 700, type: 'shot', color: '#ff6644',
    desc: 'Slow heavy bolt, high damage. +28 Tempo.',
    shotSpeed: 200, shotCount: 1
  },
  barrage: {
    id: 'barrage', name: 'Barrage', cost: 3, tempoShift: 14, rarity: 'uncommon',
    damage: 7, range: 500, type: 'shot', color: '#ff8844',
    desc: 'Fire 5 spread bolts. +14 Tempo.',
    shotCount: 5, shotSpread: 0.35
  },
  freeze_bolt: {
    id: 'freeze_bolt', name: 'Freeze Bolt', cost: 2, tempoShift: -10, rarity: 'common',
    damage: 4, range: 550, type: 'shot', color: '#aaeeff',
    desc: 'Low dmg, freezes target 1.2s. -10 Tempo.',
    freezes: true, shotSpeed: 300
  },

  // ── MELEE ─────────────────────────────────────────────────────
  gut_rend: {
    id: 'gut_rend', name: 'Gut Rend', cost: 2, tempoShift: 12, rarity: 'common',
    damage: 14, range: 90, type: 'melee', color: '#cc4422',
    desc: 'Slash that bleeds for 3 dmg over 3s. +12 Tempo.',
    bleed: true
  },
  counter_slash: {
    id: 'counter_slash', name: 'Counter', cost: 1, tempoShift: 5, rarity: 'uncommon',
    damage: 20, range: 80, type: 'melee', color: '#ff8844',
    desc: 'High dmg. Bonus 1.5× if used within 0.5s of dodge. +5 Tempo.',
    postDodgeBonus: true
  },
  spin_attack: {
    id: 'spin_attack', name: 'Spin Attack', cost: 3, tempoShift: 20, rarity: 'uncommon',
    damage: 12, range: 130, type: 'cleave', color: '#ff6622',
    desc: 'Sweeping spin hits ALL nearby. +20 Tempo.'
  },
  double_slash: {
    id: 'double_slash', name: 'Double Slash', cost: 2, tempoShift: 16, rarity: 'common',
    damage: 22, range: 85, type: 'melee', color: '#ffaaaa',
    desc: 'Two rapid strikes. +16 Tempo.'
  },
  void_lance: {
    id: 'void_lance', name: 'Void Lance', cost: 3, tempoShift: 20, rarity: 'uncommon',
    damage: 30, range: 750, type: 'shot', color: '#9944ff',
    desc: 'Heavy void bolt. Slow but devastating. +20 Tempo.',
    shotSpeed: 180, shotCount: 1
  },
  cold_wave: {
    id: 'cold_wave', name: 'Cold Wave', cost: 2, tempoShift: -20, rarity: 'uncommon',
    damage: 3, range: 120, type: 'projectile', color: '#88ccff',
    desc: 'Icy shockwave staggering all nearby 0.8s. -20 Tempo.'
  },
  whirlwind: {
    id: 'whirlwind', name: 'Whirlwind', cost: 4, tempoShift: 30, rarity: 'uncommon',
    damage: 18, range: 160, type: 'cleave', color: '#ff9944',
    slotWidth: 2,
    desc: 'Massive spinning cleave — hits everything nearby. +30 Tempo. [2 SLOTS]'
  },

  // ── UTILITY ───────────────────────────────────────────────────
  second_wind: {
    id: 'second_wind', name: 'Second Wind', cost: 2, tempoShift: -15, rarity: 'rare',
    damage: 0, range: 100, type: 'utility', color: '#ff4488',
    desc: 'Heal 1 HP. -15 Tempo.',
    bonusCard: true
  },
  adrenaline: {
    id: 'adrenaline', name: 'Adrenaline', cost: 1, tempoShift: 25, rarity: 'rare',
    damage: 0, range: 100, type: 'utility', color: '#ffff44',
    desc: 'Instantly add +25 Tempo. No damage.',
    bonusCard: true
  },
  smoke_screen: {
    id: 'smoke_screen', name: 'Smoke Screen', cost: 2, tempoShift: -20, rarity: 'rare',
    damage: 0, range: 100, type: 'utility', color: '#aaaaaa',
    desc: 'Grants 0.8s of full invincibility. -20 Tempo.',
    bonusCard: true
  },

  // ── HIGH RISK ─────────────────────────────────────────────────
  berserk: {
    id: 'berserk', name: 'Berserk', cost: 2, tempoShift: 22, rarity: 'uncommon',
    damage: 25, range: 80, type: 'melee', color: '#ff2222',
    desc: 'Massive damage, tight range. +22 Tempo.'
  },
  whip_crack: {
    id: 'whip_crack', name: 'Whip Crack', cost: 1, tempoShift: 5, rarity: 'common',
    damage: 6, range: 200, type: 'melee', color: '#ffdd88',
    desc: 'Longest melee reach, low damage. +5 Tempo.'
  },
  execute: {
    id: 'execute', name: 'Execute', cost: 4, tempoShift: 18, rarity: 'rare',
    damage: 50, range: 80, type: 'melee', color: '#ff0000',
    slotWidth: 2,
    desc: 'Finishing blow. 50 base DMG. +18 Tempo. [2 SLOTS]',
    bonusCard: true
  },
  tempo_surge: {
    id: 'tempo_surge', name: 'Tempo Surge', cost: 1, tempoShift: -18, rarity: 'rare',
    damage: 3, range: 100, type: 'melee', color: '#44ffaa',
    desc: 'Almost no damage. Tempo drop. -18 Tempo.',
    bonusCard: true
  },
  shadow_mark: {
    id: 'shadow_mark', name: 'Shadow Mark', cost: 2, tempoShift: 15, rarity: 'rare',
    damage: 20, range: 150, type: 'dash', color: '#8844bb',
    desc: 'Dash + mark target (next hit crits). +15 Tempo.',
    bonusCard: true
  },
  glass_cannon: {
    id: 'glass_cannon', name: 'Glass Cannon', cost: 3, tempoShift: 22, rarity: 'rare',
    damage: 60, range: 80, type: 'melee', color: '#ff0044',
    desc: 'Massive dmg, costs 2 HP. +22 Tempo.',
    bonusCard: true, selfDamage: 2
  },
  reaper: {
    id: 'reaper', name: 'Reaper', cost: 4, tempoShift: 18, rarity: 'rare',
    damage: 30, range: 200, type: 'cleave', color: '#8800ff',
    slotWidth: 2,
    desc: 'AoE 200r. Instakills enemies below 15% HP. +18 Tempo. [2 SLOTS]',
    bonusCard: true, executeLow: true
  },

  // ── NEW MELEE ─────────────────────────────────────────────────────
  frenzy: {
    id: 'frenzy', name: 'Frenzy', cost: 3, tempoShift: 18, rarity: 'uncommon',
    damage: 10, range: 80, type: 'melee', color: '#ff6644',
    desc: 'Hits target 3× rapidly. Each hit triggers combo. +18 Tempo.',
    multiHit: 3
  },
  earthshaker: {
    id: 'earthshaker', name: 'Earthshaker', cost: 4, tempoShift: 25, rarity: 'rare',
    damage: 40, range: 160, type: 'cleave', color: '#bb6622',
    slotWidth: 2,
    desc: 'Forward cone slam. +50% dmg in Hot/Critical. +25 Tempo. [2 SLOTS]',
    bonusCard: true, hotBonus: true
  },
  riposte: {
    id: 'riposte', name: 'Riposte', cost: 1, tempoShift: 8, rarity: 'uncommon',
    damage: 28, range: 80, type: 'melee', color: '#ffaa44',
    desc: 'High damage. Free (0 AP) if used within 0.6s of a dodge. +8 Tempo.',
    riposte: true
  },
  sweeping_blow: {
    id: 'sweeping_blow', name: 'Sweeping Blow', cost: 2, tempoShift: 12, rarity: 'common',
    damage: 9, range: 110, type: 'cleave', color: '#ffcc88',
    desc: 'Wide arc, low damage per hit. Good tempo builder. +12 Tempo.'
  },
  wraithblade: {
    id: 'wraithblade', name: 'Wraithblade', cost: 3, tempoShift: 15, rarity: 'uncommon',
    damage: 25, range: 200, type: 'dash', color: '#9966ff',
    desc: 'Dash through target, brief invulnerability. +15 Tempo.',
    dashThrough: true
  },
  death_blow: {
    id: 'death_blow', name: 'Death Blow', cost: 4, tempoShift: 22, rarity: 'rare',
    damage: 45, range: 85, type: 'melee', color: '#cc0044',
    slotWidth: 2,
    desc: 'Triple damage vs enemies below 20% HP. +22 Tempo. [2 SLOTS]',
    bonusCard: true, executeLowMult: true
  },
  flicker: {
    id: 'flicker', name: 'Flicker', cost: 1, tempoShift: 6, rarity: 'common',
    damage: 8, range: 75, type: 'melee', color: '#ffeeaa',
    desc: 'Fast poke. On miss, AP is refunded. +6 Tempo.',
    apRefundOnMiss: true
  },
  whip_lash: {
    id: 'whip_lash', name: 'Whip Lash', cost: 2, tempoShift: 14, rarity: 'common',
    damage: 16, range: 180, type: 'melee', color: '#ffdd88',
    desc: 'Long reach. Slows target 50% for 0.5s. +14 Tempo.',
    slow: true
  },

  // ── NEW SHOTS ─────────────────────────────────────────────────────
  ricochet: {
    id: 'ricochet', name: 'Ricochet', cost: 2, tempoShift: 16, rarity: 'uncommon',
    damage: 14, range: 600, type: 'shot', color: '#aaffcc',
    desc: 'Bolt bounces to 2 nearby enemies on hit (−25% dmg each). +16 Tempo.',
    shotSpeed: 420, shotCount: 1, ricochetBounces: 2
  },
  void_pulse: {
    id: 'void_pulse', name: 'Void Pulse', cost: 1, tempoShift: 5, rarity: 'common',
    damage: 7, range: 500, type: 'shot', color: '#aa88ff',
    desc: 'Instant bolt toward cursor. Very cheap. +5 Tempo.',
    shotSpeed: 600, shotCount: 1
  },
  cluster_shot: {
    id: 'cluster_shot', name: 'Cluster Shot', cost: 3, tempoShift: 22, rarity: 'uncommon',
    damage: 18, range: 450, type: 'shot', color: '#ffbb44',
    desc: 'Explodes on impact for 80px AoE. +22 Tempo.',
    shotSpeed: 380, shotCount: 1, clusterAoE: 80
  },
  snipers_mark: {
    id: 'snipers_mark', name: "Sniper's Mark", cost: 3, tempoShift: 20, rarity: 'rare',
    damage: 20, range: 900, type: 'shot', color: '#ff4488',
    desc: 'Extreme range. Instakills enemies below 18% HP. +20 Tempo.',
    shotSpeed: 160, shotCount: 1, executeLowShot: 0.18,
    bonusCard: true
  },
  charged_bolt: {
    id: 'charged_bolt', name: 'Charged Bolt', cost: 2, tempoShift: 18, rarity: 'uncommon',
    damage: 28, range: 700, type: 'shot', color: '#aaddff',
    desc: 'Large hitbox bolt, pierces 1 enemy. +18 Tempo.',
    shotSpeed: 200, shotCount: 1, piercingShot: true
  },

  // ── NEW PROJECTILE AoE ─────────────────────────────────────────────
  war_cry: {
    id: 'war_cry', name: 'War Cry', cost: 2, tempoShift: 20, rarity: 'uncommon',
    damage: 0, range: 220, type: 'projectile', color: '#ffaa22',
    desc: 'No damage. Stagger all 1.2s + player +20% speed for 1.5s. +20 Tempo.',
    warCry: true
  },
  leech_field: {
    id: 'leech_field', name: 'Leech Field', cost: 3, tempoShift: -18, rarity: 'rare',
    damage: 8, range: 140, type: 'projectile', color: '#cc44cc',
    desc: 'Damages all in range. Heal 1 HP per enemy hit (cap 2). -18 Tempo.',
    bonusCard: true, leech: true
  },
  shockwave: {
    id: 'shockwave', name: 'Shockwave', cost: 3, tempoShift: 22, rarity: 'uncommon',
    damage: 12, range: 175, type: 'projectile', color: '#88ddff',
    desc: 'Damages + knocks enemies 80px away from player. +22 Tempo.',
    knockback: 80
  },
  soul_drain: {
    id: 'soul_drain', name: 'Soul Drain', cost: 4, tempoShift: -25, rarity: 'rare',
    damage: 6, range: 160, type: 'projectile', color: '#8833cc',
    slotWidth: 2,
    desc: 'Damage all in range. Steals 15 Tempo from each enemy hit. -25 Tempo. [2 SLOTS]',
    bonusCard: true, tempoSteal: 15
  },

  // ── NEW UTILITY ─────────────────────────────────────────────────────
  tempo_flip: {
    id: 'tempo_flip', name: 'Tempo Flip', cost: 1, tempoShift: 0, rarity: 'uncommon',
    damage: 0, range: 100, type: 'utility', color: '#44ffff',
    desc: 'If Tempo>50: −30. If Tempo≤50: +30. Snaps toward edge.',
    tempoFlip: true
  },
  phase_step: {
    id: 'phase_step', name: 'Phase Step', cost: 2, tempoShift: 0, rarity: 'uncommon',
    damage: 0, range: 100, type: 'utility', color: '#ccaaff',
    desc: 'Full invincibility for 0.5s. No tempo cost. Not a dodge.',
    phaseStep: true
  },
  marked_for_death: {
    id: 'marked_for_death', name: 'Marked for Death', cost: 2, tempoShift: 10, rarity: 'rare',
    damage: 0, range: 250, type: 'utility', color: '#ff6666',
    desc: 'Nearest enemy takes 2× damage from all sources for 4s. +10 Tempo.',
    bonusCard: true, markForDeath: true
  },
  berserkers_oath: {
    id: 'berserkers_oath', name: "Berserker's Oath", cost: 3, tempoShift: 25, rarity: 'rare',
    damage: 0, range: 100, type: 'utility', color: '#ff3300',
    desc: 'Lose 2 HP. Next 3 attacks: free AP + infinite combo window. +25 Tempo.',
    bonusCard: true, berserkerOath: true
  },
  last_stand: {
    id: 'last_stand', name: 'Last Stand', cost: 3, tempoShift: 30, rarity: 'rare',
    damage: 55, range: 200, type: 'projectile', color: '#ff8800',
    desc: 'Usable only at ≤2 HP. Massive AoE. Kills all → restore 2 HP. +30 Tempo.',
    bonusCard: true, lastStand: true
  },
  mirror_strike: {
    id: 'mirror_strike', name: 'Mirror Strike', cost: 3, tempoShift: 15, rarity: 'rare',
    damage: 12, range: 100, type: 'melee', color: '#aaffff',
    desc: 'Attacks fire in all 4 cardinal directions simultaneously. +15 Tempo.',
    bonusCard: true, mirrorStrike: true
  },

  // ── HIGH RISK / CHARACTER-SPECIFIC ────────────────────────────────
  deaths_bargain: {
    id: 'deaths_bargain', name: "Death's Bargain", cost: 2, tempoShift: 22, rarity: 'rare',
    damage: 70, range: 85, type: 'melee', color: '#cc0000',
    desc: 'Costs 2 HP. Cannot use at ≤2 HP. 70 flat damage. +22 Tempo.',
    bonusCard: true, deathsBargain: true
  },
  resonant_pulse: {
    id: 'resonant_pulse', name: 'Resonant Pulse', cost: 2, tempoShift: -5, rarity: 'rare',
    damage: 20, range: 110, type: 'projectile', color: '#00eedd',
    desc: 'Double damage when Tempo 45–55. For Echo. -5 Tempo.',
    bonusCard: true, resonantPulse: true
  },
  iron_retort: {
    id: 'iron_retort', name: 'Iron Retort', cost: 1, tempoShift: 10, rarity: 'uncommon',
    damage: 15, range: 90, type: 'melee', color: '#ddaa22',
    desc: '+8 bonus damage per Guard stack. For Vanguard. +10 Tempo.',
    ironRetort: true
  },
};

export class DeckManager {
  constructor() {
    this.collection = [];
    this.hand = [null, null, null, null];
    this.HAND_SIZE = 4;
    this.MAX_DECK_SIZE = 6;
    this.upgrades = {};
  }

  initDeck(startingCardIds) {
    this.collection = [...new Set(startingCardIds)];
    this.upgrades = {};
    this.hand = [null, null, null, null];
    // Auto-fill hand, respecting slotWidth
    let slotCursor = 0;
    for (const id of this.collection) {
      if (slotCursor >= this.HAND_SIZE) break;
      const def = CardDefinitions[id];
      const sw = (def && def.slotWidth) || 1;
      if (slotCursor + sw <= this.HAND_SIZE) {
        this.hand[slotCursor] = id;
        for (let s = 1; s < sw; s++) this.hand[slotCursor + s] = '__wide';
        slotCursor += sw;
      } else {
        slotCursor++;
      }
    }
    console.log(`[Deck] Initialized with [${this.collection.join(', ')}]`);
  }

  addCard(cardId) {
    if (this.collection.includes(cardId)) return false;
    if (this.collection.length >= this.MAX_DECK_SIZE) return 'full';
    this.collection.push(cardId);
    // Try to fill an empty hand slot
    const def = CardDefinitions[cardId];
    const sw = (def && def.slotWidth) || 1;
    for (let i = 0; i <= this.HAND_SIZE - sw; i++) {
      let fits = true;
      for (let s = 0; s < sw; s++) {
        if (this.hand[i + s] !== null) { fits = false; break; }
      }
      if (fits) {
        this.hand[i] = cardId;
        for (let s = 1; s < sw; s++) this.hand[i + s] = '__wide';
        break;
      }
    }
    return true;
  }

  removeCard(cardId) {
    const idx = this.collection.indexOf(cardId);
    if (idx === -1) return false;
    this.collection.splice(idx, 1);
    delete this.upgrades[cardId];
    // Clear from hand
    for (let i = 0; i < this.HAND_SIZE; i++) {
      if (this.hand[i] === cardId) {
        const def = CardDefinitions[cardId];
        const sw = (def && def.slotWidth) || 1;
        this.hand[i] = null;
        for (let s = 1; s < sw; s++) {
          if (i + s < this.HAND_SIZE && this.hand[i + s] === '__wide') this.hand[i + s] = null;
        }
        break;
      }
    }
    return true;
  }

  equipCard(slotIndex, cardId) {
    const def = CardDefinitions[cardId];
    const sw = (def && def.slotWidth) || 1;

    // Remove this card if it's already somewhere else
    for (let i = 0; i < this.HAND_SIZE; i++) {
      if (i !== slotIndex && this.hand[i] === cardId) {
        const oldDef = CardDefinitions[this.hand[i]];
        const oldSw = (oldDef && oldDef.slotWidth) || 1;
        this.hand[i] = null;
        for (let s = 1; s < oldSw; s++) {
          if (i + s < this.HAND_SIZE && this.hand[i + s] === '__wide') this.hand[i + s] = null;
        }
      }
    }

    // Clear old card and any wide sentinels at target slot
    const oldCard = this.hand[slotIndex];
    if (oldCard && oldCard !== '__wide') {
      const oldDef = CardDefinitions[oldCard];
      const oldSw = (oldDef && oldDef.slotWidth) || 1;
      this.hand[slotIndex] = null;
      for (let s = 1; s < oldSw; s++) {
        if (slotIndex + s < this.HAND_SIZE && this.hand[slotIndex + s] === '__wide') this.hand[slotIndex + s] = null;
      }
    } else if (oldCard === '__wide') {
      // Find parent and clear that wide card
      for (let i = 0; i < slotIndex; i++) {
        if (this.hand[i] && this.hand[i] !== '__wide') {
          const parentDef = CardDefinitions[this.hand[i]];
          const parentSw = (parentDef && parentDef.slotWidth) || 1;
          if (i + parentSw > slotIndex) {
            this.hand[i] = null;
            for (let s = 1; s < parentSw; s++) {
              if (i + s < this.HAND_SIZE && this.hand[i + s] === '__wide') this.hand[i + s] = null;
            }
            break;
          }
        }
      }
    }

    // Check if wide card fits from slotIndex
    let fits = true;
    for (let s = 1; s < sw; s++) {
      const nextSlot = slotIndex + s;
      if (nextSlot >= this.HAND_SIZE) { fits = false; break; }
      const next = this.hand[nextSlot];
      if (next !== null && next !== '__wide') { fits = false; break; }
    }

    // If it doesn't fit forward, try to place it shifted back
    let actualSlot = slotIndex;
    if (!fits && sw > 1) {
      actualSlot = Math.min(slotIndex, this.HAND_SIZE - sw);
      // Clear anything in the way
      for (let s = 0; s < sw; s++) {
        const si = actualSlot + s;
        if (this.hand[si] && this.hand[si] !== '__wide') {
          const cd = CardDefinitions[this.hand[si]];
          const csw = (cd && cd.slotWidth) || 1;
          this.hand[si] = null;
          for (let ss = 1; ss < csw; ss++) {
            if (si + ss < this.HAND_SIZE && this.hand[si + ss] === '__wide') this.hand[si + ss] = null;
          }
        } else {
          this.hand[si] = null;
        }
      }
    }

    this.hand[actualSlot] = cardId;
    for (let s = 1; s < sw; s++) {
      if (actualSlot + s < this.HAND_SIZE) this.hand[actualSlot + s] = '__wide';
    }
  }

  isEquippedInOtherSlot(slotIndex, cardId) {
    for (let i = 0; i < this.HAND_SIZE; i++) {
      if (i !== slotIndex && this.hand[i] === cardId) return true;
    }
    return false;
  }

  useCard(slotIndex) {
    const cardId = this.hand[slotIndex];
    if (!cardId || cardId === '__wide') return null;
    return this.getCardDef(cardId);
  }

  getCardDef(cardId) {
    const base = CardDefinitions[cardId];
    if (!base) return null;
    const level = this.upgrades[cardId] || 0;
    if (level === 0) return base;
    return {
      ...base,
      name: base.name + '+'.repeat(level),
      damage: Math.round(base.damage * (1 + 0.5 * level)),
      desc: base.desc + ` [Upgraded ${level}×]`
    };
  }

  upgradeCard(cardId) {
    if (!this.collection.includes(cardId)) return false;
    const current = this.upgrades[cardId] || 0;
    if (current >= 2) return false;
    this.upgrades[cardId] = current + 1;
    console.log(`[Deck] Upgraded "${cardId}" to level ${current + 1}`);
    return true;
  }

  getUpgradeChoices() {
    return this.collection.filter(id => {
      const level = this.upgrades[id] || 0;
      return level < 2;
    });
  }
}
