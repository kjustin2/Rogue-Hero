// ── Effects ───────────────────────────────────────────────────────────────────
// All transient visuals: shockwave rings, damage numbers, death bursts, trails.
// 'effects' array is declared as var in main.js — referenced here as a global.

const Effects = {
  spawnRing(x, y, maxRadius, pressure) {
    effects.push({ type: 'ring', x, y, age: 0, lifetime: 0.14, maxRadius, pressure })
  },

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
        case 'ring': {
          const r     = e.maxRadius * t
          const alpha = (1 - t).toFixed(2)
          const warmth = Math.round((0.4 + e.pressure * 0.6) * 255)
          ctx.beginPath()
          ctx.arc(e.x, e.y, Math.max(0, r), 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(255,${warmth},26,${alpha})`
          ctx.lineWidth = 3
          ctx.stroke()
          if (e.pressure > 0.5) {
            ctx.beginPath()
            ctx.arc(e.x, e.y, Math.max(0, r * 0.6), 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(255,255,153,${(((1 - t) * e.pressure * 0.4)).toFixed(2)})`
            ctx.lineWidth = 2
            ctx.stroke()
          }
          break
        }
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
      }
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }
}
