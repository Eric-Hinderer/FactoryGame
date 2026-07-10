function directionBetween(from, to, fallback = buildDirection) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx > 0) return 1;
  if (dx < 0) return 3;
  if (dy > 0) return 2;
  if (dy < 0) return 0;
  return fallback;
}

getBeltPath = function (start, end) {
  const positions = [{ x: start.x, y: start.y }];
  let x = start.x;
  let y = start.y;
  const horizontalFirst = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);

  const walkX = () => {
    while (x !== end.x) {
      x += end.x > x ? 1 : -1;
      positions.push({ x, y });
    }
  };
  const walkY = () => {
    while (y !== end.y) {
      y += end.y > y ? 1 : -1;
      positions.push({ x, y });
    }
  };

  if (horizontalFirst) {
    walkX();
    walkY();
  } else {
    walkY();
    walkX();
  }

  return positions.map((position, index) => {
    const outgoing = index < positions.length - 1
      ? directionBetween(position, positions[index + 1])
      : index > 0
        ? directionBetween(positions[index - 1], position)
        : buildDirection;
    const incoming = index > 0
      ? directionBetween(positions[index - 1], position)
      : outgoing;
    return { ...position, dir: outgoing, entryDir: incoming };
  });
};

placeBeltPath = function (path) {
  let placed = 0;
  for (const tile of path) {
    if (!inBounds(tile.x, tile.y)) continue;
    const existing = state.buildings[keyFor(tile.x, tile.y)];
    if (existing?.type === "belt") {
      existing.dir = tile.dir;
      existing.entryDir = tile.entryDir;
      normalizeBuilding(existing);
      continue;
    }
    if (existing) continue;
    if (state.credits < BUILDINGS.belt.cost) break;
    if (placeBuilding("belt", tile.x, tile.y, tile.dir, true)) {
      const belt = state.buildings[keyFor(tile.x, tile.y)];
      belt.entryDir = tile.entryDir;
      placed += 1;
    }
  }
  if (placed > 0) {
    clickSound(690, 0.045);
    setStatus(`${placed} routed transport belt${placed === 1 ? "" : "s"} constructed.`);
  }
};

const BASE_CAN_RECEIVE = canReceive;
canReceive = function (building, item) {
  if (!building) return false;
  if (building.type === "belt") {
    normalizeBuilding(building);
    if (building.beltItems.length >= beltCapacity()) return false;
    const trailing = building.beltItems[building.beltItems.length - 1];
    return !trailing || trailing.progress >= 0.23;
  }
  return BASE_CAN_RECEIVE(building, item);
};

const BASE_RECEIVE = receive;
receive = function (building, item) {
  if (building.type === "belt") {
    normalizeBuilding(building);
    building.beltItems.push({ item, progress: 0 });
    building.beltItems.sort((a, b) => b.progress - a.progress);
    return true;
  }
  return BASE_RECEIVE(building, item);
};

const BASE_UPDATE_BUILDING = updateBuilding;
updateBuilding = function (building, dt, efficiency) {
  if (building.type !== "belt") {
    if (building.type === "furnace" && hasTech("efficientSmelting")) {
      return BASE_UPDATE_BUILDING(building, dt * 1.25, efficiency);
    }
    return BASE_UPDATE_BUILDING(building, dt, efficiency);
  }

  normalizeBuilding(building);
  const items = building.beltItems;
  if (!items.length) return;

  items.sort((a, b) => b.progress - a.progress);
  const movement = dt * efficiency * 2.15 * beltSpeedMultiplier();
  const spacing = 0.23;

  for (let index = 0; index < items.length; index++) {
    const maximum = index === 0 ? 1.04 : Math.max(0, items[index - 1].progress - spacing);
    items[index].progress = Math.min(items[index].progress + movement, maximum);
  }

  let transfers = 0;
  while (items.length && items[0].progress >= 1 && transfers < 2) {
    const leading = items[0];
    const pushed = tryPush(building, leading.item, () => items.shift());
    if (!pushed) {
      leading.progress = 0.985;
      break;
    }
    transfers += 1;
  }
};
