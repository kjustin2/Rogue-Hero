import { events } from './EventBus.js';

export class TempoSystem {
  constructor() {
    this.value = 50;
    this.REST = 50;
    this.DECAY_RATE = 8;
    this.isCrashed = false;
    this.crashRecoverTimer = 0;
    this.sustainedTimer = 0;
    this.modifiers = {
      decayRate: 1,
      gainMult: 1,
      crashRadiusBonus: 1
    };
    // Class passives (set by main.js on run start)
    this.classPassives = null;
    // Item manager reference (set by main.js)
    this.itemManager = null;
    // Crash reset value (class-dependent)
    this.crashResetValue = 50;

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

  setClassPassives(passives) {
    this.classPassives = passives;
    if (passives) {
      this.modifiers.gainMult = passives.tempoGainMult || 1;
      this.crashResetValue = passives.crashResetValue || 50;
    }
  }

  update(dt) {
    // Crash recovery runs on game-time
    if (this.isCrashed) {
      this.crashRecoverTimer -= dt;
      if (this.crashRecoverTimer <= 0) this.isCrashed = false;
      return;
    }

    // Check items for decay blocking
    if (this.itemManager && !this.itemManager.shouldDecay(this.value)) return;

    if (this.sustainedTimer > 0) {
      this.sustainedTimer = Math.max(0, this.sustainedTimer - dt);
      return;
    }

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

  onDodge() {
    // Items can override dodge tempo shift
    if (this.itemManager) {
      this._add(this.itemManager.dodgeTempoShift(this.value));
    } else {
      this._add(this.value < 30 ? 0 : -5);
    }
  }

  onPerfectDodge() {
    const gain = (this.classPassives && this.classPassives.perfectDodgeTempoGain) || 10;
    this._add(gain);
  }

  onHeavyHit() { this._add(20); }
  onHeavyMiss() { this._add(8); }

  onDamageTaken() {
    // Warden/Frost passive: taking damage builds tempo
    if (this.classPassives && this.classPassives.damageTempoBuild) {
      this._add(this.classPassives.damageTempoBuild);
    }
  }

  onDrained() { this._add(-20); }

  manualCrash(pos) {
    const minTempo = (this.classPassives && this.classPassives.manualCrashMinTempo) || 85;
    if (this.isCrashed || this.value < minTempo) return false;
    const radius = 120 * this.modifiers.crashRadiusBonus;
    const dmg = Math.round(this.damageMultiplier() * 2.5 * 10);

    events.emit('CRASH_ATTACK', { x: pos.x, y: pos.y, radius, dmg, source: 'manual' });
    this._doCrash(0.15, 0.25, 0.7);
    return true;
  }

  _triggerAccidentalCrash() {
    const radius = 80 * this.modifiers.crashRadiusBonus;
    const dmg = Math.round(this.damageMultiplier() * 1.5 * 10);
    events.emit('REQUEST_PLAYER_POS_CRASH', { radius, dmg });
    this._doCrash(0.2, 0.3, 0.8);
  }

  _doCrash(hitStopDur, shakeDur, shakeIntens) {
    this.isCrashed = true;
    this.value = this.crashResetValue;
    events.emit('HIT_STOP', hitStopDur);
    events.emit('SCREEN_SHAKE', { duration: shakeDur, intensity: shakeIntens });
    events.emit('PLAY_SOUND', 'crash');
    this.crashRecoverTimer = shakeDur + 0.05;
  }

  damageMultiplier() {
    let mult = 1.0;
    if (this.value < 30) mult = 0.7;
    else if (this.value < 70) mult = 1.0;
    else if (this.value < 90) mult = 1.3;
    else mult = 1.8;

    // Item bonus (Resonance at 50 ±5)
    if (this.itemManager) mult *= this.itemManager.damageMultiplier(this.value);
    return mult;
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
