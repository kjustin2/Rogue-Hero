# Rogue-Hero — Claude Reference

## Project
Browser-based roguelike RPG prototype. Runs on HTML5 Canvas + vanilla JavaScript, zero dependencies. Core mechanics: **Tempo** (main resource, drives combat pace) + **Pressure** (movement-based damage via grid cells).

Run with: `python -m http.server 8000` → `localhost:8000`

---

## Code Review Process

After every implementation session, always perform **both** steps before handing off to the user:

### Step 1 — Static Review
Use the Explore subagent to read all new and modified files and check for:

- Syntax errors and missing brackets/semicolons
- Variables used before declaration
- Functions called that don't exist or have wrong argument counts
- Off-by-one errors in grid math or collision checks
- Logic bugs: wrong comparisons, conditions that can never be true, infinite loops
- Anything that would throw a JS runtime error or silently produce wrong behavior

Fix all issues found before moving to step 2.

### Step 2 — Live Browser Test
Spin up the local server and use the **Puppeteer MCP** to test the game directly in a headless browser — no manual browser needed.

```
python -m http.server 8000 &
```

Then use Puppeteer tools in sequence:

```
mcp__puppeteer__puppeteer_navigate  → http://localhost:8000
mcp__puppeteer__puppeteer_screenshot → verify menu renders
mcp__puppeteer__puppeteer_click     → selector: canvas  (starts game)
mcp__puppeteer__puppeteer_screenshot → verify game room renders
mcp__puppeteer__puppeteer_evaluate  → simulate keypresses (use e.key not e.code):
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', code: 'KeyD' }))
mcp__puppeteer__puppeteer_screenshot → verify player moved / effects appeared
```

**Key gotcha:** The game listens to `e.key` (lowercase), not `e.code`. Always pass `{ key: 'r', code: 'KeyR' }` etc. when dispatching KeyboardEvents.

Check every affected flow:
- Game boots and menu renders correctly
- Player moves (simulate WASD via evaluate)
- Pressure cells charge visually and shockwaves fire on cell exit
- Tempo bar updates, pulses at HOT, and crashes with screen effect
- Enemies spawn, chase/shoot, and die with effects
- Room clears, exit door opens, draft screen appears and is clickable
- Dead and Win screens render and R restarts cleanly

The goal is that the user never has to debug something we could have caught ourselves — neither a code error nor a feel/visual issue that was obvious on first play.

---

## JS/Canvas Patterns & Gotchas

### Game Loop
```js
let last = 0
function loop(ts) {
  const dt = Math.min((ts - last) / 1000, 0.05) // cap delta — never spiral
  last = ts
  update(dt)
  draw()
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
```
Always cap `dt` at 0.05s (20fps minimum). Without this, a tab in the background resumes with a huge delta and everything teleports.

---

### Canvas Drawing Order
Clear → room floor → pressure overlay → entities → effects → UI overlay → vignette last.
The vignette sits above everything except the HUD labels.

```js
ctx.clearRect(0, 0, W, H)
drawRoom()
drawPressure()   // semi-transparent rects over floor cells
drawEntities()   // player, enemies
drawEffects()    // rings, bursts, trails, damage numbers
drawVignette()   // full-canvas rgba overlay
drawHUD()        // tempo bar, HP, labels — always on top
```

---

### Collision: Simple Distance Checks
No physics engine. All collision is distance-based:
```js
function circlesOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by
  return dx*dx + dy*dy < (ar+br)*(ar+br)
}
```
Wall collision: clamp position to room bounds after movement.

---

### Pressure Grid
```js
// Grid indexed by cell: key = `${col},${row}`
// CELL_SIZE = 64
// On player cell change: releaseShockwave(prevCol, prevRow)
// Shockwave: iterate enemies, check distance <= radius, apply damage

function worldToCell(x, y) {
  return { col: Math.floor(x / CELL_SIZE), row: Math.floor(y / CELL_SIZE) }
}
```
Grid is a plain object `{}`. Keys are `"col,row"` strings. Values are 0.0–1.0 floats.

---

### Hit-Stop
```js
let hitStopTimer = 0

// In game loop:
if (hitStopTimer > 0) {
  hitStopTimer -= realDelta  // use real time, not game delta
  draw()                     // still draw — freeze is visual
  return
}
```
Pass `performance.now()` derived real delta separately from the game `dt` for this.

---

### State Objects
All state is plain objects, not classes. Mutate directly:
```js
const Tempo = { value: 50, crashReset: 50, ... }
const RunState = { hp: 6, maxHp: 6, speed: 200, ... }
```
No getters/setters. Keep it flat and readable.

---

### Effects Array Pattern
All transient effects (rings, numbers, bursts, trails) live in a single array. Update and cull in one pass:
```js
effects = effects.filter(e => {
  e.age += dt
  return e.age < e.lifetime
})
```
Each effect is a plain object with `{ type, x, y, age, lifetime, ...data }`.

---

### Canvas Alpha / Composite
For the vignette and pressure overlay, always restore ctx state:
```js
ctx.save()
ctx.globalAlpha = 0.4
ctx.fillStyle = '#cc2200'
ctx.fillRect(0, 0, W, H)
ctx.restore()
```
Never leave `globalAlpha` or `globalCompositeOperation` set after a draw call.

---

### Input
Track key state with a Set — don't use keydown events for movement:
```js
const keys = new Set()
window.addEventListener('keydown', e => keys.add(e.code))
window.addEventListener('keyup',   e => keys.delete(e.code))

// In update:
if (keys.has('KeyW')) vy -= ACCEL * dt
```
Mouse click for attack: store `mouseX, mouseY` from `mousemove`, fire on `mousedown`.

---

## Project Structure
```
index.html       Entry point — canvas element + script tags (no bundler)
style.css        Black background, centered canvas, nothing else
src/
  main.js        Game loop, canvas setup, input listeners, draw orchestration
  state.js       RunState — HP, XP, level, class stats (plain object)
  tempo.js       Tempo value, decay, crash, color/name helpers, damage multiplier
  pressure.js    Grid build/leak, shockwave damage + ring spawn
  player.js      Movement, attack, dodge, cell tracking
  enemies.js     Chaser + Shooter classes, projectile logic
  room.js        Room config, wall drawing, spawn, clear detection, transitions
  effects.js     ShockwaveRing, DamageNumber, DeathBurst, dodge trail (all in effects[])
  ui.js          Tempo bar, vignette, HP display, floor label
```

Scripts loaded in `index.html` in dependency order — no imports needed.

---

## Design Reference
- `game-plan.md` — full mechanics design (classes, items, floor structure)
- `action-loop.md` — second-by-second combat loop description
- `feel-plan.md` — all 9 feel systems and why they matter
- `browser-plan.md` — current build plan and file structure
