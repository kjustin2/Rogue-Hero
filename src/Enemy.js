import { Entity } from './Entity.js';
import { events } from './EventBus.js';

// ── BASE ENEMY ──────────────────────────────────────────────────
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
    this.marked = false;
    this.difficultySpdMult = 1.0;
    // Spawn animation
    this.spawnTimer = 0.35;
    this.spawning = true;
  }

  spdMult() { return this.difficultySpdMult; }

  stagger(dur) {
    this.staggerTimer = Math.max(this.staggerTimer, dur);
    if (this.state === 'telegraph') this.state = 'chase';
  }

  takeDamage(amount) {
    if (this.marked) { amount = Math.round(amount * 2); this.marked = false; }
    this.hp -= amount;
    this.hitFlash = 0.12;
    if (this.hp <= 0) this.alive = false;
    return amount;
  }

  updateSpawn(dt) {
    if (!this.spawning) return false;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) { this.spawning = false; }
    return true; // Still spawning — skip AI
  }

  drawHealthBar(ctx, color) {
    if (this.hp < this.maxHp) {
      const w = Math.max(32, this.r * 3);
      ctx.fillStyle = '#111';
      ctx.fillRect(this.x - w / 2, this.y - this.r - 14, w, 5);
      ctx.fillStyle = color;
      ctx.fillRect(this.x - w / 2, this.y - this.r - 14, w * (this.hp / this.maxHp), 5);
    }
  }

  drawBody(ctx, label, color, now) {
    // Drop shadow
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + this.r * 0.6, this.r * 1.2, this.r * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fill();

    // Spawn animation: scale up
    let scale = 1;
    if (this.spawning) {
      scale = 1 - (this.spawnTimer / 0.35);
      scale = scale * scale; // ease-in
    }

    const drawR = this.r * scale;
    ctx.beginPath();
    ctx.arc(this.x, this.y, drawR, 0, Math.PI * 2);
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : color;
    ctx.fill();

    // Spawn flash ring
    if (this.spawning) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, drawR + 15 * (1 - scale), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - scale)})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    if (this.marked) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, drawR + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff44ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (this.staggerTimer > 0) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, drawR + 5, 0, Math.PI * 2);
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

  drawTelegraph(ctx, now) {}
}

// ── CHASER ──────────────────────────────────────────────────────
export class Chaser extends Enemy {
  constructor(x, y) {
    super(x, y, 14, 25, 'chaser');
    this.telegraphDuration = 0.5;
  }

  updateLogic(dt, player, tempo, roomMap) {
    if (!this.alive) return;
    if (this.updateSpawn(dt)) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return; }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const spd = 100 * (0.8 + (tempo.value / 100) * 0.5) * this.spdMult();

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

  drawTelegraph(ctx, now) {
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

  draw(ctx, now) {
    if (!this.alive) return;
    this.drawBody(ctx, 'CHASER', '#cc3333', now);
  }
}

// ── SNIPER ──────────────────────────────────────────────────────
export class Sniper extends Enemy {
  constructor(x, y) {
    super(x, y, 11, 15, 'sniper');
    this.telegraphDuration = 1.2;
    this.attackTargetAngle = 0;
    this.projectileManager = null;
  }

