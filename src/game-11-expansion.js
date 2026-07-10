/* Foundry Frontier expansion:
   - Seeded, regenerating procedural sectors
   - Extended progression (missions + technologies)
   - Mining productivity and higher belt tiers
   - Belt routing that threads safely through existing belts
   These build on the existing global simulation via the same override pattern used elsewhere. */

/* ------------------------------------------------------------------ */
/* Procedural, seeded world generation                                 */
/* ------------------------------------------------------------------ */

let ff11WorldSeed = 1;

function ff11SeededRandom(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 13), 3266489917);
    t ^= t >>> 16;
    return (t >>> 0) / 4294967296;
  };
}

function ff11GeneratePatches(seed) {
  const rand = ff11SeededRandom(seed ^ 0x51ed270b);
  const hubX = Math.floor(WORLD_W / 2);
  const hubY = Math.floor(WORLD_H / 2);
  const patches = [];

  const place = (type, minR, maxR, dist) => {
    const angle = rand() * Math.PI * 2;
    const x = clamp(Math.round(hubX + Math.cos(angle) * dist), 6, WORLD_W - 6);
    const y = clamp(Math.round(hubY + Math.sin(angle) * dist), 6, WORLD_H - 6);
    patches.push({ x, y, r: minR + rand() * (maxR - minR), type, seed: (rand() * 100000) | 0 });
  };

  /* Guaranteed starter resources within reach of the Command Core. */
  place("ironOre", 5.2, 6.6, 9 + rand() * 4);
  place("copperOre", 5.0, 6.4, 11 + rand() * 4);
  place("coal", 5.0, 6.4, 11 + rand() * 4);
  place("ironOre", 5.0, 6.6, 16 + rand() * 5);

  /* Scattered frontier deposits for expansion. */
  const extra = 5 + ((rand() * 4) | 0);
  const types = ["ironOre", "copperOre", "coal"];
  for (let i = 0; i < extra; i++) {
    place(types[(rand() * types.length) | 0], 4.4, 7.6, 17 + rand() * 16);
  }
  return patches;
}

/* Reassign the global terrain builder so every sector is unique but reproducible. */
makeTerrain = function () {
  const seed = ff11WorldSeed >>> 0;
  terrain = Array.from({ length: WORLD_H }, (_, y) =>
    Array.from({ length: WORLD_W }, (_, x) => ({
      ground: noise01(x, y, 4 + (seed % 97)),
      ore: null,
      richness: 0,
      debris: noise01(x, y, 9 + (seed % 53)) > 0.93
    }))
  );

  for (const patch of ff11GeneratePatches(seed)) {
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
};

function ff11RegenerateWorld() {
  if (state && !Number.isFinite(state.seed)) state.seed = (Math.random() * 1e9) >>> 0;
  ff11WorldSeed = state && Number.isFinite(state.seed) ? state.seed : 1;
  makeTerrain();
  if (typeof window.foundryRebuildTerrain === "function") window.foundryRebuildTerrain();
  if (typeof drawMinimap === "function" && state) drawMinimap();
}

const FF11_BASE_FRESH_STATE = freshState;
freshState = function () {
  const next = FF11_BASE_FRESH_STATE();
  next.seed = (Math.random() * 1e9) >>> 0;
  return next;
};

const FF11_BASE_NEW_GAME = newGame;
newGame = function (...args) {
  const result = FF11_BASE_NEW_GAME(...args);
  ff11RegenerateWorld();
  setStatus("New sector surveyed. Fresh resource fields mapped.");
  return result;
};

const FF11_BASE_LOAD_GAME = loadGame;
loadGame = function (...args) {
  const result = FF11_BASE_LOAD_GAME(...args);
  ff11RegenerateWorld();
  return result;
};

/* ------------------------------------------------------------------ */
/* Extended progression: additional missions and technologies          */
/* ------------------------------------------------------------------ */

MISSIONS.push(
  {
    title: "Automation surge",
    copy: "Scale up mechanical fabrication and stockpile gear assemblies for the expansion works.",
    item: "gear",
    target: 30,
    label: "Gear assemblies delivered",
    reward: 640
  },
  {
    title: "Electronics boom",
    copy: "Flood the colony logistics net with control circuits for the automation grid.",
    item: "circuit",
    target: 28,
    label: "Control circuits delivered",
    reward: 820
  },
  {
    title: "Deep-frontier research",
    copy: "Sustain a high-volume research pipeline to certify the sector as fully self-directing.",
    item: "science",
    target: 26,
    label: "Research packs delivered",
    reward: 1200
  }
);

TECHS.miningProductivity = {
  tier: "Tier 2 · Industry",
  name: "Mining Productivity",
  cost: 4,
  prereqs: ["efficientSmelting"],
  description: "Upgrade drill heads and ore-sorting intakes across the extraction fleet.",
  effect: "All miners extract 25% faster."
};
TECHS.beltThroughput3 = {
  tier: "Tier 3 · Logistics",
  name: "Express Logistics",
  cost: 6,
  prereqs: ["beltThroughput2"],
  description: "Deploy express drive spindles and high-density cargo spacing.",
  effect: "Belts carry 7 items and move 60% faster."
};

/* Higher belt tier hooks into the existing capacity/speed helpers. */
const FF11_BASE_BELT_CAPACITY = beltCapacity;
beltCapacity = function () {
  return hasTech("beltThroughput3") ? 7 : FF11_BASE_BELT_CAPACITY();
};

const FF11_BASE_BELT_SPEED = beltSpeedMultiplier;
beltSpeedMultiplier = function () {
  return hasTech("beltThroughput3") ? 1.6 : FF11_BASE_BELT_SPEED();
};

/* Mining productivity: scale the simulation step for extraction machinery only. */
const FF11_BASE_UPDATE_BUILDING = updateBuilding;
updateBuilding = function (building, dt, efficiency) {
  if ((building.type === "miner" || building.type === "electricMiner") && hasTech("miningProductivity")) {
    return FF11_BASE_UPDATE_BUILDING(building, dt * 1.25, efficiency);
  }
  return FF11_BASE_UPDATE_BUILDING(building, dt, efficiency);
};

/* ------------------------------------------------------------------ */
/* Belt routing fix: thread through existing belts instead of failing   */
/* ------------------------------------------------------------------ */

if (typeof ff10BeltTileBlocked === "function") {
  ff10BeltTileBlocked = function (x, y, start, end) {
    if (!inBounds(x, y)) return true;
    if ((x === start.x && y === start.y) || (x === end.x && y === end.y)) return false;
    const building = state.buildings[keyFor(x, y)];
    /* Existing belts are passable and merge cleanly; other structures block. */
    return building ? building.type !== "belt" : false;
  };
  /* Invalidate the memoized route so the new rule takes effect immediately. */
  if (typeof ff10BeltPathCache !== "undefined") ff10BeltPathCache = { key: "", path: [] };
}

/* ------------------------------------------------------------------ */
/* Apply to the currently loaded sector                                 */
/* ------------------------------------------------------------------ */

ff11RegenerateWorld();
if (typeof renderTechTree === "function") renderTechTree();
if (typeof updateHUD === "function") updateHUD(true);
