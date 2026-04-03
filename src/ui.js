export class UI {
  constructor(canvas, tempoSystem, player, deckManager, cardDefs) {
    this.canvas = canvas;
    this.width = canvas.width;
    this.height = canvas.height;
    this.tempo = tempoSystem;
    this.player = player;
    this.deckManager = deckManager;
    this.cardDefs = cardDefs;
    this.selectedPrepSlot = 0;
    this.handBoxes = [];
    this.prepBoxes = [];
  }

  draw(ctx) {
    this._drawTempoBar(ctx);
    this._drawHP(ctx);
    if (this.deckManager && this.cardDefs) {
      this._drawHand(ctx);
      this._drawBudget(ctx);
    }
  }

  _drawTempoBar(ctx) {
    const BAR_W = 400, BAR_H = 22;
    const bx = (this.width - BAR_W) / 2, by = 18;

    // Markers
    const markers = [30, 70, 90];
    for (const m of markers) {
      const mx = bx + BAR_W * (m / 100);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mx, by - 4); ctx.lineTo(mx, by + BAR_H + 4); ctx.stroke();
    }

    // Multiplier readout above bar
    ctx.fillStyle = this.tempo.stateColor();
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    const dmgMult = this.tempo.damageMultiplier();
    const spdMult = this.tempo.speedMultiplier();
    const dmgColor = dmgMult >= 1.3 ? '#ff8844' : (dmgMult < 1.0 ? '#6688cc' : '#aaa');
    const spdColor = spdMult >= 1.2 ? '#44ff88' : (spdMult < 1.0 ? '#6688cc' : '#aaa');
    
    ctx.fillStyle = dmgColor;
    ctx.fillText(`DMG x${dmgMult.toFixed(1)}`, this.width / 2 - 70, by - 8);
    ctx.fillStyle = spdColor;
    ctx.fillText(`SPD x${spdMult.toFixed(1)}`, this.width / 2 + 70, by - 8);

    // Bar background
    ctx.fillStyle = '#111';
    ctx.fillRect(bx - 2, by - 2, BAR_W + 4, BAR_H + 4);

    // Bar fill
    const fill = (this.tempo.value / 100) * BAR_W;
    ctx.fillStyle = this.tempo.barColor();
    ctx.fillRect(bx, by, fill, BAR_H);

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, BAR_W, BAR_H);

    // Zone name
    ctx.fillStyle = this.tempo.stateColor();
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.tempo.stateName(), this.width / 2, by + BAR_H + 14);
  }

  _drawHP(ctx) {
    if (!this.player) return;
    const hp = this.player.hp, maxHp = this.player.maxHp;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#aaa';
    ctx.fillText('HP', 18, 28);
    for (let i = 0; i < maxHp; i++) {
      ctx.fillStyle = i < hp ? '#ee4444' : '#333';
      ctx.fillRect(44 + i * 16, 16, 12, 16);
    }
  }

  _drawBudget(ctx) {
    if (!this.player) return;
    const b = this.player.budget, mb = this.player.maxBudget;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4488ff';
    ctx.fillText('AP', 18, 54);
    for (let i = 0; i < mb; i++) {
      ctx.fillStyle = i < Math.floor(b) ? '#44aaff' : '#223355';
      ctx.fillRect(44 + i * 16, 42, 12, 16);
    }
    const partial = b % 1;
    if (b < mb) {
      const idx = Math.floor(b);
      ctx.fillStyle = 'rgba(68,170,255,0.4)';
      ctx.fillRect(44 + idx * 16, 42 + 16 * (1 - partial), 12, 16 * partial);
    }
  }

  _drawHand(ctx) {
    const hand = this.deckManager.hand;
    const CARD_W = 140, CARD_H = 180, GAP = 18, RADIUS = 12;
    const totalW = this.deckManager.HAND_SIZE * CARD_W + (this.deckManager.HAND_SIZE - 1) * GAP;
    const startX = (this.width - totalW) / 2;
    const y = this.height - CARD_H - 30;
    
    this.handBoxes = [];

    for (let i = 0; i < 4; i++) {
      const x = startX + i * (CARD_W + GAP);
      const cardId = hand[i];
      let def = null;
      let canAfford = false;
      
      if (cardId) {
        def = this.cardDefs[cardId];
        canAfford = this.player.budget >= def.cost;
      }
      
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 6;
      
      let grad = ctx.createLinearGradient(x, y, x, y + CARD_H);
      if (cardId && canAfford) {
        grad.addColorStop(0, '#222633');
        grad.addColorStop(1, '#151522');
      } else {
        grad.addColorStop(0, '#111116');
        grad.addColorStop(1, '#0a0a0d');
      }
      ctx.fillStyle = grad;
      
      ctx.beginPath();
      ctx.roundRect(x, y, CARD_W, CARD_H, RADIUS);
      ctx.fill();
      
      ctx.shadowColor = 'transparent';

      // Color accent stripe on left
      if (cardId && def) {
        ctx.fillStyle = canAfford ? (def.color || '#5577aa') : '#333';
        ctx.fillRect(x, y, 3, CARD_H);
      }
      
      // Stroke
      ctx.lineWidth = 2;
      if (this.selectedPrepSlot === i) {
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 4;
      } else {
        ctx.strokeStyle = cardId ? (canAfford ? '#5577aa' : '#334455') : '#222233';
      }
      ctx.stroke();

      // Key number
      ctx.fillStyle = cardId ? 'rgba(68, 68, 85, 0.35)' : '#2a2a35';
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(i + 1, x + CARD_W / 2, y + CARD_H / 2 + 16);

      if (cardId && def) {
        // Name
        ctx.fillStyle = canAfford ? '#ffffff' : '#666';
        ctx.font = 'bold 15px monospace';
        ctx.fillText(def.name, x + CARD_W / 2, y + 28);
        
        // Cost pip
        ctx.fillStyle = canAfford ? '#44aaff' : '#224466';
        ctx.beginPath();
        ctx.arc(x + 22, y + 22, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(def.cost, x + 22, y + 26);
        
        // Tempo shift
        ctx.fillStyle = def.tempoShift > 0 ? (canAfford ? '#ffaa66' : '#775533') : (canAfford ? '#66ccff' : '#336688');
        ctx.font = '11px monospace';
        ctx.fillText((def.tempoShift > 0 ? '+' : '') + def.tempoShift + ' T', x + CARD_W / 2, y + 55);

        // Range indicator
        ctx.fillStyle = canAfford ? '#888' : '#444';
        ctx.font = '10px monospace';
        ctx.fillText(`${def.range}px range`, x + CARD_W / 2, y + 70);

        // Type badge
        ctx.fillStyle = def.color || '#888';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(def.type.toUpperCase(), x + CARD_W / 2, y + 85);

        // Description
        ctx.fillStyle = canAfford ? '#999' : '#444';
        ctx.font = '11px monospace';
        this._wrapText(ctx, def.desc, x + 8, y + 120, CARD_W - 16, 13);
      }
      
      this.handBoxes.push({ x, y, w: CARD_W, h: CARD_H, slotIndex: i });
      ctx.restore();
    }
  }

  drawPrepScreen(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, this.width, this.height);
    
    ctx.fillStyle = '#44aaff';
    ctx.font = 'bold 38px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EQUIP LOADOUT', this.width / 2, 60);
    
    ctx.fillStyle = '#aaa';
    ctx.font = '14px monospace';
    ctx.fillText('1) Click a SLOT below to select it (gold border).  2) Click a card above to assign it.', this.width / 2, 95);
    ctx.fillStyle = '#ffdd44';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('Press ENTER when ready to fight!', this.width / 2, 120);

    // Draw equipped hand
    this._drawHand(ctx);

    // Draw collection grid
    const GAP = 12;
    const CARD_W = 115, CARD_H = 145;
    const COLS = Math.floor((this.width - 80) / (CARD_W + GAP));
    const totalW = COLS * (CARD_W + GAP) - GAP;
    const startX = (this.width - totalW) / 2;
    const startY = 155;
    
    this.prepBoxes = [];

    const collection = this.deckManager.collection;
    for (let i = 0; i < collection.length; i++) {
      let x = startX + (i % COLS) * (CARD_W + GAP);
      let y = startY + Math.floor(i / COLS) * (CARD_H + GAP);

      const cardId = collection[i];
      const def = this.cardDefs[cardId];
      if (!def) continue;
      
      // Check if currently equipped and in which slot
      const equippedSlot = this.deckManager.hand.indexOf(cardId);
      const isEquipped = equippedSlot >= 0;
      
      ctx.fillStyle = isEquipped ? '#1a1a2a' : '#111116';
      ctx.fillRect(x, y, CARD_W, CARD_H);
      
      // Color accent
      ctx.fillStyle = def.color || '#5577aa';
      ctx.fillRect(x, y, 3, CARD_H);
      
      ctx.strokeStyle = isEquipped ? '#ffaa00' : '#5577aa';
      ctx.lineWidth = isEquipped ? 2 : 1;
      ctx.strokeRect(x, y, CARD_W, CARD_H);
      
      // Equipped badge with slot number
      if (isEquipped) {
        ctx.fillStyle = '#ffaa00';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`SLOT ${equippedSlot + 1}`, x + CARD_W - 5, y + 14);
      }
      
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(def.name, x + CARD_W / 2, y + 24);
      
      ctx.fillStyle = '#44aaff';
      ctx.font = '12px monospace';
      ctx.fillText(`${def.cost} AP  |  ${def.range}px`, x + CARD_W / 2, y + 42);

      ctx.fillStyle = def.tempoShift > 0 ? '#ffaa66' : '#66ccff';
      ctx.font = '11px monospace';
      ctx.fillText((def.tempoShift > 0 ? '+' : '') + def.tempoShift + ' Tempo', x + CARD_W / 2, y + 58);

      ctx.fillStyle = def.color || '#888';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(def.type.toUpperCase(), x + CARD_W / 2, y + 74);

      ctx.fillStyle = '#aaa';
      ctx.font = '10px monospace';
      this._wrapText(ctx, def.desc, x + 6, y + 95, CARD_W - 12, 12);

      this.prepBoxes.push({ x, y, w: CARD_W, h: CARD_H, cardId });
    }
  }

  handlePrepClick(mx, my) {
    // Check hand slots first
    if (this.handBoxes) {
      for (const h of this.handBoxes) {
        if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) {
          this.selectedPrepSlot = h.slotIndex;
          return;
        }
      }
    }

    // Then check inventory cards — use equipCard to prevent duplicates
    if (!this.prepBoxes) return;
    for (const b of this.prepBoxes) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        this.deckManager.equipCard(this.selectedPrepSlot, b.cardId);
        break;
      }
    }
  }

  _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x + maxWidth / 2, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x + maxWidth / 2, y);
  }
}
