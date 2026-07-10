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
| `0` | Inspect / free cursor mode |
| `1`–`9` | Select structure |
| Left click | Place / select |
| Left drag with Belt selected | Build an obstacle-aware belt route |
| Right click | Cancel selection |
| `R` | Rotate |
| `Q` / `E` | Cycle structures |
| `T` | Open technology tree |
| `B` | Open production recipe codex |
| `Delete` / `Backspace` | Dismantle selected structure |
| `P` / `Esc` | Pause |
| `F1` | Open controls codex |

## Production chain

- Iron ore + coal → iron plates in a burner furnace
- Copper ore + coal → copper plates in a burner furnace
- Iron or copper ore → plates in an electric furnace
- Iron plates → gear assemblies
- Copper plates → copper wire
- Iron plates + copper wire → control circuits
- Gear assemblies + control circuits → research packs

Deliver products to the central Command Core to earn credits and complete colony milestones.

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
- Belt cargo preserves lane spacing while waiting for a blocked output.

## Recipe visibility

- Select any structure to view its inputs, outputs, cycle time, power or fuel requirements, and operational role.
- Press `B` to open the complete Production Codex for extraction, smelting, fabrication, power, and logistics recipes.

## Technical notes

- No framework or external runtime dependencies
- Full-screen Canvas renderer
- Local autosave with `localStorage`
- Save migration for older furnace, belt, and technology data
- Static deployment compatible with Vercel
- Desktop-only layout and controls
