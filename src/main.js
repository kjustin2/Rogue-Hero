import { Engine } from './Engine.js';
import { EventBus, events } from './EventBus.js';
import { InputManager } from './Input.js';
import { Renderer } from './Renderer.js';
import { Player } from './player.js';
import { Chaser, Sniper, Bruiser, Turret, Teleporter, Swarm, Healer, Mirror, TempoVampire, ShieldDrone, Phantom, Blocker, Bomber, Marksman, BossBrawler, BossConductor, BossEcho, BossNecromancer, BossApex, Shrieker, Juggernaut, Stalker, Splitter, Split, Corruptor, BerserkerEnemy, RicochetDrone, Timekeeper, Disruptor, Sentinel, BossArchivist } from './Enemy.js';
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
// Restore saved volume
audio.setMasterVolume(meta.getMasterVolume());

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
let currentEventType = 'standard'; // 'standard' | 'merchant' | 'blacksmith'
let noDashCardsUsedThisRun = true; // for cross-run unlock tracking
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
let pauseShowControls = false;

// Intro screen state
let introResetConfirm = false;
let introBoxes = [];

// Discard state
let discardPendingCardId = null;
let discardReturnState = 'map';

// Zone transition first-time tooltip
let seenZones = new Set();
let zoneTooltip = null; // { text, color, timer }

// Rest node state
let restChoiceBoxes = [];

// World effect arrays
let traps = [];
let orbs = [];
let echoes = [];
let sigils = [];
let groundWaves = [];
let beamFlashes = [];
let channelState = null;
let _lastCardPlayed = null; // for aftershock echo

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
events.on('PLAYER_SHOT_HIT', ({ enemy, damage, freeze, clusterAoE, executeLowShot, hitX, hitY }) => {
  if (!enemy.alive) return;
  let finalDmg = damage;
  if (executeLowShot && (enemy.hp / (enemy.maxHp || enemy.hp)) < executeLowShot) {
    finalDmg = enemy.hp;
    particles.spawnDamageNumber(enemy.x, enemy.y - 30, 'EXECUTE!');
  }
  combat.applyDamageToEnemy(enemy, finalDmg);
  if (freeze && enemy.alive) enemy.stagger(1.2);
  if (clusterAoE > 0) {
    const cx = hitX ?? enemy.x, cy = hitY ?? enemy.y;
    particles.spawnRing(cx, cy, clusterAoE, '#ffbb44');
    for (const e of enemies) {
      if (!e.alive || e === enemy) continue;
      const dx = e.x - cx, dy = e.y - cy;
      if (dx * dx + dy * dy < clusterAoE * clusterAoE) {
        combat.applyDamageToEnemy(e, Math.round(damage * 0.6));
      }
    }
  }
});

