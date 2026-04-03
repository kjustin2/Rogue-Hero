import { Entity } from './Entity.js';
import { events } from './EventBus.js';

export class Enemy extends Entity {
  constructor(x, y, r, hp, type) {
    super(x, y, r);
    this.hp = hp;
    this.maxHp = hp;
    this.type = type;
    this.state = 'idle';
    this.staggerTimer = 0;
    this.hitFlash = 0;
    this.telegraphTimer = 0;
    this.telegraphDuration = 1.0;
    this.attackCooldown = 0;
    this.marked = false; // Shadow Mark debuff
  }

  stagger(dur) {
    this.staggerTimer = Math.max(this.staggerTimer, dur);
    if (this.state === 'telegraph') this.state = 'chase';
  }

  takeDamage(amount) {
    if (this.marked) { amount = Math.round(amount * 2); this.marked = false; }
    this.hp -= amount;
    this.hitFlash = 0.12;
    if (this.hp <= 0) this.alive = false;
    return amount; // Return actual damage dealt
  }

  drawHealthBar(ctx, color) {
    if (this.hp < this.maxHp) {
      const w = Math.max(32, this.r * 3);
      ctx.fillStyle = '#111';
      ctx.fillRect(this.x - w/2, this.y - this.r - 14, w, 5);
      ctx.fillStyle = color;
      ctx.fillRect(this.x - w/2, this.y - this.r - 14, w * (this.hp / this.maxHp), 5);
    }
  }

  drawBody(ctx, label, color) {
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + this.r * 0.6, this.r * 1.2, this.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : color;
    ctx.fill();

    if (this.marked) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff44ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (this.staggerTimer > 0) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100,180,255,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, this.x, this.y - this.r - 18);

    this.drawHealthBar(ctx, color);
  }

  drawTelegraph(ctx) {}
}

// ── CHASER ──────────────────────────────────────────────────────
export class Chaser extends Enemy {
  constructor(x, y) {
    super(x, y, 14, 25, 'chaser');
    this.telegraphDuration = 0.5;
  }

  updateLogic(dt, player, tempo, roomMap) {
    if (!this.alive) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return; }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const spd = 100 * (0.8 + (tempo.value / 100) * 0.5);

    if (this.state === 'idle' && dist < 400) this.state = 'chase';

    if (this.state === 'chase') {
      if (dist <= 55 && this.attackCooldown <= 0) {
        this.state = 'telegraph';
        this.telegraphTimer = this.telegraphDuration;
      } else if (dist > 40) {
        this.x += (dx / dist) * spd * dt;
        this.y += (dy / dist) * spd * dt;
      }
    }

    if (this.state === 'telegraph') {
      this.telegraphTimer -= dt;
      if (this.telegraphTimer <= 0) {
        if (dist <= 65) events.emit('ENEMY_MELEE_HIT', { damage: 2, source: this });
        this.attackCooldown = 1.2;
        this.state = 'chase';
      }
    }
    if (roomMap) { const c = roomMap.clamp(this.x, this.y, this.r); this.x = c.x; this.y = c.y; }
  }

  drawTelegraph(ctx) {
    if (this.state === 'telegraph') {
      const p = 1 - (this.telegraphTimer / this.telegraphDuration);
      ctx.beginPath();
      ctx.arc(this.x, this.y, 65 * p, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 50, 50, ${0.15 + p * 0.15})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 0, 0, ${0.3 + p * 0.5})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  draw(ctx) {
    if (!this.alive) return;
    this.drawBody(ctx, 'CHASER', '#cc3333');
  }
}

// ── SNIPER ──────────────────────────────────────────────────────
export class Sniper extends Enemy {
  constructor(x, y) {
    super(x, y, 11, 15, 'sniper');
    this.telegraphDuration = 1.2;
    this.attackTargetAngle = 0;
  }

  updateLogic(dt, player, tempo, roomMap) {
    if (!this.alive) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return; }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const spd = 65;

    if (this.state === 'idle' && dist < 600) this.state = 'chase';

