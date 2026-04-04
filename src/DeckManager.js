export const CardDefinitions = {
  // ── BASIC ─────────────────────────────────────────────────────
  strike: {
    id: 'strike', name: 'Strike', cost: 1, tempoShift: 10,
    damage: 10, range: 90, type: 'melee', color: '#ffffff',
    desc: 'Basic slash. Short range. +10 Tempo.'
  },
  lunge: {
    id: 'lunge', name: 'Lunge', cost: 2, tempoShift: 20,
    damage: 18, range: 140, type: 'melee', color: '#ffcc44',
    desc: 'Long reach thrust. +20 Tempo.'
  },
  chill_blade: {
    id: 'chill_blade', name: 'Chill Blade', cost: 1, tempoShift: -15,
    damage: 8, range: 90, type: 'melee', color: '#66ccff',
    desc: 'Cool tempo. -15 Tempo.'
  },
  heavy_crash: {
    id: 'heavy_crash', name: 'Heavy Crash', cost: 4, tempoShift: 40,
    damage: 35, range: 110, type: 'melee', color: '#ff4444',
    desc: 'Devastating blow. +40 Tempo.'
  },

  // ── RANGED / AOE ──────────────────────────────────────────────
  piercing_surge: {
    id: 'piercing_surge', name: 'Surge', cost: 3, tempoShift: 25,
    damage: 20, range: 200, type: 'projectile', color: '#44aaff',
    desc: 'Radial wave hits all in range. +25 Tempo.'
  },
  frost_nova: {
    id: 'frost_nova', name: 'Frost Nova', cost: 3, tempoShift: -30,
    damage: 5, range: 160, type: 'projectile', color: '#aaeeff',
    desc: 'Stagger ALL nearby enemies 1s. -30 Tempo.'
  },
  arc_slash: {
    id: 'arc_slash', name: 'Arc Slash', cost: 2, tempoShift: 15,
    damage: 10, range: 120, type: 'cleave', color: '#ff8844',
    desc: 'Sweeping arc hits ALL nearby. +15 Tempo.'
  },
  chain_lightning: {
    id: 'chain_lightning', name: 'Chain Lightning', cost: 3, tempoShift: 20,
    damage: 8, range: 250, type: 'projectile', color: '#ffff44',
    desc: 'Zaps everything in huge radius. +20 Tempo.',
    bonusCard: true
  },
  thunder_clap: {
    id: 'thunder_clap', name: 'Thunder Clap', cost: 4, tempoShift: 35,
    damage: 15, range: 180, type: 'projectile', color: '#ffdd00',
    desc: 'Massive AoE + stagger. +35 Tempo.',
    bonusCard: true
  },

  // ── MOBILITY ──────────────────────────────────────────────────
  dash_strike: {
    id: 'dash_strike', name: 'Dash Strike', cost: 2, tempoShift: 10,
    damage: 15, range: 180, type: 'dash', color: '#ffea00',
    desc: 'Teleport to target and slash. +10 Tempo.'
  },
  phantom_step: {
    id: 'phantom_step', name: 'Phantom Step', cost: 1, tempoShift: 5,
    damage: 6, range: 220, type: 'dash', color: '#cc88ff',
    desc: 'Long-range dash, light damage. +5 Tempo.',
    bonusCard: true
  },

  // ── UTILITY / SUSTAIN ─────────────────────────────────────────
  vampire_bite: {
    id: 'vampire_bite', name: 'Vampire Bite', cost: 3, tempoShift: -20,
    damage: 12, range: 90, type: 'melee', color: '#cc44cc',
    desc: 'Heal 1 HP on kill. -20 Tempo.'
  },
  shield_bash: {
    id: 'shield_bash', name: 'Shield Bash', cost: 2, tempoShift: -10,
    damage: 8, range: 80, type: 'melee', color: '#88aacc',
    desc: 'Stagger target 0.8s. -10 Tempo.'
  },
  blood_pact: {
    id: 'blood_pact', name: 'Blood Pact', cost: 2, tempoShift: 30,
    damage: 22, range: 90, type: 'melee', color: '#ff2266',
    desc: 'Costs 1 HP. Huge damage. +30 Tempo.',
    bonusCard: true
  },
  iron_wall: {
    id: 'iron_wall', name: 'Iron Wall', cost: 3, tempoShift: -25,
    damage: 0, range: 130, type: 'projectile', color: '#aaaacc',
    desc: 'No damage. Stagger ALL nearby 1.5s. -25 Tempo.',
    bonusCard: true
  },

  // ── HIGH RISK ─────────────────────────────────────────────────
  berserk: {
    id: 'berserk', name: 'Berserk', cost: 2, tempoShift: 50,
    damage: 25, range: 80, type: 'melee', color: '#ff2222',
    desc: 'Massive damage, tight range. +50 Tempo.'
  },
  whip_crack: {
    id: 'whip_crack', name: 'Whip Crack', cost: 1, tempoShift: 5,
    damage: 6, range: 200, type: 'melee', color: '#ffdd88',
    desc: 'Longest melee reach, low damage. +5 Tempo.'
  },
  execute: {
    id: 'execute', name: 'Execute', cost: 4, tempoShift: 30,
    damage: 50, range: 80, type: 'melee', color: '#ff0000',
    desc: 'Finishing blow. 50 base DMG. +30 Tempo.',
    bonusCard: true
  },
  tempo_surge: {
    id: 'tempo_surge', name: 'Tempo Surge', cost: 1, tempoShift: -40,
    damage: 3, range: 100, type: 'melee', color: '#44ffaa',
    desc: 'Almost no damage. Massive tempo drop. -40 Tempo.',
    bonusCard: true
  },
  shadow_mark: {
    id: 'shadow_mark', name: 'Shadow Mark', cost: 2, tempoShift: 15,
    damage: 20, range: 150, type: 'dash', color: '#8844bb',
    desc: 'Dash + mark target (next hit crits). +15 Tempo.',
    bonusCard: true
  }
};

