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
    const tools = [null, "belt", "miner", "furnace", "assembler", "chest", "splitter"].filter(type => type === null || isBuildingUnlocked(type));
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
