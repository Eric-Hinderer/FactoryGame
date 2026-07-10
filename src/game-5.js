function drawHub(x, y, size, time) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const pulse = 0.5 + Math.sin(time / 450) * 0.12;

  ctx.shadowColor = "#72d9e9";
  ctx.shadowBlur = size * 0.22 * pulse;
  roundedRect(x + size * 0.06, y + size * 0.06, size * 0.88, size * 0.88, size * 0.12, "#1c303a", "#72d9e9", Math.max(1, size * 0.025));
  ctx.shadowBlur = 0;

  ctx.strokeStyle = "rgba(114,217,233,.65)";
  ctx.lineWidth = Math.max(1, size * 0.035);
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.24, time / 900, time / 900 + Math.PI * 1.45);
  ctx.stroke();

  ctx.fillStyle = "#d9f4f7";
  ctx.font = `800 ${size * 0.17}px Segoe UI`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("CORE", cx, cy - size * 0.03);

  ctx.fillStyle = "#72d9e9";
  ctx.font = `700 ${size * 0.095}px Segoe UI`;
  ctx.fillText("COMMAND", cx, cy + size * 0.18);
}

function drawBelt(building, x, y, size, time) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const vector = dirVec(building.dir);
  const perpendicular = { x: -vector.y, y: vector.x };

  roundedRect(x + size * 0.06, y + size * 0.11, size * 0.88, size * 0.78, size * 0.08, "#202a32", "#40515c", Math.max(1, size * 0.018));

  ctx.strokeStyle = "#536672";
  ctx.lineWidth = Math.max(2, size * 0.065);
  ctx.lineCap = "round";
  for (const offset of [-0.25, 0.25]) {
    ctx.beginPath();
    ctx.moveTo(
      cx + perpendicular.x * size * offset - vector.x * size * 0.32,
      cy + perpendicular.y * size * offset - vector.y * size * 0.32
    );
    ctx.lineTo(
      cx + perpendicular.x * size * offset + vector.x * size * 0.32,
      cy + perpendicular.y * size * offset + vector.y * size * 0.32
    );
    ctx.stroke();
  }

  const scroll = (time / 700) % 1;
  for (let i = -1; i < 3; i++) {
    const along = ((i + scroll) / 3 - 0.5) * size * 0.62;
    ctx.strokeStyle = "rgba(151,176,188,.45)";
    ctx.lineWidth = Math.max(1, size * 0.025);
    ctx.beginPath();
    ctx.moveTo(
      cx + vector.x * along + perpendicular.x * size * 0.18,
      cy + vector.y * along + perpendicular.y * size * 0.18
    );
    ctx.lineTo(
      cx + vector.x * along - perpendicular.x * size * 0.18,
      cy + vector.y * along - perpendicular.y * size * 0.18
    );
    ctx.stroke();
  }

  if (building.item) {
    const t = building.itemProgress - 0.5;
    drawItem(
      building.item,
      cx + vector.x * size * t * 0.72,
      cy + vector.y * size * t * 0.72,
      size * 0.1
    );
  }
}

function drawMiner(building, x, y, size, time) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  roundedRect(x + size * 0.08, y + size * 0.1, size * 0.84, size * 0.78, size * 0.09, "#30343a", "#6d747a", Math.max(1, size * 0.02));

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(time / 380) * 0.18 - 0.42);
  ctx.strokeStyle = "#cad5da";
  ctx.lineWidth = Math.max(2, size * 0.055);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-size * 0.05, size * 0.25);
  ctx.lineTo(size * 0.04, -size * 0.19);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size * 0.01, -size * 0.2, size * 0.18, 3.4, 5.9);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "#efb85b";
  ctx.fillRect(x + size * 0.14, y + size * 0.15, size * 0.18, size * 0.055);
}

function drawFurnace(building, x, y, size, time) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  roundedRect(x + size * 0.08, y + size * 0.08, size * 0.84, size * 0.84, size * 0.09, "#382f2c", "#75635a", Math.max(1, size * 0.02));

  ctx.fillStyle = "#090b0d";
  ctx.beginPath();
  ctx.arc(cx, cy + size * 0.06, size * 0.23, 0, Math.PI * 2);
  ctx.fill();

  const active = building.progress > 0;
  const glow = active ? 0.72 + Math.sin(time / 90) * 0.2 : 0.15;
  ctx.shadowColor = "#ff8d43";
  ctx.shadowBlur = active ? size * 0.28 : 0;
  ctx.fillStyle = `rgba(255,125,54,${glow})`;
  ctx.beginPath();
  ctx.arc(cx, cy + size * 0.07, size * (active ? 0.15 : 0.09), 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#9a6d54";
  ctx.fillRect(x + size * 0.67, y + size * 0.02, size * 0.14, size * 0.31);
}

function drawAssembler(building, x, y, size, time) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  roundedRect(x + size * 0.07, y + size * 0.08, size * 0.86, size * 0.84, size * 0.08, "#24373c", "#4f8993", Math.max(1, size * 0.02));

  const rotation = time / 620;
  ctx.strokeStyle = "#b8e6eb";
  ctx.lineWidth = Math.max(2, size * 0.04);
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.21, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 8; i++) {
    const angle = rotation + i * Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * size * 0.21, cy + Math.sin(angle) * size * 0.21);
    ctx.lineTo(cx + Math.cos(angle) * size * 0.29, cy + Math.sin(angle) * size * 0.29);
    ctx.stroke();
  }

  ctx.fillStyle = ITEMS[RECIPES[building.recipe].output].color;
  ctx.font = `800 ${size * 0.14}px Segoe UI`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ITEMS[RECIPES[building.recipe].output].short, cx, cy);
}

