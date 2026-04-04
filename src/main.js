import { Engine } from './Engine.js';
import { EventBus, events } from './EventBus.js';
import { InputManager } from './Input.js';
import { Renderer } from './Renderer.js';
import { Player } from './player.js';
import { Chaser, Sniper, Bruiser, Turret, Teleporter, Swarm, Healer, Mirror, TempoVampire, ShieldDrone, BossBrawler, BossConductor, BossEcho } from './Enemy.js';
import { TempoSystem } from './tempo.js';
import { CombatManager } from './Combat.js';
import { ParticleSystem } from './Particles.js';
import { AudioSynthesizer } from './audio.js';
import { UI } from './ui.js';
import { RoomManager } from './room.js';
import { DeckManager, CardDefinitions } from './DeckManager.js';
import { RunManager } from './RunManager.js';
import { MetaProgress, calculateScore } from './MetaProgress.js';
import { Characters, CharacterList, DIFFICULTY_NAMES, DIFFICULTY_COLORS, DIFFICULTY_MODS } from './Characters.js';
import { ItemManager, ItemDefinitions } from './Items.js';
import { ProjectileManager } from './Projectile.js';

// Expose itemDefs for UI (avoids circular import)
window._itemDefs = ItemDefinitions;

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
const itemManager = new ItemManager();
const projectiles = new ProjectileManager();
console.log('[Init] All systems created. Cards:', Object.keys(CardDefinitions).length, 'Items:', Object.keys(ItemDefinitions).length);

let player = new Player(400, 360);
let enemies = [];
combat.setLists(enemies, player);
const ui = new UI(canvas, tempo, player, deckManager, CardDefinitions);
ui.setItemManager(itemManager);

// Link tempo to items
tempo.itemManager = itemManager;

// Game states: intro, charSelect, map, prep, playing, draft, dead, victory, itemReward, event, shop, upgrade, stats
let gameState = 'intro';
let draftChoices = [];
let roomsCleared = 0;
let currentCombatNode = null;
let selectedCharId = null;
let selectedDifficulty = 0;
let totalHealedThisRun = 0;
let newUnlocks = [];
const FLOORS_TO_WIN = 3;

// Active card slot (left-click fires this, right-click cycles)
let selectedCardSlot = 0;

// Slow-mo state
let slowMoTimer = 0;
let slowMoScale = 1.0;

// Item reward state
let itemChoices = [];
let upgradeChoices = [];
let shopCards = [];

// Last-kill slow-mo
let lastKillSlowTimer = 0;

// Pause menu
let pauseMenuBoxes = [];
let prevStateBeforePause = null;

// Run stats
let runStats = {
  kills: 0, roomsCleared: 0, perfectDodges: 0, cardsPlayed: 0,
  manualCrashes: 0, itemsCollected: 0, elapsedTime: 0,
  floor: 1, difficulty: 0, won: false, character: '', highestCombo: 0,
  seed: 0
};

function resetRunStats() {
  runStats = {
    kills: 0, roomsCleared: 0, perfectDodges: 0, cardsPlayed: 0,
    manualCrashes: 0, itemsCollected: 0, elapsedTime: 0,
    floor: 1, difficulty: selectedDifficulty, won: false,
    character: selectedCharId || '', highestCombo: 0,
    seed: runManager.seed
  };
}

// ── Event Handlers ──────────────────────────────────────────────
events.on('ENEMY_MELEE_HIT', ({ damage }) => {
  damage = Math.round(damage * (DIFFICULTY_MODS[selectedDifficulty]?.dmgMult || 1));
  // Frost Cold damage reduction
  const passives = Characters[selectedCharId]?.passives;
  if (passives?.coldDamageReduction && tempo.value < 30) {
    damage = Math.round(damage * (1 - passives.coldDamageReduction));
  }
  player.takeDamage(damage);
  particles.spawnKillFlash('#ff2222');
  events.emit('HIT_STOP', 0.08);
  events.emit('SCREEN_SHAKE', { duration: 0.2, intensity: 0.4 });
  if (!player.alive) {
    // Last Rites check
    if (itemManager.onDeath(tempo.value, player)) {
      console.log('[Items] Last Rites triggered — revived!');
      return;
    }
    console.log(`[Event] Player DIED Floor ${runManager.floor}, ${roomsCleared} rooms`);
    runStats.floor = runManager.floor;
    checkRunUnlocks(false);
    gameState = 'stats';
    runStats.won = false;
  }
});

