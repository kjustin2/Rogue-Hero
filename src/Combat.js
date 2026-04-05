import { events } from './EventBus.js';

export class CombatManager {
  constructor(tempoSystem, particleSystem, audioSystem, projectileManager) {
    this.tempo = tempoSystem;
    this.particles = particleSystem;
    this.audio = audioSystem;
    this.projectiles = projectileManager || null;
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
    // Marked for Death: 2× damage
    if (enemy.markedTimer > 0) {
      amount = Math.round(amount * 2);
    }
    // Wraith Death's Edge: 2× damage at low HP, kills heal
    if (this.tempo.classPassives?.deathsEdge && this.player && this.player.hp <= 2) {
      amount = Math.round(amount * 2);
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

      // Wraith Death's Edge kill-heal
      if (this.tempo.classPassives?.deathsEdge && this.player && this.player.hp <= 2) {
        this.player.heal(1);
        this.particles.spawnDamageNumber(this.player.x, this.player.y - 20, '+1 HP');
      }

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

    // Blood Pact: costs HP
    if (cardDef.id === 'blood_pact') {
      player.takeDamage(1);
      this.particles.spawnBurst(player.x, player.y, '#ff2266');
    }
    // Glass Cannon / self-damage cards
    if (cardDef.selfDamage) {
      player.takeDamage(cardDef.selfDamage);
      this.particles.spawnBurst(player.x, player.y, '#ff0044');
      this.particles.spawnDamageNumber(player.x, player.y - 20, `-${cardDef.selfDamage} HP`);
    }
    // Riposte: if used within 0.6s of dodge, cost is 0 (refund already spent budget)
    if (cardDef.riposte && player.recentDodgeTimer > 0.1) {
      player.budget += cardDef.cost; // refund
    }
    // Death's Bargain: cannot use at ≤2 HP
    if (cardDef.deathsBargain) {
      if (player.hp <= 2) {
        player.budget += cardDef.cost;
        this.particles.spawnDamageNumber(player.x, player.y - 30, 'NOT NOW!');
        return false;
      }
      player.takeDamage(2);
      this.particles.spawnBurst(player.x, player.y, '#cc0000');
    }
    // Last Stand: only at ≤2 HP
    if (cardDef.lastStand && player.hp > 2) {
      player.budget += cardDef.cost;
      this.particles.spawnDamageNumber(player.x, player.y - 30, 'NOT NOW!');
      return false;
    }
    // Tempo Flip: override tempo shift here
    if (cardDef.tempoFlip) {
      const shift = this.tempo.value > 50 ? -30 : 30;
      this.tempo._add(shift);
      this.particles.spawnRing(player.x, player.y, 60, '#44ffff');
      events.emit('PLAY_SOUND', 'hit');
      return true;
    }
    // Berserker's Oath: lose 2 HP, set oath stacks
    if (cardDef.berserkerOath) {
      player.takeDamage(2);
      player.oathStacks = 3;
      player.oathComboWindow = true;
      this.particles.spawnRing(player.x, player.y, 80, '#ff3300');
      this.particles.spawnDamageNumber(player.x, player.y - 30, 'OATH!');
      events.emit('PLAY_SOUND', 'heavyHit');
      return true;
    }
    // Phase Step: invincibility bubble
    if (cardDef.phaseStep) {
      player.dodging = true;
      player.dodgeTimer = 0.5;
      player.dodgeCooldown = Math.max(player.dodgeCooldown, 0.5);
      this.particles.spawnBurst(player.x, player.y, '#ccaaff');
      events.emit('PLAY_SOUND', 'dodge');
      return true;
    }

    // ── MELEE ──
    if (cardDef.type === 'melee') {
      // Mirror Strike: hit in 4 cardinal directions
      if (cardDef.mirrorStrike) {
        return this._mirrorStrike(player, cardDef, dmgMult, cardColor);
      }

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
        // Combo tracking
        player.comboTimer = 2.0;
        player.comboCount++;
        events.emit('COMBO_HIT', { hitNum: Math.min(player.comboCount, 3) });
        if (player.comboCount >= 2) {
          events.emit('COMBO_DISPLAY', { count: player.comboCount, x: nearest.x, y: nearest.y - 30 });
        }

        let hitMult = player.comboCount >= 3 ? 1.4 : 1;
        // Counter Slash / Riposte: bonus damage if used shortly after a dodge
        if ((cardDef.postDodgeBonus || cardDef.riposte) && player.recentDodgeTimer > 0) {
          hitMult *= 1.5;
          this.particles.spawnDamageNumber(nearest.x, nearest.y - 20, 'COUNTER!');
        }
        // Guard stacks bonus (Vanguard Punisher + Iron Retort)
        const guardStacks = player.guardStacks || 0;
        if (cardDef.ironRetort) hitMult *= (1 + guardStacks * 8 / cardDef.damage);
        if (guardStacks > 0 && this.tempo.classPassives?.punisher &&
            (cardDef.type === 'cleave' || cardDef.cost >= 3)) {
          hitMult *= (1 + guardStacks * 0.25);
        }
        // Death Blow: triple damage below 20% HP
        if (cardDef.executeLowMult && nearest.hp / nearest.maxHp < 0.20) {
          hitMult *= 3;
          this.particles.spawnDamageNumber(nearest.x, nearest.y - 30, 'DEATH BLOW!');
        }
        // Echo resonance pulse: secondary hit if Tempo ±5 of 50
        const isEchoResonant = this.tempo.classPassives?.resonancePulse &&
          Math.abs(this.tempo.value - 50) <= 5;

        const dmg = Math.round(cardDef.damage * dmgMult * hitMult);

        // Frenzy: multi-hit
        if (cardDef.multiHit && cardDef.multiHit > 1) {
          for (let h = 0; h < cardDef.multiHit; h++) {
            if (!nearest.alive) break;
            this.applyDamageToEnemy(nearest, dmg);
            player.comboCount++;
            events.emit('COMBO_HIT', { hitNum: Math.min(player.comboCount, 3) });
          }
        } else {
          let killed = this.applyDamageToEnemy(nearest, dmg);
          if (cardDef.id === 'vampire_bite' && killed) {
            player.heal(1);
            this.particles.spawnDamageNumber(player.x, player.y - 20, '+1 HP');
          }
        }

        if (cardDef.id === 'shield_bash' && nearest.alive) nearest.stagger(0.8);
        if (cardDef.bleed && nearest.alive) { nearest.bleedTimer = 3.0; nearest.bleedDmg = 3; }
        // Whip Lash: apply slow
        if (cardDef.slow && nearest.alive) {
          nearest.slowTimer = 0.5;
          nearest.slowMult = 0.5;
        }

        if (nearest.alive && this.tempo.value < 30) nearest.stagger(0.5);

        // Echo resonance pulse: radial AoE 100px at 40% damage
        if (isEchoResonant) {
          const pulseDmg = Math.round(dmg * 0.4);
          for (const other of this.enemies) {
            if (!other.alive || other === nearest) continue;
            const pdx = other.x - nearest.x, pdy = other.y - nearest.y;
            if (pdx * pdx + pdy * pdy < (100 + other.r) * (100 + other.r)) {
              this.applyDamageToEnemy(other, pulseDmg);
            }
          }
          this.particles.spawnRing(nearest.x, nearest.y, 100, '#00eedd');
        }

        events.emit('HIT_STOP', cardDef.cost > 2 ? 0.1 : 0.04);
        if (cardDef.cost > 2) events.emit('SCREEN_SHAKE', { duration: 0.15, intensity: 0.3 });
        this.particles.spawnSlash(player.x, player.y, nearest.x, nearest.y, cardColor);
        this.particles.spawnBurst(nearest.x, nearest.y, cardColor);
        events.emit('PLAY_SOUND', cardDef.cost > 2 ? 'heavyHit' : 'hit');
        return true;
      } else {
        // Miss
        if (cardDef.apRefundOnMiss) {
          player.budget += cardDef.cost;
          this.particles.spawnDamageNumber(player.x, player.y - 20, 'MISS (refund)');
        }
        this.particles.spawnRing(player.x, player.y, cardDef.range, 'rgba(255,255,255,0.2)');
        events.emit('PLAY_SOUND', 'miss');
        return true;
      }
    }

    // ── CLEAVE ──
    if (cardDef.type === 'cleave') {
      let cleaveMult = 1.0;
      // Vanguard Punisher bonus
      const guardStacks = player.guardStacks || 0;
      if (guardStacks > 0 && this.tempo.classPassives?.punisher) {
        cleaveMult *= (1 + guardStacks * 0.25);
      }
      // Earthshaker hot bonus
      if (cardDef.hotBonus && this.tempo.value >= 70) {
        cleaveMult *= 1.5;
        this.particles.spawnDamageNumber(player.x, player.y - 30, 'HOT!');
      }
      const dmg = Math.round(cardDef.damage * dmgMult * cleaveMult);
      let hitAny = false;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = e.x - player.x, dy = e.y - player.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < cardDef.range + e.r) {
          // Reaper: instakill below 15% HP
          const finalDmg = (cardDef.executeLow && e.hp / e.maxHp < 0.15) ? e.hp + 999 : dmg;
          this.applyDamageToEnemy(e, finalDmg);
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
    // Dashes toward enemy but stops at safe distance (outside contact range).
    // Brief invincibility window so the player doesn't immediately take contact damage.
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
        // Safe stop distance: just outside contact range
        const safeStop = player.r + nearest.r + 18;
        this.particles.spawnBurst(player.x, player.y, cardColor);
        if (dist > safeStop) {
          player.x += (dx / dist) * (dist - safeStop);
          player.y += (dy / dist) * (dist - safeStop);
        }
        // Brief invincibility so the player doesn't take immediate contact damage
        player.dodging = true;
        player.dodgeTimer = 0.18;
        player.dodgeCooldown = Math.max(player.dodgeCooldown, 0.18);

        const dmg = Math.round(cardDef.damage * dmgMult);
        this.applyDamageToEnemy(nearest, dmg);
        if (cardDef.id === 'shadow_mark' && nearest.alive) {
          nearest.marked = true;
          this.particles.spawnDamageNumber(nearest.x, nearest.y - 20, 'MARKED');
        }
        events.emit('HIT_STOP', 0.08);
        events.emit('SCREEN_SHAKE', { duration: 0.1, intensity: 0.25 });
        this.particles.spawnSlash(player.x, player.y, nearest.x, nearest.y, cardColor);
        events.emit('PLAY_SOUND', 'hit');
        return true;
      } else {
        // No enemy in range — dash toward cursor, no invincibility cost
        const dx = inputPos.x - player.x, dy = inputPos.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 10) {
          this.particles.spawnBurst(player.x, player.y, cardColor);
          player.x += (dx / dist) * Math.min(dist, 140);
          player.y += (dy / dist) * Math.min(dist, 140);
          player.dodging = true;
          player.dodgeTimer = 0.12;
          player.dodgeCooldown = Math.max(player.dodgeCooldown, 0.12);
        }
        events.emit('PLAY_SOUND', 'dodge');
        return true;
      }
    }

    // ── PROJECTILE (radial AoE) ──
    if (cardDef.type === 'projectile') {
      const dmg = Math.round(cardDef.damage * dmgMult);
      this.particles.spawnRing(player.x, player.y, cardDef.range, cardColor);

      // War Cry: stagger all + player speed boost, no damage
      if (cardDef.warCry) {
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const dx = e.x - player.x, dy = e.y - player.y;
          if (dx * dx + dy * dy < (cardDef.range + e.r) * (cardDef.range + e.r)) {
            e.stagger(1.2);
          }
        }
        player.speedBoostTimer = 1.5;
        player.speedBoostMult = 1.2;
        this.particles.spawnBurst(player.x, player.y, '#ffaa22');
        events.emit('PLAY_SOUND', 'heavyHit');
        return true;
      }

      // Resonant Pulse: double dmg at Tempo 45–55
      let projDmg = dmg;
      if (cardDef.resonantPulse && Math.abs(this.tempo.value - 50) <= 5) {
        projDmg = dmg * 2;
        this.particles.spawnDamageNumber(player.x, player.y - 30, 'RESONANCE!');
      }

      let hitAny = false;
      let hitCount = 0;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = e.x - player.x, dy = e.y - player.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < (cardDef.range + e.r) * (cardDef.range + e.r)) {
          this.applyDamageToEnemy(e, projDmg);
          hitAny = true;
          hitCount++;
          // Knockback
          if (cardDef.knockback && e.alive) {
            const dist = Math.sqrt(dist2) || 1;
            e.x += (dx / dist) * cardDef.knockback;
            e.y += (dy / dist) * cardDef.knockback;
          }
          // Soul drain: steal tempo per enemy
          if (cardDef.tempoSteal) {
            this.tempo._add(cardDef.tempoSteal);
          }
          // Stagger for stagger cards
          if (cardDef.id === 'frost_nova' || cardDef.id === 'iron_wall' ||
              cardDef.id === 'thunder_clap' || cardDef.id === 'cold_wave' || cardDef.id === 'war_cry') {
            const staggerDur = cardDef.id === 'iron_wall' ? 1.5 : (cardDef.id === 'cold_wave' ? 0.8 : 1.0);
            if (e.alive) e.stagger(staggerDur);
          }
        }
      }

      // Also do stagger for frost_nova etc if not already done above
      if ((cardDef.id === 'frost_nova' || cardDef.id === 'iron_wall' || cardDef.id === 'thunder_clap' || cardDef.id === 'cold_wave') && !hitAny) {
        // already handled above in loop
      }

      // Leech: heal based on enemies hit
      if (cardDef.leech && hitCount > 0) {
        const healAmt = Math.min(hitCount, 2);
        player.heal(healAmt);
        this.particles.spawnDamageNumber(player.x, player.y - 30, `+${healAmt} HP`);
      }

      // Last Stand: if killed all, restore 2 HP
      if (cardDef.lastStand) {
        const remaining = this.enemies.filter(e => e.alive);
        if (remaining.length === 0) {
          player.heal(2);
          this.particles.spawnDamageNumber(player.x, player.y - 30, '+2 HP');
        }
      }

      events.emit('PLAY_SOUND', 'heavyHit');
      if (hitAny) events.emit('SCREEN_SHAKE', { duration: 0.1, intensity: 0.2 });
      return true;
    }

    // ── SHOT (fires real projectiles toward cursor) ──
    if (cardDef.type === 'shot') {
      if (!this.projectiles) return false;
      const dx = inputPos.x - player.x, dy = inputPos.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const dirX = dx / dist, dirY = dy / dist;
      const dmg = Math.round(cardDef.damage * dmgMult);
      const speed = cardDef.shotSpeed || 420;
      const count = cardDef.shotCount || 1;
      const spread = cardDef.shotSpread || 0;
      const col = cardDef.color || '#88ffdd';

      const freezes = cardDef.freezes || false;
      const meta = {
        ricochetBounces: cardDef.ricochetBounces || 0,
        clusterAoE: cardDef.clusterAoE || 0,
        executeLowShot: cardDef.executeLowShot || 0,
        piercingShot: cardDef.piercingShot || false,
      };

      if (count === 1) {
        this.projectiles.spawn(player.x, player.y, dirX, dirY, speed, dmg, col, 'player', freezes, meta);
      } else {
        this.projectiles.spawnSpread(player.x, player.y, inputPos.x, inputPos.y, count, spread, speed, dmg, col, 'player', freezes);
      }

      // Visual feedback — small muzzle burst
      this.particles.spawnBurst(player.x, player.y, col);
      events.emit('PLAY_SOUND', 'hit');
      events.emit('HIT_STOP', 0.03);
      return true;
    }

    // ── UTILITY ──
    if (cardDef.type === 'utility') {
      if (cardDef.id === 'second_wind') {
        player.heal(1);
        this.particles.spawnDamageNumber(player.x, player.y - 30, '+1 HP');
        events.emit('PLAY_SOUND', 'itemPickup');
      } else if (cardDef.id === 'adrenaline') {
        // tempo shift already applied above
        this.particles.spawnRing(player.x, player.y, 60, '#ffff44');
        events.emit('PLAY_SOUND', 'hit');
      } else if (cardDef.id === 'smoke_screen') {
        player.dodging = true;
        player.dodgeTimer = 0.8;
        player.dodgeCooldown = 0.8;
        this.particles.spawnBurst(player.x, player.y, '#aaaaaa');
        events.emit('PLAY_SOUND', 'dodge');
      } else if (cardDef.markForDeath) {
        // Mark nearest enemy in range
        let nearest = null, nearestDist = Infinity;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const dx = e.x - player.x, dy = e.y - player.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < cardDef.range + e.r && d < nearestDist) { nearest = e; nearestDist = d; }
        }
        if (nearest) {
          nearest.markedTimer = 4.0;
          this.particles.spawnDamageNumber(nearest.x, nearest.y - 30, 'DOOMED');
          events.emit('PLAY_SOUND', 'hit');
        } else {
          events.emit('PLAY_SOUND', 'miss');
        }
      }
      return true;
    }

    return false;
  }

  // Mirror Strike: hit in all 4 cardinal directions
  _mirrorStrike(player, cardDef, dmgMult, cardColor) {
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    const dmg = Math.round(cardDef.damage * dmgMult);
    let hitAny = false;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (Math.sqrt(dx*dx+dy*dy) < cardDef.range + e.r) {
        this.applyDamageToEnemy(e, dmg);
        hitAny = true;
      }
    }
    for (const [cx, cy] of dirs) {
      this.particles.spawnSlash(player.x, player.y, player.x + cx*cardDef.range, player.y + cy*cardDef.range, cardColor);
    }
    if (hitAny) {
      events.emit('HIT_STOP', 0.1);
      events.emit('SCREEN_SHAKE', { duration: 0.12, intensity: 0.25 });
      events.emit('PLAY_SOUND', 'heavyHit');
    } else {
      events.emit('PLAY_SOUND', 'miss');
    }
    return true;
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

  drawRangeIndicator(ctx, player, hand, cardDefs, selectedCardSlot) {
    if (!player) return;
    let ranges = [];
    const selectedCardId = hand[selectedCardSlot];
    
    for (let cardId of hand) {
      if (!cardId) continue;
      const def = cardDefs[cardId];
      if (!def) continue;
      const existing = ranges.find(r => r.range === def.range);
      if (!existing) {
        ranges.push({ range: def.range, color: def.color || '#ffffff', name: def.name, isSelected: cardId === selectedCardId });
      } else if (cardId === selectedCardId) {
        existing.isSelected = true;
      }
    }
    ranges.sort((a, b) => a.range - b.range);

    ctx.save();
    for (const r of ranges) {
      ctx.beginPath();
      ctx.arc(player.x, player.y, r.range, 0, Math.PI * 2);
      
      if (r.isSelected) {
        ctx.setLineDash([]);
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = r.color;
        ctx.shadowBlur = 15;
        ctx.stroke();
        
        ctx.fillStyle = r.color + '11'; // Very faint solid fill
        ctx.fill();
      } else {
        ctx.shadowBlur = 0;
        ctx.setLineDash([4, 8]);
        ctx.strokeStyle = r.color + '33'; // More transparent
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.restore();
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
