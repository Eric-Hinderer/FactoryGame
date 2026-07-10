/* Smart belt routing, two-lane cargo movement, and readable endpoint spacing. */

let ff10BeltTransferLaneHint = null;
let ff10BeltPathCache = { key: "", path: [] };

function ff10BeltLaneLimit(lane) {
  const capacity = beltCapacity();
  return lane === 0 ? Math.ceil(capacity / 2) : Math.floor(capacity / 2);
}

function ff10NormalizeBeltLanes(building) {
  if (building.type !== "belt") return building;
  building.beltItems = Array.isArray(building.beltItems) ? building.beltItems : [];
  building.beltItems = building.beltItems
    .filter(slot => slot && ITEMS[slot.item])
    .map(slot => ({
      item: slot.item,
      progress: clamp(Number(slot.progress) || 0, 0, 0.99),
      lane: slot.lane === 1 ? 1 : 0
    }))
    .sort((a, b) => b.progress - a.progress)
    .slice(0, beltCapacity());

  const laneCounts = [0, 0];
  for (const slot of building.beltItems) {
    if (laneCounts[slot.lane] >= ff10BeltLaneLimit(slot.lane)) {
      const other = 1 - slot.lane;
      if (laneCounts[other] < ff10BeltLaneLimit(other)) slot.lane = other;
    }
    laneCounts[slot.lane] += 1;
  }
  return building;
}

const FF10_BASE_NORMALIZE_BELTS = normalizeBuilding;
normalizeBuilding = function (building) {
  FF10_BASE_NORMALIZE_BELTS(building);
  return ff10NormalizeBeltLanes(building);
};

function ff10LaneSlots(building, lane) {
  return building.beltItems
    .filter(slot => slot.lane === lane)
    .sort((a, b) => b.progress - a.progress);
}

function ff10ChooseBeltLane(building, preferredLane = null) {
  normalizeBuilding(building);
  const order = preferredLane === 0 || preferredLane === 1
    ? [preferredLane, 1 - preferredLane]
    : [0, 1].sort((a, b) => ff10LaneSlots(building, a).length - ff10LaneSlots(building, b).length);

  for (const lane of order) {
    const slots = ff10LaneSlots(building, lane);
    if (slots.length >= ff10BeltLaneLimit(lane)) continue;
    const trailing = slots[slots.length - 1];
    if (!trailing || trailing.progress >= 0.34) return lane;
  }
  return null;
}

const FF10_BASE_CAN_RECEIVE_BELTS = canReceive;
canReceive = function (building, item) {
  if (building?.type === "belt") return ff10ChooseBeltLane(building, ff10BeltTransferLaneHint) !== null;
  return FF10_BASE_CAN_RECEIVE_BELTS(building, item);
};

const FF10_BASE_RECEIVE_BELTS = receive;
receive = function (building, item) {
  if (building.type === "belt") {
    const lane = ff10ChooseBeltLane(building, ff10BeltTransferLaneHint);
    if (lane === null) return false;
    building.beltItems.push({ item, progress: 0, lane });
    return true;
  }
  return FF10_BASE_RECEIVE_BELTS(building, item);
};

function ff10BeltTileBlocked(x, y, start, end) {
  if (!inBounds(x, y)) return true;
  if ((x === start.x && y === start.y) || (x === end.x && y === end.y)) return false;
  return Boolean(state.buildings[keyFor(x, y)]);
}

function ff10ReconstructBeltPath(records, endKey) {
  const positions = [];
  let cursor = endKey;
  while (cursor) {
    const record = records.get(cursor);
    if (!record) break;
    positions.push({ x: record.x, y: record.y });
    cursor = record.parent;
  }
  positions.reverse();
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
}