events.on('REQUEST_PLAYER_POS_CRASH', ({ radius, dmg }) => {
  events.emit('CRASH_ATTACK', { x: player.x, y: player.y, radius, dmg });
  runStats.manualCrashes++;
});

events.on('KILL', () => { runStats.kills++; });

events.on('PERFECT_DODGE', () => {
  runStats.perfectDodges++;
  particles.spawnPerfectDodge(player.x, player.y);
  particles.spawnDamageNumber(player.x, player.y - 30, 'PERFECT!');
});

events.on('NEAR_MISS_PROJECTILE', ({ x, y }) => {
  if (player.checkPerfectDodge()) {
    // Perfect dodge was triggered
  }
});

events.on('ZONE_TRANSITION', ({ oldZone, newZone }) => {
  particles.spawnZonePulse(tempo.stateColor());
  particles.spawnStateLabel(newZone, tempo.stateColor());
});

events.on('LAST_KILL', ({ x, y }) => {
  lastKillSlowTimer = 0.4;
  particles.spawnLastKill();
  particles.spawnRoomClear();
});

events.on('SLOW_MO', ({ dur, scale }) => {
  slowMoTimer = dur;
  slowMoScale = scale;
});

events.on('PLAYER_TRAIL', ({ x, y, color }) => {
  particles.spawnTrail(x, y, color);
});

events.on('DRAIN', () => {
  particles.spawnDamageNumber(player.x, player.y - 20, '-20 TEMPO');
});

// ── Helpers ─────────────────────────────────────────────────────
function startNewRun() {
  const charDef = Characters[selectedCharId];
  player = new Player(400, 360);
  player.hp = charDef.hp;
  player.maxHp = charDef.maxHp;
  player.apRegen = charDef.apRegen;
  player.BASE_SPEED = charDef.baseSpeed;
  player.setClassPassives(charDef.passives);

  deckManager.initDeck(charDef.startingDeck);
  tempo.value = 50;
  tempo.setClassPassives(charDef.passives);
  itemManager.reset();
  projectiles.clear();

  roomsCleared = 0;
  totalHealedThisRun = 0;
  newUnlocks = [];
  slowMoTimer = 0;
  slowMoScale = 1.0;
  lastKillSlowTimer = 0;

  runManager.floor = 1;
  runManager.setSeed(Date.now());
  runManager.generateMap();
  resetRunStats();

  ui.player = player;
  ui.setEnemies(enemies);
  combat.setLists([], player);
  gameState = 'map';
  audio.silenceMusic();
  console.log(`[Run] New run as "${selectedCharId}" difficulty=${DIFFICULTY_NAMES[selectedDifficulty]} seed=${runManager.seed}`);
}