export class DeckManager {
  constructor() {
    this.collection = [];
    this.hand = [null, null, null, null];
    this.HAND_SIZE = 4;
    this.upgrades = {}; // { cardId: upgradeLevel }
  }

  initDeck(startingCardIds) {
    this.collection = [...new Set(startingCardIds)];
    this.upgrades = {};
    this.hand = [null, null, null, null];
    for (let i = 0; i < this.HAND_SIZE; i++) {
      if (i < this.collection.length) {
        this.hand[i] = this.collection[i];
      }
    }
    console.log(`[Deck] Initialized with [${this.collection.join(', ')}]`);
  }

  addCard(cardId) {
    if (this.collection.includes(cardId)) return false;
    this.collection.push(cardId);
    for (let i = 0; i < this.HAND_SIZE; i++) {
      if (!this.hand[i]) {
        this.hand[i] = cardId;
        break;
      }
    }
    return true;
  }

  equipCard(slotIndex, cardId) {
    for (let i = 0; i < this.HAND_SIZE; i++) {
      if (i !== slotIndex && this.hand[i] === cardId) {
        this.hand[i] = null;
      }
    }
    this.hand[slotIndex] = cardId;
  }

  isEquippedInOtherSlot(slotIndex, cardId) {
    for (let i = 0; i < this.HAND_SIZE; i++) {
      if (i !== slotIndex && this.hand[i] === cardId) return true;
    }
    return false;
  }

  useCard(slotIndex) {
    const cardId = this.hand[slotIndex];
    if (!cardId) return null;
    return this.getCardDef(cardId);
  }

  // Get effective card definition (with upgrades applied)
  getCardDef(cardId) {
    const base = CardDefinitions[cardId];
    if (!base) return null;
    const level = this.upgrades[cardId] || 0;
    if (level === 0) return base;
    // Upgraded: +50% damage per level, append + to name
    return {
      ...base,
      name: base.name + '+'.repeat(level),
      damage: Math.round(base.damage * (1 + 0.5 * level)),
      desc: base.desc + ` [Upgraded ${level}×]`
    };
  }

  // Upgrade a card (increment level)
  upgradeCard(cardId) {
    if (!this.collection.includes(cardId)) return false;
    const current = this.upgrades[cardId] || 0;
    if (current >= 2) return false; // Max 2 upgrades
    this.upgrades[cardId] = current + 1;
    console.log(`[Deck] Upgraded "${cardId}" to level ${current + 1}`);
    return true;
  }

  // Get cards eligible for upgrade
  getUpgradeChoices() {
    return this.collection.filter(id => {
      const level = this.upgrades[id] || 0;
      return level < 2;
    });
  }
}
