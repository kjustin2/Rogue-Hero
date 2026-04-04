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
    this.selectedCardSlot = 0;
    this.handBoxes = [];
    this.prepBoxes = [];
    this.itemManager = null;
    this.enemies = null;
    this.runStats = null;
    this._pulseTimer = 0;
  }

  setItemManager(im) { this.itemManager = im; }
  setEnemies(enemies) { this.enemies = enemies; }
  setRunStats(stats) { this.runStats = stats; }

  update(dt) {
    this._pulseTimer += dt;
  }

  draw(ctx) {
    this._drawTempoBar(ctx);
    this._drawHP(ctx);
    if (this.deckManager && this.cardDefs) {
      this._drawHand(ctx);
      this._drawBudget(ctx);
    }
    if (this.itemManager) this._drawRelics(ctx);
    if (this.enemies) this._drawMinimap(ctx);
  }

  // ───────────────────────────────────────────────────────────────
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

    // Multiplier readout
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    const dmgMult = this.tempo.damageMultiplier();
    const spdMult = this.tempo.speedMultiplier();
    ctx.fillStyle = dmgMult >= 1.3 ? '#ff8844' : (dmgMult < 1.0 ? '#6688cc' : '#aaa');
    ctx.fillText(`DMG x${dmgMult.toFixed(1)}`, this.width / 2 - 70, by - 8);
    ctx.fillStyle = spdMult >= 1.2 ? '#44ff88' : (spdMult < 1.0 ? '#6688cc' : '#aaa');
    ctx.fillText(`SPD x${spdMult.toFixed(1)}`, this.width / 2 + 70, by - 8);

    // Bar background
    ctx.fillStyle = '#111';
    ctx.fillRect(bx - 2, by - 2, BAR_W + 4, BAR_H + 4);

    // Pulsing bar fill
    const pulseRate = 1 + (this.tempo.value / 100) * 4;
    const pulseAmt = Math.sin(this._pulseTimer * pulseRate * Math.PI * 2) * 0.04;
    const fill = Math.min(BAR_W, ((this.tempo.value / 100) + pulseAmt) * BAR_W);

    ctx.fillStyle = this.tempo.barColor();
    ctx.fillRect(bx, by, fill, BAR_H);

    // Glow at high tempo
    if (this.tempo.value >= 70) {
      const glowAlpha = 0.15 + Math.sin(this._pulseTimer * 6) * 0.08;
      ctx.fillStyle = `rgba(255,${this.tempo.value >= 90 ? '50' : '150'},0,${glowAlpha})`;
      ctx.fillRect(bx, by, fill, BAR_H);
    }

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

  _drawRelics(ctx) {
    if (!this.itemManager || !this.itemManager.equipped.length) return;
    const y = 68;
    ctx.fillStyle = '#888';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('RELICS', 18, y);

    const { ItemDefinitions } = require_itemDefs();
    for (let i = 0; i < this.itemManager.equipped.length; i++) {
      const id = this.itemManager.equipped[i];
      const def = ItemDefinitions[id];
      if (!def) continue;
      const rx = 18 + i * 22;
      const ry = y + 4;
      ctx.fillStyle = def.color || '#aaa';
      ctx.fillRect(rx, ry, 18, 18);
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx, ry, 18, 18);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(def.name[0], rx + 9, ry + 13);
    }
  }

  _drawMinimap(ctx) {
    if (!this.enemies || !this.player) return;
    const mapSize = 80;
    const mx = this.width - mapSize - 12, my = 12;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(mx, my, mapSize, mapSize);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, mapSize, mapSize);

    const scaleX = mapSize / this.width;
    const scaleY = mapSize / this.height;

    // Player dot
    ctx.fillStyle = '#44ff88';
    ctx.fillRect(mx + this.player.x * scaleX - 2, my + this.player.y * scaleY - 2, 4, 4);

    // Enemy dots
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const size = e.type?.startsWith('boss') ? 4 : 2;
      ctx.fillStyle = e.type?.startsWith('boss') ? '#ff4444' : '#ff8844';
      ctx.fillRect(mx + e.x * scaleX - size/2, my + e.y * scaleY - size/2, size, size);
    }
  }

  // ───────────────────────────────────────────────────────────────
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
        def = this.deckManager.getCardDef(cardId);
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

      if (cardId && def) {
        ctx.fillStyle = canAfford ? (def.color || '#5577aa') : '#333';
        ctx.fillRect(x, y, 3, CARD_H);
      }

      ctx.lineWidth = 2;
      const isActiveSlot = (this.selectedCardSlot === i);
      if (isActiveSlot) {
        ctx.strokeStyle = '#44ff88';
        ctx.lineWidth = 4;
      } else if (this.selectedPrepSlot === i) {
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 4;
      } else {
        ctx.strokeStyle = cardId ? (canAfford ? '#5577aa' : '#334455') : '#222233';
      }
      ctx.stroke();

      ctx.fillStyle = cardId ? 'rgba(68, 68, 85, 0.35)' : '#2a2a35';
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(i + 1, x + CARD_W / 2, y + CARD_H / 2 + 16);

      if (cardId && def) {
        ctx.fillStyle = canAfford ? '#ffffff' : '#666';
        ctx.font = 'bold 15px monospace';
        ctx.fillText(def.name, x + CARD_W / 2, y + 28);

        ctx.fillStyle = canAfford ? '#44aaff' : '#224466';
        ctx.beginPath();
        ctx.arc(x + 22, y + 22, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(def.cost, x + 22, y + 26);

        ctx.fillStyle = def.tempoShift > 0 ? (canAfford ? '#ffaa66' : '#775533') : (canAfford ? '#66ccff' : '#336688');
        ctx.font = '11px monospace';
        ctx.fillText((def.tempoShift > 0 ? '+' : '') + def.tempoShift + ' T', x + CARD_W / 2, y + 55);

        ctx.fillStyle = canAfford ? '#888' : '#444';
        ctx.font = '10px monospace';
        ctx.fillText(`${def.range}px range`, x + CARD_W / 2, y + 70);

        ctx.fillStyle = def.color || '#888';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(def.type.toUpperCase(), x + CARD_W / 2, y + 85);

        ctx.fillStyle = canAfford ? '#999' : '#444';
        ctx.font = '11px monospace';
        this._wrapText(ctx, def.desc, x + 8, y + 120, CARD_W - 16, 13);
      }

      // "ACTIVE" tag on selected card
      if (isActiveSlot && cardId) {
        ctx.fillStyle = '#44ff88';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('▶ ACTIVE', x + CARD_W / 2, y - 6);
      }

      this.handBoxes.push({ x, y, w: CARD_W, h: CARD_H, slotIndex: i });
      ctx.restore();
    }

    // Control hint
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Left-Click: Attack  |  Right-Click: Switch Card', this.width / 2, this.height - 18);
  }

  // ───────────── PREP SCREEN ─────────────
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

    this._drawHand(ctx);

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
      const def = this.deckManager.getCardDef(cardId);
      if (!def) continue;

      const equippedSlot = this.deckManager.hand.indexOf(cardId);
      const isEquipped = equippedSlot >= 0;

      ctx.fillStyle = isEquipped ? '#1a1a2a' : '#111116';
      ctx.fillRect(x, y, CARD_W, CARD_H);

      ctx.fillStyle = def.color || '#5577aa';
      ctx.fillRect(x, y, 3, CARD_H);

      ctx.strokeStyle = isEquipped ? '#ffaa00' : '#5577aa';
      ctx.lineWidth = isEquipped ? 2 : 1;
      ctx.strokeRect(x, y, CARD_W, CARD_H);

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
    if (this.handBoxes) {
      for (const h of this.handBoxes) {
        if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) {
          this.selectedPrepSlot = h.slotIndex;
          return;
        }
      }
    }
    if (!this.prepBoxes) return;
    for (const b of this.prepBoxes) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        this.deckManager.equipCard(this.selectedPrepSlot, b.cardId);
        break;
      }
    }
  }

  // ───────────── ITEM REWARD SCREEN ─────────────
  drawItemReward(ctx, choices, itemDefs) {
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#ffdd44';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CHOOSE A RELIC', this.width / 2, 80);

    const CARD_W = 180, CARD_H = 200, GAP = 24;
    const totalW = choices.length * CARD_W + (choices.length - 1) * GAP;
    const startX = (this.width - totalW) / 2;
    const startY = 120;

    this.itemBoxes = [];

    for (let i = 0; i < choices.length; i++) {
      const x = startX + i * (CARD_W + GAP);
      const y = startY;
      const def = itemDefs[choices[i]];
      if (!def) continue;

      // Background
      ctx.fillStyle = '#151520';
      ctx.fillRect(x, y, CARD_W, CARD_H);
      ctx.fillStyle = def.color || '#aaa';
      ctx.fillRect(x, y, CARD_W, 4);

      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, CARD_W, CARD_H);

      // Icon
      ctx.fillStyle = def.color || '#aaa';
      ctx.beginPath();
      ctx.arc(x + CARD_W / 2, y + 40, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(def.name[0], x + CARD_W / 2, y + 46);

      // Name
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(def.name, x + CARD_W / 2, y + 78);

      // Rarity
      const rarColor = { common: '#aaa', uncommon: '#44ff88', rare: '#ffaa44' };
      ctx.fillStyle = rarColor[def.rarity] || '#aaa';
      ctx.font = '10px monospace';
      ctx.fillText(def.rarity.toUpperCase(), x + CARD_W / 2, y + 95);

      // Description
      ctx.fillStyle = '#ccc';
      ctx.font = '12px monospace';
      this._wrapText(ctx, def.desc, x + 10, y + 120, CARD_W - 20, 15);

      this.itemBoxes.push({ x, y, w: CARD_W, h: CARD_H, itemId: choices[i] });
    }

    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press SPACE to skip', this.width / 2, this.height - 40);
  }

  handleItemClick(mx, my) {
    if (!this.itemBoxes) return null;
    for (const b of this.itemBoxes) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        return b.itemId;
      }
    }
    return null;
  }

  // ───────────── UPGRADE SCREEN ─────────────
  drawUpgradeScreen(ctx, choices) {
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#44aaff';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('UPGRADE A CARD', this.width / 2, 80);
    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.fillText('+50% damage per upgrade (max 2)', this.width / 2, 110);

    const CARD_W = 160, CARD_H = 120, GAP = 16;
    const totalW = choices.length * CARD_W + (choices.length - 1) * GAP;
    const startX = (this.width - totalW) / 2;
    const startY = 140;

    this.upgradeBoxes = [];

    for (let i = 0; i < choices.length; i++) {
      const x = startX + i * (CARD_W + GAP);
      const y = startY;
      const cardId = choices[i];
      const def = this.deckManager.getCardDef(cardId);
      if (!def) continue;

      const level = this.deckManager.upgrades[cardId] || 0;

      ctx.fillStyle = '#151520';
      ctx.fillRect(x, y, CARD_W, CARD_H);
      ctx.fillStyle = def.color || '#aaa';
      ctx.fillRect(x, y, 3, CARD_H);
      ctx.strokeStyle = '#5577aa';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, CARD_W, CARD_H);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(def.name, x + CARD_W / 2, y + 28);

      ctx.fillStyle = '#ffaa44';
      ctx.font = '11px monospace';
      ctx.fillText(`Level ${level} → ${level + 1}`, x + CARD_W / 2, y + 48);

      const nextDmg = Math.round(this.cardDefs[cardId].damage * (1 + 0.5 * (level + 1)));
      ctx.fillStyle = '#44ff88';
      ctx.font = '12px monospace';
      ctx.fillText(`${def.damage} DMG → ${nextDmg} DMG`, x + CARD_W / 2, y + 70);

      ctx.fillStyle = '#888';
      ctx.font = '10px monospace';
      ctx.fillText(`${def.cost} AP | ${def.range}px`, x + CARD_W / 2, y + 90);

      this.upgradeBoxes = this.upgradeBoxes || [];
      this.upgradeBoxes.push({ x, y, w: CARD_W, h: CARD_H, cardId });
    }

    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press SPACE to skip', this.width / 2, this.height - 40);
  }

  handleUpgradeClick(mx, my) {
    if (!this.upgradeBoxes) return null;
    for (const b of this.upgradeBoxes) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        return b.cardId;
      }
    }
    return null;
  }

  // ───────────── EVENT SCREEN ─────────────
  drawEventScreen(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#ff88ff';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('STRANGE ENCOUNTER', this.width / 2, 80);

    ctx.fillStyle = '#ccc';
    ctx.font = '16px monospace';
    ctx.fillText('A mysterious figure offers you a deal...', this.width / 2, 140);

    const options = [
      { label: 'Trade 1 HP → Random Relic', key: '1', color: '#ff6666' },
      { label: 'Rest: Heal 2 HP', key: '2', color: '#44ff88' },
      { label: 'Gamble: 50% chance +2 HP or -1 HP', key: '3', color: '#ffaa44' },
    ];

    this.eventBoxes = [];
    for (let i = 0; i < options.length; i++) {
      const y = 200 + i * 70;
      const opt = options[i];

      ctx.fillStyle = '#151520';
      ctx.fillRect(this.width / 2 - 220, y, 440, 55);
      ctx.strokeStyle = opt.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(this.width / 2 - 220, y, 440, 55);

      ctx.fillStyle = opt.color;
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`[${opt.key}] ${opt.label}`, this.width / 2, y + 35);

      this.eventBoxes.push({ x: this.width / 2 - 220, y, w: 440, h: 55, index: i });
    }
  }

  handleEventClick(mx, my) {
    if (!this.eventBoxes) return -1;
    for (const b of this.eventBoxes) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        return b.index;
      }
    }
    return -1;
  }

  // ───────────── SHOP SCREEN ─────────────
  drawShopScreen(ctx, shopCards, cardDefs) {
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#44aaff';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CARD SHOP', this.width / 2, 60);
    ctx.fillStyle = '#aaa';
    ctx.font = '14px monospace';
    ctx.fillText('Cost: 1 HP per card. Click to buy.', this.width / 2, 90);

    const CARD_W = 150, CARD_H = 160, GAP = 20;
    const totalW = shopCards.length * CARD_W + (shopCards.length - 1) * GAP;
    const startX = (this.width - totalW) / 2;
    const startY = 120;

    this.shopBoxes = [];

    for (let i = 0; i < shopCards.length; i++) {
      const x = startX + i * (CARD_W + GAP);
      const y = startY;
      const def = cardDefs[shopCards[i]];
      if (!def) continue;

      ctx.fillStyle = '#151520';
      ctx.fillRect(x, y, CARD_W, CARD_H);
      ctx.fillStyle = def.color || '#aaa';
      ctx.fillRect(x, y, CARD_W, 3);
      ctx.strokeStyle = '#5577aa';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, CARD_W, CARD_H);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(def.name, x + CARD_W / 2, y + 28);

      ctx.fillStyle = '#ff6666';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('1 HP', x + CARD_W / 2, y + 50);

      ctx.fillStyle = '#44aaff';
      ctx.font = '11px monospace';
      ctx.fillText(`${def.cost} AP | ${def.range}px`, x + CARD_W / 2, y + 68);

      ctx.fillStyle = '#aaa';
      ctx.font = '10px monospace';
      this._wrapText(ctx, def.desc, x + 8, y + 90, CARD_W - 16, 12);

      this.shopBoxes.push({ x, y, w: CARD_W, h: CARD_H, cardId: shopCards[i] });
    }

    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press ENTER to leave', this.width / 2, this.height - 40);
  }

  handleShopClick(mx, my) {
    if (!this.shopBoxes) return null;
    for (const b of this.shopBoxes) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        return b.cardId;
      }
    }
    return null;
  }

  // ───────────── STATS SCREEN ─────────────
  drawStatsScreen(ctx, stats, score, leaderboard) {
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = stats.won ? '#44ff88' : '#ff4444';
    ctx.font = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(stats.won ? 'VICTORY!' : 'DEFEATED', this.width / 2, 70);

    ctx.fillStyle = '#ffdd44';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(`SCORE: ${score}`, this.width / 2, 115);

    const lines = [
      ['Kills', stats.kills || 0],
      ['Rooms Cleared', stats.roomsCleared || 0],
      ['Floor', stats.floor || 1],
      ['Cards Played', stats.cardsPlayed || 0],
      ['Perfect Dodges', stats.perfectDodges || 0],
      ['Manual Crashes', stats.manualCrashes || 0],
      ['Items Collected', stats.itemsCollected || 0],
      ['Time', `${Math.floor(stats.elapsedTime || 0)}s`],
    ];

    const startY = 155;
    for (let i = 0; i < lines.length; i++) {
      const y = startY + i * 24;
      ctx.fillStyle = '#888';
      ctx.font = '14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(lines[i][0], this.width / 2 - 120, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.fillText(String(lines[i][1]), this.width / 2 + 120, y);
    }

    // Leaderboard
    if (leaderboard && leaderboard.length > 0) {
      const lbY = startY + lines.length * 24 + 30;
      ctx.fillStyle = '#ffaa44';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LEADERBOARD', this.width / 2, lbY);

      for (let i = 0; i < Math.min(5, leaderboard.length); i++) {
        const entry = leaderboard[i];
        const y = lbY + 28 + i * 20;
        ctx.fillStyle = i === 0 ? '#ffdd44' : '#aaa';
        ctx.font = '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${i + 1}. ${entry.character || '?'} — ${entry.score} pts (Floor ${entry.floor || '?'})`, this.width / 2, y);
      }
    }

    ctx.fillStyle = '#888';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press ENTER to continue', this.width / 2, this.height - 40);
  }

  // ───────────────────────────────────────────────────────────────
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

// Helper to avoid circular import — itemDefs are passed in at runtime
function require_itemDefs() {
  return { ItemDefinitions: window._itemDefs || {} };
}
