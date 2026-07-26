/*
 * game.js
 * Game — bootstraps renderer/scene/camera, wires every system together, and runs the main loop.
 * Depends on: all of the above, in load order.
 */
const Game = (() => {
  let renderer, scene, camera;
  let world = null;
  let player, interaction, audio, ui, save, tweens;
  let clock;
  let startTimestamp = 0;
  let savedStateCache = null;
  let currentSettings = Generator.defaultSettings();
  let gameHasStarted = false; // false only before the very first game of the session begins

  // Rolls a fresh random value for every field in the schema — used by the
  // settings modal's "Randomize" button. Works for any future field added to
  // SETTINGS_SCHEMA without needing changes here.
  function randomizeSettingsValues(schema){
    const rng = new Utils.RNG(Utils.makeSeed());
    const out = {};
    schema.forEach(f => {
      if(f.type === 'range'){
        const steps = Math.max(1, Math.round((f.max - f.min) / (f.step || 1)));
        out[f.key] = f.min + rng.int(0, steps) * (f.step || 1);
      } else if(f.type === 'select' && f.options && f.options.length){
        out[f.key] = rng.pick(f.options).value;
      } else {
        out[f.key] = f.default;
      }
    });
    return out;
  }

  function init(){
    const canvas = document.getElementById('render-canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0d0805, 0.03);
    camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 100);
    // the held key is parented to the camera (camera.add) — for that to ever
    // render, the camera itself must be part of the scene graph the renderer
    // actually traverses. Without this line, anything attached to the camera
    // is invisible no matter where it's positioned.
    scene.add(camera);

    audio = new AudioManager();
    ui = new UIManager(audio);
    save = new SaveManager();
    tweens = new Utils.Tweens();

    interaction = new InteractionSystem(camera, audio, ui, tweens, save);
    interaction.onProgress = (count, total) => ui.updateProgress(count, total);
    interaction.onWin = onWin;
    interaction.onRewardShown = () => player.setEnabled(false);
    interaction.onRewardDismissed = () => {
      player.setEnabled(true);
      if(!Utils.isTouchDevice()) canvas.requestPointerLock();
    };

    player = new PlayerController(camera, {
      onInteract: () => interaction.interact(),
      isInspecting: () => interaction.isInspecting(),
      onInspectDrag: (dx, dy) => interaction.onInspectDrag(dx, dy),
      onInspectStart: () => interaction.startInspect(),
      onInspectEnd: () => interaction.endInspect(),
      onDrop: () => interaction.toggleDrop(),
      onFirstInput: () => audio.resume()
    });

    ui.bindGameplayButtons(interaction, audio);
    ui.enableMobileControls(Utils.isTouchDevice());

    // Reset opens the settings panel rather than an immediate confirm() —
    // nothing changes until the person clicks Begin inside it, and native
    // confirm() dialogs can be silently blocked in some embedding contexts.
    ui.bindTopRight(() => {
      player.setEnabled(false);
      if(document.exitPointerLock) document.exitPointerLock();
      ui.showSettings(Generator.SETTINGS_SCHEMA, currentSettings);
    });

    ui.bindSettingsButtons({
      onBegin: () => {
        currentSettings = Generator.normalizeSettings(ui.readSettingsValues(Generator.SETTINGS_SCHEMA));
        ui.hideSettings();
        startNewGame(true, currentSettings);
      },
      onRandomize: () => {
        const randomized = randomizeSettingsValues(Generator.SETTINGS_SCHEMA);
        ui.renderSettingsFields(Generator.SETTINGS_SCHEMA, randomized);
      },
      onCancel: () => {
        ui.hideSettings();
        if(gameHasStarted){
          player.setEnabled(true);
          if(!Utils.isTouchDevice()) canvas.requestPointerLock();
        } else {
          ui.showStart(!!savedStateCache);
        }
      }
    });

    document.getElementById('begin-btn').addEventListener('click', () => {
      ui.hideStart();
      ui.showSettings(Generator.SETTINGS_SCHEMA, currentSettings);
    });
    document.getElementById('continue-btn').addEventListener('click', () => { ui.hideStart(); startNewGame(false); });
    document.getElementById('new-vault-btn').addEventListener('click', () => {
      ui.hideWin();
      ui.showSettings(Generator.SETTINGS_SCHEMA, currentSettings);
    });

    window.addEventListener('resize', onResize);
    clock = new THREE.Clock();

    save.load().then(state => {
      savedStateCache = state;
      ui.showStart(!!state);
    });

    requestAnimationFrame(loop);
  }

  function disposeWorld(w){
    if(!w) return;
    w.root.traverse(o => {
      if(o.geometry) o.geometry.dispose();
      if(o.material){
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { if(m.map) m.map.dispose(); m.dispose(); });
      }
    });
  }

  function startNewGame(fresh, settingsOverride){
    gameHasStarted = true;
    let seed, restoreData = null;
    if(fresh || !savedStateCache){
      seed = Utils.makeSeed();
    } else {
      seed = savedStateCache.seed;
      restoreData = savedStateCache;
    }

    // a saved game must regenerate with the settings it was originally
    // created under, not whatever is currently sitting in the settings modal
    const settingsToUse = restoreData
      ? Generator.normalizeSettings(restoreData.settings)
      : Generator.normalizeSettings(settingsOverride || currentSettings);
    currentSettings = settingsToUse;

    const puzzle = Generator.generate(seed, settingsToUse);
    const worldRng = new Utils.RNG((seed >>> 0) ^ 0x2f6e2b19);

    if(world){ scene.remove(world.root); disposeWorld(world); }
    world = new VaultWorld(puzzle, tweens, worldRng);
    scene.add(world.root);

    player.setWorld(world);
    interaction.setWorld(world);

    startTimestamp = (restoreData && restoreData.startedAt) ? restoreData.startedAt : Date.now();
    save.getStateFn = () => ({ seed, settings: currentSettings, openedOrder: interaction.openedOrder, startedAt: startTimestamp });

    let restoredToWin = false;
    if(restoreData && restoreData.openedOrder && restoreData.openedOrder.length){
      const validOrder = restoreData.openedOrder.filter(id => world.boxUnits.has(id));
      interaction.restoreOpened(validOrder);
      ui.updateProgress(interaction.openedCount, puzzle.boxCount);
      if(interaction.openedCount >= puzzle.boxCount) restoredToWin = true;
    } else {
      ui.updateProgress(0, puzzle.boxCount);
    }

    audio.startAmbience();
    audio.setRainLevel(world.envState.rainLevel);
    audio.setFireLevel(world.envState.fireOn ? 1 : 0);

    if(restoredToWin){ onWin(); return; }

    ui.showHud();
    player.setEnabled(true);
    if(!Utils.isTouchDevice()) document.getElementById('render-canvas').requestPointerLock();
  }

  function onWin(){
    player.setEnabled(false);
    if(document.exitPointerLock) document.exitPointerLock();
    ui.showWin(interaction.openedCount, Date.now() - startTimestamp);
  }

  function onResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function loop(){
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.getElapsedTime();
    tweens.update(dt);
    player.update(dt);
    interaction.update(dt, elapsed, player.moving);
    if(world) world.update(dt, elapsed);
    renderer.render(scene, camera);
  }

  return { init };
})();

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', Game.init);
} else {
  Game.init();
}