  updateLogic(dt, player, tempo, roomMap, allEnemies, projMgr) {
    this.projectileManager = projMgr;
    if (!this.alive) return;
    if (this.updateSpawn(dt)) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return; }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const spd = 65 * this.spdMult();

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
        // Fire real projectile instead of hitscan
        if (this.projectileManager) {
          this.projectileManager.spawn(
            this.x, this.y,
            Math.cos(this.attackTargetAngle), Math.sin(this.attackTargetAngle),
            320, 3, '#88cc33', 'sniper'
          );
        }
        this.attackCooldown = 2.5;
        this.state = 'chase';
      }
    }
    if (roomMap) { const c = roomMap.clamp(this.x, this.y, this.r); this.x = c.x; this.y = c.y; }
  }

  drawTelegraph(ctx, now) {
    if (this.state === 'telegraph') {
      const p = 1 - (this.telegraphTimer / this.telegraphDuration);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(this.attackTargetAngle) * 900, this.y + Math.sin(this.attackTargetAngle) * 900);
      ctx.strokeStyle = `rgba(255, 50, 50, ${p * 0.7})`;
      ctx.lineWidth = 3 + (4 * p);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.x, this.y, 6 + 3 * Math.sin(now / 80), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 80, 80, ${p})`;
      ctx.fill();
    }
  }

  draw(ctx, now) {
    if (!this.alive) return;
    this.drawBody(ctx, 'SNIPER', '#88aa33', now);
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
    if (this.updateSpawn(dt)) return;
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
        this.x += (dx / dist) * 45 * this.spdMult() * dt;
        this.y += (dy / dist) * 45 * this.spdMult() * dt;
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

  drawTelegraph(ctx, now) {
    if (this.state === 'telegraph') {
      const p = 1 - (this.telegraphTimer / this.telegraphDuration);
      ctx.beginPath();
      ctx.arc(this.x, this.y, 150, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 0, 0, ${p * 0.25})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 0, 0, ${0.4 + Math.sin(now / 60) * 0.3})`;
      ctx.lineWidth = 3 + p * 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.x, this.y, 150 * p, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  draw(ctx, now) {
    if (!this.alive) return;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r + 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#660066';
    ctx.lineWidth = 3;
    ctx.stroke();
    this.drawBody(ctx, '★ BRUISER', '#9922aa', now);
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
    this.projectileManager = null;
  }

  updateLogic(dt, player, tempo, roomMap, allEnemies, projMgr) {
    this.projectileManager = projMgr;
    if (!this.alive) return;
    if (this.updateSpawn(dt)) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return; }

    const dx = player.x - this.x, dy = player.y - this.y;
    const targetAngle = Math.atan2(dy, dx);
    this.aimAngle += (targetAngle - this.aimAngle) * 3 * dt;

    if (this.state === 'idle' && Math.sqrt(dx*dx+dy*dy) < 600) this.state = 'chase';

    if (this.state === 'chase' && this.attackCooldown <= 0) {
      this.state = 'telegraph';
      this.telegraphTimer = this.telegraphDuration;
      this.shotsFired = 0;
    }

    if (this.state === 'telegraph') {
      this.telegraphTimer -= dt;
      if (this.telegraphTimer <= 0) {
        // Fire real projectile
        if (this.projectileManager) {
          this.projectileManager.spawn(
            this.x, this.y,
            Math.cos(this.aimAngle), Math.sin(this.aimAngle),
            280, 2, '#ffaa00', 'turret'
          );
        }
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

  drawTelegraph(ctx, now) {
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

  draw(ctx, now) {
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
    this.drawBody(ctx, 'TURRET', '#ddaa22', now);
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
    if (this.updateSpawn(dt)) return;
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
      if (dist > 60) {
        this.x += (dx / dist) * 80 * this.spdMult() * dt;
        this.y += (dy / dist) * 80 * this.spdMult() * dt;
      }
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

  drawTelegraph(ctx, now) {
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

  draw(ctx, now) {
    if (!this.alive) return;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r + 6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180, 50, 255, ${0.15 + 0.1 * Math.sin(now / 200)})`;
    ctx.fill();
    this.drawBody(ctx, 'BLINK', '#bb44ff', now);
  }
}

// ── SWARM ───────────────────────────────────────────────────────
export class Swarm extends Enemy {
  constructor(x, y) {
    super(x, y, 8, 8, 'swarm');
    this.telegraphDuration = 0.3;
  }

  updateLogic(dt, player, tempo, roomMap) {
    if (!this.alive) return;
    if (this.updateSpawn(dt)) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return; }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const spd = 160 * this.spdMult();

    if (this.state === 'idle' && dist < 500) this.state = 'chase';

    if (this.state === 'chase') {
      if (dist <= 35 && this.attackCooldown <= 0) {
        this.state = 'telegraph';
        this.telegraphTimer = this.telegraphDuration;
      } else if (dist > 25) {
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

  drawTelegraph(ctx, now) {
    if (this.state === 'telegraph') {
      ctx.beginPath();
      ctx.arc(this.x, this.y, 35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 100, 0, 0.25)';
      ctx.fill();
    }
  }

  draw(ctx, now) {
    if (!this.alive) return;
    this.drawBody(ctx, '', '#ff8800', now);
  }
}

// ── HEALER ──────────────────────────────────────────────────────
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
    if (this.updateSpawn(dt)) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.healFlash = Math.max(0, this.healFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return; }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.state === 'idle' && dist < 500) this.state = 'chase';

    if (this.state === 'chase') {
      if (dist < 200) {
        this.x -= (dx / dist) * 75 * this.spdMult() * dt;
        this.y -= (dy / dist) * 75 * this.spdMult() * dt;
      } else if (dist > 400) {
        this.x += (dx / dist) * 50 * this.spdMult() * dt;
        this.y += (dy / dist) * 50 * this.spdMult() * dt;
      }
    }

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

  drawTelegraph(ctx, now) {
    if (this.healFlash > 0) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.healRange, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(50, 255, 100, ${this.healFlash * 0.3})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(50, 255, 100, ${this.healFlash})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.healRange, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(50, 255, 100, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  draw(ctx, now) {
    if (!this.alive) return;
    ctx.fillStyle = '#44ff88';
    ctx.fillRect(this.x - 2, this.y - 7, 4, 14);
    ctx.fillRect(this.x - 7, this.y - 2, 14, 4);
    this.drawBody(ctx, 'HEALER', '#22cc66', now);
  }
}

// ── MIRROR ──────────────────────────────────────────────────────
export class Mirror extends Enemy {
  constructor(x, y) {
    super(x, y, 15, 35, 'mirror');
    this.telegraphDuration = 1.0;
    this.mirrorAngle = 0;
  }

  updateLogic(dt, player, tempo, roomMap) {
    if (!this.alive) return;
    if (this.updateSpawn(dt)) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return; }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this.state === 'idle' && dist < 500) this.state = 'chase';

    if (this.state === 'chase') {
      if (dist < 100) {
        this.x -= (dx / dist) * 90 * this.spdMult() * dt;
        this.y -= (dy / dist) * 90 * this.spdMult() * dt;
      } else if (dist > 200) {
        this.x += (dx / dist) * 70 * this.spdMult() * dt;
        this.y += (dy / dist) * 70 * this.spdMult() * dt;
      } else if (this.attackCooldown <= 0) {
        this.state = 'telegraph';
        this.telegraphTimer = this.telegraphDuration;
        this.mirrorAngle = Math.atan2(dy, dx);
      }
    }

    if (this.state === 'telegraph') {
      this.telegraphTimer -= dt;
      this.mirrorAngle = Math.atan2(player.y - this.y, player.x - this.x);
      if (this.telegraphTimer <= 0) {
        if (dist <= 160) events.emit('ENEMY_MELEE_HIT', { damage: 3, source: this });
        this.attackCooldown = 2.0;
        this.state = 'chase';
      }
    }
    if (roomMap) { const c = roomMap.clamp(this.x, this.y, this.r); this.x = c.x; this.y = c.y; }
  }

  drawTelegraph(ctx, now) {
    if (this.state === 'telegraph') {
      const p = 1 - (this.telegraphTimer / this.telegraphDuration);
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

  draw(ctx, now) {
    if (!this.alive) return;
    const shimmer = Math.sin(now / 200) * 0.3 + 0.7;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r + 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(100, 200, 255, ${0.1 * shimmer})`;
    ctx.fill();
    this.drawBody(ctx, 'MIRROR', `rgb(100, ${Math.round(180 + shimmer * 40)}, 255)`, now);
  }
}

// ── TEMPO VAMPIRE ───────────────────────────────────────────────
export class TempoVampire extends Enemy {
  constructor(x, y) {
    super(x, y, 13, 22, 'tempovampire');
    this.telegraphDuration = 0.4;
    this.drainFlash = 0;
  }

  updateLogic(dt, player, tempo, roomMap) {
    if (!this.alive) return;
    if (this.updateSpawn(dt)) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.drainFlash = Math.max(0, this.drainFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return; }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const spd = 105 * (0.7 + (tempo.value / 100) * 0.8) * this.spdMult();

    if (this.state === 'idle' && dist < 350) this.state = 'chase';

    if (this.state === 'chase') {
      if (dist <= 50 && this.attackCooldown <= 0) {
        this.state = 'telegraph';
        this.telegraphTimer = this.telegraphDuration;
      } else if (dist > 35) {
        this.x += (dx / dist) * spd * dt;
        this.y += (dy / dist) * spd * dt;
      }
    }

    if (this.state === 'telegraph') {
      this.telegraphTimer -= dt;
      if (this.telegraphTimer <= 0) {
        if (dist <= 60) {
          events.emit('ENEMY_MELEE_HIT', { damage: 1, source: this });
          events.emit('DRAIN');
          this.drainFlash = 0.3;
        }
        this.attackCooldown = 1.2;
        this.state = 'chase';
      }
    }
    if (roomMap) { const c = roomMap.clamp(this.x, this.y, this.r); this.x = c.x; this.y = c.y; }
  }

  drawTelegraph(ctx, now) {
    if (this.state === 'telegraph') {
      const p = 1 - (this.telegraphTimer / this.telegraphDuration);
      ctx.beginPath();
      ctx.arc(this.x, this.y, 60, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 50, 180, ${p * 0.25})`;
      ctx.fill();
    }
    if (this.drainFlash > 0) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, 50 * (1 - this.drainFlash / 0.3), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(200, 50, 180, ${this.drainFlash})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  draw(ctx, now) {
    if (!this.alive) return;
    this.drawBody(ctx, 'VAMPIRE', '#cc44aa', now);
  }
}

// ── SHIELD DRONE ────────────────────────────────────────────────
export class ShieldDrone extends Enemy {
  constructor(x, y) {
    super(x, y, 14, 28, 'shielddrone');
    this._angle = Math.random() * Math.PI * 2;
    this._wasShielded = true;
  }

  _isShielded(tempo) { return tempo.value < 70; }

  updateLogic(dt, player, tempo, roomMap) {
    if (!this.alive) return;
    if (this.updateSpawn(dt)) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this._angle += dt * 2.5;
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return; }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const spd = 70 * (0.7 + (tempo.value / 100) * 0.8) * this.spdMult();

    if (dist > 70) {
      this.x += (dx / dist) * spd * dt;
      this.y += (dy / dist) * spd * dt;
    }

    if (dist < this.r + player.r + 2 && this.attackCooldown <= 0) {
      this.attackCooldown = 1.4;
      events.emit('ENEMY_MELEE_HIT', { damage: 1, source: this });
    }

    this._wasShielded = this._isShielded(tempo);
    if (roomMap) { const c = roomMap.clamp(this.x, this.y, this.r); this.x = c.x; this.y = c.y; }
  }

  // Override takeDamage - immune when shielded
  takeDamage(amount, tempo) {
    if (tempo && this._isShielded(tempo)) {
      this.hitFlash = 0.07;
      return 0;
    }
    return super.takeDamage(amount);
  }

  draw(ctx, now) {
    if (!this.alive) return;
    const shielded = this._wasShielded;

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#8844ff';
    ctx.fill();

    if (shielded) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this._angle);
      ctx.beginPath();
      ctx.arc(0, 0, this.r + 8, 0, Math.PI * 1.4);
      ctx.strokeStyle = '#bb88ff';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.rotate(Math.PI);
      ctx.beginPath();
      ctx.arc(0, 0, this.r + 8, 0, Math.PI * 1.4);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = shielded ? '#cc99ff' : '#9966cc';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(shielded ? 'DRONE 🔒' : 'DRONE', this.x, this.y - this.r - 18);
    this.drawHealthBar(ctx, shielded ? '#8844ff' : '#aa66ff');
  }
}

// ── BRAWLER BOSS (Floor 1) ──────────────────────────────────────
export class BossBrawler extends Enemy {
  constructor(x, y) {
    super(x, y, 30, 80, 'boss_brawler');
    this.dashTimer = 4.5;
    this.dashActive = false;
    this.dashDirX = 0;
    this.dashDirY = 0;
    this.dashDur = 0;
    this.hasSplit = false;
    this.spawnTimer = 0.6;
  }

  updateLogic(dt, player, tempo, roomMap, allEnemies) {
    if (!this.alive) return;
    if (this.updateSpawn(dt)) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return; }

    if (!this.hasSplit && this.hp <= this.maxHp * 0.5) {
      this.hasSplit = true;
      this.alive = false;
      if (allEnemies) {
        allEnemies.push(new Chaser(this.x - 35, this.y));
        allEnemies.push(new Chaser(this.x + 35, this.y));
      }
      events.emit('SCREEN_SHAKE', { duration: 0.4, intensity: 0.7 });
      events.emit('PLAY_SOUND', 'crash');
      return;
    }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    this.dashTimer -= dt;
    if (this.dashTimer <= 0 && !this.dashActive) {
      this.dashTimer = 4.5;
      if (dist > 1) {
        this.dashDirX = dx / dist;
        this.dashDirY = dy / dist;
        this.dashActive = true;
        this.dashDur = 0.3;
      }
    }

    if (this.dashActive) {
      this.dashDur -= dt;
      this.x += this.dashDirX * 600 * dt;
      this.y += this.dashDirY * 600 * dt;
      if (this.dashDur <= 0) this.dashActive = false;
      if (dist < this.r + player.r + 4 && this.attackCooldown <= 0) {
        this.attackCooldown = 0.5;
        events.emit('ENEMY_MELEE_HIT', { damage: 2, source: this });
      }
    } else {
      const spd = 135 * (0.7 + (tempo.value / 100) * 0.8) * this.spdMult();
      if (dist > this.r + player.r) {
        this.x += (dx / dist) * spd * dt;
        this.y += (dy / dist) * spd * dt;
      } else if (this.attackCooldown <= 0) {
        this.attackCooldown = 0.9;
        events.emit('ENEMY_MELEE_HIT', { damage: 1, source: this });
      }
    }
    if (roomMap) { const c = roomMap.clamp(this.x, this.y, this.r); this.x = c.x; this.y = c.y; }
  }

  drawTelegraph(ctx, now) {
    if (this.dashActive) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r + 10, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,80,0,0.6)';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
  }

  draw(ctx, now) {
    if (!this.alive) return;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r + 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,80,0,0.45)';
    ctx.lineWidth = 3;
    ctx.stroke();
    this.drawBody(ctx, '★ BRAWLER', '#cc2200', now);
  }
}

// ── CONDUCTOR BOSS (Floor 2) ────────────────────────────────────
export class BossConductor extends Enemy {
  constructor(x, y) {
    super(x, y, 28, 120, 'boss_conductor');
    this.fireTimer = 3.0;
    this.droneTimer = 20.0;
    this.phase = 1;
    this._angle = 0;
    this.projectileManager = null;
    this.spawnTimer = 0.6;
  }

  _isImmune(allEnemies) {
    if (!allEnemies) return false;
    return allEnemies.some(e => e !== this && e.alive && e.type === 'shielddrone');
  }

  updateLogic(dt, player, tempo, roomMap, allEnemies, projMgr) {
    this.projectileManager = projMgr;
    if (!this.alive) return;
    if (this.updateSpawn(dt)) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this._angle += dt * 1.5;
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return; }

    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2;
      events.emit('SCREEN_SHAKE', { duration: 0.3, intensity: 0.5 });
      events.emit('PLAY_SOUND', 'crash');
    }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const spd = 50 * (0.7 + (tempo.value / 100) * 0.5) * this.spdMult();

    if (dist < 180) {
      this.x -= (dx / dist) * spd * dt;
      this.y -= (dy / dist) * spd * dt;
    } else if (dist > 280) {
      this.x += (dx / dist) * spd * 0.5 * dt;
      this.y += (dy / dist) * spd * 0.5 * dt;
    }

    const baseRate = this.phase === 2 ? 1.8 : 2.8;
    const fireRate = Math.max(0.45, baseRate * (1.5 - (tempo.value / 100) * 0.6));
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = fireRate;
      if (this.projectileManager) {
        const shots = this.phase === 2 ? 5 : 3;
        this.projectileManager.spawnSpread(this.x, this.y, player.x, player.y, shots, 0.45, 240, 2, '#aa44ff', 'conductor');
      }
    }

    const droneRate = this.phase === 2 ? 12.0 : 20.0;
    this.droneTimer -= dt;
    if (this.droneTimer <= 0 && allEnemies) {
      this.droneTimer = droneRate;
      const drones = allEnemies.filter(e => e.alive && e.type === 'shielddrone');
      if (drones.length < 2) {
        const angle = Math.random() * Math.PI * 2;
        const sx = this.x + Math.cos(angle) * 90;
        const sy = this.y + Math.sin(angle) * 90;
        if (roomMap) {
          const c = roomMap.clamp(sx, sy, 14);
          allEnemies.push(new ShieldDrone(c.x, c.y));
        } else {
          allEnemies.push(new ShieldDrone(sx, sy));
        }
      }
    }

    if (roomMap) { const c = roomMap.clamp(this.x, this.y, this.r); this.x = c.x; this.y = c.y; }
  }

  takeDamage(amount, tempo, allEnemies) {
    if (this._isImmune(allEnemies)) { this.hitFlash = 0.05; return 0; }
    return super.takeDamage(amount);
  }

  draw(ctx, now) {
    if (!this.alive) return;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#9944cc';
    ctx.fill();
    ctx.fillStyle = '#cc66ff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('★ CONDUCTOR', this.x, this.y - this.r - 18);
    this.drawHealthBar(ctx, '#aa44ff');
  }
}

// ── ECHO BOSS (Floor 3 — Final) ────────────────────────────────
export class BossEcho extends Enemy {
  constructor(x, y) {
    super(x, y, 38, 200, 'boss_echo');
    this.fireTimer = 2.2;
    this.phase = 1;
    this.bossTempoVal = 0;
    this.spawnEnemyTimer = 15.0;
    this._angle = 0;
    this.projectileManager = null;
    this.spawnTimer = 0.8;
  }

  updateLogic(dt, player, tempo, roomMap, allEnemies, projMgr) {
    this.projectileManager = projMgr;
    if (!this.alive) return;
    if (this.updateSpawn(dt)) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this._angle += dt;
    if (this.staggerTimer > 0) { this.staggerTimer -= dt; return; }

    if (this.phase === 1 && this.hp <= this.maxHp * 0.66) {
      this.phase = 2;
      events.emit('SCREEN_SHAKE', { duration: 0.3, intensity: 0.5 });
    }
    if (this.phase === 2 && this.hp <= this.maxHp * 0.33) {
      this.phase = 3;
      events.emit('SCREEN_SHAKE', { duration: 0.4, intensity: 0.7 });
    }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const spd = (this.phase >= 2 ? 110 : 75) * (0.7 + (tempo.value / 100) * 0.8) * this.spdMult();

    if (dist > this.r + player.r + 8) {
      this.x += (dx / dist) * spd * dt;
      this.y += (dy / dist) * spd * dt;
    } else if (this.attackCooldown <= 0) {
      this.attackCooldown = 1.0;
      events.emit('ENEMY_MELEE_HIT', { damage: 1, source: this });
    }

    const fireRate = this.phase >= 3 ? 1.1 : (this.phase === 2 ? 1.5 : 2.0);
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = fireRate;
      if (this.projectileManager) {
        const shots = this.phase >= 3 ? 4 : (this.phase === 2 ? 3 : 2);
        this.projectileManager.spawnSpread(this.x, this.y, player.x, player.y, shots, 0.32, 240, 1, '#cc44cc', 'echo');
      }
    }

    // Boss Tempo bar (phase 2+)
    if (this.phase >= 2) {
      const riseRate = this.phase >= 3 ? 35 : 20;
      this.bossTempoVal += riseRate * dt;
      if (this.bossTempoVal >= 100) {
        this.bossTempoVal = 45;
        const cr = 90;
        const pdx = player.x - this.x, pdy = player.y - this.y;
        if (pdx * pdx + pdy * pdy < (cr + player.r) * (cr + player.r)) {
          events.emit('ENEMY_MELEE_HIT', { damage: 1, source: this });
        }
        events.emit('SCREEN_SHAKE', { duration: 0.2, intensity: 0.4 });
        events.emit('PLAY_SOUND', 'crash');
      }
    }

    // Phase 3: spawn enemies
    if (this.phase >= 3 && allEnemies) {
      this.spawnEnemyTimer -= dt;
      if (this.spawnEnemyTimer <= 0) {
        this.spawnEnemyTimer = 14.0;
        const classes = [Chaser, TempoVampire, Swarm];
        const T = classes[Math.floor(Math.random() * classes.length)];
        const sx = roomMap ? roomMap.FLOOR_X1 + 100 + Math.random() * (roomMap.FLOOR_X2 - roomMap.FLOOR_X1 - 200) : this.x + 100;
        const sy = roomMap ? roomMap.FLOOR_Y1 + 80 + Math.random() * (roomMap.FLOOR_Y2 - roomMap.FLOOR_Y1 - 160) : this.y + 100;
        allEnemies.push(new T(sx, sy));
      }
    }

    if (roomMap) { const c = roomMap.clamp(this.x, this.y, this.r); this.x = c.x; this.y = c.y; }
  }

  draw(ctx, now) {
    if (!this.alive) return;
    const pr = this.r + 7 + Math.sin(this._angle * 3) * 4;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0, pr), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(180,80,220,0.38)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fillStyle = this.hitFlash > 0 ? '#ffffff' : '#7722aa';
    ctx.fill();

    if (this.phase >= 2) {
      const bw = 64, bh = 6;
      const bx = this.x - bw / 2, by = this.y - this.r - 22;
      ctx.fillStyle = '#222';
      ctx.fillRect(bx, by, bw, bh);
      const bCol = this.bossTempoVal >= 90 ? '#ff3333' : (this.bossTempoVal >= 70 ? '#ff8800' : '#aa44cc');
      ctx.fillStyle = bCol;
      ctx.fillRect(bx, by, bw * (this.bossTempoVal / 100), bh);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BOSS TEMPO', this.x, by - 1);
    }

    ctx.fillStyle = '#cc66ff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('★ THE ECHO', this.x, this.y - this.r - (this.phase >= 2 ? 30 : 12));
    const barY = this.y - this.r - 12 + (this.phase >= 2 ? -18 : 0);
    ctx.fillStyle = '#222';
    ctx.fillRect(this.x - 32, barY, 64, 5);
    ctx.fillStyle = '#cc44cc';
    ctx.fillRect(this.x - 32, barY, 64 * Math.max(0, this.hp / this.maxHp), 5);
  }
}
