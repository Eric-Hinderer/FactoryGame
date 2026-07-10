function techPrereqsMet(tech) {
  return tech.prereqs.every(hasTech);
}

function purchaseTech(key) {
  const tech = TECHS[key];
  if (!tech || hasTech(key)) return;
  if (!techPrereqsMet(tech)) {
    toast("Complete the prerequisite technology first.", "bad");
    errorSound();
    return;
  }
  if (state.researchPoints < tech.cost) {
    toast(`Need ${tech.cost} research points.`, "bad");
    errorSound();
    return;
  }

  state.researchPoints -= tech.cost;
  state.techUnlocked.push(key);
  state.techUnlocked = [...new Set(state.techUnlocked)];
  updateBuildToolAvailability();
  updateHUD(true);
  updateInspector();
  renderTechTree();
  saveGame();
  toast(`${tech.name} researched.`, "good");
  setStatus(`${tech.name} integrated into colony systems.`);
  clickSound(920, 0.12);
}

function renderTechTree() {
  ensureProgressionState();
  const grid = document.getElementById("tech-grid");
  const points = document.getElementById("tech-points");
  if (!grid || !points) return;
  points.textContent = Math.floor(state.researchPoints).toLocaleString();
  grid.innerHTML = Object.entries(TECHS).map(([key, tech]) => {
    const unlocked = hasTech(key);
    const available = !unlocked && techPrereqsMet(tech);
    const prerequisites = tech.prereqs.length
      ? `Requires: ${tech.prereqs.map(prereq => TECHS[prereq].name).join(", ")}`
      : "No prerequisite";
    return `
      <article class="tech-node ${unlocked ? "unlocked" : available ? "available" : "blocked"}">
        <div class="tech-tier">${tech.tier}</div>
        <h3>${tech.name}</h3>
        <p>${tech.description}</p>
        <div class="tech-effect">${tech.effect}<br><span style="color:#72818b">${prerequisites}</span></div>
        <button data-tech="${key}" ${unlocked || !available ? "disabled" : ""}>
          ${unlocked ? "Researched" : `Research · ${tech.cost} ◈`}
        </button>
      </article>
    `;
  }).join("");
  grid.querySelectorAll("button[data-tech]").forEach(button => {
    button.addEventListener("click", () => purchaseTech(button.dataset.tech));
  });
}

let resumeAfterTech = false;
function openTechTree() {
  resumeAfterTech = !paused;
  paused = true;
  renderTechTree();
  showOverlay("tech-screen");
}

function closeTechTree() {
  hideOverlay("tech-screen");
  const startVisible = document.getElementById("start-screen").classList.contains("show");
  const pauseVisible = document.getElementById("pause-screen").classList.contains("show");
  if (resumeAfterTech && !startVisible && !pauseVisible) paused = false;
  resumeAfterTech = false;
}

document.getElementById("tech-button").addEventListener("click", openTechTree);
document.getElementById("close-tech").addEventListener("click", closeTechTree);
document.getElementById("close-tech-bottom").addEventListener("click", closeTechTree);

document.getElementById("tech-screen").addEventListener("mousedown", event => {
  if (event.target.id === "tech-screen") closeTechTree();
});

window.addEventListener("keydown", event => {
  const techOpen = document.getElementById("tech-screen").classList.contains("show");
  if (event.code === "KeyT") {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (techOpen) closeTechTree();
    else if (!document.getElementById("start-screen").classList.contains("show")) openTechTree();
  } else if (event.code === "Escape" && techOpen) {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeTechTree();
  }
}, true);

