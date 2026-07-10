/* Detailed machine recipes and a global production codex. */

function ff10ItemChip(item, count = 1) {
  const definition = ITEMS[item];
  if (!definition) return `<span class="recipe-chip neutral">${count} ${item}</span>`;
  return `<span class="recipe-chip" style="--item-color:${definition.color}"><b>${count}</b>${definition.name}</span>`;
}

function ff10RecipeRowsForBuilding(building) {
  const type = building.type;
  const rows = [];

  if (type === "miner" || type === "electricMiner") {
    const ore = terrain[building.y]?.[building.x]?.ore;
    if (ore) rows.push({
      key: `${type}-${ore}`,
      title: ITEMS[ore].name,
      inputs: [],
      outputs: [[ore, 1]],
      time: type === "electricMiner" ? "0.62 s at full power" : ore === "coal" ? "1.10 s" : "1.45 s",
      note: type === "electricMiner" ? "Consumes 9 grid units." : "Self-powered extraction."
    });
  }

  if (type === "furnace") {
    rows.push(
      { key: "burner-iron", title: "Iron Smelting", inputs: [["ironOre", 1], ["coal", "fuel"]], outputs: [["ironPlate", 1]], time: "2.45 s", note: "One coal provides 8 seconds of burn time." },
      { key: "burner-copper", title: "Copper Smelting", inputs: [["copperOre", 1], ["coal", "fuel"]], outputs: [["copperPlate", 1]], time: "2.45 s", note: "Partial smelts survive fuel starvation." }
    );
  }

  if (type === "electricFurnace") {
    rows.push(
      { key: "electric-iron", title: "Induction Iron Smelting", inputs: [["ironOre", 1]], outputs: [["ironPlate", 1]], time: "1.35 s at full power", note: "Consumes 12 grid units; no coal required." },
      { key: "electric-copper", title: "Induction Copper Smelting", inputs: [["copperOre", 1]], outputs: [["copperPlate", 1]], time: "1.35 s at full power", note: "Progress slows during a brownout." }
    );
  }

  if (type === "assembler") {
    for (const [key, recipe] of Object.entries(RECIPES)) {
      rows.push({
        key,
        title: recipe.name,
        inputs: Object.entries(recipe.inputs),
        outputs: [[recipe.output, recipe.outputCount]],
        time: `${recipe.time.toFixed(2)} s`,
        note: isRecipeUnlocked(key) ? "Available" : `Locked: ${key === "circuit" ? "Advanced Electronics" : key === "science" ? "Research Synthesis" : "Industrial Automation"}`,
        selectable: true,
        selected: building.recipe === key,
        unlocked: isRecipeUnlocked(key)
      });
    }
  }

  if (type === "generator") rows.push({
    key: "generator",
    title: "Coal Power Generation",
    inputs: [["coal", 1]],
    outputsText: `${generatorOutput()} grid units`,
    time: "14 s",
    note: "Power output is available only while fuel is burning."
  });

  if (type === "belt") rows.push({ key: "belt", title: "Dual-lane Transport", inputs: [], outputsText: `${beltCapacity()} cargo slots`, time: `${Math.round(beltSpeedMultiplier() * 100)}% drive speed`, note: "Cargo uses two lanes and keeps a safety margin at tile edges." });
  if (type === "splitter") rows.push({ key: "splitter", title: "Alternating Route", inputs: [], outputsText: "Forward / right", time: "0.15 s routing delay", note: "Alternates outputs and falls back to the open route." });
  if (type === "chest") rows.push({ key: "chest", title: "Storage and Dispatch", inputs: [], outputsText: "80-item buffer", time: "0.45 s dispatch", note: "Stores mixed cargo and forwards the next available item." });
  if (type === "hub") rows.push({ key: "hub", title: "Command Core Delivery", inputs: [], outputsText: "Credits and mission progress", time: "Immediate", note: "Research Packs also award one research point." });

  return rows;
}

function ff10RecipeRowHtml(row) {
  const inputs = row.inputs?.length
    ? row.inputs.map(([item, count]) => ff10ItemChip(item, count)).join("")
    : '<span class="recipe-chip neutral">No material input</span>';
  const outputs = row.outputs?.length
    ? row.outputs.map(([item, count]) => ff10ItemChip(item, count)).join("")
    : `<span class="recipe-chip output-text">${row.outputsText || "Operational function"}</span>`;
  const tag = row.selectable ? "button" : "article";
  const disabled = row.selectable && !row.unlocked ? "disabled" : "";
  const classes = `machine-recipe-card${row.selected ? " selected" : ""}${row.unlocked === false ? " locked" : ""}`;
  return `
    <${tag} class="${classes}" ${row.selectable ? `data-recipe="${row.key}" ${disabled}` : ""}>
      <div class="machine-recipe-head"><strong>${row.title}</strong><small>${row.time}</small></div>
      <div class="recipe-flow"><div>${inputs}</div><span>→</span><div>${outputs}</div></div>
      <p>${row.note || ""}</p>
    </${tag}>`;
}

