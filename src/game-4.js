function updateParticles(dt) {
  particles.forEach(particle => {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= Math.pow(0.2, dt);
    particle.vy *= Math.pow(0.55, dt);
    particle.life -= dt;
  });
  particles = particles.filter(particle => particle.life > 0);
}

function roundedRect(x, y, width, height, radius, fill, stroke, lineWidth = 1) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawArrow(cx, cy, direction, size, color = "#72d9e9", alpha = 1) {
  const vector = dirVec(direction);
  const perpendicular = { x: -vector.y, y: vector.x };
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx + vector.x * size, cy + vector.y * size);
  ctx.lineTo(
    cx - vector.x * size * 0.62 + perpendicular.x * size * 0.62,
    cy - vector.y * size * 0.62 + perpendicular.y * size * 0.62
  );
  ctx.lineTo(
    cx - vector.x * size * 0.62 - perpendicular.x * size * 0.62,
    cy - vector.y * size * 0.62 - perpendicular.y * size * 0.62
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawItem(item, x, y, radius) {
  const definition = ITEMS[item];
  ctx.save();
  ctx.shadowColor = definition.color;
  ctx.shadowBlur = radius * 0.7;
  ctx.fillStyle = definition.color;
  ctx.strokeStyle = "rgba(0,0,0,.8)";
  ctx.lineWidth = Math.max(1, radius * 0.18);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = item === "coal" ? "#aeb5b9" : "#0a0d10";
  ctx.font = `700 ${Math.max(6, radius * 0.8)}px Segoe UI`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(definition.short, x, y + 0.5);
  ctx.restore();
}

function drawTerrain() {
  const gradient = ctx.createLinearGradient(0, 0, 0, viewport.height);
  gradient.addColorStop(0, "#10161c");
  gradient.addColorStop(1, "#080b0f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  const topLeft = screenToWorld(0, 0);
  const bottomRight = screenToWorld(viewport.width, viewport.height);
  const x0 = clamp(Math.floor(topLeft.x / TILE) - 2, 0, WORLD_W - 1);
  const y0 = clamp(Math.floor(topLeft.y / TILE) - 2, 0, WORLD_H - 1);
  const x1 = clamp(Math.ceil(bottomRight.x / TILE) + 2, 0, WORLD_W);
  const y1 = clamp(Math.ceil(bottomRight.y / TILE) + 2, 0, WORLD_H);

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const tile = terrain[y][x];
      const screen = worldToScreen(x * TILE, y * TILE);
      const size = TILE * camera.zoom;
      const value = tile.ground;

      ctx.fillStyle = value > 0.67
        ? "#151d23"
        : value > 0.34
          ? "#12191f"
          : "#10161b";
      ctx.fillRect(screen.x, screen.y, size + 1, size + 1);

      const grain = noise01(x * 5, y * 7, 18);
      if (grain > 0.55 && camera.zoom > 0.46) {
        ctx.fillStyle = `rgba(138,156,166,${0.02 + grain * 0.025})`;
        ctx.fillRect(
          screen.x + size * (0.1 + noise01(x, y, 22) * 0.7),
          screen.y + size * (0.1 + noise01(y, x, 24) * 0.7),
          Math.max(1, size * 0.04),
          Math.max(1, size * 0.04)
        );
      }

      if (tile.ore) drawOreTile(tile.ore, x, y, screen.x, screen.y, size);

      if (tile.debris && !tile.ore && camera.zoom > 0.55) {
        ctx.strokeStyle = "rgba(112,128,136,.16)";
        ctx.lineWidth = Math.max(1, camera.zoom);
        ctx.beginPath();
        ctx.moveTo(screen.x + size * 0.25, screen.y + size * 0.65);
        ctx.lineTo(screen.x + size * 0.42, screen.y + size * 0.49);
        ctx.lineTo(screen.x + size * 0.56, screen.y + size * 0.7);
        ctx.stroke();
      }

      if (camera.zoom > 0.58) {
        ctx.strokeStyle = "rgba(114,151,166,.065)";
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.floor(screen.x) + 0.5, Math.floor(screen.y) + 0.5, size, size);
      }
    }
  }

  const worldStart = worldToScreen(0, 0);
  const worldEnd = worldToScreen(WORLD_W * TILE, WORLD_H * TILE);
  ctx.strokeStyle = "rgba(114,217,233,.3)";
  ctx.lineWidth = 2;
  ctx.strokeRect(worldStart.x, worldStart.y, worldEnd.x - worldStart.x, worldEnd.y - worldStart.y);
}