    if (this.state === 'chase') {
      if (dist < 150) { this.x -= (dx / dist) * spd * dt; this.y -= (dy / dist) * spd * dt; }
      else if (dist > 350) { this.x += (dx / dist) * spd * dt; this.y += (dy / dist) * spd * dt; }
      else if (this.attackCooldown <= 0) {
        this.state = 'telegraph';
        this.telegraphTimer = this.telegraphDuration;
        this.attackTargetAngle = Math.atan2(dy, dx);
      }
    }

    if (this.state === 'telegraph') {
      this.telegraphTimer -= dt;
      const targetAngle = Math.atan2(player.y - this.y, player.x - this.x);
      this.attackTargetAngle += (targetAngle - this.attackTargetAngle) * 1.5 * dt;
      if (this.telegraphTimer <= 0) {
        const pAngle = Math.atan2(player.y - this.y, player.x - this.x);
        let diff = Math.abs(this.attackTargetAngle - pAngle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < 0.18) events.emit('ENEMY_MELEE_HIT', { damage: 3, source: this });
        this.attackCooldown = 2.5;
        this.state = 'chase';
      }
    }
    if (roomMap) { const c = roomMap.clamp(this.x, this.y, this.r); this.x = c.x; this.y = c.y; }
  }

  drawTelegraph(ctx) {
    if (this.state === 'telegraph') {
      const p = 1 - (this.telegraphTimer / this.telegraphDuration);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(this.attackTargetAngle) * 900, this.y + Math.sin(this.attackTargetAngle) * 900);
      ctx.strokeStyle = `rgba(255, 50, 50, ${p * 0.7})`;
      ctx.lineWidth = 3 + (4 * p);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.x, this.y, 6 + 3 * Math.sin(Date.now() / 80), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 80, 80, ${p})`;
      ctx.fill();
    }
  }

  draw(ctx) {
    if (!this.alive) return;
    this.drawBody(ctx, 'SNIPER', '#88aa33');
  }
}

// ── BRUISER (ELITE) ─────────────────────────────────────────────
export class Bruiser extends Enemy {
  constructor(x, y) {
    super(x, y, 24, 120, 'bruiser');
    this.telegraphDuration = 1.8;
  }

  updateLogic(dt, player, tempo, roomMap) {
    if (!this.alive) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.staggerTimer > 0) { this.staggerTimer -= dt * 0.4; return; }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.state === 'idle' && dist < 500) this.state = 'chase';

    if (this.state === 'chase') {
      if (dist <= 120 && this.attackCooldown <= 0) {
        this.state = 'telegraph';
        this.telegraphTimer = this.telegraphDuration;
      } else {
        this.x += (dx / dist) * 45 * dt;
        this.y += (dy / dist) * 45 * dt;
      }
    }

    if (this.state === 'telegraph') {
      this.telegraphTimer -= dt;
      if (this.telegraphTimer <= 0) {
        if (dist <= 150) events.emit('ENEMY_MELEE_HIT', { damage: 5, source: this });
        this.attackCooldown = 3.0;
        this.state = 'chase';
      }
    }
    if (roomMap) { const c = roomMap.clamp(this.x, this.y, this.r); this.x = c.x; this.y = c.y; }
  }

  drawTelegraph(ctx) {
    if (this.state === 'telegraph') {
      const p = 1 - (this.telegraphTimer / this.telegraphDuration);
      ctx.beginPath();
      ctx.arc(this.x, this.y, 150, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 0, 0, ${p * 0.25})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 0, 0, ${0.4 + Math.sin(Date.now() / 60) * 0.3})`;
      ctx.lineWidth = 3 + p * 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.x, this.y, 150 * p, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  draw(ctx) {
    if (!this.alive) return;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r + 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#660066';
    ctx.lineWidth = 3;
    ctx.stroke();
    this.drawBody(ctx, '★ BRUISER', '#9922aa');
  }
}

