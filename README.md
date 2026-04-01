# Rogue-Hero

Roguelike RPG prototype built on HTML5 Canvas + vanilla JavaScript. No dependencies, no build step.

## Mechanics

- **Tempo** — a 0–100 resource raised by attacking and killing, lowered by dodging, decaying toward 50 at rest. High Tempo = more damage, faster enemies, higher risk. Crashes at 100.
- **Pressure** — a grid of floor cells that charge up while you stand on them. Step off and the cell releases an instant shockwave that damages nearby enemies. Your movement path is your attack.

## How to Run

```bash
python -m http.server 8000
```

Then open `localhost:8000` in a browser.

## Controls

| Input | Action |
|---|---|
| WASD | Move |
| Left click | Attack nearest enemy |
| Space | Dodge |

## Status

Mechanic prototype — placeholder graphics, no audio. Validates the Tempo + Pressure combat loop before building toward a full release.
