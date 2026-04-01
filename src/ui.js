// ── UI ────────────────────────────────────────────────────────────────────────
const UI = {
  vignetteAlpha: 0,
  pulseTimer:    0,

  update(dt) {
    // Vignette fades in when Tempo is hot
    const targetVig = Tempo.value >= 70 ? 0.35 : 0
    this.vignetteAlpha += (targetVig - this.vignetteAlpha) * Math.min(1, dt * 4)

    // Pulse timer for bar animation
    this.pulseTimer += dt
  },

  draw(ctx) {
    this._drawTempoBar(ctx)
    this._drawHP(ctx)
    this._drawLabels(ctx)
    this._drawVignette(ctx)
    if (Tempo.isCrashed) this._drawCrashFlash(ctx)
  },

  _drawTempoBar(ctx) {
    const BAR_W = 400, BAR_H = 22
    const bx = (CANVAS_W - BAR_W) / 2, by = 18

    // Background
    ctx.fillStyle = '#111'
    ctx.fillRect(bx - 2, by - 2, BAR_W + 4, BAR_H + 4)

    // Fill
    const fill = (Tempo.value / 100) * BAR_W
    ctx.fillStyle = Tempo.barColor()
    ctx.fillRect(bx, by, fill, BAR_H)

    // Hot pulse glow
    if (Tempo.value >= 70) {
      const pulse = 0.5 + 0.5 * Math.sin(this.pulseTimer * 8)
      ctx.fillStyle = `rgba(255,255,255,${(pulse * 0.12).toFixed(2)})`
      ctx.fillRect(bx, by, fill, BAR_H)
    }

    // REST marker at 50%
    const restX = bx + BAR_W * (Tempo.REST / 100)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(restX, by); ctx.lineTo(restX, by + BAR_H); ctx.stroke()

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.lineWidth = 1
    ctx.strokeRect(bx, by, BAR_W, BAR_H)

    // State label
    ctx.fillStyle = Tempo.stateColor()
    ctx.font = 'bold 11px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(Tempo.stateName(), CANVAS_W / 2, by + BAR_H + 14)
  },

  _drawHP(ctx) {
    const hp = RunState.hp, maxHp = RunState.maxHp
    ctx.font = 'bold 14px monospace'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#aaa'
    ctx.fillText('HP', 18, 28)
    for (let i = 0; i < maxHp; i++) {
      ctx.fillStyle = i < hp ? '#ee4444' : '#333'
      ctx.fillRect(44 + i * 16, 16, 12, 16)
    }
  },

  _drawLabels(ctx) {
    // Floor label
    ctx.font = '12px monospace'
    ctx.textAlign = 'right'
    ctx.fillStyle = '#666'
    ctx.fillText(`ROOM ${RunState.room}`, CANVAS_W - 18, 28)

    // XP
    ctx.fillStyle = '#887700'
    ctx.fillText(`XP ${RunState.xp}`, CANVAS_W - 18, 46)

    // Dodge cooldown indicator
    if (Player.dodgeCooldown > 0) {
      const t = Player.dodgeCooldown / Player.DODGE_CD
      ctx.fillStyle = `rgba(100,200,255,${(t * 0.7).toFixed(2)})`
      ctx.font = '11px monospace'
      ctx.fillText('DASH CHARGING', CANVAS_W - 18, CANVAS_H - 18)
    } else {
      ctx.fillStyle = 'rgba(100,200,255,0.5)'
      ctx.font = '11px monospace'
      ctx.fillText('DASH READY', CANVAS_W - 18, CANVAS_H - 18)
    }

    // Exit hint
    if (Room.exitOpen) {
      ctx.fillStyle = '#33dd66'
      ctx.textAlign = 'center'
      ctx.font = 'bold 13px monospace'
      ctx.fillText('ROOM CLEAR — REACH THE EXIT', CANVAS_W / 2, CANVAS_H - 18)
    }
  },

  _drawVignette(ctx) {
    if (this.vignetteAlpha < 0.01) return
    const grad = ctx.createRadialGradient(
      CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.25,
      CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.8
    )
    const col = Tempo.value >= 90 ? '180,0,0' : '120,0,0'
    grad.addColorStop(0, `rgba(${col},0)`)
    grad.addColorStop(1, `rgba(${col},${this.vignetteAlpha.toFixed(2)})`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
  },

  _drawCrashFlash(ctx) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('OVERLOAD', CANVAS_W / 2, CANVAS_H / 2)
  },

  drawDraft(ctx, choices) {
    ctx.fillStyle = 'rgba(0,0,0,0.78)'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 24px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('CHOOSE AN ITEM', CANVAS_W / 2, 180)

    const cardW = 280, cardH = 160, gap = 40
    const totalW = choices.length * cardW + (choices.length - 1) * gap
    const startX = (CANVAS_W - totalW) / 2

    choices.forEach((item, i) => {
      const cx = startX + i * (cardW + gap)
      const cy = 220

      // Card background — highlight on hover
      const mx = mouseX, my = mouseY
      const hovered = mx >= cx && mx <= cx + cardW && my >= cy && my <= cy + cardH
      ctx.fillStyle = hovered ? '#2a2a3a' : '#1a1a28'
      ctx.fillRect(cx, cy, cardW, cardH)
      ctx.strokeStyle = hovered ? '#8888ff' : '#3a3a5a'
      ctx.lineWidth = 2
      ctx.strokeRect(cx, cy, cardW, cardH)

      ctx.fillStyle = '#ccccff'
      ctx.font = 'bold 16px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(item.name, cx + cardW / 2, cy + 36)

      ctx.fillStyle = '#888'
      ctx.font = '12px monospace'
      const words = item.desc.split(' ')
      let line = '', lineY = cy + 64
      for (const w of words) {
        const test = line + w + ' '
        if (ctx.measureText(test).width > cardW - 24 && line !== '') {
          ctx.fillText(line.trim(), cx + cardW / 2, lineY)
          line = w + ' '; lineY += 18
        } else { line = test }
      }
      ctx.fillText(line.trim(), cx + cardW / 2, lineY)

      // Click number hint
      ctx.fillStyle = '#555'
      ctx.font = '11px monospace'
      ctx.fillText(`[${i + 1}]`, cx + cardW / 2, cy + cardH - 14)
    })

    ctx.fillStyle = '#444'
    ctx.font = '12px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Click a card or press 1 / 2 / 3', CANVAS_W / 2, CANVAS_H - 60)
  },

  drawDead(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.85)'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    ctx.fillStyle = '#dd3333'
    ctx.font = 'bold 56px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('YOU DIED', CANVAS_W / 2, CANVAS_H / 2 - 30)
    ctx.fillStyle = '#888'
    ctx.font = '18px monospace'
    ctx.fillText(`Room ${RunState.room}  ·  XP ${RunState.xp}`, CANVAS_W / 2, CANVAS_H / 2 + 20)
    ctx.fillStyle = '#555'
    ctx.font = '14px monospace'
    ctx.fillText('Press R to restart', CANVAS_W / 2, CANVAS_H / 2 + 60)
  },

  drawWin(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.82)'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    ctx.fillStyle = '#33dd66'
    ctx.font = 'bold 52px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('VICTORY', CANVAS_W / 2, CANVAS_H / 2 - 30)
    ctx.fillStyle = '#888'
    ctx.font = '18px monospace'
    ctx.fillText(`XP ${RunState.xp}`, CANVAS_W / 2, CANVAS_H / 2 + 20)
    ctx.fillStyle = '#555'
    ctx.font = '14px monospace'
    ctx.fillText('Press R to restart', CANVAS_W / 2, CANVAS_H / 2 + 60)
  }
}
