# Main Action Loop

## The One-Line Summary
You build Pressure by standing still, release it as damage by moving — while managing Tempo to control how fast and chaotic the fight gets.

---

## Second-by-Second Flow

### Entering a Room
- Room loads, enemies spawn at fixed points
- Pressure grid is empty, Tempo is at resting value (50)
- Player has ~1 second before enemies activate — use it to read the room

---

### The Movement Loop (Core)

**Standing still** — Pressure builds rapidly under your feet. The floor glows. You feel the danger.

**Moving away** — Pressure releases as a radial shockwave from the cell you just left. Damage to anything in range. The faster you were moving, the wider the wave.

This means **your movement path IS your attack pattern.** You're not just dodging — you're routing damage through the room.

```
Stand → Pressure builds → Move → Shockwave releases → Damage
```

The skill: *where* you stand and *when* you leave. Standing near a cluster of enemies means your release hits all of them. Standing in a corner means you're wasting it.

---

### The Tempo Layer

Every **offensive action** — attacking, using a skill, landing a hit — raises Tempo.

Tempo affects the **pace of the entire room:**

| Tempo Range | Effect |
|---|---|
| 0–30 (Low) | Everything slows. You hit softer. Enemies are sluggish. Safe but grindy. |
| 30–70 (Mid) | Baseline. Neutral feel. |
| 70–90 (High) | Everything speeds up. You hit hard. Enemies react faster, hit harder too. |
| 90–100 (Critical) | Frantic. Maximum damage on both sides. One mistake can kill you. |

Tempo decays naturally back toward 50 when you stop attacking. So:
- **Aggressive play** → spikes Tempo → high risk, high reward
- **Passive play** → Tempo bleeds down → low risk, low reward, fights drag

The skill: *choosing your Tempo window.* Spike it for a burst, then back off and let it decay before re-engaging.

---

### The Interaction Between Pressure and Tempo

This is where the depth lives.

- **High Tempo + high Pressure release** = massive burst damage, but enemies are fast and will punish a bad position
- **Low Tempo + precision Pressure routing** = methodical, surgical — you control the pace and pick your spots
- Some enemy types **feed** on your Pressure releases (they absorb them to heal or charge)
- Some builds let you **convert** Tempo into Pressure generation or vice versa

The two systems create a constant negotiation:
> *Do I go fast and chaotic for big damage, or slow and precise for safe damage?*

Neither is always right. The answer changes based on enemy type, room layout, and current HP.

---

### Enemies Respond to Both Systems

Enemies aren't passive. They interact with your mechanics:

- **Chasers** — follow you, stand still when they reach you (builds pressure under THEM — bait them into standing, then leave)
- **Shooters** — punish high-Tempo windows by firing faster when Tempo is elevated
- **Anchors** — generate their own Pressure field around them, forcing you to engage on bad terrain

Each enemy type has a "tell" — a visual cue for when they're about to act. Reading tells is how you know when to spike Tempo and when to hold.

---

### The Room Ends

- Kill all enemies → room cleared
- Pressure grid resets, but Tempo carries over (punishes reckless finishes)
- Item draft: choose 1 of 3 items
- Exit opens → next room

---

## The Full Loop Summary

```
Enter room
  → Read enemy positions, plan movement route
  → Move to bait enemies into clusters
  → Stand briefly → Pressure builds
  → Move through enemies → Shockwave releases → Damage
  → If engaging directly → Tempo rises → pace accelerates
  → Decide: ride the Tempo spike for burst OR back off and reset
  → Repeat until room cleared
  → Take item, carry Tempo into next room
  → Run ends at boss: a fight that forces you through all Tempo ranges
```

---

## What Mastery Looks Like

A beginner plays reactively — moving to dodge, attacking when safe, watching Tempo spike by accident.

A skilled player plays *proactively* — they route their movement to release Pressure on multiple enemies simultaneously, deliberately spike Tempo before a kill window, then retreat to let it decay. They read enemy tells and choose *when* to engage, not just *how*.

The gap between "I survived" and "I dominated" is entirely about intentional Pressure routing and Tempo timing. Both are immediately visible on screen, so the feedback loop is tight — you always know what you did wrong.

---

## What This Feels Like to Play

- Each room feels like a short puzzle with combat urgency
- No two rooms play out the same way (layout + enemy mix changes the optimal path)
- Death is always readable: "I stood too long" or "I let Tempo get too high"
- Good runs feel like flowing water — movement, release, spike, retreat, repeat
- The game rewards players who think in *routes*, not just reactions