/* Replace construction clicks with a real cursor mode before legacy target handlers run. */
window.addEventListener("mousedown", event => {
  if (event.target !== canvas || paused) return;
  event.stopImmediatePropagation();
  mouse.down = true;
  mouse.button = event.button;

  const panMode = event.button === 1 || (event.button === 0 && keys.has("Space"));
  if (panMode) {
    drag = { mode: "pan", startX: event.clientX, startY: event.clientY, cameraX: camera.x, cameraY: camera.y };
    canvas.style.cursor = "grabbing";
    return;
  }
  if (event.button === 2) {
    setBuildTool("cursor");
    return;
  }
  if (event.button !== 0) return;

  const tile = screenToTile(event.clientX, event.clientY);
  const existing = inBounds(tile.x, tile.y) ? state.buildings[keyFor(tile.x, tile.y)] : null;
  if (existing) {
    selectBuilding(tile.x, tile.y);
    return;
  }
  if (!selectedTool) {
    selectedBuildingKey = null;
    updateInspector();
    return;
  }
  if (selectedTool === "belt") {
    beltDrag = { start: tile };
    return;
  }
  placeBuilding(selectedTool, tile.x, tile.y);
}, true);

document.getElementById("build-toolbar").addEventListener("click", event => {
  const button = event.target.closest(".build-tool");
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (button.disabled) return;
  if (button.dataset.tool !== "cursor" && selectedTool === button.dataset.tool) setBuildTool("cursor");
  else setBuildTool(button.dataset.tool);
}, true);

window.addEventListener("keydown", event => {
  if (event.code === "Escape" && !document.getElementById("tech-screen").classList.contains("show") && !document.getElementById("help-screen").classList.contains("show") && !document.getElementById("start-screen").classList.contains("show")) {
    if (selectedTool || selectedBuildingKey) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setBuildTool("cursor");
    }
  }
  if (event.key === "0" && !paused) {
    event.preventDefault();
    event.stopImmediatePropagation();
    setBuildTool("cursor");
  }
  if ((event.code === "KeyQ" || event.code === "KeyE") && !paused) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const tools = [null, "belt", "miner", "furnace", "assembler", "chest", "splitter", "generator", "electricMiner", "electricFurnace"].filter(type => type === null || isBuildingUnlocked(type));
    const index = Math.max(0, tools.indexOf(selectedTool));
    const delta = event.code === "KeyQ" ? -1 : 1;
    setBuildTool(tools[(index + delta + tools.length) % tools.length] || "cursor");
  }
}, true);

ensureProgressionState();
Object.values(state.buildings).forEach(normalizeBuilding);
updateBuildToolAvailability();
setBuildTool("cursor");
updateHUD(true);
renderTechTree();
/* Power generation, electric machinery, and furnace reliability fixes. */

BUILDINGS.generator = { name: "Coal Generator", cost: 70, power: 0, generation: 36, key: "7" };
BUILDINGS.electricMiner = { name: "Electric Miner", cost: 85, power: 9, key: "8" };
BUILDINGS.electricFurnace = { name: "Electric Furnace", cost: 110, power: 12, key: "9" };

/* Burner-era machines do not draw from the electrical grid. */
BUILDINGS.miner.power = 0;
BUILDINGS.furnace.power = 0;

TECHS.powerEngineering = {
  tier: "Tier 1 · Power",
  name: "Power Engineering",
  cost: 2,
  prereqs: [],
  description: "Restore compact steam-turbine controls and colony distribution switchgear.",
  effect: "Unlocks coal generators. Each fueled generator supplies 36 grid units."
};
TECHS.electricExtraction = {
  tier: "Tier 2 · Power",
  name: "Electric Extraction",
  cost: 4,
  prereqs: ["powerEngineering"],
  description: "Replace autonomous drill drives with high-torque electric motors.",
  effect: "Unlocks Electric Miners with much faster extraction."
};
TECHS.electricSmelting = {
  tier: "Tier 2 · Power",
  name: "Electric Smelting",
  cost: 4,
  prereqs: ["powerEngineering"],
  description: "Use induction chambers instead of solid fuel inside the smelting vessel.",
  effect: "Unlocks Electric Furnaces. They require no coal and smelt faster."
};
TECHS.turbineOptimization = {
  tier: "Tier 3 · Power",
  name: "Turbine Optimization",
  cost: 5,
  prereqs: ["electricExtraction", "electricSmelting"],
  description: "Rebalance turbine stages and high-voltage motor timing across the colony.",
  effect: "Generators supply 50 grid units; electric machines work 15% faster."
};
if (TECHS.gridExpansion) {
  TECHS.gridExpansion.description = "Recommission auxiliary transformers and high-current distribution buses.";
  TECHS.gridExpansion.effect = "Adds 20 always-on units to the base electrical grid.";
}

