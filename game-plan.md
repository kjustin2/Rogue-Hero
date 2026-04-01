# Rogue-Hero: Refined Game Plan

## What This Game Is
A **roguelike RPG** with fast, snappy combat built around a single core tension: **Tempo**.

You pick a class, descend through procedurally arranged rooms, fight enemies, collect items, and grow your character each run. Death is permanent. Every run is different. The combat loop is the same every room but the decisions inside it are always fresh.

---

## The Revised Combat Loop

### Tempo Is Everything
Tempo is the central resource. It drives the pace and risk of every fight.

- **Attacking raises Tempo** (+5 per hit, +10 per kill)
- **Dodging lowers Tempo** (-15)
- **Natural decay** brings Tempo back to 50 slowly when you stop acting
- **Tempo Crash at 100** — brief stagger (0.3s), resets to 50. Survivable but dangerous.

| Tempo | State | Feel |
|---|---|---|
| 0–30 | Cold | Slow, methodical. Enemies sluggish. Low damage. |
| 30–70 | Flowing | Baseline. Neutral risk/reward. |
| 70–90 | Hot | Fast, hard-hitting. Enemies aggressive. +30% damage. |
| 90–100 | Critical | Frantic. Max damage both ways. One mistake ends you. |

The Tempo bar is the most important thing on screen. It's large, central, impossible to ignore.

---

### Pressure Is Your Tool (Not Your Problem)
Pressure builds **fast** — roughly 0.5 seconds to max in any cell you stand in.

When you leave a cell: **instant shockwave**. No delay. The damage fires the moment you step off.

Pressure is not something you manage defensively. It's a weapon you pick up and put down constantly. You stand, you charge it, you move — damage happens. It's a rhythm, not a resource bar.

```
Stand → (0.5s) → Full Pressure → Step away → INSTANT shockwave
```

You route your movement through enemies to chain releases. The floor lights up under your feet, you move, it explodes. Clean. Snappy.

---

### The Core Tension
- **Attacking** (to raise Tempo for damage bonuses) builds Pressure fast — you're standing still to swing
- **Moving** (to release Pressure and stay safe) lowers your Tempo window
- The loop: move through enemies, land a hit or two, move again — threading Pressure releases between attacks

An aggressive player spikes Tempo high, gets massive damage, takes big risks.
A precise player keeps Tempo mid, methodically Pressure-routes, safer but slower.
Both are valid. Both require skill.

---

## RPG Layer

### Classes (Pick One Per Run)
Three classes with distinct Tempo behaviors:

**Berserker**
- Loves high Tempo. Damage scales harder with Tempo than other classes.
- Passive: Tempo Crash doesn't stagger — instead it resets to 70 and fires a free shockwave.
- Stats: High Power, average Speed, low HP

**Shadow**
- Pressure-focused. Pressure builds 2x faster. Shockwave radius is larger.
- Passive: Dodging generates a Pressure burst on exit instead of just reducing Tempo.
- Stats: High Speed, average Power, average HP

**Warden**
- Tank. Tempo decays faster (easier to control). High HP.
- Passive: Taking damage generates Tempo (turns punishment into resource).
- Stats: High HP, low Speed, average Power

---

### Stats
Each class has base values for:
- `max_hp` — hit points
- `speed` — movement speed (px/sec)
- `power` — damage multiplier
- `tempo_gain` — multiplier on all Tempo increases
- `pressure_radius` — shockwave hit radius

---

### Leveling
- Enemies drop XP
- Level up every ~10 kills (scales per floor)
- Level up offers: **pick 1 of 3 stat upgrades**
- Max level per run: 10

---

### Items
- Draft 1 of 3 items after each room is cleared
- Items modify stats or add passive behaviors
- 12 items at launch, mix of stat bumps and mechanic modifiers

| Item | Effect |
|---|---|
| Volatile Soles | Pressure shockwave size +50% |
| Metronome | Tempo decay rate +100% (easier control) |
| Red Line | At Tempo 90+, attacks pierce enemies |
| Anchor Stone | Pressure builds 1.5x faster |
| Cold Blood | Kills below Tempo 30 restore 1 HP |
| Tempo Tap | Dodging raises Tempo by 5 instead of lowering it |
| Surge Coil | Tempo Crash resets to 60 instead of 50 |
| Iron Pulse | Each kill raises max HP by 1 |

---

## Structure of a Run

```
Class select
  → Floor 1 (3 rooms + miniboss)
  → Floor 2 (4 rooms + miniboss)
  → Floor 3 (5 rooms + boss)
```

Each room: kill all enemies → item draft → next room.
Each floor: theme, enemy set, and Tempo modifiers change.

**Floor Themes (planned):**
- Floor 1 — The Pit (cave/dungeon, basic enemies, normal Tempo rules)
- Floor 2 — The Clockwork (mechanical enemies, Tempo decay is slower — danger lingers)
- Floor 3 — The Abyss (fast enemies, Tempo spikes harder on hits)

---

## Feel Targets
- Movement: **instant response**, high acceleration. Never feels floaty.
- Shockwave: **no delay**, clear visual pop, satisfying sound.
- Tempo bar: **large and reactive**. Color shifts smoothly from blue → orange → red.
- Death: feels earned. The last mistake is always visible in retrospect.
- Run length: **20–30 minutes** for a full clear.

---

## Build Scope (MVP)

| Feature | Status |
|---|---|
| Tempo system | To build |
| Pressure grid | To build |
| Player (1 class) | To build |
| 2 enemy types | To build |
| Room transitions | To build |
| Item draft (4 items) | To build |
| 1 floor | To build |
| 1 boss | To build |
| Class select | Post-MVP |
| Full 3 floors | Post-MVP |
| All 12 items | Post-MVP |
