# Foundry Frontier

Foundry Frontier is an original, desktop-first factory automation game built with HTML5 Canvas and vanilla JavaScript.

## Play

The production build is deployed through Vercel. For local development, run any static web server from the repository root:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Controls

| Control | Action |
| --- | --- |
| `WASD` / Arrow keys | Move camera |
| Mouse wheel | Zoom |
| Middle mouse drag | Pan |
| `Space` + left drag | Pan |
| `1`–`6` | Select structure |
| Left click | Place / select |
| Left drag with Belt selected | Build belt route |
| Right click | Cancel selection |
| `R` | Rotate |
| `Q` / `E` | Cycle structures |
| `Delete` / `Backspace` | Dismantle selected structure |
| `P` / `Esc` | Pause |
| `F1` | Open codex |

## Production chain

- Iron ore + coal → iron plates
- Copper ore + coal → copper plates
- Iron plates → gear assemblies
- Copper plates → copper wire
- Iron plates + copper wire → control circuits
- Gear assemblies + control circuits → research packs

Deliver products to the central Command Core to earn credits and complete colony milestones.

## Technical notes

- No framework or external runtime dependencies
- Full-screen Canvas renderer
- Local autosave with `localStorage`
- Static deployment compatible with Vercel
- Desktop-only layout and controls