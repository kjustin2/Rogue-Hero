import { Entity } from './Entity.js';
import { events } from './EventBus.js';

export class Player extends Entity {
  constructor(x, y) {
    super(x, y, 16);
    this.hp = 6;
    this.maxHp = 6;
    
    this.ACCEL = 2000;
    this.FRICTION = 1800;
    this.BASE_SPEED = 280;

    this.dodging = false;
    this.dodgeTimer = 0;
    this.dodgeDirX = 0;
    this.dodgeDirY = 0;
    this.DODGE_SPEED = 520;
    this.DODGE_DUR = 0.18;
    this.dodgeCooldown = 0;
    this.DODGE_CD = 0.55;

    this.comboCount = 0;
    this.comboTimer = 0;
    this.COMBO_WINDOW = 0.65;
    this.attackCooldown = 0;
    this.ATTACK_CD = 0.22;

    this.budget = 10;
    this.maxBudget = 10;
    this.budgetRegenRate = 0.7; // per second
  }

  updateLogic(dt, input, tempo, roomMap) {
    if (!this.alive) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    
    this.budget = Math.min(this.maxBudget, this.budget + this.budgetRegenRate * dt);
    
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    // Dodge
    if (!this.dodging && input.isDown(' ') && this.dodgeCooldown <= 0 && tempo.value < 90) {
      let dx = 0, dy = 0;
      if (input.isDown('a') || input.isDown('arrowleft')) dx -= 1;
      if (input.isDown('d') || input.isDown('arrowright')) dx += 1;
      if (input.isDown('w') || input.isDown('arrowup')) dy -= 1;
      if (input.isDown('s') || input.isDown('arrowdown')) dy += 1;
      
      if (dx === 0 && dy === 0) {
        dx = input.mouse.x - this.x; dy = input.mouse.y - this.y;
      }
      
      const len = Math.sqrt(dx*dx + dy*dy);
      if (len > 0.1) {
        this.dodgeDirX = dx / len; this.dodgeDirY = dy / len;
        this.dodging = true;
        this.dodgeTimer = this.DODGE_DUR;
        this.dodgeCooldown = this.DODGE_CD;
        events.emit('DODGE');
        events.emit('PLAY_SOUND', 'dodge');
        
        // Perfect dodge logic would be triggered via Combat collision, 
        // but base dodge execution doesn't need to know unless intercepted
      }
    }

    const speed = this.BASE_SPEED * tempo.speedMultiplier();

    if (this.dodging) {
      this.dodgeTimer -= dt;
      this.x += this.dodgeDirX * this.DODGE_SPEED * dt;
      this.y += this.dodgeDirY * this.DODGE_SPEED * dt;
      
      if (this.dodgeTimer <= 0) {
        this.dodging = false;
        this.vx = this.dodgeDirX * speed * 0.4;
        this.vy = this.dodgeDirY * speed * 0.4;
      }
    } else {
      let ix = 0, iy = 0;
      if (input.isDown('a') || input.isDown('arrowleft')) ix -= 1;
      if (input.isDown('d') || input.isDown('arrowright')) ix += 1;
      if (input.isDown('w') || input.isDown('arrowup')) iy -= 1;
      if (input.isDown('s') || input.isDown('arrowdown')) iy += 1;

      if (ix !== 0 || iy !== 0) {
        const il = Math.sqrt(ix * ix + iy * iy);
        ix /= il; iy /= il;
        this.vx += ix * this.ACCEL * dt; this.vy += iy * this.ACCEL * dt;
        const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (spd > speed) { this.vx = (this.vx / spd) * speed; this.vy = (this.vy / spd) * speed; }
      } else {
        const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const friction = Math.min(spd, this.FRICTION * dt);
        if (spd > 0) { this.vx -= (this.vx / spd) * friction; this.vy -= (this.vy / spd) * friction; }
      }
      this.update(dt); // calls Entity.update (applies vx/vy)
    }

    // Room boundaries clamping
    if (roomMap) {
      const clamped = roomMap.clamp(this.x, this.y, this.r);
      this.x = clamped.x; this.y = clamped.y;
    }
  }

  takeDamage(amt) {
    console.log(`[Player] Takes ${amt} damage!`);
    this.hp -= amt;
    this.hitFlash = 0.15;
    if (this.hp <= 0) {
      console.log('[Player] Health reached 0!');
      this.alive = false;
    }
  }

  heal(amt) {
    this.hp = Math.min(this.maxHp, this.hp + amt);
    console.log(`[Player] Healed for ${amt}, current HP: ${this.hp}/${this.maxHp}`);
  }

  drawHelpers(ctx, tempo) {
    // Basic drop shadow / circle
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#33aaff';
    ctx.fill();

    // Dashing trail
    if (this.state === 'dash') {
      ctx.beginPath();
      ctx.arc(this.x - this.vx * 0.05, this.y - this.vy * 0.05, this.r - 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(51, 170, 255, 0.4)';
      ctx.fill();
    }
  }

  draw(ctx, tempo) {
    if (!this.alive) return;
    this.drawHelpers(ctx, tempo);
  }
}
