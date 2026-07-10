/* Progression, multi-item logistics, and desktop cursor mode. Loaded before input wiring. */

/* UI is injected so the enhancement remains compatible with existing saves and deployments. */
function installEnhancementUI() {
  if (!document.getElementById("tech-button")) {
    const button = document.createElement("button");
    button.id = "tech-button";
    button.className = "icon-button";
    button.title = "Technology Tree (T)";
    button.textContent = "⌬";
    document.getElementById("pause-button").after(button);
  }

  if (!document.querySelector('.build-tool[data-tool="cursor"]')) {
    const button = document.createElement("button");
    button.className = "build-tool cursor-tool";
    button.dataset.tool = "cursor";
    button.dataset.key = "0";
    button.innerHTML = '<span class="hotkey">0</span><span class="tool-icon">⌖</span><span class="tool-copy"><strong>Inspect</strong><small>free cursor</small></span>';
    document.getElementById("build-toolbar").prepend(button);
  }

  if (!document.getElementById("tech-screen")) {
    const overlay = document.createElement("div");
    overlay.id = "tech-screen";
    overlay.className = "overlay";
    overlay.innerHTML = `
      <div class="modal-card tech-card">
        <div class="codex-head">
          <div>
            <div class="panel-kicker">COLONY DEVELOPMENT</div>
            <h1>Technology Matrix</h1>
            <p class="tech-intro">Spend research points earned from operations and research-pack deliveries. Technologies remain unlocked in this save.</p>
          </div>
          <div class="tech-balance"><strong id="tech-points">0</strong><small>research points</small></div>
          <button id="close-tech" class="icon-button">×</button>
        </div>
        <div id="tech-grid" class="tech-grid"></div>
        <div class="tech-footer"><span>Press <kbd>T</kbd> to open or close</span><button id="close-tech-bottom" class="primary-button">Return to Operation</button></div>
      </div>`;
    document.body.appendChild(overlay);
  }

  if (!document.getElementById("enhancement-styles")) {
    const style = document.createElement("style");
    style.id = "enhancement-styles";
    style.textContent = `
      #build-toolbar{grid-template-columns:repeat(7,1fr)}
      .build-tool.locked,.build-tool:disabled{cursor:not-allowed;opacity:.42;filter:grayscale(.8)}
      .build-tool.locked::before{content:"LOCKED";position:absolute;inset:auto 5px 5px;color:#e2a867;font-size:7px;font-weight:900;letter-spacing:.16em;text-align:center}
      .cursor-tool .tool-icon{color:#a8dfe7}
      .tech-card{width:min(1080px,calc(100vw - 48px));max-height:min(820px,calc(100vh - 48px));overflow:auto}
      .tech-intro{max-width:650px;margin:0;color:#91a0aa;font-size:11px;line-height:1.6}
      .tech-balance{min-width:120px;margin-left:auto;padding:12px 16px;border:1px solid rgba(114,217,233,.28);background:rgba(114,217,233,.07);text-align:center}
      .tech-balance strong,.tech-balance small{display:block}.tech-balance strong{color:var(--cyan);font-size:24px}.tech-balance small{margin-top:3px;color:var(--muted);font-size:8px;letter-spacing:.1em;text-transform:uppercase}
      .tech-grid{display:grid;grid-template-columns:repeat(4,minmax(190px,1fr));gap:12px;margin-top:22px}
      .tech-node{position:relative;min-height:190px;display:flex;flex-direction:column;padding:16px;border:1px solid rgba(125,151,171,.2);background:linear-gradient(145deg,rgba(255,255,255,.025),transparent 45%),rgba(10,15,20,.72)}
      .tech-node.available{border-color:rgba(114,217,233,.45);box-shadow:inset 0 0 30px rgba(114,217,233,.035)}
      .tech-node.unlocked{border-color:rgba(113,214,160,.55);background:linear-gradient(145deg,rgba(113,214,160,.11),rgba(10,15,20,.82))}.tech-node.blocked{opacity:.58}
      .tech-node .tech-tier{color:var(--cyan);font-size:8px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.tech-node h3{margin:9px 0 7px;font-size:15px}.tech-node p{flex:1;margin:0;color:#8fa0aa;font-size:10px;line-height:1.55}
      .tech-effect{margin-top:12px;padding-top:10px;border-top:1px solid rgba(125,151,171,.15);color:#c3d0d6;font-size:9px;line-height:1.45}
      .tech-node button{width:100%;min-height:38px;margin-top:12px;border:1px solid var(--line);background:#18242d;color:#dce7ea;cursor:pointer;font-size:10px;font-weight:800;text-transform:uppercase}.tech-node.available button:hover{border-color:var(--cyan);background:var(--cyan-soft)}.tech-node button:disabled{cursor:not-allowed;opacity:.55}.tech-node.unlocked button{border-color:rgba(113,214,160,.3);background:rgba(113,214,160,.08);color:var(--green)}
      .tech-footer{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:20px;color:var(--muted);font-size:10px}
      @media(max-width:1180px){.tech-grid{grid-template-columns:repeat(3,minmax(180px,1fr))}}
    `;
    document.head.appendChild(style);
  }
}

