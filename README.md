# Rogue-Hero

Roguelike RPG prototype built on HTML5 Canvas + vanilla JavaScript. No dependencies, no build step.

## Note for Antigravity
> [!IMPORTANT]
> The Antigravity assistant reads the game state every time it runs.
> 
> The game MUST be started with `python -m http.server 8000`.
> It starts at port 8000 on `localhost`.

## Mechanics

- **Tempo** — a 0–100 resource raised by attacking and killing, lowered by dodging, decaying toward 50 at rest. High Tempo = more damage, faster enemies, higher risk. Crashes at 100.

## How to Run

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in a browser.

## Controls

| Input | Action |
|---|---|
| Click / Any Key | Start from Menu |
| WASD | Move |
| Mouse | Aim |
| Left click | Combo Attack (Auto-aims if close) |
| Right click | Heavy Strike (Charge-up arc) |
| Space | Dodge (Free at Cold, -5 at Hot, Locked at Critical) |
| F | Manual Tempo Crash (85+ Tempo only) |
| R | Restart (Dead / Win only) |

