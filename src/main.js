import { Engine } from './Engine.js';
import { EventBus, events } from './EventBus.js';
import { InputManager } from './Input.js';
import { Renderer } from './Renderer.js';
import { Player } from './player.js';
import { Chaser, Sniper, Bruiser, Turret, Teleporter, Swarm, Healer, Mirror } from './Enemy.js';
import { TempoSystem } from './tempo.js';
import { CombatManager } from './Combat.js';
import { ParticleSystem } from './Particles.js';
import { AudioSynthesizer } from './audio.js';
import { UI } from './ui.js';
import { RoomManager } from './room.js';
import { DeckManager, CardDefinitions } from './DeckManager.js';
import { RunManager } from './RunManager.js';
import { MetaProgress } from './MetaProgress.js';
import { Characters, CharacterList, DIFFICULTY_NAMES, DIFFICULTY_COLORS, DIFFICULTY_MODS } from './Characters.js';

console.log('[Init] Rogue Hero booting...');
const canvas = document.getElementById('game');
if (!canvas) console.error('[Init] FATAL: canvas#game not found!');
canvas.width = 1280;
canvas.height = 720;
window.CANVAS_W = canvas.width;
window.CANVAS_H = canvas.height;

const input = new InputManager(canvas);
const renderer = new Renderer(canvas);
const tempo = new TempoSystem();
const particles = new ParticleSystem();
const audio = new AudioSynthesizer();
const combat = new CombatManager(tempo, particles, audio);
const room = new RoomManager(canvas.width, canvas.height);
const deckManager = new DeckManager();
const runManager = new RunManager();
const meta = new MetaProgress();
console.log('[Init] All systems created. Cards:', Object.keys(CardDefinitions).length);

let player = new Player(400, 360);
let enemies = [];
combat.setLists(enemies, player);
const ui = new UI(canvas, tempo, player, deckManager, CardDefinitions);

// Game states: intro, charSelect, menu(unused), map, prep, playing, draft, dead, victory
let gameState = 'intro';
let draftChoices = [];
let roomsCleared = 0;
let currentCombatNode = null;
let selectedCharId = null;
let selectedDifficulty = 0;
let totalHealedThisRun = 0;
let newUnlocks = []; // Messages to show on victory/death
const FLOORS_TO_WIN = 3;

// ── Event Handlers ──────────────────────────────────────────────
events.on('ENEMY_MELEE_HIT', ({ damage }) => {
  // Scale damage by difficulty
  damage = Math.round(damage * (DIFFICULTY_MODS[selectedDifficulty]?.dmgMult || 1));
  player.takeDamage(damage);
  events.emit('HIT_STOP', 0.08);
  events.emit('SCREEN_SHAKE', { duration: 0.2, intensity: 0.4 });
  events.emit('PLAY_SOUND', 'playerHit');
  if (!player.alive) {
    console.log(`[Event] Player DIED Floor ${runManager.floor}, ${roomsCleared} rooms`);
    checkRunUnlocks(false);
    gameState = 'dead';
  }
});

// ── Helpers ─────────────────────────────────────────────────────
function startNewRun() {
  const charDef = Characters[selectedCharId];
  player = new Player(400, 360);
  player.hp = charDef.hp;
  player.maxHp = charDef.maxHp;
  player.budgetRegenRate = charDef.apRegen;
  player.BASE_SPEED = charDef.baseSpeed;

  deckManager.initDeck(charDef.startingDeck);
  tempo.value = 50;
  roomsCleared = 0;
  totalHealedThisRun = 0;
  newUnlocks = [];
  runManager.floor = 1;
  runManager.generateMap();
  ui.player = player;
  combat.setLists([], player);
  gameState = 'map';
  console.log(`[Run] New run as "${selectedCharId}" difficulty=${DIFFICULTY_NAMES[selectedDifficulty]}`);
}