function ff10InstallRecipeBookUI() {
  if (!document.getElementById("recipe-book-button")) {
    const button = document.createElement("button");
    button.id = "recipe-book-button";
    button.className = "icon-button";
    button.title = "Production Codex (B)";
    button.textContent = "▤";
    const techButton = document.getElementById("tech-button");
    (techButton || document.getElementById("pause-button")).after(button);
  }

  if (!document.getElementById("recipe-book-screen")) {
    const overlay = document.createElement("div");
    overlay.id = "recipe-book-screen";
    overlay.className = "overlay";
    overlay.innerHTML = `
      <div class="modal-card recipe-book-card">
        <div class="codex-head">
          <div><div class="panel-kicker">PRODUCTION DATABASE</div><h1>Recipe Codex</h1><p class="recipe-book-intro">Every extraction, smelting, assembly, power, and logistics process currently available to the colony.</p></div>
          <button id="close-recipe-book" class="icon-button">×</button>
        </div>
        <div id="recipe-book-grid"></div>
        <div class="tech-footer"><span>Press <kbd>B</kbd> to open or close</span><button id="close-recipe-book-bottom" class="primary-button">Return to Operation</button></div>
      </div>`;
    document.body.appendChild(overlay);
  }

  if (!document.getElementById("recipe-book-styles")) {
    const style = document.createElement("style");
    style.id = "recipe-book-styles";
    style.textContent = `
      .recipe-book-card{width:min(1120px,calc(100vw - 48px));max-height:min(850px,calc(100vh - 48px));overflow:auto}
      .recipe-book-intro{max-width:700px;margin:0;color:#91a0aa;font-size:11px;line-height:1.6}
      #recipe-book-grid{display:grid;grid-template-columns:repeat(2,minmax(300px,1fr));gap:14px;margin-top:20px}
      .recipe-section{padding:14px;border:1px solid rgba(125,151,171,.18);background:rgba(5,9,12,.28)}
      .recipe-section h2{margin:4px 0 12px;font-size:15px}
      .machine-recipe-list{display:grid;gap:7px}
      .machine-recipe-card{width:100%;display:block;padding:10px;border:1px solid rgba(125,151,171,.18);background:rgba(17,24,30,.88);color:#dbe7eb;text-align:left}
      button.machine-recipe-card{cursor:pointer}.machine-recipe-card:hover:not(:disabled){border-color:rgba(114,217,233,.5)}
      .machine-recipe-card.selected{border-color:#72d9e9;background:rgba(50,104,115,.23);box-shadow:inset 0 0 20px rgba(114,217,233,.05)}
      .machine-recipe-card.locked{opacity:.52}.machine-recipe-card:disabled{cursor:not-allowed}
      .machine-recipe-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.machine-recipe-head strong{font-size:11px}.machine-recipe-head small{color:#8da0aa;font-size:8px;text-transform:uppercase}
      .recipe-flow{display:grid;grid-template-columns:1fr 20px 1fr;align-items:center;gap:5px;margin-top:8px}.recipe-flow>span{color:#72d9e9;text-align:center}.recipe-flow>div{display:flex;flex-wrap:wrap;gap:4px}
      .recipe-chip{--item-color:#93a7b1;display:inline-flex;align-items:center;gap:4px;padding:4px 6px;border:1px solid color-mix(in srgb,var(--item-color) 45%,transparent);background:color-mix(in srgb,var(--item-color) 12%,transparent);color:#cdd9df;font-size:8px}.recipe-chip::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--item-color);box-shadow:0 0 7px var(--item-color)}.recipe-chip b{color:#fff}.recipe-chip.neutral,.recipe-chip.output-text{--item-color:#647781}
      .machine-recipe-card p{margin:7px 0 0;color:#82929c;font-size:8px;line-height:1.45}
      #recipe-picker{margin-top:14px}#recipe-buttons{display:grid;grid-template-columns:1fr;gap:6px;max-height:330px;overflow:auto}
      @media(max-width:900px){#recipe-book-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }
}

function ff10GlobalRecipeSections() {
  const fake = type => ({ type, x: 16, y: 15, recipe: "gear" });
  const extractionRows = [
    { key: "miner-iron", title: "Autonomous Mining", inputs: [], outputs: [["ironOre", 1]], time: "1.45 s", note: "Place on iron or copper; coal extracts in 1.10 s." },
    { key: "eminer-iron", title: "Electric Mining", inputs: [], outputs: [["ironOre", 1]], time: "0.62 s", note: "Consumes 9 grid units and extracts any underlying resource." }
  ];
  const smeltingRows = [...ff10RecipeRowsForBuilding(fake("furnace")), ...ff10RecipeRowsForBuilding(fake("electricFurnace"))];
  const assemblyRows = Object.entries(RECIPES).map(([key, recipe]) => ({
    key,
    title: recipe.name,
    inputs: Object.entries(recipe.inputs),
    outputs: [[recipe.output, recipe.outputCount]],
    time: `${recipe.time.toFixed(2)} s`,
    note: isRecipeUnlocked(key) ? "Researched" : "Technology locked",
    unlocked: isRecipeUnlocked(key)
  }));
  const infrastructureRows = [
    ...ff10RecipeRowsForBuilding(fake("generator")),
    ...ff10RecipeRowsForBuilding(fake("belt")),
    ...ff10RecipeRowsForBuilding(fake("splitter")),
    ...ff10RecipeRowsForBuilding(fake("chest")),
    ...ff10RecipeRowsForBuilding(fake("hub"))
  ];
  return [
    ["Extraction", extractionRows],
    ["Smelting", smeltingRows],
    ["Fabrication", assemblyRows],
    ["Power and Logistics", infrastructureRows]
  ];
}

function ff10RenderRecipeBook() {
  const grid = document.getElementById("recipe-book-grid");
  if (!grid) return;
  grid.innerHTML = ff10GlobalRecipeSections().map(([title, rows]) => `
    <section class="recipe-section"><div class="panel-kicker">PROCESS GROUP</div><h2>${title}</h2><div class="machine-recipe-list">${rows.map(ff10RecipeRowHtml).join("")}</div></section>
  `).join("");
}

let ff10ResumeAfterRecipeBook = false;
function ff10OpenRecipeBook() {
  ff10ResumeAfterRecipeBook = !paused;
  paused = true;
  ff10RenderRecipeBook();
  showOverlay("recipe-book-screen");
}

function ff10CloseRecipeBook() {
  hideOverlay("recipe-book-screen");
  const startVisible = document.getElementById("start-screen").classList.contains("show");
  const pauseVisible = document.getElementById("pause-screen").classList.contains("show");
  if (ff10ResumeAfterRecipeBook && !startVisible && !pauseVisible) paused = false;
  ff10ResumeAfterRecipeBook = false;
}

ff10InstallRecipeBookUI();
document.getElementById("recipe-book-button").addEventListener("click", ff10OpenRecipeBook);
document.getElementById("close-recipe-book").addEventListener("click", ff10CloseRecipeBook);
document.getElementById("close-recipe-book-bottom").addEventListener("click", ff10CloseRecipeBook);
document.getElementById("recipe-book-screen").addEventListener("mousedown", event => {
  if (event.target.id === "recipe-book-screen") ff10CloseRecipeBook();
});

window.addEventListener("keydown", event => {
  const open = document.getElementById("recipe-book-screen").classList.contains("show");
  if (event.code === "KeyB") {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (open) ff10CloseRecipeBook();
    else if (!document.getElementById("start-screen").classList.contains("show")) ff10OpenRecipeBook();
  } else if (event.code === "Escape" && open) {
    event.preventDefault();
    event.stopImmediatePropagation();
    ff10CloseRecipeBook();
  }
}, true);

const FF10_BASE_UPDATE_INSPECTOR_RECIPES = updateInspector;
updateInspector = function () {
  FF10_BASE_UPDATE_INSPECTOR_RECIPES();
  const building = selectedBuildingKey && state.buildings[selectedBuildingKey];
  if (!building) return;

  const rows = ff10RecipeRowsForBuilding(building);
  UI.recipePicker.classList.remove("hidden");
  const label = UI.recipePicker.querySelector(".panel-kicker");
  if (label) label.textContent = building.type === "assembler" ? "SELECT RECIPE" : "PROCESS / FUNCTION";

  const signature = JSON.stringify({ type: building.type, recipe: building.recipe, tech: state.techUnlocked, ore: terrain[building.y]?.[building.x]?.ore });
  if (UI.recipeButtons.dataset.signature === signature && UI.recipeButtons.querySelector(".machine-recipe-card")) return;
  UI.recipeButtons.dataset.signature = signature;
  UI.recipeButtons.innerHTML = rows.map(ff10RecipeRowHtml).join("");
  UI.recipeButtons.querySelectorAll("button[data-recipe]").forEach(button => {
    button.addEventListener("click", () => setRecipe(button.dataset.recipe));
  });
};

const productionHelpSection = [...document.querySelectorAll("#help-screen .codex-grid section")]
  .find(section => section.querySelector("h3")?.textContent === "Production");
if (productionHelpSection && !document.getElementById("recipe-help-copy")) {
  const paragraph = document.createElement("p");
  paragraph.id = "recipe-help-copy";
  paragraph.innerHTML = "<strong>Recipes:</strong> Select any structure to see its complete process, or press <kbd>B</kbd> for the Production Codex.";
  productionHelpSection.appendChild(paragraph);
}

updateInspector();
