import { events } from './EventBus.js';

export class TempoSystem {
  constructor() {
    this.value = 50;
    this.REST = 50;
    this.DECAY_RATE = 8;
    this.isCrashed = false;
    this.sustainedTimer = 0;
    this.modifiers = {
      decayRate: 1,
      gainMult: 1,
      crashRadiusBonus: 1
    };
    
    // Bind to combat events
    events.on('COMBO_HIT', ({ hitNum }) => this.onComboHit(hitNum));
    events.on('KILL', () => this.onKill());
    events.on('DODGE', () => this.onDodge());
    events.on('PERFECT_DODGE', () => this.onPerfectDodge());
    events.on('HEAVY_HIT', () => this.onHeavyHit());
    events.on('HEAVY_MISS', () => this.onHeavyMiss());
    events.on('DAMAGE_TAKEN', () => this.onDamageTaken());
    events.on('DRAIN', () => this.onDrained());
    events.on('TRIGGER_CRASH', (pos) => this.manualCrash(pos));
  }

  update(dt) {
    if (this.sustainedTimer > 0) {
      this.sustainedTimer = Math.max(0, this.sustainedTimer - dt);
      return;
    }
    if (this.isCrashed) return;

    const dir = this.REST - this.value;
    if (Math.abs(dir) < 0.1) {
      if (this.value !== this.REST) this.setValue(this.REST);
      return;
    }
    
    this.setValue(this.value + Math.sign(dir) * this.DECAY_RATE * this.modifiers.decayRate * dt);
  }

  setValue(newVal) {
    const oldZone = this.stateName();
    this.value = Math.max(0, Math.min(100, newVal));
    const newZone = this.stateName();
    
    if (oldZone !== newZone) {
      events.emit('ZONE_TRANSITION', { oldZone, newZone });
    }
    
    if (this.value >= 100 && !this.isCrashed) {
      this._triggerAccidentalCrash();
    }
  }

  _add(amount) {
    if (amount === 0 || this.isCrashed) return;
    if (amount > 0) amount *= this.modifiers.gainMult;
    this.setValue(this.value + amount);
  }

  onComboHit(hitNum) { this._add(hitNum === 3 ? 15 : 4); }
  onKill() { this._add(10); }
  onDodge() { this._add(this.value < 30 ? 0 : -5); } // Free dodge in Cold
  onPerfectDodge() { this._add(10); }
  onHeavyHit() { this._add(20); }
  onHeavyMiss() { this._add(8); }
  onDamageTaken() { /* e.g. Warden buffs go here, implemented in player/class system via observing this event */ }
  onDrained() { this._add(-20); }

  manualCrash(pos) {
    if (this.isCrashed || this.value < 85) return false;
    const radius = 120 * this.modifiers.crashRadiusBonus;
    const dmg = Math.round(this.damageMultiplier() * 2.5 * 10); // base weapon dmg assumed 10
    
    events.emit('CRASH_ATTACK', { x: pos.x, y: pos.y, radius, dmg, source: 'manual' });
    this._doCrash(0.15, 0.25, 0.7);
    return true;
  }

  _triggerAccidentalCrash() {
    const radius = 80 * this.modifiers.crashRadiusBonus;
    const dmg = Math.round(this.damageMultiplier() * 1.5 * 10);
    events.emit('REQUEST_PLAYER_POS_CRASH', { radius, dmg }); // Will be answered by Player
    this._doCrash(0.2, 0.3, 0.8);
  }

  _doCrash(hitStopDur, shakeDur, shakeIntens) {
    this.isCrashed = true;
    this.value = 70; // baseline reset
    events.emit('HIT_STOP', hitStopDur);
    events.emit('SCREEN_SHAKE', { duration: shakeDur, intensity: shakeIntens });
    events.emit('PLAY_SOUND', 'crash');
    setTimeout(() => { this.isCrashed = false; }, shakeDur * 1000 + 50);
  }

  damageMultiplier() {
    if (this.value < 30) return 0.7;
    if (this.value < 70) return 1.0;
    if (this.value < 90) return 1.3;
    return 1.8;
  }

  speedMultiplier() {
    if (this.value >= 90) return 1.0;
    if (this.value >= 70) return 1.2;
    if (this.value < 30) return 0.9;
    return 1.0;
  }

  stateName() {
    if (this.value < 30) return 'COLD';
    if (this.value < 70) return 'FLOWING';
    if (this.value < 90) return 'HOT';
    return 'CRITICAL';
  }

  stateColor() {
    if (this.value < 30) return '#4488ff';
    if (this.value < 70) return '#44ff88';
    if (this.value < 90) return '#ff8800';
    return '#ff3333';
  }

  barColor() {
    if (this.value < 30) return '#2255cc';
    if (this.value < 70) return '#22aa55';
    if (this.value < 90) return '#cc6600';
    return '#cc1111';
  }
}
