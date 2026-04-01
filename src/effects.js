// ── Effects ───────────────────────────────────────────────────────────────────
// All transient visuals: rings, damage numbers, death bursts, trails, crash bursts.
// 'effects' array is declared as var in main.js — referenced here as a global.

const Effects = {
  spawnNumber(x, y, amount) {
    effects.push({
      type: 'number', x, y, age: 0, lifetime: 0.7,
      vy: -75, vx: (Math.random() - 0.5) * 36,
      text: String(amount),
      color: Tempo.stateColor(),
      big: Tempo.value >= 70
    })
  },

  spawnBurst(x, y, color) {
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI * 2 / 6 + (Math.random() - 0.5) * 0.8
      const dist  = 28 + Math.random() * 44
      effects.push({
        type: 'shard', x, y, age: 0, lifetime: 0.22,
        tx: x + Math.cos(angle) * dist,
        ty: y + Math.sin(angle) * dist,
        size: 5 + Math.random() * 6,
        color
      })
    }
  },

  spawnTrail(x, y) {
    effects.push({ type: 'trail', x, y, age: 0, lifetime: 0.15, color: Tempo.stateColor() })
  },

  // Large radial ring for crash explosions
  spawnCrashBurst(x, y, radius) {
    effects.push({ type: 'crashburst', x, y, age: 0, lifetime: 0.35, radius })
    // Also spawn outer shards
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI * 2 / 10 + (Math.random() - 0.5) * 0.5
      const dist  = radius * (0.5 + Math.random() * 0.5)
      effects.push({
        type: 'shard', x, y, age: 0, lifetime: 0.3,
        tx: x + Math.cos(angle) * dist,
        ty: y + Math.sin(angle) * dist,
        size: 4 + Math.random() * 5,
        color: Tempo.stateColor()
      })
    }
  },

  // Flash + expanding ring for combo finisher hit
  spawnComboFinish(x, y) {
    effects.push({ type: 'combofinish', x, y, age: 0, lifetime: 0.2 })
  },

  // White flash ring for perfect dodge
  spawnPerfectDodge(x, y) {
    effects.push({ type: 'perfectdodge', x, y, age: 0, lifetime: 0.3 })
  },

  // Magenta drain pulse from TempoVampire attack
  spawnTempoSuck(x, y) {
    effects.push({ type: 'temposuck', x, y, age: 0, lifetime: 0.4 })
  },

  update(dt) {
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i]
      e.age += dt
      if (e.type === 'number') {
        e.vy += 80 * dt
        e.x  += e.vx * dt
        e.y  += e.vy * dt
      }
      if (e.age >= e.lifetime) effects.splice(i, 1)
    }
  },

  draw(ctx) {
    ctx.save()
    for (const e of effects) {
      const t = e.age / e.lifetime
      switch (e.type) {
        case 'number': {
          ctx.globalAlpha = 1 - t
          ctx.fillStyle   = e.color
          ctx.font        = `bold ${e.big ? 18 : 14}px monospace`
          ctx.textAlign   = 'center'
          ctx.fillText(e.text, e.x, e.y)
          break
        }
        case 'shard': {
          const cx = e.x + (e.tx - e.x) * t
          const cy = e.y + (e.ty - e.y) * t
          ctx.globalAlpha = 1 - t
          ctx.fillStyle   = e.color
          ctx.fillRect(cx - e.size / 2, cy - e.size / 2, e.size, e.size)
          break
        }
        case 'trail': {
          ctx.globalAlpha = (1 - t) * 0.5
          ctx.fillStyle   = e.color
          ctx.fillRect(e.x - 14, e.y - 14, 28, 28)
          break
        }
        case 'crashburst': {
          // Expanding ring, bright then fading
          const r     = e.radius * Math.sqrt(t)
          const alpha = (1 - t) * 0.9
          ctx.globalAlpha = alpha
          ctx.beginPath()
          ctx.arc(e.x, e.y, Math.max(0, r), 0, Math.PI * 2)
          ctx.strokeStyle = '#ff4400'
          ctx.lineWidth   = 5 * (1 - t) + 1
          ctx.stroke()
          // Inner fill flash
          if (t < 0.2) {
            ctx.globalAlpha = (0.2 - t) * 3 * 0.3
            ctx.fillStyle   = '#ff8800'
            ctx.beginPath()
            ctx.arc(e.x, e.y, Math.max(0, r), 0, Math.PI * 2)
            ctx.fill()
          }
          break
        }
        case 'combofinish': {
          const r = 50 * t
          ctx.globalAlpha = (1 - t) * 0.85
          ctx.beginPath()
          ctx.arc(e.x, e.y, Math.max(0, r), 0, Math.PI * 2)
          ctx.strokeStyle = '#ffdd00'
          ctx.lineWidth   = 4
          ctx.stroke()
          break
        }
        case 'perfectdodge': {
          // White expanding ring — very fast
          const r = 80 * t
          ctx.globalAlpha = (1 - t) * 0.7
          ctx.beginPath()
          ctx.arc(e.x, e.y, Math.max(0, r), 0, Math.PI * 2)
          ctx.strokeStyle = '#aaddff'
          ctx.lineWidth   = 3
          ctx.stroke()
          break
        }
        case 'temposuck': {
          // Magenta pulse contracting toward origin (reverse ring)
          const r = 60 * (1 - t)
          ctx.globalAlpha = t * 0.7
          ctx.beginPath()
          ctx.arc(e.x, e.y, Math.max(0, r), 0, Math.PI * 2)
          ctx.strokeStyle = '#cc44aa'
          ctx.lineWidth   = 3
          ctx.stroke()
          break
        }
      }
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }
}