installEnhancementUI();

const TECHS = {
  industrialAutomation: {
    tier: "Tier 1 · Automation",
    name: "Industrial Automation",
    cost: 2,
    prereqs: [],
    description: "Restore programmable fabrication controls for component production.",
    effect: "Unlocks Fabrication Units, gears, and copper wire."
  },
  routingSystems: {
    tier: "Tier 1 · Logistics",
    name: "Routing Systems",
    cost: 2,
    prereqs: [],
    description: "Deploy deterministic junction controllers across the transport network.",
    effect: "Unlocks Routing Junctions."
  },
  beltThroughput1: {
    tier: "Tier 1 · Logistics",
    name: "Dense Belt Packing",
    cost: 2,
    prereqs: [],
    description: "Improve cargo spacing sensors and belt synchronization.",
    effect: "Belts carry 3 items and move 15% faster."
  },
  efficientSmelting: {
    tier: "Tier 1 · Industry",
    name: "Thermal Recirculation",
    cost: 3,
    prereqs: [],
    description: "Recover exhaust heat and return it to furnace induction chambers.",
    effect: "Furnaces smelt 25% faster."
  },
  advancedElectronics: {
    tier: "Tier 2 · Automation",
    name: "Advanced Electronics",
    cost: 4,
    prereqs: ["industrialAutomation"],
    description: "Calibrate precision placement systems for colony control hardware.",
    effect: "Unlocks Control Circuit fabrication."
  },
  gridExpansion: {
    tier: "Tier 2 · Infrastructure",
    name: "Grid Expansion",
    cost: 4,
    prereqs: ["industrialAutomation"],
    description: "Bring a dormant auxiliary reactor bus back into the colony grid.",
    effect: "Adds 30 units of power-grid capacity."
  },
  beltThroughput2: {
    tier: "Tier 2 · Logistics",
    name: "Synchronized Logistics",
    cost: 5,
    prereqs: ["beltThroughput1"],
    description: "Coordinate belt drives using colony-wide timing signals.",
    effect: "Belts carry 5 items and move 35% faster."
  },
  researchSynthesis: {
    tier: "Tier 3 · Research",
    name: "Research Synthesis",
    cost: 5,
    prereqs: ["advancedElectronics"],
    description: "Authorize fabrication of sealed experimental data packages.",
    effect: "Unlocks Research Pack fabrication."
  }
};

const BASE_FRESH_STATE = freshState;
freshState = function () {
  const next = BASE_FRESH_STATE();
  next.version = 3;
  next.researchPoints = 3;
  next.techUnlocked = [];
  return next;
};

function hasTech(key) {
  return Boolean(state?.techUnlocked?.includes(key));
}

function ensureProgressionState() {
  state.version = Math.max(3, state.version || 0);
  state.techUnlocked = Array.isArray(state.techUnlocked) ? state.techUnlocked : [];
  if (!Number.isFinite(state.researchPoints)) {
    state.researchPoints = Math.max(3, 3 + (state.missionIndex || 0) * 2 + Math.min(5, state.science || 0));
  }

  const structures = Object.values(state.buildings || {});
  if (structures.some(building => building.type === "assembler")) {
    if (!hasTech("industrialAutomation")) state.techUnlocked.push("industrialAutomation");
  }
  if (structures.some(building => building.type === "splitter")) {
    if (!hasTech("routingSystems")) state.techUnlocked.push("routingSystems");
  }
  if (structures.some(building => building.type === "assembler" && ["circuit", "science"].includes(building.recipe))) {
    if (!hasTech("advancedElectronics")) state.techUnlocked.push("advancedElectronics");
  }
  if (structures.some(building => building.type === "assembler" && building.recipe === "science")) {
    if (!hasTech("researchSynthesis")) state.techUnlocked.push("researchSynthesis");
  }
  state.techUnlocked = [...new Set(state.techUnlocked)];
}

