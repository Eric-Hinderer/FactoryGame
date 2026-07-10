function drawMinimap() {
  const width = minimap.width;
  const height = minimap.height;
  mctx.fillStyle = "#070a0d";
  mctx.fillRect(0, 0, width, height);

  const sx = width / WORLD_W;
  const sy = height / WORLD_H;

  for (let y = 0; y < WORLD_H; y++) {
    for (let x = 0; x < WORLD_W; x++) {
      const ore = terrain[y][x].ore;
      if (!ore) continue;
      mctx.globalAlpha = 0.34;
      mctx.fillStyle = ITEMS[ore].color;
      mctx.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
    }
  }
  mctx.globalAlpha = 1;

  for (const building of Object.values(state.buildings)) {
    mctx.fillStyle = building.type === "hub"
      ? "#72d9e9"
      : building.type === "belt"
        ? "#50636e"
        : "#d2ad6c";
    mctx.fillRect(building.x * sx, building.y * sy, Math.max(1.5, sx), Math.max(1.5, sy));
  }

  const topLeft = screenToWorld(0, 0);
  const bottomRight = screenToWorld(viewport.width, viewport.height);
  mctx.strokeStyle = "#d5f5f8";
  mctx.lineWidth = 1.2;
  mctx.strokeRect(
    topLeft.x / TILE * sx,
    topLeft.y / TILE * sy,
    (bottomRight.x - topLeft.x) / TILE * sx,
    (bottomRight.y - topLeft.y) / TILE * sy
  );
}

function updateCamera(dt) {
  if (paused) return;

  let x = 0;
  let y = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp")) y -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) y += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;

  x += edgeScroll.x;
  y += edgeScroll.y;

  if (x || y) {
    const length = Math.hypot(x, y) || 1;
    const speed = (540 / camera.zoom) * dt;
    camera.x += x / length * speed;
    camera.y += y / length * speed;
  }

  const marginX = viewport.width / camera.zoom * 0.35;
  const marginY = viewport.height / camera.zoom * 0.35;
  camera.x = clamp(camera.x, -marginX, WORLD_W * TILE + marginX);
  camera.y = clamp(camera.y, -marginY, WORLD_H * TILE + marginY);
}

function frame(time) {
  const dt = Math.min(0.05, (time - lastFrame) / 1000);
  lastFrame = time;
  updateCamera(dt);
  simulationTick(dt);
  updateParticles(dt);
  drawWorld(time);
  requestAnimationFrame(frame);
}

function showOverlay(id) {
  document.getElementById(id).classList.add("show");
}

function hideOverlay(id) {
  document.getElementById(id).classList.remove("show");
}

function togglePause(force) {
  paused = typeof force === "boolean" ? force : !paused;
  UI.pauseButton.textContent = paused ? "▶" : "Ⅱ";
  document.getElementById("pause-screen").classList.toggle("show", paused);
  if (paused) saveGame();
  else {
    hideOverlay("start-screen");
    hideOverlay("help-screen");
    hideOverlay("victory-screen");
    startAudio();
  }
}

function openHelp() {
  showOverlay("help-screen");
  paused = true;
}

function closeHelp() {
  hideOverlay("help-screen");
  if (!document.getElementById("start-screen").classList.contains("show")) paused = false;
}

function mouseOnHud(target) {
  return Boolean(target.closest("#topbar, #mission-panel, #inspector, #minimap-shell, #build-dock, .overlay"));
}
