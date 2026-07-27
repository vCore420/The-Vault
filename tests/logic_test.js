'use strict';
const fs = require('fs');
const THREE_STUB = require('./three_stub.js');

const order = ['utils','audio','generator','textures','world','player','interaction','ui','save','game'];
const scriptContent = order.map(n => fs.readFileSync('../js/'+n+'.js','utf8')).join('\n');

function makeCtx(){
  const store = {};
  return new Proxy({}, {
    get(target, prop){
      if(prop in store) return store[prop];
      if(prop === 'createRadialGradient' || prop === 'createLinearGradient') return () => ({ addColorStop: () => {} });
      if(prop === 'measureText') return () => ({ width: 10 });
      return () => {};
    },
    set(target, prop, value){ store[prop] = value; return true; }
  });
}
global.window = {
  matchMedia: () => ({ matches:false }),
  addEventListener: () => {},
  AudioContext: function(){ this.currentTime=0; this.state='running'; this.destination={};
    this.createGain=()=>({gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}},connect(){}});
    this.createOscillator=()=>({type:'sine',frequency:{value:0,setValueAtTime(){}},detune:{value:0},connect(){},start(){},stop(){}});
    this.createBiquadFilter=()=>({type:'',frequency:{value:0,setValueAtTime(){},linearRampToValueAtTime(){}},Q:{value:0},connect(){}});
    this.createBuffer=(ch,len)=>({getChannelData:()=>new Float32Array(Math.max(1,len))});
    this.createBufferSource=()=>({buffer:null,loop:false,connect(){},start(){},stop(){}});
    this.resume=()=>{};
  },
  devicePixelRatio: 1, innerWidth: 800, innerHeight: 600
};
function fakeCanvasEl(){ return { width:0, height:0, getContext:()=>makeCtx(), style:{}, addEventListener:()=>{}, requestPointerLock:()=>{} }; }
function fakeDomEl(){
  return {
    addEventListener:()=>{}, classList:{add(){},remove(){},toggle(){},contains:()=>false}, style:{},
    appendChild(){}, textContent:'', innerHTML:'', getBoundingClientRect:()=>({left:0,right:400,top:0,bottom:400}),
    requestPointerLock:()=>{}
  };
}
global.document = {
  getElementById: (id) => id === 'render-canvas' ? fakeCanvasEl() : fakeDomEl(),
  addEventListener: () => {},
  createElement: (tag) => tag === 'canvas' ? fakeCanvasEl() : fakeDomEl(),
  readyState: 'loading',
  exitPointerLock: () => {},
  pointerLockElement: null
};
try { Object.defineProperty(global, 'navigator', { value: { maxTouchPoints: 0 }, configurable: true }); }
catch(e) { global.navigator.maxTouchPoints = 0; }
global.THREE = THREE_STUB;
global.performance = { now: () => Date.now() };