const BASE_FRESH_STATE_POWER = freshState;
freshState = function () {
  const next = BASE_FRESH_STATE_POWER();
  next.version = 4;
  return next;
};

const BASE_ENSURE_PROGRESSION_POWER = ensureProgressionState;
ensureProgressionState = function () {
  BASE_ENSURE_PROGRESSION_POWER();
  state.version = Math.max(4, state.version || 0);
  const structures = Object.values(state.buildings || {});
  const autoUnlock = [];
  if (structures.some(building => building.type === "generator")) autoUnlock.push("powerEngineering");
  if (structures.some(building => building.type === "electricMiner")) autoUnlock.push("powerEngineering", "electricExtraction");
  if (structures.some(building => building.type === "electricFurnace")) autoUnlock.push("powerEngineering", "electricSmelting");
  for (const tech of autoUnlock) if (!hasTech(tech)) state.techUnlocked.push(tech);
  state.techUnlocked = [...new Set(state.techUnlocked)];
};

const BASE_IS_BUILDING_UNLOCKED_POWER = isBuildingUnlocked;
isBuildingUnlocked = function (type) {
  if (type === "generator") return hasTech("powerEngineering");
  if (type === "electricMiner") return hasTech("electricExtraction");
  if (type === "electricFurnace") return hasTech("electricSmelting");
  return BASE_IS_BUILDING_UNLOCKED_POWER(type);
};

function generatorOutput() {
  return hasTech("turbineOptimization") ? 50 : BUILDINGS.generator.generation;
}

function electricSpeedMultiplier() {
  return hasTech("turbineOptimization") ? 1.15 : 1;
}

const BASE_NORMALIZE_BUILDING_POWER = normalizeBuilding;
normalizeBuilding = function (building) {
  BASE_NORMALIZE_BUILDING_POWER(building);

  if (building.type === "furnace") {
    if (!Number.isFinite(building.burnTime)) {
      building.burnTime = Math.max(0, Number(building.fuel || 0) * 2);
    }
    building.fuel = 0;
    if (building.activeOre && !["ironOre", "copperOre"].includes(building.activeOre)) building.activeOre = null;
  }

  if (building.type === "generator") {
    building.fuelSeconds = Math.max(0, Number(building.fuelSeconds) || 0);
    building.inv.coal = Math.max(0, Number(building.inv.coal) || 0);
  }

  if (building.type === "electricFurnace") {
    building.activeOre = ["ironOre", "copperOre"].includes(building.activeOre) ? building.activeOre : null;
  }

  return building;
};

function oreInventoryTotal(building) {
  return itemCount(building, "ironOre") + itemCount(building, "copperOre");
}

const BASE_CAN_RECEIVE_POWER = canReceive;
canReceive = function (building, item) {
  if (!building) return false;

  if (building.type === "generator") {
    return item === "coal" && itemCount(building, "coal") < 10;
  }

  if (building.type === "furnace") {
    normalizeBuilding(building);
    if (item === "coal") return itemCount(building, "coal") < 8;
    if (item === "ironOre" || item === "copperOre") {
      return itemCount(building, item) < 12 && oreInventoryTotal(building) < 18;
    }
    return false;
  }

  if (building.type === "electricFurnace") {
    normalizeBuilding(building);
    if (item !== "ironOre" && item !== "copperOre") return false;
    return itemCount(building, item) < 16 && oreInventoryTotal(building) < 24;
  }

  return BASE_CAN_RECEIVE_POWER(building, item);
};

const BASE_CAN_PLACE_POWER = canPlace;
canPlace = function (type, x, y) {
  if (type === "electricMiner") {
    if (!inBounds(x, y) || state.buildings[keyFor(x, y)] || !terrain[y][x].ore) return false;
    return isBuildingUnlocked(type) && state.credits >= BUILDINGS[type].cost;
  }
  return BASE_CAN_PLACE_POWER(type, x, y);
};