function drawOreTile(item, x, y, sx, sy, size) {
  const color = ITEMS[item].color;
  ctx.save();
  ctx.globalAlpha = item === "coal" ? 0.24 : 0.21;
  ctx.fillStyle = color;
  ctx.fillRect(sx + 1, sy + 1, size - 2, size - 2);
  ctx.globalAlpha = 1;

  const count = camera.zoom > 0.8 ? 7 : 4;
  for (let i = 0; i < count; i++) {
    const px = sx + size * (0.16 + noise01(x * 11 + i, y * 13, i) * 0.68);
    const py = sy + size * (0.16 + noise01(y * 17 + i, x * 7, i + 2) * 0.68);
    const radius = Math.max(1.5, size * (0.028 + noise01(i, x + y, 31) * 0.025));
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55 + noise01(i, x, y) * 0.35;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBuilding(building, time) {
  const screen = worldToScreen(building.x * TILE, building.y * TILE);
  const size = TILE * camera.zoom;
  const pad = size * 0.08;
  const cx = screen.x + size / 2;
  const cy = screen.y + size / 2;
  const selected = selectedBuildingKey === keyFor(building.x, building.y);

  ctx.save();

  ctx.fillStyle = "rgba(0,0,0,.32)";
  ctx.beginPath();
  ctx.ellipse(cx + size * 0.05, screen.y + size * 0.88, size * 0.4, size * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  if (selected) {
    ctx.shadowColor = "#72d9e9";
    ctx.shadowBlur = 14;
    ctx.strokeStyle = "#72d9e9";
    ctx.lineWidth = Math.max(2, camera.zoom * 2.5);
    ctx.strokeRect(screen.x + 1, screen.y + 1, size - 2, size - 2);
    ctx.shadowBlur = 0;
  }

  if (building.type === "hub") {
    drawHub(screen.x, screen.y, size, time);
    ctx.restore();
    return;
  }

  if (building.type === "belt") {
    drawBelt(building, screen.x, screen.y, size, time);
    ctx.restore();
    return;
  }

  if (building.type === "miner") drawMiner(building, screen.x, screen.y, size, time);
  if (building.type === "furnace") drawFurnace(building, screen.x, screen.y, size, time);
  if (building.type === "assembler") drawAssembler(building, screen.x, screen.y, size, time);
  if (building.type === "chest") drawChest(building, screen.x, screen.y, size);
  if (building.type === "splitter") drawSplitter(building, screen.x, screen.y, size, time);

  if (building.type !== "chest") {
    const vector = dirVec(building.dir);
    drawArrow(
      cx + vector.x * size * 0.34,
      cy + vector.y * size * 0.34,
      building.dir,
      size * 0.075,
      "#72d9e9",
      0.9
    );
  }

  if (building.output?.length) drawItem(building.output[0], cx, cy, size * 0.095);

  if ((building.type === "furnace" || building.type === "assembler") && building.progress > 0) {
    const width = size * 0.68;
    ctx.fillStyle = "rgba(0,0,0,.8)";
    ctx.fillRect(cx - width / 2, screen.y + size * 0.82, width, size * 0.055);
    ctx.fillStyle = "#72d9e9";
    ctx.fillRect(cx - width / 2, screen.y + size * 0.82, width * clamp(building.progress, 0, 1), size * 0.055);
  }

  ctx.restore();
}