function spawnEnemies(node) {
  enemies = [];
  const f = runManager.floor;
  const diff = DIFFICULTY_MODS[selectedDifficulty] || DIFFICULTY_MODS[0];
  const rng = runManager.getRng();
  function rndX() { return room.FLOOR_X1 + 100 + rng() * (room.FLOOR_X2 - room.FLOOR_X1 - 200); }
  function rndY() { return room.FLOOR_Y1 + 80 + rng() * (room.FLOOR_Y2 - room.FLOOR_Y1 - 160); }
  const cx = (room.FLOOR_X1 + room.FLOOR_X2) / 2;
  const cy = (room.FLOOR_Y1 + room.FLOOR_Y2) / 2;

  // Generate room variant
  room.generateVariant(f, rng);

  if (node.type === 'boss') {
    if (f === 1) {
      enemies.push(new BossBrawler(cx, cy - 50));
    } else if (f === 2) {
      enemies.push(new BossConductor(cx, cy - 50));
      enemies.push(new ShieldDrone(cx - 100, cy + 60));
      enemies.push(new ShieldDrone(cx + 100, cy + 60));
    } else {
      enemies.push(new BossEcho(cx, cy));
    }
  } else if (node.type === 'elite') {
    enemies.push(new Bruiser(cx + 60, cy));
    const extra = 1 + Math.floor(f * 0.6);
    for (let i = 0; i < extra; i++) enemies.push(new Chaser(rndX(), rndY()));
    if (f >= 2) enemies.push(new Healer(rndX(), rndY()));
    if (rng() < 0.3) enemies.push(new TempoVampire(rndX(), rndY()));
  } else {
    const count = 2 + Math.floor(f * 0.8) + Math.floor(rng() * 2);
    for (let i = 0; i < count; i++) {
      const roll = rng();
      if (f >= 3 && roll < 0.06) enemies.push(new Mirror(rndX(), rndY()));
      else if (f >= 2 && roll < 0.12) enemies.push(new Teleporter(rndX(), rndY()));
      else if (roll < 0.18) enemies.push(new TempoVampire(rndX(), rndY()));
      else if (roll < 0.25) enemies.push(new ShieldDrone(rndX(), rndY()));
      else if (roll < 0.32) enemies.push(new Healer(rndX(), rndY()));
      else if (roll < 0.42) enemies.push(new Turret(rndX(), rndY()));
      else if (roll < 0.52) {
        const sx = rndX(), sy = rndY();
        enemies.push(new Swarm(sx, sy));
        enemies.push(new Swarm(sx + 20, sy + 15));
        enemies.push(new Swarm(sx - 15, sy + 20));
        i += 2;
      }
      else if (roll < 0.72) enemies.push(new Sniper(rndX(), rndY()));
      else enemies.push(new Chaser(rndX(), rndY()));
    }
  }

  for (const e of enemies) {
    e.hp = Math.round(e.hp * (1 + (f - 1) * 0.25) * diff.hpMult);
    e.maxHp = e.hp;
    e.difficultySpdMult = diff.spdMult || 1.0;
  }

  // Set starting tempo from items
  tempo.value = itemManager.startingTempo();
  itemManager.resetRoom();
  projectiles.clear();

  combat.setLists(enemies, player);
  ui.setEnemies(enemies);
  console.log(`[Spawn] "${node.type}" F${f}: ${enemies.length} enemies [${enemies.map(e=>e.type).join(',')}]`);
}

function getAvailableCards() {
  const owned = deckManager.collection;
  return Object.keys(CardDefinitions).filter(id => {
    if (owned.includes(id)) return false;
    const def = CardDefinitions[id];
    if (def.bonusCard && !meta.isBonusCardUnlocked(id)) return false;
    return true;
  });
}

function generateDraft() {
  const available = getAvailableCards();
  available.sort(() => Math.random() - 0.5);
  draftChoices = available.slice(0, Math.min(3, available.length));
  console.log(`[Draft] Offering: [${draftChoices.join(', ')}] (${available.length} avail)`);
  if (draftChoices.length === 0) return false;
  return true;
}

function pickDraft(idx) {
  if (idx >= draftChoices.length) return;
  deckManager.addCard(draftChoices[idx]);
  console.log(`[Draft] Picked "${draftChoices[idx]}"`);
  // After draft — offer item reward every other room, upgrade every 3 rooms
  if (roomsCleared % 2 === 0) {
    itemChoices = itemManager.generateChoices(3);
    if (itemChoices.length > 0) { gameState = 'itemReward'; return; }
  }
  if (roomsCleared > 0 && roomsCleared % 3 === 0) {
    upgradeChoices = deckManager.getUpgradeChoices();
    if (upgradeChoices.length > 0) { gameState = 'upgrade'; return; }
  }
  gameState = 'map';
}