const BASE_PLACE_BUILDING_POWER = placeBuilding;
placeBuilding = function (type, x, y, direction = buildDirection, quiet = false) {
  if (type === "electricMiner" && (!inBounds(x, y) || !terrain[y][x].ore)) {
    if (!quiet) toast("Electric Miners must be placed directly on a resource field.", "bad");
    errorSound();
    return false;
  }
  return BASE_PLACE_BUILDING_POWER(type, x, y, direction, quiet);
};

function selectFurnaceOre(building) {
  if (building.activeOre && itemCount(building, building.activeOre) > 0) return building.activeOre;
  building.activeOre = itemCount(building, "ironOre") > 0
    ? "ironOre"
    : itemCount(building, "copperOre") > 0
      ? "copperOre"
      : null;
  return building.activeOre;
}

function trySendMachineOutput(building) {
  if (!building.output.length) return true;
  tryPush(building, building.output[0], () => building.output.shift());
  return building.output.length === 0;
}

function updateReliableFurnace(building, dt, electric, gridEfficiency) {
  normalizeBuilding(building);
  if (!trySendMachineOutput(building)) return;

  const ore = selectFurnaceOre(building);
  if (!ore) {
    building.progress = 0;
    building.activeOre = null;
    return;
  }

  let workMultiplier = electric ? gridEfficiency * electricSpeedMultiplier() : 1;
  if (!electric && hasTech("efficientSmelting")) workMultiplier *= 1.25;

  if (!electric) {
    if (building.burnTime <= 0 && itemCount(building, "coal") > 0) {
      building.inv.coal -= 1;
      building.burnTime += 8;
    }
    if (building.burnTime <= 0) return;
  }

  const cycleTime = electric ? 1.35 : 2.45;
  const work = dt * workMultiplier;
  if (!electric) building.burnTime = Math.max(0, building.burnTime - work);
  building.progress += work / cycleTime;

  if (Math.random() < 0.1) {
    spawnMachineParticle(building.x, building.y, electric ? "#72d9e9" : "#df864b");
  }

  if (building.progress >= 1) {
    building.inv[ore] = Math.max(0, itemCount(building, ore) - 1);
    outputQueue(building, ore === "ironOre" ? "ironPlate" : "copperPlate");
    building.progress = 0;
    building.activeOre = null;
  }
}

function updateGenerator(building, dt) {
  normalizeBuilding(building);
  if (building.fuelSeconds <= 0 && itemCount(building, "coal") > 0) {
    building.inv.coal -= 1;
    building.fuelSeconds += 14;
  }
  if (building.fuelSeconds > 0) {
    building.fuelSeconds = Math.max(0, building.fuelSeconds - dt);
    if (Math.random() < 0.08) spawnMachineParticle(building.x, building.y, "#8da0a8");
  }
}

function updateElectricMiner(building, dt, gridEfficiency) {
  normalizeBuilding(building);
  const ore = terrain[building.y]?.[building.x]?.ore;
  if (!ore) return;

  if (building.output.length) {
    tryPush(building, building.output[0], () => building.output.shift());
    if (building.output.length) return;
  }

  building.cooldown -= dt * gridEfficiency * electricSpeedMultiplier();
  if (building.cooldown <= 0) {
    outputQueue(building, ore);
    building.cooldown = 0.62;
    if (Math.random() < 0.2) spawnMachineParticle(building.x, building.y, ITEMS[ore].color);
  }
}

const BASE_UPDATE_BUILDING_POWER = updateBuilding;
updateBuilding = function (building, dt, efficiency) {
  if (building.type === "generator") return updateGenerator(building, dt);
  if (building.type === "furnace") return updateReliableFurnace(building, dt, false, 1);
  if (building.type === "electricFurnace") return updateReliableFurnace(building, dt, true, efficiency);
  if (building.type === "electricMiner") return updateElectricMiner(building, dt, efficiency);

  if (["belt", "miner", "chest"].includes(building.type)) {
    return BASE_UPDATE_BUILDING_POWER(building, dt, 1);
  }
  return BASE_UPDATE_BUILDING_POWER(building, dt, efficiency);
};

