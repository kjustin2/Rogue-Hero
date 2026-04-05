import { Engine } from './Engine.js';
import { EventBus, events } from './EventBus.js';
import { InputManager } from './Input.js';
import { Renderer } from './Renderer.js';
import { Player } from './player.js';
import { Chaser, Sniper, Bruiser, Turret, Teleporter, Swarm, Healer, Mirror, TempoVampire, ShieldDrone, Phantom, Blocker, Bomber, Marksman, BossBrawler, BossConductor, BossEcho, BossNecromancer, BossApex, Shrieker, Juggernaut, Stalker, Splitter, Split, Corruptor, BerserkerEnemy, RicochetDrone, Timekeeper } from './Enemy.js';
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
window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  window.CANVAS_W = canvas.width;
  window.CANVAS_H = canvas.height;
  if (room) { room.w = canvas.width; room.h = canvas.height; }
  if (ui) { ui.width = canvas.width; ui.height = canvas.height; }
});
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.CANVAS_W = canvas.width;
window.CANVAS_H = canvas.height;

const input = new InputManager(canvas);
const renderer = new Renderer(canvas);
const tempo = new TempoSystem();
const particles = new ParticleSystem();
const audio = new AudioSynthesizer();
const projectiles = new ProjectileManager();
const combat = new CombatManager(tempo, particles, audio, projectiles);
const room = new RoomManager(canvas.width, canvas.height);
const deckManager = new DeckManager();
const runManager = new RunManager();
const meta = new MetaProgress();
const itemManager = new ItemManager();
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
const FLOORS_TO_WIN = 5;

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
let pauseQuitConfirm = false;

// Discard state
let discardPendingCardId = null;
let discardReturnState = 'map';

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
events.on('PLAYER_SHOT_HIT', ({ enemy, damage, freeze }) => {
  if (!enemy.alive) return;
  combat.applyDamageToEnemy(enemy, damage);
  if (freeze && enemy.alive) enemy.stagger(1.2);
});