function isBuildingUnlocked(type) {
  if (["belt", "miner", "furnace", "chest", "hub"].includes(type)) return true;
  if (type === "assembler") return hasTech("industrialAutomation");
  if (type === "splitter") return hasTech("routingSystems");
  return false;
}

function isRecipeUnlocked(recipe) {
  if (["gear", "wire"].includes(recipe)) return hasTech("industrialAutomation");
  if (recipe === "circuit") return hasTech("advancedElectronics");
  if (recipe === "science") return hasTech("researchSynthesis");
  return false;
}

function beltCapacity() {
  if (hasTech("beltThroughput2")) return 5;
  if (hasTech("beltThroughput1")) return 3;
  return 2;
}

function beltSpeedMultiplier() {
  if (hasTech("beltThroughput2")) return 1.35;
  if (hasTech("beltThroughput1")) return 1.15;
  return 1;
}

const BASE_NORMALIZE_BUILDING = normalizeBuilding;
normalizeBuilding = function (building) {
  BASE_NORMALIZE_BUILDING(building);
  if (building.type === "belt") {
    building.entryDir = Number.isInteger(building.entryDir) ? building.entryDir : building.dir;
    building.beltItems = Array.isArray(building.beltItems) ? building.beltItems : [];
    if (building.item) {
      building.beltItems.push({ item: building.item, progress: building.itemProgress || 0 });
    }
    building.item = null;
    building.itemProgress = 0;
    building.beltItems = building.beltItems
      .filter(slot => slot && ITEMS[slot.item])
      .map(slot => ({ item: slot.item, progress: clamp(Number(slot.progress) || 0, 0, 0.99) }))
      .sort((a, b) => b.progress - a.progress)
      .slice(0, beltCapacity());
  }
  return building;
};

const BASE_NEW_GAME = newGame;
newGame = function () {
  BASE_NEW_GAME();
  ensureProgressionState();
  setBuildTool("cursor");
  updateBuildToolAvailability();
  renderTechTree();
};

const BASE_LOAD_GAME = loadGame;
loadGame = function () {
  BASE_LOAD_GAME();
  ensureProgressionState();
  Object.values(state.buildings).forEach(normalizeBuilding);
  updateBuildToolAvailability();
  updateHUD(true);
};

function updateBuildToolAvailability() {
  document.querySelectorAll(".build-tool").forEach(button => {
    const type = button.dataset.tool;
    const unlocked = type === "cursor" || isBuildingUnlocked(type);
    button.disabled = !unlocked;
    button.classList.toggle("locked", !unlocked);
    if (!unlocked && selectedTool === type) setBuildTool("cursor");
  });
}

setBuildTool = function (type) {
  if (type === "cursor" || type == null) {
    selectedTool = null;
    beltDrag = null;
    selectedBuildingKey = null;
    document.querySelectorAll(".build-tool").forEach(button => {
      button.classList.toggle("active", button.dataset.tool === "cursor");
    });
    UI.buildModeText.textContent = "Inspect / Navigate";
    updateInspector();
    setStatus("Inspect mode active. Click structures to inspect or empty terrain to clear selection.");
    clickSound(420, 0.02);
    return;
  }

  if (!BUILDINGS[type]) return;
  if (!isBuildingUnlocked(type)) {
    toast(`${BUILDINGS[type].name} requires technology research.`, "bad");
    errorSound();
    return;
  }
  selectedTool = type;
  selectedBuildingKey = null;
  document.querySelectorAll(".build-tool").forEach(button => {
    button.classList.toggle("active", button.dataset.tool === type);
  });
  UI.buildModeText.textContent = BUILDINGS[type].name;
  updateInspector();
  clickSound(560, 0.025);
};

const BASE_CAN_PLACE = canPlace;
canPlace = function (type, x, y) {
  if (!type || type === "cursor" || !isBuildingUnlocked(type)) return false;
  return BASE_CAN_PLACE(type, x, y);
};

const BASE_SET_RECIPE = setRecipe;
setRecipe = function (recipeKey) {
  if (!isRecipeUnlocked(recipeKey)) {
    toast(`${RECIPES[recipeKey]?.name || "This recipe"} is locked in the technology matrix.`, "bad");
    errorSound();
    return;
  }
  BASE_SET_RECIPE(recipeKey);
};