function spawnEnemies(node) {
  enemies = [];
  const f = runManager.floor;
  const diff = DIFFICULTY_MODS[selectedDifficulty] || DIFFICULTY_MODS[0];
  function rndX() { return room.FLOOR_X1 + 100 + Math.random() * (room.FLOOR_X2 - room.FLOOR_X1 - 200); }
  function rndY() { return room.FLOOR_Y1 + 80 + Math.random() * (room.FLOOR_Y2 - room.FLOOR_Y1 - 160); }
  const cx = (room.FLOOR_X1 + room.FLOOR_X2) / 2;
  const cy = (room.FLOOR_Y1 + room.FLOOR_Y2) / 2;

  if (node.type === 'boss') {
    enemies.push(new Bruiser(cx, cy - 50));
    enemies.push(new Turret(room.FLOOR_X1 + 120, room.FLOOR_Y1 + 120));
    enemies.push(new Turret(room.FLOOR_X2 - 120, room.FLOOR_Y1 + 120));
    if (f >= 2) { enemies.push(new Healer(rndX(), rndY())); enemies.push(new Teleporter(rndX(), rndY())); }
    if (f >= 3) { enemies.push(new Mirror(rndX(), rndY())); }
  } else if (node.type === 'elite') {
    enemies.push(new Bruiser(cx + 60, cy));
    const extra = 1 + Math.floor(f * 0.6);
    for (let i = 0; i < extra; i++) enemies.push(new Chaser(rndX(), rndY()));
    if (f >= 2) enemies.push(new Healer(rndX(), rndY()));
  } else {
    const count = 2 + Math.floor(f * 0.8) + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      if (f >= 3 && roll < 0.08) enemies.push(new Mirror(rndX(), rndY()));
      else if (f >= 2 && roll < 0.15) enemies.push(new Teleporter(rndX(), rndY()));
      else if (roll < 0.22) enemies.push(new Healer(rndX(), rndY()));
      else if (roll < 0.35) enemies.push(new Turret(rndX(), rndY()));
      else if (roll < 0.5) {
        // Swarm pack of 3
        const sx = rndX(), sy = rndY();
        enemies.push(new Swarm(sx, sy));
        enemies.push(new Swarm(sx + 20, sy + 15));
        enemies.push(new Swarm(sx - 15, sy + 20));
        i += 2;
      }
      else if (roll < 0.7) enemies.push(new Sniper(rndX(), rndY()));
      else enemies.push(new Chaser(rndX(), rndY()));
    }
  }

  for (const e of enemies) {
    e.hp = Math.round(e.hp * (1 + (f - 1) * 0.25) * diff.hpMult);
    e.maxHp = e.hp;
  }

  combat.setLists(enemies, player);
  console.log(`[Spawn] "${node.type}" F${f}: ${enemies.length} enemies [${enemies.map(e=>e.type).join(',')}]`);
}

function getAvailableCards() {
  const owned = deckManager.collection;
  const base = Object.keys(CardDefinitions).filter(id => {
    if (owned.includes(id)) return false;
    const def = CardDefinitions[id];
    if (def.bonusCard && !meta.isBonusCardUnlocked(id)) return false;
    return true;
  });
  return base;
}

function generateDraft() {
  const available = getAvailableCards();
  available.sort(() => Math.random() - 0.5);
  draftChoices = available.slice(0, Math.min(3, available.length));
  console.log(`[Draft] Offering: [${draftChoices.join(', ')}] (${available.length} avail)`);
  if (draftChoices.length === 0) { gameState = 'map'; return false; }
  return true;
}

function pickDraft(idx) {
  if (idx >= draftChoices.length) return;
  deckManager.addCard(draftChoices[idx]);
  console.log(`[Draft] Picked "${draftChoices[idx]}"`);
  gameState = 'map';
}

