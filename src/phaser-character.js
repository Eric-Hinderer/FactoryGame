/* Playable engineer avatar with a follow camera, plus live terrain rebuilds for
   procedurally regenerated sectors. Movement keys now drive a character that the
   camera tracks, rather than sliding a free-floating camera. */
(() => {
  "use strict";

  if (typeof Phaser === "undefined") return;
  if (window.__foundryCharacterLoaded) return;
  window.__foundryCharacterLoaded = true;

  const PLAYER_SPEED = 305; // world pixels / second (~5.6 tiles/s)
  const hubCenter = () => ({
    x: (Math.floor(WORLD_W / 2) + 0.5) * TILE,
    y: (Math.floor(WORLD_H / 2) + 0.5) * TILE
  });

  const player = { ...hubCenter(), facing: 2, walk: 0, moving: false, gfx: null };

  function drawPlayer(g) {
    g.clear();
    const bob = player.moving ? Math.sin(player.walk * 11) * 1.4 : 0;
    const swing = player.moving ? Math.sin(player.walk * 11) * 4 : 0;
    const dir = dirVec(player.facing);

    // Ground shadow
    g.fillStyle(0x000000, 0.32);
    g.fillEllipse(0, 13, 22, 8);

    // Legs (shuffle while moving)
    g.fillStyle(0x1b2830, 1);
    g.fillRoundedRect(-6, 4, 5, 10 + swing, 2);
    g.fillRoundedRect(1, 4, 5, 10 - swing, 2);

    // Backpack / life-support tank behind the torso
    g.fillStyle(0x212e35, 1);
    g.fillRoundedRect(-7, -11 + bob, 14, 6, 2);

    // Torso in an engineer's teal suit
    g.fillStyle(0x2f7d8c, 1);
    g.fillRoundedRect(-8, -6 + bob, 16, 16, 5);
    g.lineStyle(1.4, 0x113038, 1);
    g.strokeRoundedRect(-8, -6 + bob, 16, 16, 5);

    // Chest reactor light
    g.fillStyle(0x72d9e9, 0.95);
    g.fillCircle(0, 2 + bob, 2.4);

    // Helmet
    g.fillStyle(0xdce9ec, 1);
    g.fillCircle(0, -10 + bob, 6.2);
    g.lineStyle(1.2, 0x8fa7b1, 1);
    g.strokeCircle(0, -10 + bob, 6.2);

    // Directional visor
    g.fillStyle(0x0c1c22, 1);
    g.fillCircle(dir.x * 2.6, -10 + bob + dir.y * 2.6, 3.6);
    g.fillStyle(0x72d9e9, 0.9);
    g.fillCircle(dir.x * 3.1, -10 + bob + dir.y * 3.1, 1.7);
  }

  function resetPlayerToHub(scene) {
    const c = hubCenter();
    player.x = c.x;
    player.y = c.y;
    player.facing = 2;
    player.moving = false;
    scene.cameras.main.centerOn(player.x, player.y);
  }

  function updateNavigationHelpCopy() {
    const navSection = [...document.querySelectorAll("#help-screen .codex-grid section")]
      .find(section => section.querySelector("h3")?.textContent === "Navigation");
    const paragraph = navSection?.querySelector("p");
    if (paragraph) {
      paragraph.innerHTML =
        "<kbd>WASD</kbd> or arrow keys move your engineer; the camera follows automatically. " +
        "Hold <kbd>MMB</kbd> or <kbd>Space</kbd> + drag to look around, and use the mouse wheel to zoom. " +
        "Click the tactical map to redeploy instantly.";
    }
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
    if (scene.__characterPatched) return;
    scene.__characterPatched = true;

    // Terrain rebuild support for regenerated sectors.
    scene.rebuildTerrain = function () {
      if (this.terrainLayer) {
        this.terrainLayer.destroy();
        this.terrainLayer = null;
      }
      this.createTerrain();
    };
    window.foundryRebuildTerrain = () => {
      scene.rebuildTerrain();
      resetPlayerToHub(scene);
    };

    // Create the avatar in world space so it scrolls with the camera.
    player.gfx = scene.add.graphics().setScale(1.35).setDepth(1000 + player.y);
    resetPlayerToHub(scene);

    // Replace camera movement with character movement + smooth follow.
    scene.updateCamera = function (dt) {
      if (paused) return;
      const cam = this.cameras.main;
      if (this.pointerPan) return; // manual look-around; resume follow on release

      let mx = 0;
      let my = 0;
      if (keys.has("KeyW") || keys.has("ArrowUp")) my -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) my += 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) mx -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) mx += 1;

      player.moving = Boolean(mx || my);
      if (player.moving) {
        const length = Math.hypot(mx, my) || 1;
        player.x = clamp(player.x + (mx / length) * PLAYER_SPEED * dt, TILE * 0.5, WORLD_W * TILE - TILE * 0.5);
        player.y = clamp(player.y + (my / length) * PLAYER_SPEED * dt, TILE * 0.5, WORLD_H * TILE - TILE * 0.5);
        player.walk += dt;
        player.facing = Math.abs(mx) >= Math.abs(my) ? (mx > 0 ? 1 : 3) : (my > 0 ? 2 : 0);
      }

      const cx = Phaser.Math.Linear(cam.midPoint.x, player.x, 0.15);
      const cy = Phaser.Math.Linear(cam.midPoint.y, player.y, 0.15);
      cam.centerOn(cx, cy);
    };

    // Draw the avatar every frame after the building views update.
    const baseUpdateBuildingViews = scene.updateBuildingViews.bind(scene);
    scene.updateBuildingViews = function (time) {
      baseUpdateBuildingViews(time);
      player.gfx.setPosition(player.x, player.y).setDepth(1000 + player.y);
      drawPlayer(player.gfx);
    };

    // Tactical-map clicks redeploy the engineer so the follow camera stays coherent.
    const priorCenterOnTile = centerOnTile;
    centerOnTile = (x, y) => {
      priorCenterOnTile(x, y);
      player.x = clamp((x + 0.5) * TILE, TILE * 0.5, WORLD_W * TILE - TILE * 0.5);
      player.y = clamp((y + 0.5) * TILE, TILE * 0.5, WORLD_H * TILE - TILE * 0.5);
      scene.cameras.main.centerOn(player.x, player.y);
    };

    updateNavigationHelpCopy();
    setStatus("Engineer deployed. Move with WASD; the camera follows.");
  }

  waitForScene();
})();
