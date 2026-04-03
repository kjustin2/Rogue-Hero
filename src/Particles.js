export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.texts = [];
    this.visuals = [];
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= p.drag;
        p.vy *= p.drag;
      }
    }
    
    for (let i = this.texts.length - 1; i >= 0; i--) {
      let t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.texts.splice(i, 1);
      } else {
        t.y -= 30 * dt;
      }
    }

    for (let i = this.visuals.length - 1; i >= 0; i--) {
      let v = this.visuals[i];
      v.life -= dt;
      if (v.life <= 0) {
        this.visuals.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    // Particles
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
    
    // Damage numbers
    for (const t of this.texts) {
      const alpha = t.life / t.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = t.color;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      // Shadow for readability
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1.0;

    // Visual effects (slashes, rings)
    for (const v of this.visuals) {
      const progress = 1 - (v.life / v.maxLife);
      const alpha = v.life / v.maxLife;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = v.color;
      
      if (v.type === 'slash') {
        ctx.lineWidth = 18 * (1 - progress);
        ctx.beginPath();
        const dist = 65;
        const cx = v.x + Math.cos(v.angle) * (dist * 0.5);
        const cy = v.y + Math.sin(v.angle) * (dist * 0.5);
        ctx.arc(cx, cy, dist, v.angle - Math.PI / 3, v.angle + Math.PI / 3);
        ctx.stroke();
        // Inner bright core
        ctx.lineWidth = 6 * (1 - progress);
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = alpha * 0.6;
        ctx.beginPath();
        ctx.arc(cx, cy, dist - 4, v.angle - Math.PI / 4, v.angle + Math.PI / 4);
        ctx.stroke();
      } else if (v.type === 'ring') {
        ctx.lineWidth = 6 * (1 - progress);
        ctx.beginPath();
        ctx.arc(v.x, v.y, v.targetRadius * progress, 0, Math.PI * 2);
        ctx.stroke();
        // Inner fill
        ctx.fillStyle = v.color;
        ctx.globalAlpha = alpha * 0.08;
        ctx.beginPath();
        ctx.arc(v.x, v.y, v.targetRadius * progress, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1.0;
  }

  spawnBurst(x, y, color) {
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 180;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 2 + Math.random() * 3,
        color: color,
        life: 0.25 + Math.random() * 0.2,
        maxLife: 0.45,
        drag: 0.90
      });
    }
  }
  
  spawnDamageNumber(x, y, amount) {
    this.texts.push({
      x: x + (Math.random() * 24 - 12),
      y: y - 10,
      text: amount.toString(),
      color: typeof amount === 'string' ? '#44ff88' : '#ffffff',
      life: 0.8,
      maxLife: 0.8
    });
  }

  spawnSlash(x, y, targetX, targetY, color) {
    const angle = Math.atan2(targetY - y, targetX - x);
    this.visuals.push({
      type: 'slash',
      x, y,
      angle,
      color,
      life: 0.18,
      maxLife: 0.18
    });
  }

  spawnRing(x, y, targetRadius, color) {
    this.visuals.push({
      type: 'ring',
      x, y,
      targetRadius,
      color,
      life: 0.3,
      maxLife: 0.3
    });
  }
}
