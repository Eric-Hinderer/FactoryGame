/* Phaser 3 sprite renderer and desktop input layer.
   The simulation, saves, progression, recipes, and DOM HUD remain owned by the existing modules. */
(() => {
  "use strict";

  if (typeof Phaser === "undefined") {
    console.error("Phaser failed to load; retaining the legacy Canvas renderer.");
    return;
  }

  const FRAME = Object.freeze({
    groundA: 0, groundB: 1, groundC: 2, iron: 3, copper: 4, coal: 5, debris: 6,
    beltH0: 8, beltH1: 9, beltV0: 10, beltV1: 11,
    cornerSE: 12, cornerSW: 13, cornerNW: 14, cornerNE: 15,
    minerIdle: 16, minerActive: 17,
    furnaceIdle: 18, furnaceActive: 19,
    assemblerIdle: 20, assemblerActive: 21,
    chest: 22, splitter: 23, hub: 24,
    generatorIdle: 25, generatorActive: 26,
    electricMinerIdle: 27, electricMinerActive: 28,
    electricFurnaceIdle: 29, electricFurnaceActive: 30,
    selection: 31,
    ironOre: 32, copperOre: 33, coalItem: 34, ironPlate: 35, copperPlate: 36,
    gear: 37, wire: 38, circuit: 39, science: 40,
    smoke: 41, spark: 42, glow: 43,
    arrowN: 44, arrowE: 45, arrowS: 46, arrowW: 47
  });

  const ITEM_FRAME = Object.freeze({
    ironOre: FRAME.ironOre,
    copperOre: FRAME.copperOre,
    coal: FRAME.coalItem,
    ironPlate: FRAME.ironPlate,
    copperPlate: FRAME.copperPlate,
    gear: FRAME.gear,
    wire: FRAME.wire,
    circuit: FRAME.circuit,
    science: FRAME.science
  });

  const root = document.createElement("div");
  root.id = "phaser-root";
  document.body.insertBefore(root, document.getElementById("game"));

  let activeScene = null;
  let phaserReady = false;

  function worldCenterOfTile(x, y) {
    return { x: (x + 0.5) * TILE, y: (y + 0.5) * TILE };
  }

  function beltConnectedSides(building) {
    const incoming = Number.isInteger(building.entryDir) ? building.entryDir : building.dir;
    return [(incoming + 2) % 4, building.dir];
  }

  function beltFrameAndAngle(building, animationPhase) {
    const incoming = Number.isInteger(building.entryDir) ? building.entryDir : building.dir;
    const outgoing = building.dir;

    if (incoming === outgoing) {
      if (outgoing === 1) return { frame: animationPhase ? FRAME.beltH1 : FRAME.beltH0, angle: 0 };
      if (outgoing === 3) return { frame: animationPhase ? FRAME.beltH1 : FRAME.beltH0, angle: 180 };
      if (outgoing === 0) return { frame: animationPhase ? FRAME.beltV1 : FRAME.beltV0, angle: 0 };
      return { frame: animationPhase ? FRAME.beltV1 : FRAME.beltV0, angle: 180 };
    }

    const sides = beltConnectedSides(building).sort((a, b) => a - b).join(",");
    if (sides === "1,2") return { frame: FRAME.cornerSE, angle: 0 };
    if (sides === "2,3") return { frame: FRAME.cornerSW, angle: 0 };
    if (sides === "0,3") return { frame: FRAME.cornerNW, angle: 0 };
    return { frame: FRAME.cornerNE, angle: 0 };
  }

  function frameForBuilding(building, time) {
    const pulse = Math.floor(time / 260) % 2 === 0;
    switch (building.type) {
      case "belt": return beltFrameAndAngle(building, pulse);
      case "miner": return { frame: pulse ? FRAME.minerActive : FRAME.minerIdle, angle: building.dir * 90 };
      case "electricMiner": return { frame: pulse ? FRAME.electricMinerActive : FRAME.electricMinerIdle, angle: building.dir * 90 };
      case "furnace": return { frame: building.progress > 0 || building.burnTime > 0 ? FRAME.furnaceActive : FRAME.furnaceIdle, angle: building.dir * 90 };
      case "electricFurnace": return { frame: building.progress > 0 ? FRAME.electricFurnaceActive : FRAME.electricFurnaceIdle, angle: building.dir * 90 };
      case "assembler": return { frame: building.progress > 0 && pulse ? FRAME.assemblerActive : FRAME.assemblerIdle, angle: building.dir * 90 };
      case "generator": return { frame: building.fuelSeconds > 0 ? FRAME.generatorActive : FRAME.generatorIdle, angle: building.dir * 90 };
      case "chest": return { frame: FRAME.chest, angle: 0 };
      case "splitter": return { frame: FRAME.splitter, angle: building.dir * 90 };
      case "hub": return { frame: FRAME.hub, angle: 0 };
      default: return { frame: FRAME.chest, angle: building.dir * 90 };
    }
  }

  function beltPoint(building, progress, lane) {
    const center = worldCenterOfTile(building.x, building.y);
    const incomingDir = Number.isInteger(building.entryDir) ? building.entryDir : building.dir;
    const incoming = dirVec(incomingDir);
    const outgoing = dirVec(building.dir);
    const start = { x: center.x - incoming.x * TILE * 0.39, y: center.y - incoming.y * TILE * 0.39 };
    const end = { x: center.x + outgoing.x * TILE * 0.39, y: center.y + outgoing.y * TILE * 0.39 };
    const t = 0.08 + clamp(progress, 0, 1) * 0.84;
    let x;
    let y;
    let tx;
    let ty;

    if (incomingDir === building.dir) {
      x = Phaser.Math.Linear(start.x, end.x, t);
      y = Phaser.Math.Linear(start.y, end.y, t);
      tx = end.x - start.x;
      ty = end.y - start.y;
    } else {
      const one = 1 - t;
      x = one * one * start.x + 2 * one * t * center.x + t * t * end.x;
      y = one * one * start.y + 2 * one * t * center.y + t * t * end.y;
      tx = 2 * one * (center.x - start.x) + 2 * t * (end.x - center.x);
      ty = 2 * one * (center.y - start.y) + 2 * t * (end.y - center.y);
    }

    const length = Math.hypot(tx, ty) || 1;
    const offset = (lane === 1 ? 1 : -1) * TILE * 0.115;
    return { x: x + (-ty / length) * offset, y: y + (tx / length) * offset };
  }

  class FoundryScene extends Phaser.Scene {
    constructor() {
      super({ key: "FoundryScene" });
      this.buildingViews = new Map();
      this.itemPool = [];
      this.preview = null;
      this.pointerPan = null;
      this.beltStart = null;
      this.lastMembershipSync = 0;
      this.lastAmbientPulse = 0;
    }

    preload() {
      const assetBase = window.FOUNDRY_ASSET_BASE || "/assets/";
      const spriteUrl = window.FOUNDRY_SPRITE_DATA || `${assetBase}foundry-sprites.svg`;
      this.load.spritesheet("foundry", spriteUrl, {
        frameWidth: TILE,
        frameHeight: TILE
      });
    }

    create() {
      activeScene = this;
      phaserReady = true;
      document.body.classList.add("phaser-active");

      this.cameras.main.setBackgroundColor("#080d12");
      this.cameras.main.setBounds(0, 0, WORLD_W * TILE, WORLD_H * TILE);
      this.cameras.main.setZoom(camera.zoom);
      this.cameras.main.centerOn(camera.x, camera.y);
      this.cameras.main.roundPixels = false;

      this.createTerrain();
      this.preview = this.add.graphics().setDepth(500000);
      this.createParticleSystems();
      this.bindPointerInput();
      this.installSimulationParticleBridge();
      this.syncBuildingMembership(true);

      // Let the already-scheduled legacy frame run once, then terminate its chain.
      drawWorld = function () {};
      frame = function () {};
      particles = [];

      const priorCenterOnTile = centerOnTile;
      centerOnTile = (x, y) => {
        priorCenterOnTile(x, y);
        this.cameras.main.centerOn(camera.x, camera.y);
      };

      const priorNewGame = newGame;
      newGame = (...args) => {
        const result = priorNewGame(...args);
        this.cameras.main.setZoom(camera.zoom);
        this.cameras.main.centerOn(camera.x, camera.y);
        this.syncBuildingMembership(true);
        return result;
      };

      setStatus("Phaser sprite renderer online. Colony simulation synchronized.");
    }

    createTerrain() {
      const data = terrain.map(row => row.map(tile => {
        if (tile.ore === "ironOre") return FRAME.iron;
        if (tile.ore === "copperOre") return FRAME.copper;
        if (tile.ore === "coal") return FRAME.coal;
        if (tile.debris) return FRAME.debris;
        return tile.ground > 0.67 ? FRAME.groundC : tile.ground > 0.34 ? FRAME.groundB : FRAME.groundA;
      }));
      const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
      const tileset = map.addTilesetImage("foundry-sprites", "foundry", TILE, TILE, 0, 0);
      this.terrainLayer = map.createLayer(0, tileset, 0, 0).setDepth(0);
    }

    createParticleSystems() {
      this.sparkEmitter = this.add.particles(0, 0, "foundry", {
        frame: FRAME.spark,
        lifespan: { min: 220, max: 520 },
        speed: { min: 45, max: 125 },
        scale: { start: 0.16, end: 0 },
        alpha: { start: 0.9, end: 0 },
        rotate: { min: 0, max: 360 },
        blendMode: "ADD",
        emitting: false
      }).setDepth(400000);

      this.smokeEmitter = this.add.particles(0, 0, "foundry", {
        frame: FRAME.smoke,
        lifespan: { min: 700, max: 1300 },
        speedY: { min: -28, max: -12 },
        speedX: { min: -8, max: 8 },
        scale: { start: 0.22, end: 0.5 },
        alpha: { start: 0.28, end: 0 },
        emitting: false
      }).setDepth(390000);
    }

    installSimulationParticleBridge() {
      spawnPlacementParticles = (x, y) => {
        const p = worldCenterOfTile(x, y);
        this.sparkEmitter.explode(13, p.x, p.y);
      };
      spawnDismantleParticles = (x, y) => {
        const p = worldCenterOfTile(x, y);
        this.sparkEmitter.explode(18, p.x, p.y);
      };
      spawnMachineParticle = (x, y) => {
        const p = worldCenterOfTile(x, y);
        this.smokeEmitter.explode(1, p.x, p.y - TILE * 0.2);
      };
    }

    bindPointerInput() {
      this.input.mouse?.disableContextMenu();

      this.input.on("pointerdown", pointer => {
        if (paused) return;
        const world = pointer.positionToCamera(this.cameras.main);
        const tile = { x: Math.floor(world.x / TILE), y: Math.floor(world.y / TILE) };

        if (pointer.rightButtonDown()) {
          setBuildTool("cursor");
          this.beltStart = null;
          return;
        }

        const wantsPan = pointer.middleButtonDown() || (pointer.leftButtonDown() && keys.has("Space"));
        if (wantsPan) {
          this.pointerPan = {
            x: pointer.x,
            y: pointer.y,
            scrollX: this.cameras.main.scrollX,
            scrollY: this.cameras.main.scrollY
          };
          this.game.canvas.style.cursor = "grabbing";
          return;
        }

        if (!pointer.leftButtonDown() || !inBounds(tile.x, tile.y)) return;
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
          this.beltStart = tile;
          return;
        }

        placeBuilding(selectedTool, tile.x, tile.y);
        this.syncBuildingMembership(true);
      });

      this.input.on("pointermove", pointer => {
        if (this.pointerPan) {
          const zoom = this.cameras.main.zoom;
          this.cameras.main.scrollX = this.pointerPan.scrollX - (pointer.x - this.pointerPan.x) / zoom;
          this.cameras.main.scrollY = this.pointerPan.scrollY - (pointer.y - this.pointerPan.y) / zoom;
        }
      });

      this.input.on("pointerup", pointer => {
        if (this.beltStart && pointer.leftButtonReleased()) {
          const world = pointer.positionToCamera(this.cameras.main);
          const end = { x: Math.floor(world.x / TILE), y: Math.floor(world.y / TILE) };
          if (inBounds(end.x, end.y)) placeBeltPath(getBeltPath(this.beltStart, end));
          this.syncBuildingMembership(true);
        }
        this.beltStart = null;
        this.pointerPan = null;
        this.game.canvas.style.cursor = "";
      });

      this.input.on("wheel", (pointer, _objects, _dx, dy) => {
        if (paused) return;
        const cam = this.cameras.main;
        const before = pointer.positionToCamera(cam);
        const nextZoom = clamp(cam.zoom * Math.exp(-dy * 0.0011), 0.42, 1.55);
        cam.setZoom(nextZoom);
        cam.scrollX = before.x - pointer.x / nextZoom;
        cam.scrollY = before.y - pointer.y / nextZoom;
      });
    }

    makeBuildingView(key, building) {
      const center = worldCenterOfTile(building.x, building.y);
      const container = this.add.container(center.x, center.y).setDepth(1000 + building.y * TILE);
      const shadow = this.add.image(3, 9, "foundry", FRAME.glow).setTint(0x000000).setAlpha(0.25).setScale(0.75, 0.35);
      const base = this.add.sprite(0, 0, "foundry", FRAME.chest);
      const arrow = this.add.image(0, 0, "foundry", FRAME.arrowE).setScale(0.28).setAlpha(0.85);
      const selection = this.add.image(0, 0, "foundry", FRAME.selection).setVisible(false);
      container.add([shadow, base, arrow, selection]);
      const view = { key, container, shadow, base, arrow, selection };
      this.buildingViews.set(key, view);
      return view;
    }

    syncBuildingMembership(force = false) {
      const now = this.time.now;
      if (!force && now - this.lastMembershipSync < 160) return;
      this.lastMembershipSync = now;
      const currentKeys = new Set(Object.keys(state.buildings));

      for (const [key, view] of this.buildingViews) {
        if (!currentKeys.has(key)) {
          view.container.destroy(true);
          this.buildingViews.delete(key);
        }
      }

      for (const [key, building] of Object.entries(state.buildings)) {
        if (!this.buildingViews.has(key)) this.makeBuildingView(key, building);
      }
    }

    updateBuildingViews(time) {
      for (const [key, building] of Object.entries(state.buildings)) {
        const view = this.buildingViews.get(key) || this.makeBuildingView(key, building);
        const center = worldCenterOfTile(building.x, building.y);
        const visual = frameForBuilding(building, time);
        view.container.setPosition(center.x, center.y).setDepth(1000 + building.y * TILE);
        view.base.setFrame(visual.frame).setAngle(visual.angle);
        view.selection.setVisible(selectedBuildingKey === key).setAlpha(0.72 + Math.sin(time / 150) * 0.18);

        const isBelt = building.type === "belt";
        const isHub = building.type === "hub";
        view.shadow.setVisible(!isBelt);
        view.arrow.setVisible(!isBelt && !isHub);
        if (!isBelt && !isHub) {
          const vector = dirVec(building.dir);
          view.arrow.setFrame(FRAME.arrowN + building.dir).setPosition(vector.x * TILE * 0.34, vector.y * TILE * 0.34);
        }

        if (building.type === "generator" && building.fuelSeconds > 0 && time - this.lastAmbientPulse > 160) {
          this.smokeEmitter.explode(1, center.x + 10, center.y - 16);
        }
      }
      if (time - this.lastAmbientPulse > 160) this.lastAmbientPulse = time;
    }

    acquireItemSprite(index) {
      if (!this.itemPool[index]) {
        this.itemPool[index] = this.add.image(0, 0, "foundry", FRAME.ironOre).setScale(0.42).setDepth(300000);
      }
      return this.itemPool[index];
    }

    updateItemViews() {
      let index = 0;
      for (const building of Object.values(state.buildings)) {
        if (building.type === "belt") {
          normalizeBuilding(building);
          for (const slot of building.beltItems || []) {
            const point = beltPoint(building, slot.progress, slot.lane || 0);
            this.acquireItemSprite(index++)
              .setVisible(true)
              .setFrame(ITEM_FRAME[slot.item] ?? FRAME.ironOre)
              .setPosition(point.x, point.y)
              .setDepth(200000 + point.y)
              .setScale(0.41);
          }
        } else if (building.output?.length) {
          const point = worldCenterOfTile(building.x, building.y);
          this.acquireItemSprite(index++)
            .setVisible(true)
            .setFrame(ITEM_FRAME[building.output[0]] ?? FRAME.ironOre)
            .setPosition(point.x, point.y - 2)
            .setDepth(200000 + point.y)
            .setScale(0.34);
        }
      }
      for (let i = index; i < this.itemPool.length; i++) this.itemPool[i].setVisible(false);
    }

    updatePlacementPreview() {
      this.preview.clear();
      if (paused || !selectedTool || this.pointerPan) return;
      const pointer = this.input.activePointer;
      if (!pointer || !pointer.withinGame) return;
      const world = pointer.positionToCamera(this.cameras.main);
      const tile = { x: Math.floor(world.x / TILE), y: Math.floor(world.y / TILE) };
      if (!inBounds(tile.x, tile.y)) return;

      if (selectedTool === "belt" && this.beltStart) {
        const path = getBeltPath(this.beltStart, tile);
        this.preview.lineStyle(3, 0x72d9e9, 0.78);
        if (path.length) {
          this.preview.beginPath();
          path.forEach((step, i) => {
            const point = worldCenterOfTile(step.x, step.y);
            if (i === 0) this.preview.moveTo(point.x, point.y);
            else this.preview.lineTo(point.x, point.y);
          });
          this.preview.strokePath();
          for (const step of path) {
            const valid = !state.buildings[keyFor(step.x, step.y)] || state.buildings[keyFor(step.x, step.y)].type === "belt";
            this.preview.fillStyle(valid ? 0x72d9e9 : 0xe26767, 0.15);
            this.preview.fillRect(step.x * TILE + 4, step.y * TILE + 4, TILE - 8, TILE - 8);
          }
        }
        return;
      }

      const valid = canPlace(selectedTool, tile.x, tile.y);
      this.preview.fillStyle(valid ? 0x72d9e9 : 0xe26767, 0.18);
      this.preview.lineStyle(2, valid ? 0x72d9e9 : 0xe26767, 0.9);
      this.preview.fillRect(tile.x * TILE + 3, tile.y * TILE + 3, TILE - 6, TILE - 6);
      this.preview.strokeRect(tile.x * TILE + 3, tile.y * TILE + 3, TILE - 6, TILE - 6);
    }

    updateCamera(deltaSeconds) {
      if (paused || this.pointerPan) return;
      let x = 0;
      let y = 0;
      if (keys.has("KeyW") || keys.has("ArrowUp")) y -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) y += 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
      x += edgeScroll.x;
      y += edgeScroll.y;
      if (x || y) {
        const length = Math.hypot(x, y) || 1;
        const speed = (540 / this.cameras.main.zoom) * deltaSeconds;
        this.cameras.main.scrollX += x / length * speed;
        this.cameras.main.scrollY += y / length * speed;
      }
    }

    update(time, delta) {
      const dt = Math.min(0.05, delta / 1000);
      this.updateCamera(dt);
      simulationTick(dt);
      this.syncBuildingMembership();
      this.updateBuildingViews(time);
      this.updateItemViews();
      this.updatePlacementPreview();

      const cam = this.cameras.main;
      camera.x = cam.midPoint.x;
      camera.y = cam.midPoint.y;
      camera.zoom = cam.zoom;
      viewport.width = this.scale.width;
      viewport.height = this.scale.height;
    }
  }

  const config = {
    type: Phaser.AUTO,
    parent: root,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: "#080d12",
    pixelArt: false,
    antialias: true,
    roundPixels: false,
    transparent: false,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: "100%",
      height: "100%"
    },
    render: {
      antialias: true,
      powerPreference: "high-performance",
      batchSize: 4096
    },
    scene: [FoundryScene]
  };

  window.foundryPhaserGame = new Phaser.Game(config);
  window.foundryPhaser = {
    version: Phaser.VERSION,
    get scene() { return activeScene; },
    get ready() { return phaserReady; }
  };
})();