function drawChest(building, x, y, size) {
  roundedRect(x + size * 0.09, y + size * 0.13, size * 0.82, size * 0.72, size * 0.06, "#41372b", "#8e7658", Math.max(1, size * 0.02));
  ctx.fillStyle = "#ad8c63";
  ctx.fillRect(x + size * 0.09, y + size * 0.42, size * 0.82, size * 0.12);
  ctx.fillStyle = "#dbc094";
  ctx.fillRect(x + size * 0.44, y + size * 0.43, size * 0.12, size * 0.16);
}

function drawSplitter(building, x, y, size, time) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  roundedRect(x + size * 0.07, y + size * 0.08, size * 0.86, size * 0.84, size * 0.08, "#2b2939", "#7770a1", Math.max(1, size * 0.02));

  ctx.strokeStyle = "#b8b0e4";
  ctx.lineWidth = Math.max(2, size * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.22, cy);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx + size * 0.2, cy - size * 0.19);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + size * 0.2, cy + size * 0.19);
  ctx.stroke();

  const pulse = 0.55 + Math.sin(time / 180) * 0.2;
  ctx.fillStyle = `rgba(184,176,228,${pulse})`;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.08, 0, Math.PI * 2);
  ctx.fill();

  if (building.buffer.length) drawItem(building.buffer[0], cx, cy, size * 0.09);
}

function drawPlacementPreview() {
  if (!hoverTile || drag?.mode === "pan") return;

  if (selectedTool === "belt" && beltDrag) {
    const path = getBeltPath(beltDrag.start, hoverTile);
    for (const tile of path) {
      if (!inBounds(tile.x, tile.y)) continue;
      const screen = worldToScreen(tile.x * TILE, tile.y * TILE);
      const size = TILE * camera.zoom;
      const valid = !state.buildings[keyFor(tile.x, tile.y)] || state.buildings[keyFor(tile.x, tile.y)].type === "belt";
      ctx.save();
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = valid ? "rgba(114,217,233,.22)" : "rgba(226,103,103,.24)";
      ctx.fillRect(screen.x + 2, screen.y + 2, size - 4, size - 4);
      drawArrow(screen.x + size / 2, screen.y + size / 2, tile.dir, size * 0.14, valid ? "#72d9e9" : "#e26767", 0.9);
      ctx.restore();
    }
    return;
  }

  if (!inBounds(hoverTile.x, hoverTile.y)) return;
  const screen = worldToScreen(hoverTile.x * TILE, hoverTile.y * TILE);
  const size = TILE * camera.zoom;
  const valid = canPlace(selectedTool, hoverTile.x, hoverTile.y);

  ctx.save();
  ctx.globalAlpha = 0.68;
  ctx.fillStyle = valid ? "rgba(114,217,233,.18)" : "rgba(226,103,103,.2)";
  ctx.strokeStyle = valid ? "#72d9e9" : "#e26767";
  ctx.lineWidth = 2;
  ctx.fillRect(screen.x + 2, screen.y + 2, size - 4, size - 4);
  ctx.strokeRect(screen.x + 2, screen.y + 2, size - 4, size - 4);
  drawArrow(screen.x + size / 2, screen.y + size / 2, buildDirection, size * 0.15, valid ? "#72d9e9" : "#e26767");
  ctx.restore();
}

function drawParticles() {
  for (const particle of particles) {
    const screen = worldToScreen(particle.x, particle.y);
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = particle.size * 2;
    ctx.fillRect(screen.x, screen.y, particle.size * camera.zoom, particle.size * camera.zoom);
    ctx.restore();
  }
}

function drawAtmosphere(time) {
  const cycle = (state.played % 180) / 180;
  const night = 0.12 + (Math.sin(cycle * Math.PI * 2 - Math.PI / 2) + 1) * 0.08;

  const vignette = ctx.createRadialGradient(
    viewport.width / 2,
    viewport.height / 2,
    viewport.height * 0.18,
    viewport.width / 2,
    viewport.height / 2,
    viewport.width * 0.78
  );
  vignette.addColorStop(0, `rgba(3,7,10,${night * 0.2})`);
  vignette.addColorStop(0.7, `rgba(3,7,10,${night * 0.7})`);
  vignette.addColorStop(1, `rgba(0,0,0,${0.5 + night})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  ctx.save();
  ctx.globalAlpha = 0.025;
  ctx.fillStyle = "#9feaf3";
  const scanY = (time / 35) % 5;
  for (let y = scanY; y < viewport.height; y += 5) ctx.fillRect(0, y, viewport.width, 1);
  ctx.restore();
}

function drawWorld(time) {
  ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
  drawTerrain();

  Object.values(state.buildings)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .forEach(building => drawBuilding(building, time));

  drawPlacementPreview();
  drawParticles();
  drawAtmosphere(time);
}
