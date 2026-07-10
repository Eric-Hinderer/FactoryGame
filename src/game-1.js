"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });
const minimap = document.getElementById("minimap");
const mctx = minimap.getContext("2d");

const UI = {
  credits: document.getElementById("credits"),
  power: document.getElementById("power"),
  science: document.getElementById("science"),
  buildingCount: document.getElementById("building-count"),
  missionTitle: document.getElementById("mission-title"),
  missionCopy: document.getElementById("mission-copy"),
  missionLabel: document.getElementById("mission-label"),
  missionCounter: document.getElementById("mission-counter"),
  missionBar: document.getElementById("mission-bar"),
  missionReward: document.getElementById("mission-reward"),
  inspector: document.getElementById("inspector"),
  inspectorName: document.getElementById("inspector-name"),
  inspectorStatus: document.getElementById("inspector-status"),
  cycleLabel: document.getElementById("cycle-label"),
  cycleBar: document.getElementById("cycle-bar"),
  recipePicker: document.getElementById("recipe-picker"),
  recipeButtons: document.getElementById("recipe-buttons"),
  inventoryGrid: document.getElementById("inventory-grid"),
  buildModeText: document.getElementById("build-mode-text"),
  cursorTooltip: document.getElementById("cursor-tooltip"),
  statusText: document.getElementById("status-text"),
  pauseButton: document.getElementById("pause-button"),
  continueGame: document.getElementById("continue-game"),
  victoryTime: document.getElementById("victory-time"),
  victoryBuildings: document.getElementById("victory-buildings"),
  victoryItems: document.getElementById("victory-items")
};

const TILE = 54;
const WORLD_W = 88;
const WORLD_H = 60;
const SAVE_KEY = "foundryFrontierSaveV2";
const DIRS = [
  { x: 0, y: -1, angle: -Math.PI / 2, name: "North" },
  { x: 1, y: 0, angle: 0, name: "East" },
  { x: 0, y: 1, angle: Math.PI / 2, name: "South" },
  { x: -1, y: 0, angle: Math.PI, name: "West" }
];

const ITEMS = {
  ironOre: { name: "Iron Ore", short: "Fe", color: "#7f96a7", value: 2 },
  copperOre: { name: "Copper Ore", short: "Cu", color: "#c2764f", value: 2 },
  coal: { name: "Coal", short: "C", color: "#3f4549", value: 2 },
  ironPlate: { name: "Iron Plate", short: "IP", color: "#bcc9d1", value: 7 },
  copperPlate: { name: "Copper Plate", short: "CP", color: "#df946a", value: 7 },
  gear: { name: "Gear Assembly", short: "G", color: "#d2d9de", value: 16 },
  wire: { name: "Copper Wire", short: "W", color: "#efb17c", value: 10 },
  circuit: { name: "Control Circuit", short: "CC", color: "#7ad198", value: 28 },
  science: { name: "Research Pack", short: "RP", color: "#64d8f0", value: 55 }
};

const BUILDINGS = {
  belt: { name: "Transport Belt", cost: 2, power: 0, key: "1" },
  miner: { name: "Autonomous Miner", cost: 24, power: 3, key: "2" },
  furnace: { name: "Arc Furnace", cost: 40, power: 4, key: "3" },
  assembler: { name: "Fabrication Unit", cost: 80, power: 7, key: "4" },
  chest: { name: "Logistics Depot", cost: 18, power: 0, key: "5" },
  splitter: { name: "Routing Junction", cost: 32, power: 1, key: "6" },
  hub: { name: "Command Core", cost: 0, power: 0 }
};

const RECIPES = {
  gear: {
    name: "Gear Assembly",
    inputs: { ironPlate: 2 },
    output: "gear",
    outputCount: 1,
    time: 2.2
  },
  wire: {
    name: "Copper Wire",
    inputs: { copperPlate: 1 },
    output: "wire",
    outputCount: 2,
    time: 1.35
  },
  circuit: {
    name: "Control Circuit",
    inputs: { ironPlate: 1, wire: 3 },
    output: "circuit",
    outputCount: 1,
    time: 2.9
  },
  science: {
    name: "Research Pack",
    inputs: { gear: 1, circuit: 1 },
    output: "science",
    outputCount: 1,
    time: 4.2
  }
};

