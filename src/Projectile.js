// Projectile.js — Visible, dodgeable projectiles
import { events } from './EventBus.js';

class Projectile {
  constructor(x, y, dx, dy, speed, damage, color, source) {
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
    this.speed = speed || 260;
    this.damage = damage || 1;
    this.color = color || '#ff8800';
    this.source = source || 'enemy'; // 'enemy' or 'boss'
    this.r = 5;
    this.alive = true;
    this.life = 3.0;
    this.trail = [];
  }
}

export class ProjectileManager {
  constructor() {
    this.projectiles = [];
  }

  spawn(x, y, dx, dy, speed, damage, color, source) {
    this.projectiles.push(new Projectile(x, y, dx, dy, speed, damage, color, source));
  }

  spawnSpread(x, y, targetX, targetY, count, spreadAngle, speed, damage, color, source) {
    const baseAngle = Math.atan2(targetY - y, targetX - x);
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (i - (count - 1) / 2) * spreadAngle;
      this.spawn(x, y, Math.cos(angle), Math.sin(angle), speed, damage, color, source);
    }
  }

  clear() {
    this.projectiles.length = 0;
  }

  update(dt, player, room) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.life <= 0) { this._remove(i); continue; }

      // Store trail point
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 5) p.trail.shift();

      p.x += p.dx * p.speed * dt;
      p.y += p.dy * p.speed * dt;

      // Wall collision
      if (room && (p.x < room.FLOOR_X1 || p.x > room.FLOOR_X2 ||
                   p.y < room.FLOOR_Y1 || p.y > room.FLOOR_Y2)) {
        this._remove(i);
        continue;
      }

      // Pillar collision (if room has pillars)
      if (room && room.pillars) {
        let hitPillar = false;
        for (const pil of room.pillars) {
          if (p.x >= pil.x && p.x <= pil.x + pil.w && p.y >= pil.y && p.y <= pil.y + pil.h) {
            hitPillar = true;
            break;
          }
        }
        if (hitPillar) { this._remove(i); continue; }
      }

      // Player collision (skip if dodging — i-frames)
      if (player && player.alive && !player.dodging) {
        const dx = p.x - player.x, dy = p.y - player.y;
        if (dx * dx + dy * dy < (p.r + player.r) * (p.r + player.r)) {
          events.emit('ENEMY_MELEE_HIT', { damage: p.damage, source: p });
          // Track near-miss for perfect dodge (projectile was close while player dodged)
          this._remove(i);
          continue;
        }
      }

      // Perfect dodge detection — projectile passed through player during i-frames
      if (player && player.alive && player.dodging) {
        const dx = p.x - player.x, dy = p.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < p.r + player.r + 20) {
          // Near miss — emit for perfect dodge system
          events.emit('NEAR_MISS_PROJECTILE', { x: p.x, y: p.y });
        }
      }
    }
  }

  _remove(i) {
    this.projectiles[i] = this.projectiles[this.projectiles.length - 1];
    this.projectiles.pop();
  }

  draw(ctx) {
    for (const p of this.projectiles) {
      // Trail
      for (let i = 0; i < p.trail.length; i++) {
        const t = p.trail[i];
        const alpha = (i / p.trail.length) * 0.3;
        ctx.beginPath();
        ctx.arc(t.x, t.y, p.r * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Bullet body
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();

      // Bright core
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
