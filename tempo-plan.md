# Rogue-Hero: All-In On Tempo

## The New Core Thesis

Pressure is cut. The grid is gone. Shockwaves are gone.

**Tempo is the entire game.** Everything reads from and writes to one bar. Combat mastery means controlling what zone you're in, not reacting to where you ended up.

The old design had two systems competing for your attention. This one has one system with enough depth to fill the whole game.

---

## What Stays, What Changes

| System | Before | After |
|---|---|---|
| Tempo bar | Central resource | Still central — now does MORE |
| Pressure grid | Parallel system | **Cut entirely** |
| Shockwave | Move-triggered AoE | **Cut entirely** |
| Attack | Click to hit | Combo chain with Tempo interaction |
| Dodge | Lowers Tempo (-15) | Reworked — timing-based reward |
| Classes | Pressure vs Tempo flavor | All three are Tempo builds now |

---

## Richer Tempo States

Each state is no longer just a damage multiplier. Each one changes *how the game plays*.

### Cold (0–30)
- You move slower, enemies move slower
- Your attacks have a **stagger** effect — hit enemies freeze for 0.2s
- Dodging costs nothing (0 Tempo change)
- Feels: methodical, surgical, stalker energy
- The "I'm in control" state. Low ceiling, high floor.

### Flowing (30–70)
- Baseline. Normal movement. No bonus, no penalty.
- This is the "resting" state — decay always pulls here from both extremes
- The safe zone, but you're leaving damage on the table

### Hot (70–90)
- Movement speed +20%
- Attacks deal +40% damage
- **Dash-Attack unlocked**: dashing into an enemy does automatic contact damage
- Enemies move faster and shoot faster
- Feels: risky momentum. You're winning but the room is waking up.

