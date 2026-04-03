// Characters.js — Playable character definitions

export const Characters = {
  blade: {
    id: 'blade',
    name: 'Blade',
    title: 'The Berserker',
    description: 'Aggressive melee fighter. High damage, high tempo.',
    color: '#ff4444',
    hp: 6,
    maxHp: 6,
    apRegen: 0.7,
    baseSpeed: 280,
    startingDeck: ['strike', 'lunge', 'berserk'],
    unlockCondition: null // Always available
  },
  frost: {
    id: 'frost',
    name: 'Frost',
    title: 'The Warden',
    description: 'Defensive controller. Slows enemies, manages tempo.',
    color: '#66ccff',
    hp: 8,
    maxHp: 8,
    apRegen: 0.6,
    baseSpeed: 250,
    startingDeck: ['chill_blade', 'frost_nova', 'shield_bash'],
    unlockCondition: 'heal_10_hp' // Heal 10+ HP in a run
  },
  shadow: {
    id: 'shadow',
    name: 'Shadow',
    title: 'The Phantom',
    description: 'Hit-and-run assassin. Dashes, lifesteal, long reach.',
    color: '#bb44ff',
    hp: 5,
    maxHp: 5,
    apRegen: 0.9,
    baseSpeed: 310,
    startingDeck: ['dash_strike', 'whip_crack', 'vampire_bite'],
    unlockCondition: 'reach_floor_2' // Reach floor 2 in any run
  }
};

export const CharacterList = Object.values(Characters);

export const DIFFICULTY_NAMES = ['Normal', 'Hard', 'Brutal'];
export const DIFFICULTY_COLORS = ['#44ff88', '#ffaa44', '#ff4444'];

// Difficulty multipliers: [hpMult, dmgMult, speedMult]
export const DIFFICULTY_MODS = [
  { hpMult: 1.0, dmgMult: 1.0, spdMult: 1.0 },   // Normal
  { hpMult: 1.5, dmgMult: 1.3, spdMult: 1.15 },   // Hard
  { hpMult: 2.0, dmgMult: 1.6, spdMult: 1.3 }      // Brutal
];