powerEfficiency = function () {
  const buildings = Object.values(state.buildings || {});
  const generated = buildings.reduce((sum, building) => {
    if (building.type !== "generator") return sum;
    normalizeBuilding(building);
    return sum + (building.fuelSeconds > 0 ? generatorOutput() : 0);
  }, 0);
  const baseCapacity = 24 + (state.missionIndex || 0) * 6 + (hasTech("gridExpansion") ? 20 : 0);
  const capacity = baseCapacity + generated;
  const used = buildings.reduce((sum, building) => {
    const definition = BUILDINGS[building.type];
    return sum + Math.max(0, definition?.power || 0);
  }, 0);
  return {
    used,
    capacity,
    generated,
    baseCapacity,
    efficiency: used <= capacity || used === 0 ? 1 : clamp(capacity / used, 0.15, 1)
  };
};

const BASE_BUILDING_STATUS_POWER = buildingStatus;
buildingStatus = function (building) {
  if (building.type === "furnace") {
    normalizeBuilding(building);
    if (building.output.length) return "Output blocked. Clear the structure in front of the furnace.";
    if (!selectFurnaceOre(building)) return `Ready. Ore buffers: ${oreInventoryTotal(building)} / 18; coal: ${itemCount(building, "coal")} / 8.`;
    if (building.burnTime <= 0 && itemCount(building, "coal") <= 0) return `Fuel starved at ${Math.round(building.progress * 100)}%. Partial smelt retained.`;
    return `Smelting ${ITEMS[building.activeOre].name}. ${building.burnTime.toFixed(1)}s burn time remaining.`;
  }
  if (building.type === "generator") {
    normalizeBuilding(building);
    return building.fuelSeconds > 0
      ? `Online: ${generatorOutput()} grid units. ${building.fuelSeconds.toFixed(1)}s fuel remaining.`
      : `Offline. Route coal into the generator (${itemCount(building, "coal")} / 10 buffered).`;
  }
  if (building.type === "electricMiner") {
    const power = powerEfficiency();
    const ore = terrain[building.y]?.[building.x]?.ore;
    return ore
      ? `Extracting ${ITEMS[ore].name} at ${Math.round(power.efficiency * 100)}% grid efficiency.`
      : "No viable resource beneath this miner.";
  }
  if (building.type === "electricFurnace") {
    const power = powerEfficiency();
    if (building.output.length) return "Output blocked. Clear the structure in front of the furnace.";
    if (!selectFurnaceOre(building)) return `Awaiting ore. Buffer ${oreInventoryTotal(building)} / 24.`;
    return `Induction smelting ${ITEMS[building.activeOre].name} at ${Math.round(power.efficiency * 100)}% grid efficiency.`;
  }
  return BASE_BUILDING_STATUS_POWER(building);
};

const BASE_UPDATE_HUD_POWER = updateHUD;
updateHUD = function (force = false) {
  BASE_UPDATE_HUD_POWER(force);
  const power = powerEfficiency();
  UI.power.textContent = `${power.used} / ${power.capacity}`;
  UI.power.style.color = power.efficiency < 0.75 ? "#e26767" : power.generated > 0 ? "#71d6a0" : "";
  UI.power.title = `${power.used} grid units used; ${power.capacity} available; ${Math.round(power.efficiency * 100)}% efficiency`;
};

const BASE_UPDATE_INSPECTOR_POWER = updateInspector;
updateInspector = function () {
  BASE_UPDATE_INSPECTOR_POWER();
  const building = selectedBuildingKey && state.buildings[selectedBuildingKey];
  if (!building) return;
  if (building.type === "generator") {
    UI.cycleBar.style.width = `${clamp(building.fuelSeconds / 14 * 100, 0, 100)}%`;
    UI.cycleLabel.textContent = building.fuelSeconds > 0 ? `${generatorOutput()} MW` : "Offline";
  }
  if (building.type === "electricMiner") {
    UI.cycleBar.style.width = `${clamp((1 - Math.max(0, building.cooldown) / 0.62) * 100, 0, 100)}%`;
    UI.cycleLabel.textContent = `${Math.round(powerEfficiency().efficiency * 100)}% power`;
  }
};

