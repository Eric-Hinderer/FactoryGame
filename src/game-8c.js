recordDelivery = function (item) {
  state.delivered[item] = (state.delivered[item] || 0) + 1;
  state.totalDelivered += 1;
  state.credits += ITEMS[item].value;
  if (item === "science") {
    state.science += 1;
    state.researchPoints += 1;
    if (state.science <= 3 || state.science % 5 === 0) toast("Research pack analyzed: +1 research point.", "good");
  }
  checkMissionProgress();
};

checkMissionProgress = function () {
  const mission = MISSIONS[state.missionIndex];
  if (!mission) return;
  const progress = missionProgress();
  if (progress < mission.target) return;

  state.credits += mission.reward;
  state.researchPoints += 2;
  toast(`Operation complete: ${mission.title}. Reward ₡ ${mission.reward} and 2 research points.`, "good");
  setStatus("Milestone secured. Research allocation and grid authority increased.");
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
  renderTechTree();
};

powerEfficiency = function () {
  const used = Object.values(state.buildings).reduce((sum, building) => sum + BUILDINGS[building.type].power, 0);
  const capacity = 42 + state.missionIndex * 14 + (hasTech("gridExpansion") ? 30 : 0);
  return {
    used,
    capacity,
    efficiency: used <= capacity ? 1 : clamp(capacity / used, 0.3, 1)
  };
};

const BASE_UPDATE_HUD = updateHUD;
updateHUD = function (force = false) {
  ensureProgressionState();
  BASE_UPDATE_HUD(force);
  UI.science.textContent = Math.floor(state.researchPoints).toLocaleString();
  const points = document.getElementById("tech-points");
  if (points) points.textContent = Math.floor(state.researchPoints).toLocaleString();
  updateBuildToolAvailability();
};

const BASE_BUILDING_STATUS = buildingStatus;
buildingStatus = function (building) {
  if (building.type === "belt") {
    normalizeBuilding(building);
    const count = building.beltItems.length;
    const turn = building.entryDir !== building.dir ? " Corner routing active." : "";
    return count
      ? `Transporting ${count} of ${beltCapacity()} cargo slots.${turn}`
      : `Belt clear. Capacity ${beltCapacity()} items.${turn}`;
  }
  return BASE_BUILDING_STATUS(building);
};

const BASE_UPDATE_INSPECTOR = updateInspector;
updateInspector = function () {
  BASE_UPDATE_INSPECTOR();
  const building = selectedBuildingKey && state.buildings[selectedBuildingKey];
  if (!building) return;

  if (building.type === "assembler") {
    UI.recipeButtons.querySelectorAll(".recipe-button").forEach(button => {
      const unlocked = isRecipeUnlocked(button.dataset.recipe);
      button.disabled = !unlocked;
      if (!unlocked && !button.textContent.includes("Locked")) button.textContent += " · Locked";
    });
  }

  if (building.type === "belt") {
    normalizeBuilding(building);
    UI.inspectorStatus.textContent = buildingStatus(building);
    const lead = building.beltItems[0];
    UI.cycleBar.style.width = `${(lead?.progress || 0) * 100}%`;
    UI.cycleLabel.textContent = `${building.beltItems.length} / ${beltCapacity()}`;
    const counts = {};
    for (const slot of building.beltItems) counts[slot.item] = (counts[slot.item] || 0) + 1;
    const entries = Object.entries(counts);
    UI.inventoryGrid.innerHTML = entries.length
      ? entries.map(([item, count]) => `
          <div class="inventory-item">
            <strong style="color:${ITEMS[item].color}">${count}</strong>
            <small>${ITEMS[item].name}</small>
          </div>
        `).join("")
      : '<div class="inventory-empty">No cargo on belt</div>';
  }
};

function beltCurveGeometry(building, x, y, size) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const incoming = dirVec(Number.isInteger(building.entryDir) ? building.entryDir : building.dir);
  const outgoing = dirVec(building.dir);
  return {
    cx,
    cy,
    incoming,
    outgoing,
    start: { x: cx - incoming.x * size * 0.46, y: cy - incoming.y * size * 0.46 },
    end: { x: cx + outgoing.x * size * 0.46, y: cy + outgoing.y * size * 0.46 },
    curved: building.entryDir !== building.dir
  };
}

function traceBeltCurve(geometry) {
  ctx.beginPath();
  ctx.moveTo(geometry.start.x, geometry.start.y);
  if (geometry.curved) ctx.quadraticCurveTo(geometry.cx, geometry.cy, geometry.end.x, geometry.end.y);
  else ctx.lineTo(geometry.end.x, geometry.end.y);
}

function pointOnBeltCurve(geometry, t) {
  if (!geometry.curved) {
    return {
      x: geometry.start.x + (geometry.end.x - geometry.start.x) * t,
      y: geometry.start.y + (geometry.end.y - geometry.start.y) * t
    };
  }
  const one = 1 - t;
  return {
    x: one * one * geometry.start.x + 2 * one * t * geometry.cx + t * t * geometry.end.x,
    y: one * one * geometry.start.y + 2 * one * t * geometry.cy + t * t * geometry.end.y
  };
}

function tangentOnBeltCurve(geometry, t) {
  if (!geometry.curved) return { x: geometry.end.x - geometry.start.x, y: geometry.end.y - geometry.start.y };
  return {
    x: 2 * (1 - t) * (geometry.cx - geometry.start.x) + 2 * t * (geometry.end.x - geometry.cx),
    y: 2 * (1 - t) * (geometry.cy - geometry.start.y) + 2 * t * (geometry.end.y - geometry.cy)
  };
}

drawBelt = function (building, x, y, size, time) {
  normalizeBuilding(building);
  const geometry = beltCurveGeometry(building, x, y, size);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  traceBeltCurve(geometry);
  ctx.strokeStyle = "#11171c";
  ctx.lineWidth = size * 0.78;
  ctx.stroke();

  traceBeltCurve(geometry);
  ctx.strokeStyle = "#303d46";
  ctx.lineWidth = size * 0.61;
  ctx.stroke();

  traceBeltCurve(geometry);
  ctx.strokeStyle = "rgba(112,139,151,.35)";
  ctx.lineWidth = size * 0.44;
  ctx.stroke();

  const scroll = (time / 680) % 1;
  for (let index = 0; index < 5; index++) {
    const t = (index / 5 + scroll / 5) % 1;
    const point = pointOnBeltCurve(geometry, t);
    const tangent = tangentOnBeltCurve(geometry, t);
    const length = Math.hypot(tangent.x, tangent.y) || 1;
    const px = -tangent.y / length;
    const py = tangent.x / length;
    ctx.strokeStyle = "rgba(172,194,203,.48)";
    ctx.lineWidth = Math.max(1, size * 0.022);
    ctx.beginPath();
    ctx.moveTo(point.x + px * size * 0.18, point.y + py * size * 0.18);
    ctx.lineTo(point.x - px * size * 0.18, point.y - py * size * 0.18);
    ctx.stroke();
  }

  const arrowPoint = pointOnBeltCurve(geometry, 0.58);
  drawArrow(arrowPoint.x, arrowPoint.y, building.dir, size * 0.07, "#8fcbd5", 0.65);

  for (const slot of building.beltItems) {
    const point = pointOnBeltCurve(geometry, clamp(slot.progress, 0, 1));
    drawItem(slot.item, point.x, point.y, size * 0.085);
  }
  ctx.restore();
};

const BASE_DRAW_PLACEMENT_PREVIEW = drawPlacementPreview;
drawPlacementPreview = function () {
  if (!selectedTool) return;
  BASE_DRAW_PLACEMENT_PREVIEW();
};