### Critical (90–100)
- All attacks deal +80% damage
- **Attacks pierce** — hit through multiple enemies in a line
- Dodge is disabled (you're too committed)
- One hit kills you (no partial damage — instant death)
- Feels: glass cannon. Pure aggression. You chose this.
- Tempo decays FAST from here — it's a spike to ride, not a home

---

## The Attack System — Combos + Tempo

Replace the single-click attack with a combo chain. No art changes needed — just hit count and timing.

### Light Combo (Left Click)
- 3-hit chain. Each hit raises Tempo by +4.
- If you land all 3 within 0.6 seconds: **Combo Finish** fires automatically.
  - Combo Finish: a bigger hit, raises Tempo +15, has knockback
- Miss any hit (target moved away): chain resets, no Tempo gain
- This makes POSITIONING matter — you need to stay on target to complete chains

### Heavy Strike (Right Click)
- 0.3 second charge, then a single large hit
- Raises Tempo +20 on a successful hit
- Raises Tempo +8 on a miss (you committed, you pay something)
- Slow — creates a window for enemies to punish
- This is your "spike Tempo deliberately" button

### The Rhythm of Combat
```
Light combo × 3 → Combo Finish → Tempo spike
        ↓
  Enemies speed up
        ↓
 Dodge to reposition
        ↓
 Heavy strike into cluster
        ↓
Decide: ride Critical, or hold back
```

---

## Perfect Dodge — The Skill Ceiling

Dodge is currently a flat -15 Tempo cost. This makes it pure downside, so players avoid it.

Replace with a timing window:

### Perfect Dodge (timed within 0.1s of enemy hit/projectile)
- Triggers slow-motion for 0.4 seconds (enemy moves at 20% speed)
- Raises Tempo **+10** (reward for skill)
- Brief afterimage trail (visual only)
- Feels: parry energy. The skill expression moment.

### Normal Dodge (not timed)
- Tempo -5 (much lower cost than before)
- Invincibility frames for 0.25s (same as now)
- No slow-mo

### No More -15 Penalty
The goal: dodge is now a neutral-to-positive tool, not a punishing one. The risk/reward is in the timing, not the cost. Players will dodge more, which makes combat feel more active.

---

## Intentional Tempo Crash — Power Move

Crash currently feels like a mistake. It should feel like a weapon.

### Manual Crash (press F / dedicated button at 85+ Tempo)
- Instantly detonates your Tempo into a **radial burst** — all enemies within 120px take heavy damage
- Scales with how high Tempo was when you crashed (90 Tempo = more damage than 85 Tempo)
- Brief stagger on YOU (0.25s), then reset to 45
- Camera shake, flash, death burst on enemies hit

### Accidental Crash (reaching 100 naturally)
- Same burst, but slightly smaller radius
- Your stagger is longer (0.4s instead of 0.25s)
- Feels: the same power, but you paid more for it

This makes Tempo management about deciding WHEN to spend the crash, not just avoiding it.

---

## Enemy Types — Built Around Tempo

Every enemy should ask a different question about your Tempo state.

### Current (keep)
- **Chaser** — rushes you, melee damage. Simple, teaches basics.
- **Shooter** — fires projectiles, stays at range.

### New Enemy Types

**Tempo Vampire**
- Drains your Tempo on melee hit (-20)
- Kills it in Hot are especially punishing: you fall out of your damage window
- Counter: kill them fast (Heavy Strike) before they can drain

**Shield Drone**
- Immune to all damage except when YOUR Tempo is 70+
- Forces you to build Tempo intentionally before engaging
- Teaches: Tempo isn't just a multiplier, it's an unlock key

**Glass Cannon**
- 1 HP but fires fast projectiles
- At Critical Tempo your attacks pierce, so one hit kills a line of them
- Rewards riding Critical strategically

**Tempo Mimic**
- Matches your current Tempo state
- When you're Cold, it's slow and harmless
- When you're Hot, it moves and attacks at your speed
- Forces Cold play in dangerous moments

**Berserker** (elite/mini-boss tier)
- Has its own Tempo bar — starts Cold, gets hotter as it takes damage
- At Hot it's deadly; kill it before it gets there
- OR: let it crash itself (it will crash at 100) and punish the stagger

---

## Items — Reshaped for Pure Tempo

All items now interact with Tempo only. No Pressure references.

| Item | Effect |
|---|---|
| **Metronome** | Tempo changes in steps of 10 (snappier transitions, cleaner zone control) |
| **Resonance** | At exactly 50 Tempo (±5), your damage is doubled |
| **Runaway** | Tempo no longer decays from Hot — you have to manage it manually |
| **Echo** | On Tempo Crash, your last attack repeats at half damage |
| **Cold Fury** | At Cold Tempo, dash becomes a damaging charge (15px knockback) |
| **Surge** | Manual Crash radius +60% |
| **Glass Heart** | You start each room at 90 Tempo — Critical from first swing |
| **Sustained** | Stay in Hot for 3 seconds without crashing: gain 1 temporary armor |
| **Precision** | Perfect Dodge slow-mo duration: 0.4s → 0.8s |
| **Tempo Tap** | Every 10th Tempo point crossed triggers a tiny pulse hitbox around player |
| **Deadweight** | Tempo decays 3× faster (easier control, lower risk ceiling, lower damage ceiling) |
| **Last Rites** | On death, trigger a Tempo Crash (AoE burst) and revive at 1 HP — once per run |

---

## Classes — Three Tempos

With Pressure gone, classes differentiate on Tempo behavior only.

### Berserker
- Tempo gain from attacks: +50% (builds fast)
- Crash burst damage: +40%
- Manual Crash only available at 75+ (earlier access)
- Passive: Accidental Crash gives no stagger — you lose no time
- Playstyle: Spike high, crash on purpose, spike again. Aggressive loop.

### Shadow
- Perfect Dodge window: doubled (0.1s → 0.2s, much easier to hit)
- Each Perfect Dodge raises Tempo +20 instead of +10
- Combo chains have 4 hits instead of 3
- Passive: First hit out of a Perfect Dodge slow-mo always crits
- Playstyle: Risky repositioning, tempo via skill expression

### Warden
- Max HP: 2× (8 instead of 4)
- Taking damage raises Tempo +15 (turns punishment into resource)
- Hot state unlocks a block (hold direction to absorb one hit)
- Passive: At Cold Tempo, all incoming damage is reduced by 30%
- Playstyle: Tank through hits, build Tempo from taking damage, crash for burst

---

## Tempo Carries Between Rooms

One of the high-leverage design decisions: **Tempo doesn't reset on room clear.**

This means:
- Reckless room finishes carry danger into the next room
- Skilled players can intentionally crash at the END of a room to reset cleanly
- You enter a boss fight with whatever state you've been carrying
- Items that affect Tempo become more strategically interesting

The room transition screen should show your current Tempo and warn you if you're entering hot.

---

## The Game Loop Summary

```
Enter room (Tempo carries in from previous room)
  → Read enemy mix — what does this room want?
  → Start Cold if enemies include Shield Drones or Mimics
  → Build to Hot via combos
  → Decide: Manual Crash now (burst damage) or ride it to Critical?
  → Perfect Dodge to maintain Tempo during repositioning
  → Kill all enemies → exit Tempo state determines run risk
  → Item draft → choose item that shapes YOUR Tempo style
  → Repeat, run gets harder as enemy mixes force harder decisions
```

---

## What Mastery Looks Like Now

**Beginner:** Attacks enemies, Tempo spikes by accident, crashes, confused.

**Intermediate:** Stays in Hot intentionally, uses Manual Crash as a cooldown, survives.

**Expert:** Perfect Dodges to spike Tempo exactly when needed, Manual Crashes at the right moment to burst clustered enemies, reads enemy mix and decides Cold vs Hot approach per room, enters boss fights at a deliberate Tempo.

The gap between beginner and expert is entirely visible in the Tempo bar at all times.

---

## Build Priority (Core Loop Only)

1. **Cut Pressure** — remove pressure.js, simplify player.js, remove grid overlay
2. **Combo attack system** — 3-hit chain, combo finish, Heavy Strike (right click)
3. **Perfect Dodge** — timing window, slow-mo, Tempo reward
4. **Manual Crash** — F key at 85+, burst damage, stagger
5. **Tempo state behaviors** — Cold stagger, Hot dash-attack, Critical pierce + instant death
6. **New enemies** — Shield Drone + Tempo Vampire (2 new types, no art needed)
7. **New items** — 6 items from the table above
8. **Tempo carry between rooms** — don't reset on transition