ensureProgressionState();
Object.values(state.buildings).forEach(normalizeBuilding);
updateBuildToolAvailability();
updateHUD(true);
renderTechTree();
/* UI and rendering for the power-system expansion. */

function installPowerExpansionUI() {
  const toolbar = document.getElementById("build-toolbar");
  const tools = [
    { type: "generator", key: "7", icon: "⚡", name: "Generator", cost: BUILDINGS.generator.cost },
    { type: "electricMiner", key: "8", icon: "⛏", name: "E-Miner", cost: BUILDINGS.electricMiner.cost },
    { type: "electricFurnace", key: "9", icon: "◉", name: "E-Furnace", cost: BUILDINGS.electricFurnace.cost }
  ];
  for (const tool of tools) {
    if (toolbar.querySelector(`[data-tool="${tool.type}"]`)) continue;
    const button = document.createElement("button");
    button.className = "build-tool";
    button.dataset.tool = tool.type;
    button.dataset.key = tool.key;
    button.innerHTML = `<span class="hotkey">${tool.key}</span><span class="tool-icon power-tool-icon">${tool.icon}</span><span class="tool-copy"><strong>${tool.name}</strong><small>₡ ${tool.cost}</small></span>`;
    toolbar.appendChild(button);
  }

  const powerSmall = UI.power?.parentElement?.querySelector("small");
  if (powerSmall) powerSmall.textContent = "grid load";

  const logisticsSection = [...document.querySelectorAll("#help-screen .codex-grid section")]
    .find(section => section.querySelector("h3")?.textContent === "Production");
  if (logisticsSection && !document.getElementById("power-help-copy")) {
    const paragraph = document.createElement("p");
    paragraph.id = "power-help-copy";
    paragraph.innerHTML = "<strong>Power:</strong> Research Power Engineering, feed coal into generators, then use Electric Miners and Electric Furnaces. Burner furnaces now keep separate coal and ore buffers.";
    logisticsSection.appendChild(paragraph);
  }

  if (!document.getElementById("power-expansion-styles")) {
    const style = document.createElement("style");
    style.id = "power-expansion-styles";
    style.textContent = `
      #build-toolbar{grid-template-columns:repeat(10,1fr)}
      .power-tool-icon{color:#75dff0;text-shadow:0 0 12px rgba(114,217,233,.38)}
      @media(max-width:1280px){#build-toolbar{grid-template-columns:repeat(10,minmax(58px,1fr))}.build-tool{padding:7px 4px}.tool-copy{display:none}}
    `;
    document.head.appendChild(style);
  }
}

installPowerExpansionUI();
updateBuildToolAvailability();
renderTechTree();

function drawPowerStructureBase(building, time, drawBody) {
  const screen = worldToScreen(building.x * TILE, building.y * TILE);
  const size = TILE * camera.zoom;
  const cx = screen.x + size / 2;
  const cy = screen.y + size / 2;
  const selected = selectedBuildingKey === keyFor(building.x, building.y);

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.34)";
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

  drawBody(screen.x, screen.y, size, cx, cy, time);

  if (building.type !== "generator") {
    const vector = dirVec(building.dir);
    drawArrow(cx + vector.x * size * 0.34, cy + vector.y * size * 0.34, building.dir, size * 0.075, "#72d9e9", 0.9);
  }
  if (building.output?.length) drawItem(building.output[0], cx, cy, size * 0.095);
  if (building.type === "electricFurnace" && building.progress > 0) {
    const width = size * 0.68;
    ctx.fillStyle = "rgba(0,0,0,.8)";
    ctx.fillRect(cx - width / 2, screen.y + size * 0.82, width, size * 0.055);
    ctx.fillStyle = "#72d9e9";
    ctx.fillRect(cx - width / 2, screen.y + size * 0.82, width * clamp(building.progress, 0, 1), size * 0.055);
  }
  ctx.restore();
}

