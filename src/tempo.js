import { events } from './EventBus.js';

export class TempoSystem {
  constructor() {
    this.value = 50;
    this.targetValue = 50;
    this.REST = 50;
    this.DECAY_RATE = 5;
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
  }

  setClassPassives(passives) {
    this.classPassives = passives;
    if (passives) {
      this.modifiers.gainMult = passives.tempoGainMult || 1;
      this.crashResetValue = passives.crashResetValue || 50;
      // Echo: dampened decay
      if (passives.dampedDecay) {
        this.modifiers.decayRate = passives.dampedDecay;
      }
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
    } else {
      // Update target via natural decay
      const dir = this.REST - this.targetValue;
      if (Math.abs(dir) > 0.1) {
        this.targetValue += Math.sign(dir) * this.DECAY_RATE * this.modifiers.decayRate * dt;
        this.targetValue = Math.max(0, Math.min(100, this.targetValue));
      }
    }

    // Smoothly animate actual value towards target
    const diff = this.targetValue - this.value;
    if (Math.abs(diff) > 0.1) {
      const moveSpeed = 40 * dt; // 40 points per second lerp speed
      if (Math.abs(diff) <= moveSpeed) {
        this.setValue(this.targetValue, true);
      } else {
        this.setValue(this.value + Math.sign(diff) * moveSpeed, true);
      }
    }
  }

  setValue(newVal, isLerpStep = false) {
    const oldZone = this.stateName();
    const actualVal = Math.max(0, Math.min(100, newVal));
    
    if (isLerpStep) {
      this.value = actualVal;
    } else {
      this.value = actualVal;
      this.targetValue = actualVal;
    }
    
    const newZone = this.stateName();

    if (oldZone !== newZone) {
      events.emit('ZONE_TRANSITION', { oldZone, newZone });
    }

  }

  _add(amount) {
    if (amount === 0 || this.isCrashed) return;
    if (amount > 0) amount *= this.modifiers.gainMult;
    this.targetValue += amount;
    if (this.targetValue >= 100) {
      this.targetValue = 100;
      this._triggerAccidentalCrash();
    } else if (this.targetValue <= 0) {
      this.targetValue = 0;
      this._triggerColdCrash();
    }
  }

  onComboHit(hitNum) { this._add(hitNum === 3 ? 15 : 4); }
  onKill() { this._add(10); }

  onDodge() {
    // Vanguard Fortified Dodge: no tempo cost
    if (this.classPassives && this.classPassives.fortifiedDodge) return;
    // Items can override dodge tempo shift
    if (this.itemManager) {
      this._add(this.itemManager.dodgeTempoShift(this.value));
    } else {
      this._add(this.value < 30 ? 0 : -5);
    }
  }

  onPerfectDodge() {
    // Echo zone ping: snap toward 50
    if (this.classPassives && this.classPassives.zonePingOnPerfectDodge) {
      const snap = this.value > 50 ? -15 : 15;
      this._add(snap);
      return;
    }
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

  _triggerAccidentalCrash() {
    if (this.isCrashed) return;
    const radius = 100 * this.modifiers.crashRadiusBonus;
    const dmg = Math.round(this.damageMultiplier() * 2.5 * 10);
    events.emit('REQUEST_PLAYER_POS_CRASH', { radius, dmg, accidental: true });
    this._doCrash(0.2, 0.4, 1.0);
  }

  _triggerColdCrash() {
    if (this.isCrashed) return;
    // Cold crash: massive freeze AoE, reset tempo to 20
    events.emit('COLD_CRASH', { radius: 200, freezeDur: 3.0 });
    this.isCrashed = true;
    this.value = 20;
    this.targetValue = 20;
    this.crashRecoverTimer = 0.6;
    events.emit('HIT_STOP', 0.25);
    events.emit('SCREEN_SHAKE', { duration: 0.45, intensity: 0.9 });
    events.emit('PLAY_SOUND', 'crash');
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
