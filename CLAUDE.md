# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## How to Run

No build step. Serve the project root with Python and open in a browser:

```bash
python -m http.server 8000
# Then open http://localhost:8000
```

The game is a vanilla ES module app — all imports use native browser `import`. There is no bundler, no transpiler, no package manager.

## Architecture Overview

**Entry point:** `src/main.js` — instantiates all systems, wires them together, owns the game state machine, and drives the main update/render loop.

**Game state machine** (string variable `gameState` in `main.js`):
`intro → charSelect → map → prep → playing → draft → itemReward → shop → upgrade → event → stats → dead / victory`

**Core systems and their roles:**

| File | Role |
|---|---|
| `src/Engine.js` | `requestAnimationFrame` loop, hit-stop (freezes logic), slow-mo (scales `dt`) |
| `src/EventBus.js` | Singleton `events` pub/sub bus — all cross-system communication flows through this |
| `src/tempo.js` | `TempoSystem` — the central 0–100 resource; listens to `COMBO_HIT`, `KILL`, `DODGE`, `PERFECT_DODGE`, etc. |
| `src/state.js` | `RunState` singleton — persistent run data (HP, items, XP, floor); `CLASS_DATA`, `ITEM_POOL`, `LEVEL_UP_POOL` |
| `src/Combat.js` | `CombatManager` — hitbox resolution, damage application, post-dodge crit window |
| `src/Enemy.js` | Base `Enemy` class + all named enemy/boss subclasses |
| `src/player.js` | `Player` — movement, combo attacks, heavy strike, dodge logic |
| `src/DeckManager.js` | `CardDefinitions` (all card data) + `DeckManager` (hand/deck/draw state) |
| `src/Items.js` | `ItemDefinitions` + `ItemManager` (per-update item effects) |
| `src/RunManager.js` | Procedural map generation (seeded RNG, layer graph with fight/elite/event/shop/rest/boss nodes) |
| `src/room.js` | `RoomManager` — room layout variants (standard/pillars/arena/corridor), pillar placement |
| `src/MetaProgress.js` | Persistent unlocks and score calculation (localStorage) |
| `src/Characters.js` | `CharacterList`, difficulty modifiers (`DIFFICULTY_MODS`) |
| `src/Projectile.js` | `ProjectileManager` — projectile pool, movement, collision |
| `src/Particles.js` | `ParticleSystem` — visual-only effects |
| `src/Renderer.js` | All canvas draw calls |
| `src/ui.js` | `UI` — HUD, menus, card selection, all non-canvas overlays |
| `src/audio.js` | `AudioSynthesizer` — Web Audio API procedural sound |
| `src/effects.js` | One-shot visual effect helpers |
| `src/enemies.js` | Enemy spawn tables per floor |

**Key design patterns:**

- **EventBus over direct references** — systems talk through `events.emit()`/`events.on()`. When adding behavior that crosses system boundaries, add a new event rather than passing object references.
- **`RunState` is the source of truth** for mid-run player stats (HP, items, level). `Player` object mirrors these values at run start and on item pickup; always update both when changing HP or speed.
- **`window._itemDefs`** is set in `main.js` to break a circular import between `Items.js` and `ui.js`.
- **`window.CANVAS_W` / `window.CANVAS_H`** are global constants updated on resize; used throughout for bounds checks.
- **Tempo zones:** Cold < 30, Normal 30–69, Hot 70–84, Critical 85–99, Crashed (post-100). Zone affects dodge cost, damage multiplier, enemy speed, and ability availability.
- **Cards have a `tempoShift` field** — positive raises Tempo, negative lowers it. `slotWidth: 2` cards occupy two hand slots.