function ff10FindSmartBeltPath(start, end) {
  if (!inBounds(start.x, start.y) || !inBounds(end.x, end.y)) return [];
  const topology = Object.keys(state.buildings).length;
  const cacheKey = `${start.x},${start.y}:${end.x},${end.y}:${topology}`;
  if (ff10BeltPathCache.key === cacheKey) return ff10BeltPathCache.path.map(tile => ({ ...tile }));

  const open = [];
  const best = new Map();
  const records = new Map();
  const startKey = `${start.x},${start.y},-1`;
  open.push({ x: start.x, y: start.y, dir: -1, g: 0, f: Math.abs(end.x - start.x) + Math.abs(end.y - start.y), key: startKey });
  best.set(startKey, 0);
  records.set(startKey, { x: start.x, y: start.y, parent: null });

  let foundKey = null;
  let expansions = 0;
  while (open.length && expansions < 12000) {
    let bestIndex = 0;
    for (let index = 1; index < open.length; index++) if (open[index].f < open[bestIndex].f) bestIndex = index;
    const current = open.splice(bestIndex, 1)[0];
    expansions += 1;

    if (current.x === end.x && current.y === end.y) {
      foundKey = current.key;
      break;
    }

    for (let direction = 0; direction < 4; direction++) {
      const vector = dirVec(direction);
      const nx = current.x + vector.x;
      const ny = current.y + vector.y;
      if (ff10BeltTileBlocked(nx, ny, start, end)) continue;

      const turnCost = current.dir === -1 || current.dir === direction ? 0 : 0.38;
      const edgePenalty = nx < 2 || ny < 2 || nx >= WORLD_W - 2 || ny >= WORLD_H - 2 ? 0.2 : 0;
      const g = current.g + 1 + turnCost + edgePenalty;
      const nextKey = `${nx},${ny},${direction}`;
      if (g >= (best.get(nextKey) ?? Infinity)) continue;

      best.set(nextKey, g);
      const heuristic = Math.abs(end.x - nx) + Math.abs(end.y - ny);
      const next = { x: nx, y: ny, dir: direction, g, f: g + heuristic, key: nextKey };
      open.push(next);
      records.set(nextKey, { x: nx, y: ny, parent: current.key });
    }
  }

  const path = foundKey ? ff10ReconstructBeltPath(records, foundKey) : [];
  ff10BeltPathCache = { key: cacheKey, path };
  return path.map(tile => ({ ...tile }));
}

getBeltPath = function (start, end) {
  return ff10FindSmartBeltPath(start, end);
};

placeBeltPath = function (path) {
  if (!path.length) {
    toast("No clear belt route found. Move the endpoint or clear an obstruction.", "bad");
    errorSound();
    return;
  }

  let placed = 0;
  let reused = 0;
  path.forEach((tile, index) => {
    if (!inBounds(tile.x, tile.y)) return;
    const existing = state.buildings[keyFor(tile.x, tile.y)];

    if (existing) {
      if (existing.type === "belt") {
        normalizeBuilding(existing);
        if (index === 0 && existing.beltItems.length === 0) existing.dir = tile.dir;
        reused += 1;
      }
      return;
    }

    if (state.credits < BUILDINGS.belt.cost) return;
    if (placeBuilding("belt", tile.x, tile.y, tile.dir, true)) {
      const belt = state.buildings[keyFor(tile.x, tile.y)];
      belt.entryDir = tile.entryDir;
      ff10NormalizeBeltLanes(belt);
      placed += 1;
    }
  });

  ff10BeltPathCache.key = "";
  if (placed || reused) {
    clickSound(690, 0.045);
    setStatus(`${placed} belt${placed === 1 ? "" : "s"} built${reused ? `; ${reused} existing segment${reused === 1 ? "" : "s"} safely merged` : ""}.`);
  }
};

const FF10_BASE_UPDATE_BUILDING_BELTS = updateBuilding;
updateBuilding = function (building, dt, efficiency) {
  if (building.type !== "belt") return FF10_BASE_UPDATE_BUILDING_BELTS(building, dt, efficiency);

  normalizeBuilding(building);
  if (!building.beltItems.length) return;

  const movement = dt * efficiency * 2.15 * beltSpeedMultiplier();
  const spacing = 0.36;

  for (let lane = 0; lane < 2; lane++) {
    const slots = ff10LaneSlots(building, lane);
    for (let index = 0; index < slots.length; index++) {
      const maximum = index === 0 ? 1.04 : Math.max(0, slots[index - 1].progress - spacing);
      slots[index].progress = Math.min(slots[index].progress + movement, maximum);
    }
  }

  let transfers = 0;
  for (let lane = 0; lane < 2 && transfers < 2; lane++) {
    const leading = ff10LaneSlots(building, lane)[0];
    if (!leading || leading.progress < 1) continue;
    ff10BeltTransferLaneHint = lane;
    const pushed = tryPush(building, leading.item, () => {
      const index = building.beltItems.indexOf(leading);
      if (index >= 0) building.beltItems.splice(index, 1);
    });
    ff10BeltTransferLaneHint = null;
    if (!pushed) leading.progress = 0.92;
    else transfers += 1;
  }
};

