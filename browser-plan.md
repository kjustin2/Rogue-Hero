# Browser Prototype Plan

## Decision: Drop Godot, Go Vanilla JS + Canvas

The mechanics are sound. The problem is Godot's toolchain friction — class resolution order, .tscn syntax, typed GDScript strictness — is slowing us down before we can even feel the game. For a prototype that demonstrates the Tempo + Pressure combat loop, we don't need any of that.

**New stack:**
- Pure HTML5 Canvas + JavaScript
- Zero dependencies, zero build step
- Run with: `python -m http.server 8000` then open `localhost:8000`
- Or just open `index.html` directly in a browser

Everything the Godot version was doing in 20+ files with complex scene trees can be done in a few clean JS files.

---

## What We Keep

The design is unchanged:
- **Tempo** — single number 0–100, raised by attacking/killing, decays toward 50, crashes at 100
- **Pressure** — grid of cells, builds fast when standing, instant shockwave on movement
- **Snappy feel** — high acceleration, hit-stop, shockwave ring, damage numbers, vignette
- **Roguelike RPG** — rooms, enemies, items, class stats

---

## File Structure

```
/
├── index.html          Entry point — canvas + script tags
├── src/
│   ├── main.js         Game loop, init, input
│   ├── state.js        RunState — HP, XP, level, class stats (plain object)
│   ├── tempo.js        Tempo system — value, decay, crash, color helpers
│   ├── pressure.js     Pressure grid — build, release, shockwave damage
│   ├── player.js       Player — movement, attack, dodge
│   ├── enemies.js      Enemy types — Chaser, Shooter
│   ├── room.js         Room — walls, spawn points, clear detection
│   ├── effects.js      ShockwaveRing, DamageNumber, DeathBurst, trail
│   └── ui.js           HUD — Tempo bar, HP, floor, vignette overlay
└── style.css           Black background, center canvas, nothing else
```

---

## Core Architecture

### Game Loop (`main.js`)
```
requestAnimationFrame loop:
  - calc delta (cap at 0.05s to avoid spiral)
  - update input
  - update player
  - update enemies
  - update pressure grid
  - update effects
  - update tempo decay
  - draw everything (clear → room → pressure overlay → entities → effects → UI)
```

### State (`state.js`)
Plain JS object. No classes needed:
```js
const RunState = {
  hp: 6, maxHp: 6,
  speed: 200, power: 1.0,
  tempoGain: 1.0, pressureRadius: 64,
  xp: 0, level: 1, floor: 1, room: 0,
  items: [], class: 'berserker'
}
```

### Tempo (`tempo.js`)
```js
const Tempo = {
  value: 50,           // 0–100
  update(dt) { /* decay toward 50 */ },
  onAttack()  { this.value += 5 * RunState.tempoGain },
  onKill()    { this.value += 10 * RunState.tempoGain },
  onDodge()   { this.value -= 15 },
  color()     { /* returns css color string based on value */ },
  stateName() { /* COLD / FLOWING / HOT / CRITICAL */ },
  damageMultiplier() { /* 0.7 – 1.6 */ }
}
```

### Pressure Grid (`pressure.js`)
```js
const CELL = 64
// grid[col][row] = 0.0–1.0
// BUILD_RATE = 2.2/s, LEAK_RATE = 0.4/s
// On player cell change → releaseShockwave(oldCell)
// Shockwave: instant circle damage query + spawn ShockwaveRing effect
```

### Player (`player.js`)
- Position, velocity (x/y floats)
- WASD via KeyboardEvent listeners
- Click to attack nearest enemy in range
- Space to dodge (brief invincibility + speed burst + trail)
- Calls `Pressure.enterCell` / `exitCell` on movement

### Enemies (`enemies.js`)
```js
class Chaser {
  // Follows player, stands still in melee range (builds pressure under them)
  // Speeds up with Tempo
}
class Shooter {
  // Stays at range, fires projectiles
  // Fire rate increases with Tempo
}
```

### Room (`room.js`)
- Rect walls drawn as filled rectangles
- Spawn points (fixed positions per room config)
- Exit door — unlocks when all enemies dead
- Room configs: array of { enemies: [...], layout: 'open' | 'pillars' }

---

## Feel Systems (all in `effects.js`)

These are just arrays of active effect objects, updated and drawn each frame:

```js
const Effects = {
  rings: [],       // ShockwaveRing — expanding arc
  numbers: [],     // DamageNumber — float up + fade
  bursts: [],      // DeathBurst — 6 shards fly out
  trails: [],      // dodge trail segments
  update(dt) { /* advance all, remove dead */ },
  draw(ctx)  { /* draw all */ }
}
```

Each effect is a plain object `{ x, y, age, lifetime, ... }`. No classes.

### Vignette
Single full-canvas rect drawn after game world, before UI:
```js
// ctx.fillStyle = rgba based on Tempo.value
// lerp toward target color each frame
```

### Hit-Stop
```js
let hitStopTimer = 0
// In game loop: if hitStopTimer > 0, skip update step, only draw
```

---

## Room Progression

```
Start run → Room 1 (2 Chasers) → clear → brief pause → Room 2 (2 Chasers + 1 Shooter)
→ clear → Room 3 (3 enemies, mixed) → clear → win screen (MVP)
```

Item draft between rooms: pause game, show 3 random items as clickable boxes, pick one.

---

## Input Map

| Input | Action |
|---|---|
| WASD | Move |
| Left click | Attack nearest enemy |
| Space | Dodge |

---

## What "Done" Looks Like for First Pass

- Player moves, enemies chase/shoot
- Pressure grid visible on floor, releases shockwave on step
- Tempo bar on screen, changes color, crashes at 100
- Enemies take damage and die with effects
- 3 rooms, then a win screen
- Run with `python -m http.server 8000`

That's the full prototype. No asset loading, no audio, placeholder colored squares for sprites. Pure mechanic validation.

---

## Repo Cleanup

### Files to Delete

**Godot project files:**
```
project.godot
```

**Godot source directories (delete entirely):**
```
autoloads/
scripts/
scenes/
resources/
```

**Godot engine cache (delete entirely):**
```
.godot/
```

**Stale design docs (Godot-specific, superseded):**
```
tech-design.md
```

**Keep all other design docs** — `game-ideas.md`, `game-plan.md`, `action-loop.md`, `feel-plan.md` all describe mechanics, not implementation, and are still valid reference.

---

### .gitignore

Replace current contents with:
```
# OS
.DS_Store
Thumbs.db

# Editors
.vscode/
*.swp
*.swo

# Node (if npm is ever added)
node_modules/

# Local server logs
*.log
```

---

### CLAUDE.md

Replace entirely. Remove all Godot-specific rules and patterns. New content should cover:
- Project description (browser JS prototype)
- Code review process (keep, update checklist to JS focus)
- JS/Canvas patterns and gotchas
- Project file structure

---

### README.md

Replace entirely. New content:
- One-line description
- How to run: `python -m http.server 8000` → `localhost:8000`
- Controls: WASD, click to attack, space to dodge
- What it is: mechanic prototype for a roguelike RPG

---

## Build Order

1. `index.html` + `main.js` — blank canvas, game loop, input
2. `state.js` + `tempo.js` — core systems, no visuals
3. `player.js` — movement + collision with walls
4. `pressure.js` — grid draw + shockwave logic
5. `enemies.js` — Chaser first, then Shooter
6. `effects.js` — rings, numbers, bursts (add one at a time)
7. `ui.js` — Tempo bar + vignette
8. `room.js` — room clear + transitions
9. Wire item draft + win screen

Each step is playable. Stop anywhere and test.