// ── TURRET ──────────────────────────────────────────────────────
export class Turret extends Enemy {
  constructor(x, y) {
    super(x, y, 16, 30, 'turret');
    this.telegraphDuration = 2.0;
    this.aimAngle = 0;
    this.shotsFired = 0;
    this.burstCount = 3;
  }

  updateLogic(dt, player, tempo, roomMap) {
    if (!this.alive) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return; }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const targetAngle = Math.atan2(dy, dx);
    this.aimAngle += (targetAngle - this.aimAngle) * 3 * dt;

    if (this.state === 'idle' && dist < 600) this.state = 'chase';

    if (this.state === 'chase' && this.attackCooldown <= 0) {
      this.state = 'telegraph';
      this.telegraphTimer = this.telegraphDuration;
      this.shotsFired = 0;
    }

    if (this.state === 'telegraph') {
      this.telegraphTimer -= dt;
      if (this.telegraphTimer <= 0) {
        const pAngle = Math.atan2(player.y - this.y, player.x - this.x);
        let diff = Math.abs(this.aimAngle - pAngle);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < 0.25 && dist < 500) events.emit('ENEMY_MELEE_HIT', { damage: 2, source: this });
        this.shotsFired++;
        if (this.shotsFired < this.burstCount) {
          this.telegraphTimer = 0.3;
        } else {
          this.attackCooldown = 3.0;
          this.state = 'chase';
        }
      }
    }
    if (roomMap) { const c = roomMap.clamp(this.x, this.y, this.r); this.x = c.x; this.y = c.y; }
  }

  drawTelegraph(ctx) {
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + Math.cos(this.aimAngle) * 500, this.y + Math.sin(this.aimAngle) * 500);
    ctx.strokeStyle = 'rgba(255, 180, 0, 0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (this.state === 'telegraph') {
      const p = 1 - (this.telegraphTimer / (this.shotsFired > 0 ? 0.3 : this.telegraphDuration));
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(this.aimAngle) * 500, this.y + Math.sin(this.aimAngle) * 500);
      ctx.strokeStyle = `rgba(255, 180, 0, ${0.3 + p * 0.5})`;
      ctx.lineWidth = 4 + p * 4;
      ctx.stroke();
    }
  }

  draw(ctx) {
    if (!this.alive) return;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r + 4, 0, Math.PI * 2);
    ctx.fillStyle = '#222';
    ctx.fill();
    ctx.strokeStyle = '#aa8800';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + Math.cos(this.aimAngle) * (this.r + 10), this.y + Math.sin(this.aimAngle) * (this.r + 10));
    ctx.strokeStyle = this.hitFlash > 0 ? '#fff' : '#ddaa22';
    ctx.lineWidth = 5;
    ctx.stroke();
    this.drawBody(ctx, 'TURRET', '#ddaa22');
  }
}

// ── TELEPORTER ──────────────────────────────────────────────────
export class Teleporter extends Enemy {
  constructor(x, y) {
    super(x, y, 13, 20, 'teleporter');
    this.telegraphDuration = 1.0;
    this.aoeTimer = 0;
    this.aoeActive = false;
    this.aoeX = 0;
    this.aoeY = 0;
  }

