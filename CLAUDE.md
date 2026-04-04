# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

```bash
python -m http.server 8000
# Open: http://localhost:8000
```

No build step, no npm, no dependencies — pure vanilla JavaScript served directly from the filesystem.

## Architecture Overview

**Rogue Hero** is a browser-based roguelike deck-builder with tempo-driven combat, built with vanilla JS + HTML5 Canvas. No framework, no bundler.

### Entry Point & State Machine

`src/main.js` (~1,200 lines) is the game orchestrator. It owns the state machine with these states:

```
intro → charSelect → map → prep → playing → draft/dead/victory
                                           → itemReward → map
                                           → shop/upgrade → map
                                           → stats (end)
```

It initializes all systems in order, routes events via EventBus, and handles state transitions.

### System Initialization Order (main.js)

Systems are instantiated in this dependency order:
1. `InputManager` (Input.js) — keyboard/mouse
2. `TempoSystem` (tempo.js) — core resource
3. `CombatManager` (Combat.js) — damage, hitboxes
4. `ParticleSystem` (Particles.js) — VFX
5. `AudioSynthesizer` (audio.js) — Web Audio API synthesis
6. `Player` / `Enemy` (player.js, Enemy.js) — entities
7. `RoomManager` (room.js) — procedural rooms
8. `DeckManager` (DeckManager.js) — card hand/deck
9. `RunManager` (RunManager.js) — map, floor, seeded RNG
10. `MetaProgress` (MetaProgress.js) — unlocks, scoring
11. `ItemManager` (Items.js) — relics/passives
12. `ProjectileManager` (Projectile.js) — pooled projectiles
13. `UI` (ui.js) — canvas HUD rendering
14. `Renderer` (Renderer.js) — canvas context wrapper
15. `Engine` (Engine.js) — `requestAnimationFrame` game loop

### Core Mechanic: Tempo

`src/tempo.js` — The 0–100 resource everything else revolves around.

- **Zones:** Cold (0–30), Flowing (30–70), Hot (70–90), Critical (90–100)
- Gains from attacks, kills, dodges (zone-dependent)
- Naturally decays toward 50 at rest
- **Crash** (F key, requires 85+): AOE damage, resets tempo to 50 (Berserker resets to 70)

### Event Bus

`src/EventBus.js` is a minimal pub/sub (10 lines). Systems communicate via events like `COMBO_HIT`, `KILL`, `DODGE`, `CRASH_ATTACK` rather than direct references.

### Entity Hierarchy

`src/Entity.js` is the base class (position, radius, alive). `Player` and `Enemy` extend it.

`src/Enemy.js` (~1,300 lines) contains all 13 enemy types: Chaser, Sniper, Bruiser, Turret, Teleporter, Swarm, Healer, Mirror, TempoVampire, ShieldDrone, BossBrawler, BossConductor, BossEcho.

### Procedural Generation

`src/RunManager.js` uses `mulberry32` seeded RNG for reproducible runs. Generates a 3-floor map with room types (combat, elite, shop, event, boss). `src/room.js` generates room layouts (standard, pillars, arena, corridor).

### Cards & Relics

- `src/DeckManager.js` — hand/deck lifecycle, card draw
- `src/CardDefinitions.js` (or similar) — card pool definitions
- `src/Items.js` — relic passive effects
- `src/Characters.js` — 3 classes: Berserker, Shadow, Warden (each with unique passives and starting decks)

### Rendering

All rendering is direct Canvas 2D API. `src/ui.js` (~700 lines) draws the HUD (tempo bar, health, card hand, minimap, relics). `src/Renderer.js` is a thin canvas context wrapper. `src/Engine.js` runs the loop with hit-stop and slow-motion support.

## Design Document

`tempo-plan.md` — authoritative design doc for the Tempo system and combat mechanics. Check here before modifying tempo zones, attack values, or crash behavior.