function ff10PointOnBeltLane(geometry, progress, lane, size) {
  const visibleProgress = 0.11 + clamp(progress, 0, 1) * 0.78;
  const point = pointOnBeltCurve(geometry, visibleProgress);
  const tangent = tangentOnBeltCurve(geometry, visibleProgress);
  const length = Math.hypot(tangent.x, tangent.y) || 1;
  const normal = { x: -tangent.y / length, y: tangent.x / length };
  const offset = (lane === 0 ? -1 : 1) * size * 0.13;
  return { x: point.x + normal.x * offset, y: point.y + normal.y * offset };
}

drawBelt = function (building, x, y, size, time) {
  normalizeBuilding(building);
  const geometry = beltCurveGeometry(building, x, y, size);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  traceBeltCurve(geometry);
  ctx.strokeStyle = "#0b1014";
  ctx.lineWidth = size * 0.82;
  ctx.stroke();

  traceBeltCurve(geometry);
  ctx.strokeStyle = "#2c3942";
  ctx.lineWidth = size * 0.64;
  ctx.stroke();

  for (const lane of [0, 1]) {
    ctx.strokeStyle = lane === 0 ? "rgba(118,157,169,.48)" : "rgba(101,139,151,.4)";
    ctx.lineWidth = Math.max(1, size * 0.035);
    ctx.beginPath();
    for (let step = 0; step <= 16; step++) {
      const t = step / 16;
      const point = ff10PointOnBeltLane(geometry, (t - 0.11) / 0.78, lane, size);
      if (step === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  }

  const scroll = (time / 700) % 1;
  for (let index = 0; index < 5; index++) {
    const t = (index / 5 + scroll / 5) % 1;
    const center = pointOnBeltCurve(geometry, 0.08 + t * 0.84);
    const tangent = tangentOnBeltCurve(geometry, t);
    const length = Math.hypot(tangent.x, tangent.y) || 1;
    const px = -tangent.y / length;
    const py = tangent.x / length;
    ctx.strokeStyle = "rgba(184,203,211,.42)";
    ctx.lineWidth = Math.max(1, size * 0.02);
    ctx.beginPath();
    ctx.moveTo(center.x + px * size * 0.25, center.y + py * size * 0.25);
    ctx.lineTo(center.x - px * size * 0.25, center.y - py * size * 0.25);
    ctx.stroke();
  }

  const arrowPoint = pointOnBeltCurve(geometry, 0.58);
  drawArrow(arrowPoint.x, arrowPoint.y, building.dir, size * 0.065, "#9bd7e0", 0.72);

  for (const slot of building.beltItems) {
    const point = ff10PointOnBeltLane(geometry, slot.progress, slot.lane, size);
    drawItem(slot.item, point.x, point.y, size * 0.073);
  }
  ctx.restore();
};

const FF10_BASE_BUILDING_STATUS_BELTS = buildingStatus;
buildingStatus = function (building) {
  if (building.type === "belt") {
    normalizeBuilding(building);
    const laneA = ff10LaneSlots(building, 0).length;
    const laneB = ff10LaneSlots(building, 1).length;
    const route = building.entryDir !== building.dir ? " Curved segment." : " Straight segment.";
    return `Dual-lane belt: ${laneA} left, ${laneB} right, ${building.beltItems.length} / ${beltCapacity()} total.${route}`;
  }
  return FF10_BASE_BUILDING_STATUS_BELTS(building);
};

Object.values(state.buildings).forEach(normalizeBuilding);