  updateLogic(dt, player, tempo, roomMap) {
    if (!this.alive) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return; }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.aoeActive) {
      this.aoeTimer -= dt;
      if (this.aoeTimer <= 0) {
        this.aoeActive = false;
        const adx = player.x - this.aoeX, ady = player.y - this.aoeY;
        if (adx * adx + ady * ady < 100 * 100) events.emit('ENEMY_MELEE_HIT', { damage: 3, source: this });
      }
    }

    if (this.state === 'idle' && dist < 500) this.state = 'chase';

    if (this.state === 'chase') {
      if (dist > 60) { this.x += (dx / dist) * 80 * dt; this.y += (dy / dist) * 80 * dt; }
      if (dist <= 130 && this.attackCooldown <= 0) {
        this.state = 'telegraph';
        this.telegraphTimer = this.telegraphDuration;
      }
    }

    if (this.state === 'telegraph') {
      this.telegraphTimer -= dt;
      if (this.telegraphTimer <= 0) {
        this.aoeX = this.x;
        this.aoeY = this.y;
        this.aoeActive = true;
        this.aoeTimer = 0.8;
        const tAngle = Math.random() * Math.PI * 2;
        this.x = player.x + Math.cos(tAngle) * (200 + Math.random() * 150);
        this.y = player.y + Math.sin(tAngle) * (200 + Math.random() * 150);
        this.attackCooldown = 3.5;
        this.state = 'chase';
      }
    }
    if (roomMap) { const c = roomMap.clamp(this.x, this.y, this.r); this.x = c.x; this.y = c.y; }
  }

  drawTelegraph(ctx) {
    if (this.state === 'telegraph') {
      const p = 1 - (this.telegraphTimer / this.telegraphDuration);
      ctx.beginPath();
      ctx.arc(this.x, this.y, 100, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 50, 255, ${p * 0.2})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(180, 50, 255, ${0.3 + p * 0.5})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (this.aoeActive) {
      const p = 1 - (this.aoeTimer / 0.8);
      ctx.beginPath();
      ctx.arc(this.aoeX, this.aoeY, 100, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 50, 255, ${p * 0.35})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.aoeX, this.aoeY, 100 * (1 - p), 0, Math.PI * 2);
      ctx.strokeStyle = '#cc44ff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  draw(ctx) {
    if (!this.alive) return;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r + 6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180, 50, 255, ${0.15 + 0.1 * Math.sin(Date.now() / 200)})`;
    ctx.fill();
    this.drawBody(ctx, 'BLINK', '#bb44ff');
  }
}

// ── SWARM (tiny, fast, spawns in packs) ─────────────────────────
export class Swarm extends Enemy {
  constructor(x, y) {
    super(x, y, 8, 8, 'swarm');
    this.telegraphDuration = 0.3;
  }

  updateLogic(dt, player, tempo, roomMap) {
    if (!this.alive) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return; }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const spd = 160; // Very fast

    if (this.state === 'idle' && dist < 500) this.state = 'chase';

    if (this.state === 'chase') {
      if (dist <= 35 && this.attackCooldown <= 0) {
        this.state = 'telegraph';
        this.telegraphTimer = this.telegraphDuration;
      } else if (dist > 25) {
        // Jittery movement
        this.x += (dx / dist) * spd * dt + (Math.random() - 0.5) * 40 * dt;
        this.y += (dy / dist) * spd * dt + (Math.random() - 0.5) * 40 * dt;
      }
    }

    if (this.state === 'telegraph') {
      this.telegraphTimer -= dt;
      if (this.telegraphTimer <= 0) {
        if (dist <= 40) events.emit('ENEMY_MELEE_HIT', { damage: 1, source: this });
        this.attackCooldown = 0.6;
        this.state = 'chase';
      }
    }
    if (roomMap) { const c = roomMap.clamp(this.x, this.y, this.r); this.x = c.x; this.y = c.y; }
  }

  drawTelegraph(ctx) {
    if (this.state === 'telegraph') {
      ctx.beginPath();
      ctx.arc(this.x, this.y, 35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 100, 0, 0.25)';
      ctx.fill();
    }
  }

  draw(ctx) {
    if (!this.alive) return;
    this.drawBody(ctx, '', '#ff8800');
  }
}

// ── HEALER (heals nearby allies periodically) ───────────────────
export class Healer extends Enemy {
  constructor(x, y) {
    super(x, y, 14, 20, 'healer');
    this.healTimer = 0;
    this.healInterval = 3.0;
    this.healRange = 200;
    this.healAmount = 5;
    this.healFlash = 0;
  }

  updateLogic(dt, player, tempo, roomMap, allEnemies) {
    if (!this.alive) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.healFlash = Math.max(0, this.healFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return; }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.state === 'idle' && dist < 500) this.state = 'chase';

    // Healer runs away from player
    if (this.state === 'chase') {
      if (dist < 200) {
        this.x -= (dx / dist) * 75 * dt;
        this.y -= (dy / dist) * 75 * dt;
      } else if (dist > 400) {
        this.x += (dx / dist) * 50 * dt;
        this.y += (dy / dist) * 50 * dt;
      }
    }

    // Periodic heal pulse
    this.healTimer += dt;
    if (this.healTimer >= this.healInterval && allEnemies) {
      this.healTimer = 0;
      this.healFlash = 0.3;
      for (const e of allEnemies) {
        if (e === this || !e.alive) continue;
        const edx = e.x - this.x, edy = e.y - this.y;
        if (edx * edx + edy * edy < this.healRange * this.healRange) {
          e.hp = Math.min(e.maxHp, e.hp + this.healAmount);
        }
      }
    }

    if (roomMap) { const c = roomMap.clamp(this.x, this.y, this.r); this.x = c.x; this.y = c.y; }
  }

  drawTelegraph(ctx) {
    // Healing aura
    if (this.healFlash > 0) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.healRange, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(50, 255, 100, ${this.healFlash * 0.3})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(50, 255, 100, ${this.healFlash})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Subtle constant aura
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.healRange, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(50, 255, 100, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  draw(ctx) {
    if (!this.alive) return;
    // Cross symbol
    ctx.fillStyle = '#44ff88';
    ctx.fillRect(this.x - 2, this.y - 7, 4, 14);
    ctx.fillRect(this.x - 7, this.y - 2, 14, 4);
    this.drawBody(ctx, 'HEALER', '#22cc66');
  }
}

// ── MIRROR (copies player's last card type) ─────────────────────
export class Mirror extends Enemy {
  constructor(x, y) {
    super(x, y, 15, 35, 'mirror');
    this.telegraphDuration = 1.0;
    this.mirrorAngle = 0;
  }

  updateLogic(dt, player, tempo, roomMap) {
    if (!this.alive) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return; }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.state === 'idle' && dist < 500) this.state = 'chase';

    if (this.state === 'chase') {
      // Maintains medium distance
      if (dist < 100) { this.x -= (dx / dist) * 90 * dt; this.y -= (dy / dist) * 90 * dt; }
      else if (dist > 200) { this.x += (dx / dist) * 70 * dt; this.y += (dy / dist) * 70 * dt; }
      else if (this.attackCooldown <= 0) {
        this.state = 'telegraph';
        this.telegraphTimer = this.telegraphDuration;
        this.mirrorAngle = Math.atan2(dy, dx);
      }
    }

    if (this.state === 'telegraph') {
      this.telegraphTimer -= dt;
      this.mirrorAngle = Math.atan2(player.y - this.y, player.x - this.x);
      if (this.telegraphTimer <= 0) {
        // Mirror attack: radial burst similar to player's projectile
        if (dist <= 160) events.emit('ENEMY_MELEE_HIT', { damage: 3, source: this });
        this.attackCooldown = 2.0;
        this.state = 'chase';
      }
    }
    if (roomMap) { const c = roomMap.clamp(this.x, this.y, this.r); this.x = c.x; this.y = c.y; }
  }

  drawTelegraph(ctx) {
    if (this.state === 'telegraph') {
      const p = 1 - (this.telegraphTimer / this.telegraphDuration);
      // Mirror ripple effect
      ctx.beginPath();
      ctx.arc(this.x, this.y, 160 * p, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(100, 200, 255, ${0.2 + p * 0.4})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.x, this.y, 80 * p, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(100, 200, 255, ${p * 0.3})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  draw(ctx) {
    if (!this.alive) return;
    // Reflective shimmer
    const shimmer = Math.sin(Date.now() / 200) * 0.3 + 0.7;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r + 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(100, 200, 255, ${0.1 * shimmer})`;
    ctx.fill();
    this.drawBody(ctx, 'MIRROR', `rgb(100, ${Math.round(180 + shimmer * 40)}, 255)`);
  }
}
