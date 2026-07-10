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
| `1`–`9` | Select structure |
| Left click | Place / select |
| Left drag with Belt selected | Build belt route |
| Right click | Cancel selection |
| `R` | Rotate |
| `Q` / `E` | Cycle structures |
| `Delete` / `Backspace` | Dismantle selected structure |
| `P` / `Esc` | Pause |
| `F1` | Open controls codex |
| `T` | Open technology tree |
| `B` | Open production recipe codex |

## Production chain

- Iron ore + coal → iron plates
- Copper ore + coal → copper plates
- Iron plates → gear assemblies
- Copper plates → copper wire
- Iron plates + copper wire → control circuits
- Gear assemblies + control circuits → research packs

Deliver products to the central Command Core to earn credits and complete colony milestones.

## Phaser sprite renderer

- Phaser 3.90.0 now owns the world scene, camera, pointer input, particles, and sprite rendering.
- The existing factory simulation, save migration, technology tree, recipes, missions, and DOM HUD remain compatible.
- `assets/foundry-sprites.svg` contains an original 48-frame vector sprite sheet for terrain, belts, buildings, cargo, effects, and direction indicators.
- Phaser 3.90.0 is loaded from the version-pinned jsDelivr npm CDN, following Phaser's documented browser setup.
- The legacy Canvas renderer remains as a startup fallback if Phaser cannot initialize.

## Technical notes

- Phaser 3.90.0 browser runtime loaded from a version-pinned CDN
- Sprite-based world scene with a legacy Canvas startup fallback
- Local autosave with `localStorage`
- Static deployment compatible with Vercel
- Desktop-only layout and controls

## Power system

- Burner furnaces have independent coal and ore buffers and retain partial smelting progress while fuel-starved.
- Coal Generators consume one coal for 14 seconds of generation.
- Electric Miners extract faster but draw from the colony grid.
- Electric Furnaces require no coal, smelt faster, and draw from the colony grid.
- Power technologies unlock generators, electric machinery, grid expansion, and turbine optimization.
- Press `7`, `8`, and `9` to select the Generator, Electric Miner, and Electric Furnace after researching them.


## Progression safeguards

- Mission-critical fabrication technologies are automatically authorized when their associated mission becomes active.
- Credits can always be converted into research points from the technology screen, preventing permanent research dead-ends.

## Belt logistics

- Belt routes use obstacle-aware pathfinding and safely merge at existing endpoints.
- Cargo is distributed across two visible lanes with endpoint margins to prevent item overlap.
- Select any structure for detailed recipes, or press `B` to open the complete Production Codex.
