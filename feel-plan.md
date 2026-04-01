# Feel Enhancement Plan: Tempo + Pressure

The game runs but the two core mechanics are invisible. Every change below makes Tempo or Pressure physically felt, not just intellectually understood.

---

## Priority Order
1. Screen vignette tied to Tempo (instant read of danger)
2. Shockwave visual ring (makes Pressure releases satisfying)
3. Hit-stop on attacks (makes combat feel weighty)
4. Damage numbers (feedback loop for Tempo multiplier)
5. Camera shake on crash + big Pressure release
6. Tempo bar pulse/heartbeat
7. Player trail on dodge
8. Enemy death burst

---

## 1. Tempo Vignette (Highest Priority)

A full-screen color overlay that reacts to Tempo in real time. This is the single biggest feel improvement.

**How it works:**
- A `ColorRect` covering the full screen, `mouse_filter = IGNORE`, low alpha
- Color and alpha driven by `Tempo.value` every frame
- Cold (< 30): faint blue tint, barely visible
- Flowing (30–70): invisible
- Hot (70–90): faint orange glow at screen edges
- Critical (90–100): deep red pulse, flickering

**Implementation:**
- Add a `TempoVignette.gd` CanvasLayer node (layer 10, above game, below UI)
- In `_process()`: lerp `ColorRect.color.a` toward target based on Tempo
- At Critical: add a sine-wave flicker (`sin(Time.get_ticks_msec() * 0.01) * 0.05`)

**Also:** At Critical Tempo, apply a subtle `CameraShake` at low intensity continuously.

---

## 2. Shockwave Visual Ring

Right now a shockwave fires and nothing visible happens. This kills the feel of Pressure entirely.

**How it works:**
- When `shockwave_released` signal fires, spawn a `ShockwaveRing` node at world_pos
- A `ColorRect` or `Line2D` circle that:
  - Starts at radius ~10px, full opacity, bright color
  - Expands to full shockwave radius in ~0.12 seconds
  - Fades out as it expands
  - Color scales from yellow (low pressure) to white-hot (full pressure)
- The ring should be very fast — it's punctuation, not spectacle

**Also:**
- Brief screen flash (white, ~2 frames, very low alpha) on release
- Camera nudge (tiny push away from shockwave center)

**Implementation:**
- `ShockwaveRing.gd` — self-destructing Node2D, uses `_draw()` with `draw_arc()`
- PressureGrid emits signal → Main spawns ring at world position

---

## 3. Hit-Stop

The single most impactful "feel" technique in action games. Freezing the game for 2–4 frames on a hit makes every attack feel heavy.

**How it works:**
- On successful hit: `Engine.time_scale = 0.0` for 0.05–0.08 seconds, then back to 1.0
- Scale the duration with Tempo: low Tempo = shorter stop, Critical = longer stop (0.12s)
- On Tempo Crash: longer stop (0.2s) + camera shake

**Implementation:**
- Add `HitStop.gd` autoload
- `HitStop.trigger(duration: float)` sets `Engine.time_scale = 0.0`, uses a real-time timer (`process_mode = ALWAYS`) to restore it
- Player calls `HitStop.trigger(0.06)` on each successful hit

---

## 4. Damage Numbers

Players need to SEE the Tempo multiplier working. Floating damage numbers are the clearest feedback.

**How it works:**
- On any `take_damage()` call, spawn a `DamageNumber` node at the target's position
- Floats upward and fades out over ~0.6 seconds
- Color reflects Tempo state:
  - Cold: grey/white
  - Flowing: white
  - Hot: orange
  - Critical: red, larger font, slight screen shake on spawn

**Implementation:**
- `DamageNumber.gd` — self-destructing Label node
- Enemies call a global `DamageNumbers.spawn(position, amount)` in their `take_damage()`
- Or: signal-based, Enemy emits `damaged(pos, amount)` and a manager handles display

---

## 5. Camera Shake System

Needed for: Tempo Crash, large Pressure releases, player taking damage.

**How it works:**
- A `CameraShake.gd` autoload (or script on Camera2D)
- `shake(intensity: float, duration: float)` — offsets camera by random noise each frame, decays over duration
- Intensities:
  - Player hit: 0.3, 0.15s
  - Tempo Crash: 0.8, 0.3s
  - Large shockwave (pressure > 0.7): 0.5, 0.2s
  - Kill at Critical Tempo: 0.4, 0.1s

**Implementation:**
- Camera2D child of Main (not Player — shake should be independent of movement)
- Camera follows player via `lerp()` in `_process()`, offset by shake value on top

---

## 6. Tempo Bar Heartbeat

The Tempo bar should feel alive, not static.

**Changes:**
- At Hot (70+): bar pulses in scale — gentle `sin()` wave on `scale.x`
- At Critical (90+): pulse is fast and larger, matches the vignette flicker
- On Tempo Crash: bar slams to zero with a brief overshoot animation, flashes white
- State label text (`HOT`, `CRITICAL`) should scale up on transition, not just appear

**Implementation:**
- All in `UI.gd` `_process()` using `sin(Time.get_ticks_msec() * speed) * amplitude`
- Tween the state label scale on `tempo_changed` when crossing a threshold

---

## 7. Player Dodge Trail

Dodging currently feels identical to moving. It needs a distinct visual.

**How it works:**
- During dodge frames, spawn `TrailSegment` sprites at player position every 2 frames
- Each segment fades out over 0.15 seconds
- Color matches current Tempo state color

**Implementation:**
- In `Player.gd` `_physics_process()`: when `_is_dodging`, every other frame spawn a 28x28 `ColorRect` at current position, add to scene, tween alpha 0.5 → 0.0 over 0.15s then queue_free

---

## 8. Enemy Death Burst

Enemies currently disappear silently. Deaths should feel punchy.

**How it works:**
- On `_die()`, before `queue_free()`, spawn 4–6 square "shards" at enemy position
- Each shard: random direction, travels ~40–80px, fades and shrinks over 0.2s
- Color matches enemy type (red for Chaser, blue for Shooter)

**Implementation:**
- `DeathBurst.gd` — spawns N `ColorRect` nodes, each with a tween for position + alpha
- Called from enemy `_die()` before `queue_free()`

---

## 9. Pressure Cell Glow Enhancement

The current floor overlay is functional but subtle. Two improvements:

**Cell edge highlight:** When a cell hits > 0.8 pressure, draw a bright border around it (not just fill).

**Player footprint:** The cell the player currently stands in should glow brighter/more saturated than neighboring cells, making it clear which cell is charging.

**Implementation:** Both handled in `PressureGrid._draw()` — add a `draw_rect(rect, border_color, false, 2.0)` call for high-pressure cells, and a special color for the player's current cell.

---

## Build Order for These Changes

| Step | Change | Impact |
|---|---|---|
| 1 | Tempo vignette | Immediately feel tempo danger |
| 2 | Shockwave ring | Pressure becomes satisfying |
| 3 | Hit-stop | Combat feels weighty |
| 4 | Damage numbers | Tempo multiplier becomes readable |
| 5 | Camera shake | Crashes + deaths have impact |
| 6 | Tempo bar pulse | HUD feels alive |
| 7 | Dodge trail | Dodge feels distinct |
| 8 | Death burst | Kills feel rewarding |
| 9 | Pressure cell glow | Grid reads more clearly |

Steps 1–4 alone will transform the feel. Do those first, playtest, then continue.
