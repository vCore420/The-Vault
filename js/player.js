/*
 * player.js
 * PlayerController — first-person movement, desktop pointer-lock look, and mobile joystick + swipe-look input.
 * Depends on: Utils, World (for the ROOM constant), THREE.
 */
class PlayerController{
  constructor(camera, hooks){
    this.camera = camera;
    this.hooks = hooks || {};
    this.bounds = { minX:-5, maxX:5, minZ:-3, maxZ:3 };
    this.obstacles = [];
    this.pos = new THREE.Vector3(0, 0, ROOM.d/2 - 1.5);
    this.yaw = 0;
    this.pitch = 0;
    this.eyeHeight = 1.62;
    this.radius = 0.32;
    this.speed = 2.5;
    this.keys = { fwd:false, back:false, left:false, right:false };
    this.mouseSensitivity = 0.0022;
    this.touchLookSensitivity = 0.0034;
    this.bobT = 0;
    this.enabled = false;
    this.moving = false;

    this._joystick = { active:false, id:null, baseX:0, baseY:0, vecX:0, vecY:0 };
    this._look = { active:false, id:null, lastX:0, lastY:0 };
    this._rightDrag = false;

    this._bindDesktop();
    this._bindMobile();
    this._syncCamera();
  }

  setWorld(world){
    this.bounds = world.roomBounds;
    this.obstacles = world.obstacles;
    this.pos.set(0, 0, ROOM.d/2 - 1.5);
    this.yaw = 0;
    this.pitch = 0;
    this.bobT = 0;
    this._syncCamera(false);
  }

  setEnabled(v){ this.enabled = v; }