function drawGenerator(building, x, y, size, cx, cy, time) {
  const online = building.fuelSeconds > 0;
  roundedRect(x + size * 0.07, y + size * 0.09, size * 0.86, size * 0.82, size * 0.08, "#293138", "#667b84", Math.max(1, size * 0.02));
  ctx.fillStyle = "#151b20";
  ctx.fillRect(x + size * 0.16, y + size * 0.19, size * 0.2, size * 0.48);
  ctx.fillStyle = online ? "#ef9b55" : "#60463a";
  ctx.fillRect(x + size * 0.2, y + size * 0.24, size * 0.12, size * 0.12);

  ctx.save();
  ctx.translate(cx + size * 0.13, cy);
  ctx.rotate(online ? time / 260 : 0);
  ctx.strokeStyle = online ? "#b9eef4" : "#718087";
  ctx.lineWidth = Math.max(2, size * 0.04);
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2);
  ctx.stroke();
  for (let index = 0; index < 6; index++) {
    const angle = index * Math.PI / 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * size * 0.17, Math.sin(angle) * size * 0.17);
    ctx.stroke();
  }
  ctx.restore();

  ctx.shadowColor = "#72d9e9";
  ctx.shadowBlur = online ? size * 0.18 : 0;
  ctx.fillStyle = online ? "#72d9e9" : "#33454c";
  ctx.fillRect(x + size * 0.72, y + size * 0.17, size * 0.08, size * 0.18);
  ctx.shadowBlur = 0;
}

function drawElectricMiner(building, x, y, size, cx, cy, time) {
  roundedRect(x + size * 0.07, y + size * 0.09, size * 0.86, size * 0.82, size * 0.09, "#26373d", "#5d9ba7", Math.max(1, size * 0.02));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(time / 480);
  ctx.strokeStyle = "#bdeaf0";
  ctx.lineWidth = Math.max(2, size * 0.045);
  for (let index = 0; index < 4; index++) {
    const angle = index * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * size * 0.06, Math.sin(angle) * size * 0.06);
    ctx.lineTo(Math.cos(angle) * size * 0.27, Math.sin(angle) * size * 0.27);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = "#72d9e9";
  ctx.fillRect(x + size * 0.13, y + size * 0.14, size * 0.22, size * 0.055);
}

function drawElectricFurnace(building, x, y, size, cx, cy, time) {
  roundedRect(x + size * 0.07, y + size * 0.07, size * 0.86, size * 0.86, size * 0.09, "#23343a", "#5795a1", Math.max(1, size * 0.02));
  const active = building.progress > 0;
  const pulse = active ? 0.68 + Math.sin(time / 100) * 0.2 : 0.18;
  ctx.shadowColor = "#72d9e9";
  ctx.shadowBlur = active ? size * 0.3 : 0;
  ctx.fillStyle = `rgba(114,217,233,${pulse})`;
  ctx.beginPath();
  ctx.arc(cx, cy, size * (active ? 0.17 : 0.1), 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#bcecf2";
  ctx.lineWidth = Math.max(2, size * 0.035);
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.25, time / 500, time / 500 + Math.PI * 1.4);
  ctx.stroke();
}

const BASE_DRAW_BUILDING_POWER = drawBuilding;
drawBuilding = function (building, time) {
  if (building.type === "generator") {
    return drawPowerStructureBase(building, time, (...args) => drawGenerator(building, ...args));
  }
  if (building.type === "electricMiner") {
    return drawPowerStructureBase(building, time, (...args) => drawElectricMiner(building, ...args));
  }
  if (building.type === "electricFurnace") {
    return drawPowerStructureBase(building, time, (...args) => drawElectricFurnace(building, ...args));
  }
  return BASE_DRAW_BUILDING_POWER(building, time);
};