events.on('ENEMY_MELEE_HIT', ({ damage, source }) => {
  // Parry check
  if (player.parryWindow && player.parryWindow.timer > 0) {
    player.parryWindow.timer = 0;
    events.emit('COUNTER_STRIKE', { source, power: player.parryWindow.power, def: player.parryWindow.def });
    particles.spawnDamageNumber(player.x, player.y - 30, 'PARRY!');
    events.emit('HIT_STOP', 0.15);
    events.emit('SCREEN_SHAKE', { duration: 0.2, intensity: 0.3 });
    events.emit('PLAY_SOUND', 'perfect');
    return;
  }
  // Blood Rune sigil trigger
  for (let si = sigils.length - 1; si >= 0; si--) {
    if (sigils[si].def.sigilTrigger === 'takeDamage' && !sigils[si].triggered) {
      sigils[si].triggered = true;
      player.heal(2);
      tempo._add(30);
      particles.spawnDamageNumber(player.x, player.y - 40, 'BLOOD RUNE!');
      particles.spawnBurst(player.x, player.y, '#ff2255');
    }
  }
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
    runStats.finalDeck = [...deckManager.collection];
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

const ZONE_TIPS = {
  COLD:     { text: 'COLD ZONE — 0.7× damage. Ice cards deal 3× here!', color: '#4a9eff' },
  FLOWING:  { text: 'FLOWING ZONE — balanced 1.0× damage.', color: '#44dd88' },
  HOT:      { text: 'HOT ZONE — 1.3× damage, 1.2× speed. Dash attacks deal damage!', color: '#ff8833' },
  CRITICAL: { text: 'CRITICAL ZONE — 1.8× damage, attacks pierce. Watch your tempo!', color: '#ff3333' },
};
events.on('ZONE_TRANSITION', ({ oldZone, newZone }) => {
  particles.spawnZonePulse(tempo.stateColor());
  particles.spawnStateLabel(newZone, tempo.stateColor());
  if (!seenZones.has(newZone) && ZONE_TIPS[newZone]) {
    seenZones.add(newZone);
    zoneTooltip = { text: ZONE_TIPS[newZone].text, color: ZONE_TIPS[newZone].color, timer: 3.5 };
  }
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

events.on('RELIC_ACTIVATED', ({ name, text }) => {
  const label = text ? `${name}: ${text}` : name;
  particles.spawnDamageNumber(player.x, player.y - 55, label);
});

events.on('PLAYER_SILENCED', ({ duration }) => {
  player.silenced = true;
  player.silenceTimer = duration;
  particles.spawnDamageNumber(player.x, player.y - 40, 'SILENCED!');
  particles.spawnBurst(player.x, player.y, '#cc44ff');
  events.emit('SCREEN_SHAKE', { duration: 0.2, intensity: 0.3 });
  events.emit('HIT_STOP', 0.1);
});

events.on('OVERLOADED', ({ x, y }) => {
  particles.spawnOverloaded(x, y);
  events.emit('PLAY_SOUND', 'miss');
});

events.on('CRASH_TEXT', ({ dmg }) => {
  particles.spawnCrashText(dmg);
  particles.spawnCrashFlash();
  // Trigger crash runes
  for (const s of sigils) {
    if (s.def && s.def.sigilTrigger === 'crash' && !s.triggered) {
      s.triggered = true;
      _fireSigil(s);
    }
  }
});

events.on('SPAWN_TRAP', (data) => { traps.push({ ...data, triggered: false }); });
events.on('SPAWN_ORBS', ({ count, radius, damage, life, speed, color, freeze, spiral }) => {
  for (let i = 0; i < count; i++) {
    orbs.push({
      angle: (i / count) * Math.PI * 2,
      baseRadius: radius,
      radius,
      speed,
      damage,
      life,
      maxLife: life,
      color,
      freeze,
      spiral,
      hitCooldowns: new WeakMap(),
    });
  }
});
events.on('SPAWN_ECHO', (data) => { echoes.push({ ...data, timer: data.delay }); });
events.on('SPAWN_SIGIL', (data) => {
  // Max 2 sigils; remove oldest if needed
  if (sigils.length >= 2) sigils.shift();
  sigils.push({ ...data, triggered: false });
});
events.on('START_CHANNEL', ({ def, dmgMult }) => {
  channelState = { def, dmgMult, tickTimer: 0, apTimer: 0 };
});
events.on('SPAWN_GROUND_WAVE', (data) => {
  groundWaves.push({
    ...data,
    traveled: 0,
    hitEnemies: new Set(),
    zoneLife: 0,
    zoneX: 0, zoneY: 0,
  });
});
events.on('SPAWN_BEAM_FLASH', (data) => {
  beamFlashes.push({ ...data, life: 0.12, maxLife: 0.12 });
});
events.on('COUNTER_STRIKE', ({ source, power, def }) => {
  if (!source || !source.alive) return;
  if (def && def.counterPct) {
    const pctDmg = Math.round(source.maxHp * def.counterPct);
    combat.applyDamageToEnemy(source, pctDmg);
    particles.spawnDamageNumber(source.x, source.y - 20, `${pctDmg} DMG`);
  } else if (power > 0) {
    combat.applyDamageToEnemy(source, power);
    particles.spawnDamageNumber(source.x, source.y - 20, `${power} DMG`);
  }
  particles.spawnBurst(source.x, source.y, '#ffdd44');
  if (def && def.counterStagger && source.alive) source.stagger(def.counterStagger);
  if (def && def.counterReset) {
    tempo.setValue(50);
    player.dodging = true;
    player.dodgeTimer = 1.0;
    player.dodgeCooldown = 1.0;
  }
  particles.spawnDamageNumber(player.x, player.y - 30, 'COUNTER!');
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
  noDashCardsUsedThisRun = true;
  newUnlocks = [];
  slowMoTimer = 0;
  slowMoScale = 1.0;
  lastKillSlowTimer = 0;
  seenZones = new Set();
  zoneTooltip = null;
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
      // 30% chance to face The Archivist instead of BossEcho
      if (Math.random() < 0.3) {
        enemies.push(new BossArchivist(cx, cy));
      } else {
        enemies.push(new BossEcho(cx, cy));
      }
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
    const eliteEnemy = f >= 3 && eliteRoll < 0.35 ? new Juggernaut(cx + 60, cy) : new Bruiser(cx + 60, cy);
    // Apply a random elite modifier
    const modRoll = rng();
    const modType = modRoll < 0.35 ? 'armored' : (modRoll < 0.7 ? 'berserk' : 'regenerating');
    eliteEnemy.applyEliteModifier(modType);
    enemies.push(eliteEnemy);
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
      else if (f >= 2 && roll < 0.33) enemies.push(new Sentinel(rndX(), rndY()));
      else if (f >= 3 && roll < 0.34) enemies.push(new Mirror(rndX(), rndY()));
      else if (f >= 2 && roll < 0.38) enemies.push(new Stalker(rndX(), rndY()));
      else if (f >= 2 && roll < 0.42) enemies.push(new RicochetDrone(rndX(), rndY()));
      else if (f >= 2 && roll < 0.46) enemies.push(new Disruptor(rndX(), rndY()));
      else if (f >= 2 && roll < 0.50) enemies.push(new Teleporter(rndX(), rndY()));
      else if (f >= 1 && roll < 0.54) enemies.push(new Shrieker(rndX(), rndY()));
      else if (f >= 1 && roll < 0.58) enemies.push(new Splitter(rndX(), rndY()));
      else if (roll < 0.63) enemies.push(new TempoVampire(rndX(), rndY()));
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
  player.silenced = false;
  player.silenceTimer = 0;
  traps.length = 0;
  orbs.length = 0;
  echoes.length = 0;
  sigils.length = 0;
  groundWaves.length = 0;
  beamFlashes.length = 0;
  channelState = null;
  
  if (node.type === 'boss') {
    audio.playBGM('boss');
  } else {
    audio.playBGM('normal');
  }
  
  if (window.DEBUG) console.log(`[Spawn] "${node.type}" F${f}: ${enemies.length} enemies [${enemies.map(e=>e.type).join(',')}]`);
}

function getAvailableCards() {
  const owned = deckManager.collection;
  return Object.keys(CardDefinitions).filter(id => {
    if (owned.includes(id)) return false;
    const def = CardDefinitions[id];
    // Bonus cards require bonus card unlock OR mastery unlock
    if (def.bonusCard) {
      if (meta.isBonusCardUnlocked(id)) return true;
      if (meta.isMasteryCardUnlocked(id)) return true;
      return false;
    }
    return true;
  });
}

function generateDraft() {
  const available = getAvailableCards();
  // Fisher-Yates partial shuffle — O(k) instead of O(N log N) sort
  const k = Math.min(3, available.length);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(Math.random() * (available.length - i));
    const tmp = available[i]; available[i] = available[j]; available[j] = tmp;
  }
  draftChoices = available.slice(0, k);
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
      itemChoices = itemManager.generateChoices(3, selectedCharId);
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

  // Character mastery unlock
  if (selectedCharId) {
    const newMasteryLevel = meta.incrementMastery(selectedCharId);
    if (newMasteryLevel > 0) {
      const charDef = Characters[selectedCharId];
      const cardId = charDef && charDef.masteryCards && charDef.masteryCards[newMasteryLevel - 1];
      if (cardId && meta.unlockMasteryCard(cardId)) {
        const cardName = CardDefinitions[cardId]?.name || cardId;
        newUnlocks.push(`${charDef.name} Mastery Lv${newMasteryLevel}: Unlocked "${cardName}"`);
      }
    }
  }
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
      'earthshaker', 'death_blow', 'berserkers_oath', 'last_stand', 'mirror_strike', 'deaths_bargain', 'resonant_pulse', 'snipers_mark', 'leech_field', 'soul_drain', 'marked_for_death',
      'sunbeam', 'tempo_blade_beam', 'volatile_rune_trap', 'death_spiral', 'lightning_arc_chan', 'crash_rune', 'resonance_rune', 'blood_rune', 'time_bomb', 'judgment_line', 'riposte_blade_counter', 'perfect_guard', 'death_sentence_counter', 'tempo_shift_stance'];
    for (const cid of bonusPool) {
      if (!meta.isBonusCardUnlocked(cid)) {
        meta.unlockBonusCard(cid);
        newUnlocks.push(`Unlocked card: ${CardDefinitions[cid].name}`);
        break;
      }
    }
  }

  // Cross-run achievement unlocks
  if (won && noDashCardsUsedThisRun && meta.setAchievement('win_no_dash')) {
    // Unlock cursed cards pool
    const cursedPool = ['soul_siphon', 'void_hex', 'cursed_spiral', 'forbidden_surge'];
    for (const cid of cursedPool) {
      if (!meta.isBonusCardUnlocked(cid)) {
        meta.unlockBonusCard(cid);
        newUnlocks.push(`Achievement: No-Dash Win! Unlocked cursed card: ${CardDefinitions[cid]?.name || cid}`);
      }
    }
  }
  if (runStats.perfectDodges >= 15 && meta.setAchievement('dodge_master')) {
    newUnlocks.push('Achievement: Dodge Master (15 perfect dodges in one run)!');
  }
  if (runStats.highestCombo >= 10 && meta.setAchievement('combo_king')) {
    newUnlocks.push('Achievement: Combo King (10+ hit combo)!');
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
      runStats.finalDeck = [...deckManager.collection];
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

function _fireSigil(s) {
  const { x, y, def, dmg } = s;
  particles.spawnRing(x, y, def.sigilAoE || 150, def.color || '#ff4400');
  particles.spawnBurst(x, y, def.color || '#ff4400');
  events.emit('PLAY_SOUND', 'crash');
  switch (def.sigilTrigger) {
    case 'enterHot':
    case 'crash': {
      for (const e of enemies) {
        if (!e.alive) continue;
        const dx = e.x - x, dy = e.y - y;
        if (dx*dx+dy*dy < (def.sigilAoE||150)**2) combat.applyDamageToEnemy(e, dmg);
      }
      if (def.id === 'crash_rune') {
        events.emit('SPAWN_ORBS', { count: 4, radius: 80, damage: 12, life: 3.0, speed: 3.5, color: '#ff2200', freeze: 0, spiral: false });
      }
      break;
    }
    case 'enterCold': {
      for (const e of enemies) {
        if (!e.alive) continue;
        const dx = e.x - x, dy = e.y - y;
        if (dx*dx+dy*dy < (def.sigilAoE||200)**2) e.stagger(def.sigilFreeze || 2.5);
      }
      break;
    }
    case 'resonance': {
      player._resonanceActive = 3.0;
      particles.spawnDamageNumber(x, y - 30, 'RESONANCE!');
      break;
    }
  }
  events.emit('SCREEN_SHAKE', { duration: 0.3, intensity: 0.5 });
}

function _fireChannelTick(ch, dmgMult) {
  const def = ch.def;
  const dmg = Math.round(def.tickDamage * dmgMult);
  const range = def.channelRange || 120;
  tempo._add(def.tempoShift || 2);
  switch (def.channelType) {
    case 'cone': {
      const adx = input.mouse.x - player.x, ady = input.mouse.y - player.y;
      const alen = Math.sqrt(adx*adx+ady*ady) || 1;
      const nx = adx/alen, ny = ady/alen;
      for (const e of enemies) {
        if (!e.alive) continue;
        const ex = e.x - player.x, ey = e.y - player.y;
        const proj = ex*nx + ey*ny;
        if (proj < 0 || proj > range) continue;
        const perp = Math.abs(ex*ny - ey*nx);
        if (perp < 40 + e.r) {
          combat.applyDamageToEnemy(e, dmg);
          particles.spawnBurst(e.x, e.y, '#ff5500');
        }
      }
      particles.spawnBurst(player.x + nx*range*0.6, player.y + ny*range*0.6, '#ff550088');
      break;
    }
    case 'arc': {
      let nearest = null, nearestDist = Infinity;
      for (const e of enemies) {
        if (!e.alive) continue;
        const dx = e.x - player.x, dy = e.y - player.y;
        const d = Math.sqrt(dx*dx+dy*dy);
        if (d < range + e.r && d < nearestDist) { nearest = e; nearestDist = d; }
      }
      if (nearest) {
        combat.applyDamageToEnemy(nearest, dmg);
        particles.spawnSlash(player.x, player.y, nearest.x, nearest.y, '#ffff44');
        // Chain to secondary
        let secondary = null, sDist = Infinity;
        for (const e of enemies) {
          if (!e.alive || e === nearest) continue;
          const dx = e.x - nearest.x, dy = e.y - nearest.y;
          const d = Math.sqrt(dx*dx+dy*dy);
          if (d < 150 && d < sDist) { secondary = e; sDist = d; }
        }
        if (secondary) {
          combat.applyDamageToEnemy(secondary, Math.round(dmg * 1.5));
          particles.spawnSlash(nearest.x, nearest.y, secondary.x, secondary.y, '#ffff88');
        }
      }
      break;
    }
    case 'drain': {
      const adx = input.mouse.x - player.x, ady = input.mouse.y - player.y;
      const alen = Math.sqrt(adx*adx+ady*ady) || 1;
      const nx = adx/alen, ny = ady/alen;
      for (const e of enemies) {
        if (!e.alive) continue;
        const ex = e.x - player.x, ey = e.y - player.y;
        const proj = ex*nx + ey*ny;
        if (proj < 0 || proj > range) continue;
        const perp = Math.abs(ex*ny - ey*nx);
        if (perp < 12 + e.r) {
          combat.applyDamageToEnemy(e, dmg);
          tempo._add(3);
          particles.spawnBurst(e.x, e.y, '#cc44cc');
        }
      }
      particles.spawnBurst(player.x + nx*range*0.5, player.y + ny*range*0.5, '#cc44cc88');
      break;
    }
  }
}

function handleEvent(choiceIdx) {
  if (currentEventType === 'merchant') {
    switch (choiceIdx) {
      case 0: // Sell oldest card for +3 HP
        if (deckManager.collection.length > 1) {
          const sold = deckManager.collection[0];
          deckManager.removeCard(sold);
          player.heal(3);
          particles.spawnDamageNumber(player.x || 640, 300, `Sold "${CardDefinitions[sold]?.name || sold}" +3 HP`);
          events.emit('PLAY_SOUND', 'upgrade');
        }
        break;
      case 1: // Trade 1 HP → relic
        if (player.hp > 1) {
          player.hp--;
          const choices = itemManager.generateChoices(1, selectedCharId);
          if (choices.length > 0) {
            itemManager.add(choices[0], player, tempo);
            runStats.itemsCollected++;
            events.emit('PLAY_SOUND', 'itemPickup');
            particles.spawnDamageNumber(player.x || 640, 300, `Got: ${ItemDefinitions[choices[0]].name}`);
          }
        }
        break;
      case 2: break; // pass
    }
  } else if (currentEventType === 'blacksmith') {
    switch (choiceIdx) {
      case 0: // Free upgrade
        upgradeChoices = deckManager.getUpgradeChoices();
        if (upgradeChoices.length > 0) { gameState = 'upgrade'; return; }
        break;
      case 1: // Forge warmth — heal 1 HP
        player.heal(1);
        break;
      case 2: break; // pass
    }
  } else {
    // Standard event
    switch (choiceIdx) {
      case 0: // Trade 1 HP → random relic
        if (player.hp > 1) {
          player.hp--;
          const choices = itemManager.generateChoices(1, selectedCharId);
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
    if (input.consumeClick()) {
      const mx = input.mouse.x, my = input.mouse.y;
      for (const b of introBoxes) {
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
          if (b.action === 'continue') { audio.init(); audio.playBGM('menu'); gameState = 'charSelect'; }
          else if (b.action === 'vol_down') { const v = Math.max(0, audio.getMasterVolume() - 0.1); audio.setMasterVolume(v); meta.setMasterVolume(v); }
          else if (b.action === 'vol_up')   { const v = Math.min(1, audio.getMasterVolume() + 0.1); audio.setMasterVolume(v); meta.setMasterVolume(v); }
          else if (b.action === 'reset_confirm') { introResetConfirm = true; }
          else if (b.action === 'reset_do') { meta.resetAll(); introResetConfirm = false; }
          else if (b.action === 'reset_cancel') { introResetConfirm = false; }
          else if (b.action === 'exit') { window.close(); }
          break;
        }
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
          restChoiceBoxes = [];
          gameState = 'rest';
        } else if (node.type === 'event') {
          const r = Math.random();
          currentEventType = r < 0.4 ? 'merchant' : (r < 0.7 ? 'blacksmith' : 'standard');
          gameState = 'event';
        } else if (node.type === 'shop') {
          const available = getAvailableCards();
          const sk = Math.min(4, available.length);
          for (let i = 0; i < sk; i++) {
            const j = i + Math.floor(Math.random() * (available.length - i));
            const tmp = available[i]; available[i] = available[j]; available[j] = tmp;
          }
          shopCards = available.slice(0, sk);
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
          if (b.action === 'resume') { pauseQuitConfirm = false; pauseShowControls = false; gameState = prevStateBeforePause || 'playing'; }
          else if (b.action === 'controls') { pauseShowControls = !pauseShowControls; pauseQuitConfirm = false; }
          else if (b.action === 'restart') { pauseQuitConfirm = false; pauseShowControls = false; gameState = 'charSelect'; selectedCharId = null; audio.silenceMusic(); audio.playBGM('menu'); }
          else if (b.action === 'quit') {
            if (pauseQuitConfirm) { pauseQuitConfirm = false; gameState = 'intro'; selectedCharId = null; audio.silenceMusic(); audio.playBGM('menu'); }
            else { pauseQuitConfirm = true; }
          }
          else if (b.action === 'quit_cancel') { pauseQuitConfirm = false; }
          else if (b.action === 'vol_down') { const v = Math.max(0, audio.getMasterVolume() - 0.1); audio.setMasterVolume(v); meta.setMasterVolume(v); }
          else if (b.action === 'vol_up')   { const v = Math.min(1, audio.getMasterVolume() + 0.1); audio.setMasterVolume(v); meta.setMasterVolume(v); }
          break;
        }
      }
    }
    input.clearFrame();
    return;
  }

  // ── REST ──
  if (gameState === 'rest') {
    if (input.consumeKey('escape')) { gameState = 'map'; input.clearFrame(); return; }
    if (input.consumeClick()) {
      const mx = input.mouse.x, my = input.mouse.y;
      for (const b of restChoiceBoxes) {
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
          if (b.action === 'heal') {
            player.heal(3);
            console.log(`[Rest] Healed 3 HP: ${player.hp}/${player.maxHp}`);
            gameState = 'map';
          } else if (b.action === 'burn') {
            if (deckManager.collection.length > 1) {
              discardPendingCardId = '__BURN__';
              discardReturnState = 'map';
              gameState = 'discard';
            }
          }
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
        events.emit('PLAY_SOUND', 'itemPickup');
        if (discardPendingCardId === '__BURN__') {
          // Rest node burn: just remove, don't add a replacement
          console.log(`[Rest] Burned card "${discardId}"`);
          discardPendingCardId = null;
          gameState = 'map';
        } else {
          deckManager.addCard(discardPendingCardId);
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
    pauseShowControls = false;
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

  // Silence timer
  if (player.silenced) {
    player.silenceTimer = Math.max(0, (player.silenceTimer || 0) - logicDt);
    if (player.silenceTimer <= 0) player.silenced = false;
  }

  // Update hand resonance type for combat bonuses — only recompute when hand changes
  if (deckManager._resonanceDirty) {
    player._resonanceType = deckManager.getHandResonanceType();
    deckManager._resonanceDirty = false;
  }

  // Left-click: use the currently selected card
  if (input.consumeClick()) {
    if (player.silenced) {
      particles.spawnDamageNumber(player.x, player.y - 30, 'SILENCED!');
      events.emit('PLAY_SOUND', 'miss');
    } else {
      const cardId = deckManager.hand[selectedCardSlot];
      if (cardId) {
        const def = deckManager.getCardDef(cardId);
        if (player.budget >= def.cost) {
          combat.executeCard(player, def, input.mouse);
          runStats.cardsPlayed++;
          if (def.type !== 'echo') _lastCardPlayed = def;
          if (def.type === 'dash') noDashCardsUsedThisRun = false;
        }
        else events.emit('PLAY_SOUND', 'miss');
      }
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

  // Update parry window
  if (player.parryWindow) {
    player.parryWindow.timer -= logicDt;
    if (player.parryWindow.timer <= 0) player.parryWindow = null;
  }

  // Update resonance timer
  if (player._resonanceActive > 0) player._resonanceActive -= logicDt;

  // Update traps
  for (let i = traps.length - 1; i >= 0; i--) {
    const t = traps[i];
    t.life -= logicDt;
    if (t.life <= 0) { traps.splice(i, 1); continue; }
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - t.x, dy = e.y - t.y;
      if (dx * dx + dy * dy < (t.radius + e.r) ** 2) {
        // Trigger
        if (t.damage > 0) combat.applyDamageToEnemy(e, t.damage);
        if (t.stagger > 0 && e.alive) e.stagger(t.stagger);
        if (t.freeze > 0 && e.alive) e.stagger(t.freeze);
        if (t.aoe > 0) {
          for (const oe of enemies) {
            if (!oe.alive || oe === e) continue;
            const odx = oe.x - t.x, ody = oe.y - t.y;
            if (odx * odx + ody * ody < t.aoe * t.aoe) {
              const aoeDmg = t.volatile && tempo.value >= 90 ? t.damage * 2 : t.damage;
              if (aoeDmg > 0) combat.applyDamageToEnemy(oe, aoeDmg);
              if (t.stagger > 0 && oe.alive) oe.stagger(t.stagger);
            }
          }
        }
        particles.spawnBurst(t.x, t.y, t.color || '#ffaa44');
        particles.spawnRing(t.x, t.y, Math.max(t.radius, t.aoe || 0) + 20, t.color || '#ffaa44');
        events.emit('PLAY_SOUND', 'heavyHit');
        traps.splice(i, 1);
        break;
      }
    }
  }

  // Update orbs
  const ORB_HIT_COOLDOWN = 0.4;
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    o.life -= logicDt;
    if (o.life <= 0) { orbs.splice(i, 1); continue; }
    o.angle += o.speed * logicDt;
    if (o.spiral) {
      const t = 1 - o.life / o.maxLife;
      o.radius = o.baseRadius + (o.baseRadius * 2) * t;
    }
    const ox = player.x + Math.cos(o.angle) * o.radius;
    const oy = player.y + Math.sin(o.angle) * o.radius;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - ox, dy = e.y - oy;
      if (dx * dx + dy * dy < (8 + e.r) ** 2) {
        const now2 = performance.now();
        const lastHit = o.hitCooldowns.get(e) || 0;
        if (now2 - lastHit > ORB_HIT_COOLDOWN * 1000) {
          o.hitCooldowns.set(e, now2);
          combat.applyDamageToEnemy(e, o.damage);
          if (o.freeze > 0 && e.alive) e.stagger(o.freeze);
          particles.spawnBurst(ox, oy, o.color);
        }
      }
    }
  }

  // Update echoes
  for (let i = echoes.length - 1; i >= 0; i--) {
    const echo = echoes[i];
    echo.timer -= logicDt;
    if (echo.timer > 0) continue;
    // Execute echo
    const { x, y, def, dmg, inputX, inputY } = echo;
    switch (def.echoType) {
      case 'melee': {
        let nearest = null, nearestDist = Infinity;
        for (const e of enemies) {
          if (!e.alive) continue;
          const dx = e.x - x, dy = e.y - y;
          const d = Math.sqrt(dx*dx+dy*dy);
          if (d < (def.range || 90) + e.r && d < nearestDist) { nearest = e; nearestDist = d; }
        }
        if (nearest) {
          combat.applyDamageToEnemy(nearest, dmg);
          particles.spawnSlash(x, y, nearest.x, nearest.y, def.color || '#cc88ff');
        }
        particles.spawnBurst(x, y, def.color || '#cc88ff');
        break;
      }
      case 'nova': {
        for (const e of enemies) {
          if (!e.alive) continue;
          const dx = e.x - x, dy = e.y - y;
          if (dx*dx+dy*dy < (def.range||160)**2) {
            combat.applyDamageToEnemy(e, dmg);
            if (e.alive) e.stagger(1.0);
          }
        }
        particles.spawnRing(x, y, def.range||160, def.color||'#aaeeff');
        break;
      }
      case 'bomb': {
        const bombDmg = Math.round(dmg * (1 + tempo.value / 100));
        for (const e of enemies) {
          if (!e.alive) continue;
          const dx = e.x - x, dy = e.y - y;
          if (dx*dx+dy*dy < (def.range||150)**2) {
            combat.applyDamageToEnemy(e, bombDmg);
          }
        }
        particles.spawnRing(x, y, def.range||150, '#ffcc00');
        particles.spawnBurst(x, y, '#ffcc00');
        events.emit('SCREEN_SHAKE', { duration: 0.3, intensity: 0.6 });
        events.emit('HIT_STOP', 0.15);
        break;
      }
      case 'dash': {
        let nearest = null, nearestDist = Infinity;
        for (const e of enemies) {
          if (!e.alive) continue;
          const dx = e.x - x, dy = e.y - y;
          const d = Math.sqrt(dx*dx+dy*dy);
          if (d < 300 && d < nearestDist) { nearest = e; nearestDist = d; }
        }
        if (nearest) {
          combat.applyDamageToEnemy(nearest, dmg);
          particles.spawnSlash(x, y, nearest.x, nearest.y, def.color||'#88aaff');
          particles.spawnBurst(nearest.x, nearest.y, def.color||'#88aaff');
        }
        break;
      }
      case 'repeat': {
        if (_lastCardPlayed) {
          const fakePlayer = { x, y, budget: 999, comboCount: player.comboCount, recentDodgeTimer: 0, guardStacks: 0, oathStacks: 0 };
          combat.setLists(enemies, fakePlayer);
          combat.executeCard(fakePlayer, _lastCardPlayed, { x: inputX, y: inputY });
          combat.setLists(enemies, player);
        }
        break;
      }
    }
    particles.spawnBurst(x, y, def.color || '#cc88ff');
    events.emit('PLAY_SOUND', 'heavyHit');
    echoes.splice(i, 1);
  }

  // Update sigils (check Tempo triggers)
  for (let i = sigils.length - 1; i >= 0; i--) {
    const s = sigils[i];
    if (s.triggered) { sigils.splice(i, 1); continue; }
    let fire = false;
    switch (s.def.sigilTrigger) {
      case 'enterHot':    fire = tempo.value >= 70 && (tempo.value - (tempo.DECAY_RATE || 5) * 0.016) < 70; break;
      case 'enterCold':   fire = tempo.value < 30 && (tempo.value + (tempo.DECAY_RATE || 5) * 0.016) >= 30; break;
      case 'resonance':   fire = Math.abs(tempo.value - 50) <= 5; break;
      case 'crash':       break; // handled via event
      case 'takeDamage':  break; // handled via event
    }
    if (fire) {
      s.triggered = true;
      _fireSigil(s);
    }
  }

  // Update ground waves
  for (let i = groundWaves.length - 1; i >= 0; i--) {
    const w = groundWaves[i];
    const prevTraveled = w.traveled;
    w.traveled += w.def.waveSpeed * logicDt;
    if (w.traveled >= w.def.range) { w.traveled = w.def.range; }

    // Check enemies along the wave front
    const wWidth = w.def.waveWidth || 30;
    for (const e of enemies) {
      if (!e.alive || w.hitEnemies.has(e)) continue;
      const ex = e.x - w.x, ey = e.y - w.y;
      // Project onto wave direction
      const proj = ex * w.dx + ey * w.dy;
      if (proj < prevTraveled - 10 || proj > w.traveled + e.r) continue;
      // Perpendicular distance
      const perp = Math.abs(ex * (-w.dy) + ey * w.dx);
      if (perp < wWidth + e.r) {
        w.hitEnemies.add(e);
        combat.applyDamageToEnemy(e, w.dmg);
        if (w.def.waveKnockback && e.alive) {
          e.x += w.dx * w.def.waveKnockback;
          e.y += w.dy * w.def.waveKnockback;
        }
        if (w.def.wavePushBack && e.alive) {
          e.x -= w.dx * w.def.wavePushBack;
          e.y -= w.dy * w.def.wavePushBack;
        }
        if (w.def.wavePull && e.alive) {
          e.x += w.dx * w.def.wavePull * 0.5;
          e.y += w.dy * w.def.wavePull * 0.5;
        }
        if (w.def.waveStagger && e.alive) e.stagger(w.def.waveStagger);
        particles.spawnBurst(e.x, e.y, w.def.color || '#cc8833');
      }
    }

    if (w.traveled >= w.def.range) {
      groundWaves.splice(i, 1);
    }
  }

  // Update beam flashes
  for (let i = beamFlashes.length - 1; i >= 0; i--) {
    beamFlashes[i].life -= logicDt;
    if (beamFlashes[i].life <= 0) beamFlashes.splice(i, 1);
  }

  // Channel: handle while mouse held
  if (channelState && input.mouse.leftDown) {
    const ch = channelState;
    ch.apTimer = (ch.apTimer || 0) + logicDt;
    ch.tickTimer = (ch.tickTimer || 0) + logicDt;
    // AP drain
    const drainInterval = 1.0 / (ch.def.apDrainRate || 0.5);
    if (ch.apTimer >= drainInterval) {
      ch.apTimer -= drainInterval;
      if (player.budget < 0.5) { channelState = null; }
      else { player.budget -= 0.5; }
    }
    // Tick
    const tickRate = ch.def.tickRate || 0.1;
    if (channelState && ch.tickTimer >= tickRate) {
      ch.tickTimer -= tickRate;
      _fireChannelTick(ch, ch.dmgMult);
    }
  } else if (!input.mouse.leftDown) {
    channelState = null;
  }

  particles.update(logicDt);
  renderer.updateShake(realDt);
  // Tick zone tooltip
  if (zoneTooltip && zoneTooltip.timer > 0) {
    zoneTooltip.timer -= logicDt;
    if (zoneTooltip.timer <= 0) zoneTooltip = null;
  }
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

function _drawWorldObjects(ctx, now) {
  ctx.save();
  // Traps
  for (const t of traps) {
    const pulse = (Math.sin(now / 300) + 1) * 0.5;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
    ctx.strokeStyle = (t.color || '#ffaa44') + Math.round((0.4 + pulse * 0.4) * 255).toString(16).padStart(2,'0');
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = (t.color || '#ffaa44') + '22';
    ctx.fill();
  }
  // Sigils
  for (const s of sigils) {
    const pulse = (Math.sin(now / 500) + 1) * 0.5;
    const r = 22 + pulse * 6;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = s.def.color || '#ff4400';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = (s.def.color || '#ff4400') + '22';
    ctx.fill();
    // Inner hex
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + now * 0.001;
      const hx = s.x + Math.cos(a) * (r * 0.6);
      const hy = s.y + Math.sin(a) * (r * 0.6);
      k === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.strokeStyle = (s.def.color || '#ff4400') + 'aa';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Ground waves
  for (const w of groundWaves) {
    const t2 = w.traveled / (w.def.range || 500);
    const wx = w.x + w.dx * w.traveled;
    const wy = w.y + w.dy * w.traveled;
    const pw = (w.def.waveWidth || 30) * 2;
    const px2 = -w.dy, py2 = w.dx; // perpendicular
    ctx.beginPath();
    ctx.moveTo(wx + px2 * pw, wy + py2 * pw);
    ctx.lineTo(wx - px2 * pw, wy - py2 * pw);
    ctx.strokeStyle = w.def.color || '#cc8833';
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.7 * (1 - t2 * 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Echo ghosts
  for (const e of echoes) {
    const pct = 1 - e.timer / e.delay;
    ctx.globalAlpha = 0.25 + pct * 0.35;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = e.def.color || '#cc88ff';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Timer ring
    ctx.beginPath();
    ctx.arc(e.x, e.y, 22, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.strokeStyle = e.def.color || '#cc88ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Beam flashes (draw wide+faded + narrow+bright to fake glow without shadowBlur)
  for (const b of beamFlashes) {
    const t3 = 1 - b.life / b.maxLife;
    const baseAlpha = (1 - t3) * 0.85;
    const w = (b.width || 8) * (1 - t3 * 0.5);
    ctx.beginPath();
    ctx.moveTo(b.x1, b.y1);
    ctx.lineTo(b.x2, b.y2);
    ctx.strokeStyle = b.color || '#aaddff';
    // Outer glow pass
    ctx.globalAlpha = baseAlpha * 0.25;
    ctx.lineWidth = w * 3;
    ctx.stroke();
    // Inner bright pass
    ctx.globalAlpha = baseAlpha;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function _drawOrbs(ctx) {
  if (orbs.length === 0) return;
  ctx.save();
  for (const o of orbs) {
    const ox = player.x + Math.cos(o.angle) * o.radius;
    const oy = player.y + Math.sin(o.angle) * o.radius;
    const alpha = Math.min(1, o.life * 2);
    ctx.globalAlpha = alpha * 0.3;
    // Glow ring (replace shadowBlur)
    ctx.beginPath();
    ctx.arc(ox, oy, 14, 0, Math.PI * 2);
    ctx.fillStyle = o.color || '#ff8844';
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(ox, oy, 7, 0, Math.PI * 2);
    ctx.fillStyle = o.color || '#ff8844';
    ctx.fill();
    // Trail line to player
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(ox, oy);
    ctx.strokeStyle = (o.color || '#ff8844') + '33';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
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
    ctx.font = 'bold 17px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('A Tempo-Driven Roguelike Deck Builder', canvas.width / 2, 148);

    const bx = Math.max(40, Math.floor(canvas.width * 0.1));
    const bw = canvas.width - bx * 2;
    const by = 172;
    const lineH = 26;
    const lines = [
      '◆ WASD / Arrow Keys to move',
      '◆ SPACE to dodge toward mouse cursor (no AP cost)',
      '◆ LEFT CLICK to attack with selected card',
      '◆ RIGHT CLICK or 1–4 keys to switch card',
      '',
      '◆ THE TEMPO BAR controls your power:',
      '    COLD  (<30)    = 0.7× damage  —  fill to 0 → ICE CRASH: massive freeze AoE!',
      '    FLOWING (30–70) = 1.0× damage, balanced play',
      '    HOT   (70–90)  = 1.3× damage, 1.2× speed, dash-attacks deal damage!',
      '    CRITICAL (90+) = 1.8× damage, attacks PIERCE  —  fills to 100 → auto CRASH!',
      '',
      '◆ Perfect Dodge: dodge just as an attack lands → slow-mo + bonus tempo',
      '◆ After each room: pick a new card for your deck',
      `◆ Clear ${FLOORS_TO_WIN} acts (each ending in a unique boss) to WIN`,
      '◆ Press ESC during combat to open the pause menu',
    ];
    const bh = 50 + lines.length * lineH + 10;
    ctx.fillStyle = 'rgba(12,12,20,0.95)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 12);
    ctx.fill();
    ctx.strokeStyle = '#2a2a55';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffdd44';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HOW TO PLAY', canvas.width / 2, by + 34);

    ctx.fillStyle = '#ddddee';
    ctx.font = '15px monospace';
    ctx.textAlign = 'left';
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === '') continue;
      // Indent zone lines slightly more
      const indent = lines[i].startsWith('    ') ? bx + 45 : bx + 22;
      ctx.fillStyle = lines[i].startsWith('    ') ? '#aabbcc' : '#ddddee';
      ctx.fillText(lines[i].trim(), indent, by + 62 + i * lineH);
    }

    // CONTINUE button
    const btnW = 300, btnH = 54;
    const btnX = (canvas.width - btnW) / 2;
    const btnY = by + bh + 14;
    ctx.fillStyle = '#225533';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 10);
    ctx.fill();
    ctx.strokeStyle = '#33dd66';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#33dd66';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CONTINUE  ▶', canvas.width / 2, btnY + 35);

    // Volume control row
    const volY = btnY + btnH + 16;
    const vol = audio.getMasterVolume();
    const pips = 10;
    ctx.fillStyle = '#556';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VOLUME', canvas.width / 2, volY);
    const pipW = 22, pipH = 14, pipGap = 4;
    const pipTotalW = pips * (pipW + pipGap) - pipGap;
    const pipStartX = canvas.width / 2 - pipTotalW / 2;
    for (let p = 0; p < pips; p++) {
      const filled = p < Math.round(vol * pips);
      ctx.fillStyle = filled ? '#44cc88' : '#223344';
      ctx.fillRect(pipStartX + p * (pipW + pipGap), volY + 6, pipW, pipH);
    }
    const vBtnW = 30, vBtnH = 26;
    const vDownX = pipStartX - vBtnW - 6, vUpX = pipStartX + pipTotalW + 6;
    ctx.fillStyle = '#334455';
    ctx.fillRect(vDownX, volY + 4, vBtnW, vBtnH);
    ctx.fillStyle = '#aabb88';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('−', vDownX + vBtnW / 2, volY + 21);
    ctx.fillStyle = '#334455';
    ctx.fillRect(vUpX, volY + 4, vBtnW, vBtnH);
    ctx.fillStyle = '#aabb88';
    ctx.fillText('+', vUpX + vBtnW / 2, volY + 21);

    // Reset progress row
    const rstY = volY + 42;
    if (!introResetConfirm) {
      const rstW = 240, rstH = 38;
      const rstX = canvas.width / 2 - rstW / 2;
      ctx.fillStyle = '#1e0a0a';
      ctx.beginPath();
      ctx.roundRect(rstX, rstY, rstW, rstH, 6);
      ctx.fill();
      ctx.strokeStyle = '#cc3333';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#ff6655';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚠  Reset All Progress', canvas.width / 2, rstY + 24);

      // Exit button
      const exitW = 200, exitH = 38;
      const exitX = canvas.width / 2 - exitW / 2;
      const exitY = rstY + rstH + 12;
      ctx.fillStyle = '#0e0e1a';
      ctx.beginPath();
      ctx.roundRect(exitX, exitY, exitW, exitH, 6);
      ctx.fill();
      ctx.strokeStyle = '#555577';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#8888aa';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('EXIT GAME', canvas.width / 2, exitY + 24);

      introBoxes = [
        { x: btnX, y: btnY, w: btnW, h: btnH, action: 'continue' },
        { x: vDownX, y: volY + 4, w: vBtnW, h: vBtnH, action: 'vol_down' },
        { x: vUpX, y: volY + 4, w: vBtnW, h: vBtnH, action: 'vol_up' },
        { x: rstX, y: rstY, w: rstW, h: rstH, action: 'reset_confirm' },
        { x: exitX, y: exitY, w: exitW, h: exitH, action: 'exit' },
      ];
    } else {
      ctx.fillStyle = '#ff5555';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚠  Are you sure? This cannot be undone!', canvas.width / 2, rstY + 16);
      const yesW = 140, noW = 140, gap = 16;
      const yesX = canvas.width / 2 - yesW - gap / 2;
      const noX = canvas.width / 2 + gap / 2;
      ctx.fillStyle = '#551111';
      ctx.fillRect(yesX, rstY + 22, yesW, 32);
      ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 1.5; ctx.strokeRect(yesX, rstY + 22, yesW, 32);
      ctx.fillStyle = '#ff6666'; ctx.font = 'bold 13px monospace';
      ctx.fillText('YES — RESET', yesX + yesW / 2, rstY + 43);
      ctx.fillStyle = '#113322';
      ctx.fillRect(noX, rstY + 22, noW, 32);
      ctx.strokeStyle = '#44aa66'; ctx.lineWidth = 1.5; ctx.strokeRect(noX, rstY + 22, noW, 32);
      ctx.fillStyle = '#44dd88'; ctx.font = 'bold 13px monospace';
      ctx.fillText('NO — CANCEL', noX + noW / 2, rstY + 43);
      introBoxes = [
        { x: btnX, y: btnY, w: btnW, h: btnH, action: 'continue' },
        { x: vDownX, y: volY + 4, w: vBtnW, h: vBtnH, action: 'vol_down' },
        { x: vUpX, y: volY + 4, w: vBtnW, h: vBtnH, action: 'vol_up' },
        { x: yesX, y: rstY + 22, w: yesW, h: 32, action: 'reset_do' },
        { x: noX, y: rstY + 22, w: noW, h: 32, action: 'reset_cancel' },
      ];
    }
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

    ctx.fillStyle = '#7777aa';
    ctx.font = '14px monospace';
    ctx.fillText(`Runs: ${meta.state.totalRuns}  |  Wins: ${meta.state.totalWins}  |  Best Floor: ${meta.state.bestFloor}`, canvas.width / 2, 90);

    charSelectBoxes = [];
    const chars = CharacterList;
    const GAP = 18;
    // Responsive sizing: fit all chars on screen
    const CARD_W = Math.min(240, Math.floor((canvas.width - 60 - (chars.length - 1) * GAP) / chars.length));
    const CARD_H = Math.min(370, Math.floor(canvas.height * 0.62));
    const totalW = chars.length * CARD_W + (chars.length - 1) * GAP;
    const startX = (canvas.width - totalW) / 2;
    const startY = 110;

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
        const masteryLevel = meta.getMasteryLevel(ch.id);
        const masteryRuns = meta.getMasteryRuns(ch.id);
        const THRESHOLDS = [1, 3, 5, 10];
        const nextThreshold = THRESHOLDS[masteryLevel] || null;

        ctx.fillStyle = ch.color;
        ctx.font = `bold ${Math.min(24, CARD_W / 10)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(ch.name, x + CARD_W / 2, startY + 32);
        ctx.fillStyle = '#aabbcc';
        ctx.font = `bold ${Math.min(13, Math.max(11, Math.floor(CARD_W / 16)))}px monospace`;
        ctx.fillText(ch.title, x + CARD_W / 2, startY + 50);

        // Description
        ctx.fillStyle = '#99aabb';
        ctx.font = '12px monospace';
        const descLines = ui._wrapTextLines(ch.description, CARD_W - 20, 12);
        for (let dl = 0; dl < Math.min(descLines.length, 3); dl++) {
          ctx.fillText(descLines[dl], x + CARD_W / 2, startY + 68 + dl * 15);
        }

        // Stats: two rows so they don't crowd each other
        const statsY = startY + 118;
        ctx.font = '12px monospace';
        ctx.fillStyle = '#ee5555';
        ctx.fillText(`♥ ${ch.hp} HP`, x + CARD_W / 3, statsY);
        ctx.fillStyle = '#44aaff';
        ctx.fillText(`${ch.apRegen} AP/s`, x + CARD_W * 2 / 3, statsY);
        ctx.fillStyle = '#44ff88';
        ctx.font = '12px monospace';
        ctx.fillText(`${ch.baseSpeed} SPD`, x + CARD_W / 2, statsY + 17);

        // Per-char stats
        ctx.fillStyle = '#6677aa';
        ctx.font = '11px monospace';
        ctx.fillText(`Runs: ${charStats.runs}  ·  Wins: ${charStats.wins}`, x + CARD_W / 2, statsY + 34);

        // Mastery progress bar
        const masY = statsY + 52;
        ctx.fillStyle = '#222235';
        ctx.fillRect(x + 8, masY, CARD_W - 16, 14);
        const masThresh = nextThreshold || THRESHOLDS[THRESHOLDS.length - 1];
        const masPct = nextThreshold ? Math.min(1, masteryRuns / masThresh) : 1;
        const masColor = masteryLevel >= 4 ? '#ffd700' : (masteryLevel >= 2 ? '#cc88ff' : ch.color);
        ctx.fillStyle = masColor + '99';
        ctx.fillRect(x + 8, masY, (CARD_W - 16) * masPct, 14);
        ctx.strokeStyle = masColor + '66'; ctx.lineWidth = 1; ctx.strokeRect(x + 8, masY, CARD_W - 16, 14);
        ctx.fillStyle = '#ddd';
        ctx.font = 'bold 10px monospace';
        const masLabel = masteryLevel >= 4 ? 'MASTERY MAX' : `Lv${masteryLevel} → Lv${masteryLevel + 1}: ${masteryRuns}/${masThresh} runs`;
        ctx.fillText(masLabel, x + CARD_W / 2, masY + 10);

        // Mastery card unlocks
        ctx.fillStyle = '#44bb77';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('MASTERY CARDS', x + CARD_W / 2, masY + 28);
        const mCards = ch.masteryCards || [];
        for (let mc = 0; mc < Math.min(mCards.length, 4); mc++) {
          const unlocked = mc < masteryLevel;
          const cDef = CardDefinitions[mCards[mc]];
          const cName = cDef ? cDef.name : mCards[mc];
          ctx.fillStyle = unlocked ? '#88ffaa' : '#445566';
          ctx.font = `${unlocked ? 'bold ' : ''}10px monospace`;
          ctx.fillText(`Lv${mc + 1}: ${unlocked ? cName : '???'}`, x + CARD_W / 2, masY + 42 + mc * 14);
        }

        // Difficulty unlock badges
        const maxD = meta.getMaxDifficulty(ch.id);
        const badgeY = startY + CARD_H - 24;
        const badgeW = Math.floor((CARD_W - 16) / 3);
        for (let d = 0; d <= 2; d++) {
          const bx2 = x + 8 + d * badgeW;
          ctx.fillStyle = d <= maxD ? DIFFICULTY_COLORS[d] + '33' : '#111';
          ctx.fillRect(bx2, badgeY, badgeW - 2, 18);
          ctx.fillStyle = d <= maxD ? DIFFICULTY_COLORS[d] : '#444';
          ctx.font = d <= maxD ? 'bold 10px monospace' : '10px monospace';
          ctx.fillText(DIFFICULTY_NAMES[d], bx2 + (badgeW - 2) / 2, badgeY + 12);
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
    // Left: character name + HP
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${ch?.name || '?'}`, 18, 28);
    const hpW = 160, hpH = 14;
    ctx.fillStyle = '#331111';
    ctx.fillRect(18, 34, hpW, hpH);
    ctx.fillStyle = '#ee3333';
    ctx.fillRect(18, 34, (player.hp / player.maxHp) * hpW, hpH);
    ctx.strokeStyle = '#553333'; ctx.lineWidth = 1; ctx.strokeRect(18, 34, hpW, hpH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`${player.hp}/${player.maxHp} HP`, 18 + hpW + 8, 46);
    ctx.fillStyle = '#666';
    ctx.font = '11px monospace';
    const layersLeft = runManager.getLayersToEnd();
    const depthLabel = layersLeft <= 1 ? 'BOSS NEXT!' : `${layersLeft - 1} room(s) to boss`;
    ctx.fillText(`Act ${runManager.floor}  ·  ${DIFFICULTY_NAMES[selectedDifficulty]}  ·  ${depthLabel}`, 18, 62);

    // Right: cards & relics info
    ctx.textAlign = 'right';
    ctx.fillStyle = '#88aacc';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`${deckManager.collection.length}/${deckManager.MAX_DECK_SIZE} Cards`, canvas.width - 18, 22);
    ctx.fillStyle = '#aa88cc';
    ctx.fillText(`${itemManager.equipped.length} Relics`, canvas.width - 18, 40);

    // Visible inventory button — above the map footer
    const invOpen = ui.showInventory;
    const invBtnW = 240, invBtnH = 40;
    const invBtnX = canvas.width / 2 - invBtnW / 2;
    const invBtnY = canvas.height - invBtnH - 56; // above the 48px footer + gap
    ctx.fillStyle = invOpen ? 'rgba(68,255,136,0.25)' : 'rgba(30,30,50,0.85)';
    ctx.beginPath();
    ctx.roundRect(invBtnX, invBtnY, invBtnW, invBtnH, 8);
    ctx.fill();
    ctx.strokeStyle = invOpen ? '#44ff88' : '#336';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = invOpen ? '#44ff88' : '#baccdd';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[I]  View Cards & Relics', canvas.width / 2, invBtnY + 26);

    // Inventory overlay
    if (invOpen) {
      ui.width = canvas.width;
      ui.height = canvas.height;
      ui.drawInventoryOverlay(ctx);
    }
    return;
  }

  // ── REST ──
  if (gameState === 'rest') {
    const ctx = renderer.ctx;
    ctx.fillStyle = 'rgba(5,8,5,0.97)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.shadowColor = '#44dd88';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#44dd88';
    ctx.font = 'bold 44px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('REST NODE', canvas.width / 2, 80);
    ctx.restore();

    ctx.fillStyle = '#556655';
    ctx.font = '15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`HP: ${player.hp} / ${player.maxHp}`, canvas.width / 2, 116);

    restChoiceBoxes = [];
    const btnW = Math.min(400, canvas.width - 80);
    const btnH = 90, btnGap = 24;
    const btnStartY = (canvas.height - (2 * btnH + btnGap)) / 2;
    const choices = [
      {
        action: 'heal', label: 'Heal 3 HP', color: '#44ff88', bg: '#0e2018',
        canDo: player.hp < player.maxHp,
        lines: [`Restore up to 3 HP`, `(${player.hp} → ${Math.min(player.hp + 3, player.maxHp)} / ${player.maxHp})`],
      },
      {
        action: 'burn', label: 'Remove a Card', color: '#ffaa44', bg: '#1e1500',
        canDo: deckManager.collection.length > 1,
        lines: ['Permanently remove one card', `from your deck  (${deckManager.collection.length} cards)`],
      },
    ];
    for (let i = 0; i < choices.length; i++) {
      const ch = choices[i];
      const bx = (canvas.width - btnW) / 2;
      const by = btnStartY + i * (btnH + btnGap);
      ctx.fillStyle = ch.canDo ? ch.bg : '#111';
      ctx.beginPath();
      ctx.roundRect(bx, by, btnW, btnH, 12);
      ctx.fill();
      ctx.strokeStyle = ch.canDo ? ch.color : '#333';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = ch.canDo ? ch.color : '#444';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(ch.label, canvas.width / 2, by + 30);
      ctx.fillStyle = ch.canDo ? '#bbccbb' : '#444';
      ctx.font = '14px monospace';
      ctx.fillText(ch.lines[0], canvas.width / 2, by + 54);
      ctx.fillStyle = ch.canDo ? '#889988' : '#333';
      ctx.font = '13px monospace';
      ctx.fillText(ch.lines[1], canvas.width / 2, by + 72);
      if (ch.canDo) restChoiceBoxes.push({ x: bx, y: by, w: btnW, h: btnH, action: ch.action });
    }
    ctx.fillStyle = '#889988';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press ESC to leave without resting', canvas.width / 2, canvas.height - 28);
    return;
  }

  // ── EVENT ──
  if (gameState === 'event') {
    ui.drawEventScreen(renderer.ctx, currentEventType);
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
  // Draw floor-layer world objects (traps, sigils, ground zones, beams)
  _drawWorldObjects(renderer.ctx, now);
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
  _drawOrbs(renderer.ctx);
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

    // Zone transition tooltip (first-time only)
    if (zoneTooltip && zoneTooltip.timer > 0) {
      const alpha = Math.min(1, zoneTooltip.timer, 3.5 - zoneTooltip.timer + 0.5);
      const ttW = Math.min(480, canvas.width - 40);
      const ttX = (canvas.width - ttW) / 2;
      const ttY = canvas.height / 2 - 80;
      ctx.save();
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = 'rgba(0,0,0,0.82)';
      ctx.beginPath();
      ctx.roundRect(ttX, ttY, ttW, 44, 8);
      ctx.fill();
      ctx.strokeStyle = zoneTooltip.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = zoneTooltip.color;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(zoneTooltip.text, canvas.width / 2, ttY + 27);
      ctx.restore();
    }
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

  const CARD_W = 250, CARD_H = 340, GAP = 44;
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
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`[${i + 1}]`, x + CARD_W - 12, startY + 24);

    ctx.fillStyle = rarCol;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(rarLabel, x + 16, startY + 24);

    // Card name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(def.name, x + CARD_W / 2, startY + 52);

    // Divider
    ctx.strokeStyle = (def.color || '#5588cc') + '88';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 16, startY + 62); ctx.lineTo(x + CARD_W - 16, startY + 62); ctx.stroke();

    // AP badge
    ctx.fillStyle = '#44aaff';
    ctx.beginPath();
    ctx.arc(x + 24, startY + 84, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 17px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(def.cost, x + 24, startY + 90);

    // Tempo shift
    ctx.fillStyle = def.tempoShift > 0 ? '#ffaa55' : '#55bbff';
    ctx.font = 'bold 17px monospace';
    ctx.textAlign = 'center';
    ctx.fillText((def.tempoShift > 0 ? '+' : '') + def.tempoShift + ' TEMPO', x + CARD_W / 2 + 12, startY + 92);

    // Type + range
    ctx.fillStyle = def.color || '#888';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(def.type.toUpperCase(), x + CARD_W / 2, startY + 116);
    ctx.fillStyle = '#667';
    ctx.font = '13px monospace';
    ctx.fillText(`${def.range}px range`, x + CARD_W / 2, startY + 134);

    // DMG
    if (def.damage > 0) {
      ctx.fillStyle = '#ff9988';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(`${def.damage} DMG`, x + CARD_W / 2, startY + 164);
    }

    // Description
    ctx.fillStyle = '#bbbbc8';
    ctx.font = '13px monospace';
    ui._wrapText(ctx, def.desc, x + 14, startY + 196, CARD_W - 28, 18);

    // Pick CTA
    ctx.fillStyle = rarCol;
    ctx.font = 'bold 15px monospace';
    ctx.fillText('CLICK TO PICK', x + CARD_W / 2, startY + CARD_H - 16);

    ctx.restore();
    draftBoxes.push({ x, y: startY, w: CARD_W, h: CARD_H, idx: i });
  }
}
function drawPauseMenu() {
  const ctx = renderer.ctx;

  // Dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Controls overlay mode
  if (pauseShowControls) {
    const cW = Math.min(620, canvas.width - 60);
    const controlLines = [
      { text: 'CONTROLS & MECHANICS', col: '#ffdd44', font: 'bold 20px monospace' },
      { text: '', col: '', font: '' },
      { text: 'WASD / Arrow Keys  —  Move', col: '#ddd', font: '15px monospace' },
      { text: 'SPACE  —  Dodge toward cursor  (no AP cost)', col: '#ddd', font: '15px monospace' },
      { text: 'LEFT CLICK  —  Use selected card', col: '#ddd', font: '15px monospace' },
      { text: 'RIGHT CLICK / 1–4  —  Cycle / select card slot', col: '#ddd', font: '15px monospace' },
      { text: 'ESC  —  Pause menu', col: '#ddd', font: '15px monospace' },
      { text: '', col: '', font: '' },
      { text: 'THE TEMPO BAR', col: '#ffaa44', font: 'bold 16px monospace' },
      { text: 'COLD  (<30 Tempo)  = 0.7× damage.  Ice cards deal 3× here!', col: '#4a9eff', font: '13px monospace' },
      { text: 'FLOWING  (30–70)  = 1.0× damage, balanced.', col: '#44dd88', font: '13px monospace' },
      { text: 'HOT  (70–90)  = 1.3× damage, 1.2× speed, dash deals damage!', col: '#ff8833', font: '13px monospace' },
      { text: 'CRITICAL  (90+)  = 1.8× damage, attacks PIERCE!', col: '#ff3333', font: '13px monospace' },
      { text: 'Fill to 100 → auto CRASH AoE.   Fill to 0 → ICE CRASH freeze.', col: '#aaa', font: '13px monospace' },
      { text: '', col: '', font: '' },
      { text: 'Perfect Dodge  —  dodge just as an attack lands → slow-mo + tempo', col: '#ddd', font: '13px monospace' },
      { text: 'Combo  —  hit same enemy repeatedly for 1.4× damage at 3+ hits', col: '#ddd', font: '13px monospace' },
    ];
    const lineH = 22;
    const cH = Math.min(canvas.height - 40, 80 + controlLines.length * lineH + 70);
    const cpx = (canvas.width - cW) / 2;
    const cpy = (canvas.height - cH) / 2;
    ctx.fillStyle = '#0a0a16';
    ctx.beginPath();
    ctx.roundRect(cpx, cpy, cW, cH, 14);
    ctx.fill();
    ctx.strokeStyle = '#44aaff';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let i = 0; i < controlLines.length; i++) {
      const cl = controlLines[i];
      if (!cl.text) continue;
      ctx.fillStyle = cl.col;
      ctx.font = cl.font;
      ctx.textAlign = 'center';
      ctx.fillText(cl.text, canvas.width / 2, cpy + 36 + i * lineH);
    }

    pauseMenuBoxes = [];
    const closeBtnW = 180, closeBtnH = 42;
    const closeBtnX = (canvas.width - closeBtnW) / 2;
    const closeBtnY = cpy + cH - closeBtnH - 12;
    ctx.fillStyle = '#1a2030';
    ctx.beginPath();
    ctx.roundRect(closeBtnX, closeBtnY, closeBtnW, closeBtnH, 8);
    ctx.fill();
    ctx.strokeStyle = '#44aaff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#44aaff';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('◀  BACK', canvas.width / 2, closeBtnY + 27);
    pauseMenuBoxes.push({ x: closeBtnX, y: closeBtnY, w: closeBtnW, h: closeBtnH, action: 'controls' });
    return;
  }

  // Panel
  const panelW = 400, panelH = pauseQuitConfirm ? 310 : 400;
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
    { label: 'CONTROLS / HOW TO PLAY', action: 'controls', color: '#44aaff', bg: '#0e1a2e' },
    { label: 'RESTART RUN', action: 'restart', color: '#ffaa44', bg: '#2e2a1a' },
    { label: 'QUIT TO MENU', action: 'quit', color: '#ff5555', bg: '#2e1a1a' },
  ];

  const btnW = 270, btnH = 46, btnGap = 12;
  const btnStartY = py + 82;

  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    const bx = (canvas.width - btnW) / 2;
    const by = btnStartY + i * (btnH + btnGap);
    ctx.fillStyle = btn.bg;
    ctx.beginPath(); ctx.roundRect(bx, by, btnW, btnH, 8); ctx.fill();
    ctx.strokeStyle = btn.color; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = btn.color;
    ctx.font = 'bold 17px monospace'; ctx.textAlign = 'center';
    ctx.fillText(btn.label, canvas.width / 2, by + 29);
    pauseMenuBoxes.push({ x: bx, y: by, w: btnW, h: btnH, action: btn.action });
  }

  // Volume control in pause menu
  const vol = audio.getMasterVolume();
  const volY = btnStartY + buttons.length * (btnH + btnGap) + 4;
  ctx.fillStyle = '#556'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
  ctx.fillText('VOLUME', canvas.width / 2, volY);
  const pips = 10, pipW = 18, pipH = 11, pipGap = 3;
  const pipTotalW2 = pips * (pipW + pipGap) - pipGap;
  const pipStartX2 = canvas.width / 2 - pipTotalW2 / 2;
  for (let p = 0; p < pips; p++) {
    ctx.fillStyle = p < Math.round(vol * pips) ? '#44cc88' : '#1a2a22';
    ctx.fillRect(pipStartX2 + p * (pipW + pipGap), volY + 5, pipW, pipH);
  }
  const vbW = 26, vbH = 22;
  const vDownX2 = pipStartX2 - vbW - 4, vUpX2 = pipStartX2 + pipTotalW2 + 4;
  ctx.fillStyle = '#334455'; ctx.fillRect(vDownX2, volY + 3, vbW, vbH);
  ctx.fillStyle = '#aabb88'; ctx.font = 'bold 13px monospace';
  ctx.fillText('−', vDownX2 + vbW / 2, volY + 18);
  ctx.fillStyle = '#334455'; ctx.fillRect(vUpX2, volY + 3, vbW, vbH);
  ctx.fillStyle = '#aabb88';
  ctx.fillText('+', vUpX2 + vbW / 2, volY + 18);
  pauseMenuBoxes.push({ x: vDownX2, y: volY + 3, w: vbW, h: vbH, action: 'vol_down' });
  pauseMenuBoxes.push({ x: vUpX2, y: volY + 3, w: vbW, h: vbH, action: 'vol_up' });

  ctx.fillStyle = '#444'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
  ctx.fillText('ESC to resume', canvas.width / 2, py + panelH - 14);
}

// Initialize audio on first interaction (browser policy)
function _tryInitAudio() {
  if (gameState === 'intro' && !audio.currentBgmFile) {
    audio.init();
    audio.playBGM('intro');
  }
}
window.addEventListener('click', _tryInitAudio);
window.addEventListener('keydown', _tryInitAudio);

console.log('[Init] Game ready, starting engine.');
const engine = new Engine(update, render);
engine.start();