function checkRunUnlocks(won) {
  meta.recordRun(won, runManager.floor);
  newUnlocks = [];

  // Unlock Shadow by reaching floor 2
  if (runManager.floor >= 2 && meta.unlockCharacter('shadow')) {
    newUnlocks.push('🗡️ Unlocked character: SHADOW');
  }
  // Unlock Frost by healing 10+ HP
  if (totalHealedThisRun >= 10 && meta.unlockCharacter('frost')) {
    newUnlocks.push('❄️ Unlocked character: FROST');
  }

  if (won) {
    // Unlock next difficulty for this character
    const currentMax = meta.getMaxDifficulty(selectedCharId);
    if (selectedDifficulty >= currentMax && currentMax < 2) {
      meta.unlockDifficulty(selectedCharId, currentMax + 1);
      newUnlocks.push(`⚔️ Unlocked ${DIFFICULTY_NAMES[currentMax + 1]} difficulty for ${Characters[selectedCharId].name}`);
    }
    // Unlock bonus cards on wins
    const bonusPool = ['chain_lightning', 'thunder_clap', 'phantom_step', 'blood_pact', 'iron_wall', 'execute', 'tempo_surge', 'shadow_mark'];
    for (const cid of bonusPool) {
      if (!meta.isBonusCardUnlocked(cid)) {
        meta.unlockBonusCard(cid);
        newUnlocks.push(`🃏 Unlocked card: ${CardDefinitions[cid].name}`);
        break; // One per win
      }
    }
  }
  if (newUnlocks.length > 0) console.log('[Meta] Unlocks:', newUnlocks);
}

// Track healing for Frost unlock
const origHeal = Player.prototype.heal;
Player.prototype.heal = function(amt) {
  const before = this.hp;
  origHeal.call(this, amt);
  totalHealedThisRun += (this.hp - before);
};

// ── UPDATE ──────────────────────────────────────────────────────
function update(logicDt, realDt) {
  // ── INTRO ──
  if (gameState === 'intro') {
    if (input.consumeClick() || input.consumeKey('enter') || input.consumeKey(' ')) {
      audio.init();
      gameState = 'charSelect';
    }
    input.clearFrame();
    return;
  }

  // ── CHARACTER SELECT ──
  if (gameState === 'charSelect') {
    if (input.consumeClick()) {
      const result = handleCharSelectClick(input.mouse.x, input.mouse.y);
      if (result === 'start' && selectedCharId) {
        startNewRun();
      }
    }
    // Difficulty cycling with D key
    if (input.consumeKey('d') && selectedCharId) {
      const maxD = meta.getMaxDifficulty(selectedCharId);
      selectedDifficulty = (selectedDifficulty + 1) % (maxD + 1);
    }
    input.clearFrame();
    return;
  }

  // ── MAP ──
  if (gameState === 'map') {
    if (input.consumeClick()) {
      const node = runManager.handleMapClick(input.mouse.x, input.mouse.y, canvas.width, canvas.height);
      if (node) {
        console.log(`[Map] Node "${node.id}" type="${node.type}"`);
        if (node.type === 'rest') {
          player.heal(3);
          console.log(`[Map] Rested. HP: ${player.hp}/${player.maxHp}`);
        } else {
          currentCombatNode = node;
          spawnEnemies(node);
          player.x = room.FLOOR_X1 + 100;
          player.y = (room.FLOOR_Y1 + room.FLOOR_Y2) / 2;
          gameState = 'prep';
        }
      }
    }
    input.clearFrame();
    return;
  }

  // ── DEAD / VICTORY ──
  if (gameState === 'dead' || gameState === 'victory') {
    if (input.consumeKey('r') || input.consumeClick()) {
      gameState = 'charSelect';
      selectedCharId = null;
    }
    input.clearFrame();
    return;
  }

  // ── DRAFT ──
  if (gameState === 'draft') {
    // Keyboard
    for (let i = 0; i < draftChoices.length; i++) {
      if (input.consumeKey((i + 1).toString())) { pickDraft(i); break; }
    }
    // Click
    if (input.consumeClick()) {
      const idx = getDraftClickIndex(input.mouse.x, input.mouse.y);
      if (idx >= 0) pickDraft(idx);
    }
    input.clearFrame();
    return;
  }

  // ── PREP ──
  if (gameState === 'prep') {
    if (input.consumeKey('enter')) {
      console.log(`[Prep] Hand: [${deckManager.hand.join(', ')}]`);
      gameState = 'playing';
    }
    if (input.consumeClick()) ui.handlePrepClick(input.mouse.x, input.mouse.y);
    input.clearFrame();
    return;
  }

  // ── PLAYING ──
  tempo.update(logicDt);
  audio.updateTempoHum(tempo.value, true);

  for (let i = 0; i < 4; i++) {
    if (input.consumeKey((i + 1).toString())) {
      const cardId = deckManager.hand[i];
      if (cardId) {
        const def = CardDefinitions[cardId];
        if (player.budget >= def.cost) combat.executeCard(player, def, input.mouse);
        else events.emit('PLAY_SOUND', 'miss');
      }
    }
  }

  player.updateLogic(logicDt, input, tempo, room);

  for (let i = enemies.length - 1; i >= 0; i--) {
    // Pass allEnemies for Healer
    enemies[i].updateLogic(logicDt, player, tempo, room, enemies);
    if (!enemies[i].alive) enemies.splice(i, 1);
  }

  if (enemies.length === 0 && gameState === 'playing') {
    roomsCleared++;
    console.log(`[Combat] Cleared! Total: ${roomsCleared}`);

    if (currentCombatNode && currentCombatNode.type === 'boss') {
      if (runManager.floor >= FLOORS_TO_WIN) {
        console.log('[Run] VICTORY! All floors cleared.');
        checkRunUnlocks(true);
        gameState = 'victory';
        currentCombatNode = null;
        particles.update(logicDt);
        renderer.updateShake(realDt);
        input.clearFrame();
        return;
      }
      runManager.floor++;
      console.log(`[Run] Floor cleared! Now Floor ${runManager.floor}`);
      runManager.generateMap();
    }
    currentCombatNode = null;
    if (gameState === 'playing') {
      if (generateDraft()) gameState = 'draft';
    }
  }

  particles.update(logicDt);
  renderer.updateShake(realDt);
  input.clearFrame();
}

