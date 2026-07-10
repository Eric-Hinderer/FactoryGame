/* Direction visibility and bulk dismantling for the Phaser scene. */
(() => {
  "use strict";

  if (window.__foundryDirectionToolsLoaded) return;
  window.__foundryDirectionToolsLoaded = true;

  const ARROW_N = 44;
  const CYAN = 0x72d9e9;
  const AMBER = 0xefb85b;
  const RED = 0xe26767;

  const previousIsBuildingUnlocked = isBuildingUnlocked;
  isBuildingUnlocked = function (type) {
    return type === "demolish" || previousIsBuildingUnlocked(type);
  };

  const previousSetBuildTool = setBuildTool;
  setBuildTool = function (type) {
    if (type !== "demolish") return previousSetBuildTool(type);

    selectedTool = "demolish";
    beltDrag = null;
    selectedBuildingKey = null;
    document.querySelectorAll(".build-tool").forEach(button => {
      button.classList.toggle("active", button.dataset.tool === "demolish");
    });
    UI.buildModeText.textContent = "Area Dismantle";
    updateInspector();
    setStatus("Dismantle mode active. Drag over structures to remove them; the Command Core is protected.");
    clickSound(300, 0.035);
  };

  function installDismantleButton() {
    const toolbar = document.getElementById("build-toolbar");
    if (!toolbar) return;

    if (!toolbar.querySelector('[data-tool="demolish"]')) {
      const button = document.createElement("button");
      button.className = "build-tool demolish-tool";
      button.dataset.tool = "demolish";
      button.dataset.key = "X";
      button.innerHTML = '<span class="hotkey">X</span><span class="tool-icon">⌫</span><span class="tool-copy"><strong>Dismantle</strong><small>drag area</small></span>';
      toolbar.querySelector('[data-tool="cursor"]')?.after(button);
    }

    if (!document.getElementById("phaser-dismantle-styles")) {
      const style = document.createElement("style");
      style.id = "phaser-dismantle-styles";
      style.textContent = `
        #build-toolbar{grid-template-columns:repeat(11,1fr)!important}
        .demolish-tool{border-color:rgba(226,103,103,.28)}
        .demolish-tool .tool-icon,.demolish-tool .tool-copy small{color:#e26767}
        .demolish-tool.active{border-color:#e26767;background:linear-gradient(145deg,rgba(226,103,103,.2),rgba(39,20,24,.96));box-shadow:inset 0 0 25px rgba(226,103,103,.08)}
        .demolish-tool.active::after{background:#e26767;box-shadow:0 0 12px #e26767}
        @media(max-width:1280px){#build-toolbar{grid-template-columns:repeat(11,minmax(52px,1fr))!important}}
      `;
      document.head.appendChild(style);
    }
  }

  installDismantleButton();
  updateBuildToolAvailability();

  window.addEventListener("keydown", event => {
    if (event.code !== "KeyX" || paused || event.repeat) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setBuildTool(selectedTool === "demolish" ? "cursor" : "demolish");
  }, true);

  function centerOfTile(x, y) {
    return { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE };
  }

  function drawDirectionCue(graphics, centerX, centerY, direction, color = CYAN, alpha = 1, scale = 1) {
    const vector = dirVec(direction);
    const perpendicular = { x: -vector.y, y: vector.x };
    const lineStart = TILE * 0.19 * scale;
    const lineEnd = TILE * 0.50 * scale;
    const tip = TILE * 0.55 * scale;
    const wingBack = TILE * 0.43 * scale;
    const wing = TILE * 0.10 * scale;

    graphics.lineStyle(Math.max(5, TILE * 0.11 * scale), color, alpha * 0.16);
    graphics.beginPath();
    graphics.moveTo(centerX + vector.x * lineStart, centerY + vector.y * lineStart);
    graphics.lineTo(centerX + vector.x * lineEnd, centerY + vector.y * lineEnd);
    graphics.strokePath();

    graphics.lineStyle(Math.max(2, TILE * 0.045 * scale), color, alpha);
    graphics.beginPath();
    graphics.moveTo(centerX + vector.x * lineStart, centerY + vector.y * lineStart);
    graphics.lineTo(centerX + vector.x * tip, centerY + vector.y * tip);
    graphics.moveTo(centerX + vector.x * tip, centerY + vector.y * tip);
    graphics.lineTo(centerX + vector.x * wingBack + perpendicular.x * wing, centerY + vector.y * wingBack + perpendicular.y * wing);
    graphics.moveTo(centerX + vector.x * tip, centerY + vector.y * tip);
    graphics.lineTo(centerX + vector.x * wingBack - perpendicular.x * wing, centerY + vector.y * wingBack - perpendicular.y * wing);
    graphics.strokePath();
  }

  function waitForScene() {
    const scene = window.foundryPhaser?.scene;
    if (!window.foundryPhaser?.ready || !scene) {
      requestAnimationFrame(waitForScene);
      return;
    }
    patchScene(scene);
  }

  function patchScene(scene) {
    if (scene.__directionToolsPatched) return;
    scene.__directionToolsPatched = true;
    scene.demolishStart = null;
    scene.demolishEnd = null;

    if (!scene.demolishLabel) {
      scene.demolishLabel = scene.add.text(0, 0, "", {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#ffe0e0",
        backgroundColor: "rgba(65,18,24,.92)",
        padding: { x: 8, y: 5 }
      }).setDepth(500001).setVisible(false);
    }

    function ensureFlowView(view) {
      if (!view.flow) {
        view.flow = scene.add.graphics();
        view.container.addAt(view.flow, Math.min(2, view.container.length));
      }
      if (!view.secondaryArrow) {
        view.secondaryArrow = scene.add.image(0, 0, "foundry", ARROW_N + 1)
          .setScale(0.42)
          .setAlpha(0.95)
          .setTint(AMBER)
          .setVisible(false);
        view.container.add(view.secondaryArrow);
      }
    }

    const baseUpdateBuildingViews = scene.updateBuildingViews.bind(scene);
    scene.updateBuildingViews = function (time) {
      baseUpdateBuildingViews(time);
      for (const [key, building] of Object.entries(state.buildings)) {
        const view = this.buildingViews.get(key);
        if (!view) continue;
        ensureFlowView(view);
        view.flow.clear();
        view.secondaryArrow.setVisible(false);

        const isBelt = building.type === "belt";
        const hasOutput = building.type !== "hub" && building.type !== "generator";
        view.arrow.setVisible(hasOutput);
        if (!hasOutput) continue;

        const vector = dirVec(building.dir);
        drawDirectionCue(view.flow, 0, 0, building.dir, CYAN, isBelt ? 0.82 : 1, isBelt ? 0.72 : 1);
        view.arrow
          .setVisible(true)
          .setFrame(ARROW_N + building.dir)
          .setTint(0xb8f5ff)
          .setAlpha(1)
          .setPosition(vector.x * TILE * (isBelt ? 0.31 : 0.50), vector.y * TILE * (isBelt ? 0.31 : 0.50))
          .setScale(isBelt ? 0.31 : 0.48);

        if (building.type === "splitter") {
          const alternateDirection = (building.dir + 1) % 4;
          const alternate = dirVec(alternateDirection);
          drawDirectionCue(view.flow, 0, 0, alternateDirection, AMBER, 0.9, 0.82);
          view.secondaryArrow
            .setVisible(true)
            .setFrame(ARROW_N + alternateDirection)
            .setPosition(alternate.x * TILE * 0.45, alternate.y * TILE * 0.45);
        }
      }
    };

    function boundsForArea() {
      if (!scene.demolishStart || !scene.demolishEnd) return null;
      return {
        minX: Math.min(scene.demolishStart.x, scene.demolishEnd.x),
        maxX: Math.max(scene.demolishStart.x, scene.demolishEnd.x),
        minY: Math.min(scene.demolishStart.y, scene.demolishEnd.y),
        maxY: Math.max(scene.demolishStart.y, scene.demolishEnd.y)
      };
    }

    function removableInBounds(bounds) {
      if (!bounds) return [];
      const removable = [];
      for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
          const key = keyFor(x, y);
          const building = state.buildings[key];
          if (building && building.type !== "hub") removable.push([key, building]);
        }
      }
      return removable;
    }

    function commitDismantle() {
      const removable = removableInBounds(boundsForArea());
      if (!removable.length) {
        setStatus("No removable structures inside the selected area.");
        return;
      }

      let refund = 0;
      for (const [key, building] of removable) {
        refund += Math.ceil((BUILDINGS[building.type]?.cost || 0) * 0.65);
        spawnDismantleParticles(building.x, building.y);
        delete state.buildings[key];
      }

      state.credits += refund;
      selectedBuildingKey = null;
      updateInspector();
      updateHUD(true);
      scene.syncBuildingMembership(true);
      saveGame();
      toast(`${removable.length} structures dismantled. Recovered ₡ ${refund}.`, "good");
      setStatus(`Area cleared: ${removable.length} structures removed.`);
      clickSound(220, 0.075);
    }

    scene.input.removeAllListeners("pointerdown");
    scene.input.removeAllListeners("pointermove");
    scene.input.removeAllListeners("pointerup");

    scene.input.on("pointerdown", pointer => {
      if (paused) return;
      const world = pointer.positionToCamera(scene.cameras.main);
      const tile = { x: Math.floor(world.x / TILE), y: Math.floor(world.y / TILE) };

      if (pointer.rightButtonDown()) {
        setBuildTool("cursor");
        scene.beltStart = null;
        scene.demolishStart = null;
        scene.demolishEnd = null;
        return;
      }

      const wantsPan = pointer.middleButtonDown() || (pointer.leftButtonDown() && keys.has("Space"));
      if (wantsPan) {
        scene.pointerPan = {
          x: pointer.x,
          y: pointer.y,
          scrollX: scene.cameras.main.scrollX,
          scrollY: scene.cameras.main.scrollY
        };
        scene.game.canvas.style.cursor = "grabbing";
        return;
      }

      if (!pointer.leftButtonDown() || !inBounds(tile.x, tile.y)) return;
      if (selectedTool === "demolish") {
        scene.demolishStart = tile;
        scene.demolishEnd = tile;
        return;
      }

      const existing = state.buildings[keyFor(tile.x, tile.y)];
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
        scene.beltStart = tile;
        return;
      }
      placeBuilding(selectedTool, tile.x, tile.y);
      scene.syncBuildingMembership(true);
    });

    scene.input.on("pointermove", pointer => {
      if (scene.pointerPan) {
        const zoom = scene.cameras.main.zoom;
        scene.cameras.main.scrollX = scene.pointerPan.scrollX - (pointer.x - scene.pointerPan.x) / zoom;
        scene.cameras.main.scrollY = scene.pointerPan.scrollY - (pointer.y - scene.pointerPan.y) / zoom;
        return;
      }
      if (scene.demolishStart) {
        const world = pointer.positionToCamera(scene.cameras.main);
        scene.demolishEnd = {
          x: clamp(Math.floor(world.x / TILE), 0, WORLD_W - 1),
          y: clamp(Math.floor(world.y / TILE), 0, WORLD_H - 1)
        };
      }
    });

    scene.input.on("pointerup", pointer => {
      if (scene.demolishStart && pointer.leftButtonReleased()) {
        const world = pointer.positionToCamera(scene.cameras.main);
        scene.demolishEnd = {
          x: clamp(Math.floor(world.x / TILE), 0, WORLD_W - 1),
          y: clamp(Math.floor(world.y / TILE), 0, WORLD_H - 1)
        };
        commitDismantle();
      } else if (scene.beltStart && pointer.leftButtonReleased()) {
        const world = pointer.positionToCamera(scene.cameras.main);
        const end = { x: Math.floor(world.x / TILE), y: Math.floor(world.y / TILE) };
        if (inBounds(end.x, end.y)) placeBeltPath(getBeltPath(scene.beltStart, end));
        scene.syncBuildingMembership(true);
      }

      scene.beltStart = null;
      scene.demolishStart = null;
      scene.demolishEnd = null;
      scene.demolishLabel.setVisible(false);
      scene.pointerPan = null;
      scene.game.canvas.style.cursor = "";
    });

    const baseUpdatePlacementPreview = scene.updatePlacementPreview.bind(scene);
    scene.updatePlacementPreview = function () {
      if (selectedTool === "demolish") {
        this.preview.clear();
        this.demolishLabel.setVisible(false);
        if (paused || this.pointerPan) return;
        const pointer = this.input.activePointer;
        if (!pointer || (!pointer.withinGame && !this.demolishStart)) return;
        const world = pointer.positionToCamera(this.cameras.main);
        const tile = { x: Math.floor(world.x / TILE), y: Math.floor(world.y / TILE) };
        if (!inBounds(tile.x, tile.y)) return;

        const start = this.demolishStart || tile;
        const end = this.demolishEnd || tile;
        const bounds = {
          minX: Math.min(start.x, end.x), maxX: Math.max(start.x, end.x),
          minY: Math.min(start.y, end.y), maxY: Math.max(start.y, end.y)
        };
        const removable = removableInBounds(bounds);
        this.preview.fillStyle(RED, 0.13);
        this.preview.lineStyle(3, RED, 0.95);
        this.preview.fillRect(bounds.minX * TILE + 2, bounds.minY * TILE + 2, (bounds.maxX - bounds.minX + 1) * TILE - 4, (bounds.maxY - bounds.minY + 1) * TILE - 4);
        this.preview.strokeRect(bounds.minX * TILE + 2, bounds.minY * TILE + 2, (bounds.maxX - bounds.minX + 1) * TILE - 4, (bounds.maxY - bounds.minY + 1) * TILE - 4);
        for (const [, building] of removable) {
          this.preview.fillStyle(0xff5364, 0.28);
          this.preview.fillRect(building.x * TILE + 5, building.y * TILE + 5, TILE - 10, TILE - 10);
        }
        const labelPoint = centerOfTile(bounds.minX, bounds.minY);
        this.demolishLabel
          .setText(`${removable.length} structure${removable.length === 1 ? "" : "s"} · Command Core protected`)
          .setPosition(labelPoint.x - TILE * 0.42, bounds.minY * TILE - 10)
          .setVisible(true);
        return;
      }

      baseUpdatePlacementPreview();
      if (paused || !selectedTool || this.pointerPan) return;
      const pointer = this.input.activePointer;
      if (!pointer || (!pointer.withinGame && !this.beltStart)) return;
      const world = pointer.positionToCamera(this.cameras.main);
      const tile = { x: Math.floor(world.x / TILE), y: Math.floor(world.y / TILE) };
      if (!inBounds(tile.x, tile.y)) return;

      if (selectedTool === "belt" && this.beltStart) {
        for (const step of getBeltPath(this.beltStart, tile)) {
          const center = centerOfTile(step.x, step.y);
          const valid = !state.buildings[keyFor(step.x, step.y)] || state.buildings[keyFor(step.x, step.y)].type === "belt";
          drawDirectionCue(this.preview, center.x, center.y, step.dir, valid ? CYAN : RED, 0.82, 0.48);
        }
      } else if (selectedTool !== "generator") {
        const center = centerOfTile(tile.x, tile.y);
        drawDirectionCue(this.preview, center.x, center.y, buildDirection, canPlace(selectedTool, tile.x, tile.y) ? CYAN : RED, 0.95, 0.82);
      }
    };

    scene.syncBuildingMembership(true);
    setStatus("Direction overlays restored. Area dismantle is available with X.");
  }

  waitForScene();
})();
