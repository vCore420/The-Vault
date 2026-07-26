/*
 * interaction.js
 * InteractionSystem — raycast targeting, physical key pickup/drop/inspect with sway, unlock attempts, and save/restore of progress.
 * Depends on: Utils, THREE.
 */
const MAX_INTERACT_DISTANCE = 3.3;

class InteractionSystem{
  constructor(camera, audio, ui, tweens, saveManager){
    this.camera = camera;
    this.world = null;
    this.audio = audio;
    this.ui = ui;
    this.tweens = tweens;
    this.save = saveManager;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = MAX_INTERACT_DISTANCE;
    this.heldKeyId = null;
    this.inspecting = false;
    this.positioning = false;
    this.openedCount = 0;
    this.openedOrder = [];
    this.onProgress = null;
    this.onWin = null;
    this.currentHoverTarget = null;
    this._center = new THREE.Vector2(0,0);
  }

  setWorld(world){
    this.world = world;
    this.heldKeyId = null;
    this.inspecting = false;
    this.positioning = false;
    this.openedCount = 0;
    this.openedOrder = [];
    this.currentHoverTarget = null;
  }

  raycastTarget(){
    if(!this.world) return null;
    this.raycaster.setFromCamera(this._center, this.camera);
    const intersects = this.raycaster.intersectObject(this.world.root, true);
    if(!intersects.length) return null;
    const hit = intersects[0];
    const ud = hit.object.userData;
    if(ud && ud.kind) return { kind: ud.kind, id: ud.id, distance: hit.distance };
    return null;
  }

  update(dt, elapsed, moving){
    if(!this.world) return;
    const target = this.raycastTarget();
    this.currentHoverTarget = target;
    this._updatePrompt(target);
    if(this.positioning) this.updatePositioningPose();
    else this.updateHeldKeyPose(dt || 0, elapsed || 0, !!moving);
  }

  _updatePrompt(target){
    if(this.positioning){ this.ui.setPrompt(null); this.ui.setCrosshairHot(false); return; }
    if(!target){ this.ui.setPrompt(null); this.ui.setCrosshairHot(false); return; }
    let text = null;
    if(target.kind === 'key'){
      const ku = this.world.keyUnits.get(target.id);
      if(ku && (ku.state === 'onTable' || ku.state === 'dropped')) text = this.heldKeyId ? 'Swap' : 'Pick Up';
    } else if(target.kind === 'box'){
      const bu = this.world.boxUnits.get(target.id);
      if(bu && bu.state === 'locked') text = this.heldKeyId ? 'Try Key' : 'Locked';
    }
    this.ui.setPrompt(text);
    this.ui.setCrosshairHot(!!text);
  }

  interact(){
    if(this.positioning) return; // only the drop control does anything while placing a key
    const target = this.currentHoverTarget;
    if(!target) return;
    this.audio.resume();
    if(target.kind === 'key'){
      const ku = this.world.keyUnits.get(target.id);
      if(!ku || (ku.state !== 'onTable' && ku.state !== 'dropped')) return;
      if(this.heldKeyId) this._quickDropAtFeet();
      this.pickUpKey(target.id);
      return;
    }
    if(target.kind === 'box'){
      const bu = this.world.boxUnits.get(target.id);
      if(!bu || bu.state !== 'locked') return;
      if(!this.heldKeyId){ this.audio.click(0.8); return; }
      this.attemptUnlock(target.id);
      return;
    }
  }

  pickUpKey(keyId){
    const ku = this.world.keyUnits.get(keyId);
    if(ku.group.parent) ku.group.parent.remove(ku.group);
    this.camera.add(ku.group);
    ku.carry = {
      // held close to centre-screen, right near the reticle, rather than off
      // to the side like a classic FPS weapon
      basePos: new THREE.Vector3(0.02, -0.07, -0.36),
      baseRotZ: 0.12,
      inspectRot: { x:0, y:0 },
      shakeRot: 0,
      swayAmt: 0
    };
    ku.group.position.copy(ku.carry.basePos);
    ku.group.rotation.set(0, 0, ku.carry.baseRotZ);
    ku.state = 'held';
    this.heldKeyId = keyId;
    this.audio.keyPickup();
    this.ui.setHeldKey(ku.data);
  }

