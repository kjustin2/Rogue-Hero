import { Entity } from './Entity.js';
import { events } from './EventBus.js';

export class Player extends Entity {
  constructor(x, y, hp, maxHp, baseSpeed) {
    super(x, y, 14);
    this.hp = hp;
    this.maxHp = maxHp;
    this.BASE_SPEED = baseSpeed;
    this.budget = 0;
    this.maxBudget = 5;
    this.apRegen = 0.7;
    this.attackCooldown = 0;
    this.dodgeCooldown = 0;
    this.dodging = false;
    this.dodgeTimer = 0;
    this.dodgeDuration = 0.15;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.hitFlash = 0;
    this.classPassives = null;

    // Perfect Dodge
    this.perfectDodgeWindow = 0;       // How long perfect dodge detection is active
    this.perfectDodgeTriggered = false; // Already emitted this dodge
    this.trailTimer = 0;
  }

  setClassPassives(passives) {
    this.classPassives = passives;
  }

  heal(amount) {
    this.hp = Math.min(this.hp + amount, this.maxHp);
  }

  updateLogic(dt, input, tempo, roomMap) {
    if (!this.alive) return;

    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.comboCount = 0;

    // AP regen
    this.budget = Math.min(this.budget + this.apRegen * dt, this.maxBudget);

    const spd = this.BASE_SPEED * tempo.speedMultiplier();

    // Dodge
    if (this.dodging) {
      this.dodgeTimer -= dt;
      if (this.dodgeTimer <= 0) {
        this.dodging = false;
        this.perfectDodgeWindow = 0;
      }
    }

    // Movement
    if (!this.dodging) {
      let mx = 0, my = 0;
      if (input.isDown('a') || input.isDown('arrowleft'))  mx -= 1;
      if (input.isDown('d') || input.isDown('arrowright')) mx += 1;
      if (input.isDown('w') || input.isDown('arrowup'))    my -= 1;
      if (input.isDown('s') || input.isDown('arrowdown'))  my += 1;

      if (mx !== 0 || my !== 0) {
        const len = Math.sqrt(mx * mx + my * my);
        this.vx = (mx / len) * spd;
        this.vy = (my / len) * spd;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
      } else {
        this.vx = 0;
        this.vy = 0;
      }

      // Dodge trigger
      if ((input.consumeKey(' ') || input.consumeKey('shift')) && this.dodgeCooldown <= 0) {
        // Can't dodge in Critical (90+) — unless Cold
        if (tempo.value >= 90) {
          // Dodge disabled at Critical
        } else {
          this.dodging = true;
          this.dodgeTimer = this.dodgeDuration;
          this.dodgeCooldown = 0.3;
          // Perfect dodge window
          const basePerfWindow = 0.12;
          const windowMult = (this.classPassives && this.classPassives.perfectDodgeWindowMult) || 1.0;
          this.perfectDodgeWindow = basePerfWindow * windowMult;
          this.perfectDodgeTriggered = false;

          const dmx = input.mouse.x - this.x, dmy = input.mouse.y - this.y;
          const dist = Math.sqrt(dmx * dmx + dmy * dmy);
          if (dist > 5) {
            this.vx = (dmx / dist) * spd * 2.2;
            this.vy = (dmy / dist) * spd * 2.2;
          } else if (this.vx !== 0 || this.vy !== 0) {
            const len = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            this.vx = (this.vx / len) * spd * 2.2;
            this.vy = (this.vy / len) * spd * 2.2;
          }
          events.emit('DODGE');
          events.emit('PLAY_SOUND', 'dodge');
        }
      }
    } else {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    // Perfect dodge detection — check if a projectile or enemy attack was near during i-frames
    if (this.perfectDodgeWindow > 0) {
      this.perfectDodgeWindow -= dt;
    }

    // Trail particles when Hot/Critical and moving
    this.trailTimer -= dt;
    if (tempo.value >= 70 && (this.vx !== 0 || this.vy !== 0) && this.trailTimer <= 0) {
      this.trailTimer = 0.04;
      events.emit('PLAYER_TRAIL', { x: this.x, y: this.y, color: tempo.stateColor() });
    }

    // Room clamp
    if (roomMap) {
      const c = roomMap.clamp(this.x, this.y, this.r);
      this.x = c.x;
      this.y = c.y;
    }
  }

  // Called by projectile system / enemy attack when a near-miss happens during dodge
  checkPerfectDodge() {
    if (this.dodging && this.perfectDodgeWindow > 0 && !this.perfectDodgeTriggered) {
      this.perfectDodgeTriggered = true;
      events.emit('PERFECT_DODGE');
      events.emit('PLAY_SOUND', 'perfect');
      // Slow-mo
      const slowDur = (this.classPassives?.perfectDodgeWindowMult === 2.0) ? 0.8 : 0.4;
      events.emit('SLOW_MO', { dur: slowDur, scale: 0.3 });
      return true;
    }
    return false;
  }

  takeDamage(amount) {
    if (this.dodging) return;
    // Frost passive: 30% damage reduction in Cold
    if (this.classPassives?.coldDamageReduction && this.hp > 0) {
      // This will be checked against tempo value in main.js
    }
    this.hp -= amount;
    this.hitFlash = 0.15;
    events.emit('PLAY_SOUND', 'playerHit');
    events.emit('DAMAGE_TAKEN');
    if (this.hp <= 0) this.alive = false;
  }

  draw(ctx, tempo) {
    if (!this.alive) return;
    
    // Dashing trail
    if (this.dodging) {
      ctx.beginPath();
      ctx.arc(this.x - this.vx * 0.05, this.y - this.vy * 0.05, this.r - 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(51, 170, 255, 0.4)';
      ctx.fill();
    }

    // Drop shadow
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + this.r * 0.6, this.r * 1.3, this.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // Main body
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    const col = this.hitFlash > 0 ? '#ffffff' : (this.dodging ? 'rgba(100,180,255,0.8)' : tempo.stateColor());
    ctx.fillStyle = col;
    ctx.fill();

    // Inner highlight
    ctx.beginPath();
    ctx.arc(this.x - 3, this.y - 3, this.r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();

    // Direction indicator
    if (this.vx || this.vy) {
      const angle = Math.atan2(this.vy, this.vx);
      ctx.beginPath();
      ctx.moveTo(this.x + Math.cos(angle) * (this.r + 4), this.y + Math.sin(angle) * (this.r + 4));
      ctx.lineTo(this.x + Math.cos(angle - 0.5) * (this.r - 2), this.y + Math.sin(angle - 0.5) * (this.r - 2));
      ctx.lineTo(this.x + Math.cos(angle + 0.5) * (this.r - 2), this.y + Math.sin(angle + 0.5) * (this.r - 2));
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
    }

    // Critical state glow
    if (tempo.value >= 90) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,50,50,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    drawHelpers(ctx, this, tempo);
  }
}

function drawHelpers(ctx, player, tempo) {
  // Perfect dodge available indicator (small text)
  if (tempo.value < 90 && !player.dodging && player.dodgeCooldown <= 0) {
    ctx.fillStyle = 'rgba(100,200,255,0.3)';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SPACE', player.x, player.y + player.r + 14);
  }
}
