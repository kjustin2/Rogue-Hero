// Characters.js — Playable character definitions with passive abilities

export const Characters = {
  blade: {
    id: 'blade',
    name: 'Blade',
    title: 'The Berserker',
    description: 'Aggressive melee fighter. Crash resets to 70 instead of 50. Tempo gain +50%.',
    color: '#ff4444',
    hp: 6,
    maxHp: 6,
    apRegen: 0.7,
    baseSpeed: 280,
    startingDeck: ['strike', 'lunge', 'berserk'],
    unlockCondition: null,
    // Passive abilities
    passives: {
      crashResetValue: 70,      // Crash resets to 70 not 50
      tempoGainMult: 1.5,       // +50% tempo gain from attacks
      manualCrashMinTempo: 75,  // Can crash earlier (75 instead of 85)
      crashStagger: false,      // No stagger on accidental crash
    }
  },
  frost: {
    id: 'frost',
    name: 'Frost',
    title: 'The Warden',
    description: 'Defensive controller. Taking damage raises Tempo +15. Cold damage reduced 30%.',
    color: '#66ccff',
    hp: 8,
    maxHp: 8,
    apRegen: 0.6,
    baseSpeed: 250,
    startingDeck: ['chill_blade', 'frost_nova', 'shield_bash'],
    unlockCondition: 'heal_10_hp',
    passives: {
      damageTempoBuild: 15,     // Taking damage raises Tempo
      coldDamageReduction: 0.3, // 30% damage reduction in Cold
      tempoGainMult: 1.0,
      crashResetValue: 50,
      manualCrashMinTempo: 85,
      crashStagger: true,
    }
  },
  shadow: {
    id: 'shadow',
    name: 'Shadow',
    title: 'The Phantom',
    description: 'Hit-and-run assassin. Perfect Dodge window doubled. First hit after dodge crits.',
    color: '#bb44ff',
    hp: 5,
    maxHp: 5,
    apRegen: 0.9,
    baseSpeed: 310,
    startingDeck: ['dash_strike', 'whip_crack', 'vampire_bite'],
    unlockCondition: 'reach_floor_2',
    passives: {
      perfectDodgeWindowMult: 2.0,   // Doubled window
      perfectDodgeTempoGain: 20,     // +20 instead of +10
      postDodgeCrit: true,           // First hit after perfect dodge crits
      tempoGainMult: 1.0,
      crashResetValue: 50,
      manualCrashMinTempo: 85,
      crashStagger: true,
    }
  }
};

export const CharacterList = Object.values(Characters);

export const DIFFICULTY_NAMES = ['Normal', 'Hard', 'Brutal'];
export const DIFFICULTY_COLORS = ['#44ff88', '#ffaa44', '#ff4444'];

export const DIFFICULTY_MODS = [
  { hpMult: 1.0, dmgMult: 1.0, spdMult: 1.0 },
  { hpMult: 1.5, dmgMult: 1.3, spdMult: 1.15 },
  { hpMult: 2.0, dmgMult: 1.6, spdMult: 1.3 }
];