  _bindDesktop(){
    const canvas = document.getElementById('render-canvas');
    window.addEventListener('keydown', e => {
      if(!this.enabled) return;
      if(e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.fwd = true;
      if(e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.back = true;
      if(e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = true;
      if(e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = true;
      if(e.code === 'KeyG') { if(this.hooks.onDrop) this.hooks.onDrop(); }
    });
    window.addEventListener('keyup', e => {
      if(e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.fwd = false;
      if(e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.back = false;
      if(e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = false;
      if(e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = false;
    });

    canvas.addEventListener('click', () => {
      if(!this.enabled || Utils.isTouchDevice()) return;
      if(document.pointerLockElement !== canvas){
        canvas.requestPointerLock();
        if(this.hooks.onFirstInput) this.hooks.onFirstInput();
      } else {
        if(this.hooks.onInteract) this.hooks.onInteract();
      }
    });

    document.addEventListener('mousemove', e => {
      if(!this.enabled || document.pointerLockElement !== canvas) return;
      const dx = e.movementX || 0, dy = e.movementY || 0;
      if(this._rightDrag && this.hooks.isInspecting && this.hooks.isInspecting()){
        if(this.hooks.onInspectDrag) this.hooks.onInspectDrag(dx, dy);
      } else {
        this.yaw -= dx * this.mouseSensitivity;
        this.pitch -= dy * this.mouseSensitivity;
        this.pitch = Utils.clamp(this.pitch, -1.05, 1.15);
      }
    });

    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('mousedown', e => {
      if(e.button === 2){ this._rightDrag = true; if(this.hooks.onInspectStart) this.hooks.onInspectStart(); }
    });
    window.addEventListener('mouseup', e => {
      if(e.button === 2){ this._rightDrag = false; if(this.hooks.onInspectEnd) this.hooks.onInspectEnd(); }
    });
  }

  _bindMobile(){
    const zone = document.getElementById('joystick-zone');
    const base = document.getElementById('joystick-base');
    const knob = document.getElementById('joystick-knob');
    const look = document.getElementById('look-zone');
    const R = 50;

    zone.addEventListener('touchstart', e => {
      if(!this.enabled) return;
      const t = e.changedTouches[0];
      this._joystick.active = true; this._joystick.id = t.identifier;
      const rect = zone.getBoundingClientRect();
      let bx = t.clientX, by = t.clientY;
      bx = Utils.clamp(bx, rect.left+55, rect.right-55);
      by = Utils.clamp(by, rect.top+55, rect.bottom-55);
      this._joystick.baseX = bx; this._joystick.baseY = by;
      base.style.left = (bx - rect.left - 52) + 'px';
      base.style.top = (by - rect.top - 52) + 'px';
      base.style.display = 'block';
      e.preventDefault();
    }, { passive:false });

    zone.addEventListener('touchmove', e => {
      for(const t of e.changedTouches){
        if(t.identifier !== this._joystick.id) continue;
        let dx = t.clientX - this._joystick.baseX, dy = t.clientY - this._joystick.baseY;
        const len = Math.hypot(dx,dy);
        if(len > R){ dx = dx/len*R; dy = dy/len*R; }
        this._joystick.vecX = dx / R; this._joystick.vecY = dy / R;
        knob.style.transform = 'translate(-50%,-50%) translate(' + dx + 'px,' + dy + 'px)';
      }
      e.preventDefault();
    }, { passive:false });

    const endJoystick = e => {
      for(const t of e.changedTouches){
        if(t.identifier !== this._joystick.id) continue;
        this._joystick.active = false; this._joystick.id = null;
        this._joystick.vecX = 0; this._joystick.vecY = 0;
        base.style.display = 'none';
        knob.style.transform = 'translate(-50%,-50%)';
      }
    };
    zone.addEventListener('touchend', endJoystick);
    zone.addEventListener('touchcancel', endJoystick);

    look.addEventListener('touchstart', e => {
      if(!this.enabled) return;
      if(this.hooks.onFirstInput) this.hooks.onFirstInput();
      const t = e.changedTouches[0];
      if(this._look.active) return;
      this._look.active = true; this._look.id = t.identifier;
      this._look.lastX = t.clientX; this._look.lastY = t.clientY;
    }, { passive:true });

    look.addEventListener('touchmove', e => {
      for(const t of e.changedTouches){
        if(t.identifier !== this._look.id) continue;
        const dx = t.clientX - this._look.lastX, dy = t.clientY - this._look.lastY;
        this._look.lastX = t.clientX; this._look.lastY = t.clientY;
        if(this.hooks.isInspecting && this.hooks.isInspecting()){
          if(this.hooks.onInspectDrag) this.hooks.onInspectDrag(dx, dy);
        } else {
          this.yaw -= dx * this.touchLookSensitivity;
          this.pitch -= dy * this.touchLookSensitivity;
          this.pitch = Utils.clamp(this.pitch, -1.05, 1.15);
        }
      }
    }, { passive:true });

    const endLook = e => {
      for(const t of e.changedTouches){ if(t.identifier === this._look.id){ this._look.active = false; this._look.id = null; } }
    };
    look.addEventListener('touchend', endLook);
    look.addEventListener('touchcancel', endLook);
  }

  _resolveObstacles(x, z){
    for(const ob of this.obstacles){
      const nx = Utils.clamp(x, ob.minX - this.radius, ob.maxX + this.radius);
      const nz = Utils.clamp(z, ob.minZ - this.radius, ob.maxZ + this.radius);
      const inside = x > ob.minX - this.radius && x < ob.maxX + this.radius && z > ob.minZ - this.radius && z < ob.maxZ + this.radius;
      if(inside){
        const dLeft = Math.abs(x - (ob.minX - this.radius));
        const dRight = Math.abs((ob.maxX + this.radius) - x);
        const dTop = Math.abs(z - (ob.minZ - this.radius));
        const dBottom = Math.abs((ob.maxZ + this.radius) - z);
        const m = Math.min(dLeft, dRight, dTop, dBottom);
        if(m === dLeft) x = ob.minX - this.radius;
        else if(m === dRight) x = ob.maxX + this.radius;
        else if(m === dTop) z = ob.minZ - this.radius;
        else z = ob.maxZ + this.radius;
      }
    }
    return { x, z };
  }

  update(dt){
    let fwdInput = 0, strafeInput = 0;
    if(this.keys.fwd) fwdInput += 1;
    if(this.keys.back) fwdInput -= 1;
    if(this.keys.right) strafeInput += 1;
    if(this.keys.left) strafeInput -= 1;
    if(this._joystick.active){
      fwdInput += -this._joystick.vecY;
      strafeInput += this._joystick.vecX;
    }
    const len = Math.hypot(fwdInput, strafeInput);
    if(len > 1){ fwdInput /= len; strafeInput /= len; }

    const moving = Math.abs(fwdInput) > 0.02 || Math.abs(strafeInput) > 0.02;
    this.moving = moving;
    if(this.enabled && moving){
      const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
      const dx = (-sinY * fwdInput + cosY * strafeInput) * this.speed * dt;
      const dz = (-cosY * fwdInput - sinY * strafeInput) * this.speed * dt;
      let nx = Utils.clamp(this.pos.x + dx, this.bounds.minX, this.bounds.maxX);
      let nz = Utils.clamp(this.pos.z + dz, this.bounds.minZ, this.bounds.maxZ);
      const resolved = this._resolveObstacles(nx, nz);
      this.pos.x = resolved.x; this.pos.z = resolved.z;
      this.bobT += dt * 6.2;
    } else {
      this.bobT += (0 - (this.bobT % (Math.PI*2) )) * 0; // hold phase
    }

    this._syncCamera(moving);
  }

  _syncCamera(moving){
    const bobAmt = (moving && !Utils.prefersReducedMotion()) ? Math.sin(this.bobT) * 0.018 : 0;
    this.camera.position.set(this.pos.x, this.eyeHeight + bobAmt, this.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0;
  }
}
