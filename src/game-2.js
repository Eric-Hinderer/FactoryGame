function getBeltPath(start, end) {
  const path = [];
  let x = start.x;
  let y = start.y;
  const horizontalFirst = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);

  const walkX = () => {
    while (x !== end.x) {
      path.push({ x, y, dir: end.x > x ? 1 : 3 });
      x += end.x > x ? 1 : -1;
    }
  };
  const walkY = () => {
    while (y !== end.y) {
      path.push({ x, y, dir: end.y > y ? 2 : 0 });
      y += end.y > y ? 1 : -1;
    }
  };

  if (horizontalFirst) {
    walkX();
    walkY();
  } else {
    walkY();
    walkX();
  }
  path.push({ x, y, dir: path.length ? path[path.length - 1].dir : buildDirection });
  return path;
}

function placeBeltPath(path) {
  let placed = 0;
  for (const tile of path) {
    if (!inBounds(tile.x, tile.y)) continue;
    const existing = state.buildings[keyFor(tile.x, tile.y)];
    if (existing?.type === "belt") {
      existing.dir = tile.dir;
      continue;
    }
    if (existing) continue;
    if (state.credits < BUILDINGS.belt.cost) break;
    if (placeBuilding("belt", tile.x, tile.y, tile.dir, true)) placed++;
  }
  if (placed > 0) {
    clickSound(690, 0.045);
    setStatus(`${placed} transport belt${placed === 1 ? "" : "s"} constructed.`);
  }
}

function selectBuilding(x, y) {
  const key = keyFor(x, y);
  const building = state.buildings[key];
  if (!building) {
    selectedBuildingKey = null;
    updateInspector();
    return;
  }
  selectedBuildingKey = key;
  updateInspector();
  clickSound(430, 0.018);
}

function rotateSelected() {
  const building = selectedBuildingKey && state.buildings[selectedBuildingKey];
  if (!building || building.type === "hub") return;
  building.dir = (building.dir + 1) % 4;
  setStatus(`${BUILDINGS[building.type].name} rotated ${DIRS[building.dir].name}.`);
  clickSound(620, 0.03);
}

function sellSelected() {
  const building = selectedBuildingKey && state.buildings[selectedBuildingKey];
  if (!building || building.type === "hub") return;
  const refund = Math.ceil(BUILDINGS[building.type].cost * 0.65);
  state.credits += refund;
  spawnDismantleParticles(building.x, building.y);
  delete state.buildings[selectedBuildingKey];
  selectedBuildingKey = null;
  updateInspector();
  toast(`Structure dismantled. Recovered ₡ ${refund}.`, "good");
  clickSound(230, 0.05);
}

function setRecipe(recipeKey) {
  const building = selectedBuildingKey && state.buildings[selectedBuildingKey];
  if (!building || building.type !== "assembler" || !RECIPES[recipeKey]) return;
  building.recipe = recipeKey;
  building.progress = 0;
  building.inv = {};
  building.output = [];
  updateInspector();
  setStatus(`Fabrication recipe changed to ${RECIPES[recipeKey].name}.`);
}

function nextTile(building, alternate = false) {
  const direction = building.type === "splitter" && alternate
    ? (building.dir + 1) % 4
    : building.dir;
  const vector = dirVec(direction);
  return { x: building.x + vector.x, y: building.y + vector.y };
}

function itemCount(building, item) {
  return building.inv?.[item] || 0;
}

function canReceive(building, item) {
  if (!building) return false;
  if (building.type === "hub") return true;
  if (building.type === "belt") return !building.item;
  if (building.type === "splitter") return building.buffer.length < 3;
  if (building.type === "chest") {
    return Object.values(building.inv).reduce((sum, count) => sum + count, 0) < 80;
  }
  if (building.type === "furnace") {
    const total = Object.values(building.inv).reduce((sum, count) => sum + count, 0);
    return total < 24 && (item === "coal" || item === "ironOre" || item === "copperOre");
  }
  if (building.type === "assembler") {
    const recipe = RECIPES[building.recipe];
    return Object.prototype.hasOwnProperty.call(recipe.inputs, item) && itemCount(building, item) < 18;
  }
  return false;
}

function recordDelivery(item) {
  state.delivered[item] = (state.delivered[item] || 0) + 1;
  state.totalDelivered += 1;
  state.credits += ITEMS[item].value;
  if (item === "science") state.science += 1;
  checkMissionProgress();
}

function receive(building, item) {
  if (building.type === "hub") {
    recordDelivery(item);
    return true;
  }
  if (building.type === "belt") {
    building.item = item;
    building.itemProgress = 0;
    return true;
  }
  if (building.type === "splitter") {
    building.buffer.push(item);
    return true;
  }
  building.inv[item] = (building.inv[item] || 0) + 1;
  return true;
}

function tryPush(building, item, onSuccess, alternate = false) {
  if (!item) return false;
  const tile = nextTile(building, alternate);
  if (!inBounds(tile.x, tile.y)) return false;
  const target = state.buildings[keyFor(tile.x, tile.y)];
  if (!canReceive(target, item)) return false;
  receive(target, item);
  onSuccess();
  return true;
}

function hasInputs(inventory, inputs) {
  return Object.entries(inputs).every(([item, count]) => (inventory[item] || 0) >= count);
}