const harness = `
const results = { errors: [] };
function check(cond, msg){ if(!cond) results.errors.push(msg); }

const SEEDS_TO_TRY = [1,2,3,42,1234];
for(const seed of SEEDS_TO_TRY){
  const puzzle = Generator.generate(seed);
  const tweens = new Utils.Tweens();
  const worldRng = new Utils.RNG(seed ^ 0x2f6e2b19);
  let world;
  try{ world = new VaultWorld(puzzle, tweens, worldRng); }
  catch(e){ results.errors.push('seed '+seed+' VaultWorld construction threw: '+e.stack); continue; }

  check(world.boxUnits.size === puzzle.boxCount, 'seed '+seed+': boxUnits size mismatch ('+world.boxUnits.size+' vs '+puzzle.boxCount+')');
  check(world.keyUnits.size === puzzle.boxCount, 'seed '+seed+': keyUnits size mismatch');

  for(const box of puzzle.boxes){
    const unit = world.boxUnits.get(box.id);
    check(!!unit, 'seed '+seed+': missing unit for '+box.id);
    check(!!unit.group, 'seed '+seed+': unit missing group for '+box.id);
    check(!!unit.lockAnchor, 'seed '+seed+': unit missing lockAnchor for '+box.id+' ('+box.archetype+')');
    check(!!unit.glowMat, 'seed '+seed+': unit missing glowMat for '+box.id);
  }

  const allEffectIds = ['lampOn','fireplaceLight','rainStop','clockAdvance','plantAppear','photoAppear','rugAppear','chimeFlourish'];
  for(const id of allEffectIds){
    try{ world.applyEnvironmentEffect(id, {immediate:false}); }catch(e){ results.errors.push('seed '+seed+' effect '+id+' threw: '+e.stack); }
    try{ world.applyEnvironmentEffect(id, {immediate:true}); }catch(e){ results.errors.push('seed '+seed+' effect '+id+' immediate threw: '+e.stack); }
  }
  for(const q of puzzle.rewardQueue){
    try{ world.addMemento(q.reward, worldRng); }catch(e){ results.errors.push('seed '+seed+' memento '+q.reward.shape+' threw: '+e.stack); }
  }
  for(let i=0;i<40;i++) tweens.update(0.05);

  const camera = new THREE.PerspectiveCamera(68,1,0.05,100);
  const audioStub = { resume(){}, click(){}, keyPickup(){}, keyReturn(){}, insertTry(){}, unlockFail(){}, unlockSuccess(){}, environmentChime(){}, drawerSlide(){}, setMuted(){}, muted:false };
  const uiStub = { setPrompt(){}, setCrosshairHot(){}, setHeldKey(){}, setInspecting(){}, setPositioning(){}, updateProgress(){}, showReward(box,q,onDismiss){ if(onDismiss) onDismiss(); }, showWin(){} };
  const saveStub = { persist(){}, getStateFn:null };
  const interaction = new InteractionSystem(camera, audioStub, uiStub, tweens, saveStub);
  interaction.setWorld(world);
  let winFired = false;
  interaction.onWin = () => { winFired = true; };
  let progressCalls = 0;
  interaction.onProgress = () => { progressCalls++; };

  for(let i=0;i<30;i++) tweens.update(0.05);

  const animFamiliesSeen = new Set();
  const shuffledBoxes = worldRng.shuffle(puzzle.boxes);
  for(const box of shuffledBoxes){
    interaction.pickUpKey(box.keyId);
    check(interaction.heldKeyId === box.keyId, 'seed '+seed+': heldKeyId not set after pickUpKey');
    check(camera.children.includes(world.keyUnits.get(box.keyId).group), 'seed '+seed+': key mesh not reparented to camera on pickup');

    interaction.startInspect();
    interaction.onInspectDrag(3, -2);
    interaction.updateHeldKeyPose(0.016, 1.23, true);
    interaction.endInspect();

    interaction.attemptUnlock(box.id);
    const bu = world.boxUnits.get(box.id);
    check(bu.state === 'open', 'seed '+seed+': box '+box.id+' ('+box.archetype+') not opened after correct key attempt');
    check(interaction.heldKeyId === null, 'seed '+seed+': hand not empty after successful unlock');
    animFamiliesSeen.add(bu.animFamily);

    const ku = world.keyUnits.get(box.keyId);
    check(ku.state === 'used', 'seed '+seed+': key state not "used" after unlocking');
    check(!!ku.group.parent, 'seed '+seed+': key mesh has no parent after unlocking (it vanished!)');
    check(ku.group.parent === world.root, 'seed '+seed+': used key was not reparented into the world root');

    // REGRESSION: the box must actually animate open, not just flip a state
    // flag — this was a real bug where InteractionSystem set unit.state
    // BEFORE calling openBoxVisual, whose own guard (if state==='open' return)
    // then made the animation silently never run.
    for(let i=0;i<40;i++) tweens.update(0.05); // let any in-flight tween finish
    if(bu.animFamily === 'slideDrawer'){
      check(bu.panel.position.z !== bu.panel.userData.slideClosedZ,
        'seed '+seed+': slideDrawer box '+box.id+' panel never moved from its closed position (animation did not run)');
      check(Math.abs(bu.panel.position.z - bu.panel.userData.slideOpenZ) < 0.001,
        'seed '+seed+': slideDrawer box '+box.id+' panel did not reach its fully-open position');
    } else if(bu.animFamily === 'lidBox' || bu.animFamily === 'unfold'){
      check(Math.abs(bu.pivot.rotation.x - bu.openTarget) < 0.01,
        'seed '+seed+': '+bu.animFamily+' box '+box.id+' lid never rotated open (animation did not run)');
    } else if(bu.animFamily === 'swingDoor'){
      check(Math.abs(bu.pivot.rotation.y - bu.openTarget) < 0.01,
        'seed '+seed+': swingDoor box '+box.id+' door never swung open (animation did not run)');
    }
    check(bu.glowMat.emissiveIntensity > 0.4, 'seed '+seed+': box '+box.id+' glow never lit up (animation did not run)');
  }
  check(interaction.openedCount === puzzle.boxCount, 'seed '+seed+': openedCount != boxCount ('+interaction.openedCount+'/'+puzzle.boxCount+')');
  check(winFired, 'seed '+seed+': onWin never fired after opening all containers');
  check(progressCalls === puzzle.boxCount, 'seed '+seed+': onProgress not called once per container');
  check(animFamiliesSeen.size >= 3, 'seed '+seed+': expected multiple distinct animation families, saw '+[...animFamiliesSeen].join(','));

  const puzzle2 = Generator.generate(seed + 555);
  const tweens2 = new Utils.Tweens();
  const world2 = new VaultWorld(puzzle2, tweens2, new Utils.RNG(seed+556));
  const interaction2 = new InteractionSystem(new THREE.PerspectiveCamera(68,1,0.05,100), audioStub, uiStub, tweens2, saveStub);
  interaction2.setWorld(world2);
  const boxA = puzzle2.boxes[0];
  const wrongKey = puzzle2.keys.find(k => k.boxId !== boxA.id);
  interaction2.pickUpKey(wrongKey.id);
  interaction2.attemptUnlock(boxA.id);
  check(world2.boxUnits.get(boxA.id).state === 'locked', 'seed '+seed+': WRONG key incorrectly opened a container!');
  check(interaction2.heldKeyId === wrongKey.id, 'seed '+seed+': held key was cleared after a FAILED attempt');

  // ---- two-stage positioning: press once to aim, again to place ----
  interaction2.toggleDrop();
  check(interaction2.positioning === true, 'seed '+seed+': toggleDrop did not enter positioning mode');
  check(interaction2.heldKeyId === wrongKey.id, 'seed '+seed+': heldKeyId lost while positioning (should still track the key)');
  const positioningKu = world2.keyUnits.get(wrongKey.id);
  check(positioningKu.group.parent === world2.root, 'seed '+seed+': key not reparented to world root while positioning');

  // interact() must do nothing at all while positioning
  const openedCountBefore = interaction2.openedCount;
  interaction2.currentHoverTarget = { kind:'box', id:boxA.id, distance:1 };
  interaction2.interact();
  check(interaction2.openedCount === openedCountBefore, 'seed '+seed+': interact() acted on the world while positioning a key (should be a no-op)');
  check(interaction2.positioning === true, 'seed '+seed+': positioning was exited by an unrelated interact() call');

  // moving the aim point should move the key (raycaster stub returns no hits
  // by default, so this exercises the floor-projection fallback)
  interaction2.updatePositioningPose();
  const posAfterUpdate = positioningKu.group.position;
  check(typeof posAfterUpdate.x === 'number' && typeof posAfterUpdate.z === 'number',
    'seed '+seed+': positioning pose update did not produce a valid position');

  interaction2.toggleDrop(); // second press confirms placement
  check(interaction2.positioning === false, 'seed '+seed+': toggleDrop did not exit positioning mode on second press');
  check(interaction2.heldKeyId === null, 'seed '+seed+': heldKeyId not cleared after confirming placement');
  check(positioningKu.state === 'dropped', 'seed '+seed+': key state not "dropped" after confirming placement');
  check(positioningKu.group.parent === world2.root, 'seed '+seed+': placed key not left in the world root');

  // and it must be pickup-able again from wherever it was placed
  interaction2.pickUpKey(wrongKey.id);
  check(interaction2.heldKeyId === wrongKey.id, 'seed '+seed+': could not re-pick-up a key after placing it');

  const puzzle3 = Generator.generate(seed + 999);
  const tweens3 = new Utils.Tweens();
  const world3 = new VaultWorld(puzzle3, tweens3, new Utils.RNG(seed+1000));
  const interaction3 = new InteractionSystem(new THREE.PerspectiveCamera(68,1,0.05,100), audioStub, uiStub, tweens3, saveStub);
  interaction3.setWorld(world3);
  const partialOrder = worldRng.shuffle(puzzle3.boxes).slice(0, Math.max(1, puzzle3.boxCount - 3)).map(b=>b.id);
  try{ interaction3.restoreOpened(partialOrder); }
  catch(e){ results.errors.push('seed '+seed+' restoreOpened threw: '+e.stack); }
  check(interaction3.openedCount === partialOrder.length, 'seed '+seed+': restore openedCount mismatch');
  for(const id of partialOrder){
    const bu = world3.boxUnits.get(id);
    check(bu.state === 'open', 'seed '+seed+': restored container not marked open');
    const ku = world3.keyUnits.get(bu.data.keyId);
    check(ku.state === 'used' && !!ku.group.parent, 'seed '+seed+': restored key vanished instead of being inserted');
  }
}

{
  const puzzle = Generator.generate(4242);
  const tweens = new Utils.Tweens();
  const world = new VaultWorld(puzzle, tweens, new Utils.RNG(4243));
  const camera = new THREE.PerspectiveCamera(68,1,0.05,100);
  let dropCalled = false;
  try{
    const player = new PlayerController(camera, {
      onInteract(){}, isInspecting(){return false;}, onInspectDrag(){}, onInspectStart(){}, onInspectEnd(){},
      onDrop(){ dropCalled = true; }, onFirstInput(){}
    });
    player.setWorld(world);
    player.setEnabled(true);
    player.keys.fwd = true;
    for(let i=0;i<200;i++) player.update(1/60);
    check(player.moving === true, 'player.moving flag not set while walking forward');
    check(player.pos.z >= world.roomBounds.minZ - 0.01, 'player walked through the far wall');
    player.keys.fwd = false; player.keys.back = true;
    for(let i=0;i<400;i++) player.update(1/60);
    check(player.pos.z <= world.roomBounds.maxZ + 0.01, 'player walked through the near wall');
    player.keys.back = false;
    for(let i=0;i<5;i++) player.update(1/60);
    check(player.moving === false, 'player.moving flag stuck true after stopping');
  }catch(e){ results.errors.push('PlayerController smoke test threw: '+e.stack); }
}

// ---- REGRESSION: camera must be part of the scene graph, or anything
// parented to it (the held key) is invisible no matter its transform ----
{
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68,1,0.05,100);
  scene.add(camera);
  const puzzle = Generator.generate(77);
  const tweens = new Utils.Tweens();
  const world = new VaultWorld(puzzle, tweens, new Utils.RNG(78));
  scene.add(world.root);
  const audioStub = { resume(){}, keyPickup(){} };
  const uiStub = { setPrompt(){}, setCrosshairHot(){}, setHeldKey(){}, setInspecting(){}, setPositioning(){}, updateProgress(){} };
  const interaction = new InteractionSystem(camera, audioStub, uiStub, tweens, { persist(){} });
  interaction.setWorld(world);
  const someKey = puzzle.keys[0];
  interaction.pickUpKey(someKey.id);
  let foundInSceneTraversal = false;
  scene.traverse(o => { if(o === world.keyUnits.get(someKey.id).group) foundInSceneTraversal = true; });
  check(foundInSceneTraversal, 'REGRESSION: held key mesh is not reachable via scene.traverse() — it would be invisible (camera must be added to the scene)');
}

// ---- scattered container placement: full rotation range + spread across the room ----
{
  const puzzle = Generator.generate(555);
  const tweens = new Utils.Tweens();
  const world = new VaultWorld(puzzle, tweens, new Utils.RNG(556));
  const scattered = puzzle.boxes.filter(b => !b.isWall);
  const rotations = scattered.map(b => world.boxUnits.get(b.id).group.rotation.y);
  const xs = scattered.map(b => world.boxUnits.get(b.id).group.position.x);
  const zs = scattered.map(b => world.boxUnits.get(b.id).group.position.z);
  const spreadX = Math.max(...xs) - Math.min(...xs);
  const spreadZ = Math.max(...zs) - Math.min(...zs);
  check(spreadX > ROOM.w * 0.4, 'scattered containers are not spread across much of the room width (spreadX='+spreadX.toFixed(2)+')');
  check(spreadZ > 3, 'scattered containers are clustered too tightly in depth (spreadZ='+spreadZ.toFixed(2)+')');
  const distinctRotBuckets = new Set(rotations.map(r => Math.round(r/(Math.PI/4))));
  check(distinctRotBuckets.size >= 3, 'scattered containers do not appear to face varied random directions');
}

// ---- key pile: keys start visible and pickable immediately, no "open" step ----
{
  const puzzle = Generator.generate(909);
  const tweens = new Utils.Tweens();
  const world = new VaultWorld(puzzle, tweens, new Utils.RNG(910));
  let allVisible = true;
  world.keyUnits.forEach(ku => { if(ku.group.visible === false) allVisible = false; if(ku.state !== 'onTable') allVisible = false; });
  check(allVisible, 'keys are not all immediately visible/onTable at world build time (a leftover "closed drawer" state?)');
}

console.log('LOGIC TEST ERRORS:', results.errors.length);
results.errors.slice(0,40).forEach(e => console.log(' -', e));
process.exit(0);
`;

eval(scriptContent + '\n' + harness);
