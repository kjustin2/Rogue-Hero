import { events } from './EventBus.js';

export class CombatManager {
  constructor(tempoSystem, particleSystem, audioSystem) {
    this.tempo = tempoSystem;
    this.particles = particleSystem;
    this.audio = audioSystem;
    this.postDodgeCritActive = false;
    this.postDodgeCritTimer = 0;

    events.on('CRASH_ATTACK', ({ x, y, radius, dmg }) => {
      this.circularHitbox(x, y, radius, dmg, true);
      // Crash burst visual
      this.particles.spawnCrashBurst(x, y, radius);
    });

    events.on('PERFECT_DODGE', () => {
      this.postDodgeCritActive = true;
      this.postDodgeCritTimer = 1.5;
    });
  }

  setLists(enemies, player) {
    this.enemies = enemies;
    this.player = player;
  }

  update(dt) {
    if (this.postDodgeCritTimer > 0) {
      this.postDodgeCritTimer -= dt;
      if (this.postDodgeCritTimer <= 0) this.postDodgeCritActive = false;
    }
  }

  circularHitbox(x, y, radius, dmg, severeStagger = false) {
    if (!this.enemies) return false;
    let hitAny = false;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy < (radius + e.r) * (radius + e.r)) {
        this.applyDamageToEnemy(e, dmg);
        if (e.alive && (severeStagger || this.tempo.value < 30)) {
          e.stagger(severeStagger ? 0.6 : 0.25);
        }
        hitAny = true;
      }
    }
    return hitAny;
  }

  applyDamageToEnemy(enemy, amount) {
    // Post-dodge crit (Shadow passive)
    if (this.postDodgeCritActive && this.tempo.classPassives?.postDodgeCrit) {
      amount = Math.round(amount * 2);
      this.postDodgeCritActive = false;
      this.particles.spawnDamageNumber(enemy.x, enemy.y - 30, 'CRIT!');
    }

    // ShieldDrone/Conductor immunity check
    if (enemy.type === 'shielddrone') {
      const actualDmg = enemy.takeDamage(amount, this.tempo);
      if (actualDmg === 0) return false; // Was shielded
      this.particles.spawnDamageNumber(enemy.x, enemy.y, actualDmg);
    } else if (enemy.type === 'boss_conductor') {
      const actualDmg = enemy.takeDamage(amount, this.tempo, this.enemies);
      if (actualDmg === 0) return false;
      this.particles.spawnDamageNumber(enemy.x, enemy.y, actualDmg);
    } else {
      enemy.takeDamage(amount);
      this.particles.spawnDamageNumber(enemy.x, enemy.y, amount);
    }

    if (!enemy.alive) {
      this.particles.spawnBurst(enemy.x, enemy.y, '#dd3333');
      events.emit('KILL');
      events.emit('PLAY_SOUND', 'kill');

      // Check if this was the last enemy
      const remaining = this.enemies.filter(e => e.alive && e !== enemy);
      if (remaining.length === 0) {
        events.emit('LAST_KILL', { x: enemy.x, y: enemy.y });
      }
      return true;
    }
    return false;
  }

  executeCard(player, cardDef, inputPos) {
    if (player.budget < cardDef.cost) return false;

    player.budget -= cardDef.cost;
    this.tempo.setValue(this.tempo.value + cardDef.tempoShift);
    const dmgMult = this.tempo.damageMultiplier();
    const cardColor = cardDef.color || '#ffffff';
    const isCritical = this.tempo.value >= 90;

    // Blood Pact: costs 1 HP
    if (cardDef.id === 'blood_pact') {
      player.takeDamage(1);
      this.particles.spawnBurst(player.x, player.y, '#ff2266');
    }

    // ── MELEE ──
    if (cardDef.type === 'melee') {
      if (isCritical) {
        // CRITICAL PIERCE: hit ALL enemies in range, not just nearest
        return this._meleePierce(player, cardDef, dmgMult, cardColor);
      }

      let nearest = null, nearestDist = Infinity;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = e.x - player.x, dy = e.y - player.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < cardDef.range + e.r && d < nearestDist) { nearest = e; nearestDist = d; }
      }
      if (nearest) {
        const dmg = Math.round(cardDef.damage * dmgMult);
        let killed = this.applyDamageToEnemy(nearest, dmg);

        if (cardDef.id === 'vampire_bite' && killed) {
          player.heal(1);
          this.particles.spawnDamageNumber(player.x, player.y - 20, '+1 HP');
        }
        if (cardDef.id === 'shield_bash' && nearest.alive) {
          nearest.stagger(0.8);
        }

        if (nearest.alive && this.tempo.value < 30) nearest.stagger(0.25);
        events.emit('HIT_STOP', cardDef.cost > 2 ? 0.1 : 0.04);
        if (cardDef.cost > 2) events.emit('SCREEN_SHAKE', { duration: 0.15, intensity: 0.3 });
        this.particles.spawnSlash(player.x, player.y, nearest.x, nearest.y, cardColor);
        this.particles.spawnBurst(nearest.x, nearest.y, cardColor);
        events.emit('PLAY_SOUND', cardDef.cost > 2 ? 'heavyHit' : 'hit');
        return true;
      } else {
        this.particles.spawnRing(player.x, player.y, cardDef.range, 'rgba(255,255,255,0.2)');
        events.emit('PLAY_SOUND', 'miss');
        return true;
      }
    }

    // ── CLEAVE ──
    if (cardDef.type === 'cleave') {
      const dmg = Math.round(cardDef.damage * dmgMult);
      let hitAny = false;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = e.x - player.x, dy = e.y - player.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < cardDef.range + e.r) {
          this.applyDamageToEnemy(e, dmg);
          if (e.alive) e.stagger(0.15);
          hitAny = true;
        }
      }
      let angle = Math.atan2(inputPos.y - player.y, inputPos.x - player.x);
      this.particles.spawnSlash(player.x, player.y, player.x + Math.cos(angle) * 80, player.y + Math.sin(angle) * 80, cardColor);
      this.particles.spawnRing(player.x, player.y, cardDef.range, cardColor);
      if (hitAny) {
        events.emit('SCREEN_SHAKE', { duration: 0.08, intensity: 0.15 });
        events.emit('PLAY_SOUND', 'hit');
      } else {
        events.emit('PLAY_SOUND', 'miss');
      }
      return true;
    }

    // ── DASH ──
    if (cardDef.type === 'dash') {
      let nearest = null, nearestDist = Infinity;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = e.x - player.x, dy = e.y - player.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < cardDef.range + e.r && d < nearestDist) { nearest = e; nearestDist = d; }
      }
      if (nearest) {
        const dx = nearest.x - player.x, dy = nearest.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        this.particles.spawnBurst(player.x, player.y, cardColor);
        if (dist > 30) {
          player.x += (dx / dist) * (dist - 30);
          player.y += (dy / dist) * (dist - 30);
        }
        const dmg = Math.round(cardDef.damage * dmgMult);
        this.applyDamageToEnemy(nearest, dmg);
        if (cardDef.id === 'shadow_mark' && nearest.alive) {
          nearest.marked = true;
          this.particles.spawnDamageNumber(nearest.x, nearest.y - 20, 'MARKED');
        }
        events.emit('SCREEN_SHAKE', { duration: 0.08, intensity: 0.2 });
        this.particles.spawnSlash(player.x, player.y, nearest.x, nearest.y, cardColor);
        events.emit('PLAY_SOUND', 'hit');
        return true;
      } else {
        const dx = inputPos.x - player.x, dy = inputPos.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 10) {
          this.particles.spawnBurst(player.x, player.y, cardColor);
          player.x += (dx / dist) * Math.min(dist, 120);
          player.y += (dy / dist) * Math.min(dist, 120);
        }
        events.emit('PLAY_SOUND', 'dodge');
        return true;
      }
    }

    // ── PROJECTILE (radial AoE) ──
    if (cardDef.type === 'projectile') {
      const dmg = Math.round(cardDef.damage * dmgMult);
      this.particles.spawnRing(player.x, player.y, cardDef.range, cardColor);
      let hitAny = this.circularHitbox(player.x, player.y, cardDef.range, dmg);

      if (cardDef.id === 'frost_nova' || cardDef.id === 'iron_wall' || cardDef.id === 'thunder_clap') {
        const staggerDur = cardDef.id === 'iron_wall' ? 1.5 : 1.0;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const dx = e.x - player.x, dy = e.y - player.y;
          if (dx * dx + dy * dy < (cardDef.range + e.r) * (cardDef.range + e.r)) {
            e.stagger(staggerDur);
          }
        }
      }

      events.emit('PLAY_SOUND', 'heavyHit');
      if (hitAny) events.emit('SCREEN_SHAKE', { duration: 0.1, intensity: 0.2 });
      return true;
    }

    return false;
  }

  // Critical-state pierce: melee hits ALL enemies in range
  _meleePierce(player, cardDef, dmgMult, cardColor) {
    const dmg = Math.round(cardDef.damage * dmgMult);
    let hitAny = false;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < cardDef.range + e.r) {
        this.applyDamageToEnemy(e, dmg);
        this.particles.spawnSlash(player.x, player.y, e.x, e.y, cardColor);
        hitAny = true;
      }
    }
    if (hitAny) {
      events.emit('HIT_STOP', 0.12);
      events.emit('SCREEN_SHAKE', { duration: 0.15, intensity: 0.35 });
      events.emit('PLAY_SOUND', 'heavyHit');
      this.particles.spawnRing(player.x, player.y, cardDef.range, '#ff3333');
    } else {
      this.particles.spawnRing(player.x, player.y, cardDef.range, 'rgba(255,100,100,0.3)');
      events.emit('PLAY_SOUND', 'miss');
    }
    return true;
  }

  // Hot state dash-attack: dodge INTO enemy = contact damage
  checkDashAttack(player, tempoValue) {
    if (!player.dodging || tempoValue < 70) return;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < player.r + e.r + 12) {
        const dmg = Math.round(8 * this.tempo.damageMultiplier());
        this.applyDamageToEnemy(e, dmg);
        this.particles.spawnBurst(e.x, e.y, '#ff8800');
        events.emit('PLAY_SOUND', 'hit');
        events.emit('HIT_STOP', 0.06);
        break; // Only hit one enemy per dash
      }
    }
  }

  drawRangeIndicator(ctx, player, hand, cardDefs) {
    if (!player) return;
    let ranges = [];
    for (let cardId of hand) {
      if (!cardId) continue;
      const def = cardDefs[cardId];
      if (!def) continue;
      const existing = ranges.find(r => r.range === def.range);
      if (!existing) {
        ranges.push({ range: def.range, color: def.color || '#ffffff', name: def.name });
      }
    }
    ranges.sort((a, b) => a.range - b.range);

    for (const r of ranges) {
      ctx.beginPath();
      ctx.setLineDash([6, 8]);
      ctx.arc(player.x, player.y, r.range, 0, Math.PI * 2);
      ctx.strokeStyle = r.color + '33';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawReticles(ctx, hand, cardDefs, now) {
    if (!this.enemies || !this.player) return;

    let maxRange = 0;
    for (let cardId of hand) {
      if (!cardId) continue;
      const def = cardDefs[cardId];
      if (def && def.range > maxRange) maxRange = def.range;
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - this.player.x, dy = e.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < maxRange + e.r) {
        const t = now / 400;
        ctx.strokeStyle = 'rgba(255, 80, 80, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 8, t, t + Math.PI * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 8, t + Math.PI, t + Math.PI * 1.5);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 80, 80, 0.6)';
        ctx.beginPath();
        const py = e.y - e.r - 22;
        ctx.moveTo(e.x, py - 4);
        ctx.lineTo(e.x + 4, py);
        ctx.lineTo(e.x, py + 4);
        ctx.lineTo(e.x - 4, py);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
}
