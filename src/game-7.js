canvas.addEventListener("contextmenu", event => event.preventDefault());

canvas.addEventListener("mousedown", event => {
  if (paused || mouseOnHud(event.target)) return;
  mouse.down = true;
  mouse.button = event.button;

  const panMode = event.button === 1 || (event.button === 0 && keys.has("Space"));
  if (panMode) {
    drag = {
      mode: "pan",
      startX: event.clientX,
      startY: event.clientY,
      cameraX: camera.x,
      cameraY: camera.y
    };
    canvas.style.cursor = "grabbing";
    return;
  }

  if (event.button === 2) {
    selectedBuildingKey = null;
    beltDrag = null;
    updateInspector();
    return;
  }

  if (event.button !== 0) return;
  const tile = screenToTile(event.clientX, event.clientY);
  const existing = inBounds(tile.x, tile.y) ? state.buildings[keyFor(tile.x, tile.y)] : null;

  if (existing) {
    selectBuilding(tile.x, tile.y);
    return;
  }

  if (selectedTool === "belt") {
    beltDrag = { start: tile };
    return;
  }

  placeBuilding(selectedTool, tile.x, tile.y);
});

window.addEventListener("mousemove", event => {
  mouse.x = event.clientX;
  mouse.y = event.clientY;
  hoverTile = screenToTile(event.clientX, event.clientY);

  const edge = 14;
  edgeScroll.x = event.clientX < edge ? -1 : event.clientX > viewport.width - edge ? 1 : 0;
  edgeScroll.y = event.clientY < edge ? -1 : event.clientY > viewport.height - edge ? 1 : 0;

  if (drag?.mode === "pan") {
    camera.x = drag.cameraX - (event.clientX - drag.startX) / camera.zoom;
    camera.y = drag.cameraY - (event.clientY - drag.startY) / camera.zoom;
  }

  if (hoverTile && inBounds(hoverTile.x, hoverTile.y)) {
    const tile = terrain[hoverTile.y][hoverTile.x];
    const building = state.buildings[keyFor(hoverTile.x, hoverTile.y)];
    UI.cursorTooltip.style.display = "block";
    UI.cursorTooltip.style.left = `${event.clientX}px`;
    UI.cursorTooltip.style.top = `${event.clientY}px`;
    UI.cursorTooltip.textContent = building
      ? BUILDINGS[building.type].name
      : tile.ore
        ? `${ITEMS[tile.ore].name} field`
        : `${hoverTile.x}, ${hoverTile.y}`;
  } else {
    UI.cursorTooltip.style.display = "none";
  }
});

window.addEventListener("mouseup", event => {
  if (event.button === 0 && beltDrag && hoverTile && !paused) {
    placeBeltPath(getBeltPath(beltDrag.start, hoverTile));
  }
  beltDrag = null;
  drag = null;
  mouse.down = false;
  mouse.button = -1;
  canvas.style.cursor = "";
});

canvas.addEventListener("wheel", event => {
  event.preventDefault();
  if (paused) return;
  const before = screenToWorld(event.clientX, event.clientY);
  camera.zoom = clamp(camera.zoom * Math.exp(-event.deltaY * 0.0011), 0.42, 1.55);
  camera.x = before.x - (event.clientX - viewport.width / 2) / camera.zoom;
  camera.y = before.y - (event.clientY - viewport.height / 2) / camera.zoom;
}, { passive: false });

minimap.addEventListener("click", event => {
  const rect = minimap.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width * WORLD_W;
  const y = (event.clientY - rect.top) / rect.height * WORLD_H;
  centerOnTile(x, y);
});

window.addEventListener("keydown", event => {
  if (event.code === "F1") {
    event.preventDefault();
    openHelp();
    return;
  }

  if (event.code === "Escape") {
    if (document.getElementById("help-screen").classList.contains("show")) {
      closeHelp();
    } else if (!document.getElementById("start-screen").classList.contains("show")) {
      togglePause();
    }
    return;
  }

  if (event.code === "KeyP") {
    togglePause();
    return;
  }

  if (paused) return;
  keys.add(event.code);

  const tool = Object.entries(BUILDINGS).find(([, definition]) => definition.key === event.key)?.[0];
  if (tool) setBuildTool(tool);

  if (event.code === "KeyR") {
    if (selectedBuildingKey) rotateSelected();
    else rotateBuild(1);
  }
  if (event.code === "KeyQ") {
    const tools = ["belt", "miner", "furnace", "assembler", "chest", "splitter"];
    setBuildTool(tools[(tools.indexOf(selectedTool) + tools.length - 1) % tools.length]);
  }
  if (event.code === "KeyE") {
    const tools = ["belt", "miner", "furnace", "assembler", "chest", "splitter"];
    setBuildTool(tools[(tools.indexOf(selectedTool) + 1) % tools.length]);
  }
  if (event.code === "Delete" || event.code === "Backspace") {
    event.preventDefault();
    sellSelected();
  }
});

window.addEventListener("keyup", event => keys.delete(event.code));
window.addEventListener("blur", () => {
  keys.clear();
  edgeScroll = { x: 0, y: 0 };
});
window.addEventListener("resize", resize);
window.addEventListener("beforeunload", () => saveGame());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    saveGame();
    paused = true;
  }
});

document.querySelectorAll(".build-tool").forEach(button => {
  button.addEventListener("click", () => setBuildTool(button.dataset.tool));
});

document.getElementById("rotate-selected").addEventListener("click", rotateSelected);
document.getElementById("sell-selected").addEventListener("click", sellSelected);
document.getElementById("close-inspector").addEventListener("click", () => {
  selectedBuildingKey = null;
  updateInspector();
});

document.getElementById("menu-button").addEventListener("click", () => togglePause(true));
document.getElementById("pause-button").addEventListener("click", () => togglePause());
document.getElementById("help-button").addEventListener("click", openHelp);
document.getElementById("pause-help").addEventListener("click", openHelp);
document.getElementById("close-help").addEventListener("click", closeHelp);
document.getElementById("close-help-bottom").addEventListener("click", closeHelp);
document.getElementById("resume-game").addEventListener("click", () => togglePause(false));
document.getElementById("pause-save").addEventListener("click", () => saveGame(true));
document.getElementById("pause-restart").addEventListener("click", () => {
  if (confirm("Abandon this sector and erase the current operation?")) {
    localStorage.removeItem(SAVE_KEY);
    newGame();
    hideOverlay("pause-screen");
  }
});
document.getElementById("continue-after-victory").addEventListener("click", () => {
  hideOverlay("victory-screen");
  paused = false;
});

UI.continueGame.addEventListener("click", () => {
  if (!hasSave) return;
  hideOverlay("start-screen");
  paused = false;
  startAudio();
  setStatus("Saved operation restored.");
});

document.getElementById("new-game").addEventListener("click", () => {
  if (hasSave && !confirm("Start a new sector and overwrite the current save?")) return;
  newGame();
});

resize();
loadGame();
requestAnimationFrame(frame);
