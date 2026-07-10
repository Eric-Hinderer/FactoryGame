function missionProgress() {
  const mission = MISSIONS[state.missionIndex];
  if (!mission) return 0;
  return Math.max(0, (state.delivered[mission.item] || 0) - (state.missionBaseline || 0));
}

function checkMissionProgress() {
  const mission = MISSIONS[state.missionIndex];
  if (!mission) return;
  const progress = missionProgress();
  if (progress < mission.target) return;

  state.credits += mission.reward;
  toast(`Operation complete: ${mission.title}. Reward ₡ ${mission.reward}.`, "good");
  setStatus(`Milestone secured. Colony authority has released additional grid capacity.`);
  clickSound(980, 0.18);

  state.missionIndex += 1;
  if (state.missionIndex >= MISSIONS.length) {
    state.won = true;
    paused = true;
    UI.victoryTime.textContent = formatTime(state.played);
    UI.victoryBuildings.textContent = Object.keys(state.buildings).length;
    UI.victoryItems.textContent = state.totalDelivered;
    showOverlay("victory-screen");
  } else {
    const nextMission = MISSIONS[state.missionIndex];
    state.missionBaseline = state.delivered[nextMission.item] || 0;
  }
  updateHUD(true);
}

function updateHUD(force = false) {
  const power = powerEfficiency();
  UI.credits.textContent = Math.floor(state.credits).toLocaleString();
  UI.power.textContent = `${Math.round(power.efficiency * 100)}%`;
  UI.power.style.color = power.efficiency < 0.75 ? "#e26767" : "";
  UI.science.textContent = state.science.toLocaleString();
  UI.buildingCount.textContent = Object.keys(state.buildings).length.toLocaleString();

  const mission = MISSIONS[state.missionIndex];
  if (mission) {
    const progress = missionProgress();
    UI.missionTitle.textContent = mission.title;
    UI.missionCopy.textContent = mission.copy;
    UI.missionLabel.textContent = mission.label;
    UI.missionCounter.textContent = `${Math.min(progress, mission.target)} / ${mission.target}`;
    UI.missionBar.style.width = `${clamp(progress / mission.target * 100, 0, 100)}%`;
    UI.missionReward.textContent = `Reward: ₡ ${mission.reward} · Grid +14`;
  } else {
    UI.missionTitle.textContent = "Primary program complete";
    UI.missionCopy.textContent = "The colony is self-sustaining. Continue expanding without operational restrictions.";
    UI.missionLabel.textContent = "Research program";
    UI.missionCounter.textContent = "Complete";
    UI.missionBar.style.width = "100%";
    UI.missionReward.textContent = "Free-build mode active";
  }

  if (force) drawMinimap();
}

function buildingStatus(building) {
  if (building.type === "hub") return "Command network online. Accepting all delivered materials.";
  if (building.type === "belt") return building.item ? `Transporting ${ITEMS[building.item].name}.` : "Belt clear. Awaiting cargo.";
  if (building.type === "miner") {
    const ore = terrain[building.y][building.x].ore;
    return ore ? `Extracting ${ITEMS[ore].name} from a high-density field.` : "No viable resource beneath this miner.";
  }
  if (building.type === "furnace") {
    if (building.fuel <= 0 && itemCount(building, "coal") <= 0) return "Fuel starved. Route coal into this furnace.";
    if (!building.activeOre && !itemCount(building, "ironOre") && !itemCount(building, "copperOre")) return "Awaiting iron or copper ore.";
    return "Thermal chamber active. Smelting cycle in progress.";
  }
  if (building.type === "assembler") {
    const recipe = RECIPES[building.recipe];
    return `Configured for ${recipe.name}. ${hasInputs(building.inv, recipe.inputs) ? "Fabricating." : "Awaiting components."}`;
  }
  if (building.type === "chest") return "Buffering and forwarding stored cargo.";
  if (building.type === "splitter") return "Alternating cargo between forward and right-side outputs.";
  return "Operational.";
}