const MISSIONS = [
  {
    title: "Bootstrap the colony",
    copy: "Establish automated iron production and deliver plates to the Command Core.",
    item: "ironPlate",
    target: 20,
    label: "Iron plates delivered",
    reward: 150
  },
  {
    title: "Copper infrastructure",
    copy: "Bring copper processing online to support electronic manufacturing.",
    item: "copperPlate",
    target: 20,
    label: "Copper plates delivered",
    reward: 180
  },
  {
    title: "Machine components",
    copy: "Fabricate precision gears and deliver them to colony logistics.",
    item: "gear",
    target: 15,
    label: "Gear assemblies delivered",
    reward: 240
  },
  {
    title: "Control systems",
    copy: "Produce control circuits for the dormant research complex.",
    item: "circuit",
    target: 12,
    label: "Control circuits delivered",
    reward: 320
  },
  {
    title: "Frontier research",
    copy: "Complete the colony's primary research program with advanced research packs.",
    item: "science",
    target: 10,
    label: "Research packs delivered",
    reward: 500
  }
];

let terrain = [];
let state = null;
let camera = { x: WORLD_W * TILE / 2, y: WORLD_H * TILE / 2, zoom: 0.83 };
let viewport = { width: innerWidth, height: innerHeight, dpr: 1 };
let selectedTool = "belt";
let buildDirection = 1;
let selectedBuildingKey = null;
let hoverTile = null;
let paused = true;
let lastFrame = performance.now();
let saveTimer = 0;
let hudTimer = 0;
let minimapTimer = 0;
let edgeScroll = { x: 0, y: 0 };
let keys = new Set();
let mouse = { x: 0, y: 0, down: false, button: -1 };
let drag = null;
let beltDrag = null;
let particles = [];
let stars = [];
let audio = null;
let ambientGain = null;
let statusTimeout = null;
let hasSave = false;

const keyFor = (x, y) => `${x},${y}`;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const inBounds = (x, y) => x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H;
const dirVec = direction => DIRS[(direction % 4 + 4) % 4];

function hash(x, y, seed = 0) {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

function noise01(x, y, seed = 0) {
  return (hash(x, y, seed) % 10000) / 10000;
}

function makeTerrain() {
  terrain = Array.from({ length: WORLD_H }, (_, y) =>
    Array.from({ length: WORLD_W }, (_, x) => ({
      ground: noise01(x, y, 4),
      ore: null,
      richness: 0,
      debris: noise01(x, y, 9) > 0.93
    }))
  );

  const patches = [
    { x: 16, y: 15, r: 6.2, type: "ironOre", seed: 2 },
    { x: 72, y: 14, r: 6.4, type: "copperOre", seed: 3 },
    { x: 18, y: 47, r: 6.0, type: "coal", seed: 5 },
    { x: 69, y: 45, r: 6.8, type: "ironOre", seed: 7 },
    { x: 43, y: 10, r: 5.4, type: "coal", seed: 11 },
    { x: 46, y: 50, r: 5.6, type: "copperOre", seed: 13 }
  ];

  for (const patch of patches) {
    for (let y = 0; y < WORLD_H; y++) {
      for (let x = 0; x < WORLD_W; x++) {
        const wobble = (noise01(x * 3, y * 3, patch.seed) - 0.5) * 2.2;
        const distance = Math.hypot(x - patch.x, y - patch.y);
        if (distance < patch.r + wobble) {
          terrain[y][x].ore = patch.type;
          terrain[y][x].richness = Math.max(70, Math.round((patch.r - distance + 2) * 90));
        }
      }
    }
  }
}

function freshState() {
  const hubX = Math.floor(WORLD_W / 2);
  const hubY = Math.floor(WORLD_H / 2);
  return {
    version: 2,
    credits: 340,
    science: 0,
    played: 0,
    delivered: {},
    totalDelivered: 0,
    missionIndex: 0,
    missionBaseline: 0,
    won: false,
    buildings: {
      [keyFor(hubX, hubY)]: {
        type: "hub",
        x: hubX,
        y: hubY,
        dir: 0,
        inv: {},
        progress: 0,
        output: []
      }
    }
  };
}

function normalizeBuilding(building) {
  building.inv ||= {};
  building.progress ||= 0;
  building.output ||= [];
  building.cooldown ||= 0;
  building.buffer ||= [];
  building.routeToggle ||= 0;
  building.item ||= null;
  building.itemProgress ||= 0;
  if (building.type === "assembler") building.recipe ||= "gear";
  if (building.type === "furnace") building.fuel ||= 0;
  return building;
}

function loadGame() {
  makeTerrain();
  hasSave = false;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      state = JSON.parse(raw);
      hasSave = Boolean(state?.buildings);
    }
  } catch (error) {
    console.warn("Save load failed", error);
  }

  if (!hasSave) state = freshState();
  Object.values(state.buildings).forEach(normalizeBuilding);
  UI.continueGame.disabled = !hasSave;
  UI.continueGame.textContent = hasSave ? "Continue Operation" : "No Saved Operation";
  updateHUD(true);
}