function checkRunUnlocks(won) {
  meta.recordRun(won, runManager.floor);
  newUnlocks = [];
  if (runManager.floor >= 2 && meta.unlockCharacter('shadow')) {
    newUnlocks.push('🗡️ Unlocked character: SHADOW');
  }
  if (totalHealedThisRun >= 10 && meta.unlockCharacter('frost')) {
    newUnlocks.push('❄️ Unlocked character: FROST');
  }
  if (won) {
    const currentMax = meta.getMaxDifficulty(selectedCharId);
    if (selectedDifficulty >= currentMax && currentMax < 2) {
      meta.unlockDifficulty(selectedCharId, currentMax + 1);
      newUnlocks.push(`⚔️ Unlocked ${DIFFICULTY_NAMES[currentMax + 1]} difficulty for ${Characters[selectedCharId].name}`);
    }
    const bonusPool = ['chain_lightning', 'thunder_clap', 'phantom_step', 'blood_pact', 'iron_wall', 'execute', 'tempo_surge', 'shadow_mark'];
    for (const cid of bonusPool) {
      if (!meta.isBonusCardUnlocked(cid)) {
        meta.unlockBonusCard(cid);
        newUnlocks.push(`🃏 Unlocked card: ${CardDefinitions[cid].name}`);
        break;
      }
    }
  }
  if (newUnlocks.length > 0) console.log('[Meta] Unlocks:', newUnlocks);
}

function handleCombatClear() {
  roomsCleared++;
  runStats.roomsCleared = roomsCleared;
  console.log(`[Combat] Cleared! Total: ${roomsCleared}`);
  audio.silenceMusic();

  if (currentCombatNode && currentCombatNode.type === 'boss') {
    if (runManager.floor >= FLOORS_TO_WIN) {
      console.log('[Run] VICTORY! All floors cleared.');
      runStats.won = true;
      runStats.floor = runManager.floor;
      checkRunUnlocks(true);
      gameState = 'stats';
      currentCombatNode = null;
      return;
    }
    runManager.floor++;
    console.log(`[Run] Floor cleared! Now Floor ${runManager.floor}`);
    runManager.generateMap();
  }
  currentCombatNode = null;

  if (gameState === 'playing') {
    if (generateDraft()) gameState = 'draft';
    else gameState = 'map';
  }
}