  // Used internally when the player picks up a different key while already
  // holding one — a quick, undeliberate drop, distinct from the deliberate
  // positioning flow below.
  _quickDropAtFeet(){
    if(!this.heldKeyId) return;
    const ku = this.world.keyUnits.get(this.heldKeyId);
    const camPos = this.camera.position;
    const yaw = this.camera.rotation.y;
    const d = 0.42;
    const b = this.world.roomBounds;
    const dropX = Utils.clamp(camPos.x - Math.sin(yaw)*d, b.minX, b.maxX);
    const dropZ = Utils.clamp(camPos.z - Math.cos(yaw)*d, b.minZ, b.maxZ);
    if(ku.group.parent) ku.group.parent.remove(ku.group);
    this.world.dropKeyInWorld(ku.group, { x:dropX, z:dropZ }, yaw);
    ku.state = 'dropped';
    ku.carry = null;
    this.heldKeyId = null;
    this.ui.setHeldKey(null);
    this.endInspect();
    this.audio.keyReturn();
  }

  // The Drop control toggles a two-stage placement: press once to start
  // aiming the key at a surface (table, tray, floor — anywhere in reach),
  // press again to set it down exactly there. This is what makes the sorting
  // table actually usable for organizing keys, rather than just dropping
  // them wherever the player happens to be standing.
  toggleDrop(){
    if(!this.heldKeyId) return;
    if(!this.positioning) this.startPositioning();
    else this.confirmPlacement();
  }

  startPositioning(){
    if(!this.heldKeyId) return;
    const ku = this.world.keyUnits.get(this.heldKeyId);
    if(ku.group.parent) ku.group.parent.remove(ku.group);
    this.world.root.add(ku.group);
    ku.carry = null;
    this.positioning = true;
    this.endInspect();
    this.ui.setPositioning(true);
    this.updatePositioningPose();
  }

  computePlacementPoint(){
    this.raycaster.setFromCamera(this._center, this.camera);
    const hits = this.raycaster.intersectObject(this.world.root, true);
    if(hits.length){
      const p = hits[0].point;
      return { x:p.x, y:p.y+0.012, z:p.z };
    }
    // nothing in reach — project onto the floor along the view direction instead
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const origin = this.camera.position;
    let t = 1.4;
    if(dir.y < -0.05) t = Utils.clamp((0.02 - origin.y) / dir.y, 0.3, 3.2);
    const b = this.world.roomBounds;
    return {
      x: Utils.clamp(origin.x + dir.x*t, b.minX, b.maxX),
      y: 0.012,
      z: Utils.clamp(origin.z + dir.z*t, b.minZ, b.maxZ)
    };
  }

  updatePositioningPose(){
    if(!this.positioning || !this.heldKeyId) return;
    const ku = this.world.keyUnits.get(this.heldKeyId);
    const p = this.computePlacementPoint();
    ku.group.position.set(p.x, p.y, p.z);
    ku.group.rotation.set(-Math.PI/2, this.camera.rotation.y, 0);
  }

  confirmPlacement(){
    if(!this.positioning || !this.heldKeyId) return;
    const ku = this.world.keyUnits.get(this.heldKeyId);
    ku.state = 'dropped';
    ku.carry = null;
    this.positioning = false;
    this.heldKeyId = null;
    this.ui.setHeldKey(null);
    this.ui.setPositioning(false);
    this.audio.keyReturn();
  }

  attemptUnlock(boxId){
    const bu = this.world.boxUnits.get(boxId);
    const ku = this.world.keyUnits.get(this.heldKeyId);
    this.audio.insertTry();
    if(bu.data.keyId === this.heldKeyId){
      this._openBox(boxId);
    } else {
      this.audio.unlockFail();
      if(ku.carry){
        this.tweens.add({
          duration: 0.35,
          onUpdate: e => { ku.carry.shakeRot = Math.sin(e*Math.PI*4) * 0.12 * (1-e); }
        });
      }
    }
  }