function saveGame(showMessage = false) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    hasSave = true;
    UI.continueGame.disabled = false;
    UI.continueGame.textContent = "Continue Operation";
    if (showMessage) toast("Operation saved.", "good");
  } catch (error) {
    toast("Unable to save operation.", "bad");
    console.error(error);
  }
}

function newGame() {
  state = freshState();
  selectedBuildingKey = null;
  selectedTool = "belt";
  buildDirection = 1;
  camera = { x: WORLD_W * TILE / 2, y: WORLD_H * TILE / 2, zoom: 0.83 };
  saveGame();
  updateHUD(true);
  updateInspector();
  setBuildTool("belt");
  hideOverlay("start-screen");
  paused = false;
  setStatus("New sector initialized. Resource scans complete.");
  toast("Sector A-17 online.", "good");
  startAudio();
}

function resize() {
  viewport.width = innerWidth;
  viewport.height = innerHeight;
  viewport.dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(viewport.width * viewport.dpr);
  canvas.height = Math.round(viewport.height * viewport.dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
}

function worldToScreen(wx, wy) {
  return {
    x: (wx - camera.x) * camera.zoom + viewport.width / 2,
    y: (wy - camera.y) * camera.zoom + viewport.height / 2
  };
}

function screenToWorld(sx, sy) {
  return {
    x: (sx - viewport.width / 2) / camera.zoom + camera.x,
    y: (sy - viewport.height / 2) / camera.zoom + camera.y
  };
}

function screenToTile(sx, sy) {
  const point = screenToWorld(sx, sy);
  return {
    x: Math.floor(point.x / TILE),
    y: Math.floor(point.y / TILE)
  };
}

function centerOnTile(x, y) {
  camera.x = (x + 0.5) * TILE;
  camera.y = (y + 0.5) * TILE;
}

function setBuildTool(type) {
  if (!BUILDINGS[type]) return;
  selectedTool = type;
  selectedBuildingKey = null;
  document.querySelectorAll(".build-tool").forEach(button => {
    button.classList.toggle("active", button.dataset.tool === type);
  });
  UI.buildModeText.textContent = BUILDINGS[type].name;
  updateInspector();
  clickSound(560, 0.025);
}

function rotateBuild(delta = 1) {
  buildDirection = (buildDirection + delta + 4) % 4;
  setStatus(`Placement orientation: ${DIRS[buildDirection].name}.`);
  clickSound(650, 0.025);
}

function canPlace(type, x, y) {
  if (!inBounds(x, y)) return false;
  if (state.buildings[keyFor(x, y)]) return false;
  if (type === "miner" && !terrain[y][x].ore) return false;
  return state.credits >= BUILDINGS[type].cost;
}

function makeBuilding(type, x, y, direction = buildDirection) {
  const building = normalizeBuilding({
    type,
    x,
    y,
    dir: direction,
    inv: {},
    progress: 0,
    output: [],
    buffer: [],
    cooldown: 0,
    item: null,
    itemProgress: 0
  });
  if (type === "assembler") building.recipe = "gear";
  return building;
}

function placeBuilding(type, x, y, direction = buildDirection, quiet = false) {
  if (!inBounds(x, y)) return false;
  const cost = BUILDINGS[type].cost;
  if (state.buildings[keyFor(x, y)]) {
    if (!quiet) selectBuilding(x, y);
    return false;
  }
  if (state.credits < cost) {
    if (!quiet) toast(`Insufficient credits. ${BUILDINGS[type].name} costs ₡ ${cost}.`, "bad");
    errorSound();
    return false;
  }
  if (type === "miner" && !terrain[y][x].ore) {
    if (!quiet) toast("Miners must be placed directly on a resource field.", "bad");
    errorSound();
    return false;
  }

  state.buildings[keyFor(x, y)] = makeBuilding(type, x, y, direction);
  state.credits -= cost;
  spawnPlacementParticles(x, y);
  if (!quiet) {
    clickSound(730, 0.035);
    setStatus(`${BUILDINGS[type].name} constructed.`);
  }
  return true;
}
