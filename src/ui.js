import { CardDefinitions } from './DeckManager.js';

// ── Color Palette ────────────────────────────────────────────────
export const PAL = {
  COLD:       '#4a9eff',
  FLOWING:    '#44dd88',
  HOT:        '#ff8833',
  CRITICAL:   '#ff3333',
  UI_BG:      '#0d0d14',
  UI_PANEL:   '#1a1a2e',
  UI_BORDER:  '#2a2a4a',
  TEXT:       '#e8e8f0',
  MUTED:      '#8888aa',
  GOLD:       '#ffd700',
  RARE:       '#bb44ff',
  UNCOMMON:   '#44dd88',
  COMMON:     '#aaaacc',
  ELITE:      '#ff6644',
};

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
    this._bossEnemy = null;
    this._hoveredCard = -1;
    this._mouseX = 0;
    this._mouseY = 0;
    // Inventory overlay (map screen)
    this.showInventory = false;
    // Prep screen: card selected from collection waiting to be slotted
    this.prepPendingCard = null;
    // New unlocks to show on stats screen
    this.newUnlocks = [];
  }

  setItemManager(im) { this.itemManager = im; }
  setEnemies(enemies) { this.enemies = enemies; }
  setRunStats(stats) { this.runStats = stats; }
  setMouse(x, y) { this._mouseX = x; this._mouseY = y; }

  update(dt) {
    this._pulseTimer += dt;
    // Find boss if present
    this._bossEnemy = null;
    if (this.enemies) {
      for (const e of this.enemies) {
        if (e.alive && e.type && e.type.startsWith('boss')) { this._bossEnemy = e; break; }
      }
    }
  }

  draw(ctx) {
    this._drawZoneVignette(ctx);
    if (this._bossEnemy) this._drawBossBar(ctx);
    this._drawHP(ctx);
    this._drawBudget(ctx);
    if (this.itemManager) this._drawRelics(ctx);
    if (this.enemies) this._drawMinimap(ctx);
    if (this.deckManager && this.cardDefs) this._drawHand(ctx);
    this._drawTempoBar(ctx);
  }

  // ── Zone vignette — subtle colored border tint based on tempo state
  _drawZoneVignette(ctx) {
    const v = this.tempo.value;
    if (v < 30 || v >= 70) {
      let col, alpha;
      if (v < 30) { col = PAL.COLD; alpha = 0.06 + (30 - v) / 30 * 0.08; }
      else if (v < 90) { col = PAL.HOT; alpha = 0.05 + (v - 70) / 20 * 0.08; }
      else { col = PAL.CRITICAL; alpha = 0.08 + Math.sin(this._pulseTimer * 5) * 0.04; }
      const grad = ctx.createRadialGradient(this.width/2, this.height/2, this.height * 0.25, this.width/2, this.height/2, this.height * 0.85);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, col + Math.round(alpha * 255).toString(16).padStart(2,'0'));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  // ── Tempo bar — center screen, above the card hand
  _drawTempoBar(ctx) {
    const CARD_H = 180;
    const BAR_W = Math.min(580, this.width - 100);
    const BAR_H = 22;
    const bx = (this.width - BAR_W) / 2;
    // Position above the card hand with breathing room
    const by = this.height - CARD_H - 22 - BAR_H - 28; // sits above card area

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(bx - 4, by - 22, BAR_W + 8, BAR_H + 30);

    // Zone colored gradient fill bar
    const fill = Math.min(BAR_W, (this.tempo.value / 100) * BAR_W);
    const grad = ctx.createLinearGradient(bx, by, bx + BAR_W, by);
    grad.addColorStop(0,    PAL.COLD);
    grad.addColorStop(0.30, PAL.COLD);
    grad.addColorStop(0.31, PAL.FLOWING);
    grad.addColorStop(0.70, PAL.FLOWING);
    grad.addColorStop(0.71, PAL.HOT);
    grad.addColorStop(0.90, PAL.HOT);
    grad.addColorStop(0.91, PAL.CRITICAL);
    grad.addColorStop(1.0,  PAL.CRITICAL);

    // Dark track
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(bx, by, BAR_W, BAR_H);

    // Fill with clipping
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, fill, BAR_H);
    ctx.clip();
    ctx.fillStyle = grad;
    ctx.fillRect(bx, by, BAR_W, BAR_H);

    // Glow overlay at High tempo
    if (this.tempo.value >= 70) {
      const glowA = 0.12 + Math.sin(this._pulseTimer * 5) * 0.07;
      ctx.fillStyle = `rgba(255,100,0,${glowA})`;
      ctx.fillRect(bx, by, fill, BAR_H);
    }
    ctx.restore();

    // Zone divider ticks + labels
    const zones = [
      { pct: 0.30, label: 'COLD' },
      { pct: 0.70, label: 'FLOWING' },
      { pct: 0.90, label: 'HOT' },
    ];
    ctx.fillStyle = PAL.MUTED;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    for (const z of zones) {
      const tx = bx + BAR_W * z.pct;
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, by - 4); ctx.lineTo(tx, by + BAR_H + 4); ctx.stroke();
      ctx.fillStyle = PAL.MUTED;
      ctx.fillText(z.label, tx, by - 6);
    }
    // CRIT label at far right
    ctx.fillText('CRIT', bx + BAR_W * 0.955, by - 6);

    // Bar border
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, BAR_W, BAR_H);

    // Needle (triangle pointer) — vibrates at Critical
    const isCritical = this.tempo.value >= 90;
    const needleJitter = isCritical ? Math.sin(this._pulseTimer * 28) * 2.5 : 0;
    const needleX = bx + fill + needleJitter;
    ctx.fillStyle = isCritical ? PAL.CRITICAL : '#ffffff';
    ctx.beginPath();
    ctx.moveTo(needleX, by - 5);
    ctx.lineTo(needleX - 5, by - 14);
    ctx.lineTo(needleX + 5, by - 14);
    ctx.closePath();
    ctx.fill();

    // Value number
    const zoneColor = this.tempo.stateColor();
    ctx.fillStyle = zoneColor;
    ctx.font = `bold ${isCritical ? 14 : 13}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(this.tempo.value)}`, needleX, by - 16);

    // Zone name + multipliers
    const dmgMult = this.tempo.damageMultiplier();
    const spdMult = this.tempo.speedMultiplier();
    ctx.fillStyle = zoneColor;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.tempo.stateName(), this.width / 2, by + BAR_H + 16);

    ctx.fillStyle = dmgMult >= 1.3 ? PAL.HOT : (dmgMult < 1.0 ? PAL.COLD : PAL.MUTED);
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`DMG ×${dmgMult.toFixed(1)}`, bx, by + BAR_H + 16);

    ctx.fillStyle = spdMult >= 1.2 ? PAL.FLOWING : (spdMult < 1.0 ? PAL.COLD : PAL.MUTED);
    ctx.textAlign = 'right';
    ctx.fillText(`SPD ×${spdMult.toFixed(1)}`, bx + BAR_W, by + BAR_H + 16);
  }

  // ── HP — top left, bigger segments with color shift
  _drawHP(ctx) {
    if (!this.player) return;
    const hp = this.player.hp, maxHp = this.player.maxHp;
    const segW = Math.min(20, Math.floor((this.width * 0.2) / maxHp));
    const segH = 18, segGap = 3;
    const startX = 18, y = 18;

    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = PAL.MUTED;
    ctx.fillText('HP', startX, y + segH - 3);

    for (let i = 0; i < maxHp; i++) {
      const sx = startX + 30 + i * (segW + segGap);
      const pct = i < hp ? 1 : 0;
      ctx.fillStyle = pct > 0 ? (hp / maxHp > 0.5 ? '#ee4444' : (hp / maxHp > 0.25 ? '#ff8800' : '#ff2200')) : '#222';
      ctx.fillRect(sx, y, segW, segH);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, y, segW, segH);
    }
  }

  // ── AP bar — top left below HP
  _drawBudget(ctx) {
    if (!this.player) return;
    const b = this.player.budget, mb = this.player.maxBudget;
    const segW = 18, segH = 14, segGap = 3;
    const startX = 18, y = 44;

    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4488ff';
    ctx.fillText('AP', startX, y + segH - 2);

    for (let i = 0; i < mb; i++) {
      const sx = startX + 30 + i * (segW + segGap);
      ctx.fillStyle = i < Math.floor(b) ? '#44aaff' : '#1a2a44';
      ctx.fillRect(sx, y, segW, segH);
      ctx.strokeStyle = '#223355';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, y, segW, segH);
    }
    // Partial fill
    if (b < mb) {
      const partial = b % 1;
      const idx = Math.floor(b);
      const sx = startX + 30 + idx * (segW + segGap);
      ctx.fillStyle = 'rgba(68,170,255,0.45)';
      ctx.fillRect(sx, y + segH * (1 - partial), segW, segH * partial);
    }

    // AP number
    ctx.fillStyle = PAL.MUTED;
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${b.toFixed(1)}/${mb}`, startX + 30 + mb * (segW + segGap) + 4, y + segH - 2);
  }

  // ── Relics — top left below AP
  _drawRelics(ctx) {
    if (!this.itemManager || !this.itemManager.equipped.length) return;
    const y = 68;
    const startX = 18;
    ctx.fillStyle = PAL.MUTED;
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('RELICS', startX, y - 2);

    const { ItemDefinitions } = require_itemDefs();
    for (let i = 0; i < this.itemManager.equipped.length; i++) {
      const id = this.itemManager.equipped[i];
      const def = ItemDefinitions[id];
      if (!def) continue;
      const rx = startX + i * 26;
      const ry = y + 2;
      const rarCol = def.rarity === 'rare' ? PAL.RARE : (def.rarity === 'uncommon' ? PAL.UNCOMMON : PAL.COMMON);
      ctx.fillStyle = PAL.UI_PANEL;
      ctx.fillRect(rx, ry, 22, 22);
      ctx.strokeStyle = rarCol;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rx, ry, 22, 22);
      ctx.fillStyle = def.color || '#aaa';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(def.name[0].toUpperCase(), rx + 11, ry + 15);
    }
  }

  // ── Minimap — top right, better scaled
  _drawMinimap(ctx) {
    if (!this.enemies || !this.player) return;
    const mapSize = 90;
    const mx = this.width - mapSize - 12, my = 12;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(mx, my, mapSize, mapSize);
    ctx.strokeStyle = PAL.UI_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(mx, my, mapSize, mapSize);

    // Use room bounds instead of canvas size for scale
    const roomW = window.CANVAS_W || this.width;
    const roomH = window.CANVAS_H || this.height;
    const scaleX = (mapSize - 4) / roomW;
    const scaleY = (mapSize - 4) / roomH;
    const ox = mx + 2, oy = my + 2;

    // Player dot
    ctx.fillStyle = PAL.FLOWING;
    const px = ox + this.player.x * scaleX;
    const py = oy + this.player.y * scaleY;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();

    // Enemy dots
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const isBoss = e.type?.startsWith('boss');
      ctx.fillStyle = isBoss ? PAL.CRITICAL : PAL.HOT;
      const ex = ox + e.x * scaleX, ey = oy + e.y * scaleY;
      if (isBoss) {
        ctx.fillRect(ex - 3, ey - 3, 6, 6);
      } else {
        ctx.fillRect(ex - 1.5, ey - 1.5, 3, 3);
      }
    }
    ctx.fillStyle = PAL.MUTED;
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MAP', mx + mapSize / 2, my + mapSize + 10);
  }

  // ── Boss health bar — top center, full-width
  _drawBossBar(ctx) {
    const e = this._bossEnemy;
    if (!e || !e.alive) return;
    const BAR_W = Math.min(600, this.width - 200);
    const BAR_H = 18;
    const bx = (this.width - BAR_W) / 2;
    const by = 10;
    const pct = Math.max(0, e.hp / e.maxHp);

    // Background panel
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(bx - 8, by - 6, BAR_W + 16, BAR_H + 20);

    // Bar track
    ctx.fillStyle = '#1a0008';
    ctx.fillRect(bx, by, BAR_W, BAR_H);

    // Fill
    const bossCol = pct > 0.5 ? '#cc2222' : (pct > 0.25 ? '#ff5500' : '#ff0000');
    ctx.fillStyle = bossCol;
    ctx.fillRect(bx, by, BAR_W * pct, BAR_H);

    // Glow
    const glowA = 0.1 + Math.sin(this._pulseTimer * 4) * 0.05;
    ctx.fillStyle = `rgba(255,50,50,${glowA})`;
    ctx.fillRect(bx, by, BAR_W * pct, BAR_H);

    ctx.strokeStyle = 'rgba(255,100,100,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, BAR_W, BAR_H);

    // Phase markers at 66% and 33%
    ctx.strokeStyle = 'rgba(255,220,220,0.55)';
    ctx.lineWidth = 1.5;
    for (const phasePct of [0.66, 0.33]) {
      const tx = bx + BAR_W * phasePct;
      ctx.beginPath(); ctx.moveTo(tx, by - 3); ctx.lineTo(tx, by + BAR_H + 3); ctx.stroke();
    }

    // Boss name
    const bossNames = { boss_brawler: 'THE BRAWLER', boss_conductor: 'THE CONDUCTOR', boss_echo: 'THE ECHO', boss_necromancer: 'THE NECROMANCER', boss_apex: 'THE APEX' };
    ctx.fillStyle = '#ff6666';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(bossNames[e.type] || 'BOSS', this.width / 2, by + BAR_H + 12);

    // HP numbers
    ctx.fillStyle = PAL.MUTED;
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${e.hp} / ${e.maxHp}`, bx + BAR_W, by - 2);
  }

  // ── Card hand — bottom center with hover lift
  _drawHand(ctx) {
    const hand = this.deckManager.hand;
    const CARD_W = 155, CARD_H = 192, GAP = 10, RADIUS = 10;
    const totalW = this.deckManager.HAND_SIZE * CARD_W + (this.deckManager.HAND_SIZE - 1) * GAP;
    const startX = (this.width - totalW) / 2;
    const baseY = this.height - CARD_H - 22;

    this.handBoxes = [];
    this._hoveredCard = -1;

    for (let i = 0; i < 4; i++) {
      const cardId = hand[i];
      // Skip wide sentinels — they're drawn by the parent slot
      if (cardId === '__wide') continue;

      let def = null;
      let canAfford = false;
      const sw = cardId ? ((CardDefinitions[cardId] && CardDefinitions[cardId].slotWidth) || 1) : 1;
      const cardDrawW = sw * CARD_W + (sw - 1) * GAP;

      if (cardId) {
        def = this.deckManager.getCardDef(cardId);
        canAfford = this.player && this.player.budget >= def.cost;
      }

      const x = startX + i * (CARD_W + GAP);

      // Hover lift — card rises 18px when mouse is over it
      const mx = this._mouseX, my = this._mouseY;
      const isHovered = mx >= x && mx <= x + cardDrawW && my >= baseY - 20 && my <= baseY + CARD_H;
      if (isHovered) this._hoveredCard = i;
      const y = baseY - (isHovered ? 18 : 0);

      ctx.save();

      // Card background — no shadow to avoid bleed-through on text
      let grad = ctx.createLinearGradient(x, y, x, y + CARD_H);
      if (cardId && canAfford) {
        grad.addColorStop(0, 'rgba(36, 40, 58, 0.95)');
        grad.addColorStop(1, 'rgba(20, 20, 36, 0.95)');
      } else {
        grad.addColorStop(0, 'rgba(16, 16, 22, 0.90)');
        grad.addColorStop(1, 'rgba(10, 10, 14, 0.90)');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, cardDrawW, CARD_H, RADIUS);
      ctx.fill();

      const isActive = this.selectedCardSlot === i;

      // Active card: solid coloured top bar instead of glow overlay
      if (isActive) {
        ctx.fillStyle = '#44ff88';
        ctx.fillRect(x, y, cardDrawW, 4);
      }

      // Left color stripe + rarity indicator
      if (cardId && def) {
        ctx.fillStyle = canAfford ? (def.color || '#5577aa') : '#333';
        ctx.fillRect(x, y + (isActive ? 4 : 0), 3, CARD_H - (isActive ? 4 : 0));
        // Rarity pip at bottom-left corner
        const rarCol = def.rarity === 'rare' ? PAL.RARE : (def.rarity === 'uncommon' ? PAL.UNCOMMON : null);
        if (rarCol && canAfford) {
          ctx.fillStyle = rarCol;
          ctx.beginPath();
          ctx.arc(x + 10, y + CARD_H - 10, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Prep screen: highlight slot that will be replaced if pending card is picked
      const isPendingTarget = this.prepPendingCard && (
        (this.deckManager.hand[i] && this.deckManager.hand[i] !== '__wide') ||
        !this.deckManager.hand[i]
      );

      // Border — plain stroke, no shadow
      if (isActive && !this.prepPendingCard) {
        ctx.strokeStyle = '#44ff88';
        ctx.lineWidth = 3;
      } else if (isPendingTarget && isHovered) {
        ctx.strokeStyle = '#ffdd44';
        ctx.lineWidth = 3;
      } else if (isPendingTarget) {
        ctx.strokeStyle = 'rgba(255,220,68,0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
      } else if (isHovered && cardId && canAfford) {
        ctx.strokeStyle = def?.color || '#5577aa';
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = cardId ? (canAfford ? '#3a4466' : '#222233') : '#1a1a2a';
        ctx.lineWidth = 1.5;
      }
      ctx.beginPath();
      ctx.roundRect(x, y, cardDrawW, CARD_H, RADIUS);
      ctx.stroke();
      ctx.setLineDash([]);

      // Wide card indicator
      if (sw > 1) {
        ctx.fillStyle = 'rgba(255,200,0,0.12)';
        ctx.fillRect(x + CARD_W + 1, y + 2, (sw - 1) * (CARD_W + GAP) - GAP - 1, CARD_H - 4);
      }

      // Slot number
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`[${i + 1}]`, x + CARD_W - 8, y + 16);

      if (cardId && def) {
        // Card name — larger, clearer
        ctx.fillStyle = canAfford ? '#ffffff' : '#666';
        ctx.font = `bold 16px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(def.name, x + CARD_W / 2, y + 32);

        // Divider line under name
        ctx.strokeStyle = (def.color || '#5577aa') + (canAfford ? 'aa' : '44');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 10, y + 38); ctx.lineTo(x + CARD_W - 10, y + 38); ctx.stroke();

        // AP cost badge
        const costCol = canAfford ? '#44aaff' : '#223355';
        ctx.fillStyle = costCol;
        ctx.beginPath();
        ctx.arc(x + 16, y + 16, 13, 0, Math.PI * 2);
        ctx.fill();
        if (canAfford) {
          ctx.strokeStyle = '#88ddff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(def.cost, x + 16, y + 21);

        // Tempo shift — prominent
        const tsCol = def.tempoShift > 0 ? (canAfford ? PAL.HOT : '#553322') : (canAfford ? PAL.COLD : '#223344');
        ctx.fillStyle = tsCol;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText((def.tempoShift > 0 ? '+' : '') + def.tempoShift + ' Tempo', x + CARD_W / 2, y + 55);

        // Type badge
        ctx.fillStyle = canAfford ? (def.color || PAL.MUTED) : '#444';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(def.type.toUpperCase(), x + CARD_W / 2, y + 70);

        // Range
        ctx.fillStyle = canAfford ? '#888' : '#444';
        ctx.font = '11px monospace';
        ctx.fillText(`${def.range}px range`, x + CARD_W / 2, y + 84);

        // Description — larger font, more line height
        ctx.fillStyle = canAfford ? '#cccccc' : '#555';
        ctx.font = '12px monospace';
        this._wrapText(ctx, def.desc, x + 8, y + 108, CARD_W - 16, 15);
      }

      // Active indicator — small pill above card, no glow
      if (isActive && cardId) {
        ctx.fillStyle = '#44ff88';
        ctx.fillRect(x + CARD_W / 2 - 28, y - 18, 56, 14);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ACTIVE', x + CARD_W / 2, y - 8);
      }

      // Unavailable dimming
      if (cardId && !canAfford) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.roundRect(x, y, CARD_W, CARD_H, RADIUS);
        ctx.fill();
      }

      this.handBoxes.push({ x, y: baseY, w: cardDrawW, h: CARD_H + 20, slotIndex: i });
      ctx.restore();
    }

    // Control hint
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Left-Click: Attack  |  Right-Click / 1-4: Switch Card  |  F: CRASH (85+ Tempo)', this.width / 2, this.height - 4);
  }

  // ───────────── PREP SCREEN ─────────────
  drawPrepScreen(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#44aaff';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EQUIP LOADOUT', this.width / 2, 55);

    if (this.prepPendingCard) {
      const pDef = this.deckManager.getCardDef(this.prepPendingCard);
      ctx.fillStyle = '#ffdd44';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`Selected: ${pDef?.name || this.prepPendingCard} — click a slot to equip it  (or click again to cancel)`, this.width / 2, 85);
    } else {
      ctx.fillStyle = PAL.MUTED;
      ctx.font = '13px monospace';
      ctx.fillText('Click a card from your collection, then click a hand SLOT to assign it.', this.width / 2, 85);
    }
    ctx.fillStyle = PAL.GOLD;
    ctx.font = 'bold 15px monospace';
    ctx.fillText('Press ENTER to fight!', this.width / 2, 110);

    this._drawHand(ctx);

    const GAP = 10;
    const CARD_W = 110, CARD_H = 140;
    const COLS = Math.floor((this.width - 80) / (CARD_W + GAP));
    const totalW = COLS * (CARD_W + GAP) - GAP;
    const startX = (this.width - totalW) / 2;
    const startY = 145;

    this.prepBoxes = [];
    const collection = this.deckManager.collection;
    for (let i = 0; i < collection.length; i++) {
      const x = startX + (i % COLS) * (CARD_W + GAP);
      const y = startY + Math.floor(i / COLS) * (CARD_H + GAP);
      const cardId = collection[i];
      const def = this.deckManager.getCardDef(cardId);
      if (!def) continue;
      const equippedSlot = this.deckManager.hand.indexOf(cardId);
      const isEquipped = equippedSlot >= 0;

      const isPending = this.prepPendingCard === cardId;
      const rarCol = def.rarity === 'rare' ? PAL.RARE : (def.rarity === 'uncommon' ? PAL.UNCOMMON : PAL.COMMON);
      ctx.fillStyle = isPending ? '#1a2a1a' : (isEquipped ? '#1a1a2a' : PAL.UI_BG);
      ctx.fillRect(x, y, CARD_W, CARD_H);
      // Rarity top bar
      ctx.fillStyle = rarCol + '55';
      ctx.fillRect(x, y, CARD_W, 3);
      ctx.fillStyle = def.color || '#5577aa';
      ctx.fillRect(x, y + 3, 3, CARD_H - 3);
      ctx.strokeStyle = isPending ? '#ffdd44' : (isEquipped ? PAL.GOLD : rarCol + '88');
      ctx.lineWidth = isPending ? 3 : (isEquipped ? 2 : 1);
      ctx.strokeRect(x, y, CARD_W, CARD_H);

      if (isEquipped) {
        ctx.fillStyle = PAL.GOLD;
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`SLOT ${equippedSlot + 1}`, x + CARD_W - 4, y + 12);
      }
      ctx.textAlign = 'center';
      ctx.fillStyle = PAL.TEXT;
      ctx.font = 'bold 12px monospace';
      ctx.fillText(def.name, x + CARD_W / 2, y + 22);
      ctx.fillStyle = rarCol;
      ctx.font = '8px monospace';
      ctx.fillText((def.rarity || 'common').toUpperCase(), x + CARD_W / 2, y + 33);
      ctx.fillStyle = '#44aaff';
      ctx.font = '11px monospace';
      ctx.fillText(`${def.cost} AP | ${def.range}px`, x + CARD_W / 2, y + 44);
      ctx.fillStyle = def.tempoShift > 0 ? PAL.HOT : PAL.COLD;
      ctx.font = '10px monospace';
      ctx.fillText((def.tempoShift > 0 ? '+' : '') + def.tempoShift + ' Tempo', x + CARD_W / 2, y + 58);
      ctx.fillStyle = def.color || '#888';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(def.type.toUpperCase(), x + CARD_W / 2, y + 72);
      ctx.fillStyle = PAL.MUTED;
      ctx.font = '9px monospace';
      this._wrapText(ctx, def.desc, x + 5, y + 88, CARD_W - 10, 11);
      this.prepBoxes.push({ x, y, w: CARD_W, h: CARD_H, cardId });
    }

    // Tooltip: show enlarged card preview on hover
    const mx = this._mouseX, my = this._mouseY;
    for (const b of this.prepBoxes) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        this._drawCardTooltip(ctx, b.cardId, mx, my);
        break;
      }
    }
  }

  _drawCardTooltip(ctx, cardId, mx, my) {
    const def = this.deckManager.getCardDef(cardId);
    if (!def) return;
    const TW = 200, TH = 200;
    let tx = mx + 16;
    let ty = my - TH / 2;
    if (tx + TW > this.width - 10) tx = mx - TW - 16;
    if (ty < 10) ty = 10;
    if (ty + TH > this.height - 10) ty = this.height - TH - 10;

    const rarCol = def.rarity === 'rare' ? PAL.RARE : (def.rarity === 'uncommon' ? PAL.UNCOMMON : PAL.COMMON);

    ctx.save();
    ctx.fillStyle = '#0d0d18';
    ctx.beginPath();
    ctx.roundRect(tx, ty, TW, TH, 10);
    ctx.fill();
    ctx.strokeStyle = rarCol;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = rarCol;
    ctx.fillRect(tx, ty, TW, 3);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(def.name, tx + TW / 2, ty + 22);

    ctx.strokeStyle = (def.color || '#5577aa') + '88';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tx + 10, ty + 28); ctx.lineTo(tx + TW - 10, ty + 28); ctx.stroke();

    ctx.fillStyle = '#44aaff';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`${def.cost} AP`, tx + TW / 2, ty + 46);

    ctx.fillStyle = def.tempoShift > 0 ? PAL.HOT : PAL.COLD;
    ctx.font = '11px monospace';
    ctx.fillText((def.tempoShift > 0 ? '+' : '') + def.tempoShift + ' Tempo', tx + TW / 2, ty + 62);

    if (def.damage > 0) {
      ctx.fillStyle = '#ff9988';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`${def.damage} DMG  |  ${def.range}px`, tx + TW / 2, ty + 82);
    }

    ctx.fillStyle = rarCol;
    ctx.font = 'bold 9px monospace';
    ctx.fillText((def.rarity || 'common').toUpperCase() + ' · ' + def.type.toUpperCase(), tx + TW / 2, ty + 98);

    ctx.fillStyle = '#ccccdd';
    ctx.font = '10px monospace';
    this._wrapText(ctx, def.desc, tx + 10, ty + 118, TW - 20, 14);

    ctx.restore();
  }

  handlePrepClick(mx, my) {
    // If a card is pending, clicking a hand slot equips it
    if (this.prepPendingCard) {
      if (this.handBoxes) {
        for (const h of this.handBoxes) {
          if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) {
            this.deckManager.equipCard(h.slotIndex, this.prepPendingCard);
            this.prepPendingCard = null;
            return;
          }
        }
      }
      // Clicking elsewhere cancels pending
      if (this.prepBoxes) {
        for (const b of this.prepBoxes) {
          if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
            // Clicking same card cancels, clicking different card switches selection
            if (b.cardId === this.prepPendingCard) {
              this.prepPendingCard = null;
            } else {
              this.prepPendingCard = b.cardId;
            }
            return;
          }
        }
      }
      this.prepPendingCard = null;
      return;
    }

    // No pending card: clicking collection card starts selection
    if (this.prepBoxes) {
      for (const b of this.prepBoxes) {
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
          this.prepPendingCard = b.cardId;
          return;
        }
      }
    }
  }

  // ───────────── ITEM REWARD SCREEN ─────────────
  drawItemReward(ctx, choices, itemDefs) {
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = PAL.GOLD;
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CHOOSE A RELIC', this.width / 2, 75);

    const CARD_W = 190, CARD_H = 220, GAP = 28;
    const totalW = choices.length * CARD_W + (choices.length - 1) * GAP;
    const startX = (this.width - totalW) / 2;
    const startY = 110;
    this.itemBoxes = [];

    for (let i = 0; i < choices.length; i++) {
      const x = startX + i * (CARD_W + GAP), y = startY;
      const def = itemDefs[choices[i]];
      if (!def) continue;
      const rarCol = def.rarity === 'rare' ? PAL.RARE : (def.rarity === 'uncommon' ? PAL.UNCOMMON : PAL.COMMON);

      ctx.fillStyle = PAL.UI_PANEL;
      ctx.beginPath();
      ctx.roundRect(x, y, CARD_W, CARD_H, 12);
      ctx.fill();
      ctx.fillStyle = def.color || '#aaa';
      ctx.fillRect(x, y, CARD_W, 4);
      ctx.strokeStyle = rarCol;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, CARD_W, CARD_H, 12);
      ctx.stroke();

      // Icon circle
      ctx.save();
      ctx.shadowColor = def.color || '#aaa';
      ctx.shadowBlur = 15;
      ctx.fillStyle = def.color || '#aaa';
      ctx.beginPath();
      ctx.arc(x + CARD_W / 2, y + 46, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(def.name[0], x + CARD_W / 2, y + 54);

      ctx.fillStyle = PAL.TEXT;
      ctx.font = 'bold 16px monospace';
      ctx.fillText(def.name, x + CARD_W / 2, y + 85);

      ctx.fillStyle = rarCol;
      ctx.font = 'bold 11px monospace';
      ctx.fillText(def.rarity.toUpperCase(), x + CARD_W / 2, y + 103);

      ctx.fillStyle = '#ccc';
      ctx.font = '12px monospace';
      this._wrapText(ctx, def.desc, x + 12, y + 128, CARD_W - 24, 16);

      this.itemBoxes.push({ x, y, w: CARD_W, h: CARD_H, itemId: choices[i] });
    }

    ctx.fillStyle = PAL.MUTED;
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press SPACE to skip', this.width / 2, this.height - 36);
  }

  handleItemClick(mx, my) {
    if (!this.itemBoxes) return null;
    for (const b of this.itemBoxes) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) return b.itemId;
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
    ctx.fillText('UPGRADE A CARD', this.width / 2, 75);
    ctx.fillStyle = PAL.MUTED;
    ctx.font = '13px monospace';
    ctx.fillText('+50% damage per upgrade (max 2)', this.width / 2, 105);

    const CARD_W = 165, CARD_H = 130, GAP = 16;
    const totalW = choices.length * CARD_W + (choices.length - 1) * GAP;
    const startX = (this.width - totalW) / 2;
    const startY = 135;
    this.upgradeBoxes = [];

    for (let i = 0; i < choices.length; i++) {
      const x = startX + i * (CARD_W + GAP), y = startY;
      const cardId = choices[i];
      const def = this.deckManager.getCardDef(cardId);
      if (!def) continue;
      const level = this.deckManager.upgrades[cardId] || 0;

      ctx.fillStyle = PAL.UI_PANEL;
      ctx.fillRect(x, y, CARD_W, CARD_H);
      ctx.fillStyle = def.color || '#aaa';
      ctx.fillRect(x, y, 3, CARD_H);
      ctx.strokeStyle = '#44aaff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, CARD_W, CARD_H);

      ctx.fillStyle = PAL.TEXT;
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(def.name, x + CARD_W / 2, y + 28);

      ctx.fillStyle = PAL.HOT;
      ctx.font = '12px monospace';
      ctx.fillText(`Lv ${level + 1} → ${level + 2}`, x + CARD_W / 2, y + 50);

      const nextDmg = Math.round(this.cardDefs[cardId].damage * (1 + 0.5 * (level + 1)));
      ctx.fillStyle = PAL.FLOWING;
      ctx.font = '13px monospace';
      ctx.fillText(`${def.damage} → ${nextDmg} DMG`, x + CARD_W / 2, y + 72);

      ctx.fillStyle = PAL.MUTED;
      ctx.font = '11px monospace';
      ctx.fillText(`${def.cost} AP | ${def.range}px`, x + CARD_W / 2, y + 92);

      ctx.fillStyle = '#44ff88';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('CLICK TO UPGRADE', x + CARD_W / 2, y + CARD_H - 12);

      this.upgradeBoxes = this.upgradeBoxes || [];
      this.upgradeBoxes.push({ x, y, w: CARD_W, h: CARD_H, cardId });
    }

    ctx.fillStyle = PAL.MUTED;
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press SPACE to skip', this.width / 2, this.height - 36);
  }

  handleUpgradeClick(mx, my) {
    if (!this.upgradeBoxes) return null;
    for (const b of this.upgradeBoxes) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) return b.cardId;
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
    ctx.fillText('STRANGE ENCOUNTER', this.width / 2, 75);
    ctx.fillStyle = '#ccc';
    ctx.font = '15px monospace';
    ctx.fillText('A mysterious figure offers you a deal...', this.width / 2, 130);

    const options = [
      { label: 'Trade 1 HP → Random Relic', key: '1', color: '#ff6666' },
      { label: 'Rest: Heal 2 HP', key: '2', color: PAL.FLOWING },
      { label: 'Gamble: 50% chance +2 HP or −1 HP', key: '3', color: PAL.HOT },
    ];
    this.eventBoxes = [];
    for (let i = 0; i < options.length; i++) {
      const y = 190 + i * 72;
      const opt = options[i];
      ctx.fillStyle = PAL.UI_PANEL;
      ctx.beginPath();
      ctx.roundRect(this.width / 2 - 230, y, 460, 58, 8);
      ctx.fill();
      ctx.strokeStyle = opt.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = opt.color;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`[${opt.key}] ${opt.label}`, this.width / 2, y + 36);
      this.eventBoxes.push({ x: this.width / 2 - 230, y, w: 460, h: 58, index: i });
    }
  }

  handleEventClick(mx, my) {
    if (!this.eventBoxes) return -1;
    for (const b of this.eventBoxes) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) return b.index;
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
    ctx.fillText('CARD SHOP', this.width / 2, 58);
    ctx.fillStyle = PAL.MUTED;
    ctx.font = '14px monospace';
    ctx.fillText('Cost: 1 HP per card. Click to buy.', this.width / 2, 88);

    const CARD_W = 155, CARD_H = 165, GAP = 20;
    const totalW = shopCards.length * CARD_W + (shopCards.length - 1) * GAP;
    const startX = (this.width - totalW) / 2;
    const startY = 118;
    this.shopBoxes = [];

    for (let i = 0; i < shopCards.length; i++) {
      const x = startX + i * (CARD_W + GAP), y = startY;
      const def = cardDefs[shopCards[i]];
      if (!def) continue;
      ctx.fillStyle = PAL.UI_PANEL;
      ctx.fillRect(x, y, CARD_W, CARD_H);
      ctx.fillStyle = def.color || '#aaa';
      ctx.fillRect(x, y, CARD_W, 3);
      ctx.strokeStyle = '#334466';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, CARD_W, CARD_H);

      ctx.fillStyle = PAL.TEXT;
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(def.name, x + CARD_W / 2, y + 28);
      ctx.fillStyle = '#ff6666';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('1 HP', x + CARD_W / 2, y + 50);
      ctx.fillStyle = '#44aaff';
      ctx.font = '12px monospace';
      ctx.fillText(`${def.cost} AP | ${def.range}px`, x + CARD_W / 2, y + 70);
      ctx.fillStyle = PAL.MUTED;
      ctx.font = '10px monospace';
      this._wrapText(ctx, def.desc, x + 10, y + 94, CARD_W - 20, 13);
      this.shopBoxes.push({ x, y, w: CARD_W, h: CARD_H, cardId: shopCards[i] });
    }

    ctx.fillStyle = PAL.MUTED;
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press ENTER to leave', this.width / 2, this.height - 36);
  }

  handleShopClick(mx, my) {
    if (!this.shopBoxes) return null;
    for (const b of this.shopBoxes) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) return b.cardId;
    }
    return null;
  }

  // ───────────── STATS SCREEN ─────────────
  drawStatsScreen(ctx, stats, score, leaderboard) {
    ctx.fillStyle = 'rgba(0,0,0,0.93)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = stats.won ? PAL.FLOWING : PAL.CRITICAL;
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(stats.won ? 'VICTORY!' : 'DEFEATED', this.width / 2, 68);

    if (!stats.won) {
      ctx.fillStyle = PAL.MUTED;
      ctx.font = '16px monospace';
      ctx.fillText('Better luck next time.', this.width / 2, 100);
    }

    ctx.fillStyle = PAL.GOLD;
    ctx.font = 'bold 28px monospace';
    ctx.fillText(`SCORE: ${score}`, this.width / 2, 136);

    const lines = [
      ['Kills', stats.kills || 0],
      ['Rooms Cleared', stats.roomsCleared || 0],
      ['Floor Reached', stats.floor || 1],
      ['Cards Played', stats.cardsPlayed || 0],
      ['Perfect Dodges', stats.perfectDodges || 0],
      ['Highest Combo', stats.highestCombo || 0],
      ['Manual Crashes', stats.manualCrashes || 0],
      ['Relics Collected', stats.itemsCollected || 0],
      ['Run Time', `${Math.floor(stats.elapsedTime || 0)}s`],
    ];

    const startY = 172;
    const panelW = 320, panelX = this.width / 2 - panelW / 2;
    ctx.fillStyle = PAL.UI_PANEL;
    ctx.fillRect(panelX, startY - 8, panelW, lines.length * 26 + 16);
    ctx.strokeStyle = PAL.UI_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, startY - 8, panelW, lines.length * 26 + 16);

    for (let i = 0; i < lines.length; i++) {
      const y = startY + i * 26;
      ctx.fillStyle = PAL.MUTED;
      ctx.font = '14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(lines[i][0], panelX + 16, y + 16);
      ctx.textAlign = 'right';
      ctx.fillStyle = PAL.TEXT;
      ctx.fillText(String(lines[i][1]), panelX + panelW - 16, y + 16);
    }

    // Leaderboard
    if (leaderboard && leaderboard.length > 0) {
      const lbY = startY + lines.length * 26 + 28;
      ctx.fillStyle = PAL.HOT;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LEADERBOARD', this.width / 2, lbY);
      for (let i = 0; i < Math.min(5, leaderboard.length); i++) {
        const entry = leaderboard[i];
        const y = lbY + 28 + i * 22;
        ctx.fillStyle = i === 0 ? PAL.GOLD : PAL.MUTED;
        ctx.font = i === 0 ? 'bold 14px monospace' : '13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${i + 1}. ${entry.character || '?'} — ${entry.score} pts (Floor ${entry.floor || '?'})`, this.width / 2, y);
      }
    }

    ctx.fillStyle = PAL.MUTED;
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press ENTER to continue', this.width / 2, this.height - 36);

    // Show unlocks from this run
    if (this.newUnlocks && this.newUnlocks.length > 0) {
      const uy = this.height - 36 - this.newUnlocks.length * 22 - 10;
      ctx.fillStyle = PAL.GOLD;
      ctx.font = 'bold 13px monospace';
      ctx.fillText('UNLOCKED THIS RUN:', this.width / 2, uy - 4);
      for (let i = 0; i < this.newUnlocks.length; i++) {
        ctx.fillStyle = PAL.FLOWING;
        ctx.font = '12px monospace';
        ctx.fillText(this.newUnlocks[i], this.width / 2, uy + 18 + i * 22);
      }
    }
  }

  // ───────────── INVENTORY OVERLAY ─────────────
  drawInventoryOverlay(ctx) {
    const { ItemDefinitions } = require_itemDefs();
    const panelW = Math.min(700, this.width - 60);
    const panelH = Math.min(520, this.height - 80);
    const px = (this.width - panelW) / 2;
    const py = (this.height - panelH) / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#111122';
    ctx.beginPath();
    ctx.roundRect(px, py, panelW, panelH, 16);
    ctx.fill();
    ctx.strokeStyle = '#334466';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = PAL.TEXT;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('INVENTORY', this.width / 2, py + 36);

    // Cards section
    const cardList = this.deckManager.collection;
    ctx.fillStyle = '#44aaff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`CARDS (${cardList.length}/${this.deckManager.MAX_DECK_SIZE})`, px + 20, py + 66);

    const CW = 140, CH = 100, CGAP = 8;
    const CCOLS = Math.floor((panelW - 40) / (CW + CGAP));
    for (let i = 0; i < cardList.length; i++) {
      const def = this.deckManager.getCardDef(cardList[i]);
      if (!def) continue;
      const col = i % CCOLS, row = Math.floor(i / CCOLS);
      const cx = px + 20 + col * (CW + CGAP);
      const cy = py + 76 + row * (CH + CGAP);

      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(cx, cy, CW, CH);
      ctx.fillStyle = def.color || '#5577aa';
      ctx.fillRect(cx, cy, CW, 3);
      ctx.strokeStyle = def.color || '#334466';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx, cy, CW, CH);

      const inHand = this.deckManager.hand.indexOf(cardList[i]) >= 0;
      if (inHand) {
        ctx.fillStyle = '#44ff8833';
        ctx.fillRect(cx, cy, CW, CH);
        ctx.fillStyle = '#44ff88';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('IN HAND', cx + CW - 4, cy + 12);
      }

      const lvl = this.deckManager.upgrades[cardList[i]] || 0;
      ctx.fillStyle = PAL.TEXT;
      ctx.font = `bold 12px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(def.name + (lvl > 0 ? '+'.repeat(lvl) : ''), cx + CW / 2, cy + 22);
      ctx.fillStyle = '#888';
      ctx.font = '10px monospace';
      ctx.fillText(`${def.cost}AP | ${def.type}`, cx + CW / 2, cy + 37);
      ctx.fillStyle = def.tempoShift > 0 ? PAL.HOT : PAL.COLD;
      ctx.fillText((def.tempoShift > 0 ? '+' : '') + def.tempoShift + ' T', cx + CW / 2, cy + 51);
      ctx.fillStyle = '#ccc';
      ctx.font = '9px monospace';
      this._wrapText(ctx, def.desc, cx + 4, cy + 64, CW - 8, 11);
    }

    // Relics section
    const relicList = this.itemManager ? this.itemManager.equipped : [];
    const relicStartY = py + 76 + Math.ceil(cardList.length / CCOLS) * (CH + CGAP) + 12;
    if (relicList.length > 0) {
      ctx.fillStyle = PAL.GOLD;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`RELICS (${relicList.length})`, px + 20, relicStartY);

      const RW = 180, RH = 60, RGAP = 10;
      const RCOLS = Math.floor((panelW - 40) / (RW + RGAP));
      for (let i = 0; i < relicList.length; i++) {
        const def = ItemDefinitions[relicList[i]];
        if (!def) continue;
        const col = i % RCOLS, row = Math.floor(i / RCOLS);
        const rx = px + 20 + col * (RW + RGAP);
        const ry = relicStartY + 10 + row * (RH + RGAP);
        const rarCol = def.rarity === 'rare' ? PAL.RARE : (def.rarity === 'uncommon' ? PAL.UNCOMMON : PAL.COMMON);
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(rx, ry, RW, RH);
        ctx.strokeStyle = rarCol;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(rx, ry, RW, RH);
        ctx.fillStyle = PAL.TEXT;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(def.name, rx + RW / 2, ry + 18);
        ctx.fillStyle = rarCol;
        ctx.font = '9px monospace';
        ctx.fillText(def.rarity.toUpperCase(), rx + RW / 2, ry + 30);
        ctx.fillStyle = '#bbb';
        ctx.font = '9px monospace';
        this._wrapText(ctx, def.desc, rx + 4, ry + 42, RW - 8, 10);
      }
    }

    ctx.fillStyle = PAL.MUTED;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press [I] or ESC to close', this.width / 2, py + panelH - 14);
  }

  // ───────────── DISCARD SCREEN ─────────────
  drawDiscardScreen(ctx, newCardId) {
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = PAL.CRITICAL;
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DECK FULL', this.width / 2, 62);

    ctx.fillStyle = PAL.TEXT;
    ctx.font = '15px monospace';
    ctx.fillText('You already have 6 cards. Choose one to DISCARD:', this.width / 2, 92);

    const newDef = this.deckManager.getCardDef(newCardId) || CardDefinitions[newCardId];
    if (newDef) {
      ctx.fillStyle = PAL.FLOWING;
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`New card: ${newDef.name} (${newDef.cost}AP, ${newDef.type}) — click an existing card to replace it`, this.width / 2, 116);
    }

    const CARD_W = 130, CARD_H = 160, GAP = 12;
    const all = this.deckManager.collection;
    const totalW = all.length * CARD_W + (all.length - 1) * GAP;
    const startX = (this.width - totalW) / 2;
    const startY = 140;
    this.discardBoxes = [];

    for (let i = 0; i < all.length; i++) {
      const cardId = all[i];
      const def = this.deckManager.getCardDef(cardId);
      if (!def) continue;
      const x = startX + i * (CARD_W + GAP), y = startY;

      const mx = this._mouseX, my = this._mouseY;
      const isHovered = mx >= x && mx <= x + CARD_W && my >= y && my <= y + CARD_H;

      ctx.fillStyle = isHovered ? '#2a0a0a' : '#1a1a2e';
      ctx.fillRect(x, y, CARD_W, CARD_H);
      ctx.fillStyle = def.color || '#5577aa';
      ctx.fillRect(x, y, CARD_W, 3);
      ctx.strokeStyle = isHovered ? PAL.CRITICAL : (def.color || '#334466');
      ctx.lineWidth = isHovered ? 3 : 1.5;
      ctx.strokeRect(x, y, CARD_W, CARD_H);

      ctx.fillStyle = PAL.TEXT;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(def.name, x + CARD_W / 2, y + 22);
      ctx.fillStyle = '#44aaff';
      ctx.font = '11px monospace';
      ctx.fillText(`${def.cost}AP | ${def.range}px`, x + CARD_W / 2, y + 38);
      ctx.fillStyle = def.tempoShift > 0 ? PAL.HOT : PAL.COLD;
      ctx.font = '10px monospace';
      ctx.fillText((def.tempoShift > 0 ? '+' : '') + def.tempoShift + ' Tempo', x + CARD_W / 2, y + 53);
      ctx.fillStyle = def.color || '#888';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(def.type.toUpperCase(), x + CARD_W / 2, y + 66);
      ctx.fillStyle = PAL.MUTED;
      ctx.font = '9px monospace';
      this._wrapText(ctx, def.desc, x + 5, y + 80, CARD_W - 10, 11);

      if (isHovered) {
        ctx.fillStyle = PAL.CRITICAL;
        ctx.font = 'bold 11px monospace';
        ctx.fillText('DISCARD THIS', x + CARD_W / 2, y + CARD_H - 10);
      }

      this.discardBoxes.push({ x, y, w: CARD_W, h: CARD_H, cardId });
    }
  }

  handleDiscardClick(mx, my) {
    if (!this.discardBoxes) return null;
    for (const b of this.discardBoxes) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) return b.cardId;
    }
    return null;
  }

  // ─────────────────────────────────────��─────────────────────────
  _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    if (!text) return;
    const prevAlign = ctx.textAlign;
    ctx.textAlign = 'center';
    const words = text.split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      if (ctx.measureText(testLine).width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x + maxWidth / 2, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x + maxWidth / 2, y);
    ctx.textAlign = prevAlign;
  }
}

function require_itemDefs() {
  return { ItemDefinitions: window._itemDefs || {} };
}
