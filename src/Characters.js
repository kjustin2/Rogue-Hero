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
    startingPool: ['strike', 'lunge', 'berserk', 'heavy_crash', 'double_slash', 'arc_slash'],
    unlockCondition: null,
    unlockConditionText: null,
    // masteryCards[i] unlocks at mastery level i+1 (runs: 1, 3, 5, 10)
    masteryCards: ['execute', 'blood_pact', 'glass_cannon', 'berserkers_oath'],
    masteryCardDesc: ['Blade Lv2: Execute (low-HP instakill)', 'Blade Lv3: Blood Pact (HP for power)', 'Blade Lv4: Glass Cannon (all-in burst)', 'Blade Lv5: Berserker\'s Oath (rage stacks)'],
    passives: {
      crashResetValue: 70,
      tempoGainMult: 1.5,
      crashStagger: false,
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
    startingPool: ['chill_blade', 'frost_nova', 'shield_bash', 'cold_wave', 'strike', 'tempo_surge'],
    unlockCondition: 'heal_10_hp',
    unlockConditionText: 'Heal 10+ HP in a single run',
    masteryCards: ['iron_wall', 'second_wind', 'perfect_guard', 'last_stand'],
    masteryCardDesc: ['Frost Lv2: Iron Wall (block incoming)', 'Frost Lv3: Second Wind (emergency heal)', 'Frost Lv4: Perfect Guard (parry mastery)', 'Frost Lv5: Last Stand (clutch burst)'],
    passives: {
      damageTempoBuild: 15,
      coldDamageReduction: 0.3,
      tempoGainMult: 1.0,
      crashResetValue: 50,
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
    startingPool: ['dash_strike', 'void_lance', 'vampire_bite', 'phantom_step', 'shadow_mark', 'quick_shot'],
    unlockCondition: 'reach_floor_2',
    unlockConditionText: 'Reach Act 2 in any run',
    masteryCards: ['smoke_screen', 'shadow_mark', 'death_blow', 'marked_for_death'],
    masteryCardDesc: ['Shadow Lv2: Smoke Screen (vanish)', 'Shadow Lv3: Shadow Mark (amplify damage)', 'Shadow Lv4: Death Blow (execute assassin)', 'Shadow Lv5: Marked for Death (full debuff)'],
    passives: {
      perfectDodgeWindowMult: 2.0,
      perfectDodgeTempoGain: 20,
      postDodgeCrit: true,
      tempoGainMult: 1.0,
      crashResetValue: 50,
      crashStagger: true,
    }
  },
  echo: {
    id: 'echo',
    name: 'Echo',
    title: 'The Resonant',
    description: 'Sweet-spot fighter. Attacks at ±5 of 50 Tempo send a free 100px pulse. Decay 0.5×. Zone Ping on Perfect Dodge.',
    color: '#00eedd',
    hp: 5,
    maxHp: 5,
    apRegen: 0.85,
    baseSpeed: 270,
    startingPool: ['chill_blade', 'strike', 'counter_slash', 'arc_slash', 'frost_nova', 'berserk'],
    unlockCondition: 'reach_floor_3',
    unlockConditionText: 'Reach Act 3 in any run',
    masteryCards: ['resonant_pulse', 'resonance_rune', 'tempo_shift_stance', 'crash_rune'],
    masteryCardDesc: ['Echo Lv2: Resonant Pulse (zone burst)', 'Echo Lv3: Resonance Rune (tempo anchor)', 'Echo Lv4: Tempo Shift Stance (zone control)', 'Echo Lv5: Crash Rune (crash detonation)'],
    passives: {
      resonancePulse: true,
      dampedDecay: 0.5,
      zonePingOnPerfectDodge: true,
      tempoGainMult: 1.0,
      crashResetValue: 50,
      crashStagger: true,
    }
  },
  wraith: {
    id: 'wraith',
    name: 'Wraith',
    title: 'The Undying',
    description: 'Glass cannon. At 1-2 HP: 2× damage, kills heal. First death per room: drop to 1 HP + free crash.',
    color: '#ff2255',
    hp: 4,
    maxHp: 4,
    apRegen: 0.95,
    baseSpeed: 300,
    startingPool: ['blood_pact', 'gut_rend', 'dash_strike', 'berserk', 'vampire_bite', 'counter_slash'],
    unlockCondition: 'win_any',
    unlockConditionText: 'Win a run on any character',
    masteryCards: ['soul_drain', 'deaths_bargain', 'leech_field', 'reaper'],
    masteryCardDesc: ['Wraith Lv2: Soul Drain (steal life)', 'Wraith Lv3: Death\'s Bargain (HP for power)', 'Wraith Lv4: Leech Field (AoE lifesteal)', 'Wraith Lv5: Reaper (instakill zone)'],
    passives: {
      deathsEdge: true,
      undying: true,
      noHealingFromRelics: true,
      tempoGainMult: 1.0,
      crashResetValue: 30,
      crashStagger: false,
    }
  },
  vanguard: {
    id: 'vanguard',
    name: 'Vanguard',
    title: 'The Ironclad',
    description: 'Tank brawler. Taking damage builds Guard stacks (4 max). Guard boosts cleave damage. 6 AP max. Long dodge cooldown.',
    color: '#ddaa22',
    hp: 10,
    maxHp: 10,
    apRegen: 0.55,
    baseSpeed: 230,
    startingPool: ['heavy_crash', 'shield_bash', 'arc_slash', 'strike', 'spin_attack', 'whirlwind'],
    unlockCondition: 'win_brutal',
    unlockConditionText: 'Win a run on Hard difficulty',
    masteryCards: ['earthshaker', 'whirlwind', 'mirror_strike', 'last_stand'],
    masteryCardDesc: ['Vanguard Lv2: Earthshaker (ground slam)', 'Vanguard Lv3: Whirlwind (spin AoE)', 'Vanguard Lv4: Mirror Strike (reflected damage)', 'Vanguard Lv5: Last Stand (tank limit break)'],
    passives: {
      ironGuard: true,
      maxGuardStacks: 4,
      guardDamageReduction: 2,
      punisher: true,
      fortifiedDodge: true,
      dodgeCooldown: 1.2,
      maxAP: 6,
      tempoGainMult: 1.0,
      crashResetValue: 50,
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