  _openBox(boxId){
    const bu = this.world.boxUnits.get(boxId);
    const ku = this.world.keyUnits.get(this.heldKeyId);
    ku.state = 'used';
    ku.carry = null;
    if(ku.group.parent) ku.group.parent.remove(ku.group);
    // the key that opened it stays right there, visibly plugged into the lock —
    // physical proof of what happened, never removed from the world
    this.world.insertKeyIntoLock(boxId, ku.group);
    this.heldKeyId = null;
    this.ui.setHeldKey(null);
    this.endInspect();

    const queueEntry = this.world.puzzle.rewardQueue[this.openedCount];
    this.world.openBoxVisual(boxId);
    this.audio.unlockSuccess(!!(queueEntry && queueEntry.special));

    this.openedOrder.push(boxId);
    this.openedCount++;

    if(queueEntry && queueEntry.env){
      this.world.applyEnvironmentEffect(queueEntry.env.id);
      this.audio.environmentChime();
    }
    if(queueEntry) this.world.addMemento(queueEntry.reward, this.world.rng);

    if(this.onProgress) this.onProgress(this.openedCount, this.world.puzzle.boxCount);
    const justFinished = this.openedCount >= this.world.puzzle.boxCount;
    if(this.onRewardShown) this.onRewardShown();
    if(this.ui && queueEntry){
      this.ui.showReward(bu.data, queueEntry, () => {
        if(justFinished){ if(this.onWin) this.onWin(); }
        else if(this.onRewardDismissed) this.onRewardDismissed();
      });
    } else if(justFinished && this.onWin){
      this.onWin();
    }
    if(this.save) this.save.persist();
  }

  restoreOpened(boxIdsInOrder){
    boxIdsInOrder.forEach((boxId, idx) => {
      const bu = this.world.boxUnits.get(boxId);
      if(!bu) return;
      this.world.openBoxVisual(boxId, { immediate:true });
      const ku = this.world.keyUnits.get(bu.data.keyId);
      if(ku){
        ku.state = 'used';
        if(ku.group.parent) ku.group.parent.remove(ku.group);
        this.world.insertKeyIntoLock(boxId, ku.group);
      }
      const queueEntry = this.world.puzzle.rewardQueue[idx];
      if(queueEntry && queueEntry.env) this.world.applyEnvironmentEffect(queueEntry.env.id, { immediate:true });
      if(queueEntry) this.world.addMemento(queueEntry.reward, this.world.rng);
    });
    this.openedOrder = boxIdsInOrder.slice();
    this.openedCount = boxIdsInOrder.length;
  }

  isInspecting(){ return this.inspecting && !!this.heldKeyId && !this.positioning; }
  startInspect(){ if(this.heldKeyId && !this.positioning){ this.inspecting = true; this.ui.setInspecting(true); } }
  endInspect(){ this.inspecting = false; this.ui.setInspecting(false); }
  toggleInspect(){
    if(!this.heldKeyId || this.positioning) return;
    this.inspecting = !this.inspecting;
    this.ui.setInspecting(this.inspecting);
  }
  onInspectDrag(dx, dy){
    if(!this.heldKeyId) return;
    const ku = this.world.keyUnits.get(this.heldKeyId);
    if(!ku || !ku.carry) return;
    ku.carry.inspectRot.y += dx * 0.012;
    ku.carry.inspectRot.x += dy * 0.012;
  }

  // Applies idle carry sway (subtler while inspecting) on top of the base
  // held pose every frame — this is what makes the key feel like a real
  // object swinging gently in your hand as you walk, not a UI icon.
  updateHeldKeyPose(dt, elapsed, moving){
    if(!this.heldKeyId) return;
    const ku = this.world.keyUnits.get(this.heldKeyId);
    if(!ku || !ku.carry) return;
    const targetSway = (moving && !this.inspecting) ? 1 : 0;
    ku.carry.swayAmt = Utils.lerp(ku.carry.swayAmt, targetSway, Math.min(1, dt*4));
    const amt = ku.carry.swayAmt;
    const swayX = Math.sin(elapsed*8.2) * 0.011 * amt;
    const swayY = Math.abs(Math.sin(elapsed*8.2)) * -0.008 * amt;
    const swayRotZ = Math.sin(elapsed*8.2) * 0.05 * amt;
    const swayRotX = Math.sin(elapsed*4.1) * 0.02 * amt;
    ku.group.position.set(ku.carry.basePos.x + swayX, ku.carry.basePos.y + swayY, ku.carry.basePos.z);
    ku.group.rotation.set(
      ku.carry.inspectRot.x + swayRotX,
      ku.carry.inspectRot.y,
      ku.carry.baseRotZ + swayRotZ + ku.carry.shakeRot
    );
  }
}