function handleEvent(choiceIdx) {
  switch (choiceIdx) {
    case 0: // Trade 1 HP → random relic
      if (player.hp > 1) {
        player.hp--;
        const choices = itemManager.generateChoices(1);
        if (choices.length > 0) {
          itemManager.add(choices[0], player, tempo);
          runStats.itemsCollected++;
          events.emit('PLAY_SOUND', 'itemPickup');
          particles.spawnDamageNumber(player.x || 640, 300, `Got: ${ItemDefinitions[choices[0]].name}`);
        }
      }
      break;
    case 1: // Heal 2 HP
      player.heal(2);
      break;
    case 2: // Gamble
      if (Math.random() < 0.5) { player.heal(2); }
      else { player.hp = Math.max(1, player.hp - 1); }
      break;
  }
  gameState = 'map';
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
  runStats.elapsedTime += realDt;

  // Apply slow-mo
  if (slowMoTimer > 0) {
    slowMoTimer -= realDt;
    logicDt *= slowMoScale;
  }
  if (lastKillSlowTimer > 0) {
    lastKillSlowTimer -= realDt;
    logicDt *= 0.3;
  }

  // ── INTRO ──
  if (gameState === 'intro') {
    if (input.consumeKey('enter')) {
      audio.init();
      gameState = 'charSelect';
    }
    // Only advance when clicking the CONTINUE button (not anywhere)
    if (input.consumeClick()) {
      const btnW = 260, btnH = 50;
      const btnX = (canvas.width - btnW) / 2;
      const btnY = 618;
      const mx = input.mouse.x, my = input.mouse.y;
      if (mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH) {
        audio.init();
        gameState = 'charSelect';
      }
    }
    input.clearFrame();
    return;
  }

  // ── CHARACTER SELECT ──
  if (gameState === 'charSelect') {
    if (input.consumeClick()) {
      const result = handleCharSelectClick(input.mouse.x, input.mouse.y);
      if (result === 'start' && selectedCharId) startNewRun();
    }
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
        } else if (node.type === 'event') {
          gameState = 'event';
        } else if (node.type === 'shop') {
          const available = getAvailableCards();
          available.sort(() => Math.random() - 0.5);
          shopCards = available.slice(0, Math.min(4, available.length));
          gameState = 'shop';
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

  // ── STATS (replaces dead/victory) ──
  if (gameState === 'stats') {
    if (input.consumeKey('enter') || input.consumeClick()) {
      gameState = 'charSelect';
      selectedCharId = null;
    }
    input.clearFrame();
    return;
  }

  // ── PAUSED ──
  if (gameState === 'paused') {
    if (input.consumeKey('escape')) {
      gameState = prevStateBeforePause || 'playing';
    }
    if (input.consumeClick()) {
      const mx = input.mouse.x, my = input.mouse.y;
      for (const b of pauseMenuBoxes) {
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
          if (b.action === 'resume') gameState = prevStateBeforePause || 'playing';
          else if (b.action === 'restart') { gameState = 'charSelect'; selectedCharId = null; audio.silenceMusic(); }
          else if (b.action === 'quit') { gameState = 'charSelect'; selectedCharId = null; audio.silenceMusic(); }
          break;
        }
      }
    }
    input.clearFrame();
    return;
  }

  // ── EVENT ──
  if (gameState === 'event') {
    for (let i = 0; i < 3; i++) {
      if (input.consumeKey((i + 1).toString())) { handleEvent(i); break; }
    }
    if (input.consumeClick()) {
      const idx = ui.handleEventClick(input.mouse.x, input.mouse.y);
      if (idx >= 0) handleEvent(idx);
    }
    input.clearFrame();
    return;
  }

  // ── SHOP ──
  if (gameState === 'shop') {
    if (input.consumeKey('enter')) { gameState = 'map'; }
    if (input.consumeClick()) {
      const cardId = ui.handleShopClick(input.mouse.x, input.mouse.y);
      if (cardId && player.hp > 1) {
        player.hp--;
        deckManager.addCard(cardId);
        shopCards = shopCards.filter(c => c !== cardId);
        events.emit('PLAY_SOUND', 'itemPickup');
      }
    }
    input.clearFrame();
    return;
  }

  // ── ITEM REWARD ──
  if (gameState === 'itemReward') {
    if (input.consumeKey(' ')) { gameState = 'map'; }
    if (input.consumeClick()) {
      const itemId = ui.handleItemClick(input.mouse.x, input.mouse.y);
      if (itemId) {
        itemManager.add(itemId, player, tempo);
        runStats.itemsCollected++;
        events.emit('PLAY_SOUND', 'itemPickup');
        // Check if upgrade is due
        if (roomsCleared > 0 && roomsCleared % 3 === 0) {
          upgradeChoices = deckManager.getUpgradeChoices();
          if (upgradeChoices.length > 0) { gameState = 'upgrade'; input.clearFrame(); return; }
        }
        gameState = 'map';
      }
    }
    input.clearFrame();
    return;
  }

  // ── UPGRADE ──
  if (gameState === 'upgrade') {
    if (input.consumeKey(' ')) { gameState = 'map'; }
    if (input.consumeClick()) {
      const cardId = ui.handleUpgradeClick(input.mouse.x, input.mouse.y);
      if (cardId) {
        deckManager.upgradeCard(cardId);
        events.emit('PLAY_SOUND', 'upgrade');
        gameState = 'map';
      }
    }
    input.clearFrame();
    return;
  }

  // ── DRAFT ──
  if (gameState === 'draft') {
    for (let i = 0; i < draftChoices.length; i++) {
      if (input.consumeKey((i + 1).toString())) { pickDraft(i); break; }
    }
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
  // ESC → pause menu
  if (input.consumeKey('escape')) {
    prevStateBeforePause = 'playing';
    gameState = 'paused';
    input.clearFrame();
    return;
  }

  tempo.update(logicDt);
  combat.update(logicDt);
  itemManager.update(logicDt);
  ui.update(logicDt);
  audio.updateTempoHum(tempo.value, true);

  // Right-click: cycle selected card slot
  if (input.consumeRightClick()) {
    selectedCardSlot = (selectedCardSlot + 1) % 4;
  }
  // Number keys still work as quick-select
  for (let i = 0; i < 4; i++) {
    if (input.consumeKey((i + 1).toString())) {
      selectedCardSlot = i;
    }
  }

  // Left-click: use the currently selected card
  if (input.consumeClick()) {
    const cardId = deckManager.hand[selectedCardSlot];
    if (cardId) {
      const def = deckManager.getCardDef(cardId);
      if (player.budget >= def.cost) {
        combat.executeCard(player, def, input.mouse);
        runStats.cardsPlayed++;
      }
      else events.emit('PLAY_SOUND', 'miss');
    }
  }

  // Manual Tempo Crash (F key)
  if (input.consumeKey('f')) {
    if (tempo.manualCrash({ x: player.x, y: player.y })) {
      runStats.manualCrashes++;
    }
  }

  player.updateLogic(logicDt, input, tempo, room);

  // Hot dash-attack check
  combat.checkDashAttack(player, tempo.value);

  // Update enemies — pass projectile manager
  for (let i = enemies.length - 1; i >= 0; i--) {
    enemies[i].updateLogic(logicDt, player, tempo, room, enemies, projectiles);
    if (!enemies[i].alive) {
      // Item on-kill effects
      itemManager.onKill(tempo.value, player);
      enemies[i] = enemies[enemies.length - 1];
      enemies.pop();
    }
  }

  // Update projectiles
  projectiles.update(logicDt, player, room);

  // Check enemy melee near-miss for perfect dodge
  if (player.dodging && player.perfectDodgeWindow > 0) {
    for (const e of enemies) {
      if (!e.alive) continue;
      if (e.state === 'telegraph') {
        const dx = e.x - player.x, dy = e.y - player.y;
        if (dx * dx + dy * dy < (e.r + player.r + 30) * (e.r + player.r + 30)) {
          player.checkPerfectDodge();
          break;
        }
      }
    }
  }

  // Room clear check
  if (enemies.length === 0 && gameState === 'playing') {
    handleCombatClear();
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

    const bx = 200, by = 200, bw = canvas.width - 400, bh = 400;
    ctx.fillStyle = '#111118';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#334';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    ctx.fillStyle = '#ffdd44';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('HOW TO PLAY', canvas.width / 2, by + 35);

    ctx.fillStyle = '#ccc';
    ctx.font = '13px monospace';
    ctx.textAlign = 'left';
    const lines = [
      '◆ WASD/Arrows to move, SPACE to dodge (i-frames, no AP cost)',
      '◆ LEFT CLICK to attack with your selected card',
      '◆ RIGHT CLICK to cycle between equipped cards (or press 1-4)',
      '◆ F key: Manual Tempo Crash at 85+ Tempo (huge AoE burst)',
      '',
      '◆ THE TEMPO BAR (top center) controls your power:',
      '    COLD (<30)     = 0.7x damage, safe dodges, stagger enemies',
      '    FLOWING (30-70) = 1.0x damage, balanced play',
      '    HOT (70-90)     = 1.3x damage, 1.2x speed, dash-attack deals damage!',
      '    CRITICAL (90+)  = 1.8x damage, attacks PIERCE, but auto-crash risk!',
      '',
      '◆ Perfect Dodge: dodge just as an attack lands → slow-mo + tempo boost',
      '◆ ESC key: Open pause menu during combat',
      `◆ Clear ${FLOORS_TO_WIN} floors (each ending in a unique boss) to WIN`,
      '◆ Collect relics, upgrade cards, unlock new characters & difficulties',
    ];
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], bx + 25, by + 65 + i * 22);
    }

    // CONTINUE button
    const btnW = 260, btnH = 50;
    const btnX = (canvas.width - btnW) / 2;
    const btnY = by + bh + 10;
    ctx.fillStyle = '#225533';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 10);
    ctx.fill();
    ctx.strokeStyle = '#33dd66';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#33dd66';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CONTINUE', canvas.width / 2, btnY + 33);
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
      ctx.fillStyle = unlocked ? ch.color : '#333';
      ctx.fillRect(x, startY, 5, CARD_H);

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
        ctx.fillStyle = '#ee4444';
        ctx.fillText(`♥ ${ch.hp} HP`, x + CARD_W / 4, startY + 170);
        ctx.fillStyle = '#44aaff';
        ctx.fillText(`⚡ ${ch.apRegen}/s AP`, x + CARD_W * 3 / 4, startY + 170);
        ctx.fillStyle = '#44ff88';
        ctx.fillText(`💨 ${ch.baseSpeed} SPD`, x + CARD_W / 2, startY + 190);
        ctx.fillStyle = '#ffdd44';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('STARTING DECK:', x + CARD_W / 2, startY + 215);
        ctx.fillStyle = '#ccc';
        ctx.font = '11px monospace';
        for (let j = 0; j < ch.startingDeck.length; j++) {
          const cd = CardDefinitions[ch.startingDeck[j]];
          if (cd) ctx.fillText(`• ${cd.name} (${cd.cost}AP, ${cd.type})`, x + CARD_W / 2, startY + 235 + j * 16);
        }
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

    if (selectedCharId) {
      const btnY = startY + CARD_H + 30;
      const diffBtnX = canvas.width / 2 - 160, diffBtnW = 150, diffBtnH = 40;
      const ctx2 = renderer.ctx;
      ctx2.fillStyle = '#1a1a28';
      ctx2.fillRect(diffBtnX, btnY, diffBtnW, diffBtnH);
      ctx2.strokeStyle = DIFFICULTY_COLORS[selectedDifficulty];
      ctx2.lineWidth = 2;
      ctx2.strokeRect(diffBtnX, btnY, diffBtnW, diffBtnH);
      ctx2.fillStyle = DIFFICULTY_COLORS[selectedDifficulty];
      ctx2.font = 'bold 16px monospace';
      ctx2.textAlign = 'center';
      ctx2.fillText(DIFFICULTY_NAMES[selectedDifficulty], diffBtnX + diffBtnW / 2, btnY + 26);
      charSelectBoxes.push({ x: diffBtnX, y: btnY, w: diffBtnW, h: diffBtnH, action: 'difficulty' });

      const startBtnX = canvas.width / 2 + 10, startBtnW = 180, startBtnH = 44;
      ctx2.fillStyle = '#225533';
      ctx2.beginPath();
      ctx2.roundRect(startBtnX, btnY, startBtnW, startBtnH, 8);
      ctx2.fill();
      ctx2.strokeStyle = '#44ff88';
      ctx2.lineWidth = 2;
      ctx2.stroke();
      ctx2.fillStyle = '#44ff88';
      ctx2.font = 'bold 18px monospace';
      ctx2.fillText('START RUN', startBtnX + startBtnW / 2, btnY + 29);
      charSelectBoxes.push({ x: startBtnX, y: btnY, w: startBtnW, h: startBtnH, action: 'start' });
    } else {
      const ctx2 = renderer.ctx;
      ctx2.fillStyle = '#555';
      ctx2.font = '16px monospace';
      ctx2.textAlign = 'center';
      ctx2.fillText('Click a hero to select them', canvas.width / 2, startY + CARD_H + 50);
    }

    const bonusCards = meta.state.unlockedBonusCards;
    if (bonusCards.length > 0) {
      const ctx2 = renderer.ctx;
      ctx2.fillStyle = '#555';
      ctx2.font = '11px monospace';
      ctx2.textAlign = 'center';
      ctx2.fillText(`Bonus Cards Unlocked: ${bonusCards.map(c => CardDefinitions[c]?.name || c).join(', ')}`, canvas.width / 2, canvas.height - 20);
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
    const relicCount = itemManager.equipped.length;
    ctx.fillText(`${ch?.name || 'Hero'}  |  HP: ${player.hp}/${player.maxHp}  |  Cards: ${deckManager.collection.length}  |  Relics: ${relicCount}  |  Floor ${runManager.floor}/${FLOORS_TO_WIN}`, 20, canvas.height - 40);
    return;
  }

  // ── EVENT ──
  if (gameState === 'event') {
    ui.drawEventScreen(renderer.ctx);
    return;
  }

  // ── SHOP ──
  if (gameState === 'shop') {
    ui.drawShopScreen(renderer.ctx, shopCards, CardDefinitions);
    return;
  }

  // ── ITEM REWARD ──
  if (gameState === 'itemReward') {
    ui.drawItemReward(renderer.ctx, itemChoices, ItemDefinitions);
    return;
  }

  // ── UPGRADE ──
  if (gameState === 'upgrade') {
    ui.drawUpgradeScreen(renderer.ctx, upgradeChoices);
    return;
  }

  // ── STATS ──
  if (gameState === 'stats') {
    const score = calculateScore(runStats);
    meta.submitScore({
      score, character: runStats.character, floor: runStats.floor,
      difficulty: runStats.difficulty, seed: runStats.seed,
      date: new Date().toISOString()
    });
    ui.drawStatsScreen(renderer.ctx, runStats, score, meta.getLeaderboard());
    return;
  }

  // ── COMBAT / PREP / DRAFT / PAUSED render the room ──
  const now = performance.now();
  renderer.beginShakeScope();
  room.draw(renderer.ctx);
  for (const e of enemies) e.drawTelegraph(renderer.ctx, now);
  if (gameState === 'playing') {
    combat.drawRangeIndicator(renderer.ctx, player, deckManager.hand, CardDefinitions);
    combat.drawReticles(renderer.ctx, deckManager.hand, CardDefinitions, now);
  }
  for (const e of enemies) e.draw(renderer.ctx, now);
  projectiles.draw(renderer.ctx);
  player.draw(renderer.ctx, tempo);
  particles.draw(renderer.ctx, canvas.width, canvas.height);
  renderer.endShakeScope();

  if (gameState === 'playing' || gameState === 'paused') {
    ui.selectedCardSlot = selectedCardSlot;
    ui.draw(renderer.ctx);
    const ctx = renderer.ctx;
    ctx.fillStyle = '#555';
    ctx.font = '12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Floor ${runManager.floor}/${FLOORS_TO_WIN}  |  Rooms: ${roomsCleared}  |  ${DIFFICULTY_NAMES[selectedDifficulty]}`, canvas.width - 20, 20);
    // Touch controls
    input.drawTouchControls(ctx);
  }

  // ── OVERLAYS ──
  if (gameState === 'paused') {
    drawPauseMenu();
  } else if (gameState === 'draft') {
    drawDraftScreen();
  } else if (gameState === 'prep') {
    ui.drawPrepScreen(renderer.ctx);
  }
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

    ctx.fillStyle = '#44ff88';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('CLICK TO PICK', x + CARD_W / 2, startY + CARD_H - 15);

    ctx.restore();
    draftBoxes.push({ x, y: startY, w: CARD_W, h: CARD_H, idx: i });
  }
}
function drawPauseMenu() {
  const ctx = renderer.ctx;

  // Dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Panel
  const panelW = 360, panelH = 320;
  const px = (canvas.width - panelW) / 2;
  const py = (canvas.height - panelH) / 2;

  ctx.fillStyle = '#111118';
  ctx.beginPath();
  ctx.roundRect(px, py, panelW, panelH, 16);
  ctx.fill();
  ctx.strokeStyle = '#44aaff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', canvas.width / 2, py + 50);

  pauseMenuBoxes = [];

  const buttons = [
    { label: 'RESUME', action: 'resume', color: '#44ff88', bg: '#1a2e22' },
    { label: 'RESTART RUN', action: 'restart', color: '#ffaa44', bg: '#2e2a1a' },
    { label: 'QUIT TO MENU', action: 'quit', color: '#ff5555', bg: '#2e1a1a' },
  ];

  const btnW = 260, btnH = 50, btnGap = 18;
  const btnStartY = py + 90;

  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    const bx = (canvas.width - btnW) / 2;
    const by = btnStartY + i * (btnH + btnGap);

    ctx.fillStyle = btn.bg;
    ctx.beginPath();
    ctx.roundRect(bx, by, btnW, btnH, 8);
    ctx.fill();
    ctx.strokeStyle = btn.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = btn.color;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(btn.label, canvas.width / 2, by + 32);

    pauseMenuBoxes.push({ x: bx, y: by, w: btnW, h: btnH, action: btn.action });
  }

  ctx.fillStyle = '#555';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Press ESC to resume', canvas.width / 2, py + panelH - 20);
}

console.log('[Init] Game ready, starting engine.');
const engine = new Engine(update, render);
engine.start();