function consumeInputs(inventory, inputs) {
  Object.entries(inputs).forEach(([item, count]) => {
    inventory[item] -= count;
  });
}

function outputQueue(building, item, count = 1) {
  for (let i = 0; i < count; i++) building.output.push(item);
}

function updateBuilding(building, dt, efficiency) {
  const speed = dt * efficiency;

  if (building.type === "belt") {
    if (!building.item) return;
    building.itemProgress += speed * 2.35;
    if (building.itemProgress >= 1) {
      const pushed = tryPush(building, building.item, () => {
        building.item = null;
        building.itemProgress = 0;
      });
      if (!pushed) building.itemProgress = 0.92;
    }
    return;
  }

  if (building.type === "miner") {
    const ore = terrain[building.y]?.[building.x]?.ore;
    if (!ore) return;
    if (!building.output.length) {
      building.cooldown -= speed;
      if (building.cooldown <= 0) {
        outputQueue(building, ore);
        building.cooldown = ore === "coal" ? 1.1 : 1.45;
        if (Math.random() < 0.18) spawnMachineParticle(building.x, building.y, ore === "coal" ? "#454c50" : ITEMS[ore].color);
      }
    }
    if (building.output.length) {
      tryPush(building, building.output[0], () => building.output.shift());
    }
    return;
  }

  if (building.type === "furnace") {
    if (building.output.length) {
      tryPush(building, building.output[0], () => building.output.shift());
    }
    if (building.output.length) return;

    if (building.fuel <= 0 && itemCount(building, "coal") > 0) {
      building.inv.coal -= 1;
      building.fuel += 4;
    }

    const ore = itemCount(building, "ironOre") > 0
      ? "ironOre"
      : itemCount(building, "copperOre") > 0
        ? "copperOre"
        : null;

    if (ore && building.fuel > 0) {
      building.activeOre ||= ore;
      if (itemCount(building, building.activeOre) <= 0) {
        building.activeOre = ore;
        building.progress = 0;
      }
      building.progress += speed / 2.45;
      if (Math.random() < 0.1) spawnMachineParticle(building.x, building.y, "#df864b");
      if (building.progress >= 1) {
        building.inv[building.activeOre] -= 1;
        building.fuel -= 1;
        outputQueue(building, building.activeOre === "ironOre" ? "ironPlate" : "copperPlate");
        building.progress = 0;
        building.activeOre = null;
      }
    } else {
      building.progress = 0;
      building.activeOre = null;
    }
    return;
  }

  if (building.type === "assembler") {
    if (building.output.length) {
      tryPush(building, building.output[0], () => building.output.shift());
    }
    if (building.output.length) return;

    const recipe = RECIPES[building.recipe];
    if (hasInputs(building.inv, recipe.inputs)) {
      building.progress += speed / recipe.time;
      if (building.progress >= 1) {
        consumeInputs(building.inv, recipe.inputs);
        outputQueue(building, recipe.output, recipe.outputCount);
        building.progress = 0;
        spawnMachineParticle(building.x, building.y, ITEMS[recipe.output].color);
      }
    } else {
      building.progress = 0;
    }
    return;
  }

  if (building.type === "chest") {
    building.cooldown -= speed;
    if (building.cooldown > 0) return;
    const nextItem = Object.keys(building.inv).find(item => building.inv[item] > 0);
    if (!nextItem) return;
    if (tryPush(building, nextItem, () => {
      building.inv[nextItem] -= 1;
      building.cooldown = 0.45;
    })) {
      if (building.inv[nextItem] <= 0) delete building.inv[nextItem];
    }
    return;
  }

  if (building.type === "splitter") {
    building.cooldown -= speed;
    if (!building.buffer.length || building.cooldown > 0) return;
    const item = building.buffer[0];
    const useAlternate = building.routeToggle % 2 === 1;
    let pushed = tryPush(building, item, () => {
      building.buffer.shift();
      building.routeToggle += 1;
      building.cooldown = 0.15;
    }, useAlternate);
    if (!pushed) {
      pushed = tryPush(building, item, () => {
        building.buffer.shift();
        building.routeToggle += 1;
        building.cooldown = 0.15;
      }, !useAlternate);
    }
    return;
  }
}

function powerEfficiency() {
  const used = Object.values(state.buildings).reduce((sum, building) => sum + BUILDINGS[building.type].power, 0);
  const capacity = 42 + state.missionIndex * 14;
  return {
    used,
    capacity,
    efficiency: used <= capacity ? 1 : clamp(capacity / used, 0.3, 1)
  };
}

function simulationTick(dt) {
  if (paused) return;

  state.played += dt;
  const power = powerEfficiency();
  const buildings = Object.values(state.buildings);
  if (Math.floor(state.played * 2) % 2) buildings.reverse();
  buildings.forEach(building => updateBuilding(building, dt, power.efficiency));

  saveTimer += dt;
  hudTimer += dt;
  minimapTimer += dt;

  if (saveTimer >= 6) {
    saveTimer = 0;
    saveGame();
  }
  if (hudTimer >= 0.15) {
    hudTimer = 0;
    updateHUD();
    updateInspector();
  }
  if (minimapTimer >= 0.28) {
    minimapTimer = 0;
    drawMinimap();
  }
}
