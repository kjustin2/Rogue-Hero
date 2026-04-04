// Items.js — Passive relic system
import { events } from './EventBus.js';

export const ItemDefinitions = {
  metronome:      { id: 'metronome',      name: 'Metronome',      rarity: 'common',   color: '#ffdd44', desc: 'Tempo decays 3× faster — easier zone control' },
  resonance:      { id: 'resonance',      name: 'Resonance',      rarity: 'uncommon', color: '#44ffaa', desc: 'At 50 Tempo (±5), damage is doubled' },
  runaway:        { id: 'runaway',        name: 'Runaway',        rarity: 'uncommon', color: '#ff8844', desc: 'Tempo no longer decays from Hot' },
  iron_pulse:     { id: 'iron_pulse',     name: 'Iron Pulse',     rarity: 'common',   color: '#aaaacc', desc: 'Max HP +2, restore 2 HP' },
  cold_fury:      { id: 'cold_fury',      name: 'Cold Fury',      rarity: 'common',   color: '#4488ff', desc: 'At Cold Tempo, dash deals contact damage' },
  surge_coil:     { id: 'surge_coil',     name: 'Surge Coil',     rarity: 'uncommon', color: '#ff4444', desc: 'Crash burst radius +60%' },
  echo:           { id: 'echo',           name: 'Echo',           rarity: 'uncommon', color: '#cc88ff', desc: 'On Tempo Crash, last attack repeats at half damage' },
  precision:      { id: 'precision',      name: 'Precision',      rarity: 'common',   color: '#aaddff', desc: 'Perfect Dodge slow-mo lasts twice as long' },
  glass_heart:    { id: 'glass_heart',    name: 'Glass Heart',    rarity: 'rare',     color: '#ff3333', desc: 'Start each room at 90 Tempo' },
  tempo_tap:      { id: 'tempo_tap',      name: 'Tempo Tap',      rarity: 'uncommon', color: '#44ff88', desc: 'Dodging raises Tempo +5 instead of −5' },
  sustained:      { id: 'sustained',      name: 'Sustained',      rarity: 'uncommon', color: '#ffaa44', desc: 'Killing an enemy stops Tempo decay for 2s' },
  last_rites:     { id: 'last_rites',     name: 'Last Rites',     rarity: 'rare',     color: '#ff2222', desc: 'On death: auto-crash if Tempo ≥ 50, revive at 1 HP (once)' },
  cold_blood:     { id: 'cold_blood',     name: 'Cold Blood',     rarity: 'common',   color: '#6688ff', desc: 'Kills while Cold restore 1 HP (once per room)' },
  deadweight:     { id: 'deadweight',     name: 'Deadweight',     rarity: 'common',   color: '#888888', desc: '+3 Max HP, −10% speed. Pure tank.' },
  volatile_soles: { id: 'volatile_soles', name: 'Volatile Soles', rarity: 'uncommon', color: '#ff6600', desc: 'Crash burst radius +60%' },
};

export class ItemManager {
  constructor() {
    this.equipped = [];
    this.coldBloodUsedThisRoom = false;
    this.sustainedTimer = 0;
    this.lastRitesUsed = false;
  }

  has(id) { return this.equipped.includes(id); }

  reset() {
    this.equipped = [];
    this.coldBloodUsedThisRoom = false;
    this.sustainedTimer = 0;
    this.lastRitesUsed = false;
  }

  resetRoom() {
    this.coldBloodUsedThisRoom = false;
  }

  update(dt) {
    if (this.sustainedTimer > 0) this.sustainedTimer -= dt;
  }

  add(itemId, player, tempo) {
    if (this.equipped.includes(itemId)) return;
    this.equipped.push(itemId);
    console.log(`[Items] Equipped "${itemId}"`);

    switch (itemId) {
      case 'iron_pulse':
        player.maxHp += 2;
        player.hp = Math.min(player.hp + 2, player.maxHp);
        break;
      case 'deadweight':
        player.maxHp += 3;
        player.hp = Math.min(player.hp + 3, player.maxHp);
        player.BASE_SPEED = Math.round(player.BASE_SPEED * 0.9);
        break;
    }

    // Recompute crash radius bonus
    if (tempo) {
      let mult = 1.0;
      if (this.has('surge_coil'))     mult *= 1.6;
      if (this.has('volatile_soles')) mult *= 1.6;
      tempo.modifiers.crashRadiusBonus = mult;
    }
    // Recompute decay rate
    if (tempo) {
      tempo.modifiers.decayRate = this.has('metronome') ? 3.0 : 1.0;
    }
  }

  // Called by tempo.update — can block decay
  shouldDecay(tempoValue) {
    if (this.sustainedTimer > 0) return false;
    if (this.has('runaway') && tempoValue >= 70) return false;
    return true;
  }

  // Extra damage multiplier from items
  damageMultiplier(tempoValue) {
    if (this.has('resonance') && Math.abs(tempoValue - 50) <= 5) return 2.0;
    return 1.0;
  }

  // Dodge tempo shift (items can invert it)
  dodgeTempoShift(tempoValue) {
    if (this.has('tempo_tap')) return 5;
    return tempoValue < 30 ? 0 : -5;
  }

  perfectDodgeSlowMoDuration() {
    return this.has('precision') ? 0.8 : 0.4;
  }

  shouldColdDashDamage(tempoValue) {
    return this.has('cold_fury') && tempoValue < 30;
  }

  startingTempo() {
    return this.has('glass_heart') ? 90 : 50;
  }

  // On enemy kill callback
  onKill(tempoValue, player) {
    if (this.has('sustained')) this.sustainedTimer = 2.0;
    if (this.has('cold_blood') && tempoValue < 30 && !this.coldBloodUsedThisRoom) {
      this.coldBloodUsedThisRoom = true;
      player.heal(1);
      return true;
    }
    return false;
  }

  // On player death — Last Rites check
  onDeath(tempoValue, player) {
    if (this.has('last_rites') && !this.lastRitesUsed && tempoValue >= 50) {
      this.lastRitesUsed = true;
      player.hp = 1;
      player.alive = true;
      events.emit('TRIGGER_CRASH', { x: player.x, y: player.y });
      return true; // Revived
    }
    return false;
  }

  // Generate 3 random item choices for post-combat reward
  generateChoices(count = 3) {
    const pool = Object.keys(ItemDefinitions).filter(id => !this.equipped.includes(id));
    pool.sort(() => Math.random() - 0.5);
    return pool.slice(0, Math.min(count, pool.length));
  }
}