function updateInspector() {
  const building = selectedBuildingKey && state.buildings[selectedBuildingKey];
  if (!building) {
    UI.inspector.classList.add("hidden");
    return;
  }

  UI.inspector.classList.remove("hidden");
  UI.inspectorName.textContent = BUILDINGS[building.type].name;
  UI.inspectorStatus.textContent = buildingStatus(building);

  const progress = clamp(building.progress || building.itemProgress || 0, 0, 1);
  UI.cycleBar.style.width = `${progress * 100}%`;
  UI.cycleLabel.textContent = progress > 0 ? `${Math.round(progress * 100)}%` : "Idle";

  UI.recipePicker.classList.toggle("hidden", building.type !== "assembler");
  if (building.type === "assembler") {
    UI.recipeButtons.innerHTML = Object.entries(RECIPES).map(([key, recipe]) => `
      <button class="recipe-button ${building.recipe === key ? "active" : ""}" data-recipe="${key}">
        ${recipe.name}
      </button>
    `).join("");
    UI.recipeButtons.querySelectorAll(".recipe-button").forEach(button => {
      button.addEventListener("click", () => setRecipe(button.dataset.recipe));
    });
  }

  const inventory = { ...building.inv };
  if (building.item) inventory[building.item] = (inventory[building.item] || 0) + 1;
  for (const item of building.output || []) inventory[item] = (inventory[item] || 0) + 1;
  for (const item of building.buffer || []) inventory[item] = (inventory[item] || 0) + 1;

  const entries = Object.entries(inventory).filter(([, count]) => count > 0);
  UI.inventoryGrid.innerHTML = entries.length
    ? entries.map(([item, count]) => `
        <div class="inventory-item">
          <strong style="color:${ITEMS[item].color}">${count}</strong>
          <small>${ITEMS[item].name}</small>
        </div>
      `).join("")
    : '<div class="inventory-empty">No cargo stored</div>';
}

function setStatus(message) {
  UI.statusText.textContent = message;
  clearTimeout(statusTimeout);
  statusTimeout = setTimeout(() => {
    UI.statusText.textContent = "Command Core online. Awaiting construction orders.";
  }, 6500);
}

function toast(message, type = "") {
  const element = document.createElement("div");
  element.className = `toast ${type}`;
  element.textContent = message;
  document.getElementById("toast-stack").appendChild(element);
  setTimeout(() => element.remove(), 2900);
}

function formatTime(seconds) {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function startAudio() {
  if (audio) {
    audio.resume?.();
    return;
  }
  try {
    audio = new (window.AudioContext || window.webkitAudioContext)();
    ambientGain = audio.createGain();
    ambientGain.gain.value = 0.012;
    ambientGain.connect(audio.destination);

    const oscillator = audio.createOscillator();
    oscillator.type = "sawtooth";
    oscillator.frequency.value = 44;
    const filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 130;
    oscillator.connect(filter);
    filter.connect(ambientGain);
    oscillator.start();
  } catch (error) {
    console.warn("Audio unavailable", error);
  }
}

function clickSound(frequency = 480, duration = 0.03) {
  if (!audio) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.025, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + duration);
}

function errorSound() {
  clickSound(125, 0.11);
}

function spawnPlacementParticles(x, y) {
  for (let i = 0; i < 18; i++) {
    particles.push({
      x: (x + 0.5) * TILE,
      y: (y + 0.5) * TILE,
      vx: (Math.random() - 0.5) * 95,
      vy: (Math.random() - 0.5) * 95,
      life: 0.55 + Math.random() * 0.35,
      maxLife: 0.9,
      size: 1.5 + Math.random() * 2.5,
      color: Math.random() > 0.5 ? "#72d9e9" : "#d7e3e8"
    });
  }
}

function spawnDismantleParticles(x, y) {
  for (let i = 0; i < 22; i++) {
    particles.push({
      x: (x + 0.5) * TILE,
      y: (y + 0.5) * TILE,
      vx: (Math.random() - 0.5) * 120,
      vy: (Math.random() - 0.5) * 120,
      life: 0.7 + Math.random() * 0.45,
      maxLife: 1.15,
      size: 2 + Math.random() * 3,
      color: "#e26767"
    });
  }
}

function spawnMachineParticle(x, y, color) {
  if (particles.length > 350) return;
  particles.push({
    x: (x + 0.5) * TILE + (Math.random() - 0.5) * 10,
    y: (y + 0.25) * TILE,
    vx: (Math.random() - 0.5) * 15,
    vy: -18 - Math.random() * 22,
    life: 0.65 + Math.random() * 0.55,
    maxLife: 1.2,
    size: 2 + Math.random() * 3,
    color
  });
}