// ── Click handlers ──────────────────────────────────────────────
let charSelectBoxes = [];

function handleCharSelectClick(mx, my) {
  for (const b of charSelectBoxes) {
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
      if (b.action === 'select' && meta.isCharacterUnlocked(b.charId)) {
        selectedCharId = b.charId;
        selectedDifficulty = 0;
        return 'selected';
      }
      if (b.action === 'start') return 'start';
      if (b.action === 'difficulty' && selectedCharId) {
        const maxD = meta.getMaxDifficulty(selectedCharId);
        selectedDifficulty = (selectedDifficulty + 1) % (maxD + 1);
        return 'difficulty';
      }
    }
  }
  return null;
}

let draftBoxes = [];

function getDraftClickIndex(mx, my) {
  for (const b of draftBoxes) {
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) return b.idx;
  }
  return -1;
}

// ── RENDER ──────────────────────────────────────────────────────
function render() {
  renderer.clear();

  // ── INTRO ──
  if (gameState === 'intro') {
    const ctx = renderer.ctx;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 58px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ROGUE HERO', canvas.width / 2, 120);

    ctx.fillStyle = '#44aaff';
    ctx.font = '16px monospace';
    ctx.fillText('A Tempo-Driven Roguelike Deck Builder', canvas.width / 2, 160);

    // Tutorial box
    const bx = 200, by = 200, bw = canvas.width - 400, bh = 380;
    ctx.fillStyle = '#111118';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#334';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    ctx.fillStyle = '#ffdd44';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('HOW TO PLAY', canvas.width / 2, by + 35);

    ctx.fillStyle = '#ccc';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    const lines = [
      '◆ WASD to move, SPACE to dodge (costs no AP)',
      '◆ Press 1-4 to use your equipped cards (costs AP)',
      '◆ AP regenerates over time — manage it carefully',
      '',
      '◆ THE TEMPO BAR controls your power:',
      '    COLD (<30) = 0.7x damage, free dodges',
      '    FLOWING (30-70) = 1.0x damage, balanced',
      '    HOT (70-90) = 1.3x damage, 1.2x speed!',
      '    CRITICAL (90+) = 1.8x damage but auto-crash!',
      '',
      '◆ Navigate branching floor maps — fight, rest, or face elites',
      `◆ Clear ${FLOORS_TO_WIN} FLOORS (each ending in a boss) to WIN`,
      '◆ After each fight, pick a new card (no duplicates!)',
      '◆ Winning unlocks new characters, cards & difficulty tiers',
    ];
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], bx + 30, by + 70 + i * 22);
    }

    ctx.fillStyle = '#33dd66';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Click or press ENTER to continue', canvas.width / 2, by + bh + 40);
    return;
  }

  // ── CHARACTER SELECT ──
  if (gameState === 'charSelect') {
    const ctx = renderer.ctx;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CHOOSE YOUR HERO', canvas.width / 2, 60);

    // Stats
    ctx.fillStyle = '#666';
    ctx.font = '12px monospace';
    ctx.fillText(`Runs: ${meta.state.totalRuns}  |  Wins: ${meta.state.totalWins}  |  Best Floor: ${meta.state.bestFloor}`, canvas.width / 2, 90);

    charSelectBoxes = [];
    const CARD_W = 280, CARD_H = 340, GAP = 40;
    const chars = CharacterList;
    const totalW = chars.length * CARD_W + (chars.length - 1) * GAP;
    const startX = (canvas.width - totalW) / 2;
    const startY = 130;

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const x = startX + i * (CARD_W + GAP);
      const unlocked = meta.isCharacterUnlocked(ch.id);
      const isSelected = selectedCharId === ch.id;

      ctx.save();
      ctx.shadowColor = isSelected ? ch.color : 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = isSelected ? 25 : 10;

      let grad = ctx.createLinearGradient(x, startY, x, startY + CARD_H);
      grad.addColorStop(0, unlocked ? '#1a1a28' : '#0d0d12');
      grad.addColorStop(1, unlocked ? '#111120' : '#080810');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, startY, CARD_W, CARD_H, 16);
      ctx.fill();

      ctx.shadowColor = 'transparent';

      // Color stripe
      ctx.fillStyle = unlocked ? ch.color : '#333';
      ctx.fillRect(x, startY, 5, CARD_H);

      // Border
      ctx.strokeStyle = isSelected ? ch.color : (unlocked ? '#444' : '#222');
      ctx.lineWidth = isSelected ? 4 : 2;
      ctx.stroke();

      if (!unlocked) {
        ctx.fillStyle = '#444';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🔒 LOCKED', x + CARD_W / 2, startY + CARD_H / 2 - 10);
        ctx.fillStyle = '#555';
        ctx.font = '11px monospace';
        const cond = ch.unlockCondition === 'reach_floor_2' ? 'Reach Floor 2 in any run' : 'Heal 10+ HP in a single run';
        ctx.fillText(cond, x + CARD_W / 2, startY + CARD_H / 2 + 15);
      } else {
        ctx.fillStyle = ch.color;
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ch.name, x + CARD_W / 2, startY + 40);

        ctx.fillStyle = '#aaa';
        ctx.font = '14px monospace';
        ctx.fillText(ch.title, x + CARD_W / 2, startY + 65);

        ctx.fillStyle = '#888';
        ctx.font = '12px monospace';
        ui._wrapText(ctx, ch.description, x + 15, startY + 95, CARD_W - 30, 16);

        // Stats
        ctx.fillStyle = '#ee4444';
        ctx.fillText(`♥ ${ch.hp} HP`, x + CARD_W / 4, startY + 160);
        ctx.fillStyle = '#44aaff';
        ctx.fillText(`⚡ ${ch.apRegen}/s AP`, x + CARD_W * 3 / 4, startY + 160);
        ctx.fillStyle = '#44ff88';
        ctx.fillText(`💨 ${ch.baseSpeed} SPD`, x + CARD_W / 2, startY + 180);

        // Starting deck
        ctx.fillStyle = '#ffdd44';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('STARTING DECK:', x + CARD_W / 2, startY + 210);
        ctx.fillStyle = '#ccc';
        ctx.font = '11px monospace';
        for (let j = 0; j < ch.startingDeck.length; j++) {
          const cd = CardDefinitions[ch.startingDeck[j]];
          if (cd) ctx.fillText(`• ${cd.name} (${cd.cost}AP, ${cd.type})`, x + CARD_W / 2, startY + 230 + j * 16);
        }

        // Difficulty tiers unlocked
        const maxD = meta.getMaxDifficulty(ch.id);
        ctx.fillStyle = '#888';
        ctx.font = '10px monospace';
        for (let d = 0; d <= 2; d++) {
          ctx.fillStyle = d <= maxD ? DIFFICULTY_COLORS[d] : '#333';
          ctx.fillText(DIFFICULTY_NAMES[d], x + 40 + d * 80, startY + CARD_H - 25);
        }
      }

      charSelectBoxes.push({ x, y: startY, w: CARD_W, h: CARD_H, charId: ch.id, action: 'select' });
      ctx.restore();
    }

    // Start button + difficulty selector
    if (selectedCharId) {
      const btnY = startY + CARD_H + 30;

      // Difficulty button
      const diffBtnX = canvas.width / 2 - 160, diffBtnW = 150, diffBtnH = 40;
      ctx.fillStyle = '#1a1a28';
      ctx.fillRect(diffBtnX, btnY, diffBtnW, diffBtnH);
      ctx.strokeStyle = DIFFICULTY_COLORS[selectedDifficulty];
      ctx.lineWidth = 2;
      ctx.strokeRect(diffBtnX, btnY, diffBtnW, diffBtnH);
      ctx.fillStyle = DIFFICULTY_COLORS[selectedDifficulty];
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(DIFFICULTY_NAMES[selectedDifficulty], diffBtnX + diffBtnW / 2, btnY + 26);
      charSelectBoxes.push({ x: diffBtnX, y: btnY, w: diffBtnW, h: diffBtnH, action: 'difficulty' });

      // Start button
      const startBtnX = canvas.width / 2 + 10, startBtnW = 180, startBtnH = 44;
      ctx.fillStyle = '#225533';
      ctx.beginPath();
      ctx.roundRect(startBtnX, btnY, startBtnW, startBtnH, 8);
      ctx.fill();
      ctx.strokeStyle = '#44ff88';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#44ff88';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('START RUN', startBtnX + startBtnW / 2, btnY + 29);
      charSelectBoxes.push({ x: startBtnX, y: btnY, w: startBtnW, h: startBtnH, action: 'start' });
    } else {
      ctx.fillStyle = '#555';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Click a hero to select them', canvas.width / 2, startY + CARD_H + 50);
    }

    // Unlocked bonus cards display
    const bonusCards = meta.state.unlockedBonusCards;
    if (bonusCards.length > 0) {
      ctx.fillStyle = '#555';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Bonus Cards Unlocked: ${bonusCards.map(c => CardDefinitions[c]?.name || c).join(', ')}`, canvas.width / 2, canvas.height - 20);
    }
    return;
  }

  // ── MAP ──
  if (gameState === 'map') {
    runManager.drawMap(renderer.ctx, canvas.width, canvas.height);
    const ctx = renderer.ctx;
    const ch = Characters[selectedCharId];
    ctx.fillStyle = ch ? ch.color : '#aaa';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${ch?.name || 'Hero'}  |  HP: ${player.hp}/${player.maxHp}  |  Cards: ${deckManager.collection.length}  |  Rooms: ${roomsCleared}  |  Floor ${runManager.floor}/${FLOORS_TO_WIN}`, 20, canvas.height - 40);
    return;
  }

  // ── COMBAT / PREP / DRAFT render the room ──
  renderer.beginShakeScope();
  room.draw(renderer.ctx);
  for (const e of enemies) e.drawTelegraph(renderer.ctx);
  if (gameState === 'playing') {
    combat.drawRangeIndicator(renderer.ctx, player, deckManager.hand, CardDefinitions);
    combat.drawReticles(renderer.ctx, deckManager.hand, CardDefinitions);
  }
  for (const e of enemies) e.draw(renderer.ctx);
  player.draw(renderer.ctx, tempo);
  particles.draw(renderer.ctx);
  renderer.endShakeScope();

  if (gameState === 'playing') {
    ui.draw(renderer.ctx);
    const ctx = renderer.ctx;
    ctx.fillStyle = '#555';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Floor ${runManager.floor}/${FLOORS_TO_WIN}  |  Rooms: ${roomsCleared}  |  ${DIFFICULTY_NAMES[selectedDifficulty]}`, canvas.width - 20, 20);
  }

  // ── OVERLAYS ──
  if (gameState === 'dead') {
    drawEndScreen(false);
  } else if (gameState === 'victory') {
    drawEndScreen(true);
  } else if (gameState === 'draft') {
    drawDraftScreen();
  } else if (gameState === 'prep') {
    ui.drawPrepScreen(renderer.ctx);
  }
}

function drawEndScreen(won) {
  const ctx = renderer.ctx;
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = 'bold 56px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? '#44ff88' : '#dd3333';
  ctx.fillText(won ? 'VICTORY!' : 'RUN ENDED', canvas.width / 2, canvas.height / 2 - 100);

  ctx.fillStyle = '#888';
  ctx.font = '18px monospace';
  const ch = Characters[selectedCharId];
  ctx.fillText(`${ch?.name || 'Hero'}  |  Floor ${runManager.floor}  |  ${roomsCleared} Rooms  |  ${deckManager.collection.length} Cards  |  ${DIFFICULTY_NAMES[selectedDifficulty]}`, canvas.width / 2, canvas.height / 2 - 50);

  // Show unlocks
  if (newUnlocks.length > 0) {
    ctx.fillStyle = '#ffdd44';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('NEW UNLOCKS:', canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = '#fff';
    ctx.font = '15px monospace';
    for (let i = 0; i < newUnlocks.length; i++) {
      ctx.fillText(newUnlocks[i], canvas.width / 2, canvas.height / 2 + 28 + i * 24);
    }
  }

  ctx.fillStyle = '#44aaff';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('Press R or Click to return', canvas.width / 2, canvas.height / 2 + 120);
}

function drawDraftScreen() {
  const ctx = renderer.ctx;
  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#44ff88';
  ctx.font = 'bold 42px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ROOM CLEARED!', canvas.width / 2, 80);

  ctx.fillStyle = '#aaa';
  ctx.font = '16px monospace';
  const hint = draftChoices.length < 3 ? `Only ${draftChoices.length} card(s) left to discover!` : 'Click or press 1-3 to pick a new card.';
  ctx.fillText(hint, canvas.width / 2, 120);

  const CARD_W = 200, CARD_H = 280, GAP = 40;
  const count = draftChoices.length;
  const totalW = count * CARD_W + (count - 1) * GAP;
  const startX = (canvas.width - totalW) / 2;
  const startY = 200;
  draftBoxes = [];

  for (let i = 0; i < count; i++) {
    const x = startX + i * (CARD_W + GAP);
    const cardId = draftChoices[i];
    const def = CardDefinitions[cardId];
    if (!def) continue;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;

    let grad = ctx.createLinearGradient(x, startY, x, startY + CARD_H);
    grad.addColorStop(0, '#222633');
    grad.addColorStop(1, '#151522');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, startY, CARD_W, CARD_H, 16);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = def.color || '#5588cc';
    ctx.fillRect(x, startY, 4, CARD_H);
    ctx.strokeStyle = def.color || '#5588cc';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Key number
    ctx.fillStyle = 'rgba(68, 68, 85, 0.3)';
    ctx.font = 'bold 80px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(i + 1, x + CARD_W / 2, startY + CARD_H / 2 + 30);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(def.name, x + CARD_W / 2, startY + 40);

    ctx.fillStyle = '#44aaff';
    ctx.beginPath();
    ctx.arc(x + 30, startY + 30, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(def.cost, x + 30, startY + 36);

    ctx.fillStyle = '#aaa';
    ctx.font = '12px monospace';
    ctx.fillText(`Range: ${def.range}px`, x + CARD_W / 2, startY + 65);

    ctx.fillStyle = def.tempoShift > 0 ? '#ffaa66' : '#66ccff';
    ctx.font = '14px monospace';
    ctx.fillText((def.tempoShift > 0 ? '+' : '') + def.tempoShift + ' Tempo', x + CARD_W / 2, startY + 90);

    ctx.fillStyle = '#ff8888';
    ctx.font = '13px monospace';
    ctx.fillText(`${def.damage} DMG  |  ${def.type.toUpperCase()}`, x + CARD_W / 2, startY + 115);

    ctx.fillStyle = '#cccccc';
    ctx.font = '13px monospace';
    ui._wrapText(ctx, def.desc, x + 10, startY + 150, CARD_W - 20, 18);

    // "Click to select" hint at bottom
    ctx.fillStyle = '#44ff88';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('CLICK TO PICK', x + CARD_W / 2, startY + CARD_H - 15);

    ctx.restore();
    draftBoxes.push({ x, y: startY, w: CARD_W, h: CARD_H, idx: i });
  }
}

console.log('[Init] Game ready, starting engine.');
const engine = new Engine(update, render);
engine.start();