events.on('ENEMY_MELEE_HIT', ({ damage }) => {
  damage = Math.round(damage * (DIFFICULTY_MODS[selectedDifficulty]?.dmgMult || 1));
  const passives = Characters[selectedCharId]?.passives;
  // Frost Cold damage reduction
  if (passives?.coldDamageReduction && tempo.value < 30) {
    damage = Math.round(damage * (1 - passives.coldDamageReduction));
  }
  // Vanguard Guard stack damage reduction
  if (passives?.ironGuard && player.guardStacks > 0) {
    const reduction = Math.min(damage, passives.guardDamageReduction || 2);
    damage = Math.max(0, damage - reduction);
    player.guardStacks--;
    player._guardDecayTimer = 0;
    particles.spawnDamageNumber(player.x, player.y - 20, 'GUARD');
  }
  player.takeDamage(damage);
  // Vanguard: build guard stack on hit
  if (passives?.ironGuard && damage > 0) {
    if (player.guardStacks === undefined) player.guardStacks = 0;
    player.guardStacks = Math.min(player.guardStacks + 1, passives.maxGuardStacks || 4);
    player._guardDecayTimer = 0;
  }
  // DAMAGE_TAKEN is emitted by player.takeDamage() for Frost passive
  particles.spawnKillFlash('#ff2222');
  events.emit('HIT_STOP', 0.08);
  events.emit('SCREEN_SHAKE', { duration: 0.2, intensity: 0.4 });
  if (!player.alive) {
    // Wraith Undying: first death per room revives at 1 HP + crash
    if (passives?.undying && !player._undyingUsed) {
      player._undyingUsed = true;
      player.hp = 1;
      player.alive = true;
      tempo._triggerAccidentalCrash();
      particles.spawnCrashFlash();
      particles.spawnDamageNumber(player.x, player.y - 40, 'UNDYING!');
      return;
    }
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

events.on('REQUEST_PLAYER_POS_CRASH', ({ radius, dmg, accidental }) => {
  events.emit('CRASH_ATTACK', { x: player.x, y: player.y, radius, dmg });
  if (!accidental) runStats.manualCrashes++;
  events.emit('CRASH_TEXT', { dmg });
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
  events.emit('SCREEN_SHAKE', { duration: 0.35, intensity: 0.55 });
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

events.on('OVERLOADED', ({ x, y }) => {
  particles.spawnOverloaded(x, y);
  events.emit('PLAY_SOUND', 'miss');
});

events.on('CRASH_TEXT', ({ dmg }) => {
  particles.spawnCrashText(dmg);
  particles.spawnCrashFlash();
});

events.on('SPLITTER_DIED', ({ x, y, difficultySpdMult }) => {
  const offsets = [[30, 0], [-30, 0]];
  for (const [ox, oy] of offsets) {
    const s = new Split(x + ox, y + oy);
    s.difficultySpdMult = difficultySpdMult;
    enemies.push(s);
  }
  combat.setLists(enemies, player);
  projectiles.setEnemies(enemies);
  ui.setEnemies(enemies);
});

events.on('COLD_CRASH', ({ radius, freezeDur }) => {
  // Freeze all enemies in radius around player
  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = e.x - player.x, dy = e.y - player.y;
    if (dx * dx + dy * dy < (radius + e.r) * (radius + e.r)) {
      e.stagger(freezeDur);
    }
  }
  // Brief player invincibility
  player.dodging = true;
  player.dodgeTimer = 0.5;
  player.dodgeCooldown = Math.max(player.dodgeCooldown, 0.5);
  particles.spawnColdCrashFlash();
  particles.spawnRing && particles.spawnRing(player.x, player.y, radius, '#66ccff');
  particles.spawnDamageNumber(player.x, player.y - 40, 'COLD CRASH!');
});

events.on('COMBO_DISPLAY', ({ count, x, y }) => {
  particles.spawnComboDisplay(count, x, y);
  if (count > (runStats.highestCombo || 0)) runStats.highestCombo = count;
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

  // Seed must be set before any RNG calls
  runManager.floor = 1;
  runManager.setSeed(Date.now());

  // Pick 3 random starting cards from the pool using the run seed
  const pool = [...(charDef.startingPool || charDef.startingDeck || [])];
  const startRng = runManager.getRng();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(startRng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  deckManager.initDeck(pool.slice(0, 3));
  tempo.value = 50;
  tempo.targetValue = 50;
  tempo.setClassPassives(charDef.passives);
  itemManager.reset();
  projectiles.clear();

  roomsCleared = 0;
  totalHealedThisRun = 0;
  newUnlocks = [];
  slowMoTimer = 0;
  slowMoScale = 1.0;
  lastKillSlowTimer = 0;
  ui.prepPendingCard = null;
  ui.showInventory = false;

  runManager.generateMap();
  resetRunStats();

  ui.player = player;
  ui.setEnemies(enemies);
  combat.setLists([], player);
  gameState = 'map';
  audio.playBGM('map');
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
    } else if (f === 3) {
      enemies.push(new BossEcho(cx, cy));
    } else if (f === 4) {
      enemies.push(new BossNecromancer(cx, cy - 50));
      enemies.push(new Phantom(cx - 120, cy + 60));
      enemies.push(new Phantom(cx + 120, cy + 60));
    } else {
      enemies.push(new BossApex(cx, cy));
      enemies.push(new Blocker(cx - 160, cy));
      enemies.push(new Marksman(cx + 160, cy));
    }
  } else if (node.type === 'elite') {
    const eliteRoll = rng();
    if (f >= 3 && eliteRoll < 0.35) enemies.push(new Juggernaut(cx + 60, cy));
    else enemies.push(new Bruiser(cx + 60, cy));
    const extra = 1 + Math.floor(f * 0.5);
    for (let i = 0; i < extra; i++) {
      if (f >= 4) enemies.push(rng() < 0.5 ? new Phantom(rndX(), rndY()) : new Blocker(rndX(), rndY()));
      else if (f >= 2) enemies.push(rng() < 0.4 ? new BerserkerEnemy(rndX(), rndY()) : new Chaser(rndX(), rndY()));
      else enemies.push(new Chaser(rndX(), rndY()));
    }
    if (f >= 1 && rng() < 0.5) enemies.push(new Shrieker(rndX(), rndY()));
    if (f >= 2) enemies.push(new Healer(rndX(), rndY()));
    if (f >= 3 && rng() < 0.4) enemies.push(new TempoVampire(rndX(), rndY()));
    if (f >= 3 && rng() < 0.4) enemies.push(new Timekeeper(rndX(), rndY()));
    if (f >= 4 && rng() < 0.5) enemies.push(new Bomber(rndX(), rndY()));
    if (f >= 4 && rng() < 0.4) enemies.push(new Corruptor(rndX(), rndY()));
  } else {
    const count = 2 + Math.floor(f * 0.7) + Math.floor(rng() * 2);
    for (let i = 0; i < count; i++) {
      const roll = rng();
      if (f >= 5 && roll < 0.06) enemies.push(new Phantom(rndX(), rndY()));
      else if (f >= 5 && roll < 0.10) enemies.push(new Blocker(rndX(), rndY()));
      else if (f >= 4 && roll < 0.14) enemies.push(new Corruptor(rndX(), rndY()));
      else if (f >= 4 && roll < 0.18) enemies.push(new Marksman(rndX(), rndY()));
      else if (f >= 4 && roll < 0.22) enemies.push(new Bomber(rndX(), rndY()));
      else if (f >= 3 && roll < 0.26) enemies.push(new Timekeeper(rndX(), rndY()));
      else if (f >= 3 && roll < 0.30) enemies.push(new BerserkerEnemy(rndX(), rndY()));
      else if (f >= 3 && roll < 0.34) enemies.push(new Mirror(rndX(), rndY()));
      else if (f >= 2 && roll < 0.38) enemies.push(new Stalker(rndX(), rndY()));
      else if (f >= 2 && roll < 0.42) enemies.push(new RicochetDrone(rndX(), rndY()));
      else if (f >= 2 && roll < 0.46) enemies.push(new Teleporter(rndX(), rndY()));
      else if (f >= 1 && roll < 0.50) enemies.push(new Shrieker(rndX(), rndY()));
      else if (f >= 1 && roll < 0.54) enemies.push(new Splitter(rndX(), rndY()));
      else if (roll < 0.58) enemies.push(new TempoVampire(rndX(), rndY()));
      else if (roll < 0.63) enemies.push(new ShieldDrone(rndX(), rndY()));
      else if (roll < 0.68) enemies.push(new Healer(rndX(), rndY()));
      else if (roll < 0.74) enemies.push(new Turret(rndX(), rndY()));
      else if (roll < 0.82) {
        const sx = rndX(), sy = rndY();
        enemies.push(new Swarm(sx, sy));
        enemies.push(new Swarm(sx + 20, sy + 15));
        enemies.push(new Swarm(sx - 15, sy + 20));
        i += 2;
      }
      else if (roll < 0.91) enemies.push(new Sniper(rndX(), rndY()));
      else enemies.push(new Chaser(rndX(), rndY()));
    }
  }

  // Per-act ramp on top of difficulty mods
  const actHpRamp  = f >= 5 ? 1.5 : (f >= 4 ? 1.2 : 1.0);
  const actSpdRamp = f >= 5 ? 1.2 : (f >= 4 ? 1.1 : 1.0);
  const telegraphMult = f >= 5 ? 0.7 : (f >= 4 ? 0.82 : 1.0);
  for (const e of enemies) {
    e.hp = Math.round(e.hp * (1 + (f - 1) * 0.25) * diff.hpMult * actHpRamp);
    e.maxHp = e.hp;
    e.difficultySpdMult = (diff.spdMult || 1.0) * actSpdRamp;
    if (f >= 4) e.telegraphDuration = Math.max(0.25, e.telegraphDuration * telegraphMult);
  }

  // Set starting tempo from items
  tempo.value = itemManager.startingTempo();
  tempo.targetValue = tempo.value;
  itemManager.resetRoom();
  projectiles.clear();
  particles.particles.length = 0;
  particles.visuals.length = 0;
  // Keep screen effects — room clear banner looks good
  player.comboCount = 0;
  player.comboTimer = 0;

  combat.setLists(enemies, player);
  ui.setEnemies(enemies);
  projectiles.setEnemies(enemies);
  // Reset per-room passives
  player._undyingUsed = false;
  player.guardStacks = 0;
  player._guardDecayTimer = 0;
  
  if (node.type === 'boss') {
    audio.playBGM('boss');
  } else {
    audio.playBGM('normal');
  }
  
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

function tryAddCard(cardId, onSuccess) {
  const result = deckManager.addCard(cardId);
  if (result === 'full') {
    discardPendingCardId = cardId;
    discardReturnState = 'afterDiscard';
    gameState = 'discard';
    // Store callback as pending return action
    window._discardCallback = onSuccess;
    return false;
  }
  if (onSuccess) onSuccess();
  return true;
}

function pickDraft(idx) {
  if (idx >= draftChoices.length) return;
  const cardId = draftChoices[idx];
  console.log(`[Draft] Picked "${cardId}"`);
  tryAddCard(cardId, () => {
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
  });
}

function checkRunUnlocks(won) {
  meta.recordRun(won, runManager.floor);
  meta.recordCharRun(selectedCharId, won, runManager.floor);
  newUnlocks = [];
  if (runManager.floor >= 2 && meta.unlockCharacter('shadow')) {
    newUnlocks.push('Unlocked character: SHADOW');
  }
  if (totalHealedThisRun >= 10 && meta.unlockCharacter('frost')) {
    newUnlocks.push('Unlocked character: FROST');
  }
  if (runManager.floor >= 3 && meta.unlockCharacter('echo')) {
    newUnlocks.push('Unlocked character: ECHO');
  }
  if (won && meta.unlockCharacter('wraith')) {
    newUnlocks.push('Unlocked character: WRAITH');
  }
  if (won && selectedDifficulty >= 1 && meta.unlockCharacter('vanguard')) {
    newUnlocks.push('Unlocked character: VANGUARD');
  }
  if (won) {
    const currentMax = meta.getMaxDifficulty(selectedCharId);
    if (selectedDifficulty >= currentMax && currentMax < 2) {
      meta.unlockDifficulty(selectedCharId, currentMax + 1);
      newUnlocks.push(`Unlocked ${DIFFICULTY_NAMES[currentMax + 1]} difficulty for ${Characters[selectedCharId].name}`);
    }
    const bonusPool = ['chain_lightning', 'thunder_clap', 'phantom_step', 'blood_pact', 'iron_wall', 'execute', 'tempo_surge', 'shadow_mark', 'second_wind', 'adrenaline', 'smoke_screen', 'glass_cannon', 'reaper',
      'earthshaker', 'death_blow', 'berserkers_oath', 'last_stand', 'mirror_strike', 'deaths_bargain', 'resonant_pulse', 'snipers_mark', 'leech_field', 'soul_drain', 'marked_for_death'];
    for (const cid of bonusPool) {
      if (!meta.isBonusCardUnlocked(cid)) {
        meta.unlockBonusCard(cid);
        newUnlocks.push(`Unlocked card: ${CardDefinitions[cid].name}`);
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
  audio.playBGM('map');

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
      audio.playBGM('menu');
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
        audio.playBGM('menu');
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
    if (input.consumeKey('i') || input.consumeKey('I')) {
      ui.showInventory = !ui.showInventory;
    }
    if (input.consumeKey('escape')) {
      if (ui.showInventory) {
        ui.showInventory = false;
      } else {
        prevStateBeforePause = 'map';
        gameState = 'paused';
      }
      input.clearFrame();
      return;
    }
    if (input.consumeClick()) {
      if (ui.showInventory) { /* clicks fall through to overlay dismiss */ }
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
      audio.playBGM('menu');
    }
    input.clearFrame();
    return;
  }

  // ── PAUSED ──
  if (gameState === 'paused') {
    if (input.consumeKey('escape')) {
      if (pauseQuitConfirm) { pauseQuitConfirm = false; }
      else { gameState = prevStateBeforePause || 'playing'; }
    }
    if (input.consumeClick()) {
      const mx = input.mouse.x, my = input.mouse.y;
      for (const b of pauseMenuBoxes) {
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
          if (b.action === 'resume') { pauseQuitConfirm = false; gameState = prevStateBeforePause || 'playing'; }
          else if (b.action === 'restart') { pauseQuitConfirm = false; gameState = 'charSelect'; selectedCharId = null; audio.silenceMusic(); audio.playBGM('menu'); }
          else if (b.action === 'quit') {
            if (pauseQuitConfirm) { pauseQuitConfirm = false; gameState = 'intro'; selectedCharId = null; audio.silenceMusic(); audio.playBGM('menu'); }
            else { pauseQuitConfirm = true; }
          }
          else if (b.action === 'quit_cancel') { pauseQuitConfirm = false; }
          break;
        }
      }
    }
    input.clearFrame();
    return;
  }

  // ── EVENT ──
  if (gameState === 'event') {
    if (input.consumeKey('escape')) { gameState = 'map'; input.clearFrame(); return; }
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
    if (input.consumeKey('escape') || input.consumeKey('enter')) { gameState = 'map'; input.clearFrame(); return; }
    if (input.consumeClick()) {
      const cardId = ui.handleShopClick(input.mouse.x, input.mouse.y);
      if (cardId && player.hp > 1) {
        player.hp--;
        const addResult = deckManager.addCard(cardId);
        if (addResult === 'full') {
          discardPendingCardId = cardId;
          discardReturnState = 'shop_done';
          gameState = 'discard';
        } else {
          shopCards = shopCards.filter(c => c !== cardId);
          events.emit('PLAY_SOUND', 'itemPickup');
        }
      }
    }
    input.clearFrame();
    return;
  }

  // ── DISCARD ──
  if (gameState === 'discard') {
    if (input.consumeClick()) {
      const discardId = ui.handleDiscardClick(input.mouse.x, input.mouse.y);
      if (discardId && discardPendingCardId) {
        deckManager.removeCard(discardId);
        deckManager.addCard(discardPendingCardId);
        events.emit('PLAY_SOUND', 'itemPickup');
        console.log(`[Deck] Discarded "${discardId}", added "${discardPendingCardId}"`);
        if (window._discardCallback) {
          const cb = window._discardCallback;
          window._discardCallback = null;
          discardPendingCardId = null;
          cb();
        } else {
          discardPendingCardId = null;
          gameState = 'map';
        }
      }
    }
    input.clearFrame();
    return;
  }

  // ── ITEM REWARD ──
  if (gameState === 'itemReward') {
    if (input.consumeKey(' ') || input.consumeKey('escape')) { gameState = 'map'; }
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
    if (input.consumeKey(' ') || input.consumeKey('escape')) { gameState = 'map'; }
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
      particles.spawnRoomEntryFlash();
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
    pauseQuitConfirm = false;
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

  player.updateLogic(logicDt, input, tempo, room);
  ui.setMouse(input.mouse.x, input.mouse.y);

  // Hot dash-attack check
  combat.checkDashAttack(player, tempo.value);

  // Track recent dodge for counter_slash / riposte
  if (player.recentDodgeTimer === undefined) player.recentDodgeTimer = 0;
  if (player.dodging) player.recentDodgeTimer = 0.5;
  else player.recentDodgeTimer = Math.max(0, player.recentDodgeTimer - logicDt);

  // Speed boost timer (War Cry)
  if (player.speedBoostTimer > 0) {
    player.speedBoostTimer = Math.max(0, player.speedBoostTimer - logicDt);
  }

  // Aura effects from Corruptor and Timekeeper
  let inCorruptorAura = false;
  let inTimekeeperAura = false;
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.type === 'corruptor' && e.isPlayerInAura && e.isPlayerInAura(player)) inCorruptorAura = true;
    if (e.type === 'timekeeper' && e.isPlayerInAura && e.isPlayerInAura(player)) inTimekeeperAura = true;
  }
  player._corruptorAura = inCorruptorAura;
  player._timekeeperAura = inTimekeeperAura;

  // Vanguard Guard stack decay
  if (Characters[selectedCharId]?.passives?.ironGuard) {
    if (player.guardStacks === undefined) player.guardStacks = 0;
    player._guardDecayTimer = (player._guardDecayTimer || 0) + logicDt;
    if (player._guardDecayTimer >= 3.0 && player.guardStacks > 0) {
      player.guardStacks--;
      player._guardDecayTimer = 0;
    }
  }

  // Update enemies — pass projectile manager
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    // Bleed tick
    if (e.bleedTimer > 0) {
      e.bleedTimer -= logicDt;
      e._bleedTick = (e._bleedTick || 0) + logicDt;
      if (e._bleedTick >= 1.0) {
        e._bleedTick -= 1.0;
        e.takeDamage(e.bleedDmg || 3);
        particles.spawnDamageNumber(e.x, e.y - 10, e.bleedDmg || 3);
        if (!e.alive) {
          itemManager.onKill(tempo.value, player);
          if (e.type && e.type.startsWith('boss')) itemManager.onBossKill(player);
          enemies[i] = enemies[enemies.length - 1];
          enemies.pop();
          continue;
        }
      }
    }
    e.updateLogic(logicDt, player, tempo, room, enemies, projectiles);
    if (!e.alive) {
      // Item on-kill effects
      itemManager.onKill(tempo.value, player);
      if (e.type && e.type.startsWith('boss')) itemManager.onBossKill(player);
      // Splitter: spawn splits (updateLogic already did it — just verify)
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

    // Gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#06060e');
    bgGrad.addColorStop(1, '#0d0a1a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title glow
    ctx.save();
    ctx.shadowColor = '#4466ff';
    ctx.shadowBlur = 40;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 62px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ROGUE HERO', canvas.width / 2, 112);
    ctx.restore();

    // Subtitle bar
    ctx.fillStyle = 'rgba(68,170,255,0.12)';
    ctx.fillRect(canvas.width / 2 - 240, 122, 480, 2);
    ctx.fillStyle = '#44aaff';
    ctx.font = '15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('A Tempo-Driven Roguelike Deck Builder', canvas.width / 2, 148);

    const bx = 180, by = 172, bw = canvas.width - 360, bh = 420;
    ctx.fillStyle = 'rgba(12,12,20,0.95)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 12);
    ctx.fill();
    ctx.strokeStyle = '#1e2044';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffdd44';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HOW TO PLAY', canvas.width / 2, by + 32);

    ctx.fillStyle = '#ccc';
    ctx.font = '13px monospace';
    ctx.textAlign = 'left';
    const lines = [
      '◆ WASD/Arrows to move, SPACE to dodge towards mouse (no AP cost)',
      '◆ LEFT CLICK to attack with your selected card',
      '◆ RIGHT CLICK to cycle between equipped cards (or press 1-4)',
      '',
      '◆ THE TEMPO BAR (top center) controls your power:',
      '    COLD (<30)     = 0.7x damage — overfill to 0 → ICE CRASH: massive freeze AoE!',
      '    FLOWING (30-70) = 1.0x damage, balanced play',
      '    HOT (70-90)     = 1.3x damage, 1.2x speed, dash-attack deals damage!',
      '    CRITICAL (90+)  = 1.8x damage, attacks PIERCE — overfill to 100 → auto CRASH!',
      '',
      '◆ Perfect Dodge: dodge just as an attack lands → slow-mo + tempo boost',
      '◆ ESC key: Open pause menu during combat',
      `◆ Clear ${FLOORS_TO_WIN} acts (each ending in a unique boss) to WIN`,
      `◆ On the map screen, press [I] to view your cards & relics`,
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

    // Gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#070710');
    bgGrad.addColorStop(1, '#0d0c1c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.shadowColor = '#8866ff';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CHOOSE YOUR HERO', canvas.width / 2, 58);
    ctx.restore();

    ctx.fillStyle = 'rgba(136,102,255,0.15)';
    ctx.fillRect(canvas.width / 2 - 200, 66, 400, 2);

    ctx.fillStyle = '#555577';
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
        ctx.fillStyle = '#333';
        ctx.fillRect(x, startY, CARD_W, CARD_H);
        ctx.fillStyle = '#555';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('LOCKED', x + CARD_W / 2, startY + CARD_H / 2 - 16);
        ctx.fillStyle = '#ff6644';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(ch.name, x + CARD_W / 2, startY + CARD_H / 2 + 10);
        ctx.fillStyle = '#888';
        ctx.font = '11px monospace';
        const cond = ch.unlockConditionText || 'Complete a run to unlock';
        ui._wrapText(ctx, cond, x + 15, startY + CARD_H / 2 + 28, CARD_W - 30, 15);
      } else {
        const charStats = meta.getCharStats(ch.id);
        ctx.fillStyle = ch.color;
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ch.name, x + CARD_W / 2, startY + 40);
        ctx.fillStyle = '#aaa';
        ctx.font = '14px monospace';
        ctx.fillText(ch.title, x + CARD_W / 2, startY + 62);
        ctx.fillStyle = '#888';
        ctx.font = '11px monospace';
        ui._wrapText(ctx, ch.description, x + 15, startY + 82, CARD_W - 30, 15);
        ctx.fillStyle = '#ee4444';
        ctx.fillText(`♥ ${ch.hp} HP`, x + CARD_W / 4, startY + 155);
        ctx.fillStyle = '#44aaff';
        ctx.fillText(`⚡ ${ch.apRegen}/s AP`, x + CARD_W * 3 / 4, startY + 155);
        ctx.fillStyle = '#44ff88';
        ctx.fillText(`💨 ${ch.baseSpeed} SPD`, x + CARD_W / 2, startY + 172);
        // Starting pool preview (3 random from pool of 6)
        ctx.fillStyle = '#ffdd44';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('CARD POOL (3 random):', x + CARD_W / 2, startY + 196);
        ctx.fillStyle = '#ccc';
        ctx.font = '10px monospace';
        const pool = ch.startingPool || [];
        for (let j = 0; j < Math.min(pool.length, 6); j++) {
          const cd = CardDefinitions[pool[j]];
          if (cd) {
            const col = j % 2, row = Math.floor(j / 2);
            ctx.fillText(`${cd.name}`, x + 55 + col * 120, startY + 212 + row * 14);
          }
        }
        // Per-char stats
        ctx.fillStyle = '#555';
        ctx.font = '10px monospace';
        ctx.fillText(`Runs: ${charStats.runs}  Wins: ${charStats.wins}  Best: Act ${charStats.bestFloor}`, x + CARD_W / 2, startY + 266);
        // Difficulty unlock badges
        const maxD = meta.getMaxDifficulty(ch.id);
        for (let d = 0; d <= 2; d++) {
          ctx.fillStyle = d <= maxD ? DIFFICULTY_COLORS[d] : '#333';
          ctx.font = d <= maxD ? 'bold 10px monospace' : '10px monospace';
          ctx.fillText(DIFFICULTY_NAMES[d], x + 50 + d * 80, startY + CARD_H - 20);
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
    // Hero info bar — drawn inside the map header area
    ctx.fillStyle = ch ? ch.color : '#aaa';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${ch?.name || '?'}`, 18, 30);
    // HP bar compact
    const hpW = 140, hpH = 12;
    ctx.fillStyle = '#331111';
    ctx.fillRect(18, 38, hpW, hpH);
    ctx.fillStyle = '#ee3333';
    ctx.fillRect(18, 38, (player.hp / player.maxHp) * hpW, hpH);
    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';
    ctx.fillText(`${player.hp}/${player.maxHp} HP`, 18 + hpW + 6, 48);
    // Right side info
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'right';
    ctx.fillText(`${deckManager.collection.length}/${deckManager.MAX_DECK_SIZE} cards  |  ${itemManager.equipped.length} relics`, canvas.width - 18, 30);
    ctx.fillStyle = '#666';
    ctx.fillText(`Seed: ${runManager.seed}`, canvas.width - 18, 48);
    // Inventory button hint
    ctx.fillStyle = ui.showInventory ? '#44ff88' : '#555';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[I] Inventory', canvas.width / 2, canvas.height - 16);
    // Inventory overlay
    if (ui.showInventory) {
      ui.width = canvas.width;
      ui.height = canvas.height;
      ui.drawInventoryOverlay(ctx);
    }
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

  // ── DISCARD (standalone, not overlaid) ──
  if (gameState === 'discard' && discardPendingCardId) {
    renderer.clear();
    ui.width = canvas.width; ui.height = canvas.height;
    ui.setMouse(input.mouse.x, input.mouse.y);
    ui.drawDiscardScreen(renderer.ctx, discardPendingCardId);
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
    ui.newUnlocks = newUnlocks;
    ui.drawStatsScreen(renderer.ctx, runStats, score, meta.getLeaderboard());
    return;
  }

  // ── COMBAT / PREP / DRAFT / PAUSED render the room ──
  const now = performance.now();
  renderer.beginShakeScope();
  room.draw(renderer.ctx);
  for (const e of enemies) {
    e.drawTelegraph(renderer.ctx, now);
    e._drawIntentIcon(renderer.ctx, now);
  }
  if (gameState === 'playing') {
    combat.drawRangeIndicator(renderer.ctx, player, deckManager.hand, CardDefinitions, selectedCardSlot);
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
    // Floor / difficulty badge — top right (below minimap)
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(canvas.width - 115, 105, 103, 38);
    ctx.fillStyle = '#888';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Act ${runManager.floor}/${FLOORS_TO_WIN}`, canvas.width - 63, 120);
    ctx.fillStyle = DIFFICULTY_COLORS[selectedDifficulty] || '#888';
    ctx.fillText(DIFFICULTY_NAMES[selectedDifficulty], canvas.width - 63, 135);
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
  } else if (gameState === 'discard') {
    ui.width = canvas.width; ui.height = canvas.height;
    ui.setMouse(input.mouse.x, input.mouse.y);
    ui.drawDiscardScreen(renderer.ctx, discardPendingCardId);
  }
}

function drawDraftScreen() {
  const ctx = renderer.ctx;

  // Gradient background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bgGrad.addColorStop(0, '#08080f');
  bgGrad.addColorStop(1, '#0d0d18');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#44ff88';
  ctx.font = 'bold 46px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ROOM CLEARED!', canvas.width / 2, 75);

  ctx.fillStyle = 'rgba(68,255,136,0.12)';
  ctx.fillRect(0, 82, canvas.width, 2);

  ctx.fillStyle = '#aaa';
  ctx.font = '15px monospace';
  const hint = draftChoices.length < 3 ? `Only ${draftChoices.length} card(s) left to discover!` : 'Choose a new card for your deck.';
  ctx.fillText(hint, canvas.width / 2, 116);

  const CARD_W = 210, CARD_H = 290, GAP = 44;
  const count = draftChoices.length;
  const totalW = count * CARD_W + (count - 1) * GAP;
  const startX = (canvas.width - totalW) / 2;
  const startY = 152;
  draftBoxes = [];

  for (let i = 0; i < count; i++) {
    const x = startX + i * (CARD_W + GAP);
    const cardId = draftChoices[i];
    const def = CardDefinitions[cardId];
    if (!def) continue;

    const rarCol = def.rarity === 'rare' ? '#bb44ff' : (def.rarity === 'uncommon' ? '#44dd88' : '#888899');
    const rarLabel = def.rarity ? def.rarity.toUpperCase() : 'COMMON';

    ctx.save();
    ctx.shadowColor = def.rarity === 'rare' ? 'rgba(187,68,255,0.4)' : (def.rarity === 'uncommon' ? 'rgba(68,221,136,0.3)' : 'rgba(0,0,0,0.6)');
    ctx.shadowBlur = def.rarity === 'rare' ? 30 : 18;
    ctx.shadowOffsetY = 8;

    let grad = ctx.createLinearGradient(x, startY, x, startY + CARD_H);
    grad.addColorStop(0, '#22263a');
    grad.addColorStop(1, '#14141f');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, startY, CARD_W, CARD_H, 14);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    // Rarity top bar
    ctx.fillStyle = rarCol;
    ctx.fillRect(x, startY, CARD_W, 4);
    // Left color stripe
    ctx.fillStyle = def.color || '#5588cc';
    ctx.fillRect(x, startY + 4, 4, CARD_H - 4);
    ctx.strokeStyle = rarCol;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, startY, CARD_W, CARD_H, 14);
    ctx.stroke();

    // Key hint + rarity badge
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`[${i + 1}]`, x + CARD_W - 10, startY + 20);

    ctx.fillStyle = rarCol;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(rarLabel, x + 14, startY + 20);

    // Card name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(def.name, x + CARD_W / 2, startY + 42);

    // Divider
    ctx.strokeStyle = (def.color || '#5588cc') + '88';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 14, startY + 50); ctx.lineTo(x + CARD_W - 14, startY + 50); ctx.stroke();

    // AP badge
    ctx.fillStyle = '#44aaff';
    ctx.beginPath();
    ctx.arc(x + 20, startY + 70, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(def.cost, x + 20, startY + 75);

    // Tempo shift
    ctx.fillStyle = def.tempoShift > 0 ? '#ffaa55' : '#55bbff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText((def.tempoShift > 0 ? '+' : '') + def.tempoShift + ' TEMPO', x + CARD_W / 2 + 10, startY + 78);

    // Type + range
    ctx.fillStyle = def.color || '#888';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(def.type.toUpperCase(), x + CARD_W / 2, startY + 98);
    ctx.fillStyle = '#667';
    ctx.font = '11px monospace';
    ctx.fillText(`${def.range}px range`, x + CARD_W / 2, startY + 113);

    // DMG
    if (def.damage > 0) {
      ctx.fillStyle = '#ff9988';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`${def.damage} DMG`, x + CARD_W / 2, startY + 138);
    }

    // Description
    ctx.fillStyle = '#bbbbc8';
    ctx.font = '11px monospace';
    ui._wrapText(ctx, def.desc, x + 12, startY + 165, CARD_W - 24, 15);

    // Pick CTA
    ctx.fillStyle = rarCol;
    ctx.font = 'bold 12px monospace';
    ctx.fillText('CLICK TO PICK', x + CARD_W / 2, startY + CARD_H - 14);

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
  const panelW = 380, panelH = pauseQuitConfirm ? 300 : 340;
  const px = (canvas.width - panelW) / 2;
  const py = (canvas.height - panelH) / 2;

  ctx.fillStyle = '#0e0e1a';
  ctx.beginPath();
  ctx.roundRect(px, py, panelW, panelH, 16);
  ctx.fill();
  ctx.strokeStyle = '#44aaff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(px, py, panelW, panelH, 16);
  ctx.stroke();

  pauseMenuBoxes = [];

  if (pauseQuitConfirm) {
    ctx.fillStyle = '#ff5555';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('QUIT TO MENU?', canvas.width / 2, py + 55);
    ctx.fillStyle = '#888';
    ctx.font = '13px monospace';
    ctx.fillText('Your run progress will be lost.', canvas.width / 2, py + 82);

    const btnW = 160, btnH = 48, btnGap = 20;
    const totalW = btnW * 2 + btnGap;
    const confirmBtns = [
      { label: 'YES, QUIT', action: 'quit', color: '#ff5555', bg: '#2e1a1a', x: (canvas.width - totalW) / 2 },
      { label: 'CANCEL', action: 'quit_cancel', color: '#44ff88', bg: '#1a2e22', x: (canvas.width - totalW) / 2 + btnW + btnGap },
    ];
    const by = py + 120;
    for (const btn of confirmBtns) {
      ctx.fillStyle = btn.bg;
      ctx.beginPath();
      ctx.roundRect(btn.x, by, btnW, btnH, 8);
      ctx.fill();
      ctx.strokeStyle = btn.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = btn.color;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(btn.label, btn.x + btnW / 2, by + 31);
      pauseMenuBoxes.push({ x: btn.x, y: by, w: btnW, h: btnH, action: btn.action });
    }

    ctx.fillStyle = '#444';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press ESC to cancel', canvas.width / 2, py + panelH - 18);
    return;
  }

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', canvas.width / 2, py + 52);

  const buttons = [
    { label: 'RESUME', action: 'resume', color: '#44ff88', bg: '#1a2e22' },
    { label: 'RESTART RUN', action: 'restart', color: '#ffaa44', bg: '#2e2a1a' },
    { label: 'QUIT TO MENU', action: 'quit', color: '#ff5555', bg: '#2e1a1a' },
  ];

  const btnW = 270, btnH = 50, btnGap = 16;
  const btnStartY = py + 88;

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

  ctx.fillStyle = '#444';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Press ESC to resume', canvas.width / 2, py + panelH - 18);
}

window.addEventListener('click', () => {
  if (gameState === 'intro' && audio.currentBgm !== 'Main_Menu.wav') {
    audio.init();
    audio.playBGM('intro');
  }
});

window.addEventListener('keydown', () => {
  if (gameState === 'intro' && audio.currentBgm !== 'Main_Menu.wav') {
    audio.init();
    audio.playBGM('intro');
  }
});

console.log('[Init] Game ready, starting engine.');
const engine = new Engine(update, render);
engine.start();
